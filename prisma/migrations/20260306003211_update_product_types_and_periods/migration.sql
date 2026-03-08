/*
  Warnings:

  - You are about to drop the column `billingMode` on the `Subscription` table. All the data in the column will be lost.
  - You are about to drop the column `phase` on the `Subscription` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "BillingPeriod" AS ENUM ('MONTHLY', 'SIX_MONTHS', 'YEARLY', 'ONE_TIME');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ProductType" ADD VALUE 'service';
ALTER TYPE "ProductType" ADD VALUE 'product';

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "billingPeriods" "BillingPeriod"[],
ADD COLUMN     "zohoPlanId" TEXT;

-- AlterTable
ALTER TABLE "Subscription" DROP COLUMN "billingMode",
DROP COLUMN "phase",
ADD COLUMN     "billingPeriod" "BillingPeriod" NOT NULL DEFAULT 'YEARLY';

-- DropEnum
DROP TYPE "BillingMode";

-- DropEnum
DROP TYPE "SubscriptionPhase";
