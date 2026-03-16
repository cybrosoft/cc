// app/admin/system/settings/SettingsClient.tsx
"use client";
import React, { useState } from "react";
import { CLR } from "@/components/ui/admin-ui";
import { Icon } from "@/components/ui/Icon";
import CompanyProfilesTab from "./tabs/CompanyProfilesTab";
import PortalSettingsTab  from "./tabs/PortalSettingsTab";
import NumberSeriesTab    from "./tabs/NumberSeriesTab";
import TagBehavioursTab   from "./tabs/TagBehavioursTab";

const TABS = [
  { id: "company",      label: "Company Profiles", icon: "building"     },
  { id: "portal",       label: "Portal Settings",  icon: "globe"        },
  { id: "numberseries", label: "Number Series",    icon: "numberseries" },
  { id: "tagbehaviour", label: "Tag Behaviours",   icon: "tag"          },
];

export default function SettingsClient() {
  const [active, setActive] = useState("company");

  return (
    <div style={{ display: "flex", gap: 0, alignItems: "flex-start" }}>

      {/* Vertical sidebar */}
      <div style={{
        width: 200, flexShrink: 0,
        border: "1px solid #e5e7eb", background: "#fff",
        marginRight: 20,
      }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setActive(t.id)} style={{
            display: "flex", alignItems: "center", gap: 10,
            width: "100%", padding: "12px 16px",
            background: active === t.id ? CLR.primaryBg : "none",
            borderLeft: active === t.id ? `3px solid ${CLR.primary}` : "3px solid transparent",
            border: "none",
            borderBottom: "1px solid #f3f4f6",
            cursor: "pointer", fontFamily: "inherit",
            fontSize: 13, fontWeight: active === t.id ? 600 : 400,
            color: active === t.id ? CLR.primary : CLR.text,
            textAlign: "left" as const,
          }}>
            <Icon name={t.icon} size={15} color={active === t.id ? CLR.primary : CLR.muted} />
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {active === "company"      && <CompanyProfilesTab />}
        {active === "portal"       && <PortalSettingsTab />}
        {active === "numberseries" && <NumberSeriesTab />}
        {active === "tagbehaviour" && <TagBehavioursTab />}
      </div>
    </div>
  );
}