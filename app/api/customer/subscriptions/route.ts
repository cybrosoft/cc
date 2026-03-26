// app/api/customer/subscriptions/route.ts

import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/get-session-user";
import { getCachedCustomerData } from "@/lib/cache/customer-cache";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const data = await getCachedCustomerData(user.id);

  // Nest addons under their parent plan
  const plans  = data.subscriptions.filter(s => !s.parentSubId);
  const addons = data.subscriptions.filter(s =>  s.parentSubId);

  const addonsByParent = new Map<string, typeof addons>();
  for (const addon of addons) {
    const list = addonsByParent.get(addon.parentSubId!) ?? [];
    list.push(addon);
    addonsByParent.set(addon.parentSubId!, list);
  }

  const nested = plans.map(plan => ({
    ...plan,
    addons: addonsByParent.get(plan.id) ?? [],
  }));

  return NextResponse.json({ subscriptions: nested });
}
