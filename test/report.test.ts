import test from "node:test";
import assert from "node:assert/strict";

import sqlite3 from "sqlite3";
import { open } from "sqlite";

import {
    generateAttendanceReport,
    generateCheckinData,
    generateMeetingReport,
    getStatsForDate,
    isMeetingDate,
} from "../src/report";
import { performMigrations } from "../src/db";
import { getCurrentGraduationYears } from "../src/util";

async function createTestDb() {
    const db = await open({
        filename: ":memory:",
        driver: sqlite3.cached.Database,
    });
    await performMigrations(db);
    return db;
}

function parseCsv(csv: string) {
    const lines = csv.trim().split("\n");
    const headers = lines[0].split(",");
    return lines.slice(1).map((line) => {
        const values = line.split(",");
        const row: Record<string, string> = {};
        headers.forEach((header, i) => {
            row[header] = values[i] ?? "";
        });
        return row;
    });
}

async function seedReportData(db: Awaited<ReturnType<typeof createTestDb>>) {
    const [seniorYear, juniorYear, , freshmanYear] = getCurrentGraduationYears();

    await db.run(
        "INSERT INTO student (idNumber, firstName, lastName, graduationYear) VALUES (?, ?, ?, ?)",
        "111111111",
        "Ada",
        "Lovelace",
        freshmanYear,
    );
    await db.run(
        "INSERT INTO student (idNumber, firstName, lastName, graduationYear) VALUES (?, ?, ?, ?)",
        "222222222",
        "Grace",
        "Hopper",
        seniorYear,
    );
    await db.run(
        "INSERT INTO student (idNumber, firstName, lastName, graduationYear) VALUES (?, ?, ?, ?)",
        "333333333",
        "Alan",
        "Turing",
        juniorYear,
    );

    // Meeting date: 2026-10-01 (3 attendees, 2 checkouts)
    await db.run("INSERT INTO checkin (timestamp, idNumber) VALUES (?, ?)", "2026-10-01T15:00:00", "111111111");
    await db.run("INSERT INTO checkin (timestamp, idNumber) VALUES (?, ?)", "2026-10-01T16:00:00", "111111111");
    await db.run("INSERT INTO checkin (timestamp, idNumber) VALUES (?, ?)", "2026-10-01T15:10:00", "222222222");
    await db.run("INSERT INTO checkin (timestamp, idNumber) VALUES (?, ?)", "2026-10-01T15:20:00", "333333333");
    await db.run("INSERT INTO checkin (timestamp, idNumber) VALUES (?, ?)", "2026-10-01T16:10:00", "333333333");

    // Non-meeting date: 2026-10-02 (1 attendee)
    await db.run("INSERT INTO checkin (timestamp, idNumber) VALUES (?, ?)", "2026-10-02T15:00:00", "111111111");

    // Meeting date: 2026-10-03 (2 attendees, 1 checkout)
    await db.run("INSERT INTO checkin (timestamp, idNumber) VALUES (?, ?)", "2026-10-03T15:00:00", "111111111");
    await db.run("INSERT INTO checkin (timestamp, idNumber) VALUES (?, ?)", "2026-10-03T15:05:00", "222222222");
    await db.run("INSERT INTO checkin (timestamp, idNumber) VALUES (?, ?)", "2026-10-03T15:50:00", "222222222");
}

test("isMeetingDate and getStatsForDate return expected meeting and checkout stats", async () => {
    const db = await createTestDb();
    try {
        await seedReportData(db);

        const isMeeting = await isMeetingDate(db, "2026-10-01", 2);
        const isNotMeeting = await isMeetingDate(db, "2026-10-02", 2);
        assert.equal(isMeeting, true);
        assert.equal(isNotMeeting, false);

        const stats = await getStatsForDate(db, "2026-10-01");
        assert.equal(stats.numCheckins, 3);
        assert.equal(stats.numCheckouts, 2);
        assert.ok(Math.abs(stats.checkoutRatePercent - 66.6666667) < 0.0001);
    } finally {
        await db.close();
    }
});

test("generateAttendanceReport only counts meeting dates and computes rates", async () => {
    const db = await createTestDb();
    try {
        await seedReportData(db);

        const csv = await generateAttendanceReport(db, "2026-10-01", "2026-10-03", 2);
        const rows = parseCsv(csv);

        assert.equal(rows.length, 3);

        const ada = rows.find((row) => row.id_number === "111111111");
        const grace = rows.find((row) => row.id_number === "222222222");
        const alan = rows.find((row) => row.id_number === "333333333");

        assert.equal(ada?.num_checkins, "2");
        assert.equal(ada?.attendance_rate_percent, "100.00%");
        assert.equal(ada?.num_checkouts, "1");
        assert.equal(ada?.total_hours, "1.00");

        assert.equal(grace?.num_checkins, "2");
        assert.equal(grace?.attendance_rate_percent, "100.00%");
        assert.equal(grace?.num_checkouts, "1");
        assert.equal(grace?.total_hours, "0.75");

        assert.equal(alan?.num_checkins, "1");
        assert.equal(alan?.attendance_rate_percent, "50.00%");
        assert.equal(alan?.num_checkouts, "1");
        assert.equal(alan?.total_hours, "0.83");
    } finally {
        await db.close();
    }
});

test("generateMeetingReport includes class-year breakdown columns", async () => {
    const db = await createTestDb();
    try {
        await seedReportData(db);

        const csv = await generateMeetingReport(db, "2026-10-01", "2026-10-03", 2);
        const rows = parseCsv(csv);

        assert.equal(rows.length, 2);

        assert.deepEqual(rows[0], {
            date: "2026-10-01",
            num_checkins: "3",
            num_checkouts: "2",
            checkout_rate_percent: "66.67%",
            num_freshmen: "1",
            num_sophomores: "0",
            num_juniors: "1",
            num_seniors: "1",
        });

        assert.deepEqual(rows[1], {
            date: "2026-10-03",
            num_checkins: "2",
            num_checkouts: "1",
            checkout_rate_percent: "50.00%",
            num_freshmen: "1",
            num_sophomores: "0",
            num_juniors: "0",
            num_seniors: "1",
        });
    } finally {
        await db.close();
    }
});

test("generateCheckinData excludes non-meeting days and includes checkout times", async () => {
    const db = await createTestDb();
    try {
        await seedReportData(db);

        const csv = await generateCheckinData(db, "2026-10-01", "2026-10-03", 2);
        const rows = parseCsv(csv);

        assert.equal(rows.length, 5);
        assert.equal(rows.some((row) => row.date === "2026-10-02"), false);

        const graceDayOne = rows.find((row) => row.date === "2026-10-01" && row.id_number === "222222222");
        assert.equal(graceDayOne?.checkout_time, "");
        assert.equal(graceDayOne?.total_hours, "0.00");

        const adaDayOne = rows.find((row) => row.date === "2026-10-01" && row.id_number === "111111111");
        assert.equal(adaDayOne?.checkout_time, "2026-10-01T16:00:00");
        assert.equal(adaDayOne?.total_hours, "1.00");
    } finally {
        await db.close();
    }
});


