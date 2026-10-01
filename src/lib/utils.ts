import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Formatea un importe en euros con coma decimal: 34.5 → "34,50".
 * Sin símbolo: el € lo pone cada vista, que es como estaba escrito hasta ahora.
 */
export function formatEuros(amount: number): string {
  return amount.toFixed(2).replace(".", ",");
}

const MADRID_TZ = "Europe/Madrid";

/**
 * Formatea una fecha de evento en la zona horaria de España (Europe/Madrid),
 * independientemente de la zona horaria del runtime.
 *
 * Necesario en Server Components: el servidor de producción (Vercel) corre en
 * UTC, así que formatear con la TZ del runtime mostraría la hora desfasada.
 * Devuelve las partes ya formateadas en español, con la primera letra del día
 * de la semana en mayúscula (el mes se deja en minúscula, como en el resto de
 * tarjetas de evento).
 */
export function formatEventDateMadrid(date: Date): {
  formattedDay: string;
  dayNumber: string;
  monthName: string;
  time: string;
} {
  const capitalize = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

  const formattedDay = capitalize(
    new Intl.DateTimeFormat("es-ES", {
      timeZone: MADRID_TZ,
      weekday: "long",
    }).format(date),
  );

  const dayNumber = new Intl.DateTimeFormat("es-ES", {
    timeZone: MADRID_TZ,
    day: "numeric",
  }).format(date);

  const monthName = new Intl.DateTimeFormat("es-ES", {
    timeZone: MADRID_TZ,
    month: "long",
  }).format(date);

  const time = new Intl.DateTimeFormat("es-ES", {
    timeZone: MADRID_TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);

  return { formattedDay, dayNumber, monthName, time };
}
