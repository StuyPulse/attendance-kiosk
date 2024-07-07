// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts
import { contextBridge, ipcRenderer } from "electron";

declare global {
    interface Window {
        electron: {
            submit: (idNumber: string) => Promise<boolean>;
            exportAttendanceReport: () => void;
        }
    }
}

contextBridge.exposeInMainWorld("electron", {
    submit: (idNumber: string) => ipcRenderer.invoke("submit", idNumber),
    exportAttendanceReport: () => ipcRenderer.send("exportAttendanceReport"),
});
