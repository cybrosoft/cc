"use client";
// app/admin/sales/ui/AttachmentsPanel.tsx
// Drop-in replacement for the single-file attachment section in SalesDetailClient.
// Reads/writes rfqFileUrl as a JSON-encoded string[] via parseAttachments/serializeAttachments.
// Usage: pass attachments (parsed array) + onAdd + onRemove callbacks from the parent.

import { useRef, useState } from "react";
import { CLR } from "@/components/ui/admin-ui";
import { parseAttachments, serializeAttachments } from "@/lib/sales/attachments";

interface Props {
  /** Current serialized value of rfqFileUrl from the doc */
  rawValue:  string | null | undefined;
  editing:   boolean;
  /** Called with the new serialized value to store — parent saves it in the PATCH body */
  onChange:  (serialized: string | null) => void;
  /** Admin signed-URL endpoint */
  attachmentEndpoint?: string;
}

function fileName(key: string): string {
  return key.split("/").pop() ?? key;
}

function FileRow({
  fileKey,
  onRemove,
  attachmentEndpoint,
}: {
  fileKey: string;
  onRemove?: () => void;
  attachmentEndpoint: string;
}) {
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");

  async function open() {
    setLoading(true); setError("");
    try {
      const res  = await fetch(`${attachmentEndpoint}?key=${encodeURIComponent(fileKey)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      window.open(data.url, "_blank");
    } catch (e: any) { setError(e.message); }
    setLoading(false);
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: "#f9fafb", border: "1px solid #e5e7eb", marginBottom: 6 }}>
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
      </svg>
      <button onClick={open} disabled={loading}
        style={{ flex: 1, textAlign: "left", background: "none", border: "none", cursor: loading ? "not-allowed" : "pointer", fontSize: 13, color: CLR.primary, fontFamily: "inherit", textDecoration: "underline", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {loading ? "Loading…" : fileName(fileKey)}
      </button>
      {onRemove && (
        <button onClick={onRemove}
          style={{ background: "none", border: "none", cursor: "pointer", color: "#dc2626", fontSize: 18, lineHeight: 1, padding: "0 2px", flexShrink: 0 }}
          title="Remove attachment">
          ×
        </button>
      )}
      {error && <span style={{ fontSize: 11, color: "#dc2626" }}>{error}</span>}
    </div>
  );
}

export function AttachmentsPanel({ rawValue, editing, onChange, attachmentEndpoint = "/api/admin/sales/attachment" }: Props) {
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const keys = parseAttachments(rawValue);

  function remove(key: string) {
    const next = keys.filter(k => k !== key);
    onChange(serializeAttachments(next));
  }

  async function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    e.target.value = "";
    setUploading(true); setUploadErr("");

    const newKeys = [...keys];
    for (const file of files) {
      try {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("docType", "DOCUMENT");
        const res  = await fetch("/api/admin/sales/upload", { method: "POST", body: fd });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Upload failed");
        newKeys.push(data.key ?? data.url);
      } catch (e: any) {
        setUploadErr(e.message);
        break;
      }
    }

    onChange(serializeAttachments(newKeys));
    setUploading(false);
  }

  if (!editing) {
    // View mode — just show download buttons
    if (!keys.length) return null;
    return (
      <div>
        {keys.map(k => (
          <FileRow key={k} fileKey={k} attachmentEndpoint={attachmentEndpoint} />
        ))}
      </div>
    );
  }

  // Edit mode — show files with remove buttons + add more
  return (
    <div>
      {keys.map(k => (
        <FileRow key={k} fileKey={k} onRemove={() => remove(k)} attachmentEndpoint={attachmentEndpoint} />
      ))}

      {uploadErr && (
        <p style={{ fontSize: 12, color: "#dc2626", marginBottom: 8 }}>{uploadErr}</p>
      )}

      <div
        onClick={() => !uploading && fileRef.current?.click()}
        style={{ border: "2px dashed #d1d5db", padding: "14px", textAlign: "center", cursor: uploading ? "not-allowed" : "pointer", background: "#fafafa", marginTop: keys.length ? 8 : 0 }}
        onMouseEnter={e => { if (!uploading) e.currentTarget.style.borderColor = CLR.primary; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = "#d1d5db"; }}>
        <p style={{ fontSize: 13, color: CLR.muted, margin: 0 }}>
          {uploading ? "Uploading…" : keys.length ? "Click to add more files" : "Click to attach files"}
        </p>
        <p style={{ fontSize: 11, color: CLR.faint, marginTop: 4, marginBottom: 0 }}>PDF, image, Word, Excel — max 10 MB each · multiple allowed</p>
      </div>
      <input ref={fileRef} type="file" multiple style={{ display: "none" }}
        accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
        onChange={handleFiles} />
    </div>
  );
}
