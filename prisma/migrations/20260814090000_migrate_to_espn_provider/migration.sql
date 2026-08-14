-- Migración al proveedor de datos de fútbol ESPN (site.api.espn.com)
-- Ver MIGRACION_API_FUTBOL.md

-- 1. Identificador del partido en el proveedor externo.
--    Hace idempotente la creación de eventos desde sugerencias: hasta ahora el
--    único guardarraíl contra duplicados era un Set en el cliente, que se
--    perdía al recargar la página.
ALTER TABLE "Event" ADD COLUMN "externalMatchId" INTEGER;

CREATE UNIQUE INDEX "Event_externalMatchId_key" ON "Event"("externalMatchId");

-- 2. Liberar los externalId del proveedor anterior (football-data.org).
--
--    Team.externalId tiene un índice único. Al repoblar con los IDs de ESPN,
--    un ID entrante puede coincidir con un ID antiguo que todavía pertenece a
--    OTRO equipo distinto, lo que abortaría el sync a mitad con una violación
--    de constraint. Vaciarlos de golpe elimina la colisión y fuerza a que el
--    sync vuelva a emparejar por nombre normalizado.
--
--    No es destructivo para los eventos: Team.id, name, league y las claves
--    ajenas Event.homeTeamId / Event.awayTeamId quedan intactas.
UPDATE "Team" SET "externalId" = NULL;
