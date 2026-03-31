// app/sa/dashboard/layout.tsx
// Saudi market dashboard layout — same as /dashboard/layout.tsx but
// redirects to /sa/login instead of /login on auth failure.

import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/get-session-user";
import { prisma } from "@/lib/prisma";
import { DashboardDrawer } from "@/app/dashboard/DashboardDrawer";
import { getBillingNavVisibility } from "@/lib/customer/billing-nav";
import "@/app/dashboard/dashboard.css";

export default async function SaDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSessionUser();
  if (!session) redirect("/sa/login");
  if (session.role === "ADMIN") redirect("/admin");

  const dbUser = await prisma.user.findUnique({
    where: { id: session.id },
    select: {
      id: true,
      email: true,
      fullName: true,
      companyName: true,
      customerNumber: true,
      market: {
        select: {
          key: true,
          defaultCurrency: true,
        },
      },
    },
  });

  if (!dbUser) redirect("/sa/login");

  const billingVisibility = await getBillingNavVisibility(dbUser.id);

  return (
    <DashboardDrawer
      userEmail={dbUser.email}
      userName={dbUser.fullName ?? null}
      companyName={dbUser.companyName ?? null}
      customerNumber={String(dbUser.customerNumber)}
      billingVisibility={billingVisibility}
    >
      {children}
    </DashboardDrawer>
  );
}
