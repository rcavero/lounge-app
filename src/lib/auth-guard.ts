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
