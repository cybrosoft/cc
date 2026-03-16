// app/admin/sales/ui/SalesListPage.tsx
// Generic list page used by every sales document section.
// Handles: filtering, table display, create modal, convert modal, router navigation.

"use client";
import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { PageShell, CLR } from "@/components/ui/admin-ui";
import {
  SalesDocTable, SalesFilters, CreateDocModal, ConvertModal,
  type SalesDocRow,
} from "./sales-ui";
import type { SalesDocumentType } from "@prisma/client";

const ALL_STATUSES = [
  "DRAFT","ISSUED","SENT","ACCEPTED","REJECTED","CONVERTED","PAID","PARTIAL","OVERDUE","VOID"
];

const ENDPOINT: Record<string, string> = {
  RFQ:           "/api/admin/sales/rfq",
  QUOTATION:     "/api/admin/sales/quotations",
  PO:            "/api/admin/sales/po",
  DELIVERY_NOTE: "/api/admin/sales/delivery-notes",
  PROFORMA:      "/api/admin/sales/proforma",
  INVOICE:       "/api/admin/sales/invoices",
  CREDIT_NOTE:   "/api/admin/sales/returns",
};

const DETAIL_BASE: Record<string, string> = {
  RFQ:           "/admin/sales/rfq",
  QUOTATION:     "/admin/sales/quotations",
  PO:            "/admin/sales/po",
  DELIVERY_NOTE: "/admin/sales/delivery-notes",
  PROFORMA:      "/admin/sales/proforma",
  INVOICE:       "/admin/sales/invoices",
  CREDIT_NOTE:   "/admin/sales/returns",
};

const TYPE_LABEL: Record<string, string> = {
  RFQ: "RFQ Received", QUOTATION: "Quotations", PO: "Issued PO",
  DELIVERY_NOTE: "Delivery Notes", PROFORMA: "Proforma Invoices",
  INVOICE: "Invoices", CREDIT_NOTE: "Invoice Returns",
};

const BREADCRUMB: Record<string, string> = {
  RFQ: "ADMIN / SALES / RFQ",
  QUOTATION: "ADMIN / SALES / QUOTATIONS",
  PO: "ADMIN / SALES / ISSUED PO",
  DELIVERY_NOTE: "ADMIN / SALES / DELIVERY NOTES",
  PROFORMA: "ADMIN / SALES / PROFORMA INVOICES",
  INVOICE: "ADMIN / SALES / INVOICES",
  CREDIT_NOTE: "ADMIN / SALES / INVOICE RETURNS",
};

interface Props { docType: SalesDocumentType }

export default function SalesListPage({ docType }: Props) {
  const router  = useRouter();
  const [docs, setDocs]           = useState<SalesDocRow[]>([]);
  const [loading, setLoading]     = useState(true);
  const [q, setQ]                 = useState("");
  const [status, setStatus]       = useState("");
  const [marketKey, setMarketKey] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [convertId, setConvertId]   = useState<string | null>(null);
  const [convertDoc, setConvertDoc] = useState<SalesDocRow | null>(null);

  const fetchDocs = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (q)         params.set("q", q);
    if (status)    params.set("status", status);
    try {
      const res  = await fetch(`${ENDPOINT[docType]}?${params}`);
      const data = await res.json();
      let rows: SalesDocRow[] = data.docs ?? [];
      // Client-side market filter (we filter by key since API accepts marketId)
      if (marketKey) rows = rows.filter((d) => d.market.key === marketKey);
      setDocs(rows);
    } catch { /* silent */ }
    setLoading(false);
  }, [docType, q, status, marketKey]);

  useEffect(() => { fetchDocs(); }, [fetchDocs]);

  function openConvert(id: string) {
    const doc = docs.find((d) => d.id === id) ?? null;
    setConvertDoc(doc);
    setConvertId(id);
  }

  return (
    <PageShell
      breadcrumb={BREADCRUMB[docType]}
      title={TYPE_LABEL[docType]}
      ctaLabel={`New ${TYPE_LABEL[docType].replace(/s$/, "")}`}
      ctaOnClick={() => setShowCreate(true)}
    >
      <SalesFilters
        q={q} setQ={setQ}
        status={status} setStatus={setStatus}
        marketKey={marketKey} setMarketKey={setMarketKey}
        statuses={ALL_STATUSES}
      />

      <SalesDocTable
        docs={docs}
        loading={loading}
        onOpen={(id) => router.push(`${DETAIL_BASE[docType]}/${id}`)}
        onConvert={openConvert}
      />

      {/* Summary bar */}
      {!loading && (
        <div style={{ marginTop: 10, fontSize: 12, color: CLR.faint }}>
          {docs.length} document{docs.length !== 1 ? "s" : ""}
        </div>
      )}

      {/* Create modal */}
      {showCreate && (
        <CreateDocModal
          docType={docType}
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); fetchDocs(); }}
        />
      )}

      {/* Convert modal */}
      {convertId && convertDoc && (
        <ConvertModal
          docId={convertId}
          docNum={convertDoc.docNum}
          docType={convertDoc.type}
          onClose={() => { setConvertId(null); setConvertDoc(null); }}
          onConverted={(newId) => {
            setConvertId(null); setConvertDoc(null);
            fetchDocs();
            // Navigate to the converted doc's detail page
            const targetType = docs.find((d) => d.id === convertId)?.type;
            if (targetType) router.push(`${DETAIL_BASE[targetType]}/${newId}`);
          }}
        />
      )}
    </PageShell>
  );
}
