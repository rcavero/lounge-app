import { redirect } from "next/navigation";

import { getSessionData } from "@/modules/auth/actions";

export async function requireAuth(): Promise<void> {
  const session = await getSessionData();
  if (!session.isLoggedIn) {
    throw new Error("Unauthorized");
  }
}

export async function requireAdmin(): Promise<void> {
  const session = await getSessionData();
  if (!session.isLoggedIn || session.role !== "ADMIN") {
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
  if (session.role !== "ADMIN") redirect("/admin");
}
