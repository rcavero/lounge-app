# Editor de asientos v2 — nomenclatura, crear, editar y eliminar

> Estado: **plan cerrado, sin implementar.** Pendiente de repaso antes de empezar.
> Rama de trabajo: `testing`. Fecha: 2026-08-17.

> ## ⚠️ Actualización del 2026-08-27 — la nomenclatura ya no va por aquí
>
> El listado de Susana resultó ser un **renombrado 1:1** (47 → 47, sin altas ni bajas), así que la
> parte de nomenclatura se resolvió con **`scripts/rename-seats.ts`** en vez de con el editor: sin
> migración, sin `deletedAt` y sin guarda de eventos activos, porque no se crea ni se borra ningún
> asiento. En el mismo trabajo entraron el orden de los códigos en el ticket y `PROYECTOR` → `TV3`.
>
> **Lo que sigue vivo de este plan, y sin hacer:**
>
> - **Los tres bugs de dinero del Paso 6 (T5 / T6 / T7): siguen en producción.** Es puro bug-fix,
>   es desplegable solo y es lo más urgente del documento.
> - El **CRUD del editor** (Pasos 1, 2, 5): crear, renombrar y eliminar desde `/admin/asientos`,
>   para que Susana no dependa de desarrollo. Requiere entonces sí la migración de `deletedAt`.
> - Los saneamientos del Paso 3 y 4 (`initializeSeatsForEvent`, `getSeatsForEvent` desde
>   `SeatStatus`, backfill en el cron) y la limpieza del Paso 7.
>
> Ya hechos por el trabajo del renombrado: la guarda del seed (Paso 7, primera mitad) y las
> ordenaciones por `code` en `getSeatsForEvent` / `getAllSeats`.

## Contexto

La dueña del bar ha detectado que **la nomenclatura de los asientos no se corresponde con la
realidad del local**: los códigos actuales (`T1-A1`, `P-B7`…) vienen del seed inicial y nunca se
revisaron contra el sitio físico. Tiene ya el listado nuevo con nombres alfanuméricos.

Hoy `/admin/asientos` **sólo permite arrastrar asientos** para recolocarlos. No hay forma de
renombrar, crear ni eliminar: los 47 asientos existen únicamente porque los escribió
`prisma/seed.ts`, y el módulo de seating **nunca crea ni borra una fila `Seat`**. Aplicar la nueva
nomenclatura hoy exige tocar la base de datos a mano.

Aprovechando ese arreglo obligatorio, esta versión convierte el editor en una herramienta de
configuración completa: **seleccionar con click, editar el nombre, eliminar y crear asientos**,
manteniendo el drag-drop actual.

**Resultado esperado:** la dueña mantiene el plano del local sin intervención de desarrollo, y los
eventos ya vendidos no se ven afectados por los cambios estructurales.

> ⚠️ **Este plan arregla, de paso, tres bugs de dinero que ya existen hoy** (ver Paso 6). No son
> consecuencia del trabajo nuevo: están en producción desde el principio. Si sólo hubiera tiempo
> para una cosa, sería el PR 1.

---

## Decisiones cerradas (no volver sobre ellas)

| Decisión | Elegido | Por qué |
|---|---|---|
| Aplicar el listado nuevo | **A mano en el editor** | No hay script de renombrado masivo; la dueña los edita uno a uno |
| Eventos ya creados | **No se versiona el plano** | Se bloquean sólo las operaciones estructurales cuando hay eventos activos |
| Alcance del bloqueo | **Sólo estructural** | Mover posiciones sigue permitido siempre: es cosmético y ya es global hoy |
| Eliminar | **Borrado lógico** (`deletedAt`) | Preserva el código de asiento en las ~325 reservas históricas |
| Campos del modal | **Sólo el nombre** | Zonas y filas ya no tienen sentido para el local |
| Charset del nombre | `A-Z a-z 0-9 _ - / .` | Pedido explícitamente |

---

## Nueve trampas del código actual que condicionan el diseño

Todo lo de abajo está verificado leyendo el código, no supuesto.

**T1 — Ningún evento pasa nunca a `FINISHED`.** `createEvent` fija `status: "UPCOMING"`
(`src/modules/events/actions/index.ts:128`) y nada lo cambia después; el cron sólo borra eventos con
más de 90 días. Una guarda de tipo `status IN (UPCOMING, LIVE)` bloquearía el editor **para
siempre**. La guarda tiene que ir **por fecha**.

**T2 — El índice `Seat_code_key` es global: el borrado lógico NO libera el nombre.** Se borra
`M12`, se intenta crear `M12`, y el `INSERT` revienta con `P2002` aunque el mapa no lo muestre.
Es la trampa menos obvia de todo el trabajo. Solución en el Paso 2.

**T3 — `getSeatsForEvent` trata "sin fila `SeatStatus`" como AVAILABLE**
(`src/modules/seating/actions/index.ts:105`). Un asiento nuevo se pinta **verde y reservable** en
eventos que no tienen su fila. El fan-out por sí solo no arregla esto: mientras el mapa se construya
desde `prisma.seat.findMany()` con ese fallback, cualquier hueco se pinta como disponible.

**T4 — `initializeSeatsForEvent` no puede hacer backfill.** La guarda `existingCount > 0 → return`
(`seating/actions/index.ts:115-117`) es todo-o-nada. Añade un asiento y **ningún evento existente
recibirá jamás su fila**. Además está exportada desde un fichero `"use server"` **sin ninguna
comprobación de sesión**: es una server action pública invocable con un `eventId` arbitrario.

**T5 — `initializePayment` no compara cuántas filas encontró con cuántas pidió**
(`src/modules/payments/actions/index.ts:34-45`). Combinado con T3 y con `numberOfSeats: seatIds.length`
(línea 96), un asiento sin fila produce **una reserva cobrada con más asientos de los que aparecen
en el ticket**. Mismo patrón en `reservations/actions/index.ts:90-112`.

**T6 — Carrera de dinero en `initializePayment`.** El `updateMany` de las líneas 104-107 **no filtra
por `status: "AVAILABLE"`**. Dos clientes reservando el mismo asiento a la vez: ambos pasan la
lectura de disponibilidad, y el segundo **machaca el `reservationId` del primero**. El primero paga
y se queda sin asiento asignado. Es independiente de este trabajo y es el bug más grave del listado.

**T7 — `seatIds` puede llegar con repetidos** desde el cliente. Hoy se cobraría por 3 y se
reservarían 2. Falta un `new Set`.

