# Plan: Protección contra solapamiento de eventos

## Problema

Cuando dos eventos se solapan en el tiempo (o comienzan a la misma hora en diferentes pantallas), los asientos se pueden reservar de forma independiente en cada evento. Esto provoca que un mismo asiento físico pueda estar asignado a dos personas distintas al mismo tiempo.

Actualmente:
- `getSeatsForEvent()` solo consulta los `SeatStatus` del evento solicitado.
- `initializePayment()` solo valida disponibilidad dentro de ese mismo evento.
- Dos eventos simultáneos tienen tablas `SeatStatus` completamente independientes.

---

## Diseño de la solución

**Principio:** el solapamiento se calcula dinámicamente en tiempo de consulta. No se crean registros extra en la base de datos — al leer los asientos de un evento, también se leen los estados de los eventos solapados y se combinan en memoria.

---

## Pasos de implementación

### Paso 1 — Añadir duración al evento (`durationMinutes`)

Añadir campo al modelo `Event` en `prisma/schema.prisma`:

```prisma
model Event {
  ...
  durationMinutes Int @default(120)  // duración estimada del evento en minutos
}
```

Valores típicos por deporte:
- 60 min — tenis, billar, dardos
- 90 min — fútbol, rugby, baloncesto
- 120 min — por defecto genérico
- 180 min — F1, Moto GP
- 240 min — eventos especialmente largos

**Por qué no usar una ventana fija:** un partido de 90 min y una carrera de F1 de 3h tienen solapamiento real muy diferente. Con `durationMinutes` la detección es exacta.

Aplicar la migración con:
```bash
npx prisma db push
npx prisma generate
```

Todos los eventos existentes quedarán con `durationMinutes = 120` (valor por defecto razonable).

---

### Paso 2 — Función de detección de solapamiento

En `src/modules/seating/actions/index.ts`, añadir función privada:

```ts
async function getOverlappingEventIds(
  excludeEventId: string,
  eventDate: Date,
  durationMinutes: number
): Promise<string[]>
```

Dos eventos A y B se solapan si:
```
A.start < B.start + B.duration  AND  B.start < A.start + A.duration
```

La query busca eventos con status `UPCOMING` o `LIVE` (ignorar `FINISHED` y `CANCELLED`), excluyendo el propio evento.

---

### Paso 3 — Modificar `getSeatsForEvent()`

Archivo: `src/modules/seating/actions/index.ts`

Lógica actualizada:
1. Obtener el evento (para conocer su `eventDate` y `durationMinutes`).
2. Obtener IDs de eventos solapados con `getOverlappingEventIds()`.
3. Obtener `SeatStatus` propios del evento (igual que ahora).
4. Obtener `SeatStatus` de eventos solapados donde `status IN [RESERVED, OCCUPIED]`.
5. Combinar: si un asiento está `AVAILABLE` en el evento propio pero `RESERVED`/`OCCUPIED` en algún solapado → devolver como `OCCUPIED`.
6. Los `BLOCKED` del evento propio se mantienen como `BLOCKED`.

La función devuelve el mismo tipo `SeatWithStatus[]` — el cliente no necesita ningún cambio.

---

### Paso 4 — Modificar `initializePayment()` (doble validación)

Archivo: `src/modules/payments/actions/index.ts`

Antes de crear la reserva, validar dos condiciones:
1. Los asientos están `AVAILABLE` en el **evento propio** (ya existe).
2. Los asientos **no** están `RESERVED`/`OCCUPIED` en ningún evento solapado (nuevo).

Si falla la segunda validación:
```
"Algunos asientos no están disponibles porque están reservados en otro evento simultáneo"
```

Esto cierra la race condition: aunque la UI ya filtra visualmente los asientos ocupados, la validación en servidor es la barrera definitiva.

---

### Paso 5 — Formularios de admin (crear y editar evento)

Archivos:
- `src/app/admin/(dashboard)/eventos/nuevo/client.tsx`
- `src/app/admin/(dashboard)/eventos/[id]/client.tsx`

Añadir selector de duración con opciones predefinidas:
- 60 min (1 h)
- 90 min (1 h 30)
- 120 min (2 h) — seleccionado por defecto
- 180 min (3 h)
- 240 min (4 h)

---

### Paso 6 — Actualizar acciones de eventos

Archivo: `src/modules/events/actions/index.ts`

Las funciones `createEvent` y `updateEvent` deben aceptar y persistir el campo `durationMinutes`.

---

## Archivos a modificar

| Archivo | Cambio |
|---|---|
| `prisma/schema.prisma` | Añadir `durationMinutes Int @default(120)` a Event |
| `src/modules/seating/actions/index.ts` | `getSeatsForEvent()` con overlap detection; nueva función `getOverlappingEventIds()` |
| `src/modules/payments/actions/index.ts` | `initializePayment()` valida contra eventos solapados |
| `src/modules/events/actions/index.ts` | `createEvent` / `updateEvent` pasan `durationMinutes` |
| `src/app/admin/(dashboard)/eventos/nuevo/client.tsx` | Selector de duración |
| `src/app/admin/(dashboard)/eventos/[id]/client.tsx` | Selector de duración (inicializado con valor del evento) |

---

## Qué NO cambia

- La tabla `SeatStatus` — sin nuevos registros, sin nuevas columnas.
- Las listas de reservas por evento — siguen siendo exclusivas de cada evento.
- El flujo del cliente — ningún cambio visible salvo que los asientos ocupados en eventos solapados aparecen en rojo.
- La vista de bloqueo de admin — muestra el estado efectivo (ya incorporará los solapados automáticamente al usar `getSeatsForEvent()`).

---

## Consideraciones adicionales

- **Cron de expiración:** cuando una reserva PENDING expira y libera asientos, el asiento vuelve a estar disponible automáticamente en ambos eventos, porque la consulta es dinámica. No hay nada que sincronizar.
- **Rendimiento:** la query adicional es muy ligera — hay pocos eventos activos simultáneamente en el local.
- **Eventos FINISHED/CANCELLED:** no se tienen en cuenta para el solapamiento. Un evento cancelado no bloquea asientos de otros eventos.

---

*Redactado: 8 de Abril de 2026*
