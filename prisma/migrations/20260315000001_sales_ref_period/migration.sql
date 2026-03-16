-- prisma/migrations/20260315000001_sales_ref_period/migration.sql
-- Adds referenceNumber to SalesDocument and billingPeriod to SalesDocumentLine

ALTER TABLE "SalesDocument"
  ADD COLUMN IF NOT EXISTS "referenceNumber" TEXT;

ALTER TABLE "SalesDocumentLine"
  ADD COLUMN IF NOT EXISTS "billingPeriod" TEXT;
