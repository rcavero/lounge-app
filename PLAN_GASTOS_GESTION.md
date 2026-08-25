# Gastos de gestión por reserva

> **Estado: implementado en la rama `testing`** (migración aplicada a la BD de testing el
> 2026-08-25). Pendiente: validación en uso real y el paso a producción descrito al final.

## Contexto

Hasta ahora el importe de una reserva era exactamente `nº asientos × Event.pricePerSeat`, y ese
total era **íntegramente descontable en consumiciones**: es lo que dice el punto 3 de las
condiciones y lo que la camarera aplica en barra.

Se empieza a cobrar unos **gastos de gestión por asiento** que **no son descontables**. Eso obliga a
tres cosas que antes no existían:

1. Que el importe cobrado deje de ser un múltiplo del precio del asiento (Redsys, `totalPrice`).
2. Que el cliente lo sepa **antes** de pagar (condiciones de la reserva).
3. Que quede constancia del **desglose** en el ticket y en el admin, porque la camarera necesita
   saber cuánto de lo pagado es descontable y cuánto no.

El punto 3 es el que marca el diseño: el desglose tiene que sobrevivir a que alguien edite el evento
después. Por eso el importe unitario cobrado se **congela en la propia reserva** en el momento del
pago, y las vistas nunca lo recalculan desde el evento.

## Decisiones

| Decisión | Elegido |
|---|---|
| Gastos por defecto | 1,50 €/asiento, editable de 0 € a 5 € en pasos de 0,50 € |
| Eventos **ya existentes** | 0 € — solo los eventos nuevos nacen con 1,50 € |
| Qué ve el cliente al seleccionar asientos | Solo el TOTAL (ya con gastos incluidos) + nota pequeña |
| Informe mensual PDF | Fuera de alcance |

---

## Modelo de datos

Todo el dinero nuevo se guarda en **céntimos enteros**. No es por miedo al coma flotante (los
múltiplos de 0,50 son exactos en IEEE-754), sino porque el importe que se firma para Redsys **tiene
que ser un entero de céntimos** y porque así el desglose no depende nunca de una división.

```prisma
model Event {
  pricePerSeat       Int @default(10)  // Precio por asiento en euros
  managementFeeCents Int @default(150) // Gastos de gestión por asiento, en céntimos
}

model Reservation {
  numberOfSeats      Int
  totalPrice         Decimal
  seatPriceCents     Int // Snapshot: precio por asiento cobrado
  managementFeeCents Int // Snapshot: gastos de gestión por asiento cobrados
}
```

Los dos campos de `Reservation` van **sin `@default`** a propósito: así el cliente Prisma obliga a
rellenarlos en cada `create` y una reserva sin desglose deja de ser representable.

**Invariante, garantizado por un `CHECK` en la base de datos:**

```
totalPrice × 100 = (seatPriceCents + managementFeeCents) × numberOfSeats
```

### Migración `20260825120000_add_management_fee`

Escrita a mano (la que genera Prisma pondría `DEFAULT 150` y **subiría el precio de los eventos ya
publicados**). Hace, en este orden:

1. `Event.managementFeeCents` con `DEFAULT 0` → los eventos existentes se quedan a 0 €.
2. Cambia el default a `150` → los eventos nuevos nacen con 1,50 €.
3. `Reservation.seatPriceCents` / `managementFeeCents` con `DEFAULT 0`.
4. Backfill: `seatPriceCents = ROUND(totalPrice * 100 / numberOfSeats)` en las reservas históricas.
5. Retira los dos `DEFAULT`.
6. Añade el `CHECK`.

---

## Qué cambió, por fichero

| Fichero | Cambio |
|---|---|
| `src/modules/events/config/pricing.ts` *(nuevo)* | Única fuente de verdad: default, lista de opciones, validación y `centsToEuros` |
| `src/lib/utils.ts` | `formatEuros(34.5) → "34,50"`, el formateo que estaba repetido en 6 sitios |
| `src/modules/events/actions/index.ts` | `create/updateEvent` aceptan `managementFeeCents` **validado contra la lista** (un valor arbitrario aquí sería un cobro real) |
| `src/app/admin/(dashboard)/eventos/[id]/client.tsx` | `<select>` con las 11 opciones (no caben como píldoras) + aviso de que solo afecta a reservas nuevas |
| `src/modules/payments/actions/index.ts` | Importe en céntimos enteros; guarda el snapshot; `ReservationTicketData` lo expone |
| `src/modules/reservations/actions/index.ts` | `createReservation` (alta manual) con el mismo criterio |
| `src/shared/hooks/use-reservation-store.ts` | El total del cliente ya incluye los gastos |
| `src/app/eventos/[id]/client.tsx` | Punto 3 de las condiciones dinámico (ES/EN) + nota en el badge |
| `src/app/reserva/confirmacion/[orderId]/client.tsx` | Dos filas de desglose bajo el TOTAL del ticket |
| `src/app/admin/(dashboard)/reservas/[id]/[reservationId]/page.tsx` | Desglose bajo "Total pagado", con la marca *(descontable)* |
| `src/app/api/payments/notify/route.ts` | Traza de auditoría si el importe de Redsys no cuadra (no altera el flujo) |
| `scripts/verify-management-fee.ts` *(nuevo)* | `precheck` antes de migrar, `report` después |

