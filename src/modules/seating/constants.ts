// Default seat positions for reset functionality (47 seats total)
export const DEFAULT_SEAT_POSITIONS: { id: string; posX: number; posY: number }[] = [
  // TV1 zone - 10 seats
  { id: "T1-A1", posX: 18, posY: 10 },
  { id: "T1-A2", posX: 27, posY: 9 },
  { id: "T1-A3", posX: 40, posY: 8 },
  { id: "T1-A4", posX: 53, posY: 6 },
  { id: "T1-A5", posX: 65, posY: 5 },
  { id: "T1-B1", posX: 18, posY: 15 },
  { id: "T1-B2", posX: 33, posY: 14 },
  { id: "T1-B3", posX: 26, posY: 19 },
  { id: "T1-B4", posX: 44, posY: 18 },
  { id: "T1-B5", posX: 57, posY: 16 },
  // TV2 zone - 12 seats
  { id: "T2-A1", posX: 38, posY: 28 },
  { id: "T2-A2", posX: 65, posY: 34 },
  { id: "T2-A3", posX: 63, posY: 25 },
  { id: "T2-A4", posX: 78, posY: 20 },
  { id: "T2-A5", posX: 76, posY: 16 },
  { id: "T2-A6", posX: 69, posY: 15 },
  { id: "T2-B1", posX: 68, posY: 38 },
  { id: "T2-B2", posX: 81, posY: 36 },
  { id: "T2-B3", posX: 79, posY: 32 },
  { id: "T2-B4", posX: 64, posY: 29 },
  { id: "T2-B5", posX: 77, posY: 28 },
  { id: "T2-B6", posX: 75, posY: 24 },
  // PROJECTOR zone - 25 seats
  { id: "P-A1", posX: 35, posY: 36 },
  { id: "P-A2", posX: 42, posY: 39 },
  { id: "P-A3", posX: 50, posY: 38 },
  { id: "P-A4", posX: 58, posY: 46 },
  { id: "P-A5", posX: 59, posY: 55 },
  { id: "P-A6", posX: 79, posY: 52 },
  { id: "P-A7", posX: 54, posY: 34 },
  { id: "P-A8", posX: 46, posY: 27 },
  { id: "P-B1", posX: 48, posY: 76 },
  { id: "P-B2", posX: 57, posY: 77 },
  { id: "P-B3", posX: 65, posY: 79 },
  { id: "P-B4", posX: 73, posY: 80 },
  { id: "P-B5", posX: 92, posY: 57 },
  { id: "P-B6", posX: 79, posY: 67 },
  { id: "P-B7", posX: 79, posY: 62 },
  { id: "P-B8", posX: 79, posY: 57 },
  { id: "P-C1", posX: 88, posY: 74 },
  { id: "P-C2", posX: 46, posY: 81 },
  { id: "P-C3", posX: 54, posY: 82 },
  { id: "P-C4", posX: 63, posY: 83 },
  { id: "P-C5", posX: 71, posY: 85 },
  { id: "P-C6", posX: 91, posY: 68 },
  { id: "P-C7", posX: 92, posY: 63 },
  { id: "P-C8", posX: 91, posY: 52 },
  { id: "P-D1", posX: 85, posY: 81 },
];

// Default zone label positions for reset functionality
export interface ZoneLabelConfig {
  zone: string;
  posX: number;
  posY: number;
  scaleX: number;
  rotation: number;
}

export const DEFAULT_ZONE_LABEL_POSITIONS: ZoneLabelConfig[] = [
  { zone: "TV1", posX: 51.5, posY: 2.6, scaleX: 1.5, rotation: -11 },
  { zone: "TV2", posX: 43, posY: 31.7, scaleX: 1.25, rotation: 15 },
  { zone: "PROYECTOR", posX: 54.6, posY: 86.1, scaleX: 1.5, rotation: 15.79 },
];
