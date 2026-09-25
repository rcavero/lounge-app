# Entornos

La aplicación cobra dinero real, así que la regla que ordena todo este documento es una:
**nada que escriba en una base de datos remota ocurre por defecto.** Lo remoto siempre se pide
por su nombre.

## Los entornos

| Entorno | Rama | Base de datos | Redsys | Dónde corre |
|---|---|---|---|---|
| **Producción** | `main` | Supabase de producción | **Real**: cobra | Vercel, scope Production |
| **Testing** | `testing` | Supabase de testing | Sandbox | Vercel, preview de la rama |
| **Academic** | `academic` | **La misma de testing** | Sandbox | Vercel, preview de la rama |
| **Local** | cualquiera | Docker, base `lounge_dev` | Sandbox | Tu máquina, `npm run dev` |
| **Tests** | cualquiera | Docker, base `lounge_test` | Sandbox | Vitest y Playwright, en local y en CI |

`academic` comparte base con `testing` a propósito. Se intentó darle un esquema propio dentro del
mismo proyecto de Supabase, pero el pooler de Supabase en modo transacción reutiliza conexiones
entre clientes y filtró el `search_path` de un esquema a otro: testing dejó de responder hasta
que se limpió el pool. La historia completa está en `MASTER_IA.md`, apartado 0.4.

Consecuencias de compartir base:
- **`academic` no se siembra.** El seed crea un administrador con una contraseña conocida, y esa
  base es de dos ramas. Los eventos, reservas y usuarios de testing se crean a mano desde el
  panel.
- **Una migración de `academic` se aplica también a testing.** Tiene que ser compatible con el
  código de `testing`, que no la conoce: una columna nueva y anulable sí lo es, y quitar una
  columna no.

## Los ficheros de variables

Hay un fichero por **base de datos**, no por rama ni por despliegue. Cada uno declara a qué base
apunta con `DB_ENV`, y los scripts que escriben lo comprueban antes de conectar.

| Fichero | Base | `DB_ENV` | Quién lo carga |
|---|---|---|---|
| `.env` | Docker, `lounge_dev` | `local` | Next (`dev`, `build`, `start`), Prisma y los scripts sin sufijo |
| `.env.test` | Docker, `lounge_test` | `test` | Vitest y Playwright, a través de `tests/setup/env.ts` |
| `.env.testing` | Supabase de testing | `testing` | Solo los scripts con sufijo `:testing` |
| `.env.prod` | Supabase de producción | `production` | Solo los scripts con sufijo `:prod` |

Todos están en `.gitignore`. [`.env.example`](../.env.example) documenta cada variable sin
valores. En Vercel no hay ficheros: las variables se configuran en el panel, por scope.

> **Por qué `.env.prod` y no `.env.production`.** Next carga por su cuenta `.env.production`
> cada vez que construye o arranca en modo producción, y lo pone por delante de `.env`. Con ese
> nombre, un `npm start` en local arrancaba la aplicación contra la base de producción, y una
> compra de prueba apartaba asientos reales. Se llamó así hasta el 25 de septiembre de 2026.
> **No hay que crear nunca un `.env.production` en este repositorio.**

Antes de septiembre de 2026, `.env` apuntaba a producción y se cargaba solo en cada `npm run dev`.
Los documentos de [`historico/`](historico/) usan esos nombres: no se copia ninguna orden de ellos
tal cual.

### Las variables

