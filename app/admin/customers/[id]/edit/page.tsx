// app/admin/customers/[id]/edit/page.tsx
"use client";
import { use } from "react";
import CustomerForm from "../../CustomerForm";

export default function EditCustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <CustomerForm mode="edit" customerId={id} />;
}