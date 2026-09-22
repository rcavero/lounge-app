import { describe, expect, it } from "vitest";

import {
  LOCAL_LOGO_PREFIX,
  localLogoPath,
  nameTokens,
  normalizeTeamName,
  slugify,
  teamShortName,
  toIntId,
} from "./team-sync";

describe("nameTokens", () => {
  it("quita tildes, pasa a minúsculas y descarta las palabras vacías", () => {
    expect(nameTokens("Club Atlético de Madrid")).toEqual(["atletico", "madrid"]);
  });

  it("trata la puntuación como separador", () => {
    expect(nameTokens("Brighton & Hove Albion")).toEqual(["brighton", "hove", "albion"]);
    expect(nameTokens("Paris Saint-Germain")).toEqual(["paris", "saint", "germain"]);
  });

  it("devuelve una lista vacía si todo son palabras vacías", () => {
    expect(nameTokens("Club de Fútbol")).toEqual([]);
    expect(nameTokens("")).toEqual([]);
  });
});

describe("normalizeTeamName", () => {
  it.each([
    ["FC Barcelona", "Barcelona"],
    ["Real Madrid CF", "Real Madrid"],
    ["Club Atlético de Madrid", "Atlético Madrid"],
    ["Real Betis Balompié", "Real Betis Balompie"],
  ])("empareja %s con %s", (a, b) => {
    // Es lo que permite reconocer un equipo del proveedor anterior con el nombre
    // que usa ESPN, sin crear un duplicado.
    expect(normalizeTeamName(a)).toBe(normalizeTeamName(b));
    expect(normalizeTeamName(a)).not.toBe("");
  });

  it.each([
    ["Rangers", "Queens Park Rangers"],
    ["Real Madrid", "Real Madrid Castilla"],
    ["Inter", "Inter Miami"],
  ])("NO empareja %s con %s", (a, b) => {
    // Deliberadamente conservadora: un emparejado erróneo reasigna en silencio los
    // eventos históricos al equipo equivocado. Un duplicado, en cambio, se detecta.
    expect(normalizeTeamName(a)).not.toBe(normalizeTeamName(b));
  });

  it("un nombre hecho solo de palabras vacías se normaliza a cadena vacía", () => {
    // planTeam se niega a emparejar por una clave vacía: coincidiría con cualquier
    // otro caso degenerado.
    expect(normalizeTeamName("Club de Fútbol")).toBe("");
  });

  it("COMPORTAMIENTO ACTUAL: las letras que no se descomponen desaparecen", () => {
    // NFD separa la tilde de la "é", pero "ø" y "ß" son letras propias y caen en el
    // filtro [^a-z0-9]. Es inofensivo mientras ambos lados pasen por la misma función.
    expect(normalizeTeamName("Bodø/Glimt")).toBe("bodglimt");
  });
});

describe("slugify", () => {
  it("genera un slug en minúsculas separado por guiones", () => {
    expect(slugify("Atlético Madrid")).toBe("atletico-madrid");
    expect(slugify("Brighton & Hove Albion")).toBe("brighton-hove-albion");
  });

  it("colapsa separadores y recorta los guiones de los extremos", () => {
    expect(slugify("  Real   Madrid  ")).toBe("real-madrid");
    expect(slugify("--Real--Madrid--")).toBe("real-madrid");
  });

  it("devuelve cadena vacía si no queda ningún carácter útil", () => {
    // planCreate cae entonces a `team-{externalId}`.
    expect(slugify("---")).toBe("");
    expect(slugify("")).toBe("");
  });

  it("no descarta palabras vacías, a diferencia de normalizeTeamName", () => {
    // El slug es un Team.id: tiene que ser legible, no servir para emparejar.
    expect(slugify("Real Club Celta de Vigo")).toBe("real-club-celta-de-vigo");
  });
});

describe("toIntId", () => {
  it("convierte el id de ESPN a entero", () => {
    expect(toIntId("83")).toBe(83);
    expect(toIntId("401234567")).toBe(401234567);
  });

  it("devuelve null si no hay nada que convertir", () => {
    expect(toIntId(undefined)).toBeNull();
    expect(toIntId("")).toBeNull();
    expect(toIntId("abc")).toBeNull();
  });

  it("devuelve null si el número no cabe en un entero seguro", () => {
    expect(toIntId("99999999999999999999")).toBeNull();
  });

  it("COMPORTAMIENTO ACTUAL: acepta un prefijo numérico, como parseInt", () => {
    // Inofensivo con los ids reales de ESPN, que son siempre numéricos. Se fija aquí
    // para que un cambio a una conversión estricta sea una decisión, no un accidente.
    expect(toIntId("83abc")).toBe(83);
    expect(toIntId(" 83")).toBe(83);
    expect(toIntId("12.7")).toBe(12);
  });
});

describe("teamShortName", () => {
  it("usa shortDisplayName, recortado", () => {
    expect(
      teamShortName({
        id: "83",
        displayName: "FC Barcelona",
        shortDisplayName: " Barça ",
      }),
    ).toBe("Barça");
  });

  it("cae a displayName, recortado, si shortDisplayName falta o está en blanco", () => {
    expect(teamShortName({ id: "83", displayName: " FC Barcelona " })).toBe(
      "FC Barcelona",
    );
    expect(
      teamShortName({ id: "83", displayName: "FC Barcelona", shortDisplayName: "  " }),
    ).toBe("FC Barcelona");
  });
});

describe("localLogoPath", () => {
  it("construye la ruta bajo /escudos/ con la extensión que se le pasa", () => {
    // La extensión no se asume: ESPN sirve algunos SVG bajo una URL acabada en .png.
    expect(localLogoPath("barcelona", "png")).toBe("/escudos/barcelona.png");
    expect(localLogoPath("barcelona", "svg")).toBe("/escudos/barcelona.svg");
  });

  it("empieza por el prefijo que el sync usa para no pisar los escudos locales", () => {
    expect(localLogoPath("x", "png").startsWith(LOCAL_LOGO_PREFIX)).toBe(true);
    expect(LOCAL_LOGO_PREFIX).toBe("/escudos/");
  });
});
