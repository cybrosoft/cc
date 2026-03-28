// app/dashboard/statement/page.tsx
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/get-session-user";
import { StatementClient } from "./StatementClient";

export const metadata = { title: "Statement of Accounts" };

export default async function StatementPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return <StatementClient />;
}
