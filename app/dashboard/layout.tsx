// app/dashboard/layout.tsx
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/require-user";
import { DashboardDrawer } from "./DashboardDrawer";
import { getBillingNavVisibility } from "@/lib/customer/billing-nav";
import "./dashboard.css";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const headersList = await headers();
  const pathname = headersList.get("x-pathname") ?? "/dashboard";

  // Centralized auth + status + route access — single call
  const user = await requireUser(pathname);
  if (user.role === "ADMIN") redirect("/admin");

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      id: true, email: true, fullName: true, companyName: true,
      customerNumber: true, mobile: true, accountType: true,
      totpEnabled: true, status: true,
      market: { select: { key: true, defaultCurrency: true } },
    },
  });

  if (!dbUser) redirect("/login");

  // Onboarding redirect for incomplete PENDING profiles
  const isBusiness = dbUser.accountType === "BUSINESS";
  const needsOnboarding = dbUser.status === "PENDING" && (
    !dbUser.fullName || !dbUser.mobile || !dbUser.accountType ||
    (isBusiness && !dbUser.companyName)
  );
  if (needsOnboarding) {
    const isSaudi = dbUser.market?.key?.toLowerCase() === "saudi";
    redirect(isSaudi ? "/sa/signup?onboarding=1" : "/signup?onboarding=1");
  }

  // Get admin message for INFO_REQUIRED / SUSPENDED statuses
  let infoRequiredMessage: string | null = null;
  let suspensionReason: string | null = null;

  if (dbUser.status === "INFO_REQUIRED") {
    const log = await prisma.auditLog.findFirst({
      where: { entityType: "User", entityId: dbUser.id, action: "CUSTOMER_STATUS_INFO_REQUIRED" },
      orderBy: { id: "desc" },
      select: { metadataJson: true },
    });
    if (log?.metadataJson) {
      try { infoRequiredMessage = JSON.parse(log.metadataJson)?.message ?? null; } catch { /* ignore */ }
    }
  }

  if (dbUser.status === "SUSPENDED") {
    const log = await prisma.auditLog.findFirst({
      where: { entityType: "User", entityId: dbUser.id, action: "CUSTOMER_STATUS_SUSPENDED" },
      orderBy: { id: "desc" },
      select: { metadataJson: true },
    });
    if (log?.metadataJson) {
      try { suspensionReason = JSON.parse(log.metadataJson)?.reason ?? null; } catch { /* ignore */ }
    }
  }

  const billingVisibility = await getBillingNavVisibility(dbUser.id);

  return (
    <DashboardDrawer
      userEmail={dbUser.email}
      userName={dbUser.fullName ?? null}
      companyName={dbUser.companyName ?? null}
      customerNumber={String(dbUser.customerNumber)}
      billingVisibility={billingVisibility}
      needsOnboarding={needsOnboarding}
      totpEnabled={dbUser.totpEnabled}
      userStatus={dbUser.status}
      infoRequiredMessage={infoRequiredMessage}
      suspensionReason={suspensionReason}
    >
      {children}
    </DashboardDrawer>
  );
}
