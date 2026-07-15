import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { requireAppSession } from "@/lib/app-auth";
import { listOrganizationSuppliers } from "@/lib/organization-repositories";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { SupplierManager } from "./SupplierManager";

export default async function SuppliersPage() {
  const session = await requireAppSession();
  const db = getSupabaseAdminClient();
  const [supplierResult, purchasesResult, invoicesResult] = await Promise.all([
    listOrganizationSuppliers(session.organizationId),
    db.from("expected_purchases").select("supplier_id,status,expected_amount,approved_cost").eq("organization_id", session.organizationId).not("supplier_id", "is", null).limit(2000),
    db.from("supplier_invoices").select("supplier_id,total_amount,status").eq("organization_id", session.organizationId).not("supplier_id", "is", null).limit(2000),
  ]);
  const suppliers = supplierResult.ok ? supplierResult.data as Array<Record<string, unknown>> : [];
  const purchases = purchasesResult.data || [];
  const invoices = invoicesResult.data || [];
  const enriched = suppliers.map((supplier) => {
    const id = String(supplier.id || "");
    const relatedPurchases = purchases.filter((item) => String(item.supplier_id || "") === id);
    const relatedInvoices = invoices.filter((item) => String(item.supplier_id || "") === id);
    return {
      ...supplier,
      purchase_count: relatedPurchases.length,
      pending_count: relatedPurchases.filter((item) => !["approved", "not_required", "cancelled"].includes(String(item.status))).length,
      expected_total: relatedPurchases.reduce((sum, item) => sum + Number(item.expected_amount || 0), 0),
      approved_total: relatedPurchases.reduce((sum, item) => sum + Number(item.approved_cost || 0), 0),
      invoiced_total: relatedInvoices.reduce((sum, item) => sum + Number(item.total_amount || 0), 0),
    };
  });

  return <AppShell>
    <PageHeader
      eyebrow="Compras / Proveedores"
      title="Directorio de proveedores"
      description="Centraliza cada proveedor y reutilízalo en presupuestos, compras, facturas y análisis de rentabilidad."
      action={<Link className="btn secondary" href="/compras" prefetch={false}>Volver a compras</Link>}
    />
    {supplierResult.ok ? null : <section className="card form-warning"><strong>No se pudieron cargar los proveedores.</strong><p>{supplierResult.error}</p></section>}
    <SupplierManager initialSuppliers={enriched} />
  </AppShell>;
}
