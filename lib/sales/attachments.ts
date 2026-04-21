// lib/sales/attachments.ts
// rfqFileUrl is stored in the DB as a single TEXT column.
// We repurpose it to hold a JSON array of S3 keys (string[]).
// Legacy rows that contain a plain non-JSON string are treated as a single-item array.
// An empty array serializes to null so the column stays clean.

export function parseAttachments(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.filter((k): k is string => typeof k === "string");
    // Parsed but not an array — treat as single key
    return [raw];
  } catch {
    // Not JSON — legacy plain string
    return [raw];
  }
}

export function serializeAttachments(keys: string[]): string | null {
  if (!keys.length) return null;
  return JSON.stringify(keys);
}
