import { notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { requireAppPermission } from "@/lib/app-auth";
import { getOrganizationSupplier360 } from "@/lib/supplier-360-server";
import { Supplier360Workspace } from "./Supplier360Workspace";
import "./supplier-360.css";

export default async function Supplier360Page({ params }: { params: Promise<{ supplierId: string }> }) {
  const session = await requireAppPermission("suppliers.view");
  const { supplierId } = await params;
  const result = await getOrganizationSupplier360(session.organizationId, supplierId);
  if (!result.ok) {
    if (result.error === "supplier_not_found") notFound();
    throw new Error(result.error);
  }

  const supplierName = String(result.data.supplier.name || "Proveedor");
  const category = String(result.data.supplier.category || "Ficha operativa interna");

  return <AppShell>
    <PageHeader
      eyebrow="Proveedor 360"
      title={supplierName}
      description={`${category}. Control interno de servicios, tarifas, fiabilidad, incidencias, compras, facturas y comunicaciones.`}
    />
    <Supplier360Workspace initialData={result.data} />
  </AppShell>;
}