### Texto del punto 3 de las condiciones

- **ES**: *El pago de la reserva supone un consumo mínimo que **será descontado del importe del
  ticket final**, excepto los gastos de gestión de 1,50€/asiento*
- **EN**: *…that **will be deducted from the final ticket amount**, excluding the 1.50€/seat
  management fee*

Con gastos a **0 € el texto vuelve a ser exactamente el de antes**: decir "excepto los gastos de
gestión de 0€/asiento" no tendría ningún sentido. Lo mismo con el ticket: sin gastos no se imprime
el desglose y el PDF sale idéntico al de siempre.

---

## Verificación hecha (2026-08-25, BD de testing)

1. **Pre-check** del `CHECK` sobre las 39 reservas existentes → 0 conflictos.
2. **Backfill**: 58 eventos a 0 €, 39 reservas con su precio unitario reconstruido, 0 divergencias
   entre total y desglose (`scripts/verify-management-fee.ts report`).
3. **Importe firmado para Redsys**, decodificando el `Ds_MerchantParameters` real:

   | Evento | Asientos | Esperado | Firmado |
   |---|---|---|---|
   | 10 € + 1,50 € | 3 | 3450 | ✓ |
   | 10 € + 0,50 € | 7 | 7350 | ✓ |
   | 25 € + 0,00 € | 2 | 5000 | ✓ |
   | 15 € + 5,00 € | 4 | 8000 | ✓ |

4. **El `CHECK` de la BD rechaza** un intento de crear una reserva cuyo total no cuadra.
5. **Página pública**: el modal muestra "excepto los gastos de gestión de 1,50€/asiento" y el badge
   marca `34,50€` con "gastos de gestión incl." para 3 asientos de 10 €.
6. **Ticket PDF con gastos** (texto extraído del PDF real):
   ```
   3 asientos
   TOTAL: 34,50€
   Importe de la reserva: 10,00€ x 3 = 30,00€
   Gastos de gestión: 1,50€ x 3 = 4,50€
   ```
   Lienzo 147 mm (138 + 9) y las filas ocupan 46 mm y 40 mm sobre 70 mm útiles: **el QR conserva su
   margen inferior de 8 mm**.
7. **Ticket sin gastos**: 138 mm y sin filas extra, idéntico al anterior a este cambio.
8. **Snapshot**: con la reserva ya pagada se subieron los gastos del evento a 5,00 € y la reserva
   siguió mostrando 34,50 €.
9. `npx tsc --noEmit` y `npm run build` limpios.

### Pendiente de verificar a mano

- **Pago real en el sandbox de Redsys** con la tarjeta `4548 8100 0000 0003` (`12/27`, CVV `123`,
  CIP `123456`): el importe ya está comprobado sobre el formulario firmado, pero conviene ver la
  pantalla del banco con el importe correcto.
- **Vistas de admin** (selector del evento y desglose del detalle de reserva): requieren sesión.

---

## Paso a producción

1. Dejar `testing` desplegado unos días en uso real.
2. `set -a && . ./.env && set +a` (producción) → `npx tsx scripts/db-whoami.ts` para confirmar el
   proyecto, y `npx tsx scripts/verify-management-fee.ts precheck` **antes de migrar**.
3. Aplicar la migración a producción con `npx prisma migrate deploy`. Es aditiva y compatible hacia
   atrás: el código viejo ignora las columnas nuevas, así que puede aplicarse antes del merge.
4. Merge de `testing` a `main`.
5. **Los eventos ya publicados en producción se quedan a 0 €**: hay que editar a mano los que deban
   empezar a cobrar gastos. Es deliberado — nadie que ya viera un precio publicado paga más por el
   despliegue.

## Fuera de alcance

- **Informe mensual PDF**: sigue mostrando el total cobrado, sin separar los gastos.
- **Formulario de creación de evento**: no lleva el selector (tampoco lleva el de precio). El evento
  nace con 1,50 € y se ajusta editándolo.
- **`Reservation.totalPrice` como `Decimal(10,2)`**: cambiar el tipo de una columna con reservas
  reales dentro no aporta nada aquí.
- **`createReservation` recibe `pricePerSeat` del cliente** (eco del hallazgo de
  `AUDITORIA_SEGURIDAD_ABRIL_2026.md` que sí se corrigió en payments). Se mantiene: es código sin
  llamantes y arreglarlo es otro trabajo.
