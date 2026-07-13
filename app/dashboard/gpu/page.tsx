// app/dashboard/gpu/page.tsx
import CategoryPageClient from "@/components/customer/CategoryPageClient";

export const metadata = { title: "GPU Instances" };

export default function Page() {
  return <CategoryPageClient pageKey="gpu" title="GPU Instances" />;
}
