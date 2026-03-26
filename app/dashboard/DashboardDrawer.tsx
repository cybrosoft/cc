"use client";
// app/dashboard/DashboardDrawer.tsx

import { useState } from "react";
import { CustomerHeader } from "@/components/nav/CustomerHeader";
import { CustomerNav } from "@/components/nav/CustomerNav";
import type { BillingNavVisibility } from "@/components/nav/CustomerNav";

interface DashboardDrawerProps {
  userEmail: string;
  userName: string | null;
  companyName: string | null;
  customerNumber: string;
  billingVisibility: BillingNavVisibility;
  children: React.ReactNode;
}

export function DashboardDrawer({
  userEmail,
  userName,
  companyName,
  customerNumber,
  billingVisibility,
  children,
}: DashboardDrawerProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <>
      <style>{`
        .cy-mobile-spacer {
          display: none;
          height: 56px;
          flex-shrink: 0;
        }

        /* Content wrapper — max-width + centering only, NO padding here.
           Each page adds its own padding so we never double up.
           When building each page, remove that page's inner padding div
           and use className="cy-page-title" on the h1 instead. */
        .cy-page-content {
          max-width: 1880px;
          margin: 0 auto;
          width: 100%;
          box-sizing: border-box;
        }

        /* Page title — apply to h1 on each dashboard page when we build them.
           Desktop: 24px. Mobile: 20px with tighter margin. */
        .cy-page-title {
          font-size: 24px;
          font-weight: 600;
          color: #111827;
          letter-spacing: -0.02em;
          margin: 0 0 20px;
        }

        @media (max-width: 1023px) {
          .cy-mobile-spacer { display: block !important; }
          .cy-page-title    { font-size: 20px; margin-bottom: 14px; }
        }
      `}</style>

      <div style={{
        display: "flex",
        height: "100vh",
        overflow: "hidden",
        background: "#f9fafb",
      }}>
        <CustomerNav
          userEmail={userEmail}
          userName={userName}
          companyName={companyName}
          customerNumber={customerNumber}
          billingVisibility={billingVisibility}
          drawerOpen={drawerOpen}
          onDrawerClose={() => setDrawerOpen(false)}
        />

        <div style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          overflow: "visible",
          minWidth: 0,
          position: "relative",
          zIndex: 1,
        }}>
          <CustomerHeader
            userEmail={userEmail}
            userName={userName}
            companyName={companyName}
            customerNumber={customerNumber}
            drawerOpen={drawerOpen}
            onHamburgerClick={() => setDrawerOpen(v => !v)}
          />

          <div className="cy-mobile-spacer" />

          {/* Scrollable area */}
          <main style={{ flex: 1, overflowY: "auto", position: "relative", zIndex: 0 }}>
            {/* Inner wrapper handles padding + max-width + centering */}
            <div className="cy-page-content">
              {children}
            </div>
          </main>
        </div>
      </div>
    </>
  );
}