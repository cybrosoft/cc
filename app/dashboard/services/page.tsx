import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/require-user";
import { ComingSoonPage } from "@/components/ui/ComingSoonPage";

export default async function Page() {
  await requireUser();
  return <ComingSoonPage title="Other Services" description="Browse all available services or submit an RFQ for a custom quote." rfqLink="/dashboard/rfq" />;
}
