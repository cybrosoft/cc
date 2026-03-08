-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN     "parentSubscriptionId" TEXT;

-- CreateIndex
CREATE INDEX "Subscription_parentSubscriptionId_idx" ON "Subscription"("parentSubscriptionId");

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_parentSubscriptionId_fkey" FOREIGN KEY ("parentSubscriptionId") REFERENCES "Subscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;
