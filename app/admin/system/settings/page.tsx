// app/admin/system/settings/page.tsx
import { PageShell } from "@/components/ui/admin-ui";
import SettingsClient from "./SettingsClient";

export default function SettingsPage() {
  return (
    <PageShell breadcrumb="ADMIN / SYSTEM / SETTINGS" title="Administrator Settings">
      <SettingsClient />
    </PageShell>
  );
}
