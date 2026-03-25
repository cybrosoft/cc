// app/print/sales/[id]/page.tsx
// Public raw document print page — no admin chrome
// Auth via signed token: /print/sales/[id]?token=xxx
// Phase 2: Arabic/bilingual rendering stubbed — data is fetched, rendering uses EN only for now
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { verifyPrintToken } from "@/lib/sales/print-token";
import { DOC_TYPE_LABEL, fmtDate, fmtAmount } from "@/lib/sales/document-helpers";

const PERIOD_LABEL: Record<string, string> = {
  MONTHLY: "Monthly", SIX_MONTHS: "6 Months", YEARLY: "Yearly", ONE_TIME: "One-time",
};

interface Props {
  params:       Promise<{ id: string }>;
  searchParams: Promise<{ token?: string }>;
}

export default async function PrintPage({ params, searchParams }: Props) {
  const { id }    = await params;
  const { token } = await searchParams;

  if (!token || !verifyPrintToken(id, token)) {
    return (
      <html><body style={{ fontFamily: "sans-serif", padding: 40, textAlign: "center", color: "#dc2626" }}>
        <h2>Access Denied</h2>
        <p>Invalid or missing print token.</p>
      </body></html>
    );
  }

  const doc = await prisma.salesDocument.findUnique({
    where: { id },
    include: {
      customer: {
        select: {
          id: true, fullName: true, email: true, mobile: true,
          companyName: true, vatTaxId: true,
          addressLine1: true, addressLine2: true,
          district: true, city: true, province: true, country: true,
        },
      },
      market: {
        select: {
          id: true, key: true, name: true, defaultCurrency: true,
          vatPercent: true, legalInfo: true, companyProfile: true,
        },
      },
      lines: {
        orderBy: { sortOrder: "asc" },
        include: { product: { select: { key: true, name: true } } },
      },
      payments:    { orderBy: { paidAt: "desc" } },
      originDoc:   { select: { id: true, docNum: true, type: true } },
      derivedDocs: { select: { id: true, docNum: true, type: true, status: true } },
    },
  });

  if (!doc) notFound();

  const li           = (doc.market.legalInfo     ?? {}) as Record<string, any>;
  const cp           = (doc.market.companyProfile ?? {}) as Record<string, any>;
  const bd           = li.bankDetails as Record<string, string> | undefined;
  const primaryColor = cp.primaryColor ?? "#318774";
  const typeLabel    = DOC_TYPE_LABEL[doc.type as keyof typeof DOC_TYPE_LABEL] ?? doc.type;
  const isSaudi      = doc.market.key === "SAUDI";
  const totalPaid    = doc.payments.reduce((s, p) => s + p.amountCents, 0);
  const balanceDue   = doc.total - totalPaid;
  const showBank     = (doc.type === "PROFORMA" || doc.type === "INVOICE") && bd?.iban;

  // Phase 2: language-aware rendering
  // const lang = doc.language ?? "en"; // "en" | "ar" | "bi"
  // TODO Phase 2: when lang === "ar" or "bi":
  //   - show li.companyNameAr instead of / alongside li.companyName
  //   - show l.descriptionAr instead of / alongside l.description
  //   - show l.detailsAr instead of / alongside l.productDetails
  //   - set html lang="ar" and dir="rtl"

  const taxRateLabel = (() => {
    const t    = (li.taxLabel ?? "VAT").trim();
    const base = t.replace(/\s*(No\.|Number|ID|#)\s*$/i, "").trim();
    return base ? `${base} Rate` : "VAT Rate";
  })();

  return (
    <html lang="en">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{doc.docNum}</title>
        <style>{`
          * { box-sizing: border-box; margin: 0; padding: 0; }
          html, body { height: 100%; }
          body {
            font-family: Arial, Helvetica, sans-serif;
            font-size: 13px;
            color: #111827;
            background: #fff;
            display: flex;
            flex-direction: column;
            min-height: 100vh;
          }
          .doc-content { flex: 1; }
          .doc-footer {
            text-align: center;
            font-size: 10px;
            color: #323232;
            border-top: 0.5px solid #bbbbbb;
            padding: 10px 24px;
            margin-top: 10px;
            background: #fff;
          }
          @media print {
            body { background: #fff !important; }
            .no-print { display: none !important; }
            .doc-footer {
              position: fixed;
              bottom: 0;
              left: 0;
              right: 0;
            }
          }
          @page { size: A4; margin: 10mm 10mm 10mm 10mm; }
        `}</style>
      </head>
      <body>
        <div className="doc-content" style={{ background: "#e7e7e7" }}>
          <div style={{ background: "#ffffff", maxWidth: "810px", margin: "0 auto", height: "100%", padding: "10px 0" }}>
            <div style={{ maxWidth: 740, margin: "0 auto", padding: "20px 10px", background: "#fff", height: "100%" }}>

              {/* ── Header ── */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
                <div style={{ maxWidth: "38%", wordBreak: "break-word" }}>
                  {cp.logoUrl && (
                    <img src={cp.logoUrl} alt={li.companyName ?? "Logo"}
                      style={{ maxHeight: 48, maxWidth: 160, objectFit: "contain", marginBottom: 8, display: "block" }} />
                  )}
                  {/* Phase 2: show li.companyNameAr when lang === "ar" or "bi" */}
                  <div style={{ fontSize: cp.logoUrl ? 15 : 24, fontWeight: 700, color: primaryColor, marginBottom: 14, lineHeight: 1.1 }}>
                    {li.companyName ?? doc.market.name}
                  </div>
                  {li.tagline && <div style={{ fontSize: 12, color: "#444444", marginBottom: 2 }}>{li.tagline}</div>}
                  <div style={{ fontSize: 12, color: "#444444", lineHeight: 1.75 }}>
                    {(li.address1 || li.address) && (
                      <div>{[li.address1, li.address2, li.district, li.city, li.state, li.postalCode, li.country].filter(Boolean).join(", ") || li.address}</div>
                    )}
                    {(li.taxNumber || li.vatNumber) && (
                      <div>{li.taxLabel ?? "VAT"}: {li.taxNumber ?? li.vatNumber}</div>
                    )}
                    {li.email && <div>{li.email}</div>}
                  </div>
                </div>

                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "#444444", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 4 }}>
                    {typeLabel}
                  </div>
                  <div style={{ fontSize: 24, fontWeight: 700, fontFamily: "monospace", color: primaryColor, lineHeight: 1.1 }}>
                    {doc.docNum}
                  </div>
                  <div style={{ marginTop: 6, display: "inline-block", fontSize: 12, fontWeight: 600, padding: "2px 8px", background: "#f3f4f6", border: "1px solid #e5e7eb", color: "#374151" }}>
                    {doc.status.replace(/_/g, " ")}
                  </div>
                </div>
              </div>

              {/* ── Bill To + Details ── */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 40, marginBottom: 20 }}>
                <div style={{ maxWidth: "38%", wordBreak: "break-word" }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "#444444", letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 8 }}>
                    Bill To
                  </div>
                  {doc.customer.companyName ? (
                    <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 2, lineHeight: 1.6 }}>{doc.customer.companyName}</div>
                  ) : (
                    <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 2, lineHeight: 1.6 }}>{doc.customer.fullName ?? doc.customer.email}</div>
                  )}
                  <div style={{ fontSize: 12, color: "#444444", lineHeight: 1.75 }}>
                    {(doc.customer.addressLine1 || doc.customer.city) && (
                      <div>{[doc.customer.addressLine1, doc.customer.addressLine2, doc.customer.district, doc.customer.city, doc.customer.province, doc.customer.country].filter(Boolean).join(", ")}</div>
                    )}
                    {doc.customer.vatTaxId && <div>VAT: {doc.customer.vatTaxId}</div>}
                    <div>{doc.customer.email}</div>
                    {doc.customer.mobile && <div>{doc.customer.mobile}</div>}
                  </div>
                </div>

                <div>
                  <table style={{ fontSize: 12, color: "#444444", borderCollapse: "collapse" }}>
                    <tbody>
                      <tr><td style={{ paddingRight: 60, paddingBottom: 5 }}>Issue Date:</td><td style={{ textAlign: "right", paddingBottom: 5 }}>{fmtDate(doc.issueDate.toString())}</td></tr>
                      {doc.dueDate    && <tr><td style={{ paddingRight: 24, paddingBottom: 5 }}>Due Date:</td><td style={{ textAlign: "right", paddingBottom: 5 }}>{fmtDate(doc.dueDate.toString())}</td></tr>}
                      {doc.validUntil && <tr><td style={{ paddingRight: 24, paddingBottom: 5 }}>Valid Until:</td><td style={{ textAlign: "right", paddingBottom: 5 }}>{fmtDate(doc.validUntil.toString())}</td></tr>}
                      {doc.referenceNumber && <tr><td style={{ paddingRight: 24, paddingBottom: 5 }}>Reference:</td><td style={{ textAlign: "right", paddingBottom: 5, fontFamily: "monospace" }}>{doc.referenceNumber}</td></tr>}
                      <tr><td style={{ paddingRight: 24, paddingBottom: 5 }}>Currency:</td><td style={{ textAlign: "right", paddingBottom: 5 }}>{doc.currency}</td></tr>
                      <tr><td style={{ paddingRight: 24 }}>{taxRateLabel}:</td><td style={{ textAlign: "right" }}>{Number(doc.vatPercent)}%</td></tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Subject */}
              {doc.subject && (
                <div style={{ marginBottom: 16, fontSize: 13, color: "#374151" }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "#444444", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 4 }}>Subject</div>
                  {doc.subject}
                </div>
              )}

              {/* ── Line Items ── */}
              <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 8 }}>
                <thead>
                  <tr style={{ background: primaryColor }}>
                    {["#", "Description", "Period", "Qty", "Unit Price", "Disc", "Total"].map((h, i) => (
                      <th key={h} style={{
                        padding: "9px 10px",
                        textAlign: i === 0 || i === 1 ? "left" : i === 2 ? "center" : "right",
                        fontSize: 10, fontWeight: 700, color: "#fff",
                        letterSpacing: "0.05em", textTransform: "uppercase",
                        width: i === 0 ? 28 : i === 2 ? 82 : i === 3 ? 42 : i === 4 ? 100 : i === 5 ? 54 : i === 6 ? 108 : "auto",
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {doc.lines.map((l, i) => (
                    <tr key={l.id} style={{ borderBottom: "0.5px solid #f3f4f6", background: i % 2 === 0 ? "#fff" : "#f9fafb" }}>
                      <td style={{ padding: "10px 10px", fontSize: 12, color: "#666666" }}>{i + 1}</td>
                      <td style={{ padding: "10px 10px" }}>
                        {/* Phase 2: show l.descriptionAr when lang === "ar" or "bi" */}
                        <div style={{ fontWeight: 600 }}>{l.description}</div>
                        {l.product && <div style={{ fontSize: 10, color: primaryColor, fontFamily: "monospace", marginTop: 2 }}>{l.product.key}</div>}
                        {/* Phase 2: show l.detailsAr when lang === "ar" or "bi" */}
                        {l.productDetails && <div style={{ fontSize: 12, color: "#444444", marginTop: 3, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{l.productDetails}</div>}
                      </td>
                      <td style={{ padding: "10px 10px", textAlign: "center" }}>
                        {l.billingPeriod ? (
                          <span style={{ fontSize: 10, padding: "1px 7px", background: "#f3f4f6", border: "0.5px solid #e5e7eb", color: "#444444" }}>
                            {PERIOD_LABEL[l.billingPeriod] ?? l.billingPeriod}
                          </span>
                        ) : "—"}
                      </td>
                      <td style={{ padding: "10px 10px", textAlign: "right", fontFamily: "monospace", fontSize: 12 }}>{Number(l.quantity)}</td>
                      <td style={{ padding: "10px 10px", textAlign: "right", fontFamily: "monospace", fontSize: 12 }}>{fmtAmount(l.unitPrice, doc.currency)}</td>
                      <td style={{ padding: "10px 10px", textAlign: "right", fontFamily: "monospace", fontSize: 12, color: Number(l.discount) > 0 ? "#b45309" : "#666666" }}>
                        {Number(l.discount) > 0 ? `${Number(l.discount)}%` : "—"}
                      </td>
                      <td style={{ padding: "10px 10px", textAlign: "right", fontFamily: "monospace", fontSize: 12, fontWeight: 700 }}>
                        {fmtAmount(l.lineTotal, doc.currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* ── Totals ── */}
              <div style={{ display: "flex", justifyContent: "flex-end", margin: "16px 0 24px" }}>
                <div style={{ minWidth: 280 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 10px", borderBottom: "0.5px solid #f3f4f6", fontSize: 12 }}>
                    <span style={{ color: "#444444" }}>Subtotal</span>
                    <span style={{ fontFamily: "monospace", fontWeight: 600 }}>{fmtAmount(doc.subtotal, doc.currency)}</span>
                  </div>
                  {Number(doc.vatPercent) > 0 && (
                    <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 10px", borderBottom: "0.5px solid #f3f4f6", fontSize: 12 }}>
                      <span style={{ color: "#444444" }}>VAT ({Number(doc.vatPercent)}%)</span>
                      <span style={{ fontFamily: "monospace", fontWeight: 600 }}>{fmtAmount(doc.vatAmount, doc.currency)}</span>
                    </div>
                  )}
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 10px", borderTop: `2px solid ${primaryColor}`, marginTop: 4, fontSize: 15, fontWeight: 700 }}>
                    <span>Total</span>
                    <span style={{ color: primaryColor }}>{fmtAmount(doc.total, doc.currency)}</span>
                  </div>
                  {totalPaid > 0 && (
                    <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 10px", borderBottom: "0.5px solid #f3f4f6", fontSize: 12 }}>
                      <span style={{ color: "#15803d" }}>
                        Paid
                        {doc.payments[0] && <span style={{ fontSize: 10, color: "#666666", marginLeft: 6 }}>{fmtDate(doc.payments[0].paidAt.toString())}</span>}
                      </span>
                      <span style={{ fontFamily: "monospace", fontWeight: 600, color: "#15803d" }}>− {fmtAmount(totalPaid, doc.currency)}</span>
                    </div>
                  )}
                  {balanceDue > 0 && totalPaid > 0 && (
                    <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 10px", borderTop: "1px solid #e5e7eb", marginTop: 4, fontSize: 14, fontWeight: 700 }}>
                      <span>Balance Due</span>
                      <span style={{ color: "#dc2626", fontFamily: "monospace" }}>{fmtAmount(balanceDue, doc.currency)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* ── Bank + ZATCA ── */}
              {showBank && (
                <div style={{ padding: "12px 16px", background: "#f9fafb", border: "1px solid #e5e7eb", marginBottom: 20, display: "grid", gridTemplateColumns: (isSaudi && doc.type === "INVOICE") ? "1fr auto" : "1fr", gap: 24, alignItems: "start" }}>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "#444444", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Bank Details</div>
                    <table style={{ fontSize: 12, borderCollapse: "collapse" }}>
                      <tbody>
                        {bd?.bankName    && <tr><td style={{ color: "#666666", paddingRight: 16, paddingBottom: 2 }}>Bank</td><td style={{ fontFamily: "monospace" }}>{bd.bankName}</td></tr>}
                        {bd?.accountName && <tr><td style={{ color: "#666666", paddingRight: 16, paddingBottom: 2 }}>Account</td><td style={{ fontFamily: "monospace" }}>{bd.accountName}</td></tr>}
                        {bd?.iban        && <tr><td style={{ color: "#666666", paddingRight: 16, paddingBottom: 2 }}>IBAN</td><td style={{ fontFamily: "monospace" }}>{bd.iban}</td></tr>}
                        {bd?.swift       && <tr><td style={{ color: "#666666", paddingRight: 16 }}>SWIFT</td><td style={{ fontFamily: "monospace" }}>{bd.swift}</td></tr>}
                      </tbody>
                    </table>
                  </div>
                  {isSaudi && doc.type === "INVOICE" && (
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: "#444444", textTransform: "uppercase", letterSpacing: "0.06em" }}>ZATCA QR</div>
                      <div style={{ fontSize: 9, color: "#666666" }}>Scan to verify with ZATCA portal</div>
                      <div style={{ width: 80, height: 80, border: "0.5px solid #e5e7eb", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        {doc.zatcaQrCode
                          ? <img src={`data:image/png;base64,${doc.zatcaQrCode}`} alt="ZATCA QR" style={{ width: 72, height: 72 }} />
                          : <svg width="60" height="60" viewBox="0 0 52 52" fill="none">
                              <rect x="2" y="2" width="14" height="14" rx="1" fill="none" stroke="#444444" strokeWidth="2"/><rect x="5" y="5" width="8" height="8" fill="#444444"/>
                              <rect x="36" y="2" width="14" height="14" rx="1" fill="none" stroke="#444444" strokeWidth="2"/><rect x="39" y="5" width="8" height="8" fill="#444444"/>
                              <rect x="2" y="36" width="14" height="14" rx="1" fill="none" stroke="#444444" strokeWidth="2"/><rect x="5" y="39" width="8" height="8" fill="#444444"/>
                              <rect x="20" y="2" width="4" height="4" fill="#444444"/><rect x="26" y="2" width="4" height="4" fill="#444444"/>
                              <rect x="20" y="20" width="4" height="4" fill="#444444"/><rect x="26" y="26" width="4" height="4" fill="#444444"/>
                              <rect x="20" y="32" width="4" height="4" fill="#444444"/><rect x="38" y="38" width="4" height="4" fill="#444444"/>
                            </svg>
                        }
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ── Terms + Notes ── */}
              {(doc.termsAndConditions || doc.notes) && (
                <div style={{ marginBottom: 20 }}>
                  {doc.termsAndConditions && (
                    <div style={{ marginBottom: 14 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: "#444444", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 6 }}>Terms &amp; Conditions</div>
                      <div style={{ fontSize: 12, color: "#444444", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{doc.termsAndConditions}</div>
                    </div>
                  )}
                  {doc.notes && (
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: "#444444", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 6 }}>Notes</div>
                      <div style={{ fontSize: 12, color: "#444444", lineHeight: 1.7 }}>{doc.notes}</div>
                    </div>
                  )}
                </div>
              )}

              {/* ── RFQ Attachment — shown in browser, hidden in print ── */}
              {doc.rfqFileUrl && (
                <div className="no-print" style={{ marginBottom: 16, padding: "10px 14px", background: "#f9fafb", border: "1px solid #e5e7eb", fontSize: 12, display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ color: "#444444" }}>Attachment:</span>
                  <a href={`/api/admin/sales/attachment?key=${encodeURIComponent(doc.rfqFileUrl)}`}
                    target="_blank" rel="noreferrer"
                    style={{ color: primaryColor, fontWeight: 600, textDecoration: "none" }}>
                    View / Download ↗
                  </a>
                </div>
              )}

              {/* ── Internal Note — admin only, hidden in print ── */}
              {doc.internalNote && (
                <div className="no-print" style={{ marginBottom: 16, padding: "12px 16px", background: "#fffbeb", border: "1px solid #fcd34d", fontSize: 12, color: "#92400e" }}>
                  <strong>Internal note (admin only):</strong> {doc.internalNote}
                </div>
              )}

              {/* ── Document Chain — admin only, hidden in print ── */}
              {(doc.originDoc || (doc.derivedDocs && doc.derivedDocs.length > 0)) && (
                <div className="no-print" style={{ marginBottom: 16, padding: "10px 14px", background: "#f9fafb", border: "1px solid #e5e7eb", fontSize: 12 }}>
                  {doc.originDoc && (
                    <div style={{ marginBottom: 4 }}>
                      <span style={{ color: "#444444" }}>Origin: </span>
                      <span style={{ fontFamily: "monospace", color: primaryColor, fontWeight: 600 }}>{doc.originDoc.docNum}</span>
                      <span style={{ color: "#666666", marginLeft: 6 }}>({doc.originDoc.type.replace(/_/g, " ")})</span>
                    </div>
                  )}
                  {doc.derivedDocs && doc.derivedDocs.length > 0 && (
                    <div>
                      <span style={{ color: "#444444" }}>Derived: </span>
                      {doc.derivedDocs.map(d => (
                        <span key={d.id} style={{ fontFamily: "monospace", color: primaryColor, fontWeight: 600, marginRight: 10 }}>{d.docNum}</span>
                      ))}
                    </div>
                  )}
                </div>
              )}

            </div>
          </div>
        </div>

        {/* Footer — fixed at bottom on every printed page */}
        <div className="doc-footer">
          {li.footerText ?? `${li.companyName ?? doc.market.name} · ${li.email ?? ""} · ${li.phone ?? ""}`}
        </div>
      </body>
    </html>
  );
}