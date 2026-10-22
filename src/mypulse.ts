import { Database } from "sqlite";

import { generateAttendanceReport, generateCheckinData, generateMeetingReport, MEETING_THRESHOLD } from "./report";
import { getStartDate, getToday } from "./util";

type FetchLike = (input: string, init: {
    method: string;
    headers: Record<string, string | undefined>;
    body: unknown;
}) => Promise<{ ok: boolean; status: number; text: () => Promise<string> }>;

type MyPulseDeps = {
    getStartDate?: () => string;
    getToday?: () => string;
    generateAttendanceReport?: typeof generateAttendanceReport;
    generateMeetingReport?: typeof generateMeetingReport;
    generateCheckinData?: typeof generateCheckinData;
    createFormData?: () => { append: (name: string, value: unknown, filename?: string) => void };
    createBlob?: (parts: BlobPart[], options: BlobPropertyBag) => unknown;
    fetch?: FetchLike;
};

export async function syncToMyPulse(db: Database, deps: MyPulseDeps = {}) {
    const startDate = (deps.getStartDate ?? getStartDate)();
    const endDate = (deps.getToday ?? getToday)();

    const attendanceReportFn = deps.generateAttendanceReport ?? generateAttendanceReport;
    const meetingReportFn = deps.generateMeetingReport ?? generateMeetingReport;
    const checkinDataFn = deps.generateCheckinData ?? generateCheckinData;

    const [
        attendanceReport,
        meetingReport,
        checkinData,
    ] = await Promise.all([
        attendanceReportFn(db, startDate, endDate, MEETING_THRESHOLD),
        meetingReportFn(db, startDate, endDate, MEETING_THRESHOLD),
        checkinDataFn(db, startDate, endDate, MEETING_THRESHOLD),
    ]);

    const formData = deps.createFormData ? deps.createFormData() : new FormData();
    const createBlob = deps.createBlob ?? ((parts: BlobPart[], options: BlobPropertyBag) => new Blob(parts, options));

    formData.append("attendance", createBlob([attendanceReport], { type: "text/csv" }), "attendance.csv");
    formData.append("meetings", createBlob([meetingReport], { type: "text/csv" }), "meetings.csv");
    formData.append("checkins", createBlob([checkinData], { type: "text/csv" }), "checkins.csv");

    const fetchFn = deps.fetch ?? (fetch as FetchLike);
    const response = await fetchFn("https://my.stuypulse.com/api/post/scanner", {
        method: "POST",
        headers: {
            "key": process.env.MYPULSE_API_KEY,
        },
        body: formData,
    });

    if (!response.ok) {
        throw new Error(`Failed to sync to MyPulse: ${response.status} ${await response.text()}`);
    }
}
