// app/dashboard/servers/page.tsx
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/get-session-user";
import ServersClient from "./ServersClient";

export default async function ServersPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  return (
    <div style={{ padding: "24px" }}>
      <div style={{ marginBottom: 20 }}>
        <p style={{ fontSize: 11, color: "#9ca3af", letterSpacing: ".05em", marginBottom: 3 }}>DASHBOARD / SERVERS</p>
        <h1 style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-0.02em" }}>My Servers</h1>
      </div>
      <ServersClient />
    </div>
  );
}
