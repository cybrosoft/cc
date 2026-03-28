// app/dashboard/profile/page.tsx
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/get-session-user";
import { ProfileClient } from "./ProfileClient";

export const metadata = { title: "My Profile" };

export default async function ProfilePage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return <ProfileClient />;
}
