// app/api/admin/sales/po/route.ts
import { makeListHandler, makeCreateHandler } from "../shared/list-create-handler";
export const GET  = makeListHandler("PO");
export const POST = makeCreateHandler("PO");
