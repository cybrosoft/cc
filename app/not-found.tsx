// app/not-found.tsx
import Link from "next/link";

export default function NotFound() {
  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      background: "#f5f5f5",
      fontFamily: "'Geist', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    }}>
      <div style={{
        background: "#fff",
        border: "1px solid #e5e7eb",
        padding: "48px 56px",
        textAlign: "center",
        maxWidth: 440,
        width: "100%",
      }}>
        {/* Logo */}
        <div style={{ marginBottom: 32 }}>
          <span style={{
            fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em",
            background: "linear-gradient(to right, #254b46, #318774)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}>Cybrosoft</span>
          <span style={{ fontSize: 14, color: "#9ca3af", marginLeft: 6 }}>Console</span>
        </div>

        <div style={{
          fontSize: 64, fontWeight: 700, color: "#e5e7eb",
          letterSpacing: "-0.04em", lineHeight: 1, marginBottom: 16,
        }}>404</div>

        <h1 style={{
          fontSize: 20, fontWeight: 600, color: "#111827",
          marginBottom: 8,
        }}>Page not found</h1>

        <p style={{ fontSize: 14, color: "#6b7280", marginBottom: 32, lineHeight: 1.6 }}>
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>

        <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
          <Link href="/dashboard" style={{
            background: "#318774",
            color: "#fff",
            padding: "9px 20px",
            fontSize: 13,
            fontWeight: 600,
            textDecoration: "none",
          }}>Go to Dashboard</Link>

          <Link href="/login" style={{
            background: "#fff",
            color: "#374151",
            padding: "9px 20px",
            fontSize: 13,
            fontWeight: 500,
            textDecoration: "none",
            border: "1px solid #e5e7eb",
          }}>Login</Link>
        </div>
      </div>
    </div>
  );
}
