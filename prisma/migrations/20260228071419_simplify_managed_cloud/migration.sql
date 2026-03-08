/*
  Warnings:

  - You are about to drop the column `externalResourceId` on the `Subscription` table. All the data in the column will be lost.
  - You are about to drop the column `provisioned` on the `Subscription` table. All the data in the column will be lost.
  - You are about to drop the column `provisionedAt` on the `Subscription` table. All the data in the column will be lost.
  - You are about to drop the `ServerDeletionRequest` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "ServerDeletionRequest" DROP CONSTRAINT "ServerDeletionRequest_serverId_fkey";

-- AlterTable
ALTER TABLE "Server" ADD COLUMN     "subscriptionId" TEXT;

-- AlterTable
ALTER TABLE "Subscription" DROP COLUMN "externalResourceId",
DROP COLUMN "provisioned",
DROP COLUMN "provisionedAt",
ADD COLUMN     "invoiceNumber" TEXT,
ADD COLUMN     "receiptFileName" TEXT,
ADD COLUMN     "receiptUploadedAt" TIMESTAMP(3),
ADD COLUMN     "receiptUrl" TEXT;

-- DropTable
DROP TABLE "ServerDeletionRequest";

-- CreateIndex
CREATE INDEX "Server_userId_idx" ON "Server"("userId");

-- CreateIndex
CREATE INDEX "Server_subscriptionId_idx" ON "Server"("subscriptionId");

-- AddForeignKey
ALTER TABLE "Server" ADD CONSTRAINT "Server_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;
