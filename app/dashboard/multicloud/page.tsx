import { requireUser } from "@/lib/auth/require-user";
import { MultiCloudClient } from "./MultiCloudClient";

export default async function Page() {
  await requireUser();
  return <MultiCloudClient />;
}
