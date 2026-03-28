// app/dashboard/rfq/page.tsx
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/get-session-user";
import { RFQClient } from "./RFQClient";

export const metadata = { title: "RFQ / Inquiries" };

export default async function RFQPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return <RFQClient />;
}
