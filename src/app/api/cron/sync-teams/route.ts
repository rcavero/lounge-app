import { NextResponse } from "next/server";
import { syncTeamsFromAPI } from "@/modules/football-data/actions";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await syncTeamsFromAPI();

    return NextResponse.json({
      success: true,
      created: result.created,
      updated: result.updated,
      errors: result.errors.length,
    });
  } catch (error) {
    console.error("Sync teams cron error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
