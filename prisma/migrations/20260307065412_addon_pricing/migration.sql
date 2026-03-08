-- CreateEnum
CREATE TYPE "AddonPricingType" AS ENUM ('fixed', 'percentage', 'per_unit');

-- CreateEnum
CREATE TYPE "AddonBehavior" AS ENUM ('optional', 'required');

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "addonBehavior" "AddonBehavior",
ADD COLUMN     "addonMaxUnits" INTEGER,
ADD COLUMN     "addonMinUnits" INTEGER,
ADD COLUMN     "addonPercentage" DECIMAL(65,30),
ADD COLUMN     "addonPricingType" "AddonPricingType",
ADD COLUMN     "addonUnitLabel" TEXT,
ADD COLUMN     "applicableTags" TEXT[];
