import { describe, expect, it, vi } from "vitest";

import { resolveEventNaming, type TeamLookup } from "./title";

const TEAMS: Record<string, { shortName: string }> = {
  vcf: { shortName: "Valencia" },
  rbb: { shortName: "Betis" },
};

const findTeam: TeamLookup = async (id) => TEAMS[id] ?? null;

describe("resolveEventNaming — fútbol", () => {
  it("título con los nombres cortos y los equipos por id", async () => {
    const naming = await resolveEventNaming(
      { competition: "La Liga", homeTeamId: "vcf", awayTeamId: "rbb" },
      findTeam,
    );

    expect(naming).toEqual({
      title: "Valencia vs Betis",
      homeTeamId: "vcf",
      awayTeamId: "rbb",
      homeTeamName: null,
      awayTeamName: null,
    });
  });

  it("sin competición también es fútbol", async () => {
    const naming = await resolveEventNaming(
      { homeTeamId: "vcf", awayTeamId: "rbb" },
      findTeam,
    );

    expect(naming?.title).toBe("Valencia vs Betis");
  });

  it("ignora los nombres libres", async () => {
    const naming = await resolveEventNaming(
      { homeTeamId: "vcf", awayTeamId: "rbb", homeTeamName: "X", awayTeamName: "Y" },
      findTeam,
    );

    expect(naming).toMatchObject({ homeTeamName: null, awayTeamName: null });
  });

  it.each([
    ["el local", { homeTeamId: "nadie", awayTeamId: "rbb" }],
    ["el visitante", { homeTeamId: "vcf", awayTeamId: "nadie" }],
  ])("si no existe %s, null", async (_label, ids) => {
    expect(await resolveEventNaming(ids, findTeam)).toBeNull();
  });

  it("busca los equipos uno detrás de otro: si el primero lanza, el segundo no se pide", async () => {
    const lookup = vi.fn<TeamLookup>().mockRejectedValueOnce(new Error("sin id"));

    await expect(resolveEventNaming({ awayTeamId: "rbb" }, lookup)).rejects.toThrow(
      "sin id",
    );
    expect(lookup).toHaveBeenCalledTimes(1);
  });
});

describe("resolveEventNaming — deporte manual", () => {
  it("«local vs visitante» con los nombres recortados, sin equipos", async () => {
    const lookup = vi.fn<TeamLookup>();

    const naming = await resolveEventNaming(
      {
        competition: "Baloncesto",
        homeTeamName: "  Valencia Basket ",
        awayTeamName: "Real Madrid",
        homeTeamId: "vcf",
      },
      lookup,
    );

    expect(naming).toEqual({
      title: "Valencia Basket vs Real Madrid",
      homeTeamId: null,
      awayTeamId: null,
      homeTeamName: "Valencia Basket",
      awayTeamName: "Real Madrid",
    });
    // No consulta la base de datos.
    expect(lookup).not.toHaveBeenCalled();
  });

  // Estos tres dejaban antes «Velada vs », « vs Real Madrid» y « vs » (RCA-279).
  it("sin visitante, el título es solo el local", async () => {
    const naming = await resolveEventNaming(
      { competition: "Boxeo", homeTeamName: "Velada" },
      findTeam,
    );

    expect(naming).toMatchObject({ title: "Velada", awayTeamName: null });
  });

  it("sin local, el título es solo el visitante", async () => {
    const naming = await resolveEventNaming(
      { competition: "Baloncesto", awayTeamName: "  Real Madrid " },
      findTeam,
    );

    expect(naming).toMatchObject({
      title: "Real Madrid",
      homeTeamName: null,
      awayTeamName: "Real Madrid",
    });
  });

  it("sin ningún nombre, el título es la competición", async () => {
    const naming = await resolveEventNaming({ competition: "Tenis" }, findTeam);

    expect(naming).toMatchObject({
      title: "Tenis",
      homeTeamName: null,
      awayTeamName: null,
    });
  });
});

describe("resolveEventNaming — motor", () => {
  it("el título es el gran premio y no hay visitante", async () => {
    const naming = await resolveEventNaming(
      {
        competition: "Fórmula 1",
        homeTeamName: " GP de España ",
        awayTeamName: "ignorado",
      },
      findTeam,
    );

    expect(naming).toEqual({
      title: "GP de España",
      homeTeamId: null,
      awayTeamId: null,
      homeTeamName: "GP de España",
      awayTeamName: null,
    });
  });

  it("sin nombre, el título es la competición", async () => {
    const naming = await resolveEventNaming(
      { competition: "Moto GP", homeTeamName: "   " },
      findTeam,
    );

    expect(naming).toMatchObject({ title: "Moto GP", homeTeamName: null });
  });
});
