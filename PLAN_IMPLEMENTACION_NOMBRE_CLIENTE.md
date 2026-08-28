# Nombre del cliente + recibo de pago Redsys

> **Estado: IMPLEMENTADO en la rama `testing` el 2026-08-28**, sin commitear todavía y sin desplegar.
> El plan se conserva entero porque documenta el *por qué* de cada decisión. Lo que cambió al
> ejecutarlo está al final, en **«Notas de la implementación»** — léelo antes que nada si vienes a
> tocar este código.

Revisión del plan original contra el código de entonces (rama `testing`, HEAD `ac8e166`), ampliada
con lo que pide CaixaBank y con los detalles de maquetación acordados.

---

## 1. Qué ha cambiado desde que se escribió el plan

Revisado fichero a fichero. Nada rompe el plan, pero **cinco puntos concretos han quedado
desactualizados** y uno de ellos invalida la premisa principal:

| Punto del plan | Estado real hoy |
|---|---|
| `customerName: "Cliente"` en `payments/actions/index.ts:94` | Ahora está en la **línea 99**: entre medias se añadió la validación de eventos solapados (`durationMinutes`, líneas 51-88). El sitio donde insertar la validación (junto a la guarda de `seatIds.length === 0`, líneas 24-26) **sigue siendo válido**. |
| `ticketHeight = 98 + seatsHeight + qrSize` | Ahora es `98 + seatsHeight + qrSize + (hasFee ? 9 : 0)` (`confirmacion/[orderId]/client.tsx:48`). El ticket **ya imprime el desglose de gastos de gestión** (líneas 154-180). La fórmula del plan pisaría ese cambio. |
| `ReservationTicketData` | Ya tiene `seatPriceCents` y `managementFeeCents`. |
| Detalle de admin: el nombre en la cabecera | **Se descarta**: ahora va al principio de la tarjeta de resumen, como pediste. Esa tarjeta ya tiene su propio bloque de desglose (líneas 145-159). |
| **«No hace falta migración»** | **Ya no es cierto.** Ver punto 2. |

Lo que sigue igual y el plan acertaba: `Reservation.customerName` es `String` NOT NULL y ya se
escribe, así que **el nombre en sí no necesita migración**; el modal de CONDICIONES
(`eventos/[id]/client.tsx:159-193`) sigue siendo el patrón a copiar; `isSpanish` ya está calculado
(líneas 54-56); y las consultas de admin usan `include` sin `select`, así que `customerName` ya
llega a los componentes.

---

## 2. El hallazgo que cambia el plan: los datos del recibo no existen

CaixaBank pide imprimir el **código de autorización** y la **fecha/hora de la operación**. Hoy:

- Esos datos llegan **solo** dentro de la notificación firmada de Redsys.
- `/api/payments/notify` los decodifica y **los tira**: únicamente lee `Ds_Order` y `Ds_Response`
  (`route.ts:18-19`).
- No hay ninguna columna donde guardarlos.

Con `redsys-easy` confirmado en `node_modules/redsys-easy/lib/types/output-params.d.ts:146-155`, la
notificación trae `Ds_Date` (`DD/MM/YYYY`), `Ds_Hour` (`hh:mm`) y `Ds_AuthorisationCode`.

**Conclusión: hace falta migración.** Son tres columnas nuevas, todas anulables, sin `DEFAULT` y sin
reescritura de tabla — en Postgres es un `ALTER TABLE` instantáneo sobre las 325 filas. Pero
reintroduce el riesgo que el plan original había eliminado: **`.env` apunta a producción**.

### Segundo hallazgo: la URL OK puede romperse cuando CaixaBank toque la configuración

`/reserva/confirmacion/[orderId]` es un `page.tsx`, y en el App Router **una página solo responde a
GET: un POST devuelve 405**. Hoy funciona porque el terminal no envía parámetros en las URLs de
respuesta y Redsys hace una redirección limpia.

El problema: la opción «enviar parámetros en las URLs de respuesta» y la de «redirección automática»
se tocan en el mismo módulo de administración. Si al activar lo del Paso 0 activan también lo otro,
**Redsys empezaría a hacer POST a la URL OK y la pantalla de confirmación devolvería 405 a todos los
clientes que acaban de pagar**. En producción y sin aviso.

Por eso la URL OK pasa a ser una **ruta propia que acepta GET y POST** (Paso 5). Además de blindar
eso, aprovecha los parámetros si llegan.

---

## 3. Alcance definitivo

1. **Paso 0** — llamada a CaixaBank (sin código).
2. Migración: 3 columnas de recibo en `Reservation`.
3. Módulo compartido de normalización/validación del nombre.
4. Modal «NOMBRE o ALIAS de la reserva» con botón PAGAR, bilingüe.
5. `initializePayment` guarda el nombre; webhook y ruta de retorno guardan el recibo.
6. Pantalla de confirmación: nombre, desglose bajo el TOTAL, tarjeta de recibo y segundo botón
   de descarga.
7. Ticket PDF con el nombre + **recibo PDF nuevo** (80 mm).
8. Vistas de admin: listado y detalle.
9. Pantalla de error de pago: tarjeta informativa equivalente.

---

## Paso 0 — Llamada a CaixaBank (sin código, antes de desplegar)

Datos: FUC `352464580`, terminal `1`, portal `canales.redsys.es/lacaixa`.

Dos preguntas, no una:

1. **Redirección automática a la URL OK** sin que el cliente pulse «Continuar». Es la causa raíz del
   problema original y se arregla gratis.
2. **Si al hacerlo van a activar también el envío de parámetros a las URLs de respuesta.** Si dicen
   que sí, el Paso 5 pasa de ser un blindaje preventivo a ser obligatorio, y además el recibo se
   podrá verificar en testing.

