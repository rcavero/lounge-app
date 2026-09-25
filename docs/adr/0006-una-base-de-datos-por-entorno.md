# 0006 · Una base de datos por entorno, no por rama, y cada fichero `.env` declara la suya

**Estado:** vigente · **Fechas:** abril de 2026 (tres entornos) y septiembre de 2026 (renombrado
y rama `academic`) · **Planes:** [`MIGRACION_SUPABASE_3_ENTORNOS.md`](../historico/MIGRACION_SUPABASE_3_ENTORNOS.md) y `MASTER_IA.md`, apartados 0.2 y 0.4

## Contexto

En abril de 2026 la app pasó de SQLite a Supabase, con dos proyectos: **testing** y
**producción**, uno por cada rama desplegada (`testing` y `main`). Se desarrollaba en local
contra SQLite.

En septiembre aparecieron dos problemas:
1. **El fichero por defecto era el peligroso.** `.env` apuntaba a producción y lo cargaban solos
   Prisma y `next dev`. Cualquier orden olvidada escribía en producción.
2. **Hacía falta una tercera rama desplegada**, `academic`, para la entrega del máster, sin tocar
   las otras dos.

## Decisión

1. **Una base de datos por entorno.** Cada fichero `.env` es una base y declara cuál con `DB_ENV`:

   | Fichero | Base | `DB_ENV` |
   |---|---|---|
   | `.env` | Docker local, `lounge_dev` | `local` |
   | `.env.test` | Docker local, `lounge_test` | `test` |
   | `.env.testing` | Supabase de testing | `testing` |
   | `.env.prod` | Supabase de producción | `production` |

2. **El valor por defecto es el inofensivo.** Sin sufijo, todo va a Docker. Lo remoto se pide por
   su nombre: `db:deploy:testing` o `db:whoami:prod`.
3. **Los scripts que escriben comprueban `DB_ENV`** (`requireDbEnv`) y abortan antes de conectar
   si no es el que esperan. Si falta, también abortan.
4. **`academic` comparte la base de testing.** No hay `DB_ENV=academic`: sería un segundo nombre
   para la misma base.

## Alternativas descartadas

- **Un esquema propio para `academic` dentro del proyecto de testing.** Se probó, con una prueba
  de humo previa, y falló rompiendo testing. El pooler de Supabase en modo transacción reutiliza
  conexiones entre clientes, y el `search_path` de un esquema acabó en conexiones de otro. Testing
  dejó de responder hasta que se limpió el pool. No hubo pérdida de datos, porque el esquema aún
  no tenía tablas.
- **Un tercer proyecto de Supabase para `academic`.** No se discutió entonces. Visto ahora: es otra
  base que mantener, sembrar y migrar para una rama temporal.
- **Un fichero `.env` por rama.** Los ficheros `.env` no tienen rama: son un único sistema de
  ficheros compartido por todas. Nombrarlos por rama no dice a qué base apuntan.
- **Llamar `.env.production` al de producción.** Fue el nombre que se eligió al principio, y era
  un error: Next carga ese fichero solo en `next build` y `next start`, así que un `npm start` en
  local arrancaba contra producción. Se renombró a `.env.prod` el 25 de septiembre de 2026.

## Consecuencias

- **`academic` no se siembra**: el seed crea un administrador con una contraseña conocida, y la
  base es de dos ramas.
- **Una migración de `academic` llega también a testing**, y tiene que ser compatible con el
  código de `testing`.
- **El error de un script queda contenido.** Uno lanzado contra el entorno equivocado aborta antes
  de conectar, y `db:whoami` enseña el destino real antes de cualquier operación remota.
- **Los tests no pueden tocar una base remota**: exigen `DB_ENV=test`, y el E2E comprueba con un
  canario que el servidor lee la base que acaba de sembrar.

Detalle completo en [`entornos.md`](../entornos.md).
