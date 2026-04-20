// app/dashboard/page.tsx

import { getSessionUser } from "@/lib/auth/get-session-user";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { DashboardHomeClient } from "./DashboardHomeClient";

export default async function DashboardPage() {
  const session = await getSessionUser();
  if (!session) redirect("/login");

  const dbUser = await prisma.user.findUnique({
    where: { id: session.id },
    select: {
      id: true,
      email: true,
      fullName: true,
      companyName: true,
      customerNumber: true,
      status: true,
      totpEnabled: true,
      market: {
        select: { key: true, defaultCurrency: true },
      },
      customerGroup: {
        select: { name: true },
      },
    },
  });

  if (!dbUser) redirect("/login");

  // Get the latest INFO_REQUIRED status change message from audit log
  let infoRequiredMessage: string | null = null;
  if (dbUser.status === "INFO_REQUIRED") {
    const log = await prisma.auditLog.findFirst({
      where: { entityType: "User", entityId: session.id, action: "CUSTOMER_STATUS_INFO_REQUIRED" },
      orderBy: { id: "desc" },
      select: { metadataJson: true },
    });
    if (log?.metadataJson) {
      try {
        const meta = JSON.parse(log.metadataJson);
        infoRequiredMessage = meta.message ?? null;
      } catch { /* ignore */ }
    }
  }

  const user = {
    id: dbUser.id,
    email: dbUser.email,
    name: dbUser.fullName ?? null,
    companyName: dbUser.companyName ?? null,
    customerNumber: String(dbUser.customerNumber),
    market: dbUser.market.key,
    currency: dbUser.market.defaultCurrency,
    customerGroup: dbUser.customerGroup?.name ?? null,
    userStatus: dbUser.status as string,
    totpEnabled: dbUser.totpEnabled,
    infoRequiredMessage,
  };

  return <DashboardHomeClient user={user} />;
}
