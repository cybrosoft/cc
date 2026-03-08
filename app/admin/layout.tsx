// app/admin/layout.tsx
import type { ReactNode } from "react";
import Link from "next/link";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-lg font-semibold">
              <img 
                src="https://cybrosoft.com/img/logo.png"
                alt="Cybrosoft Logo"
                className="h-8 w-auto object-contain"
              />
              <span className="text-sm">Console Admin</span>
            </div>
            <nav className="flex items-center gap-3 text-sm">
              <Link className="hover:underline" href="/admin">
                Dashboard
              </Link>
              <Link className="hover:underline" href="/admin/subscriptions">
                Subscriptions
              </Link>
              <Link className="hover:underline" href="/admin/servers">
                Servers
              </Link>
              <Link className="hover:underline" href="/admin/catalog">
                Catalog
              </Link>
              
              <Link className="hover:underline" href="/admin/customers">
                Customers
              </Link>
            </nav>
          </div>

          <Link
            href="/"
            className="rounded-md border px-3 py-1.5 text-sm hover:bg-gray-100"
          >
            Back to site
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}