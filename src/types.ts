export interface TodaysStats {
    numCheckins: number;
    numCheckouts: number;
    checkoutRatePercent: number;
}

export interface EnabledActions {
    sendToSlack: boolean;
    syncToMyPulse: boolean;
    sendReportEmail: boolean;
    backupDBToS3: boolean;
}
