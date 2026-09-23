/**
 * Los meses de los informes de reservas del panel.
 *
 * Módulo plano, sin `"use server"` ni Prisma.
 *
 * ⚠️ HORA LOCAL, a propósito. Los meses se cortan con `new Date(year, month, …)` y
 * `getMonth()`, que usan el huso del proceso. En Vercel y en los tests ese huso es
 * `Europe/Madrid`: un partido a las 00:30 del día 1 es del mes nuevo, como lo cuenta el
 * bar. Pasarlo a UTC movería esos partidos al mes anterior y cambiaría los informes.
 */

export interface ReportMonth {
  year: number;
  /** 0 = enero, como `Date.getMonth()`. */
  month: number;
  label: string;
  eventCount: number;
}

const MONTH_NAMES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

/** Cuenta los eventos de cada mes y los ordena del más reciente al más antiguo. */
export function groupEventsByMonth(eventDates: ReadonlyArray<Date>): ReportMonth[] {
  const monthsMap = new Map<string, { year: number; month: number; count: number }>();

  for (const eventDate of eventDates) {
    const date = new Date(eventDate);
    const year = date.getFullYear();
    const month = date.getMonth();
    const key = `${year}-${month}`;

    if (monthsMap.has(key)) {
      monthsMap.get(key)!.count++;
    } else {
      monthsMap.set(key, { year, month, count: 1 });
    }
  }

  // Convert to array and sort by date descending
  const months: ReportMonth[] = Array.from(monthsMap.values()).map((m) => ({
    year: m.year,
    month: m.month,
    label: `${MONTH_NAMES[m.month]} ${m.year}`,
    eventCount: m.count,
  }));

  months.sort((a, b) => {
    if (a.year !== b.year) return b.year - a.year;
    return b.month - a.month;
  });

  return months;
}

/**
 * Del primer milisegundo del mes al último, ambos incluidos, en hora local.
 * `new Date(year, month + 1, 0)` es el último día del mes: resuelve solo los bisiestos y
 * el paso de diciembre a enero.
 */
export function monthRange(
  year: number,
  month: number,
): { startDate: Date; endDate: Date } {
  const startDate = new Date(year, month, 1);
  const endDate = new Date(year, month + 1, 0, 23, 59, 59, 999);
  return { startDate, endDate };
}
