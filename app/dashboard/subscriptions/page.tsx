// app/dashboard/subscriptions/page.tsx

import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/get-session-user";
import { SubscriptionsClient } from "./SubscriptionsClient";

export const metadata = { title: "My Subscriptions" };

export default async function SubscriptionsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const plainUser = {
    id:             user.id,
    email:          user.email,
    name:           user.fullName    ?? null,
    companyName:    user.companyName ?? null,
    customerNumber: user.customerNumber ? String(user.customerNumber) : null,
    market:         user.market?.key    ?? null,
    currency:       user.market?.defaultCurrency ?? null,
  };

  return <SubscriptionsClient user={plainUser} />;
}
