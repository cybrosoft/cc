import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/get-session-user";
import ServerDetailsClient from "./ServerDetailsClient";

export default async function ServerDetailsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  return (
    <div className="p-6">
      <ServerDetailsClient />
    </div>
  );
}