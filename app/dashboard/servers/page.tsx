import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/get-session-user";
import ServersClient from "./ServersClient";

export default async function ServersPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  return (
    <div className="p-6">
      <ServersClient />
    </div>
  );
}