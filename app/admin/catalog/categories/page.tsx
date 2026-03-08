// app/admin/catalog/categories/page.tsx
import CategoriesAdmin from "./CategoriesAdmin";

export default function CategoriesPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Categories</h1>
      <CategoriesAdmin />
    </div>
  );
}