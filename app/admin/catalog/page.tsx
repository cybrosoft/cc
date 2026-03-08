// app/admin/catalog/page.tsx
import Link from "next/link";

export default function AdminCatalogHome() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Catalog</h1>

      <div className="grid gap-3 md:grid-cols-3">
        <Link className="rounded-lg border bg-white p-4 hover:bg-gray-50" href="/admin/catalog/categories">
          <div className="font-medium">Categories</div>
          <div className="text-sm text-gray-600">Create & enable/disable categories</div>
        </Link>

        <Link className="rounded-lg border bg-white p-4 hover:bg-gray-50" href="/admin/catalog/tags">
          <div className="font-medium">Tags</div>
          <div className="text-sm text-gray-600">Create & manage tags</div>
        </Link>

        <Link className="rounded-lg border bg-white p-4 hover:bg-gray-50" href="/admin/catalog/templates">
          <div className="font-medium">Templates</div>
          <div className="text-sm text-gray-600">Create & manage OS & Applications templates</div>
        </Link>

        <Link className="rounded-lg border bg-white p-4 hover:bg-gray-50" href="/admin/catalog/locations">
          <div className="font-medium">Locations</div>
          <div className="text-sm text-gray-600">Create & manage locations</div>
        </Link>

        <Link className="rounded-lg border bg-white p-4 hover:bg-gray-50" href="/admin/catalog/products">
          <div className="font-medium">Products</div>
          <div className="text-sm text-gray-600">Create plans/addons, Zoho plan id</div>
        </Link>

        <Link className="rounded-lg border bg-white p-4 hover:bg-gray-50" href="/admin/catalog/pricing">
          <div className="font-medium">Pricing</div>
          <div className="text-sm text-gray-600">Set prices per market & customer group</div>
        </Link>
      </div>
    </div>
  );
}