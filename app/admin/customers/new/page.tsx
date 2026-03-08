// FILE: app/admin/customers/new/page.tsx

import { prisma } from "@/lib/prisma";
import CreateCustomerForm from "./ui/CreateCustomerForm";
import { requireRole } from "@/lib/auth/require-user";
import { Role } from "@prisma/client";

export default async function NewCustomerPage() {
  await requireRole([Role.ADMIN, Role.STAFF]);

  const [markets, groups] = await Promise.all([
    prisma.market.findMany({
      where: { isActive: true },
      orderBy: [{ name: "asc" }],
      select: { id: true, name: true, key: true },
    }),
    prisma.customerGroup.findMany({
      where: { isActive: true },
      orderBy: [{ name: "asc" }],
      select: { id: true, name: true, key: true },
    }),
  ]);

  const groupsWithDefault = groups.map((g) => ({
    ...g,
    isDefault: g.key === "standard",
  }));

  return (
    <div className="mx-auto w-full max-w-2xl p-6">
      <h1 className="text-2xl font-semibold">Create Customer</h1>

      <div className="mt-6">
        <CreateCustomerForm markets={markets} groups={groupsWithDefault} />
      </div>
    </div>
  );
}