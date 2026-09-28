export type AdminRole = "ADMIN" | "WORKER";

export interface SessionData {
  isLoggedIn: boolean;
  email: string;
  adminId: string;
  role: AdminRole;
  /** Huella del hash de la contraseña al entrar (RCA-286, R1). Ver `passwordFingerprint`. */
  pwd?: string;
}
