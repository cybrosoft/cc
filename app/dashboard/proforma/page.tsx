// app/dashboard/proforma/page.tsx
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/get-session-user";
import { ProformaClient } from "./ProformaClient";

export const metadata = { title: "Proforma Invoices" };

export default async function ProformaPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return <ProformaClient />;
}
