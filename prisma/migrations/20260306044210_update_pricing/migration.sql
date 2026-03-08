/*
  Warnings:

  - You are about to drop the column `monthlyPriceCents` on the `Pricing` table. All the data in the column will be lost.
  - You are about to drop the column `yearlyPriceCents` on the `Pricing` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[productId,marketId,customerGroupId,billingPeriod]` on the table `Pricing` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `billingPeriod` to the `Pricing` table without a default value. This is not possible if the table is not empty.
  - Added the required column `customerGroupId` to the `Pricing` table without a default value. This is not possible if the table is not empty.
  - Added the required column `priceCents` to the `Pricing` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "Pricing_marketId_productId_key";

-- AlterTable
ALTER TABLE "Pricing" DROP COLUMN "monthlyPriceCents",
DROP COLUMN "yearlyPriceCents",
ADD COLUMN     "billingPeriod" "BillingPeriod" NOT NULL,
ADD COLUMN     "customerGroupId" TEXT NOT NULL,
ADD COLUMN     "priceCents" INTEGER NOT NULL;

-- CreateTable
CREATE TABLE "CustomerPricingOverride" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "marketId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "billingPeriod" "BillingPeriod" NOT NULL,
    "priceCents" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerPricingOverride_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CustomerPricingOverride_productId_idx" ON "CustomerPricingOverride"("productId");

-- CreateIndex
CREATE INDEX "CustomerPricingOverride_userId_idx" ON "CustomerPricingOverride"("userId");

-- CreateIndex
CREATE INDEX "CustomerPricingOverride_marketId_idx" ON "CustomerPricingOverride"("marketId");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerPricingOverride_productId_marketId_userId_billingPe_key" ON "CustomerPricingOverride"("productId", "marketId", "userId", "billingPeriod");

-- CreateIndex
CREATE INDEX "Pricing_customerGroupId_idx" ON "Pricing"("customerGroupId");

-- CreateIndex
CREATE UNIQUE INDEX "Pricing_productId_marketId_customerGroupId_billingPeriod_key" ON "Pricing"("productId", "marketId", "customerGroupId", "billingPeriod");

-- AddForeignKey
ALTER TABLE "Pricing" ADD CONSTRAINT "Pricing_customerGroupId_fkey" FOREIGN KEY ("customerGroupId") REFERENCES "CustomerGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerPricingOverride" ADD CONSTRAINT "CustomerPricingOverride_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerPricingOverride" ADD CONSTRAINT "CustomerPricingOverride_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerPricingOverride" ADD CONSTRAINT "CustomerPricingOverride_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
