import { requireUser } from "@/lib/auth/require-user";
import { DatabaseClient } from "./DatabaseClient";

export default async function Page() {
  await requireUser();
  return <DatabaseClient />;
}
