// cc/lib/oracle/client.ts
import * as common from "oci-common";
import fs from "node:fs";

function mustEnv(name: string): string {
  const v = process.env[name];
  if (!v || !v.trim()) {
    throw new Error(`Missing env: ${name}`);
  }
  return v.trim();
}

export function getOracleProvider(): common.SimpleAuthenticationDetailsProvider {
  const tenancyId = mustEnv("OCI_TENANCY_OCID");
  const userId = mustEnv("OCI_USER_OCID");
  const fingerprint = mustEnv("OCI_FINGERPRINT");

  const keyPath = mustEnv("OCI_PRIVATE_KEY_PATH");
  if (!fs.existsSync(keyPath)) {
    throw new Error(`Private key file not found: ${keyPath}`);
  }

  const privateKeyPem = fs.readFileSync(keyPath, "utf8");

  return new common.SimpleAuthenticationDetailsProvider(
    tenancyId,
    userId,
    fingerprint,
    privateKeyPem
  );
}