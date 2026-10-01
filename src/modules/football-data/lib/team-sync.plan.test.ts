import { describe, expect, it } from "vitest";

import { COMPETITION_BY_CODE } from "../config/competitions";
import type { EspnTeam } from "../types";
import {
  buildTeamIndex,
  planCreate,
  planTeam,
  type PlannedCreate,
  type PlannedUpdate,
  type TeamRow,
} from "./team-sync";

const LA_LIGA = COMPETITION_BY_CODE["esp.1"];
const ESPN_LOGO = "https://a.espncdn.com/i/teamlogos/soccer/500/83.png";
const NEW_ESPN_LOGO = "https://a.espncdn.com/i/teamlogos/soccer/500-v2/83.png";

function row(overrides: Partial<TeamRow> = {}): TeamRow {
  return {
    id: "barcelona",
    externalId: 83,
    name: "Barcelona",
    shortName: "Barcelona",
    logo: "/escudos/barcelona.png",
    logoSource: ESPN_LOGO,
    ...overrides,
  };
}

function apiTeam(overrides: Partial<EspnTeam> = {}): EspnTeam {
  return {
    id: "83",
    displayName: "Barcelona",
    shortDisplayName: "Barcelona",
    logo: ESPN_LOGO,
    ...overrides,
  };
}

/** Ejecuta planTeam sobre un índice construido con esas filas. */
function plan(team: EspnTeam, rows: TeamRow[]) {
  const index = buildTeamIndex(rows);
  const updates: PlannedUpdate[] = [];
  const resolved = planTeam(team, index, updates);
  return { resolved, updates, index };
}

describe("buildTeamIndex", () => {
  it("indexa por externalId solo las filas que lo tienen", () => {
    const linked = row();
    const unlinked = row({
      id: "girona",
      externalId: null,
      name: "Girona FC",
      shortName: "Girona",
    });
    const index = buildTeamIndex([linked, unlinked]);

    expect(index.byExternalId.get(83)).toBe(linked);
    expect(index.byId.get("girona")).toBe(unlinked);
    expect([...index.byExternalId.values()]).not.toContain(unlinked);
  });

  it("indexa por nombre solo las filas SIN externalId", () => {
    // Una fila ya vinculada no puede volver a emparejarse por nombre: se llevaría el
    // equipo de otro proveedor que casualmente se llame igual.
    const index = buildTeamIndex([
      row(),
      row({ id: "girona", externalId: null, name: "Girona FC", shortName: "Girona" }),
    ]);

    expect(index.byNormalizedName.has("barcelona")).toBe(false);
    expect(index.byNormalizedName.has("girona")).toBe(true);
  });

  it("si dos filas se normalizan igual, gana la primera", () => {
    const first = row({ id: "fc-barcelona", externalId: null, name: "FC Barcelona" });
    const second = row({ id: "barca", externalId: null, name: "Barcelona" });

    expect(buildTeamIndex([first, second]).byNormalizedName.get("barcelona")).toBe(first);
  });

  it("no indexa un nombre que se normaliza a cadena vacía", () => {
    const index = buildTeamIndex([
      row({ id: "cd", externalId: null, name: "Club Deportivo", shortName: "CD" }),
    ]);
    expect(index.byNormalizedName.size).toBe(0);
  });
});

describe("planTeam — 1. por externalId", () => {
  it("sin cambios, no encola ningún update", () => {
    // La regresión cara: sin esto, cada ejecución del cron vuelve a escribir cientos
    // de equipos que ya están como deben.
    const { resolved, updates } = plan(apiTeam(), [row()]);

    expect(resolved).toBe(true);
    expect(updates).toEqual([]);
  });

  it("sin cambios y con escudo remoto, tampoco escribe", () => {
    const { updates } = plan(apiTeam(), [row({ logo: ESPN_LOGO })]);
    expect(updates).toEqual([]);
  });

  it("si cambia el nombre, encola el update y actualiza la fila en memoria", () => {
    const current = row();
    const { updates } = plan(apiTeam({ displayName: "FC Barcelona" }), [current]);

    expect(updates).toEqual([
      {
        id: "barcelona",
        externalId: 83,
        name: "FC Barcelona",
        shortName: "Barcelona",
        logo: "/escudos/barcelona.png",
        logoSource: ESPN_LOGO,
      },
    ]);
    expect(current.name).toBe("FC Barcelona");
  });
});

