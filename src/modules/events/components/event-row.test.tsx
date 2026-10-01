import type { AnchorHTMLAttributes, ReactNode } from "react";

import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { EventWithTeams } from "../types";
import { EventRow } from "./event-row";

// Fuera del App Router no hay contexto de navegación: se sustituyen por sus
// equivalentes HTML, que es lo único que este test necesita de ellos.
vi.mock("next/link", () => ({
  useLinkStatus: () => ({ pending: false }),
  default: ({
    href,
    children,
    ...rest
  }: { href: string; children: ReactNode } & AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock("next/image", () => ({
  // eslint-disable-next-line @next/next/no-img-element
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}));

const HOUR = 60 * 60 * 1000;
const MINUTE = 60 * 1000;
const NOW = new Date("2026-09-22T16:00:00Z");

const TOO_EARLY_ES = "Las reservas se desbloquearán 48 horas antes del evento";
const TOO_LATE_ES =
  "Se han cerrado las reservas para este evento porque faltan menos de 4 horas para su inicio";

function eventAt(
  offsetMs: number,
  overrides: Partial<EventWithTeams> = {},
): EventWithTeams {
  return {
    id: "evt-1",
    title: "Lakers vs Celtics",
    description: null,
    sport: "football",
    competition: "Baloncesto",
    externalMatchId: null,
    homeTeamId: null,
    awayTeamId: null,
    homeTeam: null,
    awayTeam: null,
    homeTeamName: "Lakers",
    awayTeamName: "Celtics",
    eventDate: new Date(NOW.getTime() + offsetMs),
    status: "UPCOMING",
    screens: "TV1,TV3",
    pricePerSeat: 10,
    durationMinutes: 120,
    managementFeeCents: 150,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function renderRow(
  offsetMs: number,
  props: { href?: string; checkAvailability?: boolean } = {},
) {
  return render(
    <EventRow event={eventAt(offsetMs)} checkAvailability={true} {...props} />,
  );
}

/** Pulsa la tarjeta. Si está bloqueada, el clic llega al div que muestra el aviso. */
function clickCard() {
  fireEvent.click(screen.getByText("Lakers"));
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  // La UI elige idioma por navigator.language; jsdom dice "en-US".
  vi.spyOn(navigator, "language", "get").mockReturnValue("es-ES");
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("EventRow — ventana de reservas (48 h a 4 h antes)", () => {
  it("a 24 h es un enlace al evento", () => {
    renderRow(24 * HOUR);

    expect(screen.getByRole("link").getAttribute("href")).toBe("/eventos/evt-1");
  });

  it("a 72 h está bloqueado: no hay enlace y avisa de cuándo se abre", () => {
    renderRow(72 * HOUR);
    expect(screen.queryByRole("link")).toBeNull();

    clickCard();
    expect(screen.getByText(TOO_EARLY_ES)).not.toBeNull();
  });

  it("a 2 h está bloqueado: no hay enlace y avisa de que ya se cerró", () => {
    renderRow(2 * HOUR);
    expect(screen.queryByRole("link")).toBeNull();

    clickCard();
    expect(screen.getByText(TOO_LATE_ES)).not.toBeNull();
  });

  it("justo a 48 h ya se puede reservar; un minuto antes, todavía no", () => {
    const { unmount } = renderRow(48 * HOUR);
    expect(screen.queryByRole("link")).not.toBeNull();
    unmount();

    renderRow(48 * HOUR + MINUTE);
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("justo a 4 h todavía se puede reservar; un minuto después, ya no", () => {
    // La ventana real es 48 h - 4 h. La documentación antigua decía 5 h.
    const { unmount } = renderRow(4 * HOUR);
    expect(screen.queryByRole("link")).not.toBeNull();
    unmount();

    renderRow(4 * HOUR - MINUTE);
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("un evento ya empezado (-1 h) también se bloquea", () => {
    // Antes no: la condición exigía hoursUntilEvent >= 0. En la portada no se llega a
    // ver, porque getUpcomingEvents solo lista eventos futuros, pero desde que la regla
    // vive en events/domain/booking-window.ts es la misma que aplica el servidor.
    renderRow(-1 * HOUR);
    expect(screen.queryByRole("link")).toBeNull();

    clickCard();
    expect(screen.getByText(TOO_LATE_ES)).not.toBeNull();
  });

  it("sin checkAvailability, siempre es navegable", () => {
    // El panel de admin lo usa así: el personal entra a cualquier evento.
    for (const offset of [72 * HOUR, 2 * HOUR]) {
      const { unmount } = renderRow(offset, { checkAvailability: false });
      expect(screen.queryByRole("link")).not.toBeNull();
      unmount();
    }
  });

  it("respeta el href que le pasan", () => {
    renderRow(24 * HOUR, { href: "/admin/reservas/evt-1" });
    expect(screen.getByRole("link").getAttribute("href")).toBe("/admin/reservas/evt-1");
  });
});

describe("EventRow — el aviso de bloqueo", () => {
  it("desaparece a los 3 segundos", () => {
    renderRow(72 * HOUR);
    clickCard();
    expect(screen.queryByText(TOO_EARLY_ES)).not.toBeNull();

    act(() => {
      vi.advanceTimersByTime(2999);
    });
    expect(screen.queryByText(TOO_EARLY_ES)).not.toBeNull();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.queryByText(TOO_EARLY_ES)).toBeNull();
  });

  it("sale en inglés si el navegador no está en español", () => {
    vi.spyOn(navigator, "language", "get").mockReturnValue("en-GB");
    renderRow(72 * HOUR);
    clickCard();

    expect(
      screen.getByText("Reservations will open 48 hours before the event"),
    ).not.toBeNull();
  });
});

describe("EventRow — contenido", () => {
  it("pinta los participantes, la hora en Madrid y las pantallas", () => {
    // 16:00 UTC + 24 h en septiembre es las 18:00 en Madrid (CEST).
    renderRow(24 * HOUR);

    expect(screen.getByText("Lakers")).not.toBeNull();
    expect(screen.getByText("Celtics")).not.toBeNull();
    expect(screen.getByText("18:00")).not.toBeNull();
    expect(screen.getByText("TV1")).not.toBeNull();
    expect(screen.getByText("TV3")).not.toBeNull();
  });

  it("en deportes de motor no pinta visitante", () => {
    render(
      <EventRow
        event={eventAt(24 * HOUR, {
          competition: "Fórmula 1",
          homeTeamName: "GP de Singapur",
          awayTeamName: null,
        })}
      />,
    );

    expect(screen.getByText("GP de Singapur")).not.toBeNull();
    expect(screen.queryByText("Celtics")).toBeNull();
  });
});
