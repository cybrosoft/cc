// app/signup/layout.tsx
// Metadata wrapper — signup page itself is a client component.
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Create Account",
  description: "Create your Cybrosoft Cloud Console account to deploy cloud servers, request quotations, and manage billing in one place.",
  robots: { index: true, follow: true },
};

export default function SignupLayout({ children }: { children: React.ReactNode }) {
  return children;
}
