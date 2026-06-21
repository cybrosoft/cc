import { requireUser } from "@/lib/auth/require-user";
import { GpuClient } from "./GpuClient";

export default async function Page() {
  await requireUser();
  return <GpuClient />;
}
