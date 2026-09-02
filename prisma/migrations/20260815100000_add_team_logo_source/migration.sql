-- Copia local de escudos: se separa "qué se renderiza" de "de dónde salió".
--
--   Team.logo       → lo que pinta la UI. Pasa a ser la ruta local /escudos/{id}.png
--   Team.logoSource → URL remota original, para poder volver a descargar el escudo
--
-- El backfill copia las URLs remotas actuales a logoSource ANTES de que
-- scripts/download-crests.ts reescriba logo con la ruta local. Sin él se
-- perdería la procedencia y no habría forma de re-descargar.
--
-- No es destructivo: logo se conserva intacto en esta migración.

ALTER TABLE "Team" ADD COLUMN "logoSource" TEXT;

UPDATE "Team" SET "logoSource" = "logo" WHERE "logo" LIKE 'http%';
