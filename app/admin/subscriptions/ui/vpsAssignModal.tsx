// app/admin/subscriptions/ui/vps-assign-modal.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import type { SubRow, VpsGetResp, VpsPostResp } from "../subscriptionsTableTypes";
import { Modal } from "./modal";
import { isRecord, readBoolean, readString } from "./subscriptionsUtils";

type VpsGetRespExt =
  | { ok: true; hetznerServerId: string; oracleInstanceId: string }
  | { ok: false; error: string };

function parseVpsGetResp(raw: unknown): VpsGetRespExt | null {
  if (!raw || !isRecord(raw)) return null;
  const ok = readBoolean(raw, "ok");
  if (ok === true) {
    const hetznerServerId = readString(raw, "hetznerServerId");
    const oracleInstanceId = readString(raw, "oracleInstanceId");
    if (hetznerServerId === null || oracleInstanceId === null) return null;
    return { ok: true, hetznerServerId, oracleInstanceId };
  }
  if (ok === false) {
    const error = readString(raw, "error") ?? "UNKNOWN_ERROR";
    return { ok: false, error };
  }
  return null;
}

function parseVpsPostResp(raw: unknown): VpsPostResp | null {
  if (!raw || !isRecord(raw)) return null;
  const ok = readBoolean(raw, "ok");
  if (ok === true) return { ok: true };
  if (ok === false) {
    const error = readString(raw, "error") ?? "UNKNOWN_ERROR";
    return { ok: false, error };
  }
  return null;
}

function providerFromCategoryKey(key: string | null | undefined): "HETZNER" | "ORACLE" | "UNKNOWN" {
  if (key === "servers-g") return "HETZNER";
  if (key === "servers-o") return "ORACLE";
  return "UNKNOWN";
}

export function VpsAssignModal({
  open,
  sub,
  onClose,
  onSaved,
}: {
  open: boolean;
  sub: SubRow | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const provider = useMemo(() => providerFromCategoryKey(sub?.product?.category?.key), [sub]);

  const [serverId, setServerId] = useState(""); // hetzner server id OR oracle instance ocid
  const [token, setToken] = useState(""); // hetzner only
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !sub) return;

    // prefill from rows if exists (hetzner only available in SubRow.servers today)
    const existingHetzner = sub.servers.find((x) => x.hetznerServerId)?.hetznerServerId ?? "";
    setServerId(provider === "HETZNER" ? existingHetzner : "");
    setToken(""); // never prefill
    setMsg(null);

    void (async () => {
      try {
        const res = await fetch(`/api/admin/subscriptions/${encodeURIComponent(sub.id)}/vps`, {
          method: "GET",
          cache: "no-store",
        });
        const raw = (await res.json().catch(() => null)) as unknown;
        const parsed = parseVpsGetResp(raw);
        if (!res.ok || !parsed || !parsed.ok) return;

        if (provider === "HETZNER") setServerId(parsed.hetznerServerId ?? "");
        if (provider === "ORACLE") setServerId(parsed.oracleInstanceId ?? "");
      } catch {
        // ignore
      }
    })();
  }, [open, sub, provider]);

  async function save(): Promise<void> {
    if (!sub) return;

    const idVal = serverId.trim();
    const tokenVal = token.trim();

    if (provider === "UNKNOWN") {
      setMsg("This subscription is not a server product.");
      return;
    }

    if (provider === "HETZNER") {
      // only save non-empty fields. Empty means "no change".
      if (!idVal && !tokenVal) {
        setMsg("Please enter Server ID and/or Token to update.");
        return;
      }
    }

    if (provider === "ORACLE") {
      if (!idVal) {
        setMsg("Please enter Oracle Instance OCID to update.");
        return;
      }
    }

    setBusy(true);
    setMsg(null);

    try {
      const body: Record<string, string> = {};

      if (provider === "HETZNER") {
        if (idVal) body["hetznerServerId"] = idVal;
        if (tokenVal) body["hetznerApiToken"] = tokenVal;
      } else {
        body["oracleInstanceId"] = idVal;
      }

      const res = await fetch(`/api/admin/subscriptions/${encodeURIComponent(sub.id)}/vps`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify(body),
      });

      const raw = (await res.json().catch(() => null)) as unknown;
      const parsed = parseVpsPostResp(raw);

      if (!res.ok || !parsed || !parsed.ok) {
        setMsg(parsed && !parsed.ok ? parsed.error : `SAVE_FAILED_${res.status}`);
        return;
      }

      onClose();
      onSaved();
    } catch {
      setMsg("Network error while saving VPS.");
    } finally {
      setBusy(false);
    }
  }

  if (!open || !sub) return null;

  const title =
    provider === "HETZNER" ? "VPS Assignment (Servers-G)" : provider === "ORACLE" ? "VPS Assignment (Servers-O)" : "VPS Assignment";

  return (
    <Modal title={title} onClose={onClose}>
      <div className="space-y-3">
        <div className="rounded-md border bg-gray-50 p-3 text-sm">
          <div className="font-medium">{sub.user.email}</div>
          <div className="text-xs text-gray-600">Subscription: {sub.id}</div>
          <div className="text-xs text-gray-600">
            Market: {sub.market.name} • Product: {sub.product.name}
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">
            {provider === "ORACLE" ? "Oracle Instance OCID" : "Server ID"}
          </label>
          <input
            className="w-full rounded-md border px-3 py-2 text-sm"
            placeholder={provider === "ORACLE" ? "ocid1.instance.oc1...." : "e.g. 12345678"}
            value={serverId}
            onChange={(e) => setServerId(e.target.value)}
            inputMode={provider === "ORACLE" ? "text" : "numeric"}
          />
        </div>

        {provider === "HETZNER" ? (
          <div className="space-y-1">
            <label className="text-sm font-medium">Token</label>
            <input
              className="w-full rounded-md border px-3 py-2 text-sm"
              placeholder="Paste token (won’t be shown again)"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              type="password"
              autoComplete="off"
            />
            <div className="text-xs text-gray-500">Token is never displayed back.</div>
          </div>
        ) : null}

        {msg ? (
          <div className="rounded-md border border-red-200 bg-red-50 p-2 text-sm text-red-700">
            {msg}
          </div>
        ) : null}

        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            className="rounded-md border px-3 py-2 text-sm hover:bg-gray-100"
            onClick={onClose}
            disabled={busy}
          >
            Cancel
          </button>
          <button
            className="rounded-md border px-3 py-2 text-sm hover:bg-gray-100 disabled:opacity-50"
            onClick={() => void save()}
            disabled={busy}
          >
            {busy ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </Modal>
  );
}