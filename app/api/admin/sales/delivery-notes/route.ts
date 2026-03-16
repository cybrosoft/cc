// app/api/admin/sales/delivery-notes/route.ts
import { makeListHandler, makeCreateHandler } from "../shared/list-create-handler";
export const GET  = makeListHandler("DELIVERY_NOTE");
export const POST = makeCreateHandler("DELIVERY_NOTE");