describe("planTeam — el escudo local no se pisa", () => {
  it("con escudo local y URL nueva en ESPN, cambia logoSource pero NO logo", () => {
    // El bug que reescribía 430 escudos: el primer cron tras descargarlos los volvía a
    // apuntar a ESPN. La URL nueva se guarda, pero solo como origen.
    const { updates } = plan(apiTeam({ logo: NEW_ESPN_LOGO }), [row()]);

    expect(updates).toHaveLength(1);
    expect(updates[0].logo).toBe("/escudos/barcelona.png");
    expect(updates[0].logoSource).toBe(NEW_ESPN_LOGO);
  });

  it("con escudo remoto y URL nueva en ESPN, sí cambia logo", () => {
    const { updates } = plan(apiTeam({ logo: NEW_ESPN_LOGO }), [
      row({ logo: ESPN_LOGO }),
    ]);

    expect(updates[0].logo).toBe(NEW_ESPN_LOGO);
    expect(updates[0].logoSource).toBe(NEW_ESPN_LOGO);
  });

  it("si ESPN deja de mandar escudo, se conserva el que había", () => {
    const { updates } = plan(apiTeam({ logo: undefined }), [row({ logo: ESPN_LOGO })]);
    expect(updates).toEqual([]);
  });
});

describe("planTeam — 2. por nombre normalizado", () => {
  it("empareja una fila sin externalId y le escribe el externalId", () => {
    const legacy = row({
      id: "fc-barcelona",
      externalId: null,
      name: "FC Barcelona",
      shortName: "Barça",
    });
    const { resolved, updates, index } = plan(apiTeam(), [legacy]);

    expect(resolved).toBe(true);
    expect(updates).toEqual([
      {
        id: "fc-barcelona",
        externalId: 83,
        name: "Barcelona",
        shortName: "Barcelona",
        logo: "/escudos/barcelona.png",
        logoSource: ESPN_LOGO,
      },
    ]);
    // Team.id no se toca nunca: lo referencian los eventos históricos.
    expect(updates[0].id).toBe("fc-barcelona");
    expect(index.byExternalId.get(83)).toBe(legacy);
  });

  it("encola el update aunque nombre y escudo coincidan: falta el externalId", () => {
    // Si solo se comparara contra la fila ya mutada en memoria, el externalId nunca
    // llegaría a la base de datos y el equipo se emparejaría por nombre en cada cron.
    const { updates } = plan(apiTeam(), [row({ externalId: null })]);

    expect(updates).toHaveLength(1);
    expect(updates[0].externalId).toBe(83);
  });

  it("una fila emparejada no se lleva un segundo equipo con el mismo nombre", () => {
    const legacy = row({ id: "fc-barcelona", externalId: null, name: "FC Barcelona" });
    const index = buildTeamIndex([legacy]);
    const updates: PlannedUpdate[] = [];

    expect(planTeam(apiTeam(), index, updates)).toBe(true);
    // Otro equipo de ESPN que también se normaliza a "barcelona".
    expect(
      planTeam(apiTeam({ id: "999", shortDisplayName: "Barcelona B" }), index, updates),
    ).toBe(false);
    expect(updates).toHaveLength(1);
  });

  it("empareja por el alias declarado cuando el nombre de ESPN es más corto", () => {
    // TEAM_NAME_ALIASES: "Lyon" en ESPN es "Olympique Lyonnais" en BD.
    const legacy = row({
      id: "olympique-lyonnais",
      externalId: null,
      name: "Olympique Lyonnais",
      shortName: "Olympique Lyonnais",
      logo: null,
      logoSource: null,
    });
    const { resolved, updates } = plan(
      apiTeam({ id: "167", displayName: "Lyon", shortDisplayName: "Lyon" }),
      [legacy],
    );

    expect(resolved).toBe(true);
    expect(updates[0].id).toBe("olympique-lyonnais");
    expect(updates[0].externalId).toBe(167);
  });

  it("no empareja por un nombre que se normaliza a cadena vacía", () => {
    const { resolved } = plan(
      apiTeam({
        id: "500",
        displayName: "Club de Fútbol",
        shortDisplayName: "Club de Fútbol",
      }),
      [row({ id: "cd", externalId: null, name: "Club Deportivo", shortName: "CD" })],
    );
    expect(resolved).toBe(false);
  });

  it("no roba por nombre una fila ya vinculada a otro externalId", () => {
    const { resolved, updates } = plan(apiTeam(), [row({ externalId: 999 })]);

    expect(resolved).toBe(false);
    expect(updates).toEqual([]);
  });
});

