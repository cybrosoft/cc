// app/api/admin/sales/returns/route.ts
import { makeListHandler, makeCreateHandler } from "../shared/list-create-handler";
export const GET  = makeListHandler("CREDIT_NOTE");
export const POST = makeCreateHandler("CREDIT_NOTE");
