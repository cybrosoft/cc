import { requireUser } from "@/lib/auth/require-user";
import { NetworkClient } from "./NetworkClient";

export default async function Page() {
  await requireUser();
  return <NetworkClient />;
}
