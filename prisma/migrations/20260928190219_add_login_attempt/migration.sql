-- Intentos fallidos de login por IP (RCA-286, R2).
--
-- El límite de 5 intentos cada 15 minutos vivía en la memoria del servidor. En Vercel hay
-- varias instancias a la vez y se reciclan, así que bastaba con insistir para caer en otra
-- instancia o en una recién arrancada. Ahora el contador está en la base.
--
-- Tabla nueva y sin relaciones: el código anterior no la ve, así que se puede aplicar
-- antes de desplegar sin ventana de mantenimiento.

-- CreateTable
CREATE TABLE "LoginAttempt" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "resetAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LoginAttempt_pkey" PRIMARY KEY ("key")
);
