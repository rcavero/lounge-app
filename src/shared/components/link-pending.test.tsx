import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const linkStatus = vi.hoisted(() => ({ pending: false }));
vi.mock("next/link", () => ({ useLinkStatus: () => linkStatus }));

import { LinkPendingIndicator, PRESSABLE } from "./link-pending";

afterEach(() => {
  linkStatus.pending = false;
});

describe("LinkPendingIndicator", () => {
  it("sin navegación pendiente está, pero invisible", () => {
    render(<LinkPendingIndicator />);
    const indicator = screen.getByTestId("link-pending");

    expect(indicator.getAttribute("data-pending")).toBeNull();
    expect(indicator.className).toContain("opacity-0");
    expect(indicator.className).not.toContain("opacity-100");
    // Decorativo: el estado de la navegación lo anuncia el skeleton de destino.
    expect(indicator.getAttribute("aria-hidden")).toBe("true");
  });

  it("con la navegación pendiente se ve, con un retardo para no parpadear", () => {
    linkStatus.pending = true;
    render(<LinkPendingIndicator />);
    const indicator = screen.getByTestId("link-pending");

    expect(indicator.getAttribute("data-pending")).toBe("true");
    expect(indicator.className).toContain("opacity-100");
    expect(indicator.className).toContain("delay-150");
  });

  it("la posición se puede cambiar", () => {
    render(<LinkPendingIndicator className="top-auto bottom-2" />);

    expect(screen.getByTestId("link-pending").className).toContain("bottom-2");
  });
});

describe("PRESSABLE", () => {
  it("solo se hunde si el sistema no pide menos movimiento", () => {
    expect(PRESSABLE).toContain("motion-safe:active:scale-[0.98]");
    expect(PRESSABLE).not.toMatch(/(^|\s)active:scale/);
  });
});
