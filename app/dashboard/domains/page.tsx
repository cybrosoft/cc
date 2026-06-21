import { requireUser } from "@/lib/auth/require-user";
import { DomainsClient } from "./DomainsClient";

export default async function Page() {
  await requireUser();
  return <DomainsClient />;
}
