/**
 * Los 47 asientos del local tal como los crea el seed en una base de datos virgen.
 *
 * Viven en su propio módulo para que el seed y el fixture de los tests E2E siembren
 * exactamente lo mismo: si cada uno tuviera su copia, acabarían divergiendo.
 *
 * Ojo, son los datos de PARTIDA, no los del local hoy:
 * - Los códigos son los originales ("T1-A1", "P-B7"). Los reales ("A7.2", "M3.1") se
 *   aplicaron después con scripts/rename-seats.ts, que conserva `Seat.id`.
 * - Las posiciones son las iniciales. El plano real se coloca desde /admin/asientos.
 * - `zone`, `row` y `number` son vestigiales: nada vivo los lee.
 */
// prettier-ignore
export const SEED_SEATS = [
  // TV1 zone - 10 seats
  { id: "T1-A1", code: "T1-A1", zone: "TV1" as const, row: "A", number: 1, posX: 18, posY: 10, capacity: 1 },
  { id: "T1-A2", code: "T1-A2", zone: "TV1" as const, row: "A", number: 2, posX: 27, posY: 9, capacity: 1 },
  { id: "T1-A3", code: "T1-A3", zone: "TV1" as const, row: "A", number: 3, posX: 40, posY: 8, capacity: 1 },
  { id: "T1-A4", code: "T1-A4", zone: "TV1" as const, row: "A", number: 4, posX: 53, posY: 6, capacity: 1 },
  { id: "T1-A5", code: "T1-A5", zone: "TV1" as const, row: "A", number: 5, posX: 65, posY: 5, capacity: 1 },
  { id: "T1-B1", code: "T1-B1", zone: "TV1" as const, row: "B", number: 1, posX: 18, posY: 15, capacity: 1 },
  { id: "T1-B2", code: "T1-B2", zone: "TV1" as const, row: "B", number: 2, posX: 33, posY: 14, capacity: 1 },
  { id: "T1-B3", code: "T1-B3", zone: "TV1" as const, row: "B", number: 3, posX: 26, posY: 19, capacity: 1 },
  { id: "T1-B4", code: "T1-B4", zone: "TV1" as const, row: "B", number: 4, posX: 44, posY: 18, capacity: 1 },
  { id: "T1-B5", code: "T1-B5", zone: "TV1" as const, row: "B", number: 5, posX: 57, posY: 16, capacity: 1 },
  // TV2 zone - 12 seats
  { id: "T2-A1", code: "T2-A1", zone: "TV2" as const, row: "A", number: 1, posX: 38, posY: 28, capacity: 1 },
  { id: "T2-A2", code: "T2-A2", zone: "TV2" as const, row: "A", number: 2, posX: 65, posY: 34, capacity: 1 },
  { id: "T2-A3", code: "T2-A3", zone: "TV2" as const, row: "A", number: 3, posX: 63, posY: 25, capacity: 1 },
  { id: "T2-A4", code: "T2-A4", zone: "TV2" as const, row: "A", number: 4, posX: 78, posY: 20, capacity: 1 },
  { id: "T2-A5", code: "T2-A5", zone: "TV2" as const, row: "A", number: 5, posX: 76, posY: 16, capacity: 1 },
  { id: "T2-A6", code: "T2-A6", zone: "TV2" as const, row: "A", number: 6, posX: 69, posY: 15, capacity: 1 },
  { id: "T2-B1", code: "T2-B1", zone: "TV2" as const, row: "B", number: 1, posX: 68, posY: 38, capacity: 1 },
  { id: "T2-B2", code: "T2-B2", zone: "TV2" as const, row: "B", number: 2, posX: 81, posY: 36, capacity: 1 },
  { id: "T2-B3", code: "T2-B3", zone: "TV2" as const, row: "B", number: 3, posX: 79, posY: 32, capacity: 1 },
  { id: "T2-B4", code: "T2-B4", zone: "TV2" as const, row: "B", number: 4, posX: 64, posY: 29, capacity: 1 },
  { id: "T2-B5", code: "T2-B5", zone: "TV2" as const, row: "B", number: 5, posX: 77, posY: 28, capacity: 1 },
  { id: "T2-B6", code: "T2-B6", zone: "TV2" as const, row: "B", number: 6, posX: 75, posY: 24, capacity: 1 },
  // PROJECTOR zone - 25 seats
  { id: "P-A1", code: "P-A1", zone: "PROJECTOR" as const, row: "A", number: 1, posX: 35, posY: 36, capacity: 1 },
  { id: "P-A2", code: "P-A2", zone: "PROJECTOR" as const, row: "A", number: 2, posX: 42, posY: 39, capacity: 1 },
  { id: "P-A3", code: "P-A3", zone: "PROJECTOR" as const, row: "A", number: 3, posX: 50, posY: 38, capacity: 1 },
  { id: "P-A4", code: "P-A4", zone: "PROJECTOR" as const, row: "A", number: 4, posX: 58, posY: 46, capacity: 1 },
  { id: "P-A5", code: "P-A5", zone: "PROJECTOR" as const, row: "A", number: 5, posX: 59, posY: 55, capacity: 1 },
  { id: "P-A6", code: "P-A6", zone: "PROJECTOR" as const, row: "A", number: 6, posX: 79, posY: 52, capacity: 1 },
  { id: "P-A7", code: "P-A7", zone: "PROJECTOR" as const, row: "A", number: 7, posX: 54, posY: 34, capacity: 1 },
  { id: "P-A8", code: "P-A8", zone: "PROJECTOR" as const, row: "A", number: 8, posX: 46, posY: 27, capacity: 1 },
  { id: "P-B1", code: "P-B1", zone: "PROJECTOR" as const, row: "B", number: 1, posX: 48, posY: 76, capacity: 1 },
  { id: "P-B2", code: "P-B2", zone: "PROJECTOR" as const, row: "B", number: 2, posX: 57, posY: 77, capacity: 1 },
  { id: "P-B3", code: "P-B3", zone: "PROJECTOR" as const, row: "B", number: 3, posX: 65, posY: 79, capacity: 1 },
  { id: "P-B4", code: "P-B4", zone: "PROJECTOR" as const, row: "B", number: 4, posX: 73, posY: 80, capacity: 1 },
  { id: "P-B5", code: "P-B5", zone: "PROJECTOR" as const, row: "B", number: 5, posX: 92, posY: 57, capacity: 1 },
  { id: "P-B6", code: "P-B6", zone: "PROJECTOR" as const, row: "B", number: 6, posX: 79, posY: 67, capacity: 1 },
  { id: "P-B7", code: "P-B7", zone: "PROJECTOR" as const, row: "B", number: 7, posX: 79, posY: 62, capacity: 1 },
  { id: "P-B8", code: "P-B8", zone: "PROJECTOR" as const, row: "B", number: 8, posX: 79, posY: 57, capacity: 1 },
  { id: "P-C1", code: "P-C1", zone: "PROJECTOR" as const, row: "C", number: 1, posX: 88, posY: 74, capacity: 1 },
  { id: "P-C2", code: "P-C2", zone: "PROJECTOR" as const, row: "C", number: 2, posX: 46, posY: 81, capacity: 1 },
  { id: "P-C3", code: "P-C3", zone: "PROJECTOR" as const, row: "C", number: 3, posX: 54, posY: 82, capacity: 1 },
  { id: "P-C4", code: "P-C4", zone: "PROJECTOR" as const, row: "C", number: 4, posX: 63, posY: 83, capacity: 1 },
  { id: "P-C5", code: "P-C5", zone: "PROJECTOR" as const, row: "C", number: 5, posX: 71, posY: 85, capacity: 1 },
  { id: "P-C6", code: "P-C6", zone: "PROJECTOR" as const, row: "C", number: 6, posX: 91, posY: 68, capacity: 1 },
  { id: "P-C7", code: "P-C7", zone: "PROJECTOR" as const, row: "C", number: 7, posX: 92, posY: 63, capacity: 1 },
  { id: "P-C8", code: "P-C8", zone: "PROJECTOR" as const, row: "C", number: 8, posX: 91, posY: 52, capacity: 1 },
  { id: "P-D1", code: "P-D1", zone: "PROJECTOR" as const, row: "D", number: 1, posX: 85, posY: 81, capacity: 1 },
];
