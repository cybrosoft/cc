// FILE: app/admin/customers/[id]/edit/page.tsx
import { notFound }       from "next/navigation";
import { prisma }         from "@/lib/prisma";
import { requireRole }    from "@/lib/auth/require-user";
import { Role }           from "@prisma/client";
import EditCustomerForm   from "./ui/EditCustomerForm";

type PageProps = { params: Promise<{ id: string }> };

export default async function EditCustomerPage({ params }: PageProps) {
  await requireRole([Role.ADMIN, Role.STAFF]);

  const { id } = await params;
  if (!id) notFound();

  const customer = await prisma.user.findUnique({
    where:  { id },
    select: {
      id:                           true,
      email:                        true,
      role:                         true,
      marketId:                     true,
      customerGroupId:              true,
      fullName:                     true,
      mobile:                       true,
      accountType:                  true,
      country:                      true,
      province:                     true,
      companyName:                  true,
      vatTaxId:                     true,
      commercialRegistrationNumber: true,
      addressLine1:                 true,
      addressLine2:                 true,
      district:                     true,
      city:                         true,
    },
  });

  if (!customer || customer.role !== Role.CUSTOMER) notFound();

  const [markets, groups] = await Promise.all([
    prisma.market.findMany({
      where:   { isActive: true },
      orderBy: { name: "asc" },
      select:  { id: true, name: true, key: true },
    }),
    prisma.customerGroup.findMany({
      where:   { isActive: true },
      orderBy: { name: "asc" },
      select:  { id: true, name: true, key: true },
    }),
  ]);

  const groupsWithDefault = groups.map((g) => ({ ...g, isDefault: g.key === "standard" }));

  return (
    <div className="mx-auto w-full max-w-3xl p-6">
      <h1 className="text-2xl font-semibold">Edit Customer</h1>
      <p className="mt-1 text-sm text-muted-foreground">{customer.email}</p>
      <div className="mt-6">
        <EditCustomerForm customer={customer} markets={markets} groups={groupsWithDefault} />
      </div>
    </div>
  );
}