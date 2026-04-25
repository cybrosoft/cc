"use client";
// app/dashboard/rfq/RFQClient.tsx

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { colors } from "@/lib/ui/tokens";

interface RFQ {
  id:          string;
  docNum:      string;
  status:      string;
  title:       string | null;
  notes:       string | null;
  attachments: string[];
  issueDate:   string;
  createdAt:   string;
  quotation:   { id: string; docNum: string; status: string } | null;
}

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  PENDING:   { bg: "#fff8e6", color: "#854F0B" },
  IN_REVIEW: { bg: "#e6f1fb", color: "#185FA5" },
  QUOTED:    { bg: "#e8f5f0", color: "#0F6E56" },
  CONVERTED: { bg: "#f5f0ff", color: "#6d28d9" },
  CLOSED:    { bg: "#f3f4f6", color: "#6b7280" },
  FOLLOW_UP: { bg: "#fff8e6", color: "#854F0B" },
  REPLIED:   { bg: "#e0f2fe", color: "#0369a1" },
};

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_COLORS[status] ?? { bg: "#f3f4f6", color: "#6b7280" };
  return (
    <span style={{ display: "inline-flex", alignItems: "center", height: 20, padding: "0 8px", fontSize: 11, fontWeight: 600, background: s.bg, color: s.color, textTransform: "uppercase", letterSpacing: "0.03em", whiteSpace: "nowrap" }}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

function Sk({ w = "100%", h = 13 }: { w?: string | number; h?: number }) {
  return <span className="cy-shimmer" style={{ width: w, height: h, display: "inline-block" }} />;
}

export function RFQClient() {
  const [rfqs,       setRfqs]       = useState<RFQ[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showForm,   setShowForm]   = useState(false);
  const [title,      setTitle]      = useState("");
  const [notes,      setNotes]      = useState("");
  const [files,      setFiles]      = useState<File[]>([]);
  const [formError,  setFormError]  = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function loadRfqs() {
    fetch("/api/customer/rfq")
      .then(r => r.json())
      .then(d => setRfqs(d.rfqs ?? []))
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadRfqs(); }, []);

  function addFiles(incoming: FileList | null) {
    if (!incoming) return;
    setFiles(prev => [...prev, ...Array.from(incoming)]);
  }

  function removeFile(idx: number) {
    setFiles(prev => prev.filter((_, i) => i !== idx));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) { setFormError("Please enter a title for your inquiry."); return; }
    setSubmitting(true);
    setFormError(null);
    try {
      const fd = new FormData();
      fd.append("title", title.trim());
      fd.append("notes", notes.trim());
      files.forEach(f => fd.append("files", f));

      const res  = await fetch("/api/customer/rfq", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) { setFormError(data.error ?? "Submission failed."); return; }
      setSuccessMsg(`Your inquiry ${data.docNum} has been submitted. Our team will respond shortly.`);
      setTitle(""); setNotes(""); setFiles([]); setShowForm(false);
      loadRfqs();
    } catch {
      setFormError("Network error — please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <style>{`
        @keyframes cy-shimmer{0%{background-position:-400px 0}100%{background-position:400px 0}}
        .cy-shimmer{background:linear-gradient(90deg,#f0f0f0 25%,#e4e4e4 50%,#f0f0f0 75%);background-size:800px 100%;animation:cy-shimmer 1.4s ease-in-out infinite;border-radius:4px;}
        .cy-row:hover{background:#f5faf8!important;}
        textarea{width:100%;resize:vertical;min-height:80px;font-family:inherit;}
      `}</style>

      <div className="cy-page-content">
        <div className="cy-dash-wrap">

          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
            <div>
              <h1 className="cy-page-title" style={{ margin: "0 0 3px" }}>RFQ / Inquiries</h1>
              <p style={{ margin: 0, fontSize: 13, color: "#9ca3af" }}>Submit a request for quotation or ask about a service.</p>
            </div>
            <button onClick={() => { setShowForm(!showForm); setFormError(null); setSuccessMsg(null); }}
              style={{ display: "flex", alignItems: "center", height: 34, padding: "0 14px", background: colors.primary, color: "#fff", border: "none", fontSize: 13, fontWeight: 500, cursor: "pointer" }}>
              + New Inquiry
            </button>
          </div>

          {successMsg && (
            <div style={{ padding: "12px 16px", background: "#e8f5f0", border: "1px solid #a8d5c9", color: "#0F6E56", fontSize: 13, marginBottom: 16 }}>
              {successMsg}
            </div>
          )}

          {showForm && (
            <div style={{ background: "#fff", border: "1px solid #e5e7eb", padding: "20px", marginBottom: 20 }}>
              <h2 style={{ margin: "0 0 16px", fontSize: 14.5, fontWeight: 600, color: "#111827" }}>New Inquiry</h2>
              <form onSubmit={handleSubmit}>

                {/* Title */}
                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: "block", fontSize: 12.5, fontWeight: 500, color: "#374151", marginBottom: 5 }}>
                    Subject / Title <span style={{ color: "#dc2626" }}>*</span>
                  </label>
                  <input type="text" value={title} onChange={e => setTitle(e.target.value)}
                    placeholder="e.g. Cloud server for production workload" maxLength={200}
                    style={{ width: "100%", height: 36, padding: "0 10px", border: "1px solid #d1d5db", fontSize: 13, boxSizing: "border-box" }} />
                </div>

                {/* Notes */}
                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: "block", fontSize: 12.5, fontWeight: 500, color: "#374151", marginBottom: 5 }}>
                    Details / Notes <span style={{ fontSize: 11.5, color: "#9ca3af", fontWeight: 400 }}>(optional)</span>
                  </label>
                  <textarea value={notes} onChange={e => setNotes(e.target.value)}
                    placeholder="Describe your requirements, specifications, or questions..."
                    style={{ padding: "8px 10px", border: "1px solid #d1d5db", fontSize: 13, boxSizing: "border-box" }} />
                </div>

                {/* Attachments */}
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: "block", fontSize: 12.5, fontWeight: 500, color: "#374151", marginBottom: 5 }}>
                    Attachments <span style={{ fontSize: 11.5, color: "#9ca3af", fontWeight: 400 }}>(optional — PDF, Word, Excel, image · max 10 MB each)</span>
                  </label>

                  {/* File list */}
                  {files.length > 0 && (
                    <div style={{ marginBottom: 8 }}>
                      {files.map((f, i) => (
                        <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", background: "#f9fafb", border: "1px solid #e5e7eb", marginBottom: 4 }}>
                          <span style={{ fontSize: 13, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</span>
                          <span style={{ fontSize: 11, color: "#9ca3af", flexShrink: 0 }}>{(f.size / 1024).toFixed(0)} KB</span>
                          <button type="button" onClick={() => removeFile(i)}
                            style={{ background: "none", border: "none", cursor: "pointer", color: "#dc2626", fontSize: 16, lineHeight: 1, flexShrink: 0 }}>×</button>
                        </div>
                      ))}
                    </div>
                  )}

                  <input ref={fileRef} type="file" multiple style={{ display: "none" }}
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
                    onChange={e => { addFiles(e.target.files); e.target.value = ""; }} />
                  <button type="button" onClick={() => fileRef.current?.click()}
                    style={{ height: 34, padding: "0 14px", background: "#f9fafb", border: "1px solid #d1d5db", fontSize: 13, color: "#374151", cursor: "pointer", fontFamily: "inherit" }}>
                    {files.length ? "+ Add More Files" : "Choose Files"}
                  </button>
                </div>

                {formError && (
                  <div style={{ padding: "8px 12px", background: "#fdf0ef", border: "1px solid #fca5a5", color: "#991b1b", fontSize: 12.5, marginBottom: 12 }}>
                    {formError}
                  </div>
                )}

                <div style={{ display: "flex", gap: 8 }}>
                  <button type="submit" disabled={submitting}
                    style={{ height: 34, padding: "0 16px", background: colors.primary, color: "#fff", border: "none", fontSize: 13, fontWeight: 500, cursor: submitting ? "not-allowed" : "pointer", opacity: submitting ? 0.7 : 1 }}>
                    {submitting ? "Submitting…" : "Submit Inquiry"}
                  </button>
                  <button type="button" onClick={() => { setShowForm(false); setFormError(null); setFiles([]); }}
                    style={{ height: 34, padding: "0 14px", background: "#fff", border: "1px solid #e5e7eb", fontSize: 13, color: "#374151", cursor: "pointer" }}>
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* RFQ List */}
          <div style={{ background: "#fff", border: "1px solid #e5e7eb", overflow: "hidden" }}>
            <div style={{ display: "flex", padding: "8px 14px", background: "#f9fafb", borderBottom: "1px solid #f3f4f6" }}>
              {["Inquiry", "Date", "Status", "Response"].map((h, i) => (
                <span key={i} style={{ flex: [3,1,1.2,2][i], fontSize: 11, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em", paddingRight: 8 }}>{h}</span>
              ))}
            </div>

            {loading ? (
              [1,2,3].map(i => (
                <div key={i} style={{ display: "flex", padding: "12px 14px", borderBottom: "1px solid #f9fafb", gap: 12 }}>
                  <Sk w="35%" h={12} /><Sk w="15%" h={12} /><Sk w="18%" h={18} /><Sk w="20%" h={12} />
                </div>
              ))
            ) : rfqs.length === 0 ? (
              <div style={{ padding: "40px 16px", textAlign: "center" }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: "#374151", marginBottom: 6 }}>No inquiries yet</div>
                <div style={{ fontSize: 12.5, color: "#9ca3af" }}>Submit an inquiry and our team will respond with a quotation.</div>
              </div>
            ) : (
              rfqs.map((rfq, idx) => (
                <Link key={rfq.id} href={`/dashboard/rfq/${rfq.id}`} className="cy-row"
                  style={{ display: "flex", alignItems: "center", padding: "10px 14px", borderBottom: idx < rfqs.length - 1 ? "1px solid #f3f4f6" : "none", textDecoration: "none", color: "inherit", transition: "background 0.1s" }}>
                  <div style={{ flex: 3, minWidth: 0, paddingRight: 8 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {rfq.title ?? rfq.docNum}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 2 }}>
                      <span style={{ fontSize: 11.5, color: "#9ca3af", fontFamily: "monospace" }}>{rfq.docNum}</span>
                      {rfq.attachments.length > 0 && (
                        <span style={{ fontSize: 10.5, color: "#6b7280", background: "#f3f4f6", padding: "1px 6px", border: "1px solid #e5e7eb" }}>
                          📎 {rfq.attachments.length} file{rfq.attachments.length > 1 ? "s" : ""}
                        </span>
                      )}
                    </div>
                  </div>
                  <span style={{ flex: 1, fontSize: 12, color: "#6b7280", paddingRight: 8 }}>{fmtDate(rfq.issueDate)}</span>
                  <span style={{ flex: 1.2, paddingRight: 8 }}><StatusBadge status={rfq.status} /></span>
                  <div style={{ flex: 2 }}>
                    {rfq.quotation ? (
                      <span style={{ fontSize: 12.5, color: colors.primary, fontFamily: "monospace", fontWeight: 500 }}>
                        Quotation {rfq.quotation.docNum}
                        <span style={{ marginLeft: 6, fontSize: 11, color: "#9ca3af", fontFamily: "inherit" }}>({rfq.quotation.status.replace(/_/g, " ")})</span>
                      </span>
                    ) : (
                      <span style={{ fontSize: 12, color: "#9ca3af" }}>Awaiting response</span>
                    )}
                  </div>
                </Link>
              ))
            )}
          </div>

        </div>
      </div>
    </>
  );
}
