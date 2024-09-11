import { app, BrowserWindow, ipcMain, dialog } from "electron";
import * as fs from "fs";
import * as path from "path";

import sqlite3 from "sqlite3";
import { open } from "sqlite";

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

// Time between the first and last swipe of a day to consider a student to have checked out
const MIN_CHECKOUT_TIME_S = 1800;

(async () => {
    const db = await open({
        filename: DB_PATH,
        driver: sqlite3.cached.Database,
    });
    await db.exec("CREATE TABLE IF NOT EXISTS checkin (timestamp TEXT, idNumber TEXT)");
    await db.exec("CREATE INDEX IF NOT EXISTS timestampIndex ON checkin (timestamp COLLATE NOCASE)");
    await db.exec("CREATE INDEX IF NOT EXISTS idNumberIndex ON checkin (idNumber)");
})();

// Convert a Date object to an ISO 8601 string in the local timezone
function toISOString(date: Date) {
    const tzOffset = (new Date()).getTimezoneOffset() * 60000;
    return (new Date(date.getTime() - tzOffset)).toISOString().slice(0, -1);
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

    ipcMain.handle("submit", async (_, idNumber) => {
        try {
            await db.run(
                "INSERT INTO checkin (timestamp, idNumber) VALUES (?, ?)",
                toISOString(new Date()),
                idNumber,
            );
            return true;
        } catch (err) {
            dialog.showErrorBox("Error", err.toString());
            return false;
        }
    });

    ipcMain.on("exportAttendanceReport", async (_, startDate, endDate, meetingThreshold) => {
        try {
            const dateStr = toISOString(new Date());
            const dateStrNums = dateStr.split(".")[0].replace(/[^0-9]/g, "");
            const result = await dialog.showSaveDialog(mainWindow, {
                title: "Export Attendance Report",
                defaultPath: `attendance-report-${dateStrNums}.csv`,
                filters: [{name: "CSV Files", extensions: ["csv"]}],
            });

            if (result.canceled) {
                return;
            }

            const [
                checkinCountsResult,
                totalMeetingsResult,
            ] = await Promise.all([
                db.all(`
                    SELECT idNumber,
                           numCheckins,
                           numCheckouts,
                           numCheckouts * 100.0 / numCheckins AS checkoutRatePercent,
                           totalHours,
                           totalHours / numCheckouts AS averageHours
                    FROM
                      (SELECT idNumber,
                              count(*) AS numCheckins,
                              sum(hasCheckout) AS numCheckouts,
                              sum(totalHours) AS totalHours
                       FROM
                         (SELECT date(timestamp) AS date,
                                 idNumber,
                                 (unixepoch(max(timestamp)) - unixepoch(min(timestamp))) >= ${MIN_CHECKOUT_TIME_S} AS hasCheckout,
                                 CASE
                                     WHEN (unixepoch(max(timestamp)) - unixepoch(min(timestamp))) >= ${MIN_CHECKOUT_TIME_S} THEN (unixepoch(max(timestamp)) - unixepoch(min(timestamp))) / 3600.0
                                     ELSE 0
                                 END AS totalHours
                          FROM checkin
                          WHERE date IN
                              (SELECT date
                               FROM
                                 (SELECT date(timestamp) AS date,
                                         count(DISTINCT idNumber) AS numCheckins
                                  FROM checkin
                                  WHERE timestamp BETWEEN :startDate AND :endDate
                                    OR timestamp LIKE :endDate || '%'
                                  GROUP BY date
                                  HAVING numCheckins >= :meetingThreshold))
                            AND (timestamp BETWEEN :startDate AND :endDate
                                 OR timestamp LIKE :endDate || '%')
                          GROUP BY date, idNumber)
                       GROUP BY idNumber
                       ORDER BY numCheckins DESC)
                `, {
                    ":startDate": startDate,
                    ":endDate": endDate,
                    ":meetingThreshold": meetingThreshold,
                }),
                db.get(`
                    SELECT count(*) AS total
                    FROM
                      (SELECT date(timestamp) AS date,
                              count(DISTINCT idNumber) AS numCheckins
                       FROM checkin
                       WHERE timestamp BETWEEN :startDate AND :endDate
                         OR timestamp LIKE :endDate || '%'
                       GROUP BY date
                       HAVING numCheckins >= :meetingThreshold)
                `, {
                    ":startDate": startDate,
                    ":endDate": endDate,
                    ":meetingThreshold": meetingThreshold,
                }),
            ]);

            const header = "id_number,num_checkins,attendance_rate_percent,num_checkouts,checkout_rate_percent,total_hours,average_hours\n";
            const totalMeetings = totalMeetingsResult.total;
            const data = header + checkinCountsResult.map((row) => {
                const attendanceRatePercent = (row.numCheckins / totalMeetings * 100).toFixed(2);
                const checkoutRatePercent = row.checkoutRatePercent.toFixed(2);
                const totalHours = row.totalHours.toFixed(2);
                const averageHours = (row.averageHours || 0).toFixed(2);
                return `${row.idNumber},${row.numCheckins},${attendanceRatePercent}%,${row.numCheckouts},${checkoutRatePercent}%,${totalHours},${averageHours}\n`;
            }).join("");

            await fs.promises.writeFile(result.filePath, data);

            dialog.showMessageBox(mainWindow, {
                title: "Success",
                message: "Attendance report exported successfully",
            });
        } catch (err) {
            dialog.showErrorBox("Error", err.toString());
        }
    });

    ipcMain.on("exportMeetingReport", async (_, startDate, endDate, meetingThreshold) => {
        try {
            const dateStr = toISOString(new Date());
            const dateStrNums = dateStr.split(".")[0].replace(/[^0-9]/g, "");
            const result = await dialog.showSaveDialog(mainWindow, {
                title: "Export Meeting Report",
                defaultPath: `meeting-report-${dateStrNums}.csv`,
                filters: [{name: "CSV Files", extensions: ["csv"]}],
            });

            if (result.canceled) {
                return;
            }

            const meetingsResult = await db.all(`
                SELECT date, numCheckins,
                             numCheckouts,
                             numCheckouts * 100.0 / numCheckins AS checkoutRatePercent
                FROM
                  (SELECT date, count(*) AS numCheckins,
                                sum(hasCheckout) AS numCheckouts
                   FROM
                     (SELECT date(timestamp) AS date,
                             idNumber,
                             (unixepoch(max(timestamp)) - unixepoch(min(timestamp))) >= ${MIN_CHECKOUT_TIME_S} AS hasCheckout
                      FROM checkin
                      WHERE timestamp BETWEEN :startDate AND :endDate
                        OR timestamp LIKE :endDate || '%'
                      GROUP BY date,
                               idNumber)
                   GROUP BY date
                   HAVING numCheckins >= :meetingThreshold
                   ORDER BY date)
            `, {
                ":startDate": startDate,
                ":endDate": endDate,
                ":meetingThreshold": meetingThreshold,
            });

            const header = "date,num_checkins,num_checkouts,checkout_rate_percent\n";
            const data = header + meetingsResult.map((row) =>
                `${row.date},${row.numCheckins},${row.numCheckouts},${row.checkoutRatePercent.toFixed(2)}%\n`
            ).join("");

            await fs.promises.writeFile(result.filePath, data);

            dialog.showMessageBox(mainWindow, {
                title: "Success",
                message: "Meeting report exported successfully",
            });
        } catch (err) {
            dialog.showErrorBox("Error", err.toString());
        }
    });

    ipcMain.on("exportCheckinData", async (_, startDate, endDate, meetingThreshold) => {
        try {
            const dateStr = toISOString(new Date());
            const dateStrNums = dateStr.split(".")[0].replace(/[^0-9]/g, "");
            const result = await dialog.showSaveDialog(mainWindow, {
                title: "Export Checkin Data",
                defaultPath: `checkins-${dateStrNums}.csv`,
                filters: [{name: "CSV Files", extensions: ["csv"]}],
            });

            if (result.canceled) {
                return;
            }

            const checkinsResult = await db.all(`
                SELECT date(timestamp) AS date,
                       idNumber,
                       min(timestamp) AS checkinTime,
                       CASE
                           WHEN (unixepoch(max(timestamp)) - unixepoch(min(timestamp))) >= ${MIN_CHECKOUT_TIME_S} THEN max(timestamp)
                           ELSE NULL
                       END AS checkoutTime,
                       CASE
                           WHEN (unixepoch(max(timestamp)) - unixepoch(min(timestamp))) >= ${MIN_CHECKOUT_TIME_S} THEN (unixepoch(max(timestamp)) - unixepoch(min(timestamp))) / 3600.0
                           ELSE 0
                       END AS totalHours
                FROM checkin
                WHERE date IN
                    (SELECT date
                     FROM
                       (SELECT date(timestamp) AS date,
                               count(DISTINCT idNumber) AS numCheckins
                        FROM checkin
                        WHERE timestamp BETWEEN :startDate AND :endDate
                          OR timestamp LIKE :endDate || '%'
                        GROUP BY date
                        HAVING numCheckins >= :meetingThreshold))
                  AND (timestamp BETWEEN :startDate AND :endDate
                       OR timestamp LIKE :endDate || '%')
                GROUP BY date(timestamp),
                         idNumber
                ORDER BY min(timestamp);
            `, {
                ":startDate": startDate,
                ":endDate": endDate,
                ":meetingThreshold": meetingThreshold,
            });

            const header = "date,id_number,checkin_time,checkout_time,total_hours\n";
            const data = header + checkinsResult.map((row) =>
                `${row.date},${row.idNumber},${row.checkinTime},${row.checkoutTime || ""},${row.totalHours}\n`
            ).join("");

            await fs.promises.writeFile(result.filePath, data);

            dialog.showMessageBox(mainWindow, {
                title: "Success",
                message: "Checkin data exported successfully",
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
