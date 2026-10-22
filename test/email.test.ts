import test from "node:test";
import assert from "node:assert/strict";

import { SendRawEmailCommand } from "@aws-sdk/client-ses";
import { Database } from "sqlite";

import { buildReportEmailRawMessage, sendReportEmail } from "../src/email";

function withEnv(vars: Record<string, string | undefined>, run: () => Promise<void>) {
    const prev: Record<string, string | undefined> = {};
    for (const key of Object.keys(vars)) {
        prev[key] = process.env[key];
        const next = vars[key];
        if (next === undefined) {
            delete process.env[key];
        } else {
            process.env[key] = next;
        }
    }

    return run().finally(() => {
        for (const key of Object.keys(vars)) {
            const value = prev[key];
            if (value === undefined) {
                delete process.env[key];
            } else {
                process.env[key] = value;
            }
        }
    });
}

test("buildReportEmailRawMessage includes expected MIME sections and attachments", () => {
    const raw = buildReportEmailRawMessage({
        text: "Plain text body",
        html: "Plain<br>text<br>body",
        toAddress: "to@example.com",
        fromName: "Sender",
        fromAddress: "sender@example.com",
        subject: "Subject Line",
        attendanceFilename: "attendance.csv",
        meetingFilename: "meeting.csv",
        checkinsFilename: "checkins.csv",
        attendanceReport: "a,b\n1,2\n",
        meetingReport: "c,d\n3,4\n",
        checkinData: "e,f\n5,6\n",
        now: 123,
    });

    assert.match(raw, /Subject: Subject Line/);
    assert.match(raw, /Content-Type: multipart\/mixed; boundary="----=_Boundary_Mixed_123"/);
    assert.match(raw, /Content-Type: multipart\/alternative; boundary="----=_Boundary_Alt_123"/);
    assert.match(raw, /filename="attendance.csv"/);
    assert.match(raw, /filename="meeting.csv"/);
    assert.match(raw, /filename="checkins.csv"/);
    assert.match(raw, /YSxiCjEsMgo=/); // base64 of a,b\n1,2\n
});

test("sendReportEmail builds and sends raw message via injected SES client", async () => {
    await withEnv(
        {
            AWS_REGION: "us-east-1",
            REPORT_EMAIL_TO_ADDRESS: "reports@example.com",
        },
        async () => {
            let sentCommand: SendRawEmailCommand | null = null;
            let clientRegion: string | undefined;
            const reportCalls: Array<{ name: string; startDate: string; endDate: string; threshold: number }> = [];

            await sendReportEmail({} as unknown as Database, {
                getStartDate: () => "2026-09-01",
                getToday: () => "2026-10-22",
                now: () => 456,
                getTimestampedFilename: (prefix, extension) => `${prefix}.fixed.${extension}`,
                generateAttendanceReport: async (_db, startDate, endDate, threshold) => {
                    reportCalls.push({ name: "attendance", startDate, endDate, threshold });
                    return "id\n1\n";
                },
                generateMeetingReport: async (_db, startDate, endDate, threshold) => {
                    reportCalls.push({ name: "meeting", startDate, endDate, threshold });
                    return "date\n2026-10-22\n";
                },
                generateCheckinData: async (_db, startDate, endDate, threshold) => {
                    reportCalls.push({ name: "checkin", startDate, endDate, threshold });
                    return "checkin\nrow\n";
                },
                getStatsForDate: async () => ({
                    numCheckins: 10,
                    numCheckouts: 8,
                    checkoutRatePercent: 80,
                }),
                createSesClient: (region) => {
                    clientRegion = region;
                    return {
                        send: async (command) => {
                            sentCommand = command;
                            return {};
                        },
                    };
                },
            });

            assert.equal(clientRegion, "us-east-1");
            assert.equal(reportCalls.length, 3);
            for (const call of reportCalls) {
                assert.equal(call.startDate, "2026-09-01");
                assert.equal(call.endDate, "2026-10-22");
                assert.equal(call.threshold, 20);
            }

            assert.ok(sentCommand);
            const raw = Buffer.from((sentCommand as SendRawEmailCommand).input.RawMessage?.Data as Uint8Array).toString("utf-8");
            assert.match(raw, /To: reports@example.com/);
            assert.match(raw, /Subject: StuyPulse Attendance Reports - 2026-10-22/);
            assert.match(raw, /attendance-report.fixed.csv/);
            assert.match(raw, /meeting-report.fixed.csv/);
            assert.match(raw, /checkins.fixed.csv/);
            assert.match(raw, /Checkins: 10/);
            assert.match(raw, /Checkout rate: 80.00%/);
            assert.match(raw, /----=_Boundary_Mixed_456/);
        },
    );
});


