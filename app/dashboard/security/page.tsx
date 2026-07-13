// app/dashboard/security/page.tsx
import CategoryPageClient from "@/components/customer/CategoryPageClient";

export const metadata = { title: "Security" };

export default function Page() {
  return <CategoryPageClient pageKey="security" title="Security" />;
}
