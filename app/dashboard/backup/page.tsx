import { requireUser } from "@/lib/auth/require-user";
import { BackupClient } from "./BackupClient";

export default async function Page() {
  await requireUser();
  return <BackupClient />;
}
