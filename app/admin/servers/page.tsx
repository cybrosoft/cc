// app/admin/servers/page.tsx
import ServersTable from "./serversTable";

export default function AdminServersPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">D-Servers</h1>
      <ServersTable />
    </div>
  );
}