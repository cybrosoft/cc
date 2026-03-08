import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/get-session-user";
import SubscribeClient from "./SubscribeClient";

export default async function SubscribePage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  return <SubscribeClient />;
}