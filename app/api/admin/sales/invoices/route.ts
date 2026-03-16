// app/api/admin/sales/invoices/route.ts
import { makeListHandler, makeCreateHandler } from "../shared/list-create-handler";
export const GET  = makeListHandler("INVOICE");
export const POST = makeCreateHandler("INVOICE");
