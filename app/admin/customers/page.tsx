// FILE: app/admin/customers/page.tsx
import Link          from "next/link";
import { prisma }    from "@/lib/prisma";
import { requireRole } from "@/lib/auth/require-user";
import { Role }      from "@prisma/client";
import CustomersTable from "./ui/CustomersTable";

export default async function CustomersListPage() {
  await requireRole([Role.ADMIN, Role.STAFF]);

  const [customers, markets, groups, tags] = await Promise.all([
    prisma.user.findMany({
      where:   { role: Role.CUSTOMER },
      orderBy: { createdAt: "desc" },
      select: {
        id:             true,
        customerNumber: true,
        email:          true,
        fullName:       true,
        accountType:    true,
        country:        true,
        city:           true,
        createdAt:      true,
        market:         { select: { name: true, key: true } },
        customerGroup:  { select: { name: true, key: true } },
        tags:           { select: { id: true, key: true, name: true } },
        subscriptions:  { select: { id: true } },
        servers:        { select: { id: true } },
      },
    }),
    prisma.market.findMany({
      where: { isActive: true }, orderBy: { name: "asc" },
      select: { id: true, name: true, key: true },
    }),
    prisma.customerGroup.findMany({
      where: { isActive: true }, orderBy: { name: "asc" },
      select: { id: true, name: true, key: true },
    }),
    prisma.tag.findMany({
      orderBy: { name: "asc" },
      select:  { id: true, key: true, name: true },
    }),
  ]);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Customers</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {customers.length} customer{customers.length !== 1 ? "s" : ""} total
          </p>
        </div>
        <Link href="/admin/customers/new"
          className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted">
          + Create Customer
        </Link>
      </div>

      <div className="mt-6">
        <CustomersTable
          customers={customers.map((c) => ({
            ...c,
            createdAt: c.createdAt.toISOString(),
          }))}
          markets={markets}
          groups={groups}
          tags={tags}
        />
      </div>
    </div>
  );
}