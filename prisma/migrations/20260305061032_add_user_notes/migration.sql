/*
  Warnings:

  - You are about to drop the column `isDefault` on the `CustomerGroup` table. All the data in the column will be lost.
  - You are about to drop the column `priority` on the `CustomerGroup` table. All the data in the column will be lost.
  - You are about to drop the column `manualPaymentInstructions` on the `Market` table. All the data in the column will be lost.
  - You are about to drop the column `billingMode` on the `Product` table. All the data in the column will be lost.
  - You are about to drop the column `description` on the `Product` table. All the data in the column will be lost.
  - You are about to drop the column `introMonths` on the `Product` table. All the data in the column will be lost.
  - You are about to drop the column `zohoPlanId` on the `Product` table. All the data in the column will be lost.
  - You are about to drop the column `oracleCompartmentOcid` on the `Server` table. All the data in the column will be lost.
  - You are about to drop the column `oracleInstanceId` on the `Server` table. All the data in the column will be lost.
  - You are about to drop the column `oracleInstanceRegion` on the `Server` table. All the data in the column will be lost.
  - You are about to drop the column `activatedAt` on the `Subscription` table. All the data in the column will be lost.
  - You are about to drop the column `addonPlanProductId` on the `Subscription` table. All the data in the column will be lost.
  - You are about to drop the column `billingProvider` on the `Subscription` table. All the data in the column will be lost.
  - You are about to drop the column `canceledAt` on the `Subscription` table. All the data in the column will be lost.
  - You are about to drop the column `currency` on the `Subscription` table. All the data in the column will be lost.
  - You are about to drop the column `customerGroupId` on the `Subscription` table. All the data in the column will be lost.
  - You are about to drop the column `introMonthCents` on the `Subscription` table. All the data in the column will be lost.
  - You are about to drop the column `introUsed` on the `Subscription` table. All the data in the column will be lost.
  - You are about to drop the column `provisionLocation` on the `Subscription` table. All the data in the column will be lost.
  - You are about to drop the column `yearlyPriceCents` on the `Subscription` table. All the data in the column will be lost.
  - You are about to drop the column `zohoCustomerId` on the `Subscription` table. All the data in the column will be lost.
  - You are about to drop the `ProductGroupPricing` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[token]` on the table `Session` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `token` to the `Session` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "ProductGroupPricing" DROP CONSTRAINT "ProductGroupPricing_customerGroupId_fkey";

-- DropForeignKey
ALTER TABLE "ProductGroupPricing" DROP CONSTRAINT "ProductGroupPricing_marketId_fkey";

-- DropForeignKey
ALTER TABLE "ProductGroupPricing" DROP CONSTRAINT "ProductGroupPricing_productId_fkey";

-- DropForeignKey
ALTER TABLE "Subscription" DROP CONSTRAINT "Subscription_addonPlanProductId_fkey";

-- DropForeignKey
ALTER TABLE "Subscription" DROP CONSTRAINT "Subscription_customerGroupId_fkey";

-- DropForeignKey
ALTER TABLE "Subscription" DROP CONSTRAINT "Subscription_userId_fkey";

-- DropIndex
DROP INDEX "Category_isActive_idx";

-- DropIndex
DROP INDEX "CustomerGroup_isActive_idx";

-- DropIndex
DROP INDEX "CustomerGroup_isDefault_idx";

-- DropIndex
DROP INDEX "Market_isActive_idx";

-- DropIndex
DROP INDEX "Product_isActive_idx";

-- DropIndex
DROP INDEX "Server_oracleInstanceId_key";

-- DropIndex
DROP INDEX "Subscription_addonPlanProductId_idx";

-- AlterTable
ALTER TABLE "CustomerGroup" DROP COLUMN "isDefault",
DROP COLUMN "priority";

-- AlterTable
ALTER TABLE "LoginOtp" ALTER COLUMN "attemptCount" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Market" DROP COLUMN "manualPaymentInstructions";

-- AlterTable
ALTER TABLE "Product" DROP COLUMN "billingMode",
DROP COLUMN "description",
DROP COLUMN "introMonths",
DROP COLUMN "zohoPlanId";

-- AlterTable
ALTER TABLE "Server" DROP COLUMN "oracleCompartmentOcid",
DROP COLUMN "oracleInstanceId",
DROP COLUMN "oracleInstanceRegion";

-- AlterTable
ALTER TABLE "Session" ADD COLUMN     "token" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Subscription" DROP COLUMN "activatedAt",
DROP COLUMN "addonPlanProductId",
DROP COLUMN "billingProvider",
DROP COLUMN "canceledAt",
DROP COLUMN "currency",
DROP COLUMN "customerGroupId",
DROP COLUMN "introMonthCents",
DROP COLUMN "introUsed",
DROP COLUMN "provisionLocation",
DROP COLUMN "yearlyPriceCents",
DROP COLUMN "zohoCustomerId",
ADD COLUMN     "billingMode" "BillingMode" NOT NULL DEFAULT 'YEARLY_ONLY';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "notePrivate" TEXT,
ADD COLUMN     "notePublic" TEXT;

-- DropTable
DROP TABLE "ProductGroupPricing";

-- CreateTable
CREATE TABLE "Pricing" (
    "id" TEXT NOT NULL,
    "marketId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "yearlyPriceCents" INTEGER,
    "monthlyPriceCents" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Pricing_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Pricing_marketId_idx" ON "Pricing"("marketId");

-- CreateIndex
CREATE INDEX "Pricing_productId_idx" ON "Pricing"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "Pricing_marketId_productId_key" ON "Pricing"("marketId", "productId");

-- CreateIndex
CREATE INDEX "LoginOtp_email_idx" ON "LoginOtp"("email");

-- CreateIndex
CREATE INDEX "LoginOtp_expiresAt_idx" ON "LoginOtp"("expiresAt");

-- CreateIndex
CREATE INDEX "Server_userId_idx" ON "Server"("userId");

-- CreateIndex
CREATE INDEX "Server_subscriptionId_idx" ON "Server"("subscriptionId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_token_key" ON "Session"("token");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- CreateIndex
CREATE INDEX "Subscription_userId_idx" ON "Subscription"("userId");

-- CreateIndex
CREATE INDEX "Subscription_marketId_idx" ON "Subscription"("marketId");

-- CreateIndex
CREATE INDEX "Subscription_productId_idx" ON "Subscription"("productId");

-- CreateIndex
CREATE INDEX "Subscription_approvedByUserId_idx" ON "Subscription"("approvedByUserId");

-- AddForeignKey
ALTER TABLE "Pricing" ADD CONSTRAINT "Pricing_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pricing" ADD CONSTRAINT "Pricing_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
