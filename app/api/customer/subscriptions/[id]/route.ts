// app/api/customer/subscriptions/[id]/route.ts

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/get-session-user";
import { getCachedSubscription, getCachedServerDetails } from "@/lib/cache/customer-cache";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sub = await getCachedSubscription(user.id, params.id);
  if (!sub) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Merge live server details if this subscription has a linked server
  let serverLive = null;
  if (sub.server) {
    const allServerDetails = await getCachedServerDetails(user.id);
    const detail = allServerDetails.find(d => d.id === sub.server!.id);
    if (detail) {
      serverLive = {
        ...sub.server,
        provider: detail.provider,
        productKey: detail.productKey,
        ipv4:     detail.ipv4,
        status:   detail.status,
        location: detail.location,
        vcpus:    detail.vcpus,
        ramGb:    detail.ramGb,
        diskGb:   detail.diskGb,
      };
    }
  }

  return NextResponse.json({ subscription: { ...sub, server: serverLive ?? sub.server } });
}
