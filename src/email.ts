import { Database } from "sqlite";
import sgMail from "@sendgrid/mail";

import { getStartDate, getToday, getCSVFilename } from "./util";
import { generateAttendanceReport, generateCheckinData, generateMeetingReport, MEETING_THRESHOLD } from "./report";

export async function sendReportEmail(db: Database) {
    const startDate = getStartDate();
    const endDate = getToday();

    const [
        attendanceReport,
        meetingReport,
        checkinData,
    ] = await Promise.all([
        generateAttendanceReport(db, startDate, endDate, MEETING_THRESHOLD),
        generateMeetingReport(db, startDate, endDate, MEETING_THRESHOLD),
        generateCheckinData(db, startDate, endDate, MEETING_THRESHOLD),
    ]);

    const text = `Attached are the attendance reports for the period ${startDate} to ${endDate}.`;
    const msg = {
        to: "attendance-reports@stuypulse.com",
        from: {
            email: "no-reply@stuypulse.com",
            name: "StuyPulse Attendance Kiosk",
        },
        subject: `StuyPulse Attendance Reports - ${endDate}`,
        text: text,
        html: text,
        attachments: [
            {
                content: Buffer.from(attendanceReport).toString("base64"),
                filename: getCSVFilename("attendance-report"),
                type: "text/csv",
            },
            {
                content: Buffer.from(meetingReport).toString("base64"),
                filename: getCSVFilename("meeting-report"),
                type: "text/csv",
            },
            {
                content: Buffer.from(checkinData).toString("base64"),
                filename: getCSVFilename("checkins"),
                type: "text/csv",
            },
        ],
    };

    await sgMail.send(msg);
}
