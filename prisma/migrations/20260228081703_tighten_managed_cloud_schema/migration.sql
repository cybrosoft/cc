/*
  Warnings:

  - The values [SUSPENDED,EXPIRED] on the enum `SubscriptionStatus` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `status` on the `Server` table. All the data in the column will be lost.
  - You are about to drop the column `cancelAtPeriodEnd` on the `Subscription` table. All the data in the column will be lost.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "SubscriptionStatus_new" AS ENUM ('PENDING_PAYMENT', 'PENDING_EXTERNAL', 'ACTIVE', 'CANCELED');
ALTER TABLE "Subscription" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Subscription" ALTER COLUMN "status" TYPE "SubscriptionStatus_new" USING ("status"::text::"SubscriptionStatus_new");
ALTER TYPE "SubscriptionStatus" RENAME TO "SubscriptionStatus_old";
ALTER TYPE "SubscriptionStatus_new" RENAME TO "SubscriptionStatus";
DROP TYPE "SubscriptionStatus_old";
ALTER TABLE "Subscription" ALTER COLUMN "status" SET DEFAULT 'PENDING_PAYMENT';
COMMIT;

-- DropIndex
DROP INDEX "LoginOtp_email_createdAt_idx";

-- DropIndex
DROP INDEX "ProductGroupPricing_currency_idx";

-- DropIndex
DROP INDEX "ProductGroupPricing_customerGroupId_idx";

-- DropIndex
DROP INDEX "ProductGroupPricing_marketId_idx";

-- DropIndex
DROP INDEX "ProductGroupPricing_productId_idx";

-- AlterTable
ALTER TABLE "Server" DROP COLUMN "status";

-- AlterTable
ALTER TABLE "Subscription" DROP COLUMN "cancelAtPeriodEnd";
