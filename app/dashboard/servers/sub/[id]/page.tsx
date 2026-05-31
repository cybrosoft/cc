// app/dashboard/servers/sub/[id]/page.tsx
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/get-session-user";
import ServerDetailsClient from "./ServerDetailsClient";

export default async function ServerDetailPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return <ServerDetailsClient />;
}
