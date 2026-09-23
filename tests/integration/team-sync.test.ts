/**
 * El sync de equipos con ESPN, de punta a punta contra la base: lee la tabla, empareja,
 * y escribe por lotes. ESPN se sustituye; el emparejado en sí ya lo prueban los
 * unitarios de `planTeam` y `planCreate` (P2). Aquí importa lo que llega a la base.
 *
 * Llega con P6, al fijar el umbral de cobertura sobre `lib/`: `syncTeams` y
 * `applyWrites` no tenían ningún test, y son lo que corre cada noche en el cron.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { prisma } from "@/lib/prisma";
import { COMPETITION_BY_CODE } from "@/modules/football-data/config/competitions";
import { syncTeams } from "@/modules/football-data/lib/team-sync";
import type { EspnTeam } from "@/modules/football-data/types";

vi.mock("@/modules/football-data/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/football-data/lib/api-client")>()),
  getCompetitionTeams: vi.fn(),
}));

const { getCompetitionTeams } = await import("@/modules/football-data/lib/api-client");
const teamsMock = vi.mocked(getCompetitionTeams);

const LOGO = (id: string) => `https://a.espncdn.com/i/teamlogos/soccer/500/${id}.png`;

function espn(id: string, displayName: string): EspnTeam {
  return { id, displayName, shortDisplayName: displayName, logo: LOGO(id) };
}

const BARCELONA = espn("83", "Barcelona");
const REAL_MADRID = espn("86", "Real Madrid");

/** Qué devuelve ESPN para cada competición; las que no estén, lista vacía. */
function espnReturns(byCode: Record<string, EspnTeam[] | Error>) {
  teamsMock.mockImplementation(async (code: string) => {
    const value = byCode[code];
    if (value instanceof Error) throw value;
    return value ?? [];
  });
}

// El sync escribe en consola su resumen y los errores; aquí sobran.
beforeEach(() => {
  teamsMock.mockReset();
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("syncTeams", () => {
  it("la primera vez crea los equipos; la segunda no escribe nada", async () => {
    espnReturns({ "esp.1": [BARCELONA, REAL_MADRID] });

    const first = await syncTeams();
    expect(first).toEqual({ created: 2, updated: 0, skipped: 0, errors: [] });

    const rows = await prisma.team.findMany({ orderBy: { externalId: "asc" } });
    expect(rows).toMatchObject([
      { externalId: 83, name: "Barcelona", league: "La Liga", logo: LOGO("83") },
      { externalId: 86, name: "Real Madrid", league: "La Liga", logo: LOGO("86") },
    ]);

    // La regresión cara: si una ejecución sin cambios escribiera, el cron haría
    // cientos de UPDATE cada noche.
    const second = await syncTeams();
    expect(second).toEqual({ created: 0, updated: 0, skipped: 2, errors: [] });
  });

  it("una fila con escudo local se empareja por nombre y conserva el escudo", async () => {
    await prisma.team.create({
      data: {
        id: "barcelona",
        name: "FC Barcelona",
        shortName: "Barça",
        league: "La Liga",
        logo: "/escudos/barcelona.png",
      },
    });
    espnReturns({ "esp.1": [BARCELONA] });

    const result = await syncTeams();
    expect(result).toMatchObject({ created: 0, updated: 1, errors: [] });

    const row = await prisma.team.findUniqueOrThrow({ where: { id: "barcelona" } });
    expect(row).toMatchObject({
      externalId: 83,
      // El guardarraíl de CLAUDE.md, punto 8: el sync nunca pisa un /escudos/.
      logo: "/escudos/barcelona.png",
      logoSource: LOGO("83"),
    });
  });

  it("una competición que falla se anota y no impide las demás", async () => {
    espnReturns({ "esp.1": [BARCELONA], "eng.1": new Error("ESPN caído") });

    const result = await syncTeams();

    expect(result.created).toBe(1);
    expect(result.errors).toEqual([
      `Error al obtener ${COMPETITION_BY_CODE["eng.1"].name}: Error: ESPN caído`,
    ]);
    expect(await prisma.team.count()).toBe(1);
  });

  it("más de 50 cambios se escriben en varios lotes, y llegan todos", async () => {
    const names = Array.from({ length: 60 }, (_, i) => `Equipo Numero ${i + 1}`);
    await prisma.team.createMany({
      data: names.map((name, i) => ({
        id: `equipo-${i + 1}`,
        name,
        shortName: name,
        league: "La Liga",
      })),
    });
    espnReturns({
      "esp.1": names.map((name, i) => espn(String(1000 + i), name)),
    });

    const result = await syncTeams();

    expect(result).toMatchObject({ created: 0, updated: 60, errors: [] });
    expect(await prisma.team.count({ where: { externalId: null } })).toBe(0);
  });
});
