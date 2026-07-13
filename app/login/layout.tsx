// app/login/layout.tsx
// Metadata wrapper — login page itself is a client component.
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign In",
  description: "Sign in to Cybrosoft Cloud Console to manage your cloud servers, subscriptions, invoices, and services.",
  robots: { index: true, follow: true },
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
