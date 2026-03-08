-- CreateEnum
CREATE TYPE "TemplateStatus" AS ENUM ('active', 'inactive', 'coming_soon');

-- CreateEnum
CREATE TYPE "TemplateIconType" AS ENUM ('devicon', 'upload');

-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN     "templateSlug" TEXT;

-- CreateTable
CREATE TABLE "OsTemplate" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "family" TEXT,
    "description" TEXT,
    "category" TEXT NOT NULL,
    "iconType" "TemplateIconType" NOT NULL DEFAULT 'devicon',
    "iconValue" TEXT,
    "status" "TemplateStatus" NOT NULL DEFAULT 'active',
    "sortOrder" INTEGER NOT NULL DEFAULT 1,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "tagKeys" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OsTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OsTemplate_slug_key" ON "OsTemplate"("slug");

-- CreateIndex
CREATE INDEX "OsTemplate_status_idx" ON "OsTemplate"("status");

-- CreateIndex
CREATE INDEX "OsTemplate_family_idx" ON "OsTemplate"("family");

-- CreateIndex
CREATE INDEX "OsTemplate_category_idx" ON "OsTemplate"("category");
