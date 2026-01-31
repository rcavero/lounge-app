"use server";

import prisma from "@/lib/prisma";
import type { SeatWithStatus } from "../types";
import type { SeatStatusType } from "@/generated/prisma";
import { DEFAULT_ZONE_LABEL_POSITIONS, type ZoneLabelConfig } from "../constants";

export async function getSeatsForEvent(eventId: string): Promise<SeatWithStatus[]> {
  // Get all seats
  const seats = await prisma.seat.findMany({
    orderBy: [
      { zone: "asc" },
      { row: "asc" },
      { number: "asc" },
    ],
  });

  // Get seat statuses for this event
  const seatStatuses = await prisma.seatStatus.findMany({
    where: { eventId },
  });

  // Map statuses to seats
  const statusMap = new Map(seatStatuses.map((s) => [s.seatId, s.status]));

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

