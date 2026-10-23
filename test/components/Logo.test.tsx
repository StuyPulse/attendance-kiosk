import { fireEvent, render } from "@testing-library/react";
import { act } from "react";
import { describe, expect, it, vi } from "vitest";

import Logo from "../../src/components/Logo";

describe("Logo", () => {
    it("cross-fades active logo every 5 seconds", () => {
        vi.useFakeTimers();
        const openModal = vi.fn();

        const { container } = render(<Logo openModal={openModal} />);
        const layers = container.querySelectorAll(".logo-layer");
        expect(layers).toHaveLength(2);
        expect(layers[0].className).toContain("active");
        expect(layers[1].className).not.toContain("active");

        act(() => {
            vi.advanceTimersByTime(5000);
        });

        expect(layers[0].className).not.toContain("active");
        expect(layers[1].className).toContain("active");
    });

    it("opens modal after long press", () => {
        vi.useFakeTimers();
        const openModal = vi.fn();

        const { container } = render(<Logo openModal={openModal} />);
        const logoStack = container.querySelector(".logo-stack") as HTMLDivElement;

        fireEvent.pointerDown(logoStack);
        act(() => {
            vi.advanceTimersByTime(500);
        });

        expect(openModal).toHaveBeenCalledTimes(1);
    });
});

