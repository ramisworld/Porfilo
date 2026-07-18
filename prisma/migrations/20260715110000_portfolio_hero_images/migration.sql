-- Social cards are screenshots of the real rendered portfolio hero. Cache the
-- generated JPEG in Postgres so crawlers do not launch a browser per request.
ALTER TABLE "Portfolio"
ADD COLUMN "ogImage" BYTEA,
ADD COLUMN "ogImageFingerprint" TEXT;

-- Every existing page should advertise a fresh versioned preview URL after
-- this deployment instead of retaining an older synthetic social card.
UPDATE "Portfolio"
SET "updatedAt" = CURRENT_TIMESTAMP;
