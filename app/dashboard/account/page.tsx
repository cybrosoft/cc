// app/dashboard/account/page.tsx

import { requireUser } from "@/lib/auth/require-user";
import AccountClient from "./AccountClient";

export const metadata = { title: "My Account" };

export default async function AccountPage() {
  // Server-side guard — redirects to login if not authenticated
  await requireUser();

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">My Account</h1>
        <p className="text-sm text-gray-500 mt-1">
          Manage your personal and business information
        </p>
      </div>
      <AccountClient />
    </div>
  );
}
