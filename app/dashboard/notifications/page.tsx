// app/dashboard/notifications/page.tsx
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/get-session-user";
import { NotificationsClient } from "./NotificationsClient";

export const metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return <NotificationsClient />;
}
