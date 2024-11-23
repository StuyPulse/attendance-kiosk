import axios from "axios";
import { Database } from "sqlite";

import { generateAttendanceReport, generateCheckinData } from "./report";

const MEETING_THRESHOLD = 10;

function getStartDate() {
    const tzOffset = (new Date()).getTimezoneOffset() * 60000;
    const date = new Date(Date.now() - tzOffset);
    const year = date.getMonth() < 8 ? date.getFullYear() - 1 : date.getFullYear();
    return year + "-09-01";
}

function getEndDate() {
    const tzOffset = (new Date()).getTimezoneOffset() * 60000;
    const date = new Date(Date.now() - tzOffset);
    return date.toISOString().split("T")[0];
}

export async function syncToMyPulse(db: Database) {
    const startDate = getStartDate();
    const endDate = getEndDate();

    const [
        attendanceReport,
        checkinData,
    ] = await Promise.all([
        generateAttendanceReport(db, startDate, endDate, MEETING_THRESHOLD),
        generateCheckinData(db, startDate, endDate, MEETING_THRESHOLD),
    ]);

    const formData = new FormData();
    formData.append("attendance", new Blob([attendanceReport], { type: "text/csv" }), "attendance.csv");
    formData.append("checkins", new Blob([checkinData], { type: "text/csv" }), "checkins.csv");

    await axios.post("https://my.stuypulse.com/api/post/scanner", formData, {
        headers: {
            "key": process.env.MYPULSE_API_KEY,
        },
    });
}