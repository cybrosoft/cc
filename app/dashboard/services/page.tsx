// app/dashboard/services/page.tsx
import CategoryPageClient from "@/components/customer/CategoryPageClient";

export const metadata = { title: "Other Services" };

export default function Page() {
  return <CategoryPageClient pageKey="services" title="Other Services" />;
}