**T8 — `Seat.id === Seat.code` en las 47 filas actuales**, porque `prisma/seed.ts:19-67` fija el
`id` explícitamente. Es un invariante accidental: un asiento creado con `prisma.seat.create`
recibirá un cuid. **Nunca cambiar esos ids** (rompería `SeatStatus.seatId`). Explica también por qué
`DEFAULT_SEAT_POSITIONS` está indexado por códigos y por qué el botón "Resetear" funciona hoy de
carambola.

**T9 — Renombrar reescribe el pasado.** Como `code` nunca se desnormaliza (siempre join
`SeatStatus → Seat`), renombrar `T1-A1` → `Barra1` cambia lo que muestra el detalle de reserva de
partidos **ya jugados**, mientras el ticket PDF ya descargado por el cliente sigue diciendo
`T1-A1`. La guarda de eventos futuros no protege de esto. Impacto bajo (el cron borra a los 90
días) y desnormalizar sería peor: **se documenta, no se resuelve**.

---

## Paso 0 — Migración

Fichero nuevo `prisma/migrations/20260817120000_add_seat_deleted_at/migration.sql` (ajustar el
timestamp al día real; debe ser posterior a `20260815100000`), siguiendo el estilo comentado de
`20260815100000_add_team_logo_source`:

```sql
-- Borrado lógico de asientos + backfill de SeatStatus.
--
-- 1) Seat.deletedAt
--
--    Borrar un asiento de verdad arrastraría, por ON DELETE CASCADE, todos sus
--    SeatStatus, y con ellos el código de asiento de reservas ya cobradas: el
--    ticket PDF y el detalle de reserva se quedarían sin datos. El borrado pasa
--    a ser lógico: el asiento desaparece del plano y de los eventos nuevos, pero
--    el histórico queda intacto.
--
--    Aditiva y nullable (NULL = asiento vivo): ninguna fila existente cambia, y
--    ADD COLUMN sin DEFAULT es metadata-only en PostgreSQL (sin reescritura de
--    tabla ni lock prolongado).

ALTER TABLE "Seat" ADD COLUMN "deletedAt" TIMESTAMP(3);

CREATE INDEX "Seat_deletedAt_idx" ON "Seat"("deletedAt");

-- 2) Backfill de SeatStatus
--
--    initializeSeatsForEvent() sólo creaba filas si el evento no tenía NINGUNA
--    ("if (existingCount > 0) return"), así que un asiento añadido después de
--    crear un evento se quedaba sin fila para siempre. getSeatsForEvent lo
--    pintaba verde por el fallback `|| "AVAILABLE"` (línea 105) e
--    initializePayment cobraba por él sin llegar a reservarlo.
--
--    A partir de esta versión getSeatsForEvent se construye desde SeatStatus
--    (inner join), de modo que una fila que falte hace DESAPARECER el asiento
--    del plano. Este INSERT deja consistentes todos los eventos existentes
--    ANTES de que se despliegue el código nuevo.
--
--    ON CONFLICT se apoya en @@unique([eventId, seatId]).

INSERT INTO "SeatStatus" ("id", "eventId", "seatId", "status", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, e."id", s."id", 'AVAILABLE', NOW(), NOW()
FROM "Event" e
CROSS JOIN "Seat" s
ON CONFLICT ("eventId", "seatId") DO NOTHING;
```

Notas:
- `gen_random_uuid()` es nativo desde PostgreSQL 13 (Supabase va por 15/16). No es un cuid, pero
  `SeatStatus.id` es opaco: sólo se usa como clave primaria, no se muestra ni se parsea en ningún
  sitio.
- Volumen: eventos vivos × 47, con retención de 90 días → unos pocos miles de filas. Instantáneo.
- **Una vez aplicada en testing, no editar el fichero**: Prisma guarda su checksum en
  `_prisma_migrations` y detectaría drift.

En `prisma/schema.prisma`, dentro de `model Seat`:

```prisma
  deletedAt DateTime?  // Borrado lógico: NULL = vigente. El histórico conserva el código

  @@index([deletedAt])
```

> **`zone`, `row`, `number` se quedan como están.** Son `NOT NULL` (salvo `row`) y el enum
> `SeatZone` está referenciado en tipos y componentes muertos. Hacerlas nullable es una cascada de
> cambios sin valor: se rellenan con valores por defecto al crear y desaparecen de la UI.

---

## Paso 1 — Guarda de eventos activos

**Ubicación: `src/modules/seating/lib/active-events.ts`** — en `lib/`, no en `actions/`, para que
**no sea invocable como server action** (el fichero no lleva `"use server"`).

```ts
export interface ActiveEventSummary {
  count: number; firstTitle: string | null; firstDate: Date | null;
}

export async function getActiveEventSummary(): Promise<ActiveEventSummary>  // para el banner, no lanza
export async function assertSeatStructureEditable(): Promise<void>          // lanza Error("SEAT_STRUCTURE_LOCKED")
```

Consulta compartida — filtro grueso en BD + filtro fino en JS, el mismo patrón que ya usa
`getOverlappingEventIds` (`seating/actions/index.ts:9-32`):

```ts
const now = Date.now();
const candidates = await prisma.event.findMany({
  where: {
    status: { not: "CANCELLED" },
    // Filtro grueso: descarta todo el histórico de un plumazo. 24 h de colchón
    // cubren cualquier durationMinutes razonable (el campo es libre, pero nunca > 1 día).
    eventDate: { gte: new Date(now - 24 * 60 * 60 * 1000) },
  },
  select: { id: true, title: true, eventDate: true, durationMinutes: true },
  orderBy: { eventDate: "asc" },
});
const active = candidates.filter(
  (e) => e.eventDate.getTime() + e.durationMinutes * 60_000 > now
);
```

**Por qué por fecha y no por status:** ver T1. `status != CANCELLED` sí es útil: un evento cancelado
no se puede reservar, así que no debe bloquear nada.

**Se verifica en los dos lados:**
- **Servidor:** las tres actions estructurales empiezan con
  `await requireAdmin(); await assertSeatStructureEditable();`. Nunca fiarse del `disabled`.
- **Cliente:** `page.tsx` mete `getActiveEventSummary()` en su `Promise.all` y pasa
  `structureLocked` + mensaje al editor.

**Permisos.** Hoy `/admin/asientos` sólo pasa por `requireAuth`, así que un `WORKER` que teclee la
URL entra, aunque el enlace del dashboard sólo se pinte para `ADMIN`
(`src/app/admin/(dashboard)/page.tsx:47`). Con CRUD estructural eso no vale:
- `createSeat` / `renameSeat` / `deleteSeat` → `requireAdmin()`.
- `updateSeatPositions` → subirlo también a `requireAdmin()` (hoy es incoherente).
- `asientos/page.tsx` → `const session = await getSessionData(); if (session.role !== "ADMIN") redirect("/admin");`

