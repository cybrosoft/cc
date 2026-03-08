import { redirect } from "next/navigation";
import DashboardClient from "./DashboardClient";
import { getSessionUser } from "@/lib/auth/get-session-user";

export default async function DashboardPage() {
  const user = await getSessionUser();

  if (!user) redirect("/login");

  return <DashboardClient user={user} />;
}