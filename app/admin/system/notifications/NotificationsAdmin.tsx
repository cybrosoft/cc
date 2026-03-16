// app/admin/system/notifications/NotificationsAdmin.tsx
"use client";
import React, { useState } from "react";
import { CLR } from "@/components/ui/admin-ui";
import { Icon } from "@/components/ui/Icon";
import SendTab      from "./tabs/SendTab";
import HistoryTab   from "./tabs/HistoryTab";
import TemplatesTab from "./tabs/TemplatesTab";
import SettingsTab  from "./tabs/SettingsTab";

const TABS = [
  { id: "send",      label: "Send",      icon: "mail"     },
  { id: "history",   label: "History",   icon: "clock"    },
  { id: "templates", label: "Templates", icon: "fileText" },
  { id: "settings",  label: "Settings",  icon: "settings" },
];

export default function NotificationsAdmin() {
  const [active, setActive] = useState("send");

  return (
    <div style={{ display: "flex", gap: 0, alignItems: "flex-start" }}>

      {/* Vertical sidebar — same pattern as SettingsClient */}
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
        {active === "send"      && <SendTab />}
        {active === "history"   && <HistoryTab />}
        {active === "templates" && <TemplatesTab />}
        {active === "settings"  && <SettingsTab />}
      </div>
    </div>
  );
}