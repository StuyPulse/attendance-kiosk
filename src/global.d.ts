import { EnabledActions, TodaysStats } from "./types";

declare global {
    interface Window {
        electron: {
            submit: (idNumber: string) => Promise<{ success: boolean; name?: string }>;
            getTodaysStats: () => Promise<TodaysStats>;
            getEnabledActions: () => Promise<EnabledActions>;
            exportAttendanceReport: (startDate: string, endDate: string, meetingThreshold: number, sendToSlack: boolean) => void;
            exportMeetingReport: (startDate: string, endDate: string, meetingThreshold: number, sendToSlack: boolean) => void;
            exportCheckinData: (startDate: string, endDate: string, meetingThreshold: number, sendToSlack: boolean) => void;
            importStudents: () => void;
            syncToMyPulse: () => void;
            sendReportEmail: () => void;
            backupDBToS3: () => void;
        };
    }
}

export {};
