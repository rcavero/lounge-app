import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { EspnEvent, EspnTeam } from "../types";
import { getCompetitionTeams, getScheduledMatches } from "./api-client";

/**
 * El cliente HTTP de ESPN, con `fetch` sustituido: reintentos, timeouts y las dos formas
 * que tiene ESPN de decir "no existe". Llega con P6, al fijar el umbral de cobertura
 * sobre `lib/`: hasta entonces solo estaban probadas las funciones puras del fichero.
 *
 * Los reintentos esperan 500 ms y 1500 ms, y el timeout son 15 s: todo con temporizadores
 * falsos, para que la suite no duerma.
 */

const fetchMock = vi.fn<typeof fetch>();

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function teamsBody(teams: EspnTeam[]) {
  return { sports: [{ leagues: [{ teams: teams.map((team) => ({ team })) }] }] };
}

const BARCELONA: EspnTeam = { id: "83", displayName: "Barcelona" };

/** Resuelve la promesa dejando correr los temporizadores del backoff. */
async function settle<T>(promise: Promise<T>): Promise<T> {
  await vi.runAllTimersAsync();
  return promise;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("fetchApi, a través de getCompetitionTeams", () => {
  it("pide la plantilla de la competición y devuelve sus equipos", async () => {
    fetchMock.mockResolvedValueOnce(json(teamsBody([BARCELONA])));

    await expect(settle(getCompetitionTeams("esp.1"))).resolves.toEqual([BARCELONA]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      "https://site.api.espn.com/apis/site/v2/sports/soccer/esp.1/teams",
    );
  });

  it("un 404 HTTP es 'no existe': lista vacía y sin reintentos", async () => {
    fetchMock.mockResolvedValueOnce(json({}, 404));

    await expect(settle(getCompetitionTeams("xxx.1"))).resolves.toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('un 200 con { code: 404 } también es "no existe"', async () => {
    fetchMock.mockResolvedValueOnce(json({ code: 404 }));

    await expect(settle(getCompetitionTeams("xxx.1"))).resolves.toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("un 500 transitorio se reintenta y el segundo intento vale", async () => {
    fetchMock
      .mockResolvedValueOnce(json({}, 500))
      .mockResolvedValueOnce(json(teamsBody([BARCELONA])));

    await expect(settle(getCompetitionTeams("esp.1"))).resolves.toEqual([BARCELONA]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("tras tres fallos seguidos lanza, con el último motivo", async () => {
    fetchMock.mockImplementation(async () => json({}, 429));

    const result = getCompetitionTeams("esp.1");
    const assertion = expect(result).rejects.toThrow(
      "Fallo al pedir /esp.1/teams: ESPN respondió 429",
    );
    await vi.runAllTimersAsync();
    await assertion;
    // Un intento y dos reintentos.
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("un 4xx que no es 404 también acaba en error", async () => {
    fetchMock.mockImplementation(async () => json({}, 403));

    const result = getCompetitionTeams("esp.1");
    const assertion = expect(result).rejects.toThrow(
      "ESPN respondió 403 para /esp.1/teams",
    );
    await vi.runAllTimersAsync();
    await assertion;
  });

  it("aborta la petición que no responde en 15 s y reintenta", async () => {
    // La primera se queda colgada hasta que la aborte el timeout.
    fetchMock
      .mockImplementationOnce(
        (_url, init) =>
          new Promise((_resolve, reject) => {
            init?.signal?.addEventListener("abort", () => reject(new Error("aborted")));
          }),
      )
      .mockResolvedValueOnce(json(teamsBody([BARCELONA])));

    await expect(settle(getCompetitionTeams("esp.1"))).resolves.toEqual([BARCELONA]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe("getScheduledMatches", () => {
  const NOW = new Date("2026-09-25T12:00:00Z");

  function event(id: string, date: string): EspnEvent {
    return { id, date } as EspnEvent;
  }

  beforeEach(() => {
    vi.setSystemTime(NOW);
  });

  it("junta los meses que toca la ventana, sin duplicados y solo dentro de ella", async () => {
    // Del 25/09 a +14 días: septiembre y octubre.
    fetchMock
      .mockResolvedValueOnce(
        json({
          leagues: [{ name: "LaLiga" }],
          events: [
            event("pasado", "2026-09-20T18:00Z"),
            event("a", "2026-09-27T18:00Z"),
            event("sin-fecha", "no es una fecha"),
          ],
        }),
      )
      .mockResolvedValueOnce(
        json({
          leagues: [{ name: "LaLiga" }],
          // "a" repetido por el margen de un día entre meses; "lejos" cae fuera.
          events: [
            event("a", "2026-09-27T18:00Z"),
            event("b", "2026-10-04T18:00Z"),
            event("lejos", "2026-10-30T18:00Z"),
          ],
        }),
      );

    const result = await settle(getScheduledMatches("esp.1"));

    expect(fetchMock.mock.calls.map(([url]) => String(url).split("dates=")[1])).toEqual([
      "202609",
      "202610",
    ]);
    expect(result?.events?.map((e) => e.id)).toEqual(["a", "b"]);
    expect(result?.leagues).toEqual([{ name: "LaLiga" }]);
  });

  it("si ningún mes existe, null: quien llama se salta la competición", async () => {
    fetchMock.mockImplementation(async () => json({ code: 404 }));

    await expect(settle(getScheduledMatches("xxx.1"))).resolves.toBeNull();
  });
});
