// app/dashboard/quotations/page.tsx
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/get-session-user";
import { QuotationsClient } from "./QuotationsClient";

export const metadata = { title: "Quotations" };

export default async function QuotationsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return <QuotationsClient />;
}
