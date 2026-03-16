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
  { id: "send",      label: "Send",       icon: "mail"          },
  { id: "history",   label: "History",    icon: "clock"         },
  { id: "templates", label: "Templates",  icon: "fileText"      },
  { id: "settings",  label: "Settings",   icon: "settings"      },
];

export default function NotificationsAdmin() {
  const [active, setActive] = useState("send");

  return (
    <div>
      {/* Tab bar */}
      <div style={{
        display: "flex", gap: 0, marginBottom: 24,
        borderBottom: "2px solid #e5e7eb",
      }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setActive(t.id)} style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "10px 20px", fontSize: 13,
            fontWeight: active === t.id ? 600 : 400,
            color:  active === t.id ? CLR.primary : CLR.muted,
            background: "none", border: "none",
            borderBottom: active === t.id ? `2px solid ${CLR.primary}` : "2px solid transparent",
            marginBottom: -2, cursor: "pointer", fontFamily: "inherit",
          }}>
            <Icon name={t.icon} size={14} color={active === t.id ? CLR.primary : CLR.muted} />
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {active === "send"      && <SendTab />}
      {active === "history"   && <HistoryTab />}
      {active === "templates" && <TemplatesTab />}
      {active === "settings"  && <SettingsTab />}
    </div>
  );
}
