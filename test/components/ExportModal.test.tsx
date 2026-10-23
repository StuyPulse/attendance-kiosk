import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ReactNode, useEffect } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("react-modal", () => {
    const Modal = ({
        isOpen,
        onAfterOpen,
        children,
    }: {
        isOpen: boolean;
        onAfterOpen?: () => void;
        children: ReactNode;
    }) => {
        useEffect(() => {
            if (isOpen && onAfterOpen) {
                onAfterOpen();
            }
        }, [isOpen, onAfterOpen]);

        return isOpen ? <div>{children}</div> : null;
    };

    (Modal as unknown as { setAppElement: () => void }).setAppElement = vi.fn();
    return { default: Modal };
});

import ExportModal from "../../src/components/ExportModal";
import { getStartDate, getToday } from "../../src/util";

describe("ExportModal", () => {
    it("loads today's stats and exports attendance report with default values", async () => {
        window.electron.getTodaysStats = vi.fn().mockResolvedValue({
            numCheckins: 12,
            numCheckouts: 9,
            checkoutRatePercent: 75,
        });
        window.electron.exportAttendanceReport = vi.fn();

        render(
            <ExportModal
                isOpen={true}
                onClose={vi.fn()}
                enabledActions={{
                    sendToSlack: true,
                    syncToMyPulse: true,
                    sendReportEmail: true,
                    backupDBToS3: true,
                }}
            />,
        );

        await waitFor(() => {
            expect(screen.getByText("Checkins today: 12")).toBeInTheDocument();
        });

        fireEvent.click(screen.getByRole("button", { name: "Attendance Report" }));

        expect(window.electron.exportAttendanceReport).toHaveBeenCalledWith(
            getStartDate(),
            getToday(),
            20,
            false,
        );
    });

    it("disables action buttons when corresponding capability is unavailable", () => {
        render(
            <ExportModal
                isOpen={true}
                onClose={vi.fn()}
                enabledActions={{
                    sendToSlack: false,
                    syncToMyPulse: false,
                    sendReportEmail: false,
                    backupDBToS3: false,
                }}
            />,
        );

        expect(screen.getByRole("button", { name: "Sync to MyPulse" })).toBeDisabled();
        expect(screen.getByRole("button", { name: "Send Report Email" })).toBeDisabled();
        expect(screen.getByRole("button", { name: "Back up DB to S3" })).toBeDisabled();
    });
});

