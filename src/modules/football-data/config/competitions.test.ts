import { existsSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  COMPETITIONS,
  COMPETITION_BY_CODE,
  COMPETITION_BY_NAME,
  COMPETITION_EMBLEM,
  COMPETITION_LEAGUES,
  COMPETITION_NAMES,
  EMBLEM_SOURCES,
  LEGACY_COMPETITION_EMBLEM,
  LEGACY_COMPETITION_EMBLEM_SOURCE,
  MANUAL_SPORT_BY_NAME,
  MANUAL_SPORTS,
  MANUAL_SPORT_NAMES,
  TEAM_NAME_ALIASES,
  getSportEmoji,
  isManualSport,
  isMotorSport,
} from "./competitions";

const LEGACY_NAMES = Object.keys(LEGACY_COMPETITION_EMBLEM);

function duplicates(values: string[]): string[] {
  return values.filter((value, index) => values.indexOf(value) !== index);
}

describe("isManualSport", () => {
  it("reconoce los deportes manuales", () => {
    expect(isManualSport("Baloncesto")).toBe(true);
    expect(isManualSport("Fórmula 1")).toBe(true);
    expect(isManualSport("Otros")).toBe(true);
  });

  it("no reconoce las competiciones de fútbol", () => {
    expect(isManualSport("La Liga")).toBe(false);
    expect(isManualSport("Champions League")).toBe(false);
  });

  it("devuelve false si no hay competición", () => {
    expect(isManualSport(null)).toBe(false);
    expect(isManualSport(undefined)).toBe(false);
    expect(isManualSport("")).toBe(false);
  });

  it("distingue mayúsculas: el nombre tiene que ser exacto", () => {
    expect(isManualSport("baloncesto")).toBe(false);
  });

  it("no da por deporte manual las claves del prototipo", () => {
    // Antes sí: MANUAL_SPORT_BY_NAME era un objeto normal, y "constructor" encontraba
    // la función de Object.prototype (RCA-274).
    for (const key of ["constructor", "toString", "__proto__", "hasOwnProperty"]) {
      expect(isManualSport(key), key).toBe(false);
    }
  });
});

describe("isMotorSport", () => {
  it("solo Moto GP y Fórmula 1 son motor", () => {
    const motor = MANUAL_SPORTS.filter((sport) => isMotorSport(sport.name)).map(
      (sport) => sport.name,
    );
    expect(motor).toEqual(["Moto GP", "Fórmula 1"]);
  });

  it("devuelve false para fútbol y para vacío", () => {
    expect(isMotorSport("La Liga")).toBe(false);
    expect(isMotorSport(null)).toBe(false);
    expect(isMotorSport("")).toBe(false);
  });

  it("no se deja engañar por las claves del prototipo", () => {
    // A diferencia de isManualSport: Object.prototype.constructor no tiene
    // `isMotorSport`, así que el resultado es false de todas formas.
    expect(isMotorSport("constructor")).toBe(false);
  });
});

describe("getSportEmoji", () => {
  it("devuelve el emoji de cada deporte manual", () => {
    expect(getSportEmoji("Baloncesto")).toBe("🏀");
    expect(getSportEmoji("Boxeo")).toBe("🥊");
  });

  it("devuelve null para el fútbol, que pinta escudos y no emoji", () => {
    expect(getSportEmoji("La Liga")).toBeNull();
  });

  it("devuelve null si no hay competición o no se conoce", () => {
    expect(getSportEmoji(null)).toBeNull();
    expect(getSportEmoji(undefined)).toBeNull();
    expect(getSportEmoji("")).toBeNull();
    expect(getSportEmoji("Curling")).toBeNull();
    expect(getSportEmoji("constructor")).toBeNull();
  });

  it("todos los deportes manuales tienen emoji", () => {
    for (const sport of MANUAL_SPORTS) {
      expect(sport.emoji, sport.name).not.toBe("");
    }
  });
});

