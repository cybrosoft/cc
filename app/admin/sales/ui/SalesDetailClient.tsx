// app/admin/sales/ui/SalesDetailClient.tsx
"use client";
import React, { useEffect, useState, useRef, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CLR } from "@/components/ui/admin-ui";
import { Icon } from "@/components/ui/Icon";
import {
  SalesStatusBadge, DocTypeBadge, LineItemsEditor, ConvertModal,
  fmtAmount, fmtDate, Overlay, ModalBox, PrimaryBtn, GhostBtn,
  SendEmailModal, StatusChangeModal,
  type LineItem, type EligibleProduct,
} from "./sales-ui";

const ENDPOINT_FOR_TYPE: Record<string, string> = {
  RFQ:           "/api/admin/sales/rfq",
  QUOTATION:     "/api/admin/sales/quotations",
  PO:            "/api/admin/sales/po",
  DELIVERY_NOTE: "/api/admin/sales/delivery-notes",
  PROFORMA:      "/api/admin/sales/proforma",
  INVOICE:       "/api/admin/sales/invoices",
  CREDIT_NOTE:   "/api/admin/sales/returns",
};

const DETAIL_BASE: Record<string, string> = {
  RFQ:           "/admin/crm/leads",
  QUOTATION:     "/admin/sales/quotations",
  PO:            "/admin/sales/po",
  DELIVERY_NOTE: "/admin/sales/delivery-notes",
  PROFORMA:      "/admin/sales/proforma",
  INVOICE:       "/admin/sales/invoices",
  CREDIT_NOTE:   "/admin/sales/returns",
};

const LOCKED_STATUSES = ["PAID", "VOID", "WRITTEN_OFF", "APPLIED", "CANCELLED"];
const WARN_STATUSES   = ["ISSUED", "SENT", "REVISED", "QUOTED", "PARTIALLY_PAID"];

interface Props { docId: string; docType: string; backHref: string }

const card: React.CSSProperties = {
  background: "#fff", border: "1px solid #e5e7eb", padding: "16px 20px",
};
const sectionLabel: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, color: "#9ca3af",
  textTransform: "uppercase" as const, letterSpacing: "0.05em", marginBottom: 12,
};
const fieldLabel: React.CSSProperties = {
  fontSize: 11, fontWeight: 600, color: "#9ca3af",
  textTransform: "uppercase" as const, letterSpacing: "0.04em", marginBottom: 4,
};
const fieldValue: React.CSSProperties = { fontSize: 13, color: "#111827", fontWeight: 500 };
const inputStyle: React.CSSProperties = {
  width: "100%", padding: "7px 10px", fontSize: 13,
  border: "1px solid #d1d5db", outline: "none",
  fontFamily: "inherit", color: "#111827", background: "#fff",
  boxSizing: "border-box" as const,
};

