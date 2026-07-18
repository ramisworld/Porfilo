-- New purchases use the $15 one-time custom-domain price. Preserve historical
-- paid rows at the amount they actually paid; only unfinished attempts move to
-- the current offer amount.
ALTER TABLE "FeatureAccess" ALTER COLUMN "amount" SET DEFAULT 1500;

UPDATE "FeatureAccess"
SET "amount" = 1500,
    "currency" = 'usd'
WHERE "featureKey" = 'custom_domain'
  AND "status" <> 'paid';
