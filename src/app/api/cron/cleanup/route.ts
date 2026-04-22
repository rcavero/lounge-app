import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(request: Request) {
  // Verify the request is from Vercel Cron or has the correct secret
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = new Date();
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    const thirtyMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);

    // Delete events older than 90 days (cascade removes reservations + seatStatuses)
    const deletedEvents = await prisma.event.deleteMany({
      where: { eventDate: { lt: ninetyDaysAgo } },
    });

    // Expire PENDING reservations older than 5 minutes and release their seats
    const expiredReservations = await prisma.reservation.findMany({
      where: {
        status: "PENDING",
        createdAt: { lt: thirtyMinutesAgo },
      },
      select: {
        id: true,
        eventId: true,
        seatStatuses: { select: { seatId: true } },
      },
    });

    let expiredCount = 0;
    for (const reservation of expiredReservations) {
      const seatIds = reservation.seatStatuses.map((ss) => ss.seatId);
      await prisma.$transaction(async (tx) => {
        await tx.reservation.update({
          where: { id: reservation.id },
          data: { status: "EXPIRED" },
        });
        await tx.seatStatus.updateMany({
          where: { seatId: { in: seatIds }, eventId: reservation.eventId },
          data: { status: "AVAILABLE", reservationId: null },
        });
      });
      expiredCount++;
    }

    return NextResponse.json({
      success: true,
      deletedEvents: deletedEvents.count,
      expiredReservations: expiredCount,
      cutoffDate: ninetyDaysAgo.toISOString(),
    });
  } catch (error) {
    console.error("Cleanup cron error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
