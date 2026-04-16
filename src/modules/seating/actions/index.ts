"use server";

import prisma from "@/lib/prisma";
import type { SeatWithStatus } from "../types";
import type { SeatStatusType } from "@/generated/prisma";
import { DEFAULT_ZONE_LABEL_POSITIONS, type ZoneLabelConfig } from "../constants";

async function getOverlappingEventIds(
  excludeEventId: string,
  eventDate: Date,
  durationMinutes: number
): Promise<string[]> {
  const eventStart = eventDate.getTime();
  const eventEnd = eventStart + durationMinutes * 60 * 1000;

  const candidates = await prisma.event.findMany({
    where: {
      id: { not: excludeEventId },
      status: { in: ["UPCOMING", "LIVE"] },
    },
    select: { id: true, eventDate: true, durationMinutes: true },
  });

  return candidates
    .filter((e) => {
      const start = e.eventDate.getTime();
      const end = start + e.durationMinutes * 60 * 1000;
      return eventStart < end && start < eventEnd;
    })
    .map((e) => e.id);
}

export async function getSeatsForEvent(eventId: string): Promise<SeatWithStatus[]> {
  // Get all seats
  const seats = await prisma.seat.findMany({
    orderBy: [
      { zone: "asc" },
      { row: "asc" },
      { number: "asc" },
    ],
  });

  // Get the event to know its date and duration
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { eventDate: true, durationMinutes: true },
  });

  // Get seat statuses for this event
  const seatStatuses = await prisma.seatStatus.findMany({
    where: { eventId },
  });

  const statusMap = new Map(seatStatuses.map((s) => [s.seatId, s.status]));

  // If event exists, also check overlapping events
  if (event) {
    const overlappingIds = await getOverlappingEventIds(eventId, event.eventDate, event.durationMinutes);

    if (overlappingIds.length > 0) {
      const overlappingStatuses = await prisma.seatStatus.findMany({
        where: {
          eventId: { in: overlappingIds },
          status: { in: ["RESERVED", "OCCUPIED"] },
        },
      });

      // Mark as OCCUPIED any seat that is taken in an overlapping event
      // but only if it's currently AVAILABLE in this event (don't override BLOCKED)
      for (const os of overlappingStatuses) {
        const currentStatus = statusMap.get(os.seatId) || "AVAILABLE";
        if (currentStatus === "AVAILABLE") {
          statusMap.set(os.seatId, "OCCUPIED");
        }
      }
    }
  }

  return seats.map((seat) => ({
    ...seat,
    status: (statusMap.get(seat.id) || "AVAILABLE") as SeatStatusType,
  }));
}

export async function initializeSeatsForEvent(eventId: string): Promise<void> {
  // Check if seat statuses already exist for this event
  const existingCount = await prisma.seatStatus.count({
    where: { eventId },
  });

  if (existingCount > 0) {
    return; // Already initialized
  }

  const seats = await prisma.seat.findMany();

  // Create seat statuses for all seats
  await prisma.seatStatus.createMany({
    data: seats.map((seat) => ({
      eventId,
      seatId: seat.id,
      status: "AVAILABLE" as const,
    })),
  });
}

export async function getSeatsByZone(eventId: string, zone: string): Promise<SeatWithStatus[]> {
  const seats = await prisma.seat.findMany({
    where: { zone: zone as "PROJECTOR" | "TV1" | "TV2" },
    orderBy: [
      { row: "asc" },
      { number: "asc" },
    ],
  });

  const seatStatuses = await prisma.seatStatus.findMany({
    where: {
      eventId,
      seatId: { in: seats.map((s) => s.id) },
    },
  });

  const statusMap = new Map(seatStatuses.map((s) => [s.seatId, s.status]));

  return seats.map((seat) => ({
    ...seat,
    status: (statusMap.get(seat.id) || "AVAILABLE") as SeatStatusType,
  }));
}

// Get all seats (for admin purposes)
export async function getAllSeats() {
  const seats = await prisma.seat.findMany({
    orderBy: [
      { zone: "asc" },
      { row: "asc" },
      { number: "asc" },
    ],
  });

  return seats;
}

// Update seat positions (admin function)
export async function updateSeatPositions(
  positions: { id: string; posX: number; posY: number }[]
): Promise<void> {
  // Update each seat position
  await Promise.all(
    positions.map((pos) =>
      prisma.seat.update({
        where: { id: pos.id },
        data: {
          posX: pos.posX,
          posY: pos.posY,
        },
      })
    )
  );
}

// Block/unblock seats for a specific event
export async function saveBlockedSeats(
  eventId: string,
  seatIdsToBlock: string[]
): Promise<{ success: boolean; error?: string }> {
  try {
    // Release all currently blocked seats for this event
    await prisma.seatStatus.updateMany({
      where: { eventId, status: "BLOCKED" },
      data: { status: "AVAILABLE" },
    });

    // Block the selected seats (only if AVAILABLE — never touch RESERVED/OCCUPIED)
    if (seatIdsToBlock.length > 0) {
      await prisma.seatStatus.updateMany({
        where: {
          eventId,
          seatId: { in: seatIdsToBlock },
          status: "AVAILABLE",
        },
        data: { status: "BLOCKED" },
      });
    }

    return { success: true };
  } catch (error) {
    console.error("Error saving blocked seats:", error);
    return { success: false, error: "Error al guardar los bloqueos" };
  }
}

// Get zone labels configuration
export async function getZoneLabels(): Promise<ZoneLabelConfig[]> {
  const labels = await prisma.zoneLabel.findMany();

  // Use defaults from constants file
  const defaults = DEFAULT_ZONE_LABEL_POSITIONS;

  // Merge defaults with saved values
  return defaults.map((defaultLabel) => {
    const saved = labels.find((l) => l.zone === defaultLabel.zone);
    if (saved) {
      return {
        zone: saved.zone,
        posX: saved.posX,
        posY: saved.posY,
        scaleX: saved.scaleX,
        rotation: saved.rotation,
      };
    }
    return defaultLabel;
  });
}

// Update zone labels configuration (admin function)
export async function updateZoneLabels(
  labels: ZoneLabelConfig[]
): Promise<void> {
  await Promise.all(
    labels.map((label) =>
      prisma.zoneLabel.upsert({
        where: { zone: label.zone },
        update: {
          posX: label.posX,
          posY: label.posY,
          scaleX: label.scaleX,
          rotation: label.rotation,
        },
        create: {
          zone: label.zone,
          posX: label.posX,
          posY: label.posY,
          scaleX: label.scaleX,
          rotation: label.rotation,
        },
      })
    )
  );
}

