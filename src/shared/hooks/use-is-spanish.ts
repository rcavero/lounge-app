import { useSyncExternalStore } from "react";

/**
 * ¿El navegador está en español? Decide el idioma de los textos de la parte pública.
 *
 * Antes cada componente lo calculaba con un `useEffect` que hacía `setIsSpanish(...)`
 * al montarse, y el lint lo marca con razón (`react-hooks/set-state-in-effect`): es un
 * render de más solo para leer un valor. `useSyncExternalStore` es la forma que da React
 * para leer algo que solo existe en el navegador, y se comporta igual que antes:
 *
 * - En el servidor y durante la hidratación vale `true` (español), que era el valor
 *   inicial del `useState`. Así el HTML del servidor y el primer render del cliente
 *   coinciden y no hay error de hidratación.
 * - Justo después de hidratar, React lee `navigator.language` y vuelve a pintar si no es
 *   español. Es el mismo momento en que antes corría el efecto.
 *
 * La suscripción no hace nada a propósito: el valor se lee una vez, como antes. Cambiar
 * el idioma del navegador con la página abierta no la traduce, y así sigue.
 */
const subscribe = () => () => {};
const getSnapshot = () => navigator.language.startsWith("es");
const getServerSnapshot = () => true;

export function useIsSpanish(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
