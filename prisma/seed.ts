// FILE: prisma/seed.ts
import { PrismaClient, Role, BillingProvider } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const adminEmail        = process.env.ADMIN_EMAIL?.trim().toLowerCase()         ?? "";
  const testCustomerEmail = process.env.TEST_CUSTOMER_EMAIL?.trim().toLowerCase() ?? "";
  const globalZohoOrgId   = process.env.ZOHO_GLOBAL_ORG_ID || "GLOBAL_ORG";
  const saudiZohoOrgId    = process.env.ZOHO_SAUDI_ORG_ID  || "SAUDI_ORG";

  // ── 1) Markets ──────────────────────────────────────────────────────────────

  const globalMarket = await prisma.market.upsert({
    where:  { key: "GLOBAL" },
    update: { name: "Global",        defaultCurrency: "USD", billingProvider: BillingProvider.MANUAL, isActive: true, zohoOrgId: globalZohoOrgId },
    create: { key: "GLOBAL", name: "Global",        defaultCurrency: "USD", billingProvider: BillingProvider.MANUAL, isActive: true, zohoOrgId: globalZohoOrgId },
  });
  console.log("✓ Market:", globalMarket.key);

  const saudiMarket = await prisma.market.upsert({
    where:  { key: "SAUDI" },
    update: { name: "Saudi Arabia",  defaultCurrency: "SAR", billingProvider: BillingProvider.ZOHO,   isActive: true, zohoOrgId: saudiZohoOrgId  },
    create: { key: "SAUDI", name: "Saudi Arabia",  defaultCurrency: "SAR", billingProvider: BillingProvider.ZOHO,   isActive: true, zohoOrgId: saudiZohoOrgId  },
  });
  console.log("✓ Market:", saudiMarket.key);

  // ── 2) Customer Groups ──────────────────────────────────────────────────────
  //
  // "default"      → legacy fallback for users not yet assigned a group
  // "standard"     → base pricing (all group prices derived from this)
  // "business"     → % discount off standard
  // "professional" → % discount off standard
  // "enterprise"   → per-customer price overrides via CustomerPricingOverride

  const groupDefs = [
    { key: "default",      name: "Default"      },
    { key: "standard",     name: "Standard"     },
    { key: "business",     name: "Business"     },
    { key: "professional", name: "Professional" },
    { key: "enterprise",   name: "Enterprise"   },
  ];

  const groups: Record<string, string> = {}; // key → id

  for (const g of groupDefs) {
    const group = await prisma.customerGroup.upsert({
      where:  { key: g.key },
      update: { name: g.name, isActive: true },
      create: { key: g.key, name: g.name, isActive: true },
    });
    groups[g.key] = group.id;
    console.log("✓ CustomerGroup:", group.key);
  }

  // ── 3) Tags ─────────────────────────────────────────────────────────────────
  //
  // Add more tags here as needed. Key is used in API filters (?tag=windows).
  // Name is the display label shown in the admin UI.

  const tagDefs = [
    { key: "windows", name: "Windows" },
    { key: "linux",   name: "Linux"   },
    // future examples:
    // { key: "managed",      name: "Managed"      },
    // { key: "bare-metal",   name: "Bare Metal"   },
    // { key: "high-memory",  name: "High Memory"  },
  ];

  for (const t of tagDefs) {
    const tag = await prisma.tag.upsert({
      where:  { key: t.key },
      update: { name: t.name },
      create: { key: t.key, name: t.name },
    });
    console.log("✓ Tag:", tag.key);
  }

  // ── 4) Admin user ───────────────────────────────────────────────────────────

  if (!adminEmail) {
    console.log("⚠  ADMIN_EMAIL not set — skipping admin seed.");
  } else {
    const existingAdmin = await prisma.user.findUnique({ where: { email: adminEmail } });

    if (!existingAdmin) {
      await prisma.user.create({
        data: {
          email:           adminEmail,
          role:            Role.ADMIN,
          marketId:        globalMarket.id,
          customerGroupId: groups["default"],
        },
      });
      console.log("✓ Admin user created:", adminEmail);
    } else {
      await prisma.user.update({
        where: { email: adminEmail },
        data:  {
          role:            Role.ADMIN,
          marketId:        existingAdmin.marketId        ?? globalMarket.id,
          customerGroupId: existingAdmin.customerGroupId ?? groups["default"],
        },
      });
      console.log("✓ Admin already exists (role/market/group ensured).");
    }
  }

  // ── 5) Test customer ────────────────────────────────────────────────────────

  if (!testCustomerEmail) {
    console.log("⚠  TEST_CUSTOMER_EMAIL not set — skipping test customer seed.");
  } else {
    const existing = await prisma.user.findUnique({ where: { email: testCustomerEmail } });

    if (!existing) {
      await prisma.user.create({
        data: {
          email:           testCustomerEmail,
          role:            Role.CUSTOMER,
          marketId:        globalMarket.id,
          customerGroupId: groups["standard"],
        },
      });
      console.log("✓ Test customer created:", testCustomerEmail);
    } else {
      await prisma.user.update({
        where: { email: testCustomerEmail },
        data:  {
          role:            Role.CUSTOMER,
          marketId:        existing.marketId        ?? globalMarket.id,
          customerGroupId: existing.customerGroupId ?? groups["standard"],
        },
      });
      console.log("✓ Test customer already exists (role/market/group ensured).");
    }
  }

  console.log("\n🌱 Seed complete.");
}

main()
  .catch((e: unknown) => {
    console.error(e instanceof Error ? e.message : String(e));
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });