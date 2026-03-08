-- CreateEnum
CREATE TYPE "BillingProvider" AS ENUM ('ZOHO', 'MANUAL');

-- DropForeignKey
ALTER TABLE "ProductGroupPricing" DROP CONSTRAINT "ProductGroupPricing_customerGroupId_fkey";

-- DropForeignKey
ALTER TABLE "ProductGroupPricing" DROP CONSTRAINT "ProductGroupPricing_marketId_fkey";

-- DropForeignKey
ALTER TABLE "ProductGroupPricing" DROP CONSTRAINT "ProductGroupPricing_productId_fkey";

-- DropForeignKey
ALTER TABLE "Session" DROP CONSTRAINT "Session_userId_fkey";

-- DropIndex
DROP INDEX "ProductGroupPricing_isActive_idx";

-- AlterTable
ALTER TABLE "Market" ADD COLUMN     "billingProvider" "BillingProvider" NOT NULL DEFAULT 'MANUAL',
ADD COLUMN     "manualPaymentInstructions" TEXT,
ALTER COLUMN "zohoOrgId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "zohoPlanId" TEXT;

-- CreateIndex
CREATE INDEX "ProductGroupPricing_marketId_currency_customerGroupId_isAct_idx" ON "ProductGroupPricing"("marketId", "currency", "customerGroupId", "isActive");

-- AddForeignKey
ALTER TABLE "ProductGroupPricing" ADD CONSTRAINT "ProductGroupPricing_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductGroupPricing" ADD CONSTRAINT "ProductGroupPricing_customerGroupId_fkey" FOREIGN KEY ("customerGroupId") REFERENCES "CustomerGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductGroupPricing" ADD CONSTRAINT "ProductGroupPricing_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