**Comprobación previa que depende de nosotros:** verificar en Vercel (scope Production) que
`NEXT_PUBLIC_BASE_URL` es el dominio real de cara al cliente. A partir de ahora ese valor se imprime
en el recibo como «URL del comercio», así que tiene que ser el dominio bueno, no una URL de preview.

---

## Paso 1 — Migración y esquema

`prisma/migrations/20260828120000_add_payment_receipt_data/migration.sql`:

```sql
-- Datos que Redsys/CaixaBank exigen mostrar en un recibo imprimible en la URL OK.
-- Solo los escriben caminos con firma verificada (webhook y ruta de retorno): son
-- NULL en las reservas anteriores a esto y en los entornos donde el webhook no llega.
ALTER TABLE "Reservation" ADD COLUMN "authorisationCode"   TEXT;
ALTER TABLE "Reservation" ADD COLUMN "paymentDateTime"     TEXT;
ALTER TABLE "Reservation" ADD COLUMN "paymentResponseCode" TEXT;
```

En `prisma/schema.prisma`, dentro de `Reservation`, junto a `paymentId` / `paymentStatus`:

```prisma
  // Recibo de pago (lo exige CaixaBank en la URL OK). Se guardan tal cual los manda
  // Redsys y solo desde una notificación con firma verificada.
  authorisationCode   String?  // Ds_AuthorisationCode
  paymentDateTime     String?  // Ds_Date + Ds_Hour: "28/08/2026 21:34"
  paymentResponseCode String?  // Ds_Response: "0000".."0099" = autorizada
```

**Por qué `paymentDateTime` es texto y no `DateTime`:** Redsys envía la hora local española ya
formateada. Guardarla literal hace que el recibo imprima exactamente lo que figura en los registros
del banco, y evita tener que decidir el desfase horario (CET/CEST) al parsear — un fallo ahí saldría
impreso en un documento contable. El timestamp que sí es máquina (`confirmedAt`) no se toca.

> ⚠️ **`.env` apunta a PRODUCCIÓN (325 reservas reales).** Antes de migrar:
> ```bash
> set -a && . ./.env.testing && set +a
> npx tsx scripts/db-whoami.ts        # confirmar que NO es la BD de producción
> npx prisma migrate dev
> npx prisma generate                 # parar antes el dev server: el .dll.node se bloquea en Windows
> ```

---

## Paso 2 — Validación del nombre (módulo compartido)

Nuevo fichero **`src/modules/payments/lib/customer-name.ts`**. Módulo plano, **sin `"use server"`**,
para poder importarlo desde el modal (feedback inmediato) y desde la server action (validación de
verdad). Mismo patrón que `football-data/lib/suggestions.ts`.

```ts
export const CUSTOMER_NAME_MIN_LENGTH = 2;
export const CUSTOMER_NAME_MAX_LENGTH = 24;

/** Placeholder que escribían todas las reservas antes de que se pidiera el nombre. */
export const LEGACY_CUSTOMER_NAME = "Cliente";

// Caracteres de control, marcas de dirección bidireccional y espacios de ancho cero.
// No se ven, pero permiten que un nombre se lea distinto de como está guardado.
const INVISIBLE =
  /[\u0000-\u001F\u007F-\u009F\u00AD\u200B-\u200F\u202A-\u202E\u2060-\u2064\u2066-\u2069\uFEFF]/g;

// Latin-1: es exactamente lo que las fuentes estándar de jsPDF saben pintar en el ticket.
const ALLOWED = /^[A-Za-z0-9À-ÖØ-öø-ÿ .'-]+$/;

export function normalizeCustomerName(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw
    .normalize("NFC")
    .replace(INVISIBLE, "")
    .replace(/[’‘`´]/g, "'")   // comillas tipográficas → apóstrofo Latin-1
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

export type CustomerNameError = "length" | "chars";

export function validateCustomerName(name: string): CustomerNameError | null {
  if (name.length < CUSTOMER_NAME_MIN_LENGTH || name.length > CUSTOMER_NAME_MAX_LENGTH) {
    return "length";
  }
  if (!ALLOWED.test(name)) return "chars";
  return null;
}

