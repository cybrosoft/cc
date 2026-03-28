// app/dashboard/delivery-notes/page.tsx
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/get-session-user";
import { DeliveryNotesClient } from "./DeliveryNotesClient";

export const metadata = { title: "Delivery Notes" };

export default async function DeliveryNotesPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return <DeliveryNotesClient />;
}
