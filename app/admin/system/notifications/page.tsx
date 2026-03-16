// app/admin/system/notifications/page.tsx
import { PageShell } from "@/components/ui/admin-ui";
import NotificationsAdmin from "./NotificationsAdmin";

export default function NotificationsPage() {
  return (
    <PageShell breadcrumb="ADMIN / SYSTEM / NOTIFICATIONS" title="Notifications">
      <NotificationsAdmin />
    </PageShell>
  );
}
