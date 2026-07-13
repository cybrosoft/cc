// app/dashboard/network/page.tsx
import { NetworkClient } from "./NetworkClient";

export const metadata = { title: "Network & Public IP" };

export default function Page() {
  return <NetworkClient />;
}
