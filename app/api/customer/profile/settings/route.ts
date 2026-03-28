// app/api/customer/profile/settings/route.ts
// GET  — return current user's notification preferences, timezone, DND
// PUT  — update marketingPrefs, timezone, dndStart, dndEnd

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/get-session-user";
import { prisma } from "@/lib/prisma";

export async function GET(_req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const profile = await prisma.user.findUnique({
    where:  { id: user.id },
    select: { notifPrefs: true, timezone: true, dndStart: true, dndEnd: true },
  });

  if (!profile) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });

  // notifPrefs stores all prefs as JSON — extract marketing keys for the UI
  const allPrefs    = (profile.notifPrefs ?? {}) as Record<string, unknown>;
  const marketingPrefs: Record<string, boolean> = {
    "marketing.inapp":  allPrefs["marketing.inapp"]  !== false,
    "marketing.email":  allPrefs["marketing.email"]  !== false,
    "marketing.sms":    allPrefs["marketing.sms"]    !== false,
  };

  return NextResponse.json({
    ok:             true,
    marketingPrefs,
    timezone:       profile.timezone ?? "Asia/Riyadh",
    dndStart:       profile.dndStart ?? null,
    dndEnd:         profile.dndEnd   ?? null,
  });
}

export async function PUT(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  let body: {
    prefs?:    Record<string, boolean>;
    timezone?: string;
    dndStart?: number | null;
    dndEnd?:   number | null;
  } = {};

  try { body = await req.json(); } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  // Fetch existing prefs so we only overwrite marketing keys, not the whole object
  const existing = await prisma.user.findUnique({
    where:  { id: user.id },
    select: { notifPrefs: true },
  });

  const existingPrefs = (existing?.notifPrefs ?? {}) as Record<string, unknown>;

  // Merge incoming marketing prefs into the existing notifPrefs JSON
  const updatedPrefs: Record<string, unknown> = {
    ...existingPrefs,
    ...(body.prefs ?? {}),
  };

  // Validate DND hours (0–23 or null)
  const dndStart = body.dndStart != null ? Math.max(0, Math.min(23, Number(body.dndStart))) : null;
  const dndEnd   = body.dndEnd   != null ? Math.max(0, Math.min(23, Number(body.dndEnd)))   : null;

  // Validate timezone — basic check
  const timezone = typeof body.timezone === "string" && body.timezone.includes("/")
    ? body.timezone
    : "Asia/Riyadh";

  await prisma.user.update({
    where: { id: user.id },
    data: {
      notifPrefs: updatedPrefs,
      timezone,
      dndStart,
      dndEnd,
    },
  });

  return NextResponse.json({ ok: true });
}