export default function SalesDetailClient({ docId, docType, backHref }: Props) {
  const router       = useRouter();
  const searchParams = useSearchParams();

  const [doc,     setDoc]     = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState("");

  const [editing,      setEditing]      = useState(false);
  const [lines,        setLines]        = useState<LineItem[]>([]);
  const [subject,      setSubject]      = useState("");
  const [refNumber,    setRefNumber]    = useState("");
  const [notes,        setNotes]        = useState("");
  const [internalNote, setInternalNote] = useState("");
  const [dueDate,      setDueDate]      = useState("");
  const [issueDate,    setIssueDate]    = useState("");
  const [terms,        setTerms]        = useState("");
  const [newFile,      setNewFile]      = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Official invoice upload state
  const [uploading,   setUploading]   = useState(false);
  const [deleting,    setDeleting]    = useState(false);
  const [uploadMsg,   setUploadMsg]   = useState<{ ok: boolean; text: string } | null>(null);
  const uploadFileRef = useRef<HTMLInputElement>(null);

  // CRM / Lead fields (RFQ only)
  const [leadSource,        setLeadSource]        = useState("");
  const [leadPriority,      setLeadPriority]      = useState("");
  const [assignedToId,      setAssignedToId]      = useState("");
  const [expectedCloseDate, setExpectedCloseDate] = useState("");
  const [followUpDate,      setFollowUpDate]      = useState("");
  const [lostReason,        setLostReason]        = useState("");

  // CRM Activities
  const [activities,     setActivities]     = useState<any[]>([]);
  const [actLoading,     setActLoading]     = useState(false);
  const [showActForm,    setShowActForm]    = useState(false);
  const [actType,        setActType]        = useState("NOTE");
  const [actTitle,       setActTitle]       = useState("");
  const [actDesc,        setActDesc]        = useState("");
  const [actDue,         setActDue]         = useState("");
  const [actSaving,      setActSaving]      = useState(false);
  const [actError,       setActError]       = useState("");

  // Status / change log
  const [docLogs,        setDocLogs]        = useState<any[]>([]);
  const [logsLoading,    setLogsLoading]    = useState(false);

  // Admin users for assignee dropdown
  const [adminUsers,     setAdminUsers]     = useState<{ id: string; fullName: string | null; email: string }[]>([]);

  const [eligibleProducts, setEligibleProducts] = useState<EligibleProduct[]>([]);

  // Responsive
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    function check() { setIsMobile(window.innerWidth < 768); }
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);
  const [allProducts, setAllProducts] = useState<EligibleProduct[]>([]);

  const [showConvert,   setShowConvert]   = useState(false);
  const [showPayment,   setShowPayment]   = useState(false);
  const [showStatus,    setShowStatus]    = useState(false);
  const [sendModalMode, setSendModalMode] = useState<"reminder" | "custom" | null>(null);

  const [sendDropOpen, setSendDropOpen] = useState(false);
  const sendDropRef = useRef<HTMLDivElement>(null);

  const [payMethod,  setPayMethod]  = useState("BANK_TRANSFER");
  const [payAmount,  setPayAmount]  = useState("");
  const [payRef,     setPayRef]     = useState("");
  const [payNotes,   setPayNotes]   = useState("");
  const [payDate,    setPayDate]    = useState(new Date().toISOString().split("T")[0]);
  const [payLoading, setPayLoading] = useState(false);
  const [payError,   setPayError]   = useState("");

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (sendDropRef.current && !sendDropRef.current.contains(e.target as Node)) {
        setSendDropOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const fetchProducts = useCallback(async (customerId: string, marketId: string, currency: string) => {
    if (!customerId || !marketId) return;
    try {
      const [eligRes, catalogRes, pricingRes, metaRes] = await Promise.all([
        fetch(`/api/admin/subscriptions/eligible-products?customerId=${customerId}&rich=1`).then(r => r.json()).catch(() => ({ ok: false })),
        fetch("/api/admin/catalog/products").then(r => r.json()).catch(() => ({ data: [] })),
        fetch("/api/admin/catalog/pricing").then(r => r.json()).catch(() => ({ data: [] })),
        fetch("/api/admin/catalog/pricing/meta").then(r => r.json()).catch(() => ({ data: { groups: [] } })),
      ]);

      if (eligRes.ok) {
        setEligibleProducts([
          ...(eligRes.plans    ?? []),
          ...(eligRes.addons   ?? []),
          ...(eligRes.services ?? []),
        ]);
      }

      const groups: any[]     = metaRes.data?.groups ?? [];
      const stdGroup           = groups.find((g: any) => g.key === "standard") ?? groups[0];
      const stdGroupId: string = stdGroup?.id ?? "";
      const pricingRows: any[] = pricingRes.data ?? [];

      const stdMap = new Map<string, number>();
      for (const row of pricingRows) {
        if (row.customerGroupId === stdGroupId && row.marketId === marketId) {
          stdMap.set(`${row.productId}:${row.billingPeriod}`, row.priceCents);
        }
      }

      setAllProducts((catalogRes.data ?? []).filter((p: any) => p.isActive).map((p: any) => {
        const periodsFromProduct: string[] = p.billingPeriods ?? [];
        const periodsFromPricing = pricingRows
          .filter((r: any) => r.productId === p.id && r.customerGroupId === stdGroupId && r.marketId === marketId)
          .map((r: any) => r.billingPeriod);
        const periods = periodsFromProduct.length > 0 ? periodsFromProduct : periodsFromPricing;
        const prices = periods
          .map((period: string) => {
            const cents = stdMap.get(`${p.id}:${period}`);
            if (cents === undefined) return null;
            return { billingPeriod: period, priceCents: cents, currency, isOverride: false };
          })
          .filter(Boolean) as EligibleProduct["prices"];
        return {
          id: p.id, key: p.key, name: p.name,
          nameAr: p.nameAr ?? null, productDetails: p.productDetails ?? null,
          detailsAr: p.detailsAr ?? null, type: p.type,
          billingPeriods: periods, prices, unitLabel: p.unitLabel ?? null,
        };
      }));
    } catch {}
  }, []);

  useEffect(() => {
    if (docType !== "RFQ") return;
    fetch("/api/admin/users?role=ADMIN&pageSize=100")
      .then(r => r.json())
      .then(d => setAdminUsers(d.data ?? []))
      .catch(() => {});
  }, [docType]);

  const loadActivities = useCallback(async () => {
    if (docType !== "RFQ") return;
    setActLoading(true);
    try {
      const res  = await fetch(`/api/admin/crm/leads/${docId}/activities`);
      const data = await res.json();
      setActivities(data.activities ?? []);
    } catch { /**/ }
    setActLoading(false);
  }, [docId, docType]);

  useEffect(() => { loadActivities(); }, [loadActivities]);

  const loadLogs = useCallback(async () => {
    setLogsLoading(true);
    try {
      const res  = await fetch(`/api/admin/sales/${docId}/log`);
      const data = await res.json();
      setDocLogs(data.logs ?? []);
    } catch { /**/ }
    setLogsLoading(false);
  }, [docId]);

  useEffect(() => { loadLogs(); }, [loadLogs]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch(`/api/admin/sales/${docId}`);
      const data = await res.json();
      const d    = data.doc;
      setDoc(d);
      populateEdit(d);
      await fetchProducts(d.customer?.id ?? "", d.market?.id ?? "", d.currency ?? "SAR");
    } catch { setError("Failed to load document."); }
    setLoading(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docId, fetchProducts]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (searchParams?.get("edit") === "1" && doc && !loading) setEditing(true);
  }, [doc, loading, searchParams]);

  function populateEdit(d: any) {
    setLines((d.lines ?? []).map((l: any) => ({
      id: l.id, productId: l.productId ?? null,
      productKey: l.product?.key ?? "",
      description: l.description ?? "",
      descriptionAr: l.descriptionAr ?? "",
      productDetails: l.productDetails ?? "",
      detailsAr: l.detailsAr ?? "",
      billingPeriod: l.billingPeriod ?? "",
      quantity: Number(l.quantity),
      unitPrice: l.unitPrice,
      discount: Number(l.discount),
      lineTotal: l.lineTotal,
      isNonInventory: !l.productId,
      showDetails: false,
    })));
    setSubject(d.subject ?? "");
    setRefNumber(d.referenceNumber ?? "");
    setNotes(d.notes ?? "");
    setInternalNote(d.internalNote ?? "");
    setDueDate(d.dueDate ? d.dueDate.split("T")[0] : "");
    setIssueDate(d.issueDate ? d.issueDate.split("T")[0] : "");
    setTerms(d.termsAndConditions ?? "");
    setLeadSource(d.leadSource        ?? "");
    setLeadPriority(d.leadPriority    ?? "");
    setAssignedToId(d.assignedToId    ?? "");
    setExpectedCloseDate(d.expectedCloseDate ? d.expectedCloseDate.split("T")[0] : "");
    setFollowUpDate(d.followUpDate    ? d.followUpDate.split("T")[0]    : "");
    setLostReason(d.lostReason        ?? "");
  }

  function startEdit()  { populateEdit(doc); setEditing(true);  setError(""); }
  function cancelEdit() { populateEdit(doc); setEditing(false); setError(""); setNewFile(null); }

  async function saveChanges() {
    setSaving(true); setError("");
    try {
      let rfqFileUrl: string | undefined;
      if (newFile) {
        const fd = new FormData();
        fd.append("file", newFile);
        fd.append("docType", docType);
        const uploadRes  = await fetch("/api/admin/sales/upload", { method: "POST", body: fd });
        const uploadData = await uploadRes.json();
        if (!uploadRes.ok) throw new Error(uploadData.error ?? "Upload failed");
        rfqFileUrl = uploadData.url;
      }

      const res = await fetch(`${ENDPOINT_FOR_TYPE[docType]}/${docId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject:            subject      || null,
          referenceNumber:    refNumber    || null,
          notes:              notes        || null,
          internalNote:       internalNote || null,
          dueDate:            dueDate      || null,
          issueDate:          issueDate    || null,
          termsAndConditions: terms        || null,
          ...(rfqFileUrl ? { rfqFileUrl } : {}),
          ...(docType === "RFQ" ? {
            leadSource:        leadSource        || null,
            leadPriority:      leadPriority      || null,
            assignedToId:      assignedToId      || null,
            expectedCloseDate: expectedCloseDate || null,
            followUpDate:      followUpDate      || null,
            lostReason:        lostReason        || null,
          } : {}),
          lines: lines.map(l => ({
            id:             l.id,
            productId:      l.productId,
            description:    l.description,
            descriptionAr:  l.descriptionAr  || null,
            billingPeriod:  l.billingPeriod  || null,
            productDetails: l.productDetails || null,
            detailsAr:      l.detailsAr      || null,
            quantity:       l.quantity,
            unitPrice:      l.unitPrice,
            discount:       l.discount,
          })),
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setEditing(false);
      setNewFile(null);
      await load();
    } catch (e: any) { setError(e.message); }
    setSaving(false);
  }

  async function uploadOfficialInvoice(file: File) {
    setUploading(true); setUploadMsg(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res  = await fetch(`/api/admin/sales/${docId}/official-invoice`, { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setDoc((prev: any) => ({ ...prev, officialInvoiceUrl: data.officialInvoiceUrl }));
      setUploadMsg({ ok: true, text: "Official invoice uploaded successfully" });
    } catch (e: any) {
      setUploadMsg({ ok: false, text: e.message });
    }
    setUploading(false);
  }

  async function deleteOfficialInvoice() {
    if (!confirm("Remove uploaded official invoice?")) return;
    setDeleting(true); setUploadMsg(null);
    try {
      const res  = await fetch(`/api/admin/sales/${docId}/official-invoice`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setDoc((prev: any) => ({ ...prev, officialInvoiceUrl: null }));
      setUploadMsg({ ok: true, text: "Official invoice removed" });
    } catch (e: any) {
      setUploadMsg({ ok: false, text: e.message });
    }
    setDeleting(false);
  }

  async function viewOfficialInvoice() {
    try {
      const res  = await fetch(`/api/admin/sales/${docId}/official-invoice/view`);
      const data = await res.json();
      if (data.url) window.open(data.url, "_blank");
    } catch { /**/ }
  }

  async function sendEmailDirect(mode: "default" | "resend") {
    setSaving(true); setError("");
    setSendDropOpen(false);
    try {
      const res  = await fetch(`/api/admin/sales/${docId}/send-email`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setDoc((prev: any) => ({ ...prev, emailSentAt: data.emailSentAt, emailSentCount: data.emailSentCount }));
    } catch (e: any) { setError(e.message); }
    setSaving(false);
  }

  function handleConverted(redirectTo: string) { setShowConvert(false); router.push(redirectTo); }

  async function recordPayment() {
    setPayLoading(true); setPayError("");
    try {
      const cents = Math.round(parseFloat(payAmount) * 100);
      if (!cents || isNaN(cents)) throw new Error("Invalid amount");
      const res = await fetch(`/api/admin/sales/${docId}/payment`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          method: payMethod, amountCents: cents, currency: doc.currency,
          reference: payRef || null, notes: payNotes || null,
          paidAt: payDate || null, marketId: doc.market.id,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setShowPayment(false);
      setPayAmount(""); setPayRef(""); setPayNotes("");
      await load();
    } catch (e: any) { setPayError(e.message); }
    setPayLoading(false);
  }

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: CLR.faint, fontSize: 13 }}>Loading…</div>;
  if (!doc)    return <div style={{ padding: 40, textAlign: "center", color: "#dc2626", fontSize: 13 }}>{error || "Document not found."}</div>;

  const vatPct          = Number(doc.market?.vatPercent ?? doc.vatPercent ?? 0);
  const totalPaid       = (doc.payments ?? []).reduce((s: number, p: any) => s + p.amountCents, 0);
  const balanceDue      = doc.total - totalPaid;
  const isLocked        = LOCKED_STATUSES.includes(doc.status);
  const isWarning       = WARN_STATUSES.includes(doc.status);
  const canSend         = !["VOID"].includes(doc.status);
  const hasBeenSent     = (doc.emailSentCount ?? 0) > 0;
  const isInvoiceUnpaid = doc.type === "INVOICE" && ["ISSUED", "SENT", "PARTIALLY_PAID", "OVERDUE"].includes(doc.status);
  const canPay          = ["ISSUED", "SENT", "PARTIALLY_PAID", "OVERDUE"].includes(doc.status);

  // Saudi official invoice logic
  const isSaudi          = doc.market?.key === "SAUDI";
  const isOfficialType   = ["INVOICE", "CREDIT_NOTE"].includes(doc.type);
  const needsOfficialPdf = isSaudi && isOfficialType;
  const hasOfficialPdf   = !!doc.officialInvoiceUrl;
  const sendBlocked      = needsOfficialPdf && !hasOfficialPdf;

  // Market-aware label
  const docLabel = needsOfficialPdf
    ? (doc.type === "INVOICE" ? "Invoice Memo" : "Credit Note Memo")
    : doc.type.replace(/_/g, " ");

  return (
    <div>

      {/* Official Invoice Upload Panel — Saudi INVOICE/CREDIT_NOTE only */}
      {needsOfficialPdf && (
        <div style={{ marginBottom: 16, border: `1px solid ${hasOfficialPdf ? "#86efac" : "#fcd34d"}`, background: hasOfficialPdf ? "#f0fdf4" : "#fffbeb", padding: "12px 16px", display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            {hasOfficialPdf ? (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 15 }}>✓</span>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#15803d" }}>Official Invoice Attached</div>
                  <div style={{ fontSize: 11, color: "#6b7280" }}>ZATCA-compliant PDF uploaded — ready to send</div>
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 15 }}>⚠</span>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#b45309" }}>No Official Invoice Attached</div>
                  <div style={{ fontSize: 11, color: "#6b7280" }}>Upload the Zoho-generated ZATCA PDF before sending to customer</div>
                </div>
              </div>
            )}
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
            {hasOfficialPdf && (
              <>
                <button onClick={viewOfficialInvoice}
                  style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 12px", fontSize: 11, fontWeight: 600, color: CLR.primary, border: `1px solid ${CLR.primary}33`, background: "#fff", cursor: "pointer", fontFamily: "inherit" }}>
                  View ↗
                </button>
                <button onClick={deleteOfficialInvoice} disabled={deleting}
                  style={{ padding: "6px 12px", fontSize: 11, fontWeight: 600, color: "#dc2626", border: "1px solid #fecaca", background: "#fef2f2", cursor: deleting ? "not-allowed" : "pointer", fontFamily: "inherit", opacity: deleting ? 0.6 : 1 }}>
                  {deleting ? "Removing…" : "Remove"}
                </button>
              </>
            )}
            <label style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 14px", fontSize: 11, fontWeight: 600, background: hasOfficialPdf ? "#fff" : "#b45309", color: hasOfficialPdf ? "#374151" : "#fff", border: hasOfficialPdf ? "1px solid #d1d5db" : "none", cursor: uploading ? "not-allowed" : "pointer", opacity: uploading ? 0.6 : 1 }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
              {uploading ? "Uploading…" : hasOfficialPdf ? "Replace" : "Upload Zoho PDF"}
              <input ref={uploadFileRef} type="file" accept="application/pdf" style={{ display: "none" }}
                onChange={e => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file) uploadOfficialInvoice(file);
                }} />
            </label>
          </div>
          {uploadMsg && (
            <div style={{ width: "100%", fontSize: 12, fontWeight: 600, color: uploadMsg.ok ? "#15803d" : "#dc2626" }}>
              {uploadMsg.ok ? "✓ " : "✗ "}{uploadMsg.text}
            </div>
          )}
        </div>
      )}

      {/* Action bar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: isMobile ? "flex-start" : "center", marginBottom: 20, flexWrap: "wrap", gap: 10, flexDirection: isMobile ? "column" : "row" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button
              onClick={() => window.history.back()}
              style={{ background: "#fff", border: "1px solid #9ca3af", cursor: "pointer", fontSize: 12, color: "#9ca3af", letterSpacing: ".05em", padding: "5px 14px", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 4, marginRight: "10px" }}>
              ← Back
            </button>
            <h1 style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.02em", color: "#111827", margin: 0, fontFamily: "monospace" }}>{doc.docNum}</h1>
            <SalesStatusBadge status={doc.status} />
            {/* Market-aware doc type label */}
            <span style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>{docLabel}</span>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          {/* PDF Download */}
          {!editing && (
            <button
              onClick={async () => {
                if (sendBlocked) return;
                const res  = await fetch(`/api/admin/sales/${docId}/pdf`);
                if (!res.ok) { alert("PDF download failed"); return; }
                const blob = await res.blob();
                const href = URL.createObjectURL(blob);
                const a    = document.createElement("a");
                a.href = href; a.download = `${doc.docNum}.pdf`;
                document.body.appendChild(a); a.click();
                document.body.removeChild(a); URL.revokeObjectURL(href);
              }}
              disabled={sendBlocked}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", fontSize: 12, fontWeight: 600, background: "#fff", color: "#374151", border: "1px solid #d1d5db", cursor: sendBlocked ? "not-allowed" : "pointer", fontFamily: "inherit", opacity: sendBlocked ? 0.4 : 1 }}>
              <Icon name="download" size={13} color="#6b7280" />
              {needsOfficialPdf ? "ZATCA e-Invoice Download" : "PDF"}
            </button>
          )}

          {!editing ? (
            <button onClick={startEdit} disabled={isLocked}
              title={isLocked ? `Cannot edit — document is ${doc.status}` : "Edit document"}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", fontSize: 12, fontWeight: 600, background: "#fff", color: isLocked ? "#9ca3af" : "#374151", border: `1px solid ${isLocked ? "#e5e7eb" : "#d1d5db"}`, cursor: isLocked ? "not-allowed" : "pointer", fontFamily: "inherit" }}>
              <Icon name="edit" size={13} color={isLocked ? "#d1d5db" : "#6b7280"} />
              Edit
            </button>
          ) : (
            <>
              <button onClick={cancelEdit} style={{ padding: "7px 14px", fontSize: 12, fontWeight: 600, background: "#fff", color: "#374151", border: "1px solid #d1d5db", cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
              <button onClick={saveChanges} disabled={saving} style={{ padding: "7px 14px", fontSize: 12, fontWeight: 600, background: CLR.primary, color: "#fff", border: "none", cursor: saving ? "not-allowed" : "pointer", fontFamily: "inherit" }}>
                {saving ? "Saving…" : "Save Changes"}
              </button>
            </>
          )}

          {!editing && (
            <button
              onClick={() => { if (sendBlocked) { alert("Upload the official invoice before changing status"); return; } setShowStatus(true); }}
              title={sendBlocked ? "Upload official invoice first" : undefined}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", fontSize: 12, fontWeight: 600, background: "#fff", color: sendBlocked ? "#9ca3af" : "#374151", border: `1px solid ${sendBlocked ? "#e5e7eb" : "#d1d5db"}`, cursor: sendBlocked ? "not-allowed" : "pointer", fontFamily: "inherit" }}>
              <Icon name="chevron" size={13} color={sendBlocked ? "#d1d5db" : "#6b7280"} />
              Status
            </button>
          )}

          {!editing && canSend && (
            <div ref={sendDropRef} style={{ position: "relative" }}>
              <button
                onClick={() => { if (sendBlocked) return; setSendDropOpen(v => !v); }}
                title={sendBlocked ? "Upload official invoice before sending" : undefined}
                style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", fontSize: 12, fontWeight: 600, background: sendBlocked ? "#f3f4f6" : CLR.primary, color: sendBlocked ? "#9ca3af" : "#fff", border: sendBlocked ? "1px solid #e5e7eb" : "none", cursor: sendBlocked ? "not-allowed" : "pointer", fontFamily: "inherit" }}>
                <Icon name="mail" size={13} color={sendBlocked ? "#9ca3af" : "#fff"} />
                Send
                <span style={{ width: 1, height: 14, background: sendBlocked ? "#e5e7eb" : "rgba(255,255,255,0.3)", margin: "0 2px" }} />
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={sendBlocked ? "#9ca3af" : "#fff"} strokeWidth="2.5"><polyline points="6 9 12 15 18 9" /></svg>
              </button>
              {sendDropOpen && !sendBlocked && (
                <div style={{ position: "absolute", top: "calc(100% + 4px)", right: 0, zIndex: 200, background: "#fff", border: "1px solid #e5e7eb", boxShadow: "0 4px 16px rgba(0,0,0,0.10)", minWidth: 210 }}>
                  <DropItem icon="mail" label="Send" hint="Default template" onClick={() => sendEmailDirect("default")} />
                  {isInvoiceUnpaid && <DropItem icon="bell" label="Send Reminder" hint={doc.reminderEnabled ? `Active · ${doc.reminderCount ?? 0}/4 sent` : "Weekly, up to 4 times"} onClick={() => { setSendDropOpen(false); setSendModalMode("reminder"); }} active={doc.reminderEnabled} />}
                  <DropItem icon="edit" label="Send Custom" hint="Edit subject, body, CC/BCC" onClick={() => { setSendDropOpen(false); setSendModalMode("custom"); }} />
                  {hasBeenSent && (
                    <>
                      <div style={{ height: 1, background: "#f3f4f6" }} />
                      <DropItem icon="refresh" label="Resend" hint={`Last sent ${fmtDate(doc.emailSentAt)} · ${doc.emailSentCount}×`} onClick={() => sendEmailDirect("resend")} />
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {!editing && doc.status !== "VOID" && doc.status !== "CONVERTED" && (
            <button onClick={() => setShowConvert(true)} style={{ padding: "7px 14px", fontSize: 12, fontWeight: 600, background: "#fffbeb", color: "#b45309", border: "1px solid #fcd34d", cursor: "pointer", fontFamily: "inherit" }}>
              Convert ↗
            </button>
          )}

          {!editing && canPay && (
            <button onClick={() => setShowPayment(true)} style={{ padding: "7px 14px", fontSize: 12, fontWeight: 600, background: "#dcfce7", color: "#15803d", border: "1px solid #86efac", cursor: "pointer", fontFamily: "inherit" }}>
              Record Payment
            </button>
          )}
        </div>
      </div>

      {editing && isWarning && (
        <div style={{ padding: "10px 14px", background: "#fffbeb", border: "1px solid #fcd34d", color: "#92400e", fontSize: 13, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
          <Icon name="warning" size={14} color="#b45309" />
          This document has been {doc.status.toLowerCase().replace(/_/g, " ")}. Editing will not update any emails already sent.
        </div>
      )}

      {error && (
        <div style={{ padding: "10px 14px", background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626", fontSize: 13, marginBottom: 16 }}>
          {error}
        </div>
      )}

      {/* Main grid */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 300px", gap: 20, alignItems: "start" }}>

        {/* LEFT */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Document Info */}
          <div style={card}>
            <p style={sectionLabel}>Document Info</p>
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(3, 1fr)", gap: 16 }}>
              <div>
                <p style={fieldLabel}>Issue Date</p>
                {editing ? <input type="date" value={issueDate} onChange={e => setIssueDate(e.target.value)} style={inputStyle} /> : <p style={fieldValue}>{fmtDate(doc.issueDate)}</p>}
              </div>
              <div>
                <p style={fieldLabel}>Due Date</p>
                {editing ? <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} style={inputStyle} /> : <p style={fieldValue}>{fmtDate(doc.dueDate)}</p>}
              </div>
              <div>
                <p style={fieldLabel}>Language</p>
                <p style={fieldValue}>{doc.language === "ar" ? "Arabic" : doc.language === "bi" ? "Bilingual" : "English"}</p>
              </div>
              <div>
                <p style={fieldLabel}>Subject</p>
                {editing ? <input style={inputStyle} value={subject} onChange={e => setSubject(e.target.value)} placeholder="e.g. Cloud Services — March 2026" /> : <p style={fieldValue}>{doc.subject || "—"}</p>}
              </div>
              <div>
                <p style={fieldLabel}>Reference No.</p>
                {editing ? <input style={inputStyle} value={refNumber} onChange={e => setRefNumber(e.target.value)} placeholder="PO / RFQ ref…" /> : <p style={fieldValue}>{doc.referenceNumber || "—"}</p>}
              </div>
              <div>
                <p style={fieldLabel}>Email</p>
                <p style={fieldValue}>{hasBeenSent ? `Sent ${doc.emailSentCount}× · ${fmtDate(doc.emailSentAt)}` : "Not sent yet"}</p>
              </div>
            </div>
          </div>

          {/* Line Items */}
          <div style={card}>
            <p style={sectionLabel}>Line Items</p>
            <LineItemsEditor
              lines={lines}
              onChange={editing ? setLines : () => {}}
              currency={doc.currency}
              vatPercent={vatPct}
              eligibleProducts={eligibleProducts}
              allProducts={allProducts}
              readOnly={!editing}
            />
          </div>

          {/* Attachment */}
          {(doc.rfqFileUrl || editing) && (
            <div style={card}>
              <p style={sectionLabel}>Attachment</p>
              {editing ? (
                <div>
                  {doc.rfqFileUrl && !newFile && (
                    <div style={{ marginBottom: 10 }}>
                      <AttachmentButton fileKey={doc.rfqFileUrl} />
                      <p style={{ fontSize: 11, color: CLR.muted, marginTop: 4 }}>Upload a new file below to replace it.</p>
                    </div>
                  )}
                  {newFile && (
                    <div style={{ marginBottom: 10, padding: "8px 12px", background: CLR.primaryBg, border: `1px solid ${CLR.primary}33`, fontSize: 13 }}>
                      <span style={{ fontWeight: 600, color: CLR.primary }}>{newFile.name}</span>
                      <span style={{ color: CLR.muted, marginLeft: 8, fontSize: 11 }}>{(newFile.size / 1024).toFixed(1)} KB</span>
                      <button onClick={() => setNewFile(null)} style={{ background: "none", border: "none", color: "#dc2626", cursor: "pointer", fontSize: 11, marginLeft: 8 }}>Remove</button>
                    </div>
                  )}
                  <div onClick={() => fileRef.current?.click()}
                    style={{ border: "2px dashed #d1d5db", padding: "14px", textAlign: "center", cursor: "pointer", background: "#fafafa" }}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = CLR.primary)}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = "#d1d5db")}>
                    <p style={{ fontSize: 13, color: CLR.muted }}>Click to {doc.rfqFileUrl ? "replace" : "attach"} a file</p>
                    <p style={{ fontSize: 11, color: CLR.faint, marginTop: 2 }}>PDF, image, Word, Excel — max 10 MB</p>
                  </div>
                  <input ref={fileRef} type="file" style={{ display: "none" }}
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
                    onChange={e => setNewFile(e.target.files?.[0] ?? null)} />
                </div>
              ) : (
                doc.rfqFileUrl && <AttachmentButton fileKey={doc.rfqFileUrl} />
              )}
            </div>
          )}

          {/* Terms & Conditions */}
          <div style={card}>
            <p style={sectionLabel}>Terms &amp; Conditions</p>
            {editing
              ? <textarea style={{ ...inputStyle, height: 120, resize: "vertical" }} value={terms} onChange={e => setTerms(e.target.value)} placeholder="Enter terms and conditions…" />
              : <p style={{ ...fieldValue, color: doc.termsAndConditions ? "#111827" : "#9ca3af", whiteSpace: "pre-wrap" }}>{doc.termsAndConditions || "—"}</p>}
          </div>

          {/* Notes */}
          <div style={card}>
            <p style={sectionLabel}>Notes</p>
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 16 }}>
              <div>
                <p style={fieldLabel}>Customer Note</p>
                {editing
                  ? <textarea style={{ ...inputStyle, height: 80, resize: "vertical" }} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Visible to customer on document…" />
                  : <p style={{ ...fieldValue, color: doc.notes ? "#111827" : "#9ca3af" }}>{doc.notes || "—"}</p>}
              </div>
              <div>
                <p style={fieldLabel}>Internal Note</p>
                {editing
                  ? <textarea style={{ ...inputStyle, height: 80, resize: "vertical" }} value={internalNote} onChange={e => setInternalNote(e.target.value)} placeholder="Admin only — not shown to customer…" />
                  : <p style={{ ...fieldValue, color: doc.internalNote ? "#111827" : "#9ca3af" }}>{doc.internalNote || "—"}</p>}
              </div>
            </div>
          </div>

          {/* CRM Lead Info — RFQ only */}
          {docType === "RFQ" && (
            <div style={card}>
              <p style={sectionLabel}>Lead Info</p>
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 16 }}>
                <div>
                  <p style={fieldLabel}>Lead Source</p>
                  {editing ? (
                    <select style={inputStyle} value={leadSource} onChange={e => setLeadSource(e.target.value)}>
                      <option value="">— Select —</option>
                      {["PORTAL","MANUAL","REFERRAL","EMAIL","PHONE","OTHER"].map(s => (
                        <option key={s} value={s}>{s.charAt(0) + s.slice(1).toLowerCase()}</option>
                      ))}
                    </select>
                  ) : <p style={fieldValue}>{leadSource || "—"}</p>}
                </div>
                <div>
                  <p style={fieldLabel}>Priority</p>
                  {editing ? (
                    <select style={inputStyle} value={leadPriority} onChange={e => setLeadPriority(e.target.value)}>
                      <option value="">— Select —</option>
                      {["LOW","MEDIUM","HIGH","URGENT"].map(p => (
                        <option key={p} value={p}>{p.charAt(0) + p.slice(1).toLowerCase()}</option>
                      ))}
                    </select>
                  ) : (
                    <p style={{ ...fieldValue, color: leadPriority === "URGENT" ? "#dc2626" : leadPriority === "HIGH" ? "#b45309" : "#111827" }}>
                      {leadPriority || "—"}
                    </p>
                  )}
                </div>
                <div>
                  <p style={fieldLabel}>Assigned To</p>
                  {editing ? (
                    <select style={inputStyle} value={assignedToId} onChange={e => setAssignedToId(e.target.value)}>
                      <option value="">— Unassigned —</option>
                      {adminUsers.map(u => (
                        <option key={u.id} value={u.id}>{u.fullName ?? u.email}</option>
                      ))}
                    </select>
                  ) : (
                    <p style={fieldValue}>
                      {assignedToId
                        ? (adminUsers.find(u => u.id === assignedToId)?.fullName ?? adminUsers.find(u => u.id === assignedToId)?.email ?? assignedToId)
                        : "—"}
                    </p>
                  )}
                </div>
                <div>
                  <p style={fieldLabel}>Expected Close</p>
                  {editing
                    ? <input type="date" style={inputStyle} value={expectedCloseDate} onChange={e => setExpectedCloseDate(e.target.value)} />
                    : <p style={fieldValue}>{expectedCloseDate ? new Date(expectedCloseDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—"}</p>}
                </div>
                <div>
                  <p style={fieldLabel}>Follow-up Date</p>
                  {editing
                    ? <input type="date" style={inputStyle} value={followUpDate} onChange={e => setFollowUpDate(e.target.value)} />
                    : (
                      <p style={{ ...fieldValue, color: followUpDate && new Date(followUpDate) < new Date() ? "#dc2626" : "#111827" }}>
                        {followUpDate ? new Date(followUpDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
                        {followUpDate && new Date(followUpDate) < new Date() && <span style={{ fontSize: 11, marginLeft: 6, color: "#dc2626" }}>Overdue</span>}
                      </p>
                    )}
                </div>
                {(["REJECTED","CLOSED","VOID"].includes(doc.status) || lostReason) && (
                  <div style={{ gridColumn: "1/-1" }}>
                    <p style={fieldLabel}>Lost Reason</p>
                    {editing
                      ? <input style={inputStyle} value={lostReason} onChange={e => setLostReason(e.target.value)} placeholder="Why was this lead lost?" />
                      : <p style={{ ...fieldValue, color: lostReason ? "#111827" : "#9ca3af" }}>{lostReason || "—"}</p>}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* CRM Activities — RFQ only */}
          {docType === "RFQ" && (
            <div style={card}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <p style={{ ...sectionLabel, marginBottom: 0 }}>Activity Log</p>
                <button onClick={() => setShowActForm(v => !v)}
                  style={{ padding: "5px 12px", fontSize: 11, fontWeight: 600, background: CLR.primaryBg, color: CLR.primary, border: `1px solid ${CLR.primary}44`, cursor: "pointer", fontFamily: "inherit" }}>
                  + Log Activity
                </button>
              </div>

              {showActForm && (
                <div style={{ background: "#f9fafb", border: "1px solid #e5e7eb", padding: 14, marginBottom: 14 }}>
                  <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 10, marginBottom: 10 }}>
                    <div>
                      <p style={{ ...fieldLabel, marginBottom: 4 }}>Type</p>
                      <select style={inputStyle} value={actType} onChange={e => setActType(e.target.value)}>
                        {["CALL","MEETING","TASK","NOTE"].map(t => (
                          <option key={t} value={t}>{t.charAt(0) + t.slice(1).toLowerCase()}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <p style={{ ...fieldLabel, marginBottom: 4 }}>Due Date</p>
                      <input type="date" style={inputStyle} value={actDue} onChange={e => setActDue(e.target.value)} />
                    </div>
                    <div style={{ gridColumn: "1/-1" }}>
                      <p style={{ ...fieldLabel, marginBottom: 4 }}>Title</p>
                      <input style={inputStyle} value={actTitle} onChange={e => setActTitle(e.target.value)} placeholder="e.g. Follow-up call with customer" />
                    </div>
                    <div style={{ gridColumn: "1/-1" }}>
                      <p style={{ ...fieldLabel, marginBottom: 4 }}>Notes</p>
                      <textarea style={{ ...inputStyle, height: 70, resize: "vertical" }} value={actDesc} onChange={e => setActDesc(e.target.value)} placeholder="Optional details…" />
                    </div>
                  </div>
                  {actError && <p style={{ fontSize: 12, color: "#dc2626", marginBottom: 8 }}>{actError}</p>}
                  <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                    <button onClick={() => { setShowActForm(false); setActTitle(""); setActDesc(""); setActDue(""); setActError(""); }}
                      style={{ padding: "6px 12px", fontSize: 12, fontWeight: 600, background: "#fff", color: "#374151", border: "1px solid #d1d5db", cursor: "pointer", fontFamily: "inherit" }}>
                      Cancel
                    </button>
                    <button disabled={actSaving || !actTitle.trim()} onClick={async () => {
                      setActSaving(true); setActError("");
                      try {
                        const res = await fetch(`/api/admin/crm/leads/${docId}/activities`, {
                          method: "POST", headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ type: actType, title: actTitle, description: actDesc || null, dueDate: actDue || null }),
                        });
                        if (!res.ok) throw new Error((await res.json()).error);
                        setShowActForm(false); setActTitle(""); setActDesc(""); setActDue("");
                        loadActivities();
                      } catch (e: any) { setActError(e.message); }
                      setActSaving(false);
                    }}
                      style={{ padding: "6px 14px", fontSize: 12, fontWeight: 600, background: CLR.primary, color: "#fff", border: "none", cursor: actSaving ? "not-allowed" : "pointer", fontFamily: "inherit" }}>
                      {actSaving ? "Saving…" : "Save Activity"}
                    </button>
                  </div>
                </div>
              )}

              {actLoading ? (
                <p style={{ fontSize: 12, color: "#9ca3af" }}>Loading…</p>
              ) : activities.length === 0 ? (
                <p style={{ fontSize: 12, color: "#9ca3af" }}>No activities yet.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                  {activities.map((a, i) => (
                    <div key={a.id} style={{ padding: "10px 0", borderBottom: i < activities.length - 1 ? "1px solid #f3f4f6" : "none", display: "flex", gap: 12 }}>
                      <div style={{ width: 32, height: 32, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: a.completedAt ? "#f0fdf4" : "#f3f4f6", border: `1px solid ${a.completedAt ? "#86efac" : "#e5e7eb"}`, fontSize: 11, fontWeight: 700, color: a.completedAt ? "#15803d" : "#6b7280" }}>
                        {a.type === "CALL" ? "📞" : a.type === "MEETING" ? "👥" : a.type === "TASK" ? "✓" : "📝"}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                          <p style={{ fontSize: 13, fontWeight: 600, color: a.completedAt ? "#6b7280" : "#111827", textDecoration: a.completedAt ? "line-through" : "none" }}>{a.title}</p>
                          <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                            {a.dueDate && !a.completedAt && (
                              <span style={{ fontSize: 10, padding: "1px 6px", background: new Date(a.dueDate) < new Date() ? "#fef2f2" : "#f3f4f6", color: new Date(a.dueDate) < new Date() ? "#dc2626" : "#6b7280", border: `1px solid ${new Date(a.dueDate) < new Date() ? "#fecaca" : "#e5e7eb"}` }}>
                                {new Date(a.dueDate) < new Date() ? "Overdue" : new Date(a.dueDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
                              </span>
                            )}
                            {!a.completedAt && (
                              <button onClick={async () => {
                                await fetch(`/api/admin/crm/leads/${docId}/activities`, {
                                  method: "PATCH", headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({ id: a.id, completedAt: new Date().toISOString() }),
                                });
                                loadActivities();
                              }}
                                style={{ fontSize: 10, padding: "1px 7px", background: "#f0fdf4", color: "#15803d", border: "1px solid #86efac", cursor: "pointer", fontFamily: "inherit", fontWeight: 600 }}>
                                Done
                              </button>
                            )}
                          </div>
                        </div>
                        {a.description && <p style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>{a.description}</p>}
                        <p style={{ fontSize: 10, color: "#9ca3af", marginTop: 3 }}>
                          {a.type} · {new Date(a.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                          {a.completedAt && ` · Completed ${new Date(a.completedAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}`}
                          {a.createdBy && ` · by ${a.createdBy.fullName ?? a.createdBy.email}`}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Status History */}
          <div style={card}>
            <p style={sectionLabel}>Status History</p>
            {logsLoading ? (
              <p style={{ fontSize: 12, color: "#9ca3af" }}>Loading…</p>
            ) : docLogs.length === 0 ? (
              <p style={{ fontSize: 12, color: "#9ca3af" }}>No status changes recorded yet.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                {docLogs.map((log, i) => (
                  <div key={log.id} style={{ padding: "10px 0", borderBottom: i < docLogs.length - 1 ? "1px solid #f3f4f6" : "none", display: "flex", gap: 12, alignItems: "flex-start" }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: CLR.primary, flexShrink: 0, marginTop: 5 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        {log.field === "status" ? (
                          <>
                            <span style={{ fontSize: 12, fontWeight: 600, color: "#111827" }}>Status changed</span>
                            {log.oldValue && (
                              <>
                                <span style={{ fontSize: 11, padding: "1px 7px", background: "#f3f4f6", border: "1px solid #e5e7eb", color: "#6b7280" }}>{log.oldValue.replace(/_/g, " ")}</span>
                                <span style={{ fontSize: 11, color: "#9ca3af" }}>→</span>
                              </>
                            )}
                            <span style={{ fontSize: 11, padding: "1px 7px", background: CLR.primaryBg, border: `1px solid ${CLR.primary}44`, color: CLR.primary, fontWeight: 600 }}>{log.newValue?.replace(/_/g, " ")}</span>
                          </>
                        ) : (
                          <span style={{ fontSize: 12, fontWeight: 600, color: "#111827" }}>
                            {log.field} updated{log.oldValue && <span style={{ fontWeight: 400, color: "#6b7280" }}> · was: {log.oldValue}</span>}
                          </span>
                        )}
                      </div>
                      {log.note && <p style={{ fontSize: 11, color: "#6b7280", marginTop: 3, fontStyle: "italic" }}>"{log.note}"</p>}
                      <p style={{ fontSize: 10, color: "#9ca3af", marginTop: 3 }}>
                        {new Date(log.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                        {log.changedBy && ` · by ${log.changedBy.fullName ?? log.changedBy.email}`}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Document chain */}
          {(doc.originDoc || (doc.derivedDocs ?? []).length > 0) && (
            <div style={card}>
              <p style={sectionLabel}>Document Chain</p>
              {doc.originDoc && (
                <div style={{ marginBottom: 6 }}>
                  <span style={{ fontSize: 11, color: "#9ca3af" }}>Origin: </span>
                  <a href={`${DETAIL_BASE[doc.originDoc.type] ?? "/admin/sales"}/${doc.originDoc.id}`}
                    style={{ fontSize: 13, color: CLR.primary, fontWeight: 600, textDecoration: "none", fontFamily: "monospace" }}>
                    {doc.originDoc.docNum}
                  </a>
                </div>
              )}
              {(doc.derivedDocs ?? []).map((d: any) => (
                <div key={d.id} style={{ marginBottom: 4 }}>
                  <span style={{ fontSize: 11, color: "#9ca3af" }}>Derived: </span>
                  <a href={`${DETAIL_BASE[d.type] ?? "/admin/sales"}/${d.id}`}
                    style={{ fontSize: 13, color: CLR.primary, fontWeight: 600, textDecoration: "none", fontFamily: "monospace" }}>
                    {d.docNum}
                  </a>
                  <span style={{ fontSize: 11, color: "#9ca3af", marginLeft: 6 }}>{d.type}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* RIGHT */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14, order: isMobile ? -1 : 0 }}>

          {/* Customer */}
          <div style={card}>
            <p style={sectionLabel}>Customer</p>
            <p style={{ fontSize: 13, fontWeight: 600, color: "#111827", marginBottom: 2 }}>{doc.customer?.fullName ?? doc.customer?.email}</p>
            {doc.customer?.companyName && <p style={{ fontSize: 12, color: "#6b7280", marginBottom: 2 }}>{doc.customer.companyName}</p>}
            <p style={{ fontSize: 12, color: "#9ca3af" }}>{doc.customer?.email}</p>
            {doc.customer?.customerNumber && <p style={{ fontSize: 11, color: "#9ca3af", marginTop: 4 }}>#{doc.customer.customerNumber}</p>}
          </div>

          {/* Totals */}
          <div style={card}>
            <p style={sectionLabel}>Totals</p>
            <TRow label="Subtotal" value={fmtAmount(doc.subtotal, doc.currency)} />
            {vatPct > 0 && <TRow label={`VAT (${vatPct}%)`} value={fmtAmount(doc.vatAmount, doc.currency)} />}
            <div style={{ height: 1, background: "#e5e7eb", margin: "6px 0" }} />
            <TRow label="Total" value={fmtAmount(doc.total, doc.currency)} bold />
            {totalPaid > 0 && <TRow label="Paid" value={`− ${fmtAmount(totalPaid, doc.currency)}`} color="#15803d" />}
            {balanceDue > 0 && totalPaid > 0 && <TRow label="Balance Due" value={fmtAmount(balanceDue, doc.currency)} bold color="#b45309" />}
          </div>

          {/* Payments */}
          {(doc.payments ?? []).length > 0 && (
            <div style={card}>
              <p style={sectionLabel}>Payments</p>
              {doc.payments.map((p: any) => (
                <div key={p.id} style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, paddingBottom: 8, borderBottom: "1px solid #f3f4f6" }}>
                  <div>
                    <p style={{ fontSize: 12, fontWeight: 600, color: "#111827" }}>{p.method.replace(/_/g, " ")}</p>
                    {p.reference && <p style={{ fontSize: 11, color: "#9ca3af" }}>{p.reference}</p>}
                    <p style={{ fontSize: 11, color: "#9ca3af" }}>{fmtDate(p.paidAt)}</p>
                  </div>
                  <p style={{ fontSize: 13, fontWeight: 700, color: "#15803d" }}>{fmtAmount(p.amountCents, doc.currency)}</p>
                </div>
              ))}
            </div>
          )}

          {/* Market */}
          <div style={card}>
            <p style={sectionLabel}>Market</p>
            <p style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>{doc.market?.name}</p>
            <p style={{ fontSize: 12, color: "#9ca3af" }}>{doc.currency} · VAT {vatPct}%</p>
          </div>
        </div>
      </div>

      {/* Modals */}
      {showStatus && (
        <StatusChangeModal
          docId={docId} docNum={doc.docNum} docType={doc.type} docStatus={doc.status}
          onClose={() => setShowStatus(false)}
          onChanged={newStatus => { setDoc((prev: any) => ({ ...prev, status: newStatus })); loadLogs(); }}
        />
      )}

      {sendModalMode && (
        <SendEmailModal
          docId={docId} docNum={doc.docNum} docType={doc.type} docStatus={doc.status}
          customerEmail={doc.customer?.email ?? ""}
          reminderEnabled={doc.reminderEnabled ?? false}
          reminderCount={doc.reminderCount ?? 0}
          mode={sendModalMode}
          onClose={() => setSendModalMode(null)}
          onSent={result => setDoc((prev: any) => ({
            ...prev,
            emailSentAt:     result.emailSentAt,
            emailSentCount:  result.emailSentCount  ?? prev.emailSentCount,
            reminderCount:   result.reminderCount   ?? prev.reminderCount,
            reminderEnabled: result.reminderEnabled ?? prev.reminderEnabled,
          }))}
        />
      )}

      {showConvert && (
        <ConvertModal
          docId={docId} docNum={doc.docNum} docType={doc.type}
          onClose={() => setShowConvert(false)}
          onConverted={handleConverted}
        />
      )}

      {showPayment && (
        <Overlay onClose={() => setShowPayment(false)}>
          <ModalBox title="Record Payment">
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={{ ...fieldLabel, display: "block", marginBottom: 5 }}>Method</label>
                <select value={payMethod} onChange={e => setPayMethod(e.target.value)} style={inputStyle}>
                  <option value="BANK_TRANSFER">Bank Transfer</option>
                  <option value="STRIPE">Stripe / Card</option>
                  <option value="CASH">Cash</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
              <div>
                <label style={{ ...fieldLabel, display: "block", marginBottom: 5 }}>Amount ({doc.currency})</label>
                <input type="number" step="0.01" min="0" style={inputStyle}
                  value={payAmount} onChange={e => setPayAmount(e.target.value)}
                  placeholder={`e.g. ${(balanceDue / 100).toFixed(2)}`} />
              </div>
              <div>
                <label style={{ ...fieldLabel, display: "block", marginBottom: 5 }}>Payment Date</label>
                <input type="date" style={inputStyle} value={payDate} onChange={e => setPayDate(e.target.value)} />
              </div>
              <div>
                <label style={{ ...fieldLabel, display: "block", marginBottom: 5 }}>Reference</label>
                <input style={inputStyle} value={payRef} onChange={e => setPayRef(e.target.value)} placeholder="Bank ref, Stripe charge ID…" />
              </div>
              <div>
                <label style={{ ...fieldLabel, display: "block", marginBottom: 5 }}>Notes</label>
                <input style={inputStyle} value={payNotes} onChange={e => setPayNotes(e.target.value)} placeholder="Optional" />
              </div>
              {payError && <p style={{ fontSize: 12, color: "#dc2626" }}>{payError}</p>}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                <GhostBtn onClick={() => setShowPayment(false)} disabled={payLoading}>Cancel</GhostBtn>
                <PrimaryBtn onClick={recordPayment} disabled={payLoading || !payAmount}>
                  {payLoading ? "Saving…" : "Record Payment"}
                </PrimaryBtn>
              </div>
            </div>
          </ModalBox>
        </Overlay>
      )}
    </div>
  );
}

function TRow({ label, value, bold, color }: { label: string; value: string; bold?: boolean; color?: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
      <span style={{ fontSize: 12, color: "#6b7280" }}>{label}</span>
      <span style={{ fontSize: bold ? 14 : 13, fontWeight: bold ? 700 : 500, color: color ?? (bold ? "#111827" : "#374151") }}>{value}</span>
    </div>
  );
}

function DropItem({ icon, label, hint, onClick, active }: {
  icon: string; label: string; hint?: string; onClick: () => void; active?: boolean;
}) {
  const [hov, setHov] = useState(false);
  return (
    <button onClick={onClick}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "9px 14px", background: hov ? "#f9fafb" : "#fff", border: "none", cursor: "pointer", fontFamily: "inherit", textAlign: "left" as const }}>
      <Icon name={icon} size={14} color={active ? CLR.primary : "#6b7280"} />
      <div style={{ flex: 1 }}>
        <p style={{ fontSize: 13, fontWeight: 500, color: active ? CLR.primary : "#111827", margin: 0 }}>{label}</p>
        {hint && <p style={{ fontSize: 11, color: "#9ca3af", margin: 0 }}>{hint}</p>}
      </div>
      {active && <div style={{ width: 6, height: 6, borderRadius: "50%", background: CLR.primary, flexShrink: 0 }} />}
    </button>
  );
}

function AttachmentButton({ fileKey }: { fileKey: string }) {
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");

  async function open() {
    setLoading(true); setError("");
    try {
      const res  = await fetch(`/api/admin/sales/attachment?key=${encodeURIComponent(fileKey)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      window.open(data.url, "_blank");
    } catch (e: any) { setError(e.message); }
    setLoading(false);
  }

  const name = fileKey.split("/").pop() ?? fileKey;
  return (
    <div>
      <button onClick={open} disabled={loading}
        style={{ fontSize: 13, fontWeight: 600, padding: "7px 14px", background: CLR.primaryBg, color: CLR.primary, border: `1px solid ${CLR.primary}44`, cursor: loading ? "not-allowed" : "pointer", fontFamily: "inherit" }}>
        {loading ? "Loading…" : `View / Download — ${name} ↗`}
      </button>
      {error && <p style={{ fontSize: 12, color: "#dc2626", marginTop: 6 }}>{error}</p>}
    </div>
  );
}
