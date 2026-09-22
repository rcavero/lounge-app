import { describe, expect, it } from "vitest";

import { COMPETITION_BY_CODE } from "../config/competitions";
import type { EspnCompetitor, EspnEvent, EspnTeam } from "../types";
import { toSuggestion } from "./suggestions";

const LA_LIGA = COMPETITION_BY_CODE["esp.1"];

function team(overrides: Partial<EspnTeam> = {}): EspnTeam {
  return {
    id: "83",
    displayName: "FC Barcelona",
    shortDisplayName: "Barcelona",
    logo: "https://a.espncdn.com/i/teamlogos/soccer/500/83.png",
    ...overrides,
  };
}

const HOME = team();
const AWAY = team({
  id: "86",
  displayName: "Real Madrid",
  shortDisplayName: "Real Madrid",
  logo: "https://a.espncdn.com/i/teamlogos/soccer/500/86.png",
});

function espnEvent(
  overrides: Partial<EspnEvent> = {},
  competitors: EspnCompetitor[] = [
    { homeAway: "home", team: HOME },
    { homeAway: "away", team: AWAY },
  ],
): EspnEvent {
  return {
    id: "401234567",
    // Formato real de ESPN: sin segundos.
    date: "2026-08-15T17:30Z",
    status: { type: { state: "pre" } },
    competitions: [{ id: "401234567", competitors }],
    ...overrides,
  };
}

describe("toSuggestion — partido válido", () => {
  it("mapea un partido programado a MatchSuggestion", () => {
    const teamMap = new Map([[83, "barcelona"]]);

    expect(toSuggestion(espnEvent(), LA_LIGA, teamMap)).toEqual({
      externalMatchId: 401234567,
      competition: "La Liga",
      competitionCode: "esp.1",
      homeTeam: {
        externalId: 83,
        name: "FC Barcelona",
        shortName: "Barcelona",
        crest: "https://a.espncdn.com/i/teamlogos/soccer/500/83.png",
        dbTeamId: "barcelona",
      },
      awayTeam: {
        externalId: 86,
        name: "Real Madrid",
        shortName: "Real Madrid",
        crest: "https://a.espncdn.com/i/teamlogos/soccer/500/86.png",
        // No está en el mapa: el equipo aún no existe en BD.
        dbTeamId: null,
      },
      utcDate: "2026-08-15T17:30:00.000Z",
      matchday: null,
      canCreate: true,
    });
  });

  it("marca los dos equipos como existentes si están en el mapa", () => {
    const teamMap = new Map([
      [83, "barcelona"],
      [86, "real-madrid"],
    ]);
    const suggestion = toSuggestion(espnEvent(), LA_LIGA, teamMap);

    expect(suggestion?.homeTeam.dbTeamId).toBe("barcelona");
    expect(suggestion?.awayTeam.dbTeamId).toBe("real-madrid");
  });

  it("identifica local y visitante por homeAway, no por el orden de la lista", () => {
    const suggestion = toSuggestion(
      espnEvent({}, [
        { homeAway: "away", team: AWAY },
        { homeAway: "home", team: HOME },
      ]),
      LA_LIGA,
      new Map(),
    );

    expect(suggestion?.homeTeam.externalId).toBe(83);
    expect(suggestion?.awayTeam.externalId).toBe(86);
  });

  it("toma el escudo de logos[0] si no hay logo, y cadena vacía si no hay ninguno", () => {
    const suggestion = toSuggestion(
      espnEvent({}, [
        {
          homeAway: "home",
          team: team({ logo: undefined, logos: [{ href: "https://x/83.png" }] }),
        },
        { homeAway: "away", team: team({ id: "86", logo: undefined }) },
      ]),
      LA_LIGA,
      new Map(),
    );

    expect(suggestion?.homeTeam.crest).toBe("https://x/83.png");
    expect(suggestion?.awayTeam.crest).toBe("");
  });

  it("usa displayName como nombre corto si falta shortDisplayName", () => {
    const suggestion = toSuggestion(
      espnEvent({}, [
        { homeAway: "home", team: team({ shortDisplayName: undefined }) },
        {
          homeAway: "away",
          team: team({ id: "86", displayName: " Real Madrid ", shortDisplayName: "   " }),
        },
      ]),
      LA_LIGA,
      new Map(),
    );

    expect(suggestion?.homeTeam.shortName).toBe("FC Barcelona");
    // Un shortDisplayName en blanco cuenta como ausente, y el respaldo se recorta.
    expect(suggestion?.awayTeam.shortName).toBe("Real Madrid");
  });

  it("normaliza la fecha a ISO en UTC", () => {
    const suggestion = toSuggestion(
      espnEvent({ date: "2026-08-15T19:30:00+02:00" }),
      LA_LIGA,
      new Map(),
    );

    expect(suggestion?.utcDate).toBe("2026-08-15T17:30:00.000Z");
  });
});

