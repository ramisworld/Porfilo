-- Adds the one-time claim token hash used to bind an anonymous portfolio to the
-- browser/session that generated it (defends the claim flow: the public preview
-- URL alone can no longer claim ownership).
ALTER TABLE "Portfolio" ADD COLUMN IF NOT EXISTS "claimNonce" TEXT;
