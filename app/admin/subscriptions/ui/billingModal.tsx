// FILE: app/admin/subscriptions/ui/billingModal.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import type { SubRow } from "../subscriptionsTableTypes";
import { Modal } from "./modal";
import { fmtDateInput, isRecord, isoFromDateInput, readBoolean, readString } from "./subscriptionsUtils";

function ReceiptUpload({ onUpload, label }: { onUpload: (file: File) => void; label: string }) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border px-3 py-1.5 text-xs hover:bg-gray-100">
      {label}
      <input
        type="file"
        className="hidden"
        accept="application/pdf,image/png,image/jpeg"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!f) return;
          onUpload(f);
        }}
      />
    </label>
  );
}

type PlanSubOption = {
  id: string; // plan subscription id
  status: string;
  product: { name: string; key: string };
};

function readNestedString(obj: Record<string, unknown>, path: string[]): string | null {
  let cur: unknown = obj;
  for (const k of path) {
    if (!isRecord(cur)) return null;
    cur = cur[k];
  }
  return typeof cur === "string" ? cur : null;
}

export function BillingModal({
  open,
  sub,
  onClose,
  onChanged,
}: {
  open: boolean;
  sub: SubRow | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [paymentDate, setPaymentDate] = useState("");

  const [details, setDetails] = useState("");
  const [note, setNote] = useState("");

  const isAddon = useMemo(() => (sub?.product.type ?? "") === "addon", [sub]);

  const [planSubs, setPlanSubs] = useState<PlanSubOption[]>([]);
  const [selectedPlanSubscriptionId, setSelectedPlanSubscriptionId] = useState<string>("");

  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open || !sub) return;

    setStart(fmtDateInput(sub.currentPeriodStart));
    setEnd(fmtDateInput(sub.currentPeriodEnd));
    setPaymentDate(fmtDateInput(sub.activatedAt));

    setDetails((sub as unknown as { productDetails?: string | null }).productDetails ?? "");
    setNote((sub as unknown as { productNote?: string | null }).productNote ?? "");

    const parentId = (sub as unknown as { parentSubscriptionId?: string | null }).parentSubscriptionId ?? "";
    setSelectedPlanSubscriptionId(parentId);

    setPlanSubs([]);
    setMsg(null);
    setBusy(false);
  }, [open, sub]);

  useEffect(() => {
    if (!open || !sub) return;
    if ((sub.product.type ?? "") !== "addon") return;

    void (async () => {
      try {
        const qs = new URLSearchParams();
        qs.set("customerId", sub.user.id);

        const res = await fetch(`/api/admin/subscriptions/plan-products?${qs.toString()}`, {
          cache: "no-store",
        });

        const raw = (await res.json().catch(() => null)) as unknown;
        if (!res.ok || !isRecord(raw) || readBoolean(raw, "ok") !== true) return;

        const list = raw["subscriptions"];
        if (!Array.isArray(list)) return;

        setPlanSubs(list as PlanSubOption[]);
      } catch {
        // ignore
      }
    })();
  }, [open, sub]);

  async function uploadReceipt(file: File): Promise<void> {
    if (!sub) return;

    const fd = new FormData();
    fd.append("subscriptionId", sub.id);
    fd.append("file", file);

    const res = await fetch("/api/admin/subscriptions/upload-receipt", {
      method: "POST",
      body: fd,
    });

    const raw = (await res.json().catch(() => null)) as unknown;

    if (!res.ok || !isRecord(raw) || readBoolean(raw, "ok") !== true) {
      setMsg("Receipt upload failed");
      return;
    }

    await onChanged();
  }

  async function saveBilling(): Promise<void> {
    if (!sub) return;
    if (busy) return;

    const startIso = isoFromDateInput(start);
    const endIso = isoFromDateInput(end);
    const payIso = isoFromDateInput(paymentDate);

    if (!startIso || !endIso) {
      setMsg("Start and End dates are required.");
      return;
    }

    if (isAddon && !selectedPlanSubscriptionId.trim()) {
      setMsg("Select the plan subscription for this addon.");
      return;
    }

    setBusy(true);
    setMsg(null);

    try {
      const detailsRes = await fetch("/api/admin/subscriptions/update-details", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          subscriptionId: sub.id,
          productDetails: details,
          productNote: note,
          parentSubscriptionId: isAddon ? (selectedPlanSubscriptionId || null) : null,
        }),
      });

      const detailsRaw = (await detailsRes.json().catch(() => null)) as unknown;

      if (!detailsRes.ok || !isRecord(detailsRaw) || readBoolean(detailsRaw, "ok") !== true) {
        const err = detailsRaw && isRecord(detailsRaw) ? readString(detailsRaw, "error") : null;
        setMsg(err ?? "Failed to save details");
        return;
      }

      // ✅ Verify it actually saved
      const savedParent = readNestedString(detailsRaw as Record<string, unknown>, ["updated", "parentSubscriptionId"]);
      if (isAddon && savedParent !== selectedPlanSubscriptionId) {
        setMsg("Addon plan link did not save. Check that the selected value is a PLAN SUBSCRIPTION id.");
        return;
      }

      const res = await fetch("/api/admin/subscriptions/approve-manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          id: sub.id,
          currentPeriodStart: startIso,
          currentPeriodEnd: endIso,
          paymentDate: payIso,
          invoiceNumber: "",
          receiptUrl: "",
          manualPaymentReference: "",
        }),
      });

      const raw = (await res.json().catch(() => null)) as unknown;
      if (!res.ok || !isRecord(raw) || readBoolean(raw, "ok") !== true) {
        const err = raw && isRecord(raw) ? readString(raw, "error") : null;
        setMsg(err ?? "Save failed");
        return;
      }

      await onChanged();
      onClose();
    } finally {
      setBusy(false);
    }
  }

  if (!open || !sub) return null;

  const actionLabel = sub.status === "ACTIVE" ? "Update" : "Approve";

  return (
    <Modal title="Details" onClose={onClose}>
      <div className="space-y-3">
        <div className="rounded-md border bg-gray-50 p-3 text-sm">
          <div className="font-medium">{sub.user.email}</div>
          <div className="text-xs text-gray-600">Subscription: {sub.id}</div>
          <div className="text-xs text-gray-600">
            Market: {sub.market.name} • Product: {sub.product.name}
          </div>
        </div>

        <div className="rounded-md border p-3">
          <div className="mb-2 text-sm font-semibold">1) Billing</div>

          <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
            <div className="space-y-1">
              <label className="text-sm font-medium">Start Date</label>
              <input
                className="w-full rounded-md border px-3 py-2 text-sm"
                type="date"
                value={start}
                onChange={(e) => setStart(e.target.value)}
                disabled={busy}
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">End Date</label>
              <input
                className="w-full rounded-md border px-3 py-2 text-sm"
                type="date"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
                disabled={busy}
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">Payment Date (optional)</label>
              <input
                className="w-full rounded-md border px-3 py-2 text-sm"
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                disabled={busy}
              />
            </div>
          </div>

          <div className="mt-3 rounded-md border p-3 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <ReceiptUpload
                label={sub.receiptUrl ? "Re-upload receipt" : "Upload receipt"}
                onUpload={(file) => void uploadReceipt(file)}
              />
              {sub.receiptUrl ? (
                <>
                  <a className="rounded-md border px-3 py-1.5 text-xs hover:bg-gray-100" href={sub.receiptUrl} target="_blank" rel="noreferrer">
                    View
                  </a>
                  <a className="rounded-md border px-3 py-1.5 text-xs hover:bg-gray-100" href={sub.receiptUrl} target="_blank" rel="noreferrer">
                    Download
                  </a>
                </>
              ) : (
                <span className="text-xs text-gray-500">No receipt uploaded.</span>
              )}
            </div>
          </div>
        </div>

        <div className="rounded-md border p-3">
          <div className="mb-2 text-sm font-semibold">2) Details &amp; Note</div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Details</label>
            <textarea
              className="min-h-[70px] w-full rounded-md border px-3 py-2 text-sm"
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              disabled={busy}
              placeholder="e.g. domain name / extra info"
            />
          </div>

          <div className="mt-3 space-y-1">
            <label className="text-sm font-medium">Note</label>
            <textarea
              className="min-h-[90px] w-full rounded-md border px-3 py-2 text-sm"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              disabled={busy}
              placeholder="Customer-visible note"
            />
          </div>
        </div>

        {isAddon ? (
          <div className="rounded-md border p-3">
            <div className="mb-2 text-sm font-semibold">3) Addon Plan</div>

            <div className="space-y-1">
              <label className="text-sm font-medium">Attach to Plan Subscription</label>
              <select
                className="w-full rounded-md border px-3 py-2 text-sm"
                value={selectedPlanSubscriptionId}
                onChange={(e) => setSelectedPlanSubscriptionId(e.target.value)}
                disabled={busy}
              >
                <option value="">Select plan subscription</option>
                {planSubs.map((ps) => (
                  <option key={ps.id} value={ps.id}>
                    {ps.product.name} ({ps.product.key}) - {ps.id}
                  </option>
                ))}
              </select>

              <div className="text-xs text-gray-500">
                Saves into <span className="font-mono">subscription.parentSubscriptionId</span> (plan subscription id).
              </div>
            </div>
          </div>
        ) : null}

        {msg ? (
          <div className="rounded-md border border-red-200 bg-red-50 p-2 text-sm text-red-700">{msg}</div>
        ) : null}

        <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
          <button className="rounded-md border px-3 py-2 text-sm hover:bg-gray-100" onClick={onClose} disabled={busy}>
            Close
          </button>

          <button
            className="rounded-md border px-3 py-2 text-sm hover:bg-gray-100 disabled:opacity-50"
            onClick={() => void saveBilling()}
            disabled={busy}
          >
            {busy ? "Saving..." : actionLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}