> **Riesgo de producto que hay que contarle a la dueña:** la guarda es **global**, no por asiento.
> Con 20 partidos cargados para el mes que viene, no podrá borrar nada. El mensaje del banner debe
> indicar la salida (esperar o cancelar el evento). Si en uso real molesta, la v3 sería relajarla a
> *"sólo bloquea si ese asiento concreto tiene alguna fila `RESERVED`/`OCCUPIED` en un evento
> vivo"*. **No implementarla ahora**, pero `deleteSeat` ya deja el hueco preparado.

---

## Paso 2 — Las tres actions nuevas

En `src/modules/seating/actions/index.ts`. Devuelven el patrón `{ success, error? }` que ya usa
`saveBlockedSeats` (líneas 189-218) — nunca lanzan para errores de negocio.

Constantes en `src/modules/seating/constants.ts`:

```ts
export const SEAT_CODE_REGEX = /^[A-Za-z0-9_\-\/.]+$/;
export const SEAT_CODE_MAX_LENGTH = 10;
export const NEW_SEAT_SLOTS = [
  { x: 6, y: 94 }, { x: 13, y: 94 }, { x: 20, y: 94 },
  { x: 6, y: 88 }, { x: 13, y: 88 }, { x: 20, y: 88 },
];
```

> **Por qué 10 caracteres, y no es un número al azar.** El ticket PDF pinta los códigos de 3 en 3
> unidos por `"  •  "` (`src/app/reserva/confirmacion/[orderId]/client.tsx:118-124`): lienzo de
> 80 mm, márgenes de 5 mm → 70 mm útiles. Helvetica 8 pt en mayúsculas ≈ 0,68 em ≈ 1,92 mm por
> carácter; los dos separadores comen ~10 mm; quedan 60 mm ÷ 3 códigos = 20 mm ≈ **10,4
> caracteres**. Con 12 ya se sale del papel. **Es el único límite duro del sistema y el más fácil de
> olvidar.**
>
> Refuerzo barato en el mismo fichero: si algún código de la reserva supera 10 caracteres, bajar
> `seatsPerLine` a 2 — y **ajustar también `seatsHeight` en la línea 42**, que asume división por 3
> para calcular el alto del lienzo.

**Validación del nombre** (helper privado):

```ts
function normalizeSeatCode(raw: string): { code: string } | { error: string } {
  const code = raw.trim();
  if (code.length === 0) return { error: "El nombre no puede estar vacío" };
  if (code.length > SEAT_CODE_MAX_LENGTH) return { error: `Máximo ${SEAT_CODE_MAX_LENGTH} caracteres` };
  if (!SEAT_CODE_REGEX.test(code))
    return { error: "Sólo se permiten letras, números y los signos _ - / ." };
  return { code };
}
```

**Unicidad: case-insensitive.** `Seat_code_key` distingue mayúsculas, así que la base de datos
aceptaría `m12` y `M12` como asientos distintos — indistinguibles a ojo en un punto de 31 px o en un
ticket de 80 mm, y un cliente acabaría reclamando el asiento equivocado. Se comprueba con
`findFirst({ where: { code: { equals: code, mode: "insensitive" }, id: { not: seatId } } })` (el
datasource es `postgresql`, así que `mode` está disponible). La validación de la app es **más
estricta** que el índice, que es la dirección correcta; aun así, capturar `P2002` como red.

### Reutilizar el nombre de un asiento borrado lo **resucita** (solución a T2)

La comprobación de unicidad de `createSeat` mira **todos** los asientos, borrados incluidos:

- Choca con uno **vigente** → error normal, *"Ya existe un asiento llamado X"*.
- Choca con uno **borrado** → en vez de fallar, se **revive**: `deletedAt = null`, `code` pasa a la
  grafía exacta que se ha escrito, posición a un hueco libre de la esquina, y fan-out de
  `SeatStatus`. Se avisa en la UI: *"Se ha restaurado el asiento eliminado con ese nombre"*.

Es semánticamente correcto —el asiento vuelve con su historial enganchado al mismo `id`— y evita
tocar el índice. La alternativa de libro sería un índice único parcial
(`CREATE UNIQUE INDEX … WHERE "deletedAt" IS NULL`), pero **Prisma no sabe expresarlo en el
esquema** y `npm run db:migrate` (`prisma migrate dev`) detectaría drift e intentaría deshacerlo.

En `renameSeat` **no** hay resurrección: fusionar dos filas sería otra cosa. Error explícito —
*"Ese nombre pertenece a un asiento eliminado; recupéralo desde Crear asiento o elige otro"*.

### Las tres actions

**`createSeat(code: string): Promise<{ success, seat?, revived?, error? }>`**
```
requireAdmin() → assertSeatStructureEditable()
normalizeSeatCode()
colisión case-insensitive:  vivo → error  |  borrado → REVIVIR (arriba)
hueco: primer NEW_SEAT_SLOTS sin asiento vivo a menos de 4 puntos; si todos ocupados, el primero
number = (aggregate _max number) + 1     ← sin filtrar deletedAt, para que sea monótono
$transaction: seat.create({ code, zone: "PROJECTOR", row: null, number, posX, posY, capacity: 1 })
              + ensureSeatStatusesForSeat(id, tx)
```

**`renameSeat(seatId, code): Promise<{ success, error? }>`** — mismo bloque de validación,
excluyéndose a sí mismo, y `seat.update`.

**`deleteSeat(seatId): Promise<{ success, error? }>`**
```
requireAdmin() → assertSeatStructureEditable()
$transaction:
  seat.update({ where: { id }, data: { deletedAt: new Date() } })
  // Defensa en profundidad: hoy la guarda impide que existan filas futuras, pero
  // si algún día se relaja (ver Paso 1), el borrado debe llevárselas.
  seatStatus.deleteMany({ where: { seatId, reservationId: null,
                                   event: { eventDate: { gte: new Date() } } } })
```

**Campos vestigiales al crear:** `zone: "PROJECTOR"`, `row: null`, `number: max+1`, `capacity: 1`,
con un comentario en el código explicando que la UI ya no los expone.

**`updateSeatPositions` endurecida:** validar `Number.isInteger(posX)` y rango 0-100, descartar ids
que ya no existan o estén borrados, y envolver en `prisma.$transaction([...])` en vez de
`Promise.all`. Hoy un id obsoleto (asiento borrado desde otra pestaña) lanza `P2025` y deja el
guardado a medias, con el `alert()` genérico como única pista.

**Ordenación:** los `orderBy: [{zone},{row},{number}]` pasan a `code: "asc"`. Es orden de render
sobre elementos posicionados en absoluto: **no afecta a nada funcional**.

