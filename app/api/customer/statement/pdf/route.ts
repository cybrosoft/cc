// app/api/customer/statement/pdf/route.ts
export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/get-session-user";
import { createHmac } from "crypto";

function generateStatementToken(userId: string, from: string, to: string): string {
  const secret  = process.env.PRINT_TOKEN_SECRET ?? "fallback-secret";
  return createHmac("sha256", secret).update(`${userId}:${from}:${to}`).digest("hex");
}

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const from = searchParams.get("from") ?? "";
    const to   = searchParams.get("to")   ?? "";

    const token    = generateStatementToken(user.id, from, to);
    const baseUrl  = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
    const params   = new URLSearchParams({ token, userId: user.id, from, to });
    const printUrl = `${baseUrl}/print/statement?${params.toString()}`;

    const puppeteer = await import("puppeteer");
    const browser   = await puppeteer.default.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu", "--disable-web-security"],
    });

    let pdf: Buffer;
    try {
      const page = await browser.newPage();
      await page.goto(printUrl, { waitUntil: "networkidle0", timeout: 30000 });
      await page.waitForSelector("#statement-table", { timeout: 10000 });
      await new Promise(r => setTimeout(r, 500));

      pdf = Buffer.from(await page.pdf({
        format:          "A4",
        printBackground: true,
        margin:          { top: "0mm", bottom: "10mm", left: "0mm", right: "0mm" },
        displayHeaderFooter: true,
        headerTemplate: `<span></span>`,
        footerTemplate: `
          <div style="width:100%;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#555;
            text-align:center;box-sizing:border-box;">
            Page <span class="pageNumber"></span> of <span class="totalPages"></span>
          </div>`,
        scale: 1,
      }));
    } finally {
      await browser.close();
    }

    const label = from && to ? `Statement_${from}_${to}` : from ? `Statement_from_${from}` : "Statement";

    return new NextResponse(pdf, {
      status: 200,
      headers: {
        "Content-Type":        "application/pdf",
        "Content-Disposition": `attachment; filename="${label}.pdf"`,
        "Content-Length":      String(pdf.length),
      },
    });
  } catch (e: any) {
    console.error("[statement/pdf]", e);
    return NextResponse.json({ error: e.message ?? "PDF generation failed" }, { status: 500 });
  }
}
