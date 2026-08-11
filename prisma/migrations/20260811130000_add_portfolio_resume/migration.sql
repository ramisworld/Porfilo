ALTER TABLE "Portfolio"
ADD COLUMN "resumeBytes" BYTEA,
ADD COLUMN "resumeMimeType" TEXT,
ADD COLUMN "resumeFileName" TEXT,
ADD COLUMN "resumeSizeBytes" INTEGER,
ADD COLUMN "resumeUpdatedAt" TIMESTAMP(3);