---

## Paso 3 — `SeatStatus`: un solo helper, sin server action pública

**Helper único en `src/modules/seating/lib/seat-status.ts`** (sin `"use server"`), que deduplica los
tres sitios que hoy crean filas en bloque:

```ts
export async function ensureSeatStatusesForEvent(
  eventId: string,
  client: Prisma.TransactionClient | typeof prisma = prisma
): Promise<number> {
  const seats = await client.seat.findMany({
    where: { deletedAt: null }, select: { id: true },
  });
  if (seats.length === 0) return 0;
  const { count } = await client.seatStatus.createMany({
    data: seats.map((s) => ({ eventId, seatId: s.id, status: "AVAILABLE" as const })),
    skipDuplicates: true,   // se apoya en @@unique([eventId, seatId]) para las carreras
  });
  return count;
}
```

…y su gemelo `ensureSeatStatusesForSeat(seatId, client)`, que hace lo inverso: **un asiento × N
eventos vivos**. Sólo los **vivos** (`eventDate + durationMinutes > now`, `status != CANCELLED`):
meter filas en un partido de hace dos meses es semánticamente falso —ese asiento no existía— y con
el `getSeatsForEvent` del Paso 4 esa distinción se refleja sola en el plano histórico.

**Sustituciones:**

| Hoy | Pasa a ser |
|---|---|
| `events/actions/index.ts:134-142` | `ensureSeatStatusesForEvent(event.id, tx)` — **y envolver `event.create` + helper en `$transaction`**: hoy está fuera y un fallo deja un evento sin asientos, es decir, no reservable |
| `football-data/actions/index.ts:159-188` | `ensureSeatStatusesForEvent(created.id, tx)` dentro del `$transaction` que ya existe; borrar el `findMany` de la línea 159 |
| `seating/actions/index.ts:109-129` | **eliminar `initializeSeatsForEvent` por completo** (T4) |
| `src/app/eventos/[id]/page.tsx:19` | **eliminar la llamada** |

**Justificación de quitar la llamada de la página pública** (frente al incidente de agotamiento del
pool del 17-07-2026): hoy esa ruta paga 1 `count` en cada carga; un backfill genérico costaría 2
SELECT + 1 INSERT por carga, o sea **peor**. Y ya no hace falta, porque no queda ningún camino que
produzca un par (evento, asiento) sin fila:

1. la migración hace el backfill histórico una vez;
2. `createEvent` y `createEventFromSuggestion` crean las filas al crear el evento, en transacción;
3. `createSeat` hace fan-out a los eventos vivos.

**Red de seguridad diaria en el cron, no en el GET público.** En
`src/app/api/cron/cleanup/route.ts` (03:00, ya autenticado con `CRON_SECRET`), tras el borrado de
eventos viejos: producto cartesiano (eventos con `eventDate >= now`) × (asientos con
`deletedAt: null`) en un único `createMany({ skipDuplicates: true })`. Devolver el `count` en el
JSON de respuesta para poder auditarlo. Coste: 2 SELECT + 1 INSERT **al día**.

> *Nota lateral, fuera de alcance:* `expireStaleReservations` sigue **escribiendo** en BD dentro de
> `getSeatsForEvent`, es decir, en cada GET público. El cron ya hace exactamente lo mismo. Si vuelve
> a haber presión de pool, ése es el candidato número uno a eliminar.

---

## Paso 4 — `getSeatsForEvent` desde `SeatStatus`, y filtrado de `deletedAt`

**El cambio de fondo (soluciona T3):** `getSeatsForEvent` deja de construirse desde
`prisma.seat.findMany()` y pasa a construirse **desde `SeatStatus` con inner join**:

```ts
const rows = await prisma.seatStatus.findMany({
  where: { eventId, seat: { deletedAt: null } },
  include: { seat: true },
  orderBy: { seat: { code: "asc" } },
});
// ... marcado de OCCUPIED por eventos solapados, igual que hoy ...
return rows.map((r) => ({ ...r.seat, status: statusMap.get(r.seatId) ?? r.status }));
```

**Desaparece el `|| "AVAILABLE"` de la línea 105.** Consecuencias, todas deseadas:
- un asiento sin fila ya **no** se pinta verde: sencillamente no aparece;
- un asiento creado hoy **no** aparece en eventos pasados;
- un asiento borrado desaparece del plano aunque su fila siga viva.

> ⚠️ **El riesgo se invierte, y hay que saberlo:** hoy un hueco muestra asientos de más; a partir de
> ahora muestra asientos de menos, que es visible para el cliente. Por eso el backfill va **en la
> migración** (antes que el código) y por eso el cron lleva red de seguridad.

**SÍ filtran `deletedAt: null`** — todo lo que dibuja el plano vigente o alimenta eventos nuevos:

| Ubicación | Cambio |
|---|---|
| `getAllSeats()` | `where: { deletedAt: null }`, `orderBy: { code: "asc" }` |
| `getSeatsForEvent()` | reconstruida como arriba |
| `lib/seat-status.ts` (ambos helpers) | `where: { deletedAt: null }` |
| Backfill del cron | ídem |

Heredan el filtro sin tocarlas: `src/app/eventos/[id]/page.tsx`,
`.../reservas/[id]/bloquear/page.tsx`, `.../reservas/[id]/[reservationId]/page.tsx`.

**NO filtran nunca** — todo lo que sirve historial, porque el join va por relación y debe seguir
resolviendo:

- `getReservationByOrderId` (`payments/actions:200-231`) → datos del ticket PDF.
- `getReservationWithSeats`, `getEventWithReservations` (`reservations/actions:200-247`) → admin.
- `getMonthlyReportData` — ya no toca códigos, sólo `numberOfSeats`.
- `expireStaleReservations` y el cron de expiración: operan por `seatId` y deben liberar también los
  asientos borrados.
- `initializePayment` / `createReservation`: **no filtrar en el `findMany`** (hace falta `seat.code`
  para el mensaje de error). En su lugar, check explícito:
  ```ts
  const deleted = seatStatuses.filter((ss) => ss.seat.deletedAt !== null);
  if (deleted.length > 0)
    return { success: false, error: "Algunos asientos ya no existen. Recarga la página." };
  ```
  Inalcanzable en la práctica (la guarda impide borrar con eventos futuros), pero es defensa en
  profundidad gratis.

**`saveBlockedSeats`** — tres arreglos, ya que se está tocando:
- envolver los dos `updateMany` en `$transaction` (hoy hay una ventana en la que **todo** está
  desbloqueado);
