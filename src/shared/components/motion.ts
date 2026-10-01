import type { CSSProperties } from "react";

/**
 * Las animaciones de la app, en un sitio. Todas van con `motion-safe:`: si el sistema
 * pide reducir el movimiento, no hay ninguna, y el contenido aparece de golpe, que es
 * lo que se pide.
 *
 * Son de entrada y cortas (300 ms). Su trabajo es que el contenido real sustituya al
 * skeleton sin un salto seco, no llamar la atención.
 */

/** El contenido aparece subiendo un poco. `fill-mode-both`: invisible hasta que empieza. */
export const ENTER =
  "motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 animation-duration-300 fill-mode-both";

/** Solo el fundido, para bloques grandes (el plano, el ticket): desplazarlos se notaría demasiado. */
export const FADE_IN =
  "motion-safe:animate-in motion-safe:fade-in animation-duration-300";

/** Un modal: el fondo se funde y la tarjeta crece desde el 95 %. */
export const MODAL_BACKDROP =
  "motion-safe:animate-in motion-safe:fade-in animation-duration-200";
export const MODAL_CARD =
  "motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-95 animation-duration-200";

/**
 * El retardo del elemento `index` de una lista, para que entren en cascada. Con tope:
 * a partir del octavo entran todos a la vez, o una lista larga tardaría en aparecer.
 */
export function staggerDelay(index: number): CSSProperties {
  return { animationDelay: `${Math.min(index, 8) * 40}ms` };
}
