import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("react-modal", () => {
    const Modal = ({ isOpen, children }: { isOpen: boolean; children: ReactNode }) => isOpen ? <div>{children}</div> : null;
    (Modal as unknown as { setAppElement: () => void }).setAppElement = vi.fn();
    return { default: Modal };
});

vi.mock("../../src/components/Clock", () => ({
    default: () => <div data-testid="clock">clock</div>,
}));

vi.mock("../../src/components/Logo", () => ({
    default: ({ openModal }: { openModal: () => void }) => (
        <button onClick={openModal}>open export modal</button>
    ),
}));

vi.mock("../../src/components/Form", () => ({
    default: ({ onSuccess, onWrongBarcode, isActive }: { onSuccess: (name: string) => void; onWrongBarcode: () => void; isActive: boolean }) => (
        <div>
            <button onClick={() => onSuccess("Ada")}>trigger success</button>
            <button onClick={onWrongBarcode}>trigger wrong barcode</button>
            <span data-testid="form-active">{String(isActive)}</span>
        </div>
    ),
}));

vi.mock("../../src/components/ExportModal", () => ({
    default: ({ isOpen, enabledActions }: { isOpen: boolean; enabledActions: { sendToSlack: boolean } }) => (
        <div data-testid="export-modal">{`open=${isOpen};slack=${enabledActions.sendToSlack}`}</div>
    ),
}));

import App from "../../src/components/App";

describe("App", () => {
    it("loads enabled actions and updates prompt based on form callbacks", async () => {
        window.electron.getEnabledActions = vi.fn().mockResolvedValue({
            sendToSlack: true,
            syncToMyPulse: false,
            sendReportEmail: false,
            backupDBToS3: false,
        });

        const { container } = render(<App />);

        await waitFor(() => {
            expect(window.electron.getEnabledActions).toHaveBeenCalledTimes(1);
            expect(screen.getByTestId("export-modal").textContent).toContain("slack=true");
        });

        fireEvent.click(screen.getByText("trigger success"));
        expect(screen.getByText("OK — Ada")).toBeInTheDocument();
        expect(container.querySelector(".footer")?.className).toContain("ok");

        fireEvent.click(screen.getByText("trigger wrong barcode"));
        expect(screen.getByText("Wrong barcode — swipe top barcode on ID")).toBeInTheDocument();
        expect(container.querySelector(".footer")?.className).toContain("error");
    });

    it("disables form activity while export modal is open", () => {
        render(<App />);

        expect(screen.getByTestId("form-active").textContent).toBe("true");
        fireEvent.click(screen.getByText("open export modal"));
        expect(screen.getByTestId("form-active").textContent).toBe("false");
    });
});


