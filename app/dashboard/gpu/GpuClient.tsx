"use client";
// app/dashboard/gpu/GpuClient.tsx

const C = {
  border: "1px solid #e5e7eb",
  borderB: "1px solid #f3f4f6",
  bg: "#ffffff",
  bgAlt: "#f9fafb",
  text: "#111827",
  muted: "#6b7280",
  faint: "#9ca3af",
  primary: "#318774",
};

const COLS = ["Name", "Instance ID", "State", "Public IP", "Type", "Specs", "GPU", "Location", "Created", "Payment", "Actions"];

export function GpuClient() {
  return (
    <div className="cy-page-content">
      <div className="cy-dash-wrap">

        {/* Header */}
        <div style={{ marginBottom: 8 }}>
          <p style={{ fontSize: 11, color: C.faint, letterSpacing: ".05em", margin: "0 0 4px" }}>DASHBOARD / GPU INSTANCES</p>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: C.text, margin: 0 }}>GPU Instances</h1>
            <div style={{ display: "flex", gap: 8 }}>
              <button style={{ height: 32, padding: "0 14px", fontSize: 12, background: C.bg, border: C.border, cursor: "pointer", fontFamily: "inherit", color: C.text, display: "inline-flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 16, lineHeight: 1 }}>↻</span> Refresh
              </button>
              <button disabled
                style={{ height: 32, padding: "0 16px", fontSize: 12, fontWeight: 600, background: "#e5e7eb", border: "none", cursor: "not-allowed", fontFamily: "inherit", color: "#9ca3af" }}>
                + New GPU Server
              </button>
            </div>
          </div>
        </div>

        <p style={{ fontSize: 13, color: C.faint, margin: "0 0 16px" }}>0 servers</p>

        <div style={{ border: C.border, background: C.bg }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr>
                {COLS.map((c, i) => (
                  <th key={i} style={{ padding: "10px 16px", textAlign: "left", fontSize: 11, fontWeight: 700, color: C.faint, background: C.bgAlt, borderBottom: C.border, letterSpacing: "0.06em", textTransform: "uppercase", whiteSpace: "nowrap" }}>
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={COLS.length} style={{ padding: "32px 16px", textAlign: "center", fontSize: 13, color: C.faint }}>
                  No GPU servers yet.
                </td>
              </tr>
            </tbody>
          </table>
        </div>

      </div>
    </div>
  );
}