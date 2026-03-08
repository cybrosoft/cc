// app/admin/catalog/pricing/page.tsx
import PricingAdmin from "./PricingAdmin";

export default function PricingPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Pricing</h1>
      <PricingAdmin />
    </div>
  );
}