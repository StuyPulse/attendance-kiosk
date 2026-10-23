import { render } from "@testing-library/react";
import { act } from "react";
import { describe, expect, it, vi } from "vitest";

import Clock from "../../src/components/Clock";

describe("Clock", () => {
    it("updates the rendered time on an interval", () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2026-10-22T10:00:00.000Z"));

        const { container } = render(<Clock />);
        const timeElement = container.querySelector(".time");
        expect(timeElement).not.toBeNull();
        const initialText = timeElement?.textContent;

        act(() => {
            vi.advanceTimersByTime(1100);
        });

        expect(container.querySelector(".time")?.textContent).not.toBe(initialText);
    });
});

