// app/dashboard/po/page.tsx
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/require-user";
import { POClient } from "./POClient";

export const metadata = { title: "Issued PO" };

export default async function POPage() {
  await requireUser();
  return <POClient />;
}
