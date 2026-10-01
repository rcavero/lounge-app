# 0002 · Importes en céntimos enteros, desglose congelado en la reserva y `CHECK` en la base

**Estado:** vigente · **Fecha:** agosto de 2026 · **Plan:** [`PLAN_GASTOS_GESTION.md`](../historico/PLAN_GASTOS_GESTION.md)

## Contexto

Hasta agosto de 2026 el importe de una reserva era `asientos × precio del asiento`, y todo era
descontable en consumiciones. El bar empezó a cobrar unos **gastos de gestión por asiento que no
son descontables**. La camarera necesita saber, reserva a reserva, cuánto de lo pagado puede
descontar.

Había además un problema de fondo: si el ticket y el panel recalculaban el desglose leyendo el
evento, editar el precio de un evento reescribía el de las reservas ya cobradas.

## Decisión

1. **Todo el dinero nuevo en céntimos enteros.** `Event.managementFeeCents`,
   `Reservation.seatPriceCents` y `Reservation.managementFeeCents` son enteros. El importe se
   calcula en `payments/domain/amount.ts`: `(precio × 100 + gastos) × asientos`.
2. **La reserva congela lo que pagó.** Al crearla se copian el precio y los gastos unitarios del
   evento, y el ticket y el panel leen siempre de la reserva.
3. **Un `CHECK` en la base** (`reservation_total_matches_breakdown`) obliga a que
   `totalPrice × 100 = (seatPriceCents + managementFeeCents) × numberOfSeats`.
4. **Las dos columnas del desglose no tienen valor por defecto**, así que Prisma obliga a
   rellenarlas en cada reserva nueva.
5. **Los gastos solo admiten valores fijos**: de 0 a 5 € en pasos de 0,50 €, validados en el
   servidor.

## Alternativas descartadas

- **Seguir con decimales.** Los múltiplos de 0,50 € son exactos en coma flotante, así que el
  problema no era la precisión. El motivo real es que **Redsys exige el importe como un entero de
  céntimos**, y que en céntimos el desglose nunca depende de una división.
- **Recalcular el desglose desde el evento.** Es más simple, pero reescribe el pasado cada vez
  que alguien edita un evento.
- **Cambiar `totalPrice` a `Decimal(10,2)`.** Era cambiar el tipo de una columna con reservas
  reales dentro, sin ganar nada: el `CHECK` ya ata el total al desglose.

## Consecuencias

- **Un total que no cuadra no puede existir**, venga del código que venga. Los tests de
  integración corren contra una base con el `CHECK` y comprueban que rechaza un total
  descuadrado.
- **El `CHECK` vive en SQL crudo dentro de la migración**, no en `schema.prisma`. Con
  `prisma db push` no se crea, y por eso esa orden no se usa contra ninguna base con datos.
- **La migración no era compatible hacia atrás.** Quitar el valor por defecto a dos columnas
  `NOT NULL` impedía al código viejo crear reservas entre migrar y desplegar. Se hizo sin
  eventos abiertos, y el procedimiento de migración de [`entornos.md`](../entornos.md) lo
  recoge como ejemplo.
- `totalPrice` sigue siendo `Decimal` en euros, por herencia. Se convierte a `Number` antes de
  enviarlo al navegador.
- `scripts/verify-management-fee.ts` tiene dos modos: `precheck` busca, antes de migrar, las
  reservas que el `CHECK` rechazaría, y `report` comprueba después que todas cuadran. Se usa
  también tras cada cambio en el camino del pago.