describe("toSuggestion — descarta lo que no se puede sugerir", () => {
  it.each([
    ["en juego", "in"],
    ["terminado", "post"],
  ])("un partido %s", (_label, state) => {
    expect(
      toSuggestion(espnEvent({ status: { type: { state } } }), LA_LIGA, new Map()),
    ).toBeNull();
  });

  it("un partido sin estado", () => {
    // ESPN es una API sin contrato: si no dice que está programado, no se ofrece.
    expect(toSuggestion(espnEvent({ status: undefined }), LA_LIGA, new Map())).toBeNull();
    expect(toSuggestion(espnEvent({ status: {} }), LA_LIGA, new Map())).toBeNull();
  });

  it("un partido sin local o sin visitante", () => {
    const onlyHome = espnEvent({}, [{ homeAway: "home", team: HOME }]);
    const onlyAway = espnEvent({}, [{ homeAway: "away", team: AWAY }]);

    expect(toSuggestion(onlyHome, LA_LIGA, new Map())).toBeNull();
    expect(toSuggestion(onlyAway, LA_LIGA, new Map())).toBeNull();
  });

  it("un partido sin competitions", () => {
    expect(toSuggestion(espnEvent({ competitions: [] }), LA_LIGA, new Map())).toBeNull();

    const withoutField = {
      ...espnEvent(),
      competitions: undefined,
    } as unknown as EspnEvent;
    expect(toSuggestion(withoutField, LA_LIGA, new Map())).toBeNull();
  });

  it("un id de partido que no es un número", () => {
    expect(toSuggestion(espnEvent({ id: "abc" }), LA_LIGA, new Map())).toBeNull();
    expect(toSuggestion(espnEvent({ id: "" }), LA_LIGA, new Map())).toBeNull();
  });

  it("un id de equipo que no es un número", () => {
    const badHome = espnEvent({}, [
      { homeAway: "home", team: team({ id: "abc" }) },
      { homeAway: "away", team: AWAY },
    ]);
    const badAway = espnEvent({}, [
      { homeAway: "home", team: HOME },
      { homeAway: "away", team: team({ id: "" }) },
    ]);

    expect(toSuggestion(badHome, LA_LIGA, new Map())).toBeNull();
    expect(toSuggestion(badAway, LA_LIGA, new Map())).toBeNull();
  });

  it("un id que no cabe en un entero seguro", () => {
    // Team.externalId es Int: un id así no se podría guardar sin perder dígitos.
    expect(
      toSuggestion(espnEvent({ id: "99999999999999999999" }), LA_LIGA, new Map()),
    ).toBeNull();
  });

  it("una fecha que no se puede interpretar", () => {
    expect(
      toSuggestion(espnEvent({ date: "no-es-una-fecha" }), LA_LIGA, new Map()),
    ).toBeNull();
    expect(toSuggestion(espnEvent({ date: "" }), LA_LIGA, new Map())).toBeNull();
  });
});
