"use client";
// app/admin/subscriptions/subscriptionsAdmin.tsx
// Step 6 restyled — wraps SubscriptionsTable in PageShell

import { PageShell } from "@/components/ui/admin-ui";
import { SubscriptionsTable } from "./subscriptionsTable";

export default function SubscriptionsAdmin() {
  return (
    <PageShell breadcrumb="ADMIN / SUBSCRIPTIONS" title="Subscriptions">
        <SubscriptionsTable />
    </PageShell>
  );
}
