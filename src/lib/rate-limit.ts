import prisma from "@/lib/prisma";

/**
 * Límite de intentos: 5 fallos por clave en una ventana fija de 15 minutos, contada
 * desde el primer fallo. El login usa la IP como clave; la reautenticación del módulo
 * de usuarios, `reauth:<id del ADMIN>` (P12).
 *
 * El contador vive en la tabla `LoginAttempt` y no en memoria (RCA-286, R2): en Vercel
 * hay varias instancias a la vez y se reciclan, y un Map por instancia se esquivaba
 * insistiendo. Las horas salen del reloj de la app y no del de Postgres, para que los
 * tests puedan congelarlo.
 */
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

export async function isLoginBlocked(ip: string): Promise<boolean> {
  const entry = await prisma.loginAttempt.findUnique({ where: { key: ip } });
  if (!entry || Date.now() >= entry.resetAt.getTime()) return false;
  return entry.count >= MAX_ATTEMPTS;
}

/**
 * Suma un fallo, o abre una ventana nueva si la anterior ha vencido. Es una sola
 * sentencia atómica: dos fallos simultáneos cuentan dos, no uno.
 *
 * `resetAt` es `timestamp` sin zona y Prisma guarda ahí la hora en UTC; por eso los
 * parámetros se pasan como ISO y se convierten a UTC explícitamente, sin depender de
 * la zona horaria de la sesión de Postgres.
 */
export async function recordFailedLogin(ip: string): Promise<void> {
  const now = new Date();
  const nowIso = now.toISOString();
  const resetIso = new Date(now.getTime() + WINDOW_MS).toISOString();

  await prisma.$executeRaw`
    INSERT INTO "LoginAttempt" ("key", "count", "resetAt")
    VALUES (${ip}, 1, (${resetIso}::timestamptz AT TIME ZONE 'UTC'))
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE
        WHEN "LoginAttempt"."resetAt" <= (${nowIso}::timestamptz AT TIME ZONE 'UTC') THEN 1
        ELSE "LoginAttempt"."count" + 1
      END,
      "resetAt" = CASE
        WHEN "LoginAttempt"."resetAt" <= (${nowIso}::timestamptz AT TIME ZONE 'UTC')
          THEN (${resetIso}::timestamptz AT TIME ZONE 'UTC')
        ELSE "LoginAttempt"."resetAt"
      END
  `;
}

export async function clearLoginAttempts(ip: string): Promise<void> {
  await prisma.loginAttempt.deleteMany({ where: { key: ip } });
}

/** Borra las ventanas vencidas. Lo llama el cron de limpieza; devuelve cuántas. */
export async function deleteExpiredLoginAttempts(
  now: Date = new Date(),
): Promise<number> {
  const { count } = await prisma.loginAttempt.deleteMany({
    where: { resetAt: { lte: now } },
  });
  return count;
}
