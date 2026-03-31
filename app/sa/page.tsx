// app/sa/page.tsx
// /sa → /sa/login
import { redirect } from "next/navigation";
export default function SaRootPage() {
  redirect("/sa/login");
}
