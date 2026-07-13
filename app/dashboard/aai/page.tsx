// app/dashboard/aai/page.tsx
import CategoryPageClient from "@/components/customer/CategoryPageClient";

export const metadata = { title: "Analytics & AI" };

export default function Page() {
  return <CategoryPageClient pageKey="aai" title="Analytics & AI" />;
}
