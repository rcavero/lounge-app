/**
 * Los PDF que la app abre en otra pestaña con `window.open(blobUrl)`.
 *
 * En Chromium headless no hay visor de PDF: navegar a un PDF lo DESCARGA, y la pestaña
 * se queda sin cargar nunca, así que esperar a su URL cuelga el test hasta el timeout.
 * En vez de pelear con eso, se registra la llamada: un script de inicio sustituye
 * `window.open` por uno que apunta la URL, y el blob se lee desde la misma página que
 * lo creó.
 *
 * Lo que queda probado es lo que hace la app: generar un PDF y abrirlo. Que el navegador
 * lo pinte es cosa del navegador.
 */
import type { Page } from "@playwright/test";

declare global {
  interface Window {
    __openedUrls?: string[];
  }
}

/** Llamar antes de `page.goto`: el script se inyecta en cada documento nuevo. */
export async function recordWindowOpen(page: Page): Promise<void> {
  await page.addInitScript(() => {
    window.__openedUrls = [];
    window.open = (url?: string | URL) => {
      window.__openedUrls!.push(String(url));
      return null;
    };
  });
}

/** Espera a que la app abra un blob y devuelve sus 5 primeros bytes. */
export async function lastOpenedBlobHeader(page: Page): Promise<string> {
  await page.waitForFunction(() =>
    (window.__openedUrls ?? []).some((u) => u.startsWith("blob:")),
  );
  return page.evaluate(async () => {
    const url = window.__openedUrls!.filter((u) => u.startsWith("blob:")).at(-1)!;
    const bytes = new Uint8Array(await (await fetch(url)).arrayBuffer());
    return String.fromCharCode(...bytes.slice(0, 5));
  });
}
