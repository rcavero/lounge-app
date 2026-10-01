import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Button } from "./button";

describe("Button — loading", () => {
  it("sin loading: habilitado, sin spinner y sin aria-busy", () => {
    render(<Button>Pagar</Button>);
    const button = screen.getByRole("button", { name: "Pagar" });

    expect(button.hasAttribute("disabled")).toBe(false);
    expect(button.getAttribute("aria-busy")).toBeNull();
    expect(screen.queryByTestId("button-spinner")).toBeNull();
  });

  it("con loading: deshabilitado, aria-busy y spinner delante del texto", () => {
    render(<Button loading>Pagar</Button>);
    const button = screen.getByRole("button", { name: "Pagar" });

    expect(button.hasAttribute("disabled")).toBe(true);
    expect(button.getAttribute("aria-busy")).toBe("true");
    expect(button.getAttribute("data-loading")).toBe("true");
    // El texto se queda: cambiarlo movería el resto de la pantalla.
    expect(button.textContent).toBe("Pagar");
    expect(button.firstElementChild).toBe(screen.getByTestId("button-spinner"));
  });

  it("con loading, un segundo toque no repite la acción", () => {
    const onClick = vi.fn();
    render(
      <Button loading onClick={onClick}>
        Pagar
      </Button>,
    );

    fireEvent.click(screen.getByRole("button"));

    expect(onClick).not.toHaveBeenCalled();
  });

  it("disabled sigue funcionando sin loading", () => {
    render(<Button disabled>Pagar</Button>);

    expect(screen.getByRole("button").hasAttribute("disabled")).toBe(true);
    expect(screen.queryByTestId("button-spinner")).toBeNull();
  });

  it("con asChild no pinta spinner: Slot exige un único hijo", () => {
    render(
      <Button asChild loading>
        <a href="/">Inicio</a>
      </Button>,
    );

    expect(screen.getByRole("link", { name: "Inicio" }).getAttribute("aria-busy")).toBe(
      "true",
    );
    expect(screen.queryByTestId("button-spinner")).toBeNull();
  });
});
