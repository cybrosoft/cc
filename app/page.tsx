// app/page.tsx
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/get-session-user";

export default async function RootPage() {
  const user = await getSessionUser();

  if (!user) redirect("/login");

  if (user.role === "ADMIN" || user.role === "STAFF") {
    redirect("/admin");
  }

  redirect("/dashboard");
}
