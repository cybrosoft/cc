// app/print/layout.tsx
// Standalone layout for print pages — no admin chrome, no sidebar, no header
export default function PrintLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
