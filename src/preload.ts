// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts
import { contextBridge, ipcRenderer } from "electron";

declare global {
    interface Window {
        electron: {
            submit: (idNumber: string) => Promise<{ success: boolean, name?: string }>;
            getTodaysStats: () => Promise<{ numCheckins: number, numCheckouts: number, checkoutRatePercent: number }>;
            exportAttendanceReport: (startDate: string, endDate: string, meetingThreshold: number, sendToSlack: boolean) => void;
            exportMeetingReport: (startDate: string, endDate: string, meetingThreshold: number, sendToSlack: boolean) => void;
            exportCheckinData: (startDate: string, endDate: string, meetingThreshold: number, sendToSlack: boolean) => void;
            importStudents: () => void;
            syncToMyPulse: () => void;
            sendReportEmail: () => void;
        }
    }
}

contextBridge.exposeInMainWorld("electron", {
    submit: (idNumber: string) => ipcRenderer.invoke("submit", idNumber),
    getTodaysStats: () => ipcRenderer.invoke("getTodaysStats"),
    exportAttendanceReport: (startDate: string, endDate: string, meetingThreshold: number, sendToSlack: boolean) =>
        ipcRenderer.send("exportAttendanceReport", startDate, endDate, meetingThreshold, sendToSlack),
    exportMeetingReport: (startDate: string, endDate: string, meetingThreshold: number, sendToSlack: boolean) =>
        ipcRenderer.send("exportMeetingReport", startDate, endDate, meetingThreshold, sendToSlack),
    exportCheckinData: (startDate: string, endDate: string, meetingThreshold: number, sendToSlack: boolean) =>
        ipcRenderer.send("exportCheckinData", startDate, endDate, meetingThreshold, sendToSlack),
    importStudents: () => ipcRenderer.send("importStudents"),
    syncToMyPulse: () => ipcRenderer.send("syncToMyPulse"),
    sendReportEmail: () => ipcRenderer.send("sendReportEmail"),
});
