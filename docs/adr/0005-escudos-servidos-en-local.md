# 0005 · Los escudos se sirven desde `public/`, no desde ESPN

**Estado:** vigente · **Fecha:** agosto de 2026 · **Plan:** [`MIGRACION_API_FUTBOL.md`](../historico/MIGRACION_API_FUTBOL.md), apartado «Copia local de escudos y emblemas»

## Contexto

En agosto de 2026 la app cambió de proveedor de datos de fútbol a la API pública de ESPN, que no
pide clave ni tiene cuota. La base guardaba en `Team.logo` la URL remota de cada escudo, y el
navegador de cada cliente la pedía **directamente a `a.espncdn.com`**: la imagen se pinta sin el
optimizador de Next, que haría de intermediario.

Eso tenía tres problemas:
- si ESPN bloqueaba el enlace directo desde otras webs, o cambiaba sus rutas, desaparecían todos
  los escudos de la web pública, sin nada con lo que recuperarlos;
- cada visita del cliente acababa en un servidor de un tercero;
- la portada dependía de la disponibilidad de ESPN.

## Decisión

1. **Los escudos y emblemas se descargan a `public/escudos/` y `public/competiciones/` y se
   versionan en git.** `Team.logo` apunta a la ruta local, y `Team.logoSource` guarda la URL de
   ESPN de la que salió, para poder volver a descargarla.
2. **ESPN es solo la fuente en el momento del sync.** La web pública no le hace ninguna petición.
3. **El sync nunca pisa un escudo local** (`LOCAL_LOGO_PREFIX` en `lib/team-sync.ts`).

## Alternativas descartadas

El plan de agosto no comparó opciones: estas son las evidentes vistas ahora.

- **Seguir con el enlace directo.** Es gratis hasta el día en que ESPN lo bloquee.
- **Pasar las imágenes por el optimizador de Next.** Resuelve la privacidad, pero no la
  dependencia: si ESPN cambia las rutas, las imágenes siguen rompiéndose.
- **Guardar las imágenes en un almacenamiento externo.** Es un servicio más que configurar y pagar
  por unos cientos de imágenes pequeñas que casi nunca cambian.

## Consecuencias

- **El cron no puede escribir en `public/`**, porque en Vercel el sistema de ficheros es de solo
  lectura. Un equipo nuevo que crea el cron apunta a ESPN hasta que alguien ejecuta
  `scripts/download-crests.ts` en local y hace commit. La interfaz pinta igual una ruta local que
  una remota, así que el paso es tolerante.
- **Si se quita la protección del sync, el primer cron deshace toda la descarga.** Hay tests que
  la protegen.
- **Las imágenes engordan el repositorio**: 422 escudos y 19 emblemas. Están marcados como binarios en
  `.gitattributes`, porque un escudo que ESPN servía en SVG hizo que git lo tratara como texto y
  lo corrompiera.
- `scripts/sync-verify.ts report` cuenta cuántos escudos son locales y cuántos siguen en remoto.
