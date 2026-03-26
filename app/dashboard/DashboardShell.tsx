"use client";
// app/dashboard/DashboardShell.tsx
// Client wrapper that owns drawer open/close state shared between
// CustomerHeader (hamburger button) and CustomerNav (drawer + backdrop)

import { useState } from "react";
import { CustomerHeader, CustomerHeaderProps } from "@/components/nav/CustomerHeader";
import { CustomerNav, CustomerNavProps } from "@/components/nav/CustomerNav";

type ShellProps = CustomerHeaderProps & Omit<CustomerNavProps, "drawerOpen" | "onDrawerClose">;

export function DashboardShell({ userEmail, userName, customerNumber, billingVisibility }: ShellProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <>
      <CustomerNav
        userEmail={userEmail!}
        userName={userName}
        customerNumber={customerNumber}
        billingVisibility={billingVisibility}
        drawerOpen={drawerOpen}
        onDrawerClose={() => setDrawerOpen(false)}
      />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 }}>
        <CustomerHeader
          userEmail={userEmail}
          userName={userName}
          customerNumber={customerNumber}
          drawerOpen={drawerOpen}
          onHamburgerClick={() => setDrawerOpen((v) => !v)}
        />
        {/* children injected by layout via slot — see layout.tsx */}
      </div>
    </>
  );
}
