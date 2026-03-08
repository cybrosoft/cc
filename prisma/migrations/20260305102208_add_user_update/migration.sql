-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('BUSINESS', 'PERSONAL');

-- AlterTable
ALTER TABLE "PendingSignup" ADD COLUMN     "accountType" "AccountType",
ADD COLUMN     "addressLine1" TEXT,
ADD COLUMN     "addressLine2" TEXT,
ADD COLUMN     "city" TEXT,
ADD COLUMN     "commercialRegistrationNumber" TEXT,
ADD COLUMN     "companyName" TEXT,
ADD COLUMN     "country" TEXT,
ADD COLUMN     "district" TEXT,
ADD COLUMN     "fullName" TEXT,
ADD COLUMN     "marketingAccepted" BOOLEAN,
ADD COLUMN     "mobile" TEXT,
ADD COLUMN     "privacyAccepted" BOOLEAN,
ADD COLUMN     "province" TEXT,
ADD COLUMN     "tcAccepted" BOOLEAN,
ADD COLUMN     "vatTaxId" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "accountType" "AccountType",
ADD COLUMN     "addressLine1" TEXT,
ADD COLUMN     "addressLine2" TEXT,
ADD COLUMN     "city" TEXT,
ADD COLUMN     "commercialRegistrationNumber" TEXT,
ADD COLUMN     "companyName" TEXT,
ADD COLUMN     "country" TEXT,
ADD COLUMN     "district" TEXT,
ADD COLUMN     "fullName" TEXT,
ADD COLUMN     "marketingAccepted" BOOLEAN,
ADD COLUMN     "mobile" TEXT,
ADD COLUMN     "privacyAccepted" BOOLEAN,
ADD COLUMN     "province" TEXT,
ADD COLUMN     "tcAccepted" BOOLEAN,
ADD COLUMN     "vatTaxId" TEXT;

-- CreateIndex
CREATE INDEX "CustomerGroup_isActive_idx" ON "CustomerGroup"("isActive");

-- CreateIndex
CREATE INDEX "CustomerGroup_key_idx" ON "CustomerGroup"("key");

-- CreateIndex
CREATE INDEX "Market_key_idx" ON "Market"("key");

-- CreateIndex
CREATE INDEX "Market_isActive_idx" ON "Market"("isActive");

-- CreateIndex
CREATE INDEX "PendingSignup_marketId_idx" ON "PendingSignup"("marketId");

-- CreateIndex
CREATE INDEX "Pricing_isActive_idx" ON "Pricing"("isActive");

-- CreateIndex
CREATE INDEX "Product_isActive_idx" ON "Product"("isActive");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");
