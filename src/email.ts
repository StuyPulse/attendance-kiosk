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

type EmailClient = {
    send: (command: SendRawEmailCommand) => Promise<unknown>;
};

type SendReportEmailDeps = {
    getStartDate?: () => string;
    getToday?: () => string;
    getTimestampedFilename?: (prefix: string, extension: string) => string;
    generateAttendanceReport?: typeof generateAttendanceReport;
    generateMeetingReport?: typeof generateMeetingReport;
    generateCheckinData?: typeof generateCheckinData;
    getStatsForDate?: typeof getStatsForDate;
    createSesClient?: (region: string | undefined) => EmailClient;
    now?: () => number;
};

type ReportEmailMessageArgs = {
    text: string;
    html: string;
    toAddress: string | undefined;
    fromName: string;
    fromAddress: string;
    subject: string;
    attendanceFilename: string;
    meetingFilename: string;
    checkinsFilename: string;
    attendanceReport: string;
    meetingReport: string;
    checkinData: string;
    now: number;
};

export function buildReportEmailRawMessage(args: ReportEmailMessageArgs) {
    const boundaryMixed = `----=_Boundary_Mixed_${args.now}`;
    const boundaryAlt = `----=_Boundary_Alt_${args.now}`;

    const attendanceBase64 = Buffer.from(args.attendanceReport).toString("base64");
    const meetingBase64 = Buffer.from(args.meetingReport).toString("base64");
    const checkinsBase64 = Buffer.from(args.checkinData).toString("base64");

    // Build MIME message with CRLF line endings
    const crlf = "\r\n";
    const lines: string[] = [];

    lines.push(`From: ${args.fromName} <${args.fromAddress}>`);
    lines.push(`To: ${args.toAddress}`);
    lines.push(`Subject: ${args.subject}`);
    lines.push("MIME-Version: 1.0");
    lines.push(`Content-Type: multipart/mixed; boundary="${boundaryMixed}"`);
    lines.push(""); // blank line before body

    // multipart/alternative part
    lines.push(`--${boundaryMixed}`);
    lines.push(`Content-Type: multipart/alternative; boundary="${boundaryAlt}"`);
    lines.push("");

    // plain text
    lines.push(`--${boundaryAlt}`);
    lines.push("Content-Type: text/plain; charset=\"UTF-8\"");
    lines.push("Content-Transfer-Encoding: 7bit");
    lines.push("");
    lines.push(args.text);
    lines.push("");

    // html
    lines.push(`--${boundaryAlt}`);
    lines.push("Content-Type: text/html; charset=\"UTF-8\"");
    lines.push("Content-Transfer-Encoding: 7bit");
    lines.push("");
    lines.push(args.html);
    lines.push("");

    // end of alternative
    lines.push(`--${boundaryAlt}--`);
    lines.push("");

    // Attachment: attendance report
    lines.push(`--${boundaryMixed}`);
    lines.push(`Content-Type: text/csv; name="${args.attendanceFilename}"`);
    lines.push(`Content-Disposition: attachment; filename="${args.attendanceFilename}"`);
    lines.push("Content-Transfer-Encoding: base64");
    lines.push("");
    lines.push(attendanceBase64);
    lines.push("");

    // Attachment: meeting report
    lines.push(`--${boundaryMixed}`);
    lines.push(`Content-Type: text/csv; name="${args.meetingFilename}"`);
    lines.push(`Content-Disposition: attachment; filename="${args.meetingFilename}"`);
    lines.push("Content-Transfer-Encoding: base64");
    lines.push("");
    lines.push(meetingBase64);
    lines.push("");

    // Attachment: checkins
    lines.push(`--${boundaryMixed}`);
    lines.push(`Content-Type: text/csv; name="${args.checkinsFilename}"`);
    lines.push(`Content-Disposition: attachment; filename="${args.checkinsFilename}"`);
    lines.push("Content-Transfer-Encoding: base64");
    lines.push("");
    lines.push(checkinsBase64);
    lines.push("");

    // end of mixed
    lines.push(`--${boundaryMixed}--`);
    lines.push("");

    return lines.join(crlf);
}

export async function sendReportEmail(db: Database, deps: SendReportEmailDeps = {}) {
    const startDate = (deps.getStartDate ?? getStartDate)();
    const today = (deps.getToday ?? getToday)();

    const attendanceReportFn = deps.generateAttendanceReport ?? generateAttendanceReport;
    const meetingReportFn = deps.generateMeetingReport ?? generateMeetingReport;
    const checkinDataFn = deps.generateCheckinData ?? generateCheckinData;
    const getStatsForDateFn = deps.getStatsForDate ?? getStatsForDate;
    const getTimestampedFilenameFn = deps.getTimestampedFilename ?? getTimestampedFilename;

    const [
        attendanceReport,
        meetingReport,
        checkinData,
        todaysStats,
    ] = await Promise.all([
        attendanceReportFn(db, startDate, today, MEETING_THRESHOLD),
        meetingReportFn(db, startDate, today, MEETING_THRESHOLD),
        checkinDataFn(db, startDate, today, MEETING_THRESHOLD),
        getStatsForDateFn(db, today),
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

    const rawMessage = buildReportEmailRawMessage({
        text,
        html,
        toAddress,
        fromName,
        fromAddress,
        subject,
        attendanceFilename: getTimestampedFilenameFn("attendance-report", "csv"),
        meetingFilename: getTimestampedFilenameFn("meeting-report", "csv"),
        checkinsFilename: getTimestampedFilenameFn("checkins", "csv"),
        attendanceReport,
        meetingReport,
        checkinData,
        now: (deps.now ?? Date.now)(),
    });

    const sesClient = deps.createSesClient
        ? deps.createSesClient(process.env.AWS_REGION)
        : new SESClient({ region: process.env.AWS_REGION });
    const sendCommand = new SendRawEmailCommand({
        RawMessage: { Data: Buffer.from(rawMessage) },
        // Optionally set Source and Destinations; headers in raw message suffice.
    });

    await sesClient.send(sendCommand);
}
