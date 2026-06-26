-- Enforce one local user per OAuth provider identity.
WITH ranked_accounts AS (
    SELECT
        "id",
        ROW_NUMBER() OVER (
            PARTITION BY "providerId", "accountId"
            ORDER BY "updatedAt" DESC, "createdAt" DESC, "id" DESC
        ) AS rn
    FROM "Account"
)
DELETE FROM "Account" a
USING ranked_accounts r
WHERE a."id" = r."id"
AND r.rn > 1;

CREATE UNIQUE INDEX "Account_providerId_accountId_key" ON "Account"("providerId", "accountId");

-- Enforce the beta product rule at the database layer: one portfolio per user.
-- Existing duplicate rows are preserved as legacy public portfolios, but only
-- the newest one remains attached to the owner account.
WITH ranked_portfolios AS (
    SELECT
        "id",
        ROW_NUMBER() OVER (
            PARTITION BY "ownerId"
            ORDER BY "createdAt" DESC, "id" DESC
        ) AS rn
    FROM "Portfolio"
    WHERE "ownerId" IS NOT NULL
)
UPDATE "Portfolio" p
SET "ownerId" = NULL
FROM ranked_portfolios r
WHERE p."id" = r."id"
AND r.rn > 1;

DROP INDEX IF EXISTS "Portfolio_ownerId_idx";
CREATE UNIQUE INDEX "Portfolio_ownerId_key" ON "Portfolio"("ownerId");

-- Short-lived per-user generation lock. The app clears expired rows before
-- acquiring a new lock, so a crashed process cannot permanently block a user.
CREATE TABLE "GenerationLock" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "githubUsername" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GenerationLock_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GenerationLock_ownerId_key" ON "GenerationLock"("ownerId");
CREATE INDEX "GenerationLock_expiresAt_idx" ON "GenerationLock"("expiresAt");

ALTER TABLE "GenerationLock"
ADD CONSTRAINT "GenerationLock_ownerId_fkey"
FOREIGN KEY ("ownerId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
