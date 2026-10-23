import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import Form from "../../src/components/Form";

describe("Form", () => {
    it("submits a valid 9-digit id and calls onSuccess", async () => {
        const onSuccess = vi.fn();
        const onWrongBarcode = vi.fn();
        window.electron.submit = vi.fn().mockResolvedValue({ success: true, name: "Ada" });

        const { container } = render(
            <Form isActive={true} onSuccess={onSuccess} onWrongBarcode={onWrongBarcode} />,
        );

        const input = container.querySelector("input[name='id-number']") as HTMLInputElement;
        fireEvent.change(input, { target: { value: "123456789" } });
        fireEvent.submit(input.closest("form") as HTMLFormElement);

        await waitFor(() => {
            expect(window.electron.submit).toHaveBeenCalledWith("123456789");
            expect(onSuccess).toHaveBeenCalledWith("Ada");
        });

        expect(onWrongBarcode).not.toHaveBeenCalled();
        expect(input.value).toBe("");
    });

    it("treats a 13-digit input as wrong barcode", async () => {
        const onSuccess = vi.fn();
        const onWrongBarcode = vi.fn();
        window.electron.submit = vi.fn().mockResolvedValue({ success: true, name: "Ignored" });

        const { container } = render(
            <Form isActive={true} onSuccess={onSuccess} onWrongBarcode={onWrongBarcode} />,
        );

        const input = container.querySelector("input[name='id-number']") as HTMLInputElement;
        fireEvent.change(input, { target: { value: "1234567890123" } });
        fireEvent.submit(input.closest("form") as HTMLFormElement);

        expect(onWrongBarcode).toHaveBeenCalledTimes(1);
        expect(window.electron.submit).not.toHaveBeenCalled();
        expect(onSuccess).not.toHaveBeenCalled();
    });

    it("replaces incomplete numpad input when keyboard input is used", () => {
        const onSuccess = vi.fn();
        const onWrongBarcode = vi.fn();

        const { container } = render(
            <Form isActive={true} onSuccess={onSuccess} onWrongBarcode={onWrongBarcode} />,
        );

        const input = container.querySelector("input[name='id-number']") as HTMLInputElement;

        fireEvent.click(screen.getByRole("button", { name: "1" }));
        fireEvent.click(screen.getByRole("button", { name: "2" }));
        expect(input.value).toBe("12");

        // Browser value would be "123" if the user typed "3" after entering "12" on the numpad.
        fireEvent.change(input, { target: { value: "123" } });

        // Keyboard input after numpad entry should replace previous text with the newest keyboard digit.
        expect(input.value).toBe("3");
    });
});
