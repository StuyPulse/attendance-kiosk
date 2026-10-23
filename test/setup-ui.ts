import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, vi } from "vitest";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
if (document.getElementById("app") === null) {
    const appRoot = document.createElement("div");
    appRoot.id = "app";
    document.body.appendChild(appRoot);
}

const baseElectronMock = {
    submit: vi.fn(),
    getTodaysStats: vi.fn().mockResolvedValue({
        numCheckins: 0,
        numCheckouts: 0,
        checkoutRatePercent: 0,
    }),
    getEnabledActions: vi.fn().mockResolvedValue({
        sendToSlack: false,
        syncToMyPulse: false,
        sendReportEmail: false,
        backupDBToS3: false,
    }),
    exportAttendanceReport: vi.fn(),
    exportMeetingReport: vi.fn(),
    exportCheckinData: vi.fn(),
    importStudents: vi.fn(),
    syncToMyPulse: vi.fn(),
    sendReportEmail: vi.fn(),
    backupDBToS3: vi.fn(),
};

beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>';
    (window as unknown as { electron: typeof baseElectronMock }).electron = {
        ...baseElectronMock,
        submit: vi.fn(),
        getTodaysStats: vi.fn().mockResolvedValue({
            numCheckins: 0,
            numCheckouts: 0,
            checkoutRatePercent: 0,
        }),
        getEnabledActions: vi.fn().mockResolvedValue({
            sendToSlack: false,
            syncToMyPulse: false,
            sendReportEmail: false,
            backupDBToS3: false,
        }),
        exportAttendanceReport: vi.fn(),
        exportMeetingReport: vi.fn(),
        exportCheckinData: vi.fn(),
        importStudents: vi.fn(),
        syncToMyPulse: vi.fn(),
        sendReportEmail: vi.fn(),
        backupDBToS3: vi.fn(),
    };
});

afterEach(() => {
    vi.useRealTimers();
});


