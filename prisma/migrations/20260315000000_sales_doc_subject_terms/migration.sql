-- prisma/migrations/20260315000000_sales_doc_subject_terms/migration.sql
-- Adds subject line and terms & conditions fields to SalesDocument

ALTER TABLE "SalesDocument"
  ADD COLUMN IF NOT EXISTS "subject"            TEXT,
  ADD COLUMN IF NOT EXISTS "termsAndConditions" TEXT;
