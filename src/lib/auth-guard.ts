import { redirect } from "next/navigation";

import { getSessionData } from "@/modules/auth/actions";

const LOGIN = "/admin/login";

/**
 * Sin sesión, al login: con `redirect` y no con un error (RCA-286, R1).
 *
 * Desde que la sesión se comprueba contra la base, una cookie que pasa el middleware
 * puede no valer. El layout del panel redirige, pero en una navegación con `<Link>` el
 * layout no se vuelve a pintar, solo la página: si el guardia lanzara, el usuario vería
 * la pantalla de error de Next. `redirect` funciona igual desde una página, desde una
 * navegación en el cliente y desde una server action.
 */
export async function requireAuth(): Promise<void> {
  const session = await getSessionData();
  if (!session.isLoggedIn) redirect(LOGIN);
}

/** Sin sesión, al login; con sesión pero sin ser ADMIN, `Forbidden`. */
export async function requireAdmin(): Promise<void> {
  const session = await getSessionData();
  if (!session.isLoggedIn) redirect(LOGIN);
  if (session.role !== "ADMIN") {
    throw new Error("Forbidden");
  }
}

/**
 * Para las páginas del panel que son solo del ADMIN: a un WORKER lo devuelve al menú en
 * lugar de enseñarle un error. No sustituye a `requireAdmin` en las acciones, que es lo
 * que protege de verdad (RCA-285): esto es solo para que no llegue a ver la página.
 */
export async function redirectUnlessAdmin(): Promise<void> {
  const session = await getSessionData();
  if (!session.isLoggedIn) redirect(LOGIN);
  if (session.role !== "ADMIN") redirect("/admin");
}