- el primero (liberar `BLOCKED`) se queda igual: liberar la fila de un asiento borrado es inocuo;
- el segundo: si `res.count !== seatIdsToBlock.length` → *"Algunos asientos ya no están disponibles.
  Recarga la página."*

**Reservas antiguas con asientos borrados.** Un asiento borrado que formaba parte de una reserva
histórica **desaparece del dibujo**, y `highlightedSeatIds`
(`reservas/[id]/[reservationId]/page.tsx:46`) contendrá un id que no se pinta. La lista textual
(línea 47) y el PDF sí lo siguen mostrando. Para que la dueña no llame diciendo "faltan asientos en
el dibujo", añadir bajo el mapa —unas 6 líneas— cuando falte alguno:

> *"N asiento(s) de esta reserva ya no existen en el plano: X, Y."*

---

## Paso 5 — UI del editor

### `src/app/admin/(dashboard)/asientos/page.tsx`

Comprobación de rol (arriba), y tercera consulta en el `Promise.all` de la línea 7:

```tsx
const [seats, zoneLabels, activeEvents] = await Promise.all([
  getAllSeats(), getZoneLabels(), getActiveEventSummary(),
]);
```

Actualizar también el subtítulo de la cabecera (línea 26), que ya no describe la vista:
*"Arrastra los asientos para posicionarlos"* → *"Toca un asiento para editarlo · arrastra para
moverlo"*. Y el de la tarjeta del dashboard (`src/app/admin/(dashboard)/page.tsx:58`).

### `src/app/admin/(dashboard)/asientos/client.tsx`

#### Pointer Events en lugar de mouse + touch duplicados

El drag actual duplica literalmente la misma matemática en `handleMouseMove` y `handleTouchMove`
(líneas 57-141). Se unifica en **Pointer Events**, que además resuelve dos problemas reales:

- `e.preventDefault()` en `onTouchStart` de React 19 **no es fiable** (listeners delegados/passive),
  y el `touchend` genera un `mousedown` sintético ~300 ms después que **reabriría el modal** (ghost
  click). Se sustituye por `touch-action: none` en CSS (`className="... touch-none"`).
- `setPointerCapture` hace innecesario rastrear `touches[0]` por `identifier`: el segundo dedo o la
  palma nunca llegan como si fueran el mismo puntero.

```ts
const dragRef = useRef<{ seatId: string; startX: number; startY: number;
                         moved: boolean; pointerType: string } | null>(null);
const DRAG_THRESHOLD_MOUSE = 6;   // px — ~20% del diámetro del asiento (26-31 px)
const DRAG_THRESHOLD_TOUCH = 10;  // px — el dedo tiembla mucho más
```

- **`onPointerDown` en el asiento:** `e.currentTarget.setPointerCapture(e.pointerId)`, guardar
  `{ seatId, startX: e.clientX, startY: e.clientY, moved: false, pointerType: e.pointerType }`,
  `setDraggingSeat(id)`. **Sin `preventDefault`.**
- **`onPointerMove` en el contenedor** (los eventos capturados burbujean hasta él, así que sigue
  funcionando fuera del lienzo): si `!moved`, calcular `Math.hypot(clientX - startX, clientY - startY)`;
  si `< umbral` → **`return` sin tocar posiciones ni `hasChanges`**. Al superarlo, `moved = true` y a
  partir de ahí el arrastre funciona con el cálculo actual (`rect`, clamp [2,98], `Math.round`).
- **`onPointerUp` en el contenedor:** si `dragRef.current && !moved` → **es un click**:
  `setSelectedSeatId(id)` + abrir modal. Limpiar ref y `draggingSeat`.
- **`onPointerCancel` en el contenedor:** limpiar **sin** abrir modal.

> **Por qué `pointercancel` separado de `pointerup` importa:** hoy el contenedor tiene
> `onMouseLeave={handleMouseUp}` (línea 223). Sin separarlos, sacar el ratón del lienzo sin haber
> superado el umbral **abriría el modal**. Y en móvil, cualquier interrupción del sistema haría lo
> mismo.

Se eliminan `onMouseDown/Move/Up/Leave` y `onTouchStart/Move/End`. Lo mismo para las etiquetas de
zona (`draggingLabel`), que sólo necesitan `pointerdown` con `stopPropagation`.

Resultado en táctil: tap = modal, tap largo sin mover = modal, arrastrar > 10 px = mover, y el plano
no hace scroll de página mientras se arrastra.

**Efecto secundario positivo:** el umbral elimina los micro-desplazamientos accidentales de 1 % que
hoy ensucian el plano al intentar sólo mirar un asiento.

#### Resaltado amarillo

```tsx
selectedSeatId === seat.id && "bg-[#D4AF37] border-[#b8972e] ring-2 ring-white scale-125 z-30"
```

El dorado `#D4AF37` es el color de marca y no colisiona con ninguno de los que ya usan los mapas
(verde disponible, azul seleccionado, rojo ocupado, gris bloqueado). Si sobre el plano resulta poco
llamativo, `bg-[#facc15] border-[#eab308]` es una línea.

#### Los dos modales

**Modal de edición** (click en un asiento) y **modal de creación** (botón "Crear asiento" junto a
Guardar, icono `Plus` de `lucide-react`). Ambos reutilizan **el markup del modal de CONDICIONES de
`src/app/eventos/[id]/client.tsx:145-179`** — overlay `fixed inset-0 z-[200] bg-black/80`, tarjeta
`bg-[#1a1a1a] rounded-2xl border border-white/10`, `Button` dorado — **no** el `Dialog` de
`src/components/ui/dialog.tsx`, que está sin estrenar y cuyo `bg-background` choca con el negro/oro.
Input nativo con las clases del proyecto (no existe `components/ui/input.tsx`).

- **Edición:** input con el nombre, botón "Guardar nombre", y abajo separado un botón destructivo
  "Eliminar asiento" que cambia el contenido del modal a una confirmación en dos pasos
  (*"¿Eliminar {code}? Los eventos ya creados no se ven afectados"* / Cancelar / Eliminar).
  **No usar `confirm()` nativo**: bloquea el hilo y desentona.
- **Creación:** input vacío, botón "Añadir" deshabilitado con el nombre vacío.
- El error que devuelve la action (duplicado, charset, longitud, eventos activos) se pinta **dentro
  del modal**, que **no se cierra**.

#### Persistencia: inmediata para lo estructural, agrupada para las posiciones

Crear, renombrar y eliminar escriben en base de datos **al instante** — es lo que describe la UX
pedida ("al hacer click en Añadir, aparece en la esquina inferior izquierda") y es lo único que
permite validar unicidad y guarda en el servidor en el momento de escribir. Las posiciones siguen
bajo "Guardar", como hoy.

