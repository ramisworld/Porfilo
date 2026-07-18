-- Bound expensive work across application replicas.
CREATE TABLE "WorkSlot" (
    "kind" TEXT NOT NULL,
    "slot" INTEGER NOT NULL,
    "token" TEXT,
    "expiresAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkSlot_pkey" PRIMARY KEY ("kind","slot")
);

CREATE INDEX "WorkSlot_kind_expiresAt_idx" ON "WorkSlot"("kind", "expiresAt");

-- Persist LLM reservations and exact usage across restarts and replicas.
CREATE TABLE "LlmSpendReservation" (
    "id" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "reservedMicros" INTEGER NOT NULL,
    "actualMicros" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LlmSpendReservation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "LlmSpendReservation_day_status_expiresAt_idx"
ON "LlmSpendReservation"("day", "status", "expiresAt");
CREATE INDEX "LlmSpendReservation_expiresAt_idx"
ON "LlmSpendReservation"("expiresAt");

-- The cleanup query filters anonymous portfolios by age. The nullable ownerId
-- prefix keeps the index useful without indexing large JSON/content columns.
CREATE INDEX "Portfolio_ownerId_createdAt_idx" ON "Portfolio"("ownerId", "createdAt");
