import { requireUser } from "@/lib/auth/require-user";
import { EmailClient } from "./EmailClient";

export default async function Page() {
  await requireUser();
  return <EmailClient />;
}