*(Se descartó acumular todo hasta Guardar: exigiría un motor de diff en cliente, ids temporales que
mapear a cuids reales, y resolver colisiones transitorias de nombres —renombrar A→B y B→A en el
mismo lote—. Y un fallo de servidor haría caer los cinco cambios sin decir cuál.)*

**La regla que elimina todo el problema de coherencia de estado:**

> Las tres operaciones estructurales **requieren `hasChanges === false`**. "Crear asiento" y los
> botones del modal se deshabilitan con el texto *"Guarda primero los cambios de posición"*.

Con eso nunca hay conflicto entre estado sucio y refresco. Mecánica tras cada operación:

1. la action devuelve `{ success, seat?, error? }` con el `Seat` real (cuid incluido);
2. mutación optimista local (`append` / `map` / `filter`);
3. `router.refresh()`;
4. resincronización por props con el patrón oficial de React (**no** `useEffect`):

```ts
const [serverSeats, setServerSeats] = useState(seats);
if (seats !== serverSeats) {          // durante el render, sin efecto
  setServerSeats(seats);
  setPositions(toPositions(seats));
  setHasChanges(false);
}
```

Esto es imprescindible porque el `useState` inicial de `positions` (línea 30) **no resincroniza
cuando cambian las props**. Al crear, la posición inicial ya se persiste en BD (la esquina), así que
resincronizar es inocuo. Y como arrastrar el asiento nuevo pone `hasChanges = true`, la dueña está
obligada a colocarlo y guardar antes de crear el siguiente: **eso, más los `NEW_SEAT_SLOTS`, es lo
que impide que se apilen**.

**No añadir `revalidatePath`:** todas las páginas implicadas son dinámicas (usan `cookies()` vía
`getSessionData`, o `params`), no hay Full Route Cache que invalidar, y el repo no lo usa en ningún
sitio. `router.refresh()` basta.

**Sustituir `alert()` por feedback inline** (banner verde de 3 s). Un `alert()` bloquea el hilo.

Consecuencia a documentar en el texto de ayuda de la vista: *el nombre se guarda al momento; la
posición, al pulsar Guardar*.

#### Banner de bloqueo

Si `activeEvents.count > 0`, banner ámbar (`bg-[#92700c]/20 border border-[#D4AF37]/40`) sobre el
lienzo:

> ⚠️ Hay 3 eventos próximos (el primero: Valencia vs Betis, sáb 23 ago). Puedes mover los asientos
> de sitio, pero para crear, renombrar o eliminar hay que esperar a que pasen o cancelarlos.

…"Crear asiento" `disabled`, y el modal de edición abriéndose en modo sólo lectura (sin input
editable ni botón Eliminar). El servidor lo revalida igualmente.

#### "Resetear" → "Descartar cambios"

Hoy "Resetear" *funciona por accidente*: el seed puso `id === code` (T8), así que
`DEFAULT_SEAT_POSITIONS.find(d => d.id === pos.id)` acierta. En cuanto haya un asiento con cuid o un
renombrado, el mapeo pierde el sentido: devolvería los 47 viejos a su sitio, ignoraría los nuevos, y
un `T1-A1` renombrado a `Barra1` saltaría a la posición vieja de `T1-A1`. Inexplicable para la
dueña.

Mismo icono `RotateCcw`, mismo `disabled={!hasChanges}`, comportamiento nuevo:

```ts
setPositions(toPositions(seats));   // props del servidor
setLabels(zoneLabels);
setHasChanges(false);
```

- **Borrar `DEFAULT_SEAT_POSITIONS`** de `constants.ts` y su import en `client.tsx`. **No tocar
  `DEFAULT_ZONE_LABEL_POSITIONS`**: lo usan `getZoneLabels` y `floor-plan-view.tsx:17` como fallback.
- Renombrar "Guardar" → **"Guardar posiciones"** (ahora hay cosas que se guardan solas).
- Texto de instrucciones al pie: *"Arrastra los asientos para colocarlos. Toca uno para renombrarlo
  o eliminarlo."*

#### Aviso de cambios sin guardar

Con `hasChanges === true`, un `useEffect` con `beforeunload`: ahora hay más motivos que antes para
navegar fuera a medias y perder un plano recolocado.

---

## Paso 6 — Los tres bugs de dinero (T5, T6, T7)

**Estos ya existen hoy en producción.** Van en el PR 1.

En `src/modules/payments/actions/index.ts`:

```ts
// T7 — el cliente puede mandar ids repetidos: hoy cobraría 3 y reservaría 2.
const uniqueSeatIds = [...new Set(data.seatIds)];
```
…y usar `uniqueSeatIds` en todo el resto, incluidos `numberOfSeats` y `totalPrice`.

```ts
// T5 — sin esto, un asiento sin fila SeatStatus se cae del filtro y produce una
// reserva con numberOfSeats = N pero sólo N-1 asientos marcados: cobrado y no reservado.
if (seatStatuses.length !== uniqueSeatIds.length) {
  return { success: false, error: "Algunos asientos ya no están disponibles. Recarga la página." };
}
```

```ts
// T6 — la carrera. El filtro de status es lo que faltaba.
const updated = await tx.seatStatus.updateMany({
  where: { eventId, seatId: { in: uniqueSeatIds }, status: "AVAILABLE" },
  data: { status: "RESERVED", reservationId: newReservation.id },
});
if (updated.count !== uniqueSeatIds.length) throw new Error("SEAT_RACE");
```
Capturar el throw fuera y devolver *"Algunos asientos acaban de ser reservados. Recarga la página."*
La transacción revierte la `Reservation` sola.

**Mismo patrón exacto en `src/modules/reservations/actions/index.ts`**: aserción tras las líneas
91-99, y `status: "AVAILABLE"` + check de `count` en el `updateMany` de la línea 133 (que pasa a
`OCCUPIED`).

---

## Paso 7 — Neutralizar el seed y limpiar código muerto

### `prisma/seed.ts`

Dos cambios en el bloque de asientos (líneas 16-81):

```ts
// El plano se gestiona desde /admin/asientos desde agosto 2026: se pueden crear,
// renombrar y borrar (lógicamente) asientos. Re-sembrar aquí resucitaría los 47
// originales y chocaría con Seat_code_key en cuanto alguno hubiera sido renombrado.
// Este bloque sólo actúa sobre una base de datos virgen (prisma migrate reset).
const existingSeats = await prisma.seat.count();
if (existingSeats > 0) {
  console.log(`ℹ️  Ya hay ${existingSeats} asientos. El plano se gestiona desde /admin/asientos. Se omite la siembra.`);
} else {
  // ... createMany ...
}
```

`count()` **sin** filtrar `deletedAt`: si hay filas, no escribir nunca.

