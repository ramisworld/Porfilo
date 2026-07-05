-- One-time, account-level entitlement that unlocks a paid feature.
-- Currently backs the $9 "custom_domain" unlock. One row per (userId, featureKey);
-- the unique constraint makes duplicate paid records impossible and webhook
-- fulfilment idempotent. Additive + reversible (drop the table to roll back).

-- CreateTable
CREATE TABLE "FeatureAccess" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "featureKey" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "stripeCheckoutSessionId" TEXT,
    "stripePaymentIntentId" TEXT,
    "amount" INTEGER NOT NULL DEFAULT 900,
    "currency" TEXT NOT NULL DEFAULT 'usd',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "paidAt" TIMESTAMP(3),

    CONSTRAINT "FeatureAccess_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FeatureAccess_stripeCheckoutSessionId_key" ON "FeatureAccess"("stripeCheckoutSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "FeatureAccess_stripePaymentIntentId_key" ON "FeatureAccess"("stripePaymentIntentId");

-- CreateIndex
CREATE INDEX "FeatureAccess_userId_idx" ON "FeatureAccess"("userId");

-- CreateIndex
CREATE INDEX "FeatureAccess_featureKey_idx" ON "FeatureAccess"("featureKey");

-- CreateIndex
CREATE INDEX "FeatureAccess_status_idx" ON "FeatureAccess"("status");

-- CreateIndex
CREATE UNIQUE INDEX "FeatureAccess_userId_featureKey_key" ON "FeatureAccess"("userId", "featureKey");

-- AddForeignKey
ALTER TABLE "FeatureAccess" ADD CONSTRAINT "FeatureAccess_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
