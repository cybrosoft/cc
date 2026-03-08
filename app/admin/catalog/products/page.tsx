// app/admin/catalog/products/page.tsx
import ProductsAdmin from "./ProductsAdmin";

export default function ProductsPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Products</h1>
      <ProductsAdmin />
    </div>
  );
}