Y **cambiar el `upsert where: { id }` por un `createMany`, quitando el campo `id`** de las 47
entradas (que Prisma genere cuid). El `upsert` sobre una BD poblada haría `create` con un id
inexistente y chocaría con `Seat_code_key`. Esto **sólo afecta a bases nuevas**: los ids "bonitos"
de producción se quedan como están (T8). El bloque de `adminUser` no se toca.

### Código muerto

Ahora que las zonas dejan de tener sentido, conviene retirar lo que las da por vivas:

- `src/modules/seating/components/seat.tsx` y `seat-map.tsx` — exportados desde el barrel
  `components/index.ts` pero **sin ningún importador** fuera del módulo. `seat-map.tsx:14-18`
  hardcodea un `{ PROJECTOR, TV1, TV2 }` exhaustivo de precios por zona que ya no existe.
- `getSeatsByZone` (`seating/actions/index.ts:131-153`) — sin llamantes, con un cast inseguro.
- `ZONE_LABELS`, `ZONE_DESCRIPTIONS`, `ZoneInfo`, `SeatMapProps`
  (`src/modules/seating/types/index.ts:9-33`) — sólo los consumían esos dos componentes.

Mantener `SeatWithStatus` y los `export type` de la línea 3: los usa todo el módulo.

---

## Secuencia de PRs

**PR 1 — Migración y saneamiento del backend.** Desplegable sola: es puro bug-fix y no cambia nada
visible.
Migración SQL · `schema.prisma` · `lib/seat-status.ts` · `lib/active-events.ts` ·
`getSeatsForEvent` desde `SeatStatus` · borrar `initializeSeatsForEvent` y `getSeatsByZone` · quitar
la llamada de `eventos/[id]/page.tsx` · `createEvent` en transacción · `createEventFromSuggestion`
con el helper · backfill en el cron · `updateSeatPositions` y `saveBlockedSeats` endurecidos · los
tres bugs de dinero del Paso 6 · seed neutralizado.

**PR 2 — CRUD y UI.**
`createSeat` / `renameSeat` / `deleteSeat` · `requireAdmin` en la página y en las actions ·
`client.tsx` (Pointer Events, selección amarilla, dos modales, banner, "Descartar cambios") ·
borrar `DEFAULT_SEAT_POSITIONS` · `seatsPerLine` defensivo en el PDF · nota de asientos ausentes en
el detalle de reserva.

**PR 3 — Limpieza.** Opcional, para no ensuciar el diff anterior.
Borrar `seating/components/seat.tsx`, `seat-map.tsx` y los tipos de zona · actualizar `CLAUDE.md`
(modelo `Seat` con `deletedAt`, carpeta nueva `seating/lib/`, y la nota de que el plano es editable)
y la sección "### 8. Editor de Asientos" de `DEVELOPMENT.md`.

---

## Ficheros afectados

| Fichero | Cambio |
|---|---|
| `prisma/migrations/20260817120000_add_seat_deleted_at/migration.sql` | **Nuevo** — `deletedAt` + backfill de `SeatStatus` |
| `prisma/schema.prisma` | `deletedAt DateTime?` y `@@index([deletedAt])` en `Seat` |
| `prisma/seed.ts` | Guarda `count() > 0` + `createMany` sin `id` |
| `src/modules/seating/lib/seat-status.ts` | **Nuevo** — `ensureSeatStatusesForEvent` / `ForSeat` |
| `src/modules/seating/lib/active-events.ts` | **Nuevo** — `getActiveEventSummary`, `assertSeatStructureEditable` |
| `src/modules/seating/actions/index.ts` | **Núcleo** — 3 actions nuevas, `getSeatsForEvent` reconstruida, filtros, endurecimientos, borrar 2 funciones |
| `src/modules/seating/constants.ts` | Constantes del código; borrar `DEFAULT_SEAT_POSITIONS` |
| `src/app/admin/(dashboard)/asientos/page.tsx` | Guarda de rol, tercera consulta, subtítulo |
| `src/app/admin/(dashboard)/asientos/client.tsx` | **Núcleo** — Pointer Events, selección, modales, banner |
| `src/app/eventos/[id]/page.tsx` | Quitar la llamada a `initializeSeatsForEvent` |
| `src/modules/events/actions/index.ts` | Helper + `$transaction` |
| `src/modules/football-data/actions/index.ts` | Helper dentro del `$transaction` existente |
| `src/modules/payments/actions/index.ts` | Dedupe, aserción de longitud, `status: "AVAILABLE"` en el `updateMany` |
| `src/modules/reservations/actions/index.ts` | Mismo patrón |
| `src/app/api/cron/cleanup/route.ts` | Backfill diario de `SeatStatus` |
| `src/app/reserva/confirmacion/[orderId]/client.tsx` | `seatsPerLine` defensivo + `seatsHeight` |
| `src/app/admin/(dashboard)/reservas/[id]/[reservationId]/page.tsx` | Nota de asientos ausentes |
| `src/modules/seating/{components,types}` | Borrar código muerto |
| `CLAUDE.md`, `DEVELOPMENT.md` | Documentación |

---

## Fuera de alcance (decidido)

- **Versionado del plano por evento.** Descartado a favor de la guarda; requeriría tablas nuevas y
  tocar el flujo público de reserva.
- **Las etiquetas TV1 / TV2 / PROYECTOR del plano se quedan tal cual.** Son filas `ZoneLabel`,
  independientes de `Seat.zone`: siguen indicando al cliente qué pantalla mira cada zona del local.
  Si la dueña también quiere retirarlas, es un cambio aparte y pequeño.
- **`Event.screens`** (badges de las tarjetas de evento) es cosmético y no filtra asientos. No se
  toca.
- **Hacer `zone` / `number` nullable.** Se rellenan con valores por defecto y desaparecen de la UI.
- **`Seat.capacity`** está en el esquema y no lo lee nadie en `src/`.
- **Informe PDF mensual** — sólo agrega `numberOfSeats`.
- **Guarda por asiento en vez de global** (ver Paso 1). Se deja el hueco preparado.
- **Sacar `expireStaleReservations` del GET público.** Candidato claro si vuelve la presión de pool.
- **T9 (renombrar reescribe el pasado).** Se documenta y se asume.

---

## Verificación

> ⚠️ **`.env` apunta a PRODUCCIÓN** (~325 reservas reales, pagos Redsys en vivo). **Este trabajo sí
> lleva migración**, así que el despiste es más caro que en los planes anteriores.

### Fase 0 — antes de nada

```bash
npx tsx scripts/db-whoami.ts        # ¿qué proyecto Supabase tengo activo?
set -a && . ./.env.testing && set +a
npx tsx scripts/db-whoami.ts        # confirmar que AHORA es testing
```

