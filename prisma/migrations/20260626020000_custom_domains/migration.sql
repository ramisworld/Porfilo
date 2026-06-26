-- Drop the never-populated Portfolio.customDomain column. The new CustomDomain
-- table is the single source of truth for user-owned hostnames.
DROP INDEX IF EXISTS "Portfolio_customDomain_key";
ALTER TABLE "Portfolio" DROP COLUMN IF EXISTS "customDomain";

-- ──────────────────────────────────────────────────────────────────────────
-- CustomDomain — one user-owned hostname per Portfolio (Cloudflare-backed).
-- ──────────────────────────────────────────────────────────────────────────
CREATE TABLE "CustomDomain" (
    "id" TEXT NOT NULL,
    "portfolioId" TEXT NOT NULL,
    "hostname" TEXT NOT NULL,
    "cfHostnameId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "ownershipStatus" TEXT,
    "sslStatus" TEXT,
    "errorReason" TEXT,
    "lastCheckedAt" TIMESTAMP(3),
    "activatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomDomain_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CustomDomain_portfolioId_key" ON "CustomDomain"("portfolioId");
CREATE UNIQUE INDEX "CustomDomain_hostname_key" ON "CustomDomain"("hostname");
CREATE UNIQUE INDEX "CustomDomain_cfHostnameId_key" ON "CustomDomain"("cfHostnameId");

ALTER TABLE "CustomDomain"
ADD CONSTRAINT "CustomDomain_portfolioId_fkey"
FOREIGN KEY ("portfolioId") REFERENCES "Portfolio"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
