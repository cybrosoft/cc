// app/dashboard/onboarding/OnboardingServer.tsx
// Server component — reads session to determine market, passes isSaudi to wizard.
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/get-session-user";
import OnboardingPage from "./page";

export default async function OnboardingServer() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  // If onboarding already complete — redirect to dashboard
  const { prisma } = await import("@/lib/prisma");
  const dbUser = await prisma.user.findUnique({
    where:  { id: user.id },
    select: { fullName: true, mobile: true, accountType: true },
  });

  if (dbUser?.fullName && dbUser?.mobile && dbUser?.accountType) {
    redirect("/dashboard");
  }

  const isSaudi = user.market?.key?.toLowerCase() === "saudi";
  return <OnboardingPage isSaudi={isSaudi} />;
}