/** Las reservas históricas guardan "Cliente": pintarlo sería mentir. */
export function displayCustomerName(name: string | null | undefined): string {
  const trimmed = name?.trim() ?? "";
  return !trimmed || trimmed === LEGACY_CUSTOMER_NAME ? "Sin nombre" : trimmed;
}
```

### Sobre «evitar inyección SQL, JS o cualquier otra amenaza»

Siendo honesto con lo que hay: **ni SQL ni XSS son vectores vivos en esta app.**

- **SQL**: todas las consultas van por Prisma, que parametriza. He comprobado que en `src/` (fuera
  del cliente generado) **no hay ni un `$queryRaw`, `$executeRaw` ni sus variantes `Unsafe`**. Una
  comilla en el nombre se guarda como comilla, no como sintaxis.
- **XSS**: React escapa todo el texto que interpola, y **no hay ni un `dangerouslySetInnerHTML`** en
  todo `src/`. El nombre se pinta con `{...}` en las cuatro vistas.

Lo que sí protege de verdad la lista blanca de arriba, y por lo que merece la pena implementarla:

- **Suplantación visual en el panel**: caracteres de dirección bidireccional (`U+202E`) o de ancho
  cero permiten que un nombre se lea al revés o se disfrace de otro en la lista de la camarera.
- **Que el ticket salga ilegible**: jsPDF con fuentes estándar codifica en WinAnsi. Un nombre en
  cirílico o chino saldría como basura justo en el papel que el cliente enseña. Por eso se restringe
  a Latin-1 (cubre castellano, valenciano, francés, alemán, italiano, portugués y nórdicos).
- **Romper la maquetación**: el tope de 24 caracteres es lo que garantiza que el nombre entra en una
  línea de los 80 mm del ticket.

**Coste de la decisión Latin-1**: un turista con nombre en otro alfabeto tendrá que transcribirlo.
Se le dice con un mensaje claro, no con un error genérico.

---

## Paso 3 — Modal en `src/app/eventos/[id]/client.tsx`

Se copia el markup del modal de CONDICIONES (líneas 159-193). **`z-[210]`**, no `z-[200]`, para que
nunca quede por debajo del de condiciones.

**Estado nuevo:**

```ts
const [showNameModal, setShowNameModal] = useState(false);
const [customerName, setCustomerName] = useState("");
const [nameError, setNameError] = useState<string | null>(null);
```

**El botón RESERVAR (líneas 254-267) deja de pagar y pasa a abrir el modal.** Sin spinner: es
instantáneo.

```ts
const openNameModal = () => {
  if (selectedSeats.length === 0) return;
  setError(null);
  setNameError(null);
  try {
    const saved = localStorage.getItem("lounge:customerName");
    if (saved) setCustomerName(saved);
  } catch {
    // Safari en modo privado lanza al leer localStorage
  }
  setShowNameModal(true);
};
```

Leer `localStorage` **dentro del handler, nunca en render**: en render rompe el SSR.

**`handleReserve` pasa a ser el submit del modal**, conserva su cuerpo actual y añade el nombre:

```ts
const handleReserve = async (e: React.FormEvent) => {
  e.preventDefault();

  const name = normalizeCustomerName(customerName);
  const invalid = validateCustomerName(name);
  if (invalid) { setNameError(nameModal.errors[invalid]); return; }

  setIsProcessing(true);
  setNameError(null);

  try {
    const result = await initializePayment({
      eventId: event.id,
      seatIds: selectedSeats,
      customerName: name,
    });

    if (!result.success || !result.redsysUrl || !result.formBody) {
      setNameError(result.error || "Error al iniciar el pago");   // dentro del modal
      setIsProcessing(false);
      return;
    }

    try { localStorage.setItem("lounge:customerName", name); } catch {}
    clearSelection();
    // ...resto idéntico: rellenar y enviar el formulario oculto (líneas 83-94)
  } catch (err) { /* idéntico, pero setNameError */ }
};
```

El error **se pinta dentro del modal**: el banner actual (líneas 289-293) queda tapado por el
overlay. Aviso conocido: los mensajes que devuelve el servidor (`"Asientos no disponibles: ..."`)
están solo en castellano, como hasta ahora; no se traducen en este trabajo.

**Markup del modal** (input nativo: no existe `components/ui/input.tsx`):

```tsx
{showNameModal && (
  <div className="fixed inset-0 z-[210] flex items-center justify-center bg-black/80 px-5">
    <div className="bg-[#1a1a1a] rounded-2xl p-6 max-w-sm w-full border border-white/10">
      <h2 className="text-white font-bold text-sm tracking-widest text-center mb-2">
        {nameModal.title}
      </h2>
      <p className="text-white/50 text-xs text-center mb-5">
        {selectedSeats.length} {selectedSeats.length === 1 ? nameModal.seat : nameModal.seats}
        {" · "}{formatEuros(totalPrice)}€
      </p>

      <form onSubmit={handleReserve}>
        <input
          type="text" autoFocus autoComplete="name" enterKeyHint="go"
          maxLength={CUSTOMER_NAME_MAX_LENGTH} disabled={isProcessing}
          value={customerName}
          onChange={(e) => { setCustomerName(e.target.value); setNameError(null); }}
          placeholder={nameModal.placeholder}
          className="w-full bg-black border border-white/10 rounded-lg px-3 py-2 text-white
                     placeholder:text-white/30 focus:border-[#D4AF37] outline-none"
        />

        {nameError && <p className="text-red-400 text-xs mt-2">{nameError}</p>}
        <p className="text-white/40 text-[11px] mt-2 mb-5">{nameModal.help}</p>

        <Button
          type="submit"
          disabled={isProcessing || normalizeCustomerName(customerName).length < CUSTOMER_NAME_MIN_LENGTH}
          className="w-full bg-[#D4AF37] hover:bg-[#b8972e] text-black font-semibold"
        >
          {isProcessing ? (
            <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{nameModal.processing}</>
          ) : nameModal.pay}
        </Button>
      </form>

      <button
        type="button" onClick={() => setShowNameModal(false)} disabled={isProcessing}
        className="w-full text-white/40 text-xs mt-3 hover:text-white/70 disabled:opacity-40"
      >
        {nameModal.cancel}
      </button>
    </div>
  </div>
)}
```

El `<form>` es lo que hace que Enter funcione en el teclado del móvil. Va **como hermano**, nunca
anidado, del formulario oculto de Redsys (líneas 315-319).

**Textos bilingües**, junto al objeto `conditions` (líneas 134-154):

```ts
const nameModal = isSpanish
  ? { title: "NOMBRE o ALIAS de la reserva", seat: "asiento", seats: "asientos",
      placeholder: "Ej.: Ramón", help: "Lo usaremos para localizar tu reserva en el local.",
      pay: "PAGAR", processing: "Procesando...", cancel: "Cancelar",
      errors: { length: "Escribe entre 2 y 24 caracteres.",
                chars: "Usa solo letras, números, espacios y . ' -" } }
  : { title: "NAME or NICKNAME for the booking", seat: "seat", seats: "seats",
      placeholder: "e.g. Ramon", help: "We'll use it to find your booking at the venue.",
      pay: "PAY", processing: "Processing...", cancel: "Cancel",
      errors: { length: "Enter between 2 and 24 characters.",
                chars: "Use only letters, numbers, spaces and . ' -" } };
```

> `customerName / setCustomerInfo` del store Zustand (`shared/hooks/use-reservation-store.ts`) sigue
> siendo código muerto que nadie invoca. **`useState` local**: el nombre es de un solo uso.

---

## Paso 4 — `initializePayment` y tipos

**`src/modules/payments/actions/index.ts`**, firma a `{ eventId, seatIds, customerName }`.

La validación va **junto a la guarda de `seatIds.length === 0` (líneas 24-26)**, antes de tocar la
base de datos, para que un nombre inválido no cree nunca una reserva `PENDING` que bloquee asientos:

```ts
const customerName = normalizeCustomerName(data.customerName);
if (validateCustomerName(customerName)) {
  return { success: false, error: "Indica un nombre o alias válido (entre 2 y 24 caracteres)" };
}
```

Y en el `create` (línea 99) `customerName: "Cliente"` → `customerName`. **`customerEmail` no se
toca**: la columna es NOT NULL y en este alcance no se pide email.

**`src/modules/payments/types/index.ts`** — `ReservationTicketData` gana:

```ts
  customerName: string;
  authorisationCode: string | null;
  paymentDateTime: string | null;
  paymentResponseCode: string | null;
```

**`getReservationByOrderId` (líneas 227-243)** añade esos cuatro campos al `return`. La consulta usa
`include` sin `select`, así que los escalares ya vienen: no hay que tocar Prisma.

**Los datos del comercio no van aquí.** `MERCHANT_CODE` es una variable de entorno de servidor, y
`getReservationByOrderId` es una server action llamada desde el navegador. Se pasan como prop desde
`page.tsx`, que es Server Component en los dos caminos de render. En `src/lib/redsys.ts`:

```ts
export const PRODUCT_DESCRIPTION = "Reserva de asientos";

export const MERCHANT_INFO = {
  fuc: merchantCode,
  name: "The Lounge Beerhouse",
  url: BASE_URL,
  productDescription: PRODUCT_DESCRIPTION,
};
```

Y `DS_MERCHANT_PRODUCTDESCRIPTION` pasa a usar la constante `PRODUCT_DESCRIPTION`, para que lo que
imprime el recibo sea literalmente lo que se firmó.

`BASE_URL` (hoy local en `payments/actions/index.ts:12-16`) se extrae a **`src/lib/base-url.ts`**:
lo necesitan ahora tres sitios (la action, `lib/redsys.ts` y la ruta de retorno del Paso 5). No
puede vivir en la action: es un fichero `"use server"` y ahí todo export tiene que ser una función
asíncrona.

---

## Paso 5 — Guardar el recibo: webhook + ruta de retorno

### 5a. Escritor común (no es server action)

**`src/modules/payments/lib/receipt.ts`**:

```ts
import prisma from "@/lib/prisma";

/**
 * Guarda los datos del recibo que exige el banco. Solo lo llaman caminos de servidor
 * con la firma de Redsys ya verificada.
 *
 * Gana el primero que escribe (`paymentDateTime: null`): el webhook y la vuelta del
 * navegador traen la misma notificación firmada, así que el segundo no aporta nada
 * y así una recarga de la URL OK no puede reescribir el recibo.
 */
export async function recordPaymentReceipt(orderId: string, receipt: {
  authorisationCode?: string;
  date?: string;
  hour?: string;
  responseCode?: string;
}): Promise<void> {
  const dateTime = [receipt.date, receipt.hour].filter(Boolean).join(" ").trim();
  if (!dateTime) return;

  await prisma.reservation.updateMany({
    where: { paymentId: orderId, paymentDateTime: null },
    data: {
      authorisationCode: receipt.authorisationCode ?? null,
      paymentDateTime: dateTime,
      paymentResponseCode: receipt.responseCode ?? null,
    },
  });
}
```

**Por qué un módulo plano y no una server action:** todo lo exportado de un fichero `"use server"`
es un endpoint invocable desde el navegador con los argumentos que quiera el que llame. Una
`recordPaymentReceipt` exportada como action sería un endpoint sin autenticar capaz de escribir un
código de autorización inventado en cualquier reserva.

### 5b. Webhook `/api/payments/notify`

En la rama de éxito y en la de fallo, antes de los updates existentes:

```ts
await recordPaymentReceipt(orderId, {
  authorisationCode: result.Ds_AuthorisationCode,
  date: result.Ds_Date,
  hour: result.Ds_Hour,
  responseCode: result.Ds_Response,
});
```

No se mete dentro de las transacciones existentes: es un dato de recibo, no de dinero, y si fallara
no debe impedir que la reserva se confirme.

### 5c. Ruta de retorno `src/app/api/payments/return/[orderId]/route.ts` (nueva)

Acepta **GET y POST**. Es la que blinda el 405 del punto 2.

```ts
export async function GET(request: Request, ctx: Ctx)  { return handle(request, ctx, null); }
export async function POST(request: Request, ctx: Ctx) {
  let notification = null;
  try {
    const form = await request.formData();
    const params = {
      Ds_SignatureVersion:  String(form.get("Ds_SignatureVersion")  ?? ""),
      Ds_MerchantParameters: String(form.get("Ds_MerchantParameters") ?? ""),
      Ds_Signature:          String(form.get("Ds_Signature")          ?? ""),
    };
    if (params.Ds_MerchantParameters && params.Ds_Signature) notification = params;
  } catch { /* sin cuerpo: seguimos igual */ }
  return handle(request, ctx, notification);
}

async function handle(request, ctx, notification) {
  const { orderId } = await ctx.params;
  const { searchParams } = new URL(request.url);
  const isKo = searchParams.get("r") === "ko";
  const eventId = searchParams.get("eventId");

  if (notification) {
    try {
      const result = processRedirectNotification(notification);   // verifica la firma
      if (result.Ds_Order === orderId) {
        await recordPaymentReceipt(orderId, { ... });
      }
    } catch (error) {
      console.error("[Payment return] Notificación inválida:", error);
    }
  }

  const destination = isKo
    ? `/reserva/error?orderId=${orderId}${eventId ? `&eventId=${eventId}` : ""}`
    : `/reserva/confirmacion/${orderId}`;

  return NextResponse.redirect(new URL(destination, BASE_URL), 303);
}
```

Tres cosas que no son opcionales:

- **El 303 es obligatorio.** Es lo que convierte el POST de Redsys en un GET al redirigir; con un
  302 algunos navegadores repiten el POST contra la página y vuelve el 405.
- **Todo dentro de `try/catch`, y siempre se redirige.** Este es el camino del dinero: un cliente que
  acaba de pagar tiene que llegar a su pantalla aunque la firma venga mal o la BD falle.
- **Esta ruta no confirma ni cancela nada.** La lógica de dinero se queda donde está (webhook en
  producción, fallback de la página en el resto). Solo anota el recibo.

**URLs en `initializePayment` (líneas 121-123):**

```ts
const okUrl = `${BASE_URL}/api/payments/return/${orderId}?r=ok`;
const koUrl = `${BASE_URL}/api/payments/return/${orderId}?r=ko&eventId=${eventId}`;
const notifyUrl = `${BASE_URL}/api/payments/notify`;   // sin cambios
```

La KO también pasa por la ruta: `/reserva/error` es igual de `page.tsx` y tiene el mismo 405.

---

## Paso 6 — Pantalla de confirmación

### 6a. Pasar los datos del comercio

`confirmacion/[orderId]/page.tsx` importa `MERCHANT_INFO` de `@/lib/redsys` y lo pasa a los dos
caminos de render: `<ConfirmationClient ... merchant={MERCHANT_INFO} />` y
`<ProcessingClient orderId={orderId} merchant={MERCHANT_INFO} />`, que lo reenvía al montar
`ConfirmationClient` (`processing-client.tsx:72-76`).

### 6b. Tarjeta de resumen (líneas 240-272)

Bloque de nombre **antes de asientos y total**; desglose **debajo del TOTAL, alineado a la derecha**:

```tsx
{hasName && (
  <div className="border-t border-white/10 pt-3">
    <p className="text-white/40 text-xs uppercase tracking-wider">Nombre / Alias</p>
    <p className="text-white text-sm font-semibold break-words">{reservation.customerName}</p>
  </div>
)}

{/* fila existente: Asientos | Total */}

{hasFee && (
  <div className="space-y-1 text-right">
    <div className="flex items-center justify-end gap-3 text-xs">
      <span className="text-white/40">
        Importe de la reserva <span className="text-white/30">(descontable)</span>
      </span>
      <span className="text-white tabular-nums">{formatEuros(seatsTotal)}€</span>
    </div>
    <div className="flex items-center justify-end gap-3 text-xs">
      <span className="text-white/40">Gastos de gestión</span>
      <span className="text-white tabular-nums">{formatEuros(feeTotal)}€</span>
    </div>
  </div>
)}
```

Con, arriba del `return`:

```ts
const hasName = reservation.customerName && reservation.customerName !== LEGACY_CUSTOMER_NAME;
const hasFee = reservation.managementFeeCents > 0;
const seatsTotal = (reservation.seatPriceCents * reservation.totalSeats) / 100;
const feeTotal   = (reservation.managementFeeCents * reservation.totalSeats) / 100;
```

Mismo cálculo, mismos nombres y misma redacción que el detalle de admin
(`reservas/[id]/[reservationId]/page.tsx:52-54`), para que las dos pantallas no puedan divergir.

De paso, el `totalPrice.toFixed(2).replace(".", ",")` de la línea 264 pasa a `formatEuros(...)`:
mismo resultado, pero es la única llamada del fichero que no usa el helper.

### 6c. Tarjeta de recibo (nueva, debajo de la anterior)

```tsx
<div className="bg-[#1a1a1a] rounded-2xl p-4 space-y-2 border border-white/10">
  <p className="text-white/40 text-xs uppercase tracking-wider text-center mb-1">
    Recibo del pago
  </p>
  <ReceiptRow label="Comercio"          value={merchant.name} />
  <ReceiptRow label="FUC"               value={merchant.fuc} />
  <ReceiptRow label="URL"               value={merchant.url} />
  <ReceiptRow label="Importe"           value={`${formatEuros(reservation.totalPrice)}€`} />
  <ReceiptRow label="Cód. autorización" value={reservation.authorisationCode ?? "—"} />
  <ReceiptRow label="Fecha / hora"      value={reservation.paymentDateTime ?? "—"} />
  <ReceiptRow label="Nº de pedido"      value={orderId} />
  <ReceiptRow label="Producto"          value={merchant.productDescription} />
</div>
```

`ReceiptRow` es un componente local de 5 líneas: etiqueta a la izquierda (`text-white/40 text-xs`),
valor a la derecha (`text-white text-xs text-right break-all`).

**Los guiones son deliberados.** Las 325 reservas antiguas no tienen estos datos, y en testing y
local tampoco los habrá (ver Riesgos). La tarjeta se pinta siempre: para todo pago nuevo en
producción sale completa, y para el resto degrada sin romperse.

### 6d. Botones (líneas 274-303)

Orden: dorado «Descargar ticket PDF» → **oscuro «Descargar recibo del pago»** → outline «Volver al
inicio».

```tsx
<Button
  onClick={() => handleDownloadReceipt()}
  disabled={isGeneratingReceipt}
  className="w-full bg-[#1a1a1a] hover:bg-[#242424] text-white border border-white/15"
>
  {isGeneratingReceipt
    ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Generando recibo...</>
    : <><Receipt className="w-4 h-4 mr-2" />Descargar recibo del pago</>}
</Button>
```

Estado propio `isGeneratingReceipt`: con el `isGenerating` actual, pulsar uno bloquearía el otro.
Icono `Receipt` de `lucide-react`. **El recibo no se autodescarga**; el ticket sigue haciéndolo.

---

## Paso 7 — Los dos PDF

### 7a. Nombre en el ticket (`handleDownloadTicket`, líneas 26-214)

Va **después del `Reserva: {id}` (líneas 107-113) y antes de ASIENTOS (línea 115)**, tal y como
pediste:

```ts
if (hasName) {
  yPos += 6;
  doc.setFontSize(8); doc.setFont("helvetica", "bold");
  doc.text("NOMBRE / ALIAS", ticketWidth / 2, yPos, { align: "center" });
  yPos += 5;
  doc.setFontSize(10);
  const [line] = doc.splitTextToSize(reservation.customerName, ticketWidth - margin * 2);
  doc.text(line, ticketWidth / 2, yPos, { align: "center" });
}
```

**Y la altura del lienzo, que es el error fácil de cometer** (línea 48, ya incluye lo de los gastos
de gestión):

```ts
const nameHeight = hasName ? 11 : 0;   // 6 de separación + 5 de la línea del nombre
const ticketHeight = 98 + seatsHeight + qrSize + (hasFee ? 9 : 0) + nameHeight;
```

El ticket tiene alto fijo calculado: si se añade contenido sin subirlo, **el QR se corta por abajo**.
`splitTextToSize(...)[0]` es la red por si algún día llega un nombre más largo del esperado: recorta
en vez de desbordar los 80 mm.

### 7b. Recibo PDF nuevo (`handleDownloadReceipt`)

Mismo formato de 80 mm que el ticket, para que los dos documentos se lean como de la misma casa.
Se construye con una lista de filas y **la altura se calcula contando líneas ya partidas**, que es lo
que evita repetir el problema del lienzo:

```ts
const rows = [
  { label: "Comercio",          value: merchant.name },
  { label: "FUC",               value: merchant.fuc },
  { label: "URL",               value: merchant.url,              wrap: true },
  { label: "Importe",           value: `${formatEuros(reservation.totalPrice)} EUR` },
  { label: "Cód. autorización", value: reservation.authorisationCode ?? "—" },
  { label: "Fecha / hora",      value: reservation.paymentDateTime ?? "—" },
  { label: "Nº de pedido",      value: orderId },
  { label: "Producto",          value: merchant.productDescription, wrap: true },
];
```

- Filas normales: etiqueta a la izquierda (tamaño 7) y valor a la derecha (tamaño 8, negrita) en la
  misma línea.
- Filas `wrap` (URL y producto): etiqueta y, debajo, el valor partido con `splitTextToSize` al ancho
  útil (`ticketWidth - margin * 2`). Se cuentan sus líneas **antes** de crear el documento para
  calcular el alto.
- Cabecera igual que el ticket (`THE LOUNGE` / `BEERHOUSE • VALENCIA`), línea discontinua, título
  `RECIBO DE PAGO`, línea discontinua, las filas, línea discontinua y pie.
- Nombre de fichero: `recibo-${orderId}.pdf`.

Sale un helper local `dashedLine(doc, y)` que usan las dos funciones: el patrón
`setLineDashPattern([1,1],0) → line() → setLineDashPattern([],0)` aparece ya seis veces en el
fichero.

---

## Paso 8 — Vistas de admin

Las dos importan `displayCustomerName` de `@/modules/payments/lib/customer-name`.

**Listado — `admin/(dashboard)/reservas/[id]/page.tsx:140-148`.** El bloque «ID Reserva» pasa a ser
el nombre, **sin el id**, como pediste:

```tsx
<div className="min-w-0 pr-3">
  <p className="text-white/50 text-[10px] uppercase tracking-wider">Nombre / Alias</p>
  <p className="text-white text-sm font-semibold truncate">
    {displayCustomerName(reservation.customerName)}
  </p>
</div>
```

`min-w-0` + `truncate` no son adorno: sin ellos un nombre de 24 caracteres empuja el precio fuera de
la tarjeta en pantallas de móvil.

**Detalle — `admin/(dashboard)/reservas/[id]/[reservationId]/page.tsx`.** Al principio de la tarjeta
de resumen (línea 125), antes de la fila de asientos/total:

```tsx
<div className="mb-3 pb-3 border-b border-white/10">
  <p className="text-white/50 text-[10px] uppercase tracking-wider">Nombre / Alias</p>
  <p className="text-white text-base font-semibold break-words">
    {displayCustomerName(reservation.customerName)}
  </p>
</div>
```

La cabecera se queda como está («Detalle de reserva» + id): es la vista que abre la camarera al
escanear el QR y el id sigue siendo útil ahí.

---

## Paso 9 — Pantalla de error de pago

El banco no lo ha pedido, pero la información equivalente ahí ahorra llamadas a soporte: si un
cliente dice «me han cobrado», el código de respuesta en pantalla resuelve la duda en el momento.

En `reserva/error/page.tsx`, después de `cancelReservationByOrderId(orderId)`, un
`getReservationByOrderId(orderId)`, y una tarjeta con el mismo estilo debajo de la de ayuda:

- Comercio, FUC, URL, Importe, Nº de pedido.
- Fecha / hora y Código de respuesta **solo si existen** (el webhook KO los habrá escrito).
- Estado: «No autorizada».
- **Sin código de autorización** (no lo hay) y **sin botón de PDF**.

Si no hay `orderId` o no se encuentra la reserva, la tarjeta no se pinta: la pantalla queda
exactamente como hoy.

---

## Paso 10 — Herramienta para poder verificar esto

**`scripts/simulate-redsys-notify.ts`** (nuevo). Sin él, la tarjeta de recibo **no se puede probar
hasta el primer pago real en producción**, que es justo lo contrario de la estrategia de desplegar
antes en testing.

```bash
npx tsx scripts/simulate-redsys-notify.ts <orderId> [ok|ko]
```

Firma una notificación con la clave sandbox local y la envía a
`http://localhost:3000/api/payments/notify`, igual que haría Redsys.

Detalles que si no se anotan cuestan una tarde:

- El firmante de `redsys-easy` (`extractAndAssertOrderFromRequestParams`) busca el pedido en
  **`DS_MERCHANT_ORDER`**, mientras que el verificador lo busca en **`Ds_Order`**. Hay que incluir
  **las dos claves** en el payload; la de más es inocua porque la firma se calcula sobre la cadena
  base64 completa.
- El importe se lee de la reserva en BD, para que la traza de descuadre del webhook
  (`notify/route.ts:44-49`) no salte.
- Funciona igual sobre una reserva ya confirmada: el webhook no mira el estado para anotar el
  recibo, así que sirve después de que la página haya autoconfirmado.

**Guardarraíles, no negociables:** el script aborta si `REDSYS_ENV=production` o si la URL destino no
es `localhost`. Es una herramienta que falsifica notificaciones de pago con la clave del entorno; no
puede poder apuntar a producción.

---

## Paso 11 — Documentación

- **`CLAUDE.md`**: punto 11 nuevo con el nombre del cliente y el recibo — de dónde salen los datos,
  por qué `paymentDateTime` es texto y por qué la URL OK es una ruta y no la página.
- **`REDSYS.md`**: la tabla de URLs pasa a reflejar `/api/payments/return/[orderId]`, y una nota de
  por qué (el 405).
- **`PLAN_IMPLEMENTACION_NOMBRE_CLIENTE.md`**: sustituirlo por este plan revisado, que es el que
  compartes con la dueña y con el otro ingeniero.

---

## Orden de implementación

1. Migración + esquema + `prisma generate` (con `.env.testing` cargado).
2. `customer-name.ts`, `receipt.ts`, `base-url.ts`, `MERCHANT_INFO`.
3. `initializePayment` + tipos + `getReservationByOrderId`.
4. Modal.
5. Webhook + ruta de retorno + cambio de URLOK/URLKO.
6. Pantalla de confirmación (tarjetas, botones, los dos PDF).
7. Vistas de admin.
8. Pantalla de error.
9. Script simulador + verificación + documentación.

Los pasos 1-4 ya dan valor por sí solos: si algo se tuerce en el 5, el nombre del cliente puede
desplegarse sin el recibo.

---

## Fuera de alcance (decidido)

- **Email con el ticket adjunto** — `PLAN_IMPLEMENTACION_MAIL_CLIENTE.md` sigue vivo y sin
  implementar. El modal que se construye aquí es el que necesitaría: solo habría que añadirle el
  campo de email.
- **Informe PDF mensual** (`admin/reservas/client.tsx`): añadir una columna obligaría a recolocar
  las X fijas y a ampliar `getMonthlyReportData`.
- **Pestaña de espera** (pago en pestaña nueva + sondeo): descartada por frágil en móvil.
- **`Ds_Merchant_Titular`**: un alias distinto del titular de la tarjeta confundiría en la pantalla
  del banco.
- `createReservation` (`reservations/actions/index.ts`) tiene el mismo placeholder `"Cliente"`, pero
  es código muerto sin llamantes.

---

## Riesgos

| Riesgo | Mitigación |
|---|---|
| **`.env` apunta a producción y ahora sí hay migración** | Cargar `.env.testing` y confirmar con `scripts/db-whoami.ts` antes de migrar. Las 3 columnas son anulables y sin `DEFAULT`: no reescriben la tabla. |
| **El recibo saldrá vacío en testing y en local** | Es consecuencia de que ahí el webhook no llega y la página autoconfirma (`REDSYS.md`, tabla de autoconfirmación). Se cubre con el script del Paso 10, y desaparece si CaixaBank activa el envío de parámetros a las URLs (Paso 0, pregunta 2). |
| **Las 325 reservas antiguas no tienen datos de recibo** | La tarjeta pinta «—» campo a campo. Sus tickets se generan con el layout de siempre porque `hasName` es falso. |
| **Cambiar la URL OK toca el camino del dinero** | La ruta redirige siempre, con todo en `try/catch`, y no confirma ni cancela nada. Verificación 1 de la lista. |
| **Los datos del recibo quedan en una URL pública** | El `orderId` son 12 dígitos de timestamp: es adivinable con esfuerzo. Se acepta — el nombre es un alias y el código de autorización por sí solo no permite operar. Si algún día se añade el email, ahí sí hace falta el `publicToken` del otro plan. |
| **`npm run dev` escribe en la BD de `DATABASE_URL`** | Vale también sin migración: comprobar el entorno antes de arrancar. |

---

## Verificación

1. **La ruta de retorno, lo primero.** Pago sandbox completo: RESERVAR → modal → nombre → tarjeta
   `4548 8100 0000 0003` (`12/27`, CVV `123`, CIP `123456`) → comprobar que se vuelve a
   `/reserva/confirmacion/[orderId]` **pasando por `/api/payments/return/...`**. Repetir cancelando
   el pago para validar la vuelta KO.
2. **Simular el POST de Redsys a la URL OK** (`curl -X POST` a la ruta de retorno sin cuerpo): debe
   responder 303 y redirigir, no 405. Es el escenario contra el que se blinda.
3. **Recibo completo**: `npx tsx scripts/simulate-redsys-notify.ts <orderId> ok`, recargar la
   confirmación y comprobar que la tarjeta trae código de autorización y fecha/hora.
4. **Los dos PDF**: el ticket con «NOMBRE / ALIAS» entre el id y ASIENTOS, **sin que nada se salga ni
   tape el QR**; y el recibo con los 8 campos, con la URL partida en varias líneas si hace falta.
5. **Nombre largo**: repetir con 24 caracteres (`Maria Jose Fernandez Gil`) y mirar el ticket, la
   tarjeta del listado de admin (que no empuje el precio) y el recibo.
6. **Validación de servidor**: llamar a `initializePayment` desde la consola del navegador con
   `customerName: "  "` y con `customerName: "Ramón‮nómar"`, y comprobar que devuelve error
   **y que no se ha creado ninguna reserva PENDING**.
7. **Modal en fallo**: ocupar un asiento desde otra pestaña y verificar que el error se ve **dentro**
   del modal y que el modal no se cierra.
8. **Admin**: listado con «Nombre / Alias» y sin id; detalle con el nombre al principio de la
   tarjeta; escanear el QR del ticket y confirmar que abre la reserva correcta.
9. **Reservas históricas**: abrir una anterior y comprobar que pinta **«Sin nombre»** en las dos
   vistas y que su ticket sale con el layout de siempre.
10. **Precarga**: reservar otra vez y comprobar que el modal trae el nombre anterior.
11. **Pantalla de error**: forzar un pago KO y comprobar la tarjeta informativa.
12. `npm run build`, y **desplegar solo a `testing`**. Varios días en uso real; preguntar a las
    camareras si el nombre les sirve para localizar reservas.
13. Solo después, merge de `testing` a `main`. **En el primer pago real en producción, abrir la
    pantalla de confirmación y verificar que el recibo trae código de autorización y fecha/hora**:
    es el único sitio donde eso se puede comprobar de verdad.

---

## Notas de la implementación (2026-08-28)

Lo que se descubrió al ejecutar el plan y no estaba previsto.

### 1. Producción va cuatro migraciones por detrás

`npm run build` es `prisma generate && next build`: **no aplica migraciones**. Y al construir en
local, que carga `.env` (producción), salió el aviso `The column Event.externalMatchId does not
exist in the current database`. Comprobado con `scripts/db-whoami.ts` (solo lectura):

| | Producción (`vxfvfuqmm…`) | Testing (`tdkiretmg…`) |
|---|---|---|
| Reservas | 329 | 46 |
| Migraciones aplicadas | **solo `20260416113547_init`** | las 5 |

Al mergear `testing` → `main` hay que aplicar **cuatro** migraciones a producción, en orden y a mano:

```
20260814090000_migrate_to_espn_provider
20260815100000_add_team_logo_source
20260825120000_add_management_fee
20260828120000_add_payment_receipt_data
```

Las tres primeras no son de este trabajo: venían pendientes de la migración a ESPN y de los gastos
de gestión. **La de gastos de gestión reconstruye `seatPriceCents` de las 329 reservas reales y añade
un `CHECK`**: hay que leerla antes de lanzarla, no es aditiva como la del recibo.

### 2. El POST contra la página de confirmación da 404, no 405

Comprobado en local: `curl -X POST /reserva/confirmacion/<orderId>` devuelve **404**. El razonamiento
del plan no cambia —para el cliente que acaba de pagar, 404 y 405 son igual de rotos—, pero el número
es otro. La ruta de retorno responde 303 tanto a GET como a POST, verificado en los cuatro casos
(GET ok, GET ko, POST ok, POST sin cuerpo).

### 3. El simulador necesitaba un guardarraíl que no estaba en el plan

Simular un `ko` sobre una reserva **ya confirmada** la cancela de verdad: le pone `CANCELLED` y
libera sus asientos poniendo `SeatStatus.reservationId = null`. **Ese enlace no se puede
reconstruir.** Pasó una vez en testing mientras se verificaba el cerrojo de idempotencia (reserva
`787903382196`, que quedó cancelada y sin asientos).

El script pide ahora `--force` para ese caso concreto. Con `ok` no hay riesgo.

### 4. Verificado en testing

- Cadena completa: notificación firmada → firma verificada → recibo en BD (`auth=123456`,
  `fecha=28/08/2026 11:03`).
- Cerrojo «gana el primero»: una segunda notificación **no** reescribe el recibo.
- Pantalla de confirmación con nombre de 24 caracteres: pinta el bloque «Nombre / Alias», el desglose
  con «(descontable)» y la tarjeta de recibo completa (FUC `352464580`, autorización, fecha, pedido,
  producto, URL) y los tres botones.
- Reserva histórica sin recibo: **omite** el bloque del nombre y pinta la tarjeta con dos guiones.
- Pantalla de error: tarjeta «Datos de la operación» con FUC, pedido, código de respuesta y estado.
- Alto del recibo PDF, renderizado en Node con jsPDF: 12 mm de margen inferior en los tres casos
  (URL corta, URL de producción a dos líneas, URL muy larga sin autorización).
- `npx tsc --noEmit` limpio; `eslint` sobre los 16 ficheros tocados: 0 errores nuevos (los 2 que
  salen en `eventos/[id]/client.tsx` son previos); `npm run build` correcto.

### 5. Lo que sigue sin poder probarse fuera de producción

El recibo con datos **reales** de Redsys. En testing la página autoconfirma y el webhook no llega, así
que lo que se ha validado es la cañería (con el simulador), no la notificación real. **En el primer
pago real en producción hay que abrir la pantalla de confirmación y comprobar que el código de
autorización y la fecha/hora vienen rellenos.** Si CaixaBank activa el envío de parámetros en las
URLs de respuesta (Paso 0, pregunta 2), esto deja de ser un punto ciego.
