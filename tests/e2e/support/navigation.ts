/**
 * Fabricar una navegación lenta. El servidor de tests contesta en milisegundos, y los
 * estados de carga (RCA-280) solo se ven cuando tarda.
 */
import type { Page } from "@playwright/test";

/**
 * Retiene la petición RSC de la navegación a `path` hasta que el test llame a la
 * función que devuelve. Las precargas (`next-router-prefetch`) pasan sin retener,
 * porque son justo lo que permite a `<Link>` pintar el skeleton sin esperar al servidor.
 * Con `includePrefetch` también se retienen: es pulsar antes de que la precarga llegue.
 */
export async function holdNavigation(
  page: Page,
  path: string,
  { includePrefetch = false }: { includePrefetch?: boolean } = {},
): Promise<() => void> {
  let release!: () => void;
  const released = new Promise<void>((resolve) => (release = resolve));

  await page.route(
    (url) => url.pathname === path,
    async (route) => {
      const headers = route.request().headers();
      const isPrefetch = !!headers["next-router-prefetch"];
      if (headers["rsc"] === "1" && (includePrefetch || !isPrefetch)) await released;
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