| Variable | Para qué | Secreta |
|---|---|---|
| `DB_ENV` | A qué base apunta este fichero: `local`, `test`, `testing` o `production` | No |
| `DATABASE_URL` | Conexión de la app. En Supabase, el pooler en modo transacción (puerto 6543, `pgbouncer=true`) | **Sí** |
| `DIRECT_URL` | Conexión directa (puerto 5432), solo para las migraciones de Prisma | **Sí** |
| `AUTH_SECRET` | Cifra la cookie de sesión del panel. Distinta en testing y en producción | **Sí** |
| `CRON_SECRET` | Lo que tienen que presentar las llamadas a `/api/cron/*` | **Sí** |
| `NEXT_PUBLIC_BASE_URL` | URL pública del servidor: la de las URL de vuelta de Redsys y la que se imprime en el recibo | No |
| `REDSYS_ENV` | `production` solo en producción. Vacía, se usa la pasarela de pruebas | No |
| `REDSYS_MERCHANT_CODE`, `REDSYS_TERMINAL` | El comercio y el terminal del TPV | No |
| `REDSYS_SECRET_KEY` | La clave con la que se firman los pagos y se verifican las notificaciones | **Sí** |

La app **se niega a arrancar** si faltan las tres variables de Redsys: `src/lib/redsys.ts` lanza
al importarse. Así un despliegue sin credenciales falla al desplegar y no cuando un cliente paga.

`NEXT_PUBLIC_BASE_URL` puede quedar vacía en las previews: entonces se usa la URL de la rama que
da Vercel. En producción tiene que ser el dominio real, porque se imprime en el recibo.

## Los scripts

**Sin sufijo es local. Con sufijo es remoto, y el sufijo dice cuál.** Ningún comando apunta a
una base remota por defecto.

```
npm run dev                 la app contra Docker
npm run dev:testing         la app en local contra la base de TESTING (compartida)
npm run build / start       el build de producción, contra Docker

npm run db:up / db:down     levanta o para el contenedor de Postgres
npm run db:deploy           aplica las migraciones a lounge_dev
npm run db:seed             siembra lounge_dev (nunca una base remota)
npm run db:studio           Prisma Studio sobre lounge_dev

npm run db:whoami           a qué base apunta cada entorno, y cuántas filas tiene
npm run db:whoami:testing
npm run db:whoami:prod

npm run db:deploy:testing   aplica las migraciones a testing
npm run db:deploy:prod      aplica las migraciones a producción
npm run db:backup:testing   volcado completo a backups/ (gitignorado)
npm run db:backup:prod

npm test                    unitarios y de componentes, sin base de datos
npm run test:integration    integración contra lounge_test
npm run e2e                 construye, arranca en el 3100 contra lounge_test y lanza Playwright
```

No hay variantes `:academic`: serían un segundo nombre para la base de testing, y un script
destructivo lanzado «contra academic» escribiría en testing sin avisar.

`db:push` existe, pero no se usa contra ninguna base con datos. Crea las tablas desde
`schema.prisma` sin pasar por las migraciones, y el `CHECK` de importes vive en una migración:
con `db push` no existiría.

## Las redes contra el entorno equivocado

1. **`db:whoami` primero.** Imprime el `DB_ENV` declarado y, debajo, el proyecto de Supabase al
   que se ha conectado de verdad, con sus conteos. Se lanza antes de cualquier operación remota.
   Si el `DB_ENV` y el destino no casan, algo está mal configurado.
2. **`requireDbEnv(...)`** (`scripts/lib/require-db-env.ts`). Los scripts que escriben declaran
   contra qué entornos aceptan correr, y abortan antes de conectar si el cargado es otro. **Falla
   cerrado**: sin `DB_ENV` también aborta. Lo usan `rename-seats.ts`, la integración
   (`requireDbEnv("test")`, antes de migrar y de truncar tablas) y Playwright.
3. **El canario del E2E.** Playwright protege su proceso con `requireDbEnv("test")`, pero quien
   escribe al pagar es el servidor Next, que es otro proceso. El setup siembra un evento con un
   id único y aborta si la portada no lo muestra: el servidor está mirando otra base.
4. **Confirmación explícita en lo destructivo.** `sync-reset.ts` exige teclear el ref del
   proyecto de Supabase conectado, y `simulate-redsys-notify.ts` aborta si `REDSYS_ENV` es
   `production` o si el destino no es `localhost`.

## Arrancar en local

Requisitos: Node 24 (`.nvmrc`) y Docker.

