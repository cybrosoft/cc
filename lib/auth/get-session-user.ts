// FILE: lib/auth/get-session-user.ts
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export type SessionUser = Prisma.UserGetPayload<{
  select: {
    id: true;
    email: true;
    role: true;
    status: true;
    marketId: true;
    customerGroupId: true;
    customerNumber: true;
    totpEnabled: true;
    createdAt: true;
    market: true;
    customerGroup: true;
  };
}>;

function normalizeSid(raw: string): string {
  const v = raw.trim();
  if (!v) return "";
  if (v.startsWith('"') && v.endsWith('"') && v.length >= 2) return v.slice(1, -1);
  return v;
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const sidRaw = cookieStore.get("sid")?.value ?? "";
  const sid = normalizeSid(sidRaw);
  if (!sid) return null;

  const session = await prisma.session.findUnique({
    where: { id: sid },
    select: {
      expiresAt: true,
      user: {
        select: {
          id: true,
          email: true,
          role: true,
          status: true,
          marketId: true,
          customerGroupId: true,
          customerNumber: true,
          totpEnabled: true,
          createdAt: true,
          market: true,
          customerGroup: true,
        },
      },
    },
  });

  if (!session) return null;
  if (session.expiresAt.getTime() <= Date.now()) return null;

  return session.user;
}
