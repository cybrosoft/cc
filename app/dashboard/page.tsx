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
      market: {
        select: {
          key: true,
          defaultCurrency: true,
        },
      },
      customerGroup: {
        select: { name: true },
      },
    },
  });

  if (!dbUser) redirect("/login");

  const user = {
    id: dbUser.id,
    email: dbUser.email,
    name: dbUser.fullName ?? null,
    companyName: dbUser.companyName ?? null,
    customerNumber: String(dbUser.customerNumber),
    market: dbUser.market.key,
    currency: dbUser.market.defaultCurrency,
    customerGroup: dbUser.customerGroup?.name ?? null,
  };

  return <DashboardHomeClient user={user} />;
}