```bash
npm ci
cp .env.example .env        # y rellenar: DB_ENV=local, la URL de Docker, secretos de prueba
npm run db:up               # Postgres 17 en el puerto 5433, con lounge_dev y lounge_test
npm run db:deploy           # las migraciones, con su CHECK
npm run db:seed             # los 47 asientos y un usuario administrador
npm run dev
```

El contenedor usa el puerto **5433** para no chocar con un Postgres instalado en la máquina. Sus
credenciales (`lounge` / `lounge`) están en `docker-compose.yml` a propósito: la base no sale del
portátil y no tiene datos reales. `lounge_test` la crea `docker/initdb/` la primera vez que
arranca el volumen. Si se cambia ese script, hace falta `npm run db:down -- -v`.

Los tests leen `.env.test` si existe. Si no existe, usan los valores por defecto de
`tests/setup/env.ts`, que apuntan a `lounge_test` con la clave pública del sandbox de Redsys.

## Redsys en cada entorno

| | Local | Testing y academic | Producción |
|---|---|---|---|
| Pasarela | Pruebas (`sis-t.redsys.es`) | Pruebas | **Real** (`sis.redsys.es`) |
| Tarjetas | De prueba | De prueba | Reales |
| ¿Llega el webhook? | **No**: Redsys no alcanza `localhost` | Sí, a la URL pública de la preview | Sí |
| ¿Quién confirma? | La página de confirmación | El que llegue antes: el webhook o la página | **Solo el webhook** |
| Recibo (autorización y fecha) | Con guiones, salvo que se simule | Completo | Completo |

La dirección del webhook viaja firmada en cada pago (`DS_MERCHANT_MERCHANTURL`), así que cada
despliegue recibe las notificaciones de los pagos que ha iniciado él.

En local, para probar el recibo, se simula la notificación:
`npx tsx scripts/simulate-redsys-notify.ts <nº de pedido> [ok|ko]`. La firma con la clave del
entorno y la manda a `localhost`.

## Vercel

- **Production** despliega `main`. **Preview** despliega el resto de ramas, cada una con su URL.
  Las variables se configuran por scope. Las de producción, incluida la clave real de Redsys,
  solo existen en el scope Production.
- **Los crons no corren en las previews.** En testing y academic se lanzan a mano:
  `curl -H "Authorization: Bearer $CRON_SECRET" <url>/api/cron/cleanup`.
- **Desplegar no aplica migraciones.** `npm run build` es `prisma generate && next build`. Las
  migraciones se aplican a mano, antes que el código.

## Migrar una base remota

Las migraciones se aplican a mano desde un portátil. Para producción, el orden es este:

1. **Comprobar que la migración es compatible hacia atrás**: el código que está desplegado tiene
   que seguir funcionando con ella aplicada. Una columna anulable nueva lo es. Un `NOT NULL` sin
   valor por defecto, o un `DROP DEFAULT`, no. Si no lo es, hace falta una ventana sin reservas
   pendientes.
2. **Probarla antes en testing**: `db:whoami:testing`, `db:deploy:testing`, y una compra en la
   preview.
3. **Copia de seguridad** si la migración toca filas existentes: `npm run db:backup:prod`.
4. **Confirmar el destino**: `npm run db:whoami:prod`. Tiene que salir el proyecto de producción.
5. **Aplicar**: `npm run db:deploy:prod`. Después, `npx dotenv -e .env.prod -- npx prisma migrate
   status` tiene que decir que el esquema está al día.
6. **Desplegar el código**: fusionar en `main`.
7. **Verificar con dinero real**: una compra y, si la migración toca importes,
   `npx dotenv -e .env.prod -- npx tsx scripts/verify-management-fee.ts report`.

Un ejemplo de por qué el paso 1 importa: `20260825120000_add_management_fee` quita el valor por
defecto de dos columnas `NOT NULL`. Entre aplicarla y desplegar el código nuevo, el código viejo
no podía crear ninguna reserva. Salió bien porque se hizo sin eventos abiertos.
