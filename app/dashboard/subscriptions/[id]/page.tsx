// app/dashboard/subscriptions/[id]/page.tsx

import { redirect, notFound } from "next/navigation";
import { getSessionUser } from "@/lib/auth/get-session-user";
import { getCachedSubscription } from "@/lib/cache/customer-cache";
import { SubscriptionDetailClient } from "./SubscriptionDetailClient";

export const metadata = { title: "Subscription Detail" };

export default async function SubscriptionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const { id } = await params;

  const sub = await getCachedSubscription(user.id, id);
  if (!sub) notFound();

  const plainUser = {
    id:       user.id,
    email:    user.email,
    market:   user.market?.key ?? null,
    currency: user.market?.defaultCurrency ?? null,
  };

  return <SubscriptionDetailClient user={plainUser} subscription={sub} />;
}
