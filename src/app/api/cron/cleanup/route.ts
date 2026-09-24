import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import {
  eventRetentionCutoff,
  pendingExpiryCutoff,
} from "@/modules/reservations/domain/expiry";
import { expirePendingReservation } from "@/modules/reservations/lib/expire";

export async function GET(request: Request) {
  // Verify the request is from Vercel Cron or has the correct secret
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = new Date();
    const retentionCutoff = eventRetentionCutoff(now);
    const pendingCutoff = pendingExpiryCutoff(now);

    // Delete events older than 90 days (cascade removes reservations + seatStatuses)
    const deletedEvents = await prisma.event.deleteMany({
      where: { eventDate: { lt: retentionCutoff } },
    });

    // Expire PENDING reservations older than 5 minutes and release their seats
    const stale = await prisma.reservation.findMany({
      where: {
        status: "PENDING",
        createdAt: { lt: pendingCutoff },
      },
      select: { id: true },
    });

    let expiredCount = 0;
    for (const reservation of stale) {
      if (await expirePendingReservation(reservation.id)) expiredCount++;
    }

    return NextResponse.json({
      success: true,
      deletedEvents: deletedEvents.count,
      expiredReservations: expiredCount,
      cutoffDate: retentionCutoff.toISOString(),
    });
  } catch (error) {
    console.error("Cleanup cron error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
