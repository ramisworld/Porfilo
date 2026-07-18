-- Replace the former custom-domain-only entitlement with one lifetime Premium
-- entitlement. Existing paid purchases retain access; unfinished attempts are
-- reset to the current $9 offer and cannot fulfil against the old price.
ALTER TABLE "FeatureAccess" ALTER COLUMN "amount" SET DEFAULT 900;

UPDATE "FeatureAccess"
SET "featureKey" = 'premium',
    "amount" = CASE WHEN "status" = 'paid' THEN "amount" ELSE 900 END,
    "currency" = 'usd',
    "status" = CASE WHEN "status" = 'paid' THEN 'paid' ELSE 'failed' END
WHERE "featureKey" = 'custom_domain';
