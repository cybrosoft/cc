import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/get-session-user";
import { prisma } from "@/lib/prisma";
import { DashboardDrawer } from "./DashboardDrawer";
import { getBillingNavVisibility } from "@/lib/customer/billing-nav";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSessionUser();
  if (!session) redirect("/login");
  if (session.role === "ADMIN") redirect("/admin");

  const dbUser = await prisma.user.findUnique({
    where: { id: session.id },
    select: {
      id: true,
      email: true,
      fullName: true,        // schema: fullName String?
      companyName: true,     // schema: companyName String?
      customerNumber: true,  // schema: customerNumber Int
      market: {
        select: {
          key: true,
          defaultCurrency: true,
          // vatPercent excluded — Decimal, not serializable
        },
      },
    },
  });

  if (!dbUser) redirect("/login");

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
