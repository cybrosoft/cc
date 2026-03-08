-- CreateEnum
CREATE TYPE "ProductType" AS ENUM ('plan', 'addon');

-- CreateEnum
CREATE TYPE "BillingMode" AS ENUM ('YEARLY_ONLY', 'YEARLY_WITH_INTRO_MONTH');

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" "ProductType" NOT NULL,
    "billingMode" "BillingMode" NOT NULL,
    "introMonths" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "categoryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductGroupPricing" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "customerGroupId" TEXT NOT NULL,
    "marketId" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "yearlyPriceCents" INTEGER NOT NULL,
    "introMonthCents" INTEGER,
    "monthlyDisplayCents" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductGroupPricing_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Category_key_key" ON "Category"("key");

-- CreateIndex
CREATE INDEX "Category_isActive_idx" ON "Category"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Product_key_key" ON "Product"("key");

-- CreateIndex
CREATE INDEX "Product_type_idx" ON "Product"("type");

-- CreateIndex
CREATE INDEX "Product_isActive_idx" ON "Product"("isActive");

-- CreateIndex
CREATE INDEX "Product_categoryId_idx" ON "Product"("categoryId");

-- CreateIndex
CREATE INDEX "ProductGroupPricing_productId_idx" ON "ProductGroupPricing"("productId");

-- CreateIndex
CREATE INDEX "ProductGroupPricing_customerGroupId_idx" ON "ProductGroupPricing"("customerGroupId");

-- CreateIndex
CREATE INDEX "ProductGroupPricing_marketId_idx" ON "ProductGroupPricing"("marketId");

-- CreateIndex
CREATE INDEX "ProductGroupPricing_currency_idx" ON "ProductGroupPricing"("currency");

-- CreateIndex
CREATE INDEX "ProductGroupPricing_isActive_idx" ON "ProductGroupPricing"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "ProductGroupPricing_productId_customerGroupId_marketId_curr_key" ON "ProductGroupPricing"("productId", "customerGroupId", "marketId", "currency");

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductGroupPricing" ADD CONSTRAINT "ProductGroupPricing_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductGroupPricing" ADD CONSTRAINT "ProductGroupPricing_customerGroupId_fkey" FOREIGN KEY ("customerGroupId") REFERENCES "CustomerGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductGroupPricing" ADD CONSTRAINT "ProductGroupPricing_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
