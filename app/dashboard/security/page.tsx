import { requireUser } from "@/lib/auth/require-user";
import { SecurityClient } from "./SecurityClient";

export default async function Page() {
  await requireUser();
  return <SecurityClient />;
}
