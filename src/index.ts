import { app, BrowserWindow, ipcMain, dialog } from "electron";
import * as fs from "fs";
import * as path from "path";

import { parse } from "csv-parse";
import { WebClient } from "@slack/web-api";
import sqlite3 from "sqlite3";
import { open } from "sqlite";
import schedule from "node-schedule";
import sgMail from "@sendgrid/mail";

import {
    generateAttendanceReport,
    generateCheckinData,
    generateMeetingReport,
    isMeetingDate, MEETING_THRESHOLD,
    MIN_CHECKOUT_TIME_S
} from "./report";
import { syncToMyPulse } from "./mypulse";
import { sendReportEmail } from "./email";
import { toISOString, getCSVFilename, getToday } from "./util";

// This allows TypeScript to pick up the magic constants that's auto-generated by Forge's Webpack
// plugin that tells the Electron app where to look for the Webpack-bundled app code (depending on
// whether you're running in development or production).
declare const MAIN_WINDOW_WEBPACK_ENTRY: string;
declare const MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY: string;

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require("electron-squirrel-startup")) {
    app.quit();
}

const DB_PATH = path.join(app.getPath("userData"), "data.db");

(async () => {
    const db = await open({
        filename: DB_PATH,
        driver: sqlite3.cached.Database,
    });
    await db.exec("CREATE TABLE IF NOT EXISTS checkin (timestamp TEXT, idNumber TEXT)");
    await db.exec("CREATE INDEX IF NOT EXISTS timestampIndex ON checkin (timestamp COLLATE NOCASE)");
    await db.exec("CREATE INDEX IF NOT EXISTS idNumberIndex ON checkin (idNumber)");
    await db.exec("CREATE TABLE IF NOT EXISTS student (idNumber TEXT PRIMARY KEY, firstName TEXT, lastName TEXT)");
})();

if (process.env.MYPULSE_API_KEY) {
    // Sync hourly to MyPulse
    schedule.scheduleJob("0 * * * *", async () => {
        try {
            const db = await open({
                filename: DB_PATH,
                driver: sqlite3.cached.Database,
            });
            await syncToMyPulse(db);
            console.log("Synced successfully to MyPulse");
        } catch (err) {
            console.log(err);
        }
    });
}

if (process.env.SENDGRID_API_KEY) {
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);

    schedule.scheduleJob("0 22 * * *", async () => {
        try {
            const db = await open({
                filename: DB_PATH,
                driver: sqlite3.cached.Database,
            });
            const today = getToday();
            if (await isMeetingDate(db, today, MEETING_THRESHOLD)) {
                await sendReportEmail(db);
                console.log("Report email sent successfully");
            } else {
                console.log("Not a meeting date, skipping report email");
            }
        } catch (err) {
            console.log(err);
        }
    });
}

async function promptForFilePath(defaultFilename: string, title: string) {
    const result = await dialog.showSaveDialog({
        title: title,
        defaultPath: defaultFilename,
        filters: [{name: "CSV Files", extensions: ["csv"]}],
    });

    if (result.canceled) {
        return null;
    }

    return result.filePath;
}

async function sendReportToSlack(slackClient: WebClient, data: string, filename: string, name: string) {
    const conversation = await slackClient.conversations.open({
        users: process.env.SLACK_EXPORT_USER_ID,
    });
    await slackClient.filesUploadV2({
        channel_id: conversation.channel.id,
        initial_comment: `${name} exported by attendance kiosk`,
        file: Buffer.from(data, "utf-8"),
        filename: filename,
    });
}

