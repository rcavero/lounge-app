-- CreateTable
CREATE TABLE "ZoneLabel" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "zone" TEXT NOT NULL,
    "posX" REAL NOT NULL,
    "posY" REAL NOT NULL,
    "scaleX" REAL NOT NULL DEFAULT 1,
    "rotation" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "ZoneLabel_zone_key" ON "ZoneLabel"("zone");
