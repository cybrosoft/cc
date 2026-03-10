-- Step 4 Migration: Sales module schema, notifications, bilingual fields
-- Run: npx prisma migrate dev --name step4_sales_notifications_bilingual

-- ── New Enums ─────────────────────────────────────────────────────────────────

CREATE TYPE "SalesDocumentType" AS ENUM (
  'RFQ', 'QUOTATION', 'PO', 'DELIVERY_NOTE', 'PROFORMA', 'INVOICE', 'CREDIT_NOTE'
);

CREATE TYPE "SalesDocumentStatus" AS ENUM (
  'DRAFT', 'ISSUED', 'SENT', 'ACCEPTED', 'REJECTED', 'CONVERTED',
  'PAID', 'PARTIAL', 'OVERDUE', 'VOID'
);

CREATE TYPE "PaymentMethod" AS ENUM (
  'BANK_TRANSFER', 'STRIPE', 'CASH', 'OTHER'
);

CREATE TYPE "NotificationType" AS ENUM (
  'INFO', 'WARNING', 'ERROR', 'SUCCESS'
);

-- ── Field additions to existing models ───────────────────────────────────────

-- Category: Arabic name
ALTER TABLE "Category" ADD COLUMN "nameAr" TEXT;

-- Product: bilingual names + product details
ALTER TABLE "Product" ADD COLUMN "nameAr"         TEXT;
ALTER TABLE "Product" ADD COLUMN "productDetails" TEXT;
ALTER TABLE "Product" ADD COLUMN "detailsAr"      TEXT;

-- Market: VAT + legal info + payment methods
ALTER TABLE "Market" ADD COLUMN "vatPercent"     DECIMAL;
ALTER TABLE "Market" ADD COLUMN "legalInfo"      JSONB;
ALTER TABLE "Market" ADD COLUMN "companyProfile" JSONB;
ALTER TABLE "Market" ADD COLUMN "paymentMethods" TEXT[] NOT NULL DEFAULT '{}';

-- ── NumberSeries ──────────────────────────────────────────────────────────────

