"use client";
// app/dashboard/subscriptions/[id]/SubscriptionDetailClient.tsx

import { useState, useEffect } from "react";
import Link from "next/link";
import { colors } from "@/lib/ui/tokens";

// ── Types ─────────────────────────────────────────────────────────────────────
interface PageUser { id: string; email: string; market: string | null; currency: string | null; }

interface AddonRow {
  id: string; productName: string; productKey: string | null;
  productType: string; unitLabel: string | null; billingPeriod: string;
  status: string; paymentStatus: string; quantity: number;
  currentPeriodStart: string | null; currentPeriodEnd: string | null;
}

interface ServerDetail {
  id: string; provider: string; productKey: string | null;
  hetznerServerId: string | null; oracleInstanceId: string | null;
  oracleInstanceRegion: string | null;
  ipv4: string | null; status: string | null; location: string | null;
  vcpus: number | null; ramGb: number | null; diskGb: number | null;
}

interface SubDetail {
  id: string; productName: string; productKey: string | null;
  productType: string; unitLabel: string | null; billingPeriod: string;
  status: string; paymentStatus: string; quantity: number;
  locationCode: string | null; templateSlug: string | null;
  productNote: string | null; productDetails: string | null;
  receiptUrl: string | null; parentSubId: string | null;
  expiringSoon?: boolean;
  currentPeriodStart: string | null; currentPeriodEnd: string | null;
  createdAt: string;
  server: ServerDetail | null;
  addons: AddonRow[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
function daysLeft(d: string | null) {
  if (!d) return null;
  return Math.ceil((new Date(d).getTime() - Date.now()) / 86400000);
}

// ── Sub-components ────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const map: Record<string, {bg:string;color:string}> = {
    ACTIVE:          { bg:"#e8f5f0", color:"#0F6E56" },
    PENDING_PAYMENT: { bg:"#fff8e6", color:"#854F0B" },
    PENDING_EXTERNAL:{ bg:"#fff8e6", color:"#854F0B" },
    CANCELED:        { bg:"#f3f4f6", color:"#6b7280" },
  };
  const s = map[status] ?? { bg:"#f3f4f6", color:"#6b7280" };
  return (
    <span style={{ display:"inline-flex", alignItems:"center", height:22, padding:"0 10px", borderRadius:11, fontSize:11.5, fontWeight:600, letterSpacing:"0.03em", background:s.bg, color:s.color, textTransform:"uppercase" }}>
      {status.replace(/_/g," ")}
    </span>
  );
}

