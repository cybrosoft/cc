-- AlterTable
ALTER TABLE "User" ADD COLUMN     "customerGroupId" TEXT;

-- CreateTable
CREATE TABLE "CustomerGroup" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerGroup_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CustomerGroup_key_key" ON "CustomerGroup"("key");

-- CreateIndex
CREATE INDEX "CustomerGroup_isDefault_idx" ON "CustomerGroup"("isDefault");

-- CreateIndex
CREATE INDEX "CustomerGroup_isActive_idx" ON "CustomerGroup"("isActive");

-- CreateIndex
CREATE INDEX "User_customerGroupId_idx" ON "User"("customerGroupId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_customerGroupId_fkey" FOREIGN KEY ("customerGroupId") REFERENCES "CustomerGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;
