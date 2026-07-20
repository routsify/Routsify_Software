import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { requireAppPermission } from "@/lib/app-auth";
import { listOrganizationSuppliersPage } from "@/lib/organization-repositories";
import { SupplierManager } from "./SupplierManager";

export default async function SuppliersPage({ searchParams }: { searchParams: Promise<{ supplierId?: string }> }) {
  const session = await requireAppPermission("suppliers.view");
  const [{ supplierId }, supplierResult] = await Promise.all([
    searchParams,
    listOrganizationSuppliersPage(session.organizationId, { page: 1, pageSize: 50, status: "active" }),
  ]);
  const initialPage = supplierResult.ok ? supplierResult.data : {
    items: [],
    total: 0,
    page: 1,
    pageSize: 50,
    totalPages: 1,
    query: "",
    status: "active" as const,
    stats: { total: 0, active: 0, linkedToHolded: 0, fiscalComplete: 0, pendingPurchases: 0, expectedTotal: 0, approvedTotal: 0, invoicedTotal: 0 },
  };

  return <AppShell>
    <PageHeader
      eyebrow="Proveedores"
      title="Directorio de proveedores"
      description="Consulta, busca, importa y administra proveedores mediante un listado paginado. Revisa contacto, fiscalidad, compras, facturas, desviaciones y vinculación con Holded."
      action={<Link className="btn secondary" href="/compras" prefetch={false}>Ir a compras</Link>}
    />
    {supplierResult.ok ? null : <section className="card form-warning"><strong>No se pudieron cargar los proveedores.</strong><p>{supplierResult.error}</p></section>}
    <SupplierManager initialPage={initialPage} initialSupplierId={supplierId || ""} />
  </AppShell>;
}