function InfoRow({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div style={{ display:"flex", alignItems:"flex-start", padding:"10px 0", borderBottom:"1px solid #f3f4f6" }}>
      <span style={{ width:140, flexShrink:0, fontSize:12.5, color:"#6b7280", paddingRight:12 }}>{label}</span>
      <span style={{ flex:1, fontSize:12.5, color:"#111827", fontFamily: mono ? "monospace" : undefined, fontWeight: mono ? 500 : 400 }}>{value}</span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background:"#fff", border:"1px solid #e5e7eb", marginBottom:16, overflow:"hidden" }}>
      <div style={{ padding:"12px 16px", borderBottom:"1px solid #f3f4f6", background:"#f9fafb" }}>
        <h2 style={{ margin:0, fontSize:13.5, fontWeight:600, color:"#111827" }}>{title}</h2>
      </div>
      <div style={{ padding:"0 16px" }}>{children}</div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export function SubscriptionDetailClient({
  user,
  subscription: sub,
}: {
  user: PageUser;
  subscription: SubDetail;
}) {
  const [liveServer, setLiveServer] = useState<ServerDetail | null>(sub.server);

  // Refresh live server details in background (separate from cached page data)
  useEffect(() => {
    if (!sub.server) return;
    fetch(`/api/customer/subscriptions/${sub.id}`)
      .then(r => r.json())
      .then(d => { if (d.subscription?.server) setLiveServer(d.subscription.server); })
      .catch(() => {});
  }, [sub.id, sub.server]);

  const days    = daysLeft(sub.currentPeriodEnd);
  const expired = days !== null && days < 0;

  const serverCode = liveServer?.productKey
    ?? liveServer?.hetznerServerId
    ?? liveServer?.oracleInstanceId
    ?? null;

  const specs = liveServer?.vcpus || liveServer?.ramGb
    ? `${liveServer.vcpus ?? "?"}vCPU / ${liveServer.ramGb ?? "?"}GB${liveServer.diskGb ? ` / ${liveServer.diskGb}GB Boot` : ""}`
    : null;

  return (
    <>
      <style>{`
        .cy-back:hover { color: ${colors.primary} !important; }
        @keyframes cy-shimmer { 0%{background-position:-400px 0} 100%{background-position:400px 0} }
        .cy-shimmer { background:linear-gradient(90deg,#f0f0f0 25%,#e4e4e4 50%,#f0f0f0 75%); background-size:800px 100%; animation:cy-shimmer 1.4s ease-in-out infinite; border-radius:4px; }
        .cy-addon-row:hover { background: #f5faf8 !important; }
      `}</style>

      <div className="cy-page-content">
        <div className="cy-dash-wrap">

          {/* Back + header */}
          <div style={{ marginBottom: 20 }}>
            <Link href="/dashboard/subscriptions" className="cy-back"
              style={{ display:"inline-flex", alignItems:"center", gap:5, fontSize:13, color:"#6b7280", textDecoration:"none", marginBottom:12, transition:"color 0.12s" }}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9 11L5 7l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              My Subscriptions
            </Link>
            <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:12, flexWrap:"wrap" }}>
              <div>
                <h1 className="cy-page-title" style={{ margin:"0 0 6px" }}>{sub.productName}</h1>
                <div style={{ display:"flex", gap:8, alignItems:"center", flexWrap:"wrap" }}>
                  <StatusBadge status={sub.status} />
                  {sub.paymentStatus !== "PAID" && (
                    <span style={{ fontSize:11.5, fontWeight:600, color:"#dc2626", textTransform:"uppercase", letterSpacing:"0.03em" }}>{sub.paymentStatus}</span>
                  )}
                  {sub.expiringSoon && !expired && days !== null && (
                    <span style={{ fontSize:11.5, fontWeight:600, color:"#b45309" }}>Expires in {days} day{days!==1?"s":""}</span>
                  )}
                  {expired && (
                    <span style={{ fontSize:11.5, fontWeight:600, color:"#dc2626" }}>Expired</span>
                  )}
                </div>
              </div>
              {sub.receiptUrl && (
                <a href={sub.receiptUrl} target="_blank" rel="noreferrer"
                  style={{ display:"flex", alignItems:"center", gap:6, height:34, padding:"0 14px", background:"#fff", border:"1px solid #e5e7eb", fontSize:13, fontWeight:500, color:"#374151", textDecoration:"none" }}>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 1v8M4 6l3 3 3-3M1 10v1a2 2 0 002 2h8a2 2 0 002-2v-1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  Download Receipt
                </a>
              )}
            </div>
          </div>

          {/* Overview */}
          <Section title="Overview">
            <InfoRow label="Service"        value={sub.productName} />
            {sub.productKey && <InfoRow label="Product code"  value={sub.productKey.toUpperCase()} mono />}
            <InfoRow label="Type"           value={sub.productType} />
            <InfoRow label="Billing period" value={sub.billingPeriod} />
            {sub.quantity > 1 && (
              <InfoRow label="Quantity" value={`${sub.quantity}${sub.unitLabel ? ` ${sub.unitLabel}` : ""}`} />
            )}
            <InfoRow label="Start date"     value={fmtDate(sub.currentPeriodStart)} />
            <InfoRow label="Expiry date"    value={
              <span style={{ color: expired ? "#dc2626" : (sub.expiringSoon ? "#b45309" : "#111827") }}>
                {fmtDate(sub.currentPeriodEnd)}
                {days !== null && !expired && days <= 30 && (
                  <span style={{ marginLeft:8, fontSize:11.5, color: days<=7 ? "#b45309" : "#9ca3af" }}>
                    ({days} day{days!==1?"s":""} remaining)
                  </span>
                )}
              </span>
            } />
            {sub.locationCode  && <InfoRow label="Location"     value={sub.locationCode} />}
            {sub.templateSlug  && <InfoRow label="OS template"  value={sub.templateSlug} />}
            {sub.productNote   && <InfoRow label="Note"         value={sub.productNote} />}
            {sub.productDetails && <InfoRow label="Details"     value={sub.productDetails} />}
            <InfoRow label="Subscribed on" value={fmtDate(sub.createdAt)} />
          </Section>

          {/* Server */}
          {liveServer && (
            <Section title="Linked Server">
              {serverCode && <InfoRow label="Server ID" value={serverCode.toUpperCase()} mono />}
              <InfoRow label="Provider" value={liveServer.provider} />
              {liveServer.ipv4     && <InfoRow label="IPv4 address" value={liveServer.ipv4} mono />}
              {specs               && <InfoRow label="Specs"        value={specs} />}
              {liveServer.location && <InfoRow label="Location"     value={liveServer.location} />}
              {liveServer.status   && (
                <InfoRow label="Status" value={
                  <span style={{ fontSize:12, fontWeight:600, textTransform:"uppercase", letterSpacing:"0.04em", color: liveServer.status === "running" || liveServer.status === "RUNNING" ? colors.primary : "#6b7280" }}>
                    {liveServer.status}
                  </span>
                } />
              )}
              <div style={{ padding:"10px 0" }}>
                <Link href={`/dashboard/servers/${liveServer.id}`}
                  style={{ fontSize:13, color:colors.primary, textDecoration:"none", fontWeight:500 }}>
                  View server details →
                </Link>
              </div>
            </Section>
          )}

          {/* Addons */}
          {sub.addons.length > 0 && (
            <Section title={`Add-ons (${sub.addons.length})`}>
              {sub.addons.map((a, idx) => (
                <Link key={a.id} href={`/dashboard/subscriptions/${a.id}`}
                  className="cy-addon-row"
                  style={{ display:"flex", alignItems:"center", padding:"10px 0", borderBottom: idx < sub.addons.length-1 ? "1px solid #f3f4f6" : "none", textDecoration:"none", transition:"background 0.1s" }}>
                  <div style={{ flex:1, minWidth:0, paddingRight:12 }}>
                    <div style={{ fontSize:13, color:"#111827", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                      {a.productName}
                      {a.quantity > 1 && <span style={{ marginLeft:6, fontSize:11.5, color:"#9ca3af" }}>×{a.quantity}{a.unitLabel ? ` ${a.unitLabel}` : ""}</span>}
                    </div>
                    <div style={{ fontSize:11.5, color:"#9ca3af", marginTop:2 }}>{a.billingPeriod} · {fmtDate(a.currentPeriodEnd)}</div>
                  </div>
                  <StatusBadge status={a.status} />
                </Link>
              ))}
            </Section>
          )}

          {/* Invoices placeholder — will be filled when Sales module is built */}
          <Section title="Invoices">
            <div style={{ padding:"20px 0", textAlign:"center", fontSize:13, color:"#9ca3af" }}>
              Invoice history will appear here once the billing module is set up.
            </div>
          </Section>

        </div>
      </div>
    </>
  );
}
