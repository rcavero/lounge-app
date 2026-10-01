import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { SeatStatusType, SeatWithStatus } from "../types";
import { FloorPlanMap } from "./floor-plan-map";

const CREATED = new Date("2026-01-01T00:00:00Z");

function seat(
  code: string,
  status: SeatStatusType,
  posX = 10,
  posY = 20,
): SeatWithStatus {
  return {
    id: `id-${code}`,
    code,
    zone: "TV1",
    row: null,
    number: 1,
    posX,
    posY,
    capacity: 1,
    createdAt: CREATED,
    updatedAt: CREATED,
    status,
  };
}

const SEATS = [
  seat("A1", "AVAILABLE", 10, 20),
  seat("A2", "RESERVED"),
  seat("A3", "OCCUPIED"),
  seat("A4", "BLOCKED"),
];

function renderMap(seats: SeatWithStatus[], selectedSeats: string[] = []) {
  const onSeatSelect = vi.fn();
  render(
    <FloorPlanMap
      seats={seats}
      selectedSeats={selectedSeats}
      onSeatSelect={onSeatSelect}
    />,
  );
  return { onSeatSelect, user: userEvent.setup() };
}

/**
 * Hoy el único selector estable de un asiento es su `title`, "código - estado". Los
 * data-testid llegan en la fase de E2E; entonces estos tests pueden pasar a usarlos.
 */
function seatButton(title: string): HTMLButtonElement {
  return screen.getByTitle(title) as HTMLButtonElement;
}

describe("FloorPlanMap — qué asiento se puede pulsar", () => {
  it("un asiento disponible se puede seleccionar", async () => {
    const { onSeatSelect, user } = renderMap(SEATS);
    const button = seatButton("A1 - Disponible");

    expect(button.disabled).toBe(false);
    await user.click(button);
    expect(onSeatSelect).toHaveBeenCalledWith("id-A1");
  });

  it.each([
    ["reservado", "A2"],
    ["ocupado", "A3"],
    ["bloqueado", "A4"],
  ])("un asiento %s está deshabilitado y no responde", async (_label, code) => {
    // Para el cliente los tres son lo mismo: "Ocupado". Qué hay detrás (un pago en
    // curso, uno ya cobrado o un bloqueo del local) no es asunto suyo.
    const { onSeatSelect, user } = renderMap(SEATS);
    const button = seatButton(`${code} - Ocupado`);

    expect(button.disabled).toBe(true);
    await user.click(button);
    expect(onSeatSelect).not.toHaveBeenCalled();
  });

  it("un asiento seleccionado se puede volver a pulsar para quitarlo", async () => {
    const { onSeatSelect, user } = renderMap(SEATS, ["id-A1"]);

    await user.click(seatButton("A1 - Seleccionado"));
    expect(onSeatSelect).toHaveBeenCalledWith("id-A1");
  });

  it("un asiento seleccionado que pasó a no disponible SIGUE siendo pulsable", async () => {
    // Otro cliente lo ha cogido mientras este lo tenía marcado. Si se deshabilitara,
    // el cliente no podría quitarlo de su selección y el pago fallaría sin salida.
    const { onSeatSelect, user } = renderMap(SEATS, ["id-A2"]);
    const button = seatButton("A2 - Seleccionado");

    expect(button.disabled).toBe(false);
    await user.click(button);
    expect(onSeatSelect).toHaveBeenCalledWith("id-A2");
  });
});

describe("FloorPlanMap — pintado", () => {
  it("coloca cada asiento en su posición del plano, en porcentaje", () => {
    renderMap(SEATS);
    const button = seatButton("A1 - Disponible");

    expect(button.style.left).toBe("10%");
    expect(button.style.top).toBe("20%");
  });

  it("pinta un botón por asiento", () => {
    renderMap(SEATS);
    expect(screen.getAllByRole("button")).toHaveLength(SEATS.length);
  });

  it("sin etiquetas propias, pinta las tres pantallas por defecto", () => {
    renderMap(SEATS);

    for (const zone of ["TV1", "TV2", "TV3"]) {
      expect(screen.getByText(zone)).not.toBeNull();
    }
  });

  it("usa las etiquetas que le pasan en lugar de las de por defecto", () => {
    render(
      <FloorPlanMap
        seats={[]}
        selectedSeats={[]}
        onSeatSelect={vi.fn()}
        zoneLabels={[{ zone: "TV2", posX: 50, posY: 50, scaleX: 1, rotation: 0 }]}
      />,
    );

    expect(screen.getByText("TV2")).not.toBeNull();
    expect(screen.queryByText("TV1")).toBeNull();
  });
});