Anotar nº de asientos, eventos y reservas. **Si el ref no es el de testing, parar.**

### Fase 1 — migración en testing

1. `npx prisma migrate deploy` + `npx prisma migrate status`.
2. En `prisma studio`: `Seat.deletedAt` existe y es `NULL` en las 47 filas.
3. Consistencia (debe dar 0):
   ```sql
   SELECT count(*) FROM "Event" e CROSS JOIN "Seat" s
   LEFT JOIN "SeatStatus" ss ON ss."eventId" = e.id AND ss."seatId" = s.id
   WHERE ss.id IS NULL;
   ```
4. Anti-regresión de dinero (debe dar 0 filas):
   ```sql
   SELECT r.id, r."numberOfSeats", count(ss.id) FROM "Reservation" r
   LEFT JOIN "SeatStatus" ss ON ss."reservationId" = r.id
   WHERE r.status = 'CONFIRMED' GROUP BY r.id
   HAVING count(ss.id) <> r."numberOfSeats";
   ```
   *Si sale algo, son las víctimas históricas de T5/T6 — documentarlas, no tocarlas.*
5. `npx prisma generate` (**dev server parado**: en Windows el `.dll.node` queda bloqueado) y
   `npm run build`.

### Fase 2 — funcional en Preview (testing)

1. Entrar como **WORKER** a `/admin/asientos` → debe redirigir a `/admin`.
2. Como ADMIN, con eventos futuros cargados: banner ámbar visible, "Crear asiento" deshabilitado,
   **arrastrar y "Guardar posiciones" sí funcionan**.
3. Invocar `createSeat` desde la consola del navegador saltándose el `disabled` → debe fallar con el
   error de guarda. **El servidor no se fía del cliente.**
4. Cancelar o atrasar los eventos futuros de testing. Recargar: banner fuera, botones activos.
5. **Crear:** "Barra1" aparece abajo a la izquierda → arrastrar → Guardar → recargar → sigue ahí.
   Intentar crear un segundo con cambios sin guardar → bloqueado con el mensaje correcto.
6. **Validaciones:** nombre vacío, `Barra 1` (espacio), `Barra€`, 11 caracteres, y `barra1`
   duplicando `Barra1` → los cinco rechazados, con el error **dentro** del modal, sin cerrarlo.
7. **Renombrar** `T1-A1` → `Mesa/Alta.2` → el plano público y el detalle de reserva histórico
   muestran el nombre nuevo (esto es T9 en acción: confirmar que es asumible).
8. **Eliminar** "Barra1" → confirmación en dos pasos → desaparece del plano y de `/eventos/[id]`.
   Abrir una reserva antigua que lo incluía: **el código sigue en el listado de texto y en el PDF**,
   y aparece la nota de "asientos que ya no existen en el plano".
9. **Resucitar:** volver a crear "Barra1" → debe **revivir** la misma fila (mismo `id`, `deletedAt`
   a `NULL` en `prisma studio`), no dar `P2002` ni duplicar. Luego intentar **renombrar** otro
   asiento a un nombre borrado → error explicativo, sin reventar.
10. **Click vs drag (escritorio):** click seco abre modal; arrastre de 3 px **no** abre modal ni
    marca cambios; arrastre real mueve; salir del lienzo arrastrando **no** abre modal.
11. **Click vs drag (móvil real, no el emulador de Chrome):** tap abre modal, arrastre mueve **sin
    hacer scroll de la página**, y tras un arrastre **no** se abre el modal por ghost click. Es
    donde el trabajo de Pointer Events se gana el sueldo.
12. **Fan-out:** crear un evento nuevo → `SELECT count(*) FROM "SeatStatus" WHERE "eventId"='…'` =
    nº de asientos vivos. Crear un asiento → +1 en cada evento vivo, y **0 en los pasados**.
13. **Backfill del cron:** `curl -H "Authorization: Bearer $CRON_SECRET" .../api/cron/cleanup` →
    responde con el contador (0 si todo está sano).
14. **Bloqueo de asientos:** `/admin/reservas/[id]/bloquear` con un asiento recién creado → se
    bloquea y se ve gris en la vista pública.
15. **Pago end-to-end en sandbox:** 3 asientos, uno creado hoy → tarjeta `4548 8100 0000 0003`
    (`12/27`, CVV `123`, CIP `123456`) → el ticket lista los 3 códigos y `numberOfSeats = 3`.
    Repetir con un código de 10 caracteres y comprobar que **el PDF no se sale del papel ni tapa el
    QR**.
16. **Aserción de pago:** seleccionar asientos, eliminar uno desde otra pestaña, pulsar RESERVAR →
    error claro y **ninguna reserva PENDING creada**.
17. **Descartar cambios:** mover 5 asientos → "Descartar cambios" → vuelven a la posición del
    servidor y el contador queda "Sin cambios".
18. **Seed:** `npm run db:seed` contra testing tras haber renombrado → mensaje de "se omite la
    siembra" y **cero cambios** en `Seat`.
19. `npm run build` y `npm run lint` limpios (el borrado de código muerto puede dejar imports
    huérfanos).
20. **Dejarlo unos días en `testing`.** La dueña aplica el listado alfanumérico completo desde el
    editor y confirma que la nomenclatura le cuadra con el local.

### Fase 3 — producción

1. `.env` activo → `npx tsx scripts/db-whoami.ts` → confirmar ref de **producción** y que los
   contadores cuadran con lo anotado.
2. **Backup / snapshot** del proyecto Supabase de producción.
3. **`npx prisma migrate deploy` PRIMERO**, y sólo después merge `testing` → `main` para que Vercel
   despliegue el código.
   > **El orden migración-antes-que-código es crítico.** La columna es aditiva y el código viejo la
   > ignora sin problema, pero el `getSeatsForEvent` con inner join necesita que el backfill ya esté
   > hecho, o los planos de los eventos afectados aparecerían **incompletos** para los clientes.
   > Migración → código, nunca al revés.
4. Repetir las consultas 3 y 4 de la Fase 1 contra producción.
5. Humo: abrir un `/eventos/[id]` real (plano completo, sin asientos fantasma), el detalle de una
   reserva antigua (códigos correctos), y `/admin/asientos` (banner de bloqueo activo, porque habrá
   eventos futuros).
6. Vigilar los logs de Vercel 24 h buscando `SEAT_RACE` y errores de pool.
7. Elegir una franja **sin eventos futuros publicados** para hacer el renombrado en producción.

**Nunca** `prisma migrate dev` ni `npm run db:seed` con el `.env` de producción activo.
