export const runtime = "nodejs";

import { NextResponse } from "next/server";
import fs from "node:fs";
import * as common from "oci-common";
import * as core from "oci-core";

function s(v: string | null): string {
  return (v ?? "").trim();
}

export async function GET(req: Request) {
  const url = new URL(req.url);

  const region = s(url.searchParams.get("region"));
  const instanceOcid = s(url.searchParams.get("instanceOcid"));
  const compartmentOcid = s(url.searchParams.get("compartmentOcid"));

  const tenancyId = s(process.env.OCI_TENANCY_OCID ?? null);
  const userId = s(process.env.OCI_USER_OCID ?? null);
  const fingerprint = s(process.env.OCI_FINGERPRINT ?? null);
  const keyPath = s(process.env.OCI_PRIVATE_KEY_PATH ?? null);

  if (!tenancyId || !userId || !fingerprint || !keyPath) {
    return NextResponse.json(
      {
        ok: false,
        error: "Missing env",
        tenancyId: !!tenancyId,
        userId: !!userId,
        fingerprint: !!fingerprint,
        keyPath: !!keyPath,
      },
      { status: 500 }
    );
  }

  if (!region) {
    return NextResponse.json({ ok: false, error: "Missing region" }, { status: 400 });
  }

  if (!instanceOcid) {
    return NextResponse.json({ ok: false, error: "Missing instanceOcid" }, { status: 400 });
  }

  if (!fs.existsSync(keyPath)) {
    return NextResponse.json({ ok: false, error: "Private key file not found", keyPath }, { status: 500 });
  }

  const privateKey = fs.readFileSync(keyPath, "utf8");

  try {
    const provider = new common.SimpleAuthenticationDetailsProvider(
      tenancyId,
      userId,
      fingerprint,
      privateKey,
      null
    );

    const compute = new core.ComputeClient({ authenticationDetailsProvider: provider });
    compute.endpoint = `https://iaas.${region}.oraclecloud.com`;

    const resp = await compute.getInstance({ instanceId: instanceOcid });

    return NextResponse.json({
      ok: true,
      endpoint: compute.endpoint,
      instanceOcid,
      compartmentOcid: compartmentOcid || null,
      lifecycleState: resp.instance.lifecycleState ? String(resp.instance.lifecycleState) : null,
      displayName: resp.instance.displayName ?? null,
      shape: resp.instance.shape ?? null,
      ocpus: typeof resp.instance.shapeConfig?.ocpus === "number" ? resp.instance.shapeConfig.ocpus : null,
      memoryInGBs:
        typeof resp.instance.shapeConfig?.memoryInGBs === "number" ? resp.instance.shapeConfig.memoryInGBs : null,
    });
  } catch (error: unknown) {
    const err = error as { statusCode?: unknown; code?: unknown; message?: unknown; opcRequestId?: unknown; stack?: unknown };

    return NextResponse.json(
      {
        ok: false,
        endpoint: `https://iaas.${region}.oraclecloud.com`,
        instanceOcid,
        statusCode: err?.statusCode ?? null,
        code: err?.code ?? null,
        message: typeof err?.message === "string" ? err.message : String(error),
        opcRequestId: err?.opcRequestId ?? null,
        stack: typeof err?.stack === "string" ? err.stack : null,
      },
      { status: 500 }
    );
  }
}