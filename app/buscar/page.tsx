import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { requireAppSession } from "@/lib/app-auth";
import { searchOrganization } from "@/lib/organization-repositories";

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const session = await requireAppSession();
  const params = await searchParams;
  const query = (params.q || "").trim();
  const result = await searchOrganization(session.organizationId, query);
  const items = result.ok ? result.data : [];

  return (
    <AppShell>
      <PageHeader eyebrow="Buscar" title={query ? `Resultados para “${query}”` : "Buscar"} description="Encuentra clientes, proveedores, expedientes, presupuestos y compras de tu organización." />

      <section className="card dashboard-table-card">
        {!query ? (
          <div className="empty-state"><h2>Escribe una búsqueda</h2><p>Usa la barra superior para buscar por nombre, email, expediente, destino, proveedor, categoría o servicio.</p></div>
        ) : items.length === 0 ? (
          <div className="empty-state"><h2>No hay resultados</h2><p>No se han encontrado coincidencias para esta búsqueda.</p></div>
        ) : (
          <div className="table-scroll"><table>
            <thead><tr><th>Tipo</th><th>Resultado</th><th>Detalle</th><th></th></tr></thead>
            <tbody>
              {items.map((item, index) => (
                <tr key={`${item.type}-${item.href}-${index}`}>
                  <td><span className="status-pill status-progress">{item.type}</span></td>
                  <td><strong>{item.title}</strong></td>
                  <td>{item.subtitle}</td>
                  <td><Link className="btn secondary" href={item.href}>Abrir</Link></td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
      </section>
    </AppShell>
  );
}
