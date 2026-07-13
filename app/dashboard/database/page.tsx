// app/dashboard/database/page.tsx
import CategoryPageClient from "@/components/customer/CategoryPageClient";

export const metadata = { title: "Database" };

export default function Page() {
  return <CategoryPageClient pageKey="database" title="Database" />;
}