describe("planTeam — 3. por slug sobre Team.id", () => {
  it("empareja un equipo del seed original cuyo id es el slug del nombre corto", () => {
    const seeded = row({
      id: "real-madrid",
      externalId: null,
      name: "RM",
      shortName: "RM",
    });
    const { resolved, updates } = plan(
      apiTeam({
        id: "86",
        displayName: "Real Madrid CF Femenino",
        shortDisplayName: "Real Madrid",
      }),
      [seeded],
    );

    expect(resolved).toBe(true);
    expect(updates[0].id).toBe("real-madrid");
    expect(updates[0].externalId).toBe(86);
  });
});

describe("planTeam — sin resolver", () => {
  it("devuelve false y no encola nada si no hay ninguna coincidencia", () => {
    const { resolved, updates } = plan(
      apiTeam({ id: "9812", displayName: "Girona", shortDisplayName: "Girona" }),
      [row()],
    );

    expect(resolved).toBe(false);
    expect(updates).toEqual([]);
  });

  it("ignora un equipo sin id utilizable, sin mandarlo a crear", () => {
    // Devuelve true: "resuelto" en el sentido de que no pasa a la segunda pasada.
    const { resolved, updates } = plan(apiTeam({ id: "abc" }), []);

    expect(resolved).toBe(true);
    expect(updates).toEqual([]);
  });
});

describe("planCreate", () => {
  function create(team: EspnTeam, rows: TeamRow[] = []) {
    const index = buildTeamIndex(rows);
    const creates: PlannedCreate[] = [];
    planCreate(team, LA_LIGA, index, creates);
    return { creates, index };
  }

  const GIRONA = apiTeam({
    id: "9812",
    displayName: "Girona FC",
    shortDisplayName: "Girona",
    logo: "https://a.espncdn.com/i/teamlogos/soccer/500/9812.png",
  });

  it("con el slug libre, lo usa como id y apunta el escudo a ESPN", () => {
    // Vercel no puede escribir en public/: el escudo local llega después, al ejecutar
    // scripts/download-crests.ts.
    const { creates, index } = create(GIRONA);

    expect(creates).toEqual([
      {
        id: "girona",
        externalId: 9812,
        name: "Girona FC",
        shortName: "Girona",
        logo: "https://a.espncdn.com/i/teamlogos/soccer/500/9812.png",
        logoSource: "https://a.espncdn.com/i/teamlogos/soccer/500/9812.png",
        league: "La Liga",
      },
    ]);
    expect(index.byId.has("girona")).toBe(true);
    expect(index.byExternalId.has(9812)).toBe(true);
  });

  it("con el slug ocupado, le añade el externalId para no chocar con la clave primaria", () => {
    const { creates } = create(GIRONA, [row({ id: "girona", externalId: 1 })]);
    expect(creates[0].id).toBe("girona-9812");
  });

  it("dos equipos nuevos con el mismo nombre corto en la misma ejecución no chocan", () => {
    const index = buildTeamIndex([]);
    const creates: PlannedCreate[] = [];
    planCreate(GIRONA, LA_LIGA, index, creates);
    planCreate({ ...GIRONA, id: "7777" }, LA_LIGA, index, creates);

    expect(creates.map((c) => c.id)).toEqual(["girona", "girona-7777"]);
  });

  it("si el nombre corto no deja slug, usa team-{externalId}", () => {
    const { creates } = create(
      apiTeam({ id: "5555", displayName: "北京国安", shortDisplayName: "北京国安" }),
    );
    expect(creates[0].id).toBe("team-5555");
  });

  it("sin escudo en ESPN, logo y logoSource quedan a null", () => {
    const { creates } = create({ ...GIRONA, logo: undefined });

    expect(creates[0].logo).toBeNull();
    expect(creates[0].logoSource).toBeNull();
  });

  it("no crea nada si el id no es utilizable", () => {
    const { creates } = create({ ...GIRONA, id: "" });
    expect(creates).toEqual([]);
  });
});
