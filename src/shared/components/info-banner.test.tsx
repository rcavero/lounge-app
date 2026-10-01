import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { InfoBanner } from "./info-banner";

/**
 * El banner de la portada. Llega aquí con P6, al cambiar cómo decide el idioma (de un
 * `useEffect` a `useIsSpanish`): estos tests fijan que se comporta igual que antes.
 */

const ES = "Las reservas se desbloquean 48 h antes del evento";
const EN = "Reservations open 48 hours before the event";

function withLanguage(language: string) {
  vi.spyOn(navigator, "language", "get").mockReturnValue(language);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("InfoBanner", () => {
  it("en español si el navegador está en español", () => {
    withLanguage("es-ES");
    render(<InfoBanner message={ES} messageEn={EN} />);
    expect(screen.getByText(ES)).not.toBeNull();
  });

  it("en inglés si el navegador está en otro idioma", () => {
    withLanguage("en-GB");
    render(<InfoBanner message={ES} messageEn={EN} />);
    expect(screen.getByText(EN)).not.toBeNull();
  });

  it("sin traducción, siempre el mensaje en español", () => {
    withLanguage("en-GB");
    render(<InfoBanner message={ES} />);
    expect(screen.getByText(ES)).not.toBeNull();
  });

  it("la X lo cierra", () => {
    withLanguage("es-ES");
    render(<InfoBanner message={ES} messageEn={EN} />);
    fireEvent.click(screen.getByRole("button", { name: "Cerrar aviso" }));
    expect(screen.queryByText(ES)).toBeNull();
  });
});
