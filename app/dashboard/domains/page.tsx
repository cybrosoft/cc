// app/dashboard/domains/page.tsx
import CategoryPageClient from "@/components/customer/CategoryPageClient";

export const metadata = { title: "Domain & DNS" };

export default function Page() {
  return <CategoryPageClient pageKey="domains" title="Domain & DNS" />;
}
