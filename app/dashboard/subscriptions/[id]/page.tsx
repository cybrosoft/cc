// app/dashboard/subscriptions/[id]/page.tsx

import { redirect, notFound } from "next/navigation";
import { getSessionUser } from "@/lib/auth/get-session-user";
import { getCachedSubscription } from "@/lib/cache/customer-cache";
import { SubscriptionDetailClient } from "./SubscriptionDetailClient";

export const metadata = { title: "Subscription Detail" };

export default async function SubscriptionDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const sub = await getCachedSubscription(user.id, params.id);
  if (!sub) notFound();

  const plainUser = {
    id:       user.id,
    email:    user.email,
    market:   user.market?.key ?? null,
    currency: user.market?.defaultCurrency ?? null,
  };

  return <SubscriptionDetailClient user={plainUser} subscription={sub} />;
}
