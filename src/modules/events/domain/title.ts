/**
 * El título y los participantes de un evento, según el tipo de deporte.
 *
 * Estaba copiado literalmente en `createEvent` y en `updateEvent`. Tres ramas:
 * - **Motor** (Fórmula 1, Moto GP): un solo participante, el gran premio. Sin nombre, el
 *   título es la competición.
 * - **Manual** (baloncesto, boxeo…): «local vs visitante» con nombres libres, sin
 *   equipos de la base de datos.
 * - **Fútbol**: los dos equipos por id, y el título con sus nombres cortos.
 *
 * Módulo plano, sin `"use server"` ni Prisma. La búsqueda de equipos entra como función
 * (`findTeam`) para poder probar la rama de fútbol sin base de datos.
 */
import { isManualSport, isMotorSport } from "@/modules/football-data/config/competitions";

export interface EventNamingInput {
  competition?: string;
  homeTeamId?: string;
  awayTeamId?: string;
  homeTeamName?: string;
  awayTeamName?: string;
}

export interface EventNaming {
  title: string;
  homeTeamId: string | null;
  awayTeamId: string | null;
  homeTeamName: string | null;
  awayTeamName: string | null;
}

export type TeamLookup = (id: string) => Promise<{ shortName: string } | null>;

/**
 * Devuelve `null` si en la rama de fútbol no existe alguno de los dos equipos.
 *
 * Los dos equipos se buscan **uno detrás de otro**, no con `Promise.all`: así estaba, y
 * si el primero lanza (por ejemplo, porque `homeTeamId` no viene), el segundo ni se pide.
 *
 * ⚠️ Deporte manual sin visitante: el título queda `"Velada vs "`, con espacio final.
 * Es el comportamiento de siempre y hay un test que lo fija; no se arregla dentro de un
 * refactor. Anotado en RCA-230.
 */
export async function resolveEventNaming(
  data: EventNamingInput,
  findTeam: TeamLookup,
): Promise<EventNaming | null> {
  let title: string;
  let homeTeamIdFinal: string | null = null;
  let awayTeamIdFinal: string | null = null;
  let homeTeamNameFinal: string | null = null;
  let awayTeamNameFinal: string | null = null;

  if (isManualSport(data.competition)) {
    // Deporte manual: sin equipos en BD
    if (isMotorSport(data.competition)) {
      const gpName = data.homeTeamName?.trim() || "";
      title = gpName || data.competition || "Gran Premio";
      homeTeamNameFinal = gpName || null;
    } else {
      const home = data.homeTeamName?.trim() || "";
      const away = data.awayTeamName?.trim() || "";
      title = `${home} vs ${away}`;
      homeTeamNameFinal = home || null;
      awayTeamNameFinal = away || null;
    }
  } else {
    // Fútbol: buscar equipos en BD
    const homeTeam = await findTeam(data.homeTeamId!);
    const awayTeam = await findTeam(data.awayTeamId!);

    if (!homeTeam || !awayTeam) {
      return null;
    }

    title = `${homeTeam.shortName} vs ${awayTeam.shortName}`;
    homeTeamIdFinal = data.homeTeamId!;
    awayTeamIdFinal = data.awayTeamId!;
  }

  return {
    title,
    homeTeamId: homeTeamIdFinal,
    awayTeamId: awayTeamIdFinal,
    homeTeamName: homeTeamNameFinal,
    awayTeamName: awayTeamNameFinal,
  };
}
