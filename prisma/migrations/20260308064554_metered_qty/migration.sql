/*
  Warnings:

  - A unique constraint covering the columns `[oracleInstanceId]` on the table `Server` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "unitLabel" TEXT;

-- AlterTable
ALTER TABLE "Server" ADD COLUMN     "oracleCompartmentOcid" TEXT,
ADD COLUMN     "oracleInstanceId" TEXT,
ADD COLUMN     "oracleInstanceRegion" TEXT;

-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN     "quantity" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "Server_oracleInstanceId_key" ON "Server"("oracleInstanceId");
