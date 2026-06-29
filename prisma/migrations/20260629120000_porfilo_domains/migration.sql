-- Add public preview subdomain slug to portfolios
ALTER TABLE "Portfolio" ADD COLUMN "publicSubdomainSlug" TEXT;

-- Backfill existing rows with slug (legacy 10-char ids work as preview hosts)
UPDATE "Portfolio" SET "publicSubdomainSlug" = "slug" WHERE "publicSubdomainSlug" IS NULL;

ALTER TABLE "Portfolio" ALTER COLUMN "publicSubdomainSlug" SET NOT NULL;
CREATE UNIQUE INDEX "Portfolio_publicSubdomainSlug_key" ON "Portfolio"("publicSubdomainSlug");

-- Domain type: free_subdomain | custom_domain
ALTER TABLE "CustomDomain" ADD COLUMN "type" TEXT NOT NULL DEFAULT 'custom_domain';

-- Track HTTP/DNS verification details for custom domains
ALTER TABLE "CustomDomain" ADD COLUMN "dnsVerified" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "CustomDomain" ADD COLUMN "httpVerified" BOOLEAN NOT NULL DEFAULT false;
