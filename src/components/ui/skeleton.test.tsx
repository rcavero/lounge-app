import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LoadingRegion, Skeleton } from "./skeleton";

describe("Skeleton y LoadingRegion", () => {
  it("el hueco es decorativo y solo pulsa si el sistema no pide menos movimiento", () => {
    const { container } = render(<Skeleton className="h-4 w-20" />);
    const skeleton = container.firstElementChild!;

    expect(skeleton.getAttribute("aria-hidden")).toBe("true");
    expect(skeleton.className).toContain("motion-safe:animate-pulse");
    expect(skeleton.className).not.toMatch(/(^|\s)animate-pulse/);
    expect(skeleton.className).toContain("h-4 w-20");
  });

  it("la región anuncia «Cargando…» una sola vez, aunque tenga muchos huecos", () => {
    render(
      <LoadingRegion>
        <Skeleton />
        <Skeleton />
        <Skeleton />
      </LoadingRegion>,
    );

    const region = screen.getByRole("status");
    expect(region.getAttribute("aria-busy")).toBe("true");
    expect(region.textContent).toBe("Cargando…");
  });

  it("el texto se puede cambiar", () => {
    render(<LoadingRegion label="Cargando el plano…" />);

    expect(screen.getByRole("status").textContent).toBe("Cargando el plano…");
  });
});
