// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts
import { contextBridge, ipcRenderer } from "electron";

declare global {
    interface Window {
        electron: {
            submit: (idNumber: string) => Promise<boolean>;
            exportAttendanceReport: (startDate: string, endDate: string, meetingThreshold: number) => void;
            exportMeetingReport: (startDate: string, endDate: string, meetingThreshold: number) => void;
            exportCheckinData: (startDate: string, endDate: string, meetingThreshold: number) => void;
        }
    }
}

contextBridge.exposeInMainWorld("electron", {
    submit: (idNumber: string) => ipcRenderer.invoke("submit", idNumber),
    exportAttendanceReport: (startDate: string, endDate: string, meetingThreshold: number) =>
        ipcRenderer.send("exportAttendanceReport", startDate, endDate, meetingThreshold),
    exportMeetingReport: (startDate: string, endDate: string, meetingThreshold: number) =>
        ipcRenderer.send("exportMeetingReport", startDate, endDate, meetingThreshold),
    exportCheckinData: (startDate: string, endDate: string, meetingThreshold: number) =>
        ipcRenderer.send("exportCheckinData", startDate, endDate, meetingThreshold),
});
