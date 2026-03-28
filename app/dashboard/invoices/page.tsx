// app/dashboard/invoices/page.tsx
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/get-session-user";
import { InvoicesClient } from "./InvoicesClient";

export const metadata = { title: "Invoices" };

export default async function InvoicesPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return <InvoicesClient currency={user.market?.defaultCurrency ?? "USD"} />;
}
