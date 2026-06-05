// app/api/customer/subscriptions/route.ts

import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/get-session-user";
import { getCachedCustomerData } from "@/lib/cache/customer-cache";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const data = await getCachedCustomerData(user.id);

  // Strip paymentStatus — not shown to customers (invoices section handles billing)
  function stripPayment<T extends { paymentStatus?: unknown }>(s: T) {
    const { paymentStatus: _p, ...rest } = s;
    return rest;
  }

  // Nest addons under their parent plan
  const plans  = data.subscriptions.filter(s => !s.parentSubId);
  const addons = data.subscriptions.filter(s =>  s.parentSubId);

  const addonsByParent = new Map<string, ReturnType<typeof stripPayment>[]>();
  for (const addon of addons) {
    const list = addonsByParent.get(addon.parentSubId!) ?? [];
    list.push(stripPayment(addon));
    addonsByParent.set(addon.parentSubId!, list);
  }

  const nested = plans.map(plan => ({
    ...stripPayment(plan),
    addons: addonsByParent.get(plan.id) ?? [],
  }));

  return NextResponse.json({ subscriptions: nested });
}
