import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Badge } from "./badge";

/**
 * Smoke test del proyecto `ui`: React 19 + jsdom + Testing Library.
 *
 * `Badge` es el componente más tonto que hay, y eso es justo lo que se quiere aquí: si
 * falla, el problema está en el entorno de tests y no en el componente.
 */
describe("Badge", () => {
  it("pinta su contenido", () => {
    render(<Badge>3 asientos</Badge>);

    expect(screen.getByText("3 asientos")).not.toBeNull();
  });

  it("aplica la variante por defecto y la deja anotada en el DOM", () => {
    render(<Badge>Confirmada</Badge>);

    expect(screen.getByText("Confirmada").dataset.variant).toBe("default");
  });

  it("combina las clases propias con las que le pasan", () => {
    render(<Badge className="mt-4">Pendiente</Badge>);

    const badge = screen.getByText("Pendiente");

    expect(badge.className).toContain("mt-4");
    expect(badge.className).toContain("rounded-full");
  });

  it("con asChild renderiza el elemento hijo en lugar de un span", () => {
    render(
      <Badge asChild>
        <a href="/eventos/1">Ver evento</a>
      </Badge>,
    );

    expect(screen.getByRole("link", { name: "Ver evento" }).tagName).toBe("A");
  });
});
