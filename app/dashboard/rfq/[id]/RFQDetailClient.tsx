"use client";
// app/dashboard/rfq/[id]/RFQDetailClient.tsx

import { useState } from "react";
import Link from "next/link";
import { colors } from "@/lib/ui/tokens";

interface RFQDoc {
  id:          string;
  docNum:      string;
  status:      string;
  title:       string | null;
  notes:       string | null;
  attachments: string[];
  issueDate:   string;
}

const STATUS_COLORS: Record<string, { bg: string; color: string; border: string }> = {
  PENDING:   { bg: "#fff8e6", color: "#854F0B", border: "#fcd34d" },
  IN_REVIEW: { bg: "#e6f1fb", color: "#185FA5", border: "#93c5fd" },
  QUOTED:    { bg: "#e8f5f0", color: "#0F6E56", border: "#6ee7b7" },
  CONVERTED: { bg: "#f5f0ff", color: "#6d28d9", border: "#c4b5fd" },
  CLOSED:    { bg: "#f3f4f6", color: "#6b7280", border: "#e5e7eb" },
  FOLLOW_UP: { bg: "#fff8e6", color: "#854F0B", border: "#fcd34d" },
};

const STATUS_MESSAGES: Record<string, string> = {
  PENDING:   "Your inquiry has been received and is awaiting review by our team.",
  IN_REVIEW: "Our team is currently reviewing your inquiry.",
  QUOTED:    "We have responded to your inquiry with a quotation. Check your Quotations page.",
  CONVERTED: "Your inquiry has been processed and converted.",
  CLOSED:    "This inquiry has been closed.",
  FOLLOW_UP: "Our team will follow up with you shortly.",
};

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function fileName(key: string): string {
  return key.split("/").pop() ?? key;
}

function AttachmentItem({ docId, fileKey }: { docId: string; fileKey: string }) {
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");

  async function download() {
    setLoading(true); setError("");
    try {
      const res  = await fetch(`/api/customer/rfq/attachment?docId=${docId}&key=${encodeURIComponent(fileKey)}`);
      const data = await res.json();
      if (!res.ok || !data.url) { setError(data.error ?? "Download failed"); return; }
      window.open(data.url, "_blank");
    } catch { setError("Network error — please try again."); }
    setLoading(false);
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 14px", background: "#f9fafb", border: "1px solid #e5e7eb", marginBottom: 6 }}>
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
      </svg>
      <span style={{ flex: 1, fontSize: 13, color: "#374151", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {fileName(fileKey)}
      </span>
      {error && <span style={{ fontSize: 11, color: "#dc2626" }}>{error}</span>}
      <button onClick={download} disabled={loading}
        style={{ flexShrink: 0, height: 28, padding: "0 12px", background: "#fff", border: `1px solid ${colors.primary}44`, color: colors.primary, fontSize: 12, fontWeight: 600, cursor: loading ? "not-allowed" : "pointer", fontFamily: "inherit", opacity: loading ? 0.6 : 1 }}>
        {loading ? "…" : "↓ Download"}
      </button>
    </div>
  );
}

export function RFQDetailClient({ doc }: { doc: RFQDoc }) {
  const sc = STATUS_COLORS[doc.status] ?? { bg: "#f3f4f6", color: "#6b7280", border: "#e5e7eb" };

  return (
    <div className="cy-page-content">
      <div className="cy-dash-wrap" style={{ maxWidth: 700 }}>

        <div style={{ marginBottom: 20 }}>
          <Link href="/dashboard/rfq"
            style={{ fontSize: 12, color: "#6b7280", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4 }}>
            ← Back to Inquiries
          </Link>
        </div>

        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div>
              <h1 style={{ fontSize: 20, fontWeight: 700, color: "#111827", margin: "0 0 4px", letterSpacing: "-0.01em" }}>
                {doc.title ?? doc.docNum}
              </h1>
              <span style={{ fontSize: 12, color: "#9ca3af", fontFamily: "monospace" }}>{doc.docNum}</span>
              <span style={{ margin: "0 8px", color: "#e5e7eb" }}>·</span>
              <span style={{ fontSize: 12, color: "#9ca3af" }}>Submitted {fmtDate(doc.issueDate)}</span>
            </div>
            <span style={{ display: "inline-flex", alignItems: "center", height: 26, padding: "0 12px", fontSize: 12, fontWeight: 700, background: sc.bg, color: sc.color, border: `1px solid ${sc.border}`, textTransform: "uppercase", letterSpacing: "0.04em", whiteSpace: "nowrap" }}>
              {doc.status.replace(/_/g, " ")}
            </span>
          </div>
        </div>

        {/* Content card */}
        <div style={{ background: "#fff", border: "1px solid #e5e7eb" }}>

          {/* Subject */}
          <div style={{ padding: "16px 20px", borderBottom: "1px solid #f3f4f6" }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>Subject</div>
            <div style={{ fontSize: 14, color: "#111827", fontWeight: 500 }}>{doc.title ?? "—"}</div>
          </div>

          {/* Message */}
          <div style={{ padding: "16px 20px", borderBottom: doc.attachments.length > 0 ? "1px solid #f3f4f6" : "none" }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>Message</div>
            {doc.notes ? (
              <div style={{ fontSize: 13, color: "#374151", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{doc.notes}</div>
            ) : (
              <div style={{ fontSize: 13, color: "#9ca3af", fontStyle: "italic" }}>No message provided.</div>
            )}
          </div>

          {/* Attachments */}
          {doc.attachments.length > 0 && (
            <div style={{ padding: "16px 20px" }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10 }}>
                Attachments ({doc.attachments.length})
              </div>
              {doc.attachments.map(key => (
                <AttachmentItem key={key} docId={doc.id} fileKey={key} />
              ))}
            </div>
          )}
        </div>

        {/* Status note */}
        <div style={{ marginTop: 20, padding: "12px 16px", background: sc.bg, border: `1px solid ${sc.border}`, fontSize: 13, color: sc.color }}>
          {STATUS_MESSAGES[doc.status] ?? `Status: ${doc.status.replace(/_/g, " ")}`}
        </div>

      </div>
    </div>
  );
}
