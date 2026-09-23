import { NextResponse } from "next/server";
// Se importa el núcleo del sync, no la server action: esta ruta se autentica
// con CRON_SECRET y no tiene sesión de usuario que pasar por requireAuth().
import { syncTeams } from "@/modules/football-data/lib/team-sync";

// El sync recorre 17 competiciones contra la API de ESPN (~7 s medidos), pero el
// número de escrituras en BD depende del estado de la tabla Team, así que se deja
// margen holgado. Requiere plan Pro de Vercel; en Hobby el techo es 60 s.
export const maxDuration = 300;

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startedAt = Date.now();

  try {
    const result = await syncTeams();

    return NextResponse.json({
      success: true,
      created: result.created,
      updated: result.updated,
      durationMs: Date.now() - startedAt,
      // Se devuelven los mensajes completos, no solo el recuento: si no, los
      // fallos parciales del sync solo son visibles en los logs de Vercel.
      errors: result.errors,
    });
  } catch (error) {
    console.error("Sync teams cron error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
