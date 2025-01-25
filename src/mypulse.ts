import { Database } from "sqlite";

import { generateAttendanceReport, generateCheckinData, generateMeetingReport, MEETING_THRESHOLD } from "./report";
import { getStartDate, getToday } from "./util";

export async function syncToMyPulse(db: Database) {
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

    const formData = new FormData();
    formData.append("attendance", new Blob([attendanceReport], { type: "text/csv" }), "attendance.csv");
    formData.append("meetings", new Blob([meetingReport], { type: "text/csv" }), "meetings.csv");
    formData.append("checkins", new Blob([checkinData], { type: "text/csv" }), "checkins.csv");

    const response = await fetch("https://my.stuypulse.com/api/post/scanner", {
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
