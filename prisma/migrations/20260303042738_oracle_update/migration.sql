/*
  Warnings:

  - A unique constraint covering the columns `[oracleInstanceId]` on the table `Server` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Server" ADD COLUMN     "oracleInstanceId" TEXT;

-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN     "provisionLocation" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Server_oracleInstanceId_key" ON "Server"("oracleInstanceId");
