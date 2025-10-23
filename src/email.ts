import { Database } from "sqlite";
import { SESClient, SendRawEmailCommand } from "@aws-sdk/client-ses";

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
    const toAddress = process.env.REPORT_EMAIL_TO_ADDRESS;
    const fromName = "StuyPulse Attendance Kiosk";
    const fromAddress = "no-reply@stuypulse.com";
    const subject = `StuyPulse Attendance Reports - ${today}`;

    const boundaryMixed = `----=_Boundary_Mixed_${Date.now()}`;
    const boundaryAlt = `----=_Boundary_Alt_${Date.now()}`;

    const attendanceFilename = getTimestampedFilename("attendance-report", "csv");
    const meetingFilename = getTimestampedFilename("meeting-report", "csv");
    const checkinsFilename = getTimestampedFilename("checkins", "csv");

    const attendanceBase64 = Buffer.from(attendanceReport).toString("base64");
    const meetingBase64 = Buffer.from(meetingReport).toString("base64");
    const checkinsBase64 = Buffer.from(checkinData).toString("base64");

    // Build MIME message with CRLF line endings
    const crlf = "\r\n";
    const lines: string[] = [];

    lines.push(`From: ${fromName} <${fromAddress}>`);
    lines.push(`To: ${toAddress}`);
    lines.push(`Subject: ${subject}`);
    lines.push(`MIME-Version: 1.0`);
    lines.push(`Content-Type: multipart/mixed; boundary="${boundaryMixed}"`);
    lines.push(""); // blank line before body

    // multipart/alternative part
    lines.push(`--${boundaryMixed}`);
    lines.push(`Content-Type: multipart/alternative; boundary="${boundaryAlt}"`);
    lines.push("");

    // plain text
    lines.push(`--${boundaryAlt}`);
    lines.push(`Content-Type: text/plain; charset="UTF-8"`);
    lines.push(`Content-Transfer-Encoding: 7bit`);
    lines.push("");
    lines.push(text);
    lines.push("");

    // html
    lines.push(`--${boundaryAlt}`);
    lines.push(`Content-Type: text/html; charset="UTF-8"`);
    lines.push(`Content-Transfer-Encoding: 7bit`);
    lines.push("");
    lines.push(html);
    lines.push("");

    // end of alternative
    lines.push(`--${boundaryAlt}--`);
    lines.push("");

    // Attachment: attendance report
    lines.push(`--${boundaryMixed}`);
    lines.push(`Content-Type: text/csv; name="${attendanceFilename}"`);
    lines.push(`Content-Disposition: attachment; filename="${attendanceFilename}"`);
    lines.push(`Content-Transfer-Encoding: base64`);
    lines.push("");
    lines.push(attendanceBase64);
    lines.push("");

    // Attachment: meeting report
    lines.push(`--${boundaryMixed}`);
    lines.push(`Content-Type: text/csv; name="${meetingFilename}"`);
    lines.push(`Content-Disposition: attachment; filename="${meetingFilename}"`);
    lines.push(`Content-Transfer-Encoding: base64`);
    lines.push("");
    lines.push(meetingBase64);
    lines.push("");

    // Attachment: checkins
    lines.push(`--${boundaryMixed}`);
    lines.push(`Content-Type: text/csv; name="${checkinsFilename}"`);
    lines.push(`Content-Disposition: attachment; filename="${checkinsFilename}"`);
    lines.push(`Content-Transfer-Encoding: base64`);
    lines.push("");
    lines.push(checkinsBase64);
    lines.push("");

    // end of mixed
    lines.push(`--${boundaryMixed}--`);
    lines.push("");

    const rawMessage = lines.join(crlf);

    const sesClient = new SESClient({ region: process.env.AWS_REGION });
    const sendCommand = new SendRawEmailCommand({
        RawMessage: { Data: Buffer.from(rawMessage) },
        // Optionally set Source and Destinations; headers in raw message suffice.
    });

    await sesClient.send(sendCommand);
}