describe("los mapas por nombre no tienen prototipo (RCA-274)", () => {
  const MAPS = {
    COMPETITION_BY_CODE,
    COMPETITION_BY_NAME,
    TEAM_NAME_ALIASES,
    LEGACY_COMPETITION_EMBLEM,
    LEGACY_COMPETITION_EMBLEM_SOURCE,
    COMPETITION_EMBLEM,
    EMBLEM_SOURCES,
    MANUAL_SPORT_BY_NAME,
    COMPETITION_LEAGUES,
  };

  it.each(Object.entries(MAPS))(
    "%s: una clave del prototipo no encuentra nada",
    (_, map) => {
      for (const key of ["constructor", "toString", "__proto__", "hasOwnProperty"]) {
        expect(map[key], key).toBeUndefined();
      }
    },
  );

  it("siguen encontrando sus claves de verdad", () => {
    expect(COMPETITION_BY_NAME["La Liga"]?.code).toBe("esp.1");
    expect(TEAM_NAME_ALIASES.Lyon).toBe("Olympique Lyonnais");
    expect(COMPETITION_LEAGUES.Championship).toEqual(["Championship"]);
    expect(Object.keys(MANUAL_SPORT_BY_NAME)).toEqual(MANUAL_SPORT_NAMES);
  });
});

describe("consistencia de la configuración", () => {
  it("no hay nombres, slugs ni emblemas repetidos entre las competiciones", () => {
    // `name` es la clave con la que se guarda Event.competition: dos competiciones con
    // el mismo nombre serían indistinguibles en la BD.
    expect(duplicates(COMPETITIONS.map((c) => c.name))).toEqual([]);
    expect(duplicates(COMPETITIONS.map((c) => c.code))).toEqual([]);
    expect(duplicates(COMPETITIONS.map((c) => c.emblem))).toEqual([]);
    expect(duplicates(MANUAL_SPORT_NAMES)).toEqual([]);
  });

  it("ningún deporte manual se llama igual que una competición de fútbol", () => {
    // Si colisionaran, un evento de fútbol se trataría como deporte manual y perdería
    // sus equipos al guardarse.
    const football = new Set([...COMPETITION_NAMES, ...LEGACY_NAMES]);
    expect(MANUAL_SPORT_NAMES.filter((name) => football.has(name))).toEqual([]);
  });

  it("todos los emblemas son rutas locales bajo /competiciones/", () => {
    // La web pública no hace ninguna petición a ESPN: si un emblema apuntara fuera,
    // el navegador del cliente volvería a pedir la imagen a un tercero.
    for (const path of Object.values(COMPETITION_EMBLEM)) {
      expect(path).toMatch(/^\/competiciones\/[a-z0-9-]+\.png$/);
    }
  });

  it("el fichero de cada emblema existe en public/", () => {
    // Un emblema sin fichero no rompe nada visible en el build: sale una imagen rota
    // en producción. Este test lo detecta antes.
    const missing = Object.values(COMPETITION_EMBLEM).filter(
      (path) => !existsSync(join(process.cwd(), "public", path)),
    );
    expect(missing).toEqual([]);
  });

  it("cada emblema tiene su URL de origen para el script de descarga", () => {
    for (const path of Object.values(COMPETITION_EMBLEM)) {
      expect(EMBLEM_SOURCES[path], path).toMatch(/^https:\/\//);
    }
  });

  it("cada competición, también las retiradas, filtra el desplegable de equipos", () => {
    // Sin entrada en COMPETITION_LEAGUES el formulario de evento muestra una lista de
    // equipos vacía, sin ningún error.
    for (const name of [...COMPETITION_NAMES, ...LEGACY_NAMES]) {
      expect(COMPETITION_LEAGUES[name], name).toBeDefined();
      expect(COMPETITION_LEAGUES[name].length, name).toBeGreaterThan(0);
    }
  });

  it("cada liga doméstica filtra solo sus propios equipos", () => {
    for (const competition of COMPETITIONS.filter((c) => c.isDomestic)) {
      expect(COMPETITION_LEAGUES[competition.name]).toEqual([competition.league]);
    }
  });

  it("las competiciones UEFA de clubes admiten los equipos de todas las ligas domésticas", () => {
    const domesticLeagues = COMPETITIONS.filter((c) => c.isDomestic).map((c) => c.league);

    for (const name of ["Champions League", "Europa League", "Conference League"]) {
      expect(COMPETITION_LEAGUES[name]).toEqual(expect.arrayContaining(domesticLeagues));
      expect(COMPETITION_LEAGUES[name]).toContain(name);
    }
  });
});
