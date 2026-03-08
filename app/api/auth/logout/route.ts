import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const cookieStore = await cookies();
  const sid = cookieStore.get("sid")?.value;

  // Best-effort: delete session from DB
  if (sid) {
    try {
      await prisma.session.delete({ where: { id: sid } });
    } catch {
      // ignore if already deleted / not found
    }
  }

  // Clear cookie and redirect to login
  const res = NextResponse.redirect(new URL("/login", req.url));
  res.cookies.set("sid", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: new Date(0),
  });

  return res;
}