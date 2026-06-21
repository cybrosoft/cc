import { requireUser } from "@/lib/auth/require-user";
import { AaiClient } from "./AaiClient";

export default async function Page() {
  await requireUser();
  return <AaiClient />;
}
