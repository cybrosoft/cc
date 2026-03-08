-- CreateEnum
CREATE TYPE "LocationStatus" AS ENUM ('active', 'inactive', 'coming_soon');

-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN     "locationCode" TEXT;

-- CreateTable
CREATE TABLE "Location" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "family" TEXT,
    "description" TEXT,
    "countryCode" TEXT,
    "flag" TEXT,
    "status" "LocationStatus" NOT NULL DEFAULT 'active',
    "sortOrder" INTEGER NOT NULL DEFAULT 1,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "includeTags" TEXT[],
    "excludeTags" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Location_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Location_code_key" ON "Location"("code");

-- CreateIndex
CREATE INDEX "Location_status_idx" ON "Location"("status");

-- CreateIndex
CREATE INDEX "Location_family_idx" ON "Location"("family");
