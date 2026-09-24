/**
 * Fabricar una navegación lenta. El servidor de tests contesta en milisegundos, y los
 * estados de carga (RCA-280) solo se ven cuando tarda.
 */
import type { Page } from "@playwright/test";

/**
 * Retiene la petición RSC de la navegación a `path` hasta que el test llame a la
 * función que devuelve. Las precargas (`next-router-prefetch`) pasan sin retener,
 * porque son justo lo que permite a `<Link>` pintar el skeleton sin esperar al servidor.
 */
export async function holdNavigation(page: Page, path: string): Promise<() => void> {
  let release!: () => void;
  const released = new Promise<void>((resolve) => (release = resolve));

  await page.route(
    (url) => url.pathname === path,
    async (route) => {
      const headers = route.request().headers();
      if (headers["rsc"] === "1" && !headers["next-router-prefetch"]) await released;
      await route.continue();
    },
  );

  return release;
}

/**
 * Espera a que `<Link>` haya terminado de precargar `path`. Sin precarga, al pulsar no hay nada que
 * pintar hasta que contesta el servidor: ese caso lo cubre el indicador del propio
 * enlace, no el skeleton.
 */
export function prefetchOf(page: Page, path: string) {
  // La respuesta y no la petición: `waitForRequest` se resuelve cuando la precarga
  // empieza, y pulsar antes de que llegue es pulsar sin precarga.
  return page.waitForResponse(
    (r) =>
      new URL(r.url()).pathname === path &&
      !!r.request().headers()["next-router-prefetch"],
  );
}
