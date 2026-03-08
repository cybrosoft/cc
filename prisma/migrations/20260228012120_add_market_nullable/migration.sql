-- AlterTable
ALTER TABLE "User" ADD COLUMN     "marketId" TEXT;

-- CreateTable
CREATE TABLE "Market" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "defaultCurrency" TEXT NOT NULL,
    "zohoOrgId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Market_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Market_key_key" ON "Market"("key");

-- CreateIndex
CREATE INDEX "Market_isActive_idx" ON "Market"("isActive");

-- CreateIndex
CREATE INDEX "User_marketId_idx" ON "User"("marketId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE SET NULL ON UPDATE CASCADE;
