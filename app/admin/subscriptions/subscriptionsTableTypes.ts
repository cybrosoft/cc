// app/admin/subscriptions/subscriptionsTableTypes.ts
export type Market = { id: string; name: string };

export type ProductCategoryMini = { id: string; name: string; key: string } | null;

export type Product = {
  id: string;
  name: string;
  key: string;
  type: string;
  category: ProductCategoryMini;
};

export type UserMini = { id: string; email: string };
export type ServerMini = { id: string; hetznerServerId: string | null; oracleInstanceId?: string | null };

export type SubRow = {
  id: string;
  status: string;
  paymentStatus: string;
  billingPeriod: string;        // chosen at creation: MONTHLY | SIX_MONTHS | YEARLY | ONE_TIME
  createdAt: string;

  activatedAt: string | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;

  receiptUrl: string | null;
  receiptFileName: string | null;
  receiptUploadedAt: string | null;
  invoiceNumber: string | null;
  manualPaymentReference: string | null;

  provisionLocation?: string | null;
  productDetails: string | null;
  productNote: string | null;

  parentSubscriptionId?: string | null;

  user: UserMini;
  product: Product;
  market: Market;

  servers: ServerMini[];
};

export type ListResp = {
  ok: boolean;
  page: number;
  pageSize: number;
  total: number;
  data: SubRow[];
};

export type PaymentStatusFilter = "" | "PAID" | "PENDING";
export type ExpiringFilter = "" | "7" | "14" | "30" | "90";

// ── Create-subscription modal types ──────────────────────────────────────────

export type CustomerOption = {
  id: string;
  email: string;
  marketId: string;
  customerGroupId: string | null;
};

export type PricedProductOption = {
  id: string;
  name: string;
  key: string;
  type: string;                          // "plan" | "addon" | "service" | "product"
  tags: { key: string; name: string }[]; // for location tag matching
  currency: string;
  yearlyPriceCents: number;
  introMonthCents: number | null;
  categoryKey?: string | null;
};

export type LocationOption = {
  id: string;
  code: string;
  name: string;
  family: string | null;
  flag: string | null;
  includeTags: string[];
  excludeTags: string[];
};

export type CreateFormOk = { ok: true; customers: CustomerOption[] };
export type CreateFormErr = { ok: false; error: string };
export type CreateFormResp = CreateFormOk | CreateFormErr;

export type EligibleOk = { ok: true; products: PricedProductOption[] };
export type EligibleErr = { ok: false; error: string };
export type EligibleResp = EligibleOk | EligibleErr;

export type CreateSubOk = { ok: true; subscriptionId: string };
export type CreateSubErr = { ok: false; error: string };
export type CreateSubResp = CreateSubOk | CreateSubErr;

export type VpsGetOk = { ok: true; hetznerServerId: string };
export type VpsGetErr = { ok: false; error: string };
export type VpsGetResp = VpsGetOk | VpsGetErr;

export type VpsPostOk = { ok: true };
export type VpsPostErr = { ok: false; error: string };
export type VpsPostResp = VpsPostOk | VpsPostErr;