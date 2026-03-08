/*
  Warnings:

  - You are about to drop the column `ProductNote` on the `Subscription` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Subscription" DROP COLUMN "ProductNote",
ADD COLUMN     "addonPlanProductId" TEXT,
ADD COLUMN     "productNote" TEXT;

-- CreateIndex
CREATE INDEX "Subscription_addonPlanProductId_idx" ON "Subscription"("addonPlanProductId");

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_addonPlanProductId_fkey" FOREIGN KEY ("addonPlanProductId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
