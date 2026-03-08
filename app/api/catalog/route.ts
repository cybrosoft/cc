// app/api/catalog/route.ts
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/get-session-user";
import { resolveCatalogForUser } from "@/lib/billing/resolve-pricing";

// ─── GET /api/catalog ─────────────────────────────────────────────────────────
//
// Query params:
//   currency   – override currency (optional)
//   tag        – filter by tag key, repeatable: ?tag=windows&tag=linux  (OR logic)
//   category   – filter by category key, e.g. ?category=cloud-servers
//   type       – filter by product type: plan | addon | service | product
//
// Examples:
//   /api/catalog
//   /api/catalog?tag=windows
//   /api/catalog?tag=windows&tag=linux
//   /api/catalog?tag=linux&category=cloud-servers
//   /api/catalog?category=cloud-servers&type=plan

export async function GET(req: Request) {
  const user = await getSessionUser();

  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const url      = new URL(req.url);
  const currency = url.searchParams.get("currency")  ?? undefined;
  const category = url.searchParams.get("category")  ?? undefined;
  const type     = url.searchParams.get("type")      ?? undefined;

  // ?tag= is repeatable — collect all values
  const tags = url.searchParams.getAll("tag").filter(Boolean);

  try {
    const data = await resolveCatalogForUser({
      userId: user.id,
      currency,
      // Pass filters through — resolveCatalogForUser must support these
      filters: {
        tags:     tags.length > 0 ? tags : undefined,
        category: category         ?? undefined,
        type:     type             ?? undefined,
      },
    });

    return NextResponse.json({ ok: true, data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "catalog_error";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}