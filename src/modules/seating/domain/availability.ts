/**
 * El estado de cada asiento tal y como lo ve el cliente en el plano de un evento.
 *
 * Un asiento libre en este partido puede estar ocupado igualmente, si está vendido en
 * otro que coincide en el tiempo: el local es uno. Esa regla vivía dentro de
 * `getSeatsForEvent`, mezclada con las consultas.
 *
 * Módulo plano, sin `"use server"` ni Prisma (solo su tipo, que se borra al compilar).
 */
import type { SeatStatusType } from "@/generated/prisma";

/** `seatId` → estado del asiento en el evento. */
export type SeatStatusMap = ReadonlyMap<string, SeatStatusType>;

/**
 * Marca como `OCCUPIED` los asientos tomados en un evento solapado, pero **solo si aquí
 * están `AVAILABLE`**. Un `BLOCKED` de este evento no se pisa nunca: lo ha puesto el bar
 * a propósito, y el cliente tiene que seguir viéndolo bloqueado.
 *
 * `takenElsewhere` son los `SeatStatus` `RESERVED`/`OCCUPIED` de los eventos solapados;
 * el filtro por estado lo hace la consulta, no esta función.
 *
 * Devuelve un mapa nuevo: el de entrada no se modifica.
 */
export function applyOverlapOccupancy(
  statusMap: SeatStatusMap,
  takenElsewhere: ReadonlyArray<{ seatId: string }>,
): Map<string, SeatStatusType> {
  const result = new Map(statusMap);
  for (const taken of takenElsewhere) {
    const currentStatus = result.get(taken.seatId) || "AVAILABLE";
    if (currentStatus === "AVAILABLE") {
      result.set(taken.seatId, "OCCUPIED");
    }
  }
  return result;
}

/**
 * El estado de un asiento. Si el evento todavía no tiene fila de `SeatStatus` para él
 * —evento recién creado cuya página nadie ha abierto—, está libre.
 */
export function effectiveSeatStatus(
  statusMap: SeatStatusMap,
  seatId: string,
): SeatStatusType {
  return statusMap.get(seatId) || "AVAILABLE";
}
