# The Lounge Beerhouse · Reservas

[![CI](https://github.com/rcavero/lounge-app/actions/workflows/ci.yml/badge.svg?branch=academic)](https://github.com/rcavero/lounge-app/actions/workflows/ci.yml?query=branch%3Aacademic)

Aplicación web de reserva de asientos para un bar deportivo de Valencia. Los clientes eligen
asiento en el plano del local y pagan con tarjeta desde el móvil, sin registrarse. El personal
gestiona eventos, reservas, bloqueos y usuarios desde un panel con roles.

**Está en producción y cobra dinero real desde mayo de 2026**, a través de Redsys (CaixaBank).
En septiembre de 2026 se preparó, en la rama `academic`, como proyecto de un máster de desarrollo
de software asistido por IA: la misma aplicación, con una suite de tests, CI, refactor de la capa
de dominio, los fallos que esos tests sacaron a la luz ya corregidos, y esta documentación. Todo
eso está en producción desde el 1 de octubre de 2026.

## Qué hace

**Para el cliente**
- Portada con los partidos de los próximos días, con escudos y competición. Los avisos, las
  condiciones y el modal del nombre salen en inglés o en español, según el idioma del navegador;
  los títulos, el plano, la confirmación y el ticket, solo en español.
- Reservas abiertas **de 48 h a 4 h antes** de cada evento. Fuera de esa ventana la tarjeta del
  evento aparece bloqueada, y el servidor tampoco deja pagar.
- Plano interactivo del local: cada asiento con su estado, y los asientos vendidos en un partido
  que se solapa en el tiempo también salen ocupados.
- Pago con tarjeta en la pasarela de Redsys. El importe incluye unos gastos de gestión por asiento
  que no son descontables en consumiciones.
- Ticket en PDF con los asientos, el desglose del importe y un QR para el personal, y recibo del
  pago con el código de autorización del banco.

**Para el personal** (`/admin`)
- Eventos: alta manual (fútbol y 11 deportes más) o desde sugerencias de partidos de 17
  competiciones, con la API pública de ESPN. Precio por asiento de 10 a 30 € y gastos de gestión
  de 0 a 5 €.
- Reservas por evento, con el detalle de cada una. El QR del ticket abre ese detalle.
- Bloqueo de asientos por evento.
- Aviso de **pagos a devolver**: cobros que llegaron cuando la reserva ya había caducado y sus
  asientos eran de otro.
- Editor del plano, usuarios e informes mensuales en PDF, solo para ADMIN.

| | ADMIN | WORKER |
|---|---|---|
| Ver eventos y reservas, bloquear asientos | ✓ | ✓ |
| Crear, editar y borrar eventos | ✓ | |
| Editar el plano, gestionar usuarios, informes | ✓ | |
| Marcar un pago como devuelto | ✓ | |

Los permisos se comprueban en el servidor, en cada acción, no solo en el menú.

## Stack

| | |
|---|---|
| Framework | Next.js 16.1 (App Router), React 19.2, TypeScript 5 |
| Datos | PostgreSQL en Supabase, Prisma 6 |
| Pagos | Redsys en modo redirección, con `redsys-easy` (firma HMAC-SHA256) |
| Sesión | `iron-session` (cookie cifrada) y `bcryptjs` |
| Interfaz | Tailwind CSS 4, Radix UI, Lucide, `tw-animate-css` |
| PDF y QR | jsPDF y `qrcode`, en el navegador |
| Tests | Vitest 5 (unitarios, componentes e integración) y Playwright (E2E) |
| Despliegue | Vercel, con crons de Vercel |

## Arrancar en local

Requisitos: **Node 24** (`.nvmrc`) y **Docker**.

```bash
npm ci
cp .env.example .env     # la plantilla ya apunta al Postgres de Docker y al sandbox de Redsys
                         # solo hay que rellenar AUTH_SECRET (openssl rand -hex 32)
npm run db:up            # Postgres 17 en el puerto 5433
npm run db:deploy        # migraciones
npm run db:seed          # los 47 asientos del local, y el primer administrador si en .env
                         # están SEED_ADMIN_EMAIL y SEED_ADMIN_PASSWORD
npm run dev              # http://localhost:3000
```

Para pagar en local, la pasarela de pruebas de Redsys acepta la tarjeta `4548 8120 4940 0004`, con
cualquier fecha futura y CVV `123`. Redsys no alcanza `localhost`, así que la notificación del
pago no llega. Fuera de producción, la página de confirmación confirma la reserva ella misma
(ver [`docs/entornos.md`](docs/entornos.md#redsys-en-cada-entorno)).

## Entornos

| Entorno | Rama | Base de datos | Redsys |
|---|---|---|---|
| Producción | `main` | Supabase de producción | **Real** |
| Testing | `testing` | Supabase de testing | Pruebas |
| Academic | `academic` | La misma de testing | Pruebas |
| Local | cualquiera | Docker, `lounge_dev` | Pruebas |
| Tests | cualquiera | Docker, `lounge_test` | Pruebas |

Cada fichero `.env*` apunta a una base y lo declara con `DB_ENV`. Los comandos sin sufijo son
siempre locales, y lo remoto se pide por su nombre: `db:whoami:testing` o `db:deploy:prod`.
Detalle, variables y procedimiento de migración en [`docs/entornos.md`](docs/entornos.md).

## Tests

```bash
npm test                  # unitarios y de componentes (373), sin base de datos
npm run test:integration  # integración contra Postgres real (183)
npm run test:coverage     # las dos anteriores, con cobertura y umbrales
npm run e2e               # Playwright contra la app construida (48)
```

La integración y el E2E necesitan `npm run db:up`. Ninguno usa secretos reales ni sale a
internet. La cobertura se exige donde vive la lógica, no sobre la interfaz:

| Capa | Líneas | Ramas |
|---|---|---|
| `domain/` (reglas de negocio) | 100 % | 96 % |
| `lib/` (servidor) | 96 % | 94 % |
| `config/` | 100 % | 100 % |

El CI de GitHub Actions corre todo en cada push, con un Postgres efímero y sin secretos.
Estrategia completa en [`docs/testing.md`](docs/testing.md).

## Estructura

```
src/
├── app/                 rutas: páginas, loading.tsx y /api (webhook de Redsys, vuelta del pago, crons)
├── modules/<dominio>/   payments, reservations, seating, events, football-data, auth, users
│   ├── actions/         server actions: lo que el navegador puede llamar
│   ├── domain/          reglas puras, sin base de datos
│   └── lib/             servidor, no invocable desde el navegador
├── components/ui/       primitivas de interfaz
├── shared/              piezas comunes
└── lib/                 Prisma, Redsys, guardias de sesión
prisma/                  esquema y migraciones
tests/                   integración, E2E y fábricas de datos
docs/                    documentación
```

## Documentación

| Documento | Qué cuenta |
|---|---|
| [`docs/arquitectura.md`](docs/arquitectura.md) | Contexto, organización del código, autenticación y la secuencia completa del pago |
| [`docs/modelo-de-datos.md`](docs/modelo-de-datos.md) | Las ocho tablas, sus invariantes y los estados de una reserva |
| [`docs/entornos.md`](docs/entornos.md) | Entornos, variables, scripts y cómo se migra producción |
| [`docs/testing.md`](docs/testing.md) | La suite, cómo se simula Redsys y cómo se sabe que los tests sirven |
| [`docs/seguridad.md`](docs/seguridad.md) | Modelo de amenazas, cómo se protege cada cosa y los riesgos que siguen abiertos |
| [`docs/adr/`](docs/adr/) | Ocho decisiones de arquitectura, con sus alternativas |
| [`docs/desarrollo-asistido-por-ia.md`](docs/desarrollo-asistido-por-ia.md) | Cómo se trabajó con IA: qué hizo, qué decidió la persona y qué salió mal |
| [`MASTER_IA.md`](MASTER_IA.md) | El plan de la entrega y el registro de cada paso |
| [`CLAUDE.md`](CLAUDE.md) | El contrato de arquitectura que lee la IA antes de tocar el código |
| [`CONTRIBUTING.md`](CONTRIBUTING.md) | Ramas, commits y cómo proponer un cambio |
| [`CHANGELOG.md`](CHANGELOG.md) | Historia del proyecto, mes a mes |
| [`docs/historico/`](docs/historico/) | Planes y guías de cada etapa, tal como se escribieron |

## Despliegue

Vercel despliega `main` en producción y cada rama en su propia URL de preview. **Desplegar no
aplica migraciones**: se aplican a mano, antes que el código, siguiendo
[`docs/entornos.md`](docs/entornos.md#migrar-una-base-remota). Los crons de limpieza (03:00 UTC)
y de sincronización de equipos (04:00 UTC) solo corren en producción.

## Licencia

Software propietario. Todos los derechos reservados. Se permite leerlo para evaluarlo, pero no
copiarlo, desplegarlo ni reutilizarlo. Ver [`LICENSE`](LICENSE).
