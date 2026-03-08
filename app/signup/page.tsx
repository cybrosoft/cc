import { prisma } from "@/lib/prisma";
import SignupForm from "./ui/SignupForm";

export default async function SignupPage() {
  const markets = await prisma.market.findMany({
    where: { isActive: true },
    orderBy: [{ name: "asc" }],
    select: { id: true, name: true, key: true },
  });

  return (
    <div className="mx-auto w-full max-w-md p-6">
      <h1 className="text-2xl font-semibold">Sign up</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Create your account and receive a login code by email.
      </p>

      <div className="mt-6">
        <SignupForm markets={markets} />
      </div>
    </div>
  );
}