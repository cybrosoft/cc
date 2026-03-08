// FILE: app/admin/subscriptions/subscriptionsTableTypes.ts
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
export type ServerMini = { id: string; hetznerServerId: string | null };

export type SubRow = {
  id: string;
  status: string;

  paymentStatus: string;
  billingProvider: string;
  createdAt: string;

  activatedAt: string | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;

  receiptUrl: string | null;

  provisionLocation?: string | null;

  // ✅ NEW: customer-visible details stored on subscription
  productDetails: string | null;
  productNote: string | null;

  // ✅ NEW: only meaningful when product.type === "addon"
  // ✅ changed
  addonPlanSubscriptionId: string | null;

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

// ✅ Create-subscription modal types
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
  currency: string;
  yearlyPriceCents: number;
  introMonthCents: number | null;

  categoryKey?: string | null;
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