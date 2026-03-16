// app/api/admin/sales/quotations/route.ts
import { makeListHandler, makeCreateHandler } from "../shared/list-create-handler";

export const GET  = makeListHandler("QUOTATION");
export const POST = makeCreateHandler("QUOTATION");