CREATE TABLE "NumberSeries" (
  "id"       TEXT NOT NULL,
  "marketId" TEXT NOT NULL,
  "docType"  "SalesDocumentType" NOT NULL,
  "prefix"   TEXT NOT NULL,
  "nextNum"  INTEGER NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "NumberSeries_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "NumberSeries_marketId_docType_key" ON "NumberSeries"("marketId", "docType");
CREATE INDEX "NumberSeries_marketId_idx" ON "NumberSeries"("marketId");

ALTER TABLE "NumberSeries"
  ADD CONSTRAINT "NumberSeries_marketId_fkey"
  FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── SalesDocument ─────────────────────────────────────────────────────────────

CREATE TABLE "SalesDocument" (
  "id"           TEXT NOT NULL,
  "docNum"       TEXT NOT NULL,
  "type"         "SalesDocumentType" NOT NULL,
  "status"       "SalesDocumentStatus" NOT NULL DEFAULT 'DRAFT',
  "marketId"     TEXT NOT NULL,
  "customerId"   TEXT NOT NULL,
  "originDocId"  TEXT,
  "currency"     TEXT NOT NULL,
  "subtotal"     INTEGER NOT NULL DEFAULT 0,
  "vatPercent"   DECIMAL NOT NULL DEFAULT 0,
  "vatAmount"    INTEGER NOT NULL DEFAULT 0,
  "total"        INTEGER NOT NULL DEFAULT 0,
  "notes"        TEXT,
  "internalNote" TEXT,
  "issueDate"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "dueDate"      TIMESTAMP(3),
  "paidAt"       TIMESTAMP(3),
  "rfqTitle"     TEXT,
  "rfqFileUrl"   TEXT,
  "zatcaQrCode"  TEXT,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL,

  CONSTRAINT "SalesDocument_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SalesDocument_docNum_key" ON "SalesDocument"("docNum");
CREATE INDEX "SalesDocument_marketId_idx"   ON "SalesDocument"("marketId");
CREATE INDEX "SalesDocument_customerId_idx" ON "SalesDocument"("customerId");
CREATE INDEX "SalesDocument_type_idx"       ON "SalesDocument"("type");
CREATE INDEX "SalesDocument_status_idx"     ON "SalesDocument"("status");
CREATE INDEX "SalesDocument_issueDate_idx"  ON "SalesDocument"("issueDate");

ALTER TABLE "SalesDocument"
  ADD CONSTRAINT "SalesDocument_marketId_fkey"
  FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SalesDocument"
  ADD CONSTRAINT "SalesDocument_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SalesDocument"
  ADD CONSTRAINT "SalesDocument_originDocId_fkey"
  FOREIGN KEY ("originDocId") REFERENCES "SalesDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ── SalesDocumentLine ─────────────────────────────────────────────────────────

CREATE TABLE "SalesDocumentLine" (
  "id"          TEXT NOT NULL,
  "documentId"  TEXT NOT NULL,
  "productId"   TEXT,
  "description" TEXT NOT NULL,
  "quantity"    DECIMAL NOT NULL DEFAULT 1,
  "unitPrice"   INTEGER NOT NULL,
  "discount"    DECIMAL NOT NULL DEFAULT 0,
  "lineTotal"   INTEGER NOT NULL,
  "sortOrder"   INTEGER NOT NULL DEFAULT 0,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,

  CONSTRAINT "SalesDocumentLine_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SalesDocumentLine_documentId_idx" ON "SalesDocumentLine"("documentId");
CREATE INDEX "SalesDocumentLine_productId_idx"  ON "SalesDocumentLine"("productId");

ALTER TABLE "SalesDocumentLine"
  ADD CONSTRAINT "SalesDocumentLine_documentId_fkey"
  FOREIGN KEY ("documentId") REFERENCES "SalesDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SalesDocumentLine"
  ADD CONSTRAINT "SalesDocumentLine_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ── SalesPayment ──────────────────────────────────────────────────────────────

CREATE TABLE "SalesPayment" (
  "id"          TEXT NOT NULL,
  "documentId"  TEXT NOT NULL,
  "marketId"    TEXT NOT NULL,
  "method"      "PaymentMethod" NOT NULL,
  "amountCents" INTEGER NOT NULL,
  "currency"    TEXT NOT NULL,
  "reference"   TEXT,
  "notes"       TEXT,
  "receiptUrl"  TEXT,
  "paidAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "SalesPayment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SalesPayment_documentId_idx" ON "SalesPayment"("documentId");
CREATE INDEX "SalesPayment_marketId_idx"   ON "SalesPayment"("marketId");

ALTER TABLE "SalesPayment"
  ADD CONSTRAINT "SalesPayment_documentId_fkey"
  FOREIGN KEY ("documentId") REFERENCES "SalesDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SalesPayment"
  ADD CONSTRAINT "SalesPayment_marketId_fkey"
  FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ── Notification ──────────────────────────────────────────────────────────────

CREATE TABLE "Notification" (
  "id"          TEXT NOT NULL,
  "userId"      TEXT NOT NULL,
  "type"        "NotificationType" NOT NULL DEFAULT 'INFO',
  "title"       TEXT NOT NULL,
  "body"        TEXT NOT NULL,
  "link"        TEXT,
  "isRead"      BOOLEAN NOT NULL DEFAULT false,
  "readAt"      TIMESTAMP(3),
  "emailSent"   BOOLEAN NOT NULL DEFAULT false,
  "emailSentAt" TIMESTAMP(3),
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Notification_userId_idx"    ON "Notification"("userId");
CREATE INDEX "Notification_isRead_idx"    ON "Notification"("isRead");
CREATE INDEX "Notification_createdAt_idx" ON "Notification"("createdAt");

ALTER TABLE "Notification"
  ADD CONSTRAINT "Notification_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── PortalPage ────────────────────────────────────────────────────────────────

CREATE TABLE "PortalPage" (
  "id"        TEXT NOT NULL,
  "slug"      TEXT NOT NULL,
  "title"     TEXT NOT NULL,
  "titleAr"   TEXT,
  "content"   TEXT NOT NULL,
  "contentAr" TEXT,
  "isPublic"  BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PortalPage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PortalPage_slug_key"     ON "PortalPage"("slug");
CREATE INDEX        "PortalPage_isPublic_idx" ON "PortalPage"("isPublic");

-- ── PortalSetting ─────────────────────────────────────────────────────────────

CREATE TABLE "PortalSetting" (
  "id"        TEXT NOT NULL,
  "key"       TEXT NOT NULL,
  "value"     TEXT NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PortalSetting_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PortalSetting_key_key" ON "PortalSetting"("key");
CREATE INDEX        "PortalSetting_key_idx" ON "PortalSetting"("key");
