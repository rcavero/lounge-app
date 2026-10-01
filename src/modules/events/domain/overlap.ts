/**
 * Solape de eventos en el tiempo.
 *
 * El local es uno: si dos partidos coinciden, un asiento vendido en uno está ocupado en
 * el otro. Esta regla decide si un asiento se puede vender dos veces, y antes estaba
 * copiada carácter a carácter en `payments/actions` y en `seating/actions`.
 *
 * Módulo plano, sin `"use server"` ni Prisma: en un fichero de server actions una función
 * síncrona no se puede exportar, y aquí se prueba sin base de datos.
 */

export interface EventTiming {
  eventDate: Date;
  durationMinutes: number;
}

export interface EventWindow {
  /** Milisegundos desde época, inclusive. */
  start: number;
  /** Milisegundos desde época, exclusivo: un evento que empieza aquí no se solapa. */
  end: number;
}

export function eventWindow(event: EventTiming): EventWindow {
  const start = event.eventDate.getTime();
  const end = start + event.durationMinutes * 60 * 1000;
  return { start, end };
}

/**
 * `<` estricto a los dos lados: dos partidos pegados —uno empieza justo cuando termina
 * el otro— NO se solapan.
 */
export function windowsOverlap(a: EventWindow, b: EventWindow): boolean {
  return a.start < b.end && b.start < a.end;
}

/**
 * Los ids de los candidatos que se solapan con `target`.
 *
 * No excluye a `target` si viene entre los candidatos: un evento se solapa consigo mismo.
 * Los dos callers lo sacan ya en la consulta (`id: { not: eventId }`), igual que el filtro
 * de estado (`UPCOMING`/`LIVE`), que se queda en la query y no aquí.
 */
export function overlappingEventIds(
  target: EventTiming,
  candidates: ReadonlyArray<EventTiming & { id: string }>,
): string[] {
  const targetWindow = eventWindow(target);
  return candidates
    .filter((candidate) => windowsOverlap(targetWindow, eventWindow(candidate)))
    .map((candidate) => candidate.id);
}
