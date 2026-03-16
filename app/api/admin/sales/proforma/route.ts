// app/api/admin/sales/proforma/route.ts
import { makeListHandler, makeCreateHandler } from "../shared/list-create-handler";
export const GET  = makeListHandler("PROFORMA");
export const POST = makeCreateHandler("PROFORMA");
