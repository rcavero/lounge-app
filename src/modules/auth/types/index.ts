export type AdminRole = "ADMIN" | "WORKER";

export interface SessionData {
  isLoggedIn: boolean;
  email: string;
  adminId: string;
  role: AdminRole;
}
