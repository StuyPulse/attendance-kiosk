import { Database } from "sqlite";
import sgMail from "@sendgrid/mail";

import { getStartDate, getToday, getTimestampedFilename } from "./util";
import {
    generateAttendanceReport,
    generateCheckinData,
    generateMeetingReport,
    getStatsForDate,
    MEETING_THRESHOLD,
} from "./report";

export async function sendReportEmail(db: Database) {
    const startDate = getStartDate();
    const today = getToday();

    const [
        attendanceReport,
        meetingReport,
        checkinData,
        todaysStats,
    ] = await Promise.all([
        generateAttendanceReport(db, startDate, today, MEETING_THRESHOLD),
        generateMeetingReport(db, startDate, today, MEETING_THRESHOLD),
        generateCheckinData(db, startDate, today, MEETING_THRESHOLD),
        getStatsForDate(db, today),
    ]);

    const text = `Attendance summary of today's meeting
Checkins: ${todaysStats.numCheckins}
Checkouts: ${todaysStats.numCheckouts}
Checkout rate: ${todaysStats.checkoutRatePercent.toFixed(2)}%

Attached are the attendance reports for the period ${startDate} to ${today}.`;
    const html = text.replace(/\n/g, "<br>");
    const msg = {
        to: "attendance-reports@stuypulse.com",
        from: {
            email: "no-reply@stuypulse.com",
            name: "StuyPulse Attendance Kiosk",
        },
        subject: `StuyPulse Attendance Reports - ${today}`,
        text: text,
        html: html,
        attachments: [
            {
                content: Buffer.from(attendanceReport).toString("base64"),
                filename: getTimestampedFilename("attendance-report", "csv"),
                type: "text/csv",
            },
            {
                content: Buffer.from(meetingReport).toString("base64"),
                filename: getTimestampedFilename("meeting-report", "csv"),
                type: "text/csv",
            },
            {
                content: Buffer.from(checkinData).toString("base64"),
                filename: getTimestampedFilename("checkins", "csv"),
                type: "text/csv",
            },
        ],
    };

    await sgMail.send(msg);
}