const createWindow = async () => {
    // Create the browser window.
    const mainWindow = new BrowserWindow({
        kiosk: process.argv.includes("--kiosk"),
        webPreferences: {
            preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY,
        },
    });

    const db = await open({
        filename: DB_PATH,
        driver: sqlite3.cached.Database,
    });

    const slackClient = new WebClient(process.env.SLACK_TOKEN);

    ipcMain.handle("submit", async (_, idNumber) => {
        try {
            const [, student] = await Promise.all([
                db.run(
                    "INSERT INTO checkin (timestamp, idNumber) VALUES (?, ?)",
                    toISOString(new Date()),
                    idNumber,
                ),
                db.get(
                    "SELECT * FROM student WHERE idNumber = ?",
                    idNumber,
                ),
            ]);
            const name = student ? `${student.firstName} ${student.lastName}` : null;
            return {success: true, name: name};
        } catch (err) {
            dialog.showErrorBox("Error", err.toString());
            return {success: false};
        }
    });

    ipcMain.handle("getTodaysStats", async () => {
        try {
            const date = toISOString(new Date()).split("T")[0];
            const result = await db.get(`
                SELECT count(*) AS numCheckins,
                       ifnull(sum(hasCheckout), 0) AS numCheckouts
                FROM
                  (SELECT date(timestamp) AS date,
                          idNumber,
                          (unixepoch(max(timestamp)) - unixepoch(min(timestamp))) >= ${MIN_CHECKOUT_TIME_S} AS hasCheckout
                   FROM checkin
                   WHERE date(timestamp) = :date
                   GROUP BY idNumber)
            `, {
                ":date": date,
            });
            return {
                numCheckins: result.numCheckins,
                numCheckouts: result.numCheckouts,
            }
        } catch (err) {
            dialog.showErrorBox("Error", err.toString());
        }
    });

    ipcMain.on("exportAttendanceReport", async (_, startDate, endDate, meetingThreshold, sendToSlack) => {
        try {
            const filename = getCSVFilename("attendance-report");
            const filePath = sendToSlack ? null : await promptForFilePath(filename, "Export Attendance Report");

            if (!sendToSlack && filePath === null) {
                return;
            }

            const data = await generateAttendanceReport(db, startDate, endDate, meetingThreshold);

            if (sendToSlack) {
                await sendReportToSlack(slackClient, data, filename, "Attendance report");
            } else {
                await fs.promises.writeFile(filePath, data);
            }

            await dialog.showMessageBox(mainWindow, {
                title: "Success",
                message: "Attendance report exported successfully",
            });
        } catch (err) {
            dialog.showErrorBox("Error", err.toString());
        }
    });

    ipcMain.on("exportMeetingReport", async (_, startDate, endDate, meetingThreshold, sendToSlack) => {
        try {
            const filename = getCSVFilename("meeting-report");
            const filePath = sendToSlack ? null : await promptForFilePath(filename, "Export Meeting Report");

            if (!sendToSlack && filePath === null) {
                return;
            }

            const data = await generateMeetingReport(db, startDate, endDate, meetingThreshold);

            if (sendToSlack) {
                await sendReportToSlack(slackClient, data, filename, "Meeting report");
            } else {
                await fs.promises.writeFile(filePath, data);
            }

            await dialog.showMessageBox(mainWindow, {
                title: "Success",
                message: "Meeting report exported successfully",
            });
        } catch (err) {
            dialog.showErrorBox("Error", err.toString());
        }
    });

    ipcMain.on("exportCheckinData", async (_, startDate, endDate, meetingThreshold, sendToSlack) => {
        try {
            const filename = getCSVFilename("checkins");
            const filePath = sendToSlack ? null : await promptForFilePath(filename, "Export Checkin Data");

            if (!sendToSlack && filePath === null) {
                return;
            }

            const data = await generateCheckinData(db, startDate, endDate, meetingThreshold);

            if (sendToSlack) {
                await sendReportToSlack(slackClient, data, filename, "Checkin data");
            } else {
                await fs.promises.writeFile(filePath, data);
            }

            await dialog.showMessageBox(mainWindow, {
                title: "Success",
                message: "Checkin data exported successfully",
            });
        } catch (err) {
            dialog.showErrorBox("Error", err.toString());
        }
    });

    ipcMain.on("importStudents", async () => {
        try {
            const result = await dialog.showOpenDialog({
                title: "Import Students",
                filters: [{name: "CSV Files", extensions: ["csv"]}],
                properties: ["openFile"],
            });

            if (result.canceled) {
                return;
            }

            const filePath = result.filePaths[0];
            const parser = fs
                .createReadStream(filePath)
                .pipe(parse({columns: true}));

            let numSuccess = 0;
            let numFailure = 0;
            await db.run("BEGIN TRANSACTION");
            for await (const record of parser) {
                const idNumber = record.id_number.trim();
                const firstName = record.first_name.trim();
                const lastName = record.last_name.trim();

                if (idNumber.length !== 9 || !firstName || !lastName) {
                    numFailure++;
                    continue;
                }

                await db.run(`INSERT OR REPLACE INTO student (idNumber, firstName, lastName) VALUES (?, ?, ?)`,
                    record.id_number.trim(),
                    record.first_name.trim(),
                    record.last_name.trim(),
                );
                numSuccess++;
            }
            await db.run("COMMIT");

            let message = `${numSuccess} record${numSuccess !== 1 ? "s" : ""} imported successfully`;
            if (numFailure > 0) {
                message += ` (${numFailure} failed validation)`;
            }
            await dialog.showMessageBox(mainWindow, {
                title: "Success",
                message: message,
            });
        } catch (err) {
            dialog.showErrorBox("Error", err.toString());
        }
    });

    ipcMain.on("syncToMyPulse", async () => {
        try {
            await syncToMyPulse(db);
            await dialog.showMessageBox(mainWindow, {
                title: "Success",
                message: "Synced successfully to MyPulse",
            });
        } catch (err) {
            dialog.showErrorBox("Error", err.toString());
        }
    });

    ipcMain.on("sendReportEmail", async () => {
        try {
            await sendReportEmail(db);
            await dialog.showMessageBox(mainWindow, {
                title: "Success",
                message: "Report email sent successfully",
            });
        } catch (err) {
            dialog.showErrorBox("Error", err.toString());
        }
    });

    mainWindow.setContentSize(800, 480);

    // and load the index.html of the app.
    mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on("ready", createWindow);

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
        app.quit();
    }
});

app.on("activate", () => {
    // On OS X it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
