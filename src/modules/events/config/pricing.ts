/**
 * Gastos de gestión por asiento.
 *
 * Se manejan siempre en céntimos enteros: el importe que se firma para Redsys tiene que ser
 * un entero de céntimos, y así el desglose del ticket nunca depende de una división.
 *
 * Esta es la única fuente de verdad de los valores admitidos: la usa el selector del admin
 * para pintar las opciones y la server action para validar lo que llega del cliente.
 */

/** 1,50 € — lo que cobra un evento recién creado. */
export const DEFAULT_MANAGEMENT_FEE_CENTS = 150;

/** De 0,00 € a 5,00 € en pasos de 0,50 €. */
export const MANAGEMENT_FEE_OPTIONS_CENTS = [
  0, 50, 100, 150, 200, 250, 300, 350, 400, 450, 500,
];

/**
 * Un valor fuera de esta lista se convertiría en un cobro real, así que se valida en el
 * servidor aunque el formulario del admin solo ofrezca las opciones correctas.
 */
export function isValidManagementFeeCents(value: unknown): value is number {
  return typeof value === "number" && MANAGEMENT_FEE_OPTIONS_CENTS.includes(value);
}

/**
 * Los gastos de gestión acaban en un cobro real, así que nunca se escribe lo que llega
 * del cliente sin comprobarlo contra la lista de valores admitidos.
 *
 * Vive aquí y no en la server action porque en un fichero `"use server"` solo se pueden
 * exportar funciones asíncronas, y esta tiene que poder testearse.
 */
export function safeManagementFeeCents(value: number | undefined): number {
  return isValidManagementFeeCents(value) ? value : DEFAULT_MANAGEMENT_FEE_CENTS;
}

/** 150 → 1.5 */
export function centsToEuros(cents: number): number {
  return cents / 100;
}
