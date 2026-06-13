import { requireUser } from "@/lib/auth/require-user";
import { StorageClient } from "./StorageClient";

export default async function Page() {
  await requireUser();
  return <StorageClient />;
}
