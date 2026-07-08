import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { expectedPurchases } from "@/lib/mock-data";

export default function PurchasesPage() {
  const totalPending = expectedPurchases.reduce((sum, item) => sum + item.amount, 0);

  return (
    <AppShell>
      <PageHeader
        eyebrow="Compras y proveedores"
        title="Facturas proveedor pendientes"
        description="Pantalla base para saber qué facturas deberían existir por expediente, cuál es su estado y qué bloquea el cierre operativo. En el MVP gratuito la subida será manual, sin OCR."
        action={<button className="btn">Subir factura</button>}
      />
      <section className="grid grid-3">
        <div className="card"><span className="badge">Compras esperadas</span><div className="metric">{expectedPurchases.length}</div><p>Líneas de presupuesto que generan factura proveedor.</p></div>
        <div className="card"><span className="badge">Importe previsto</span><div className="metric">{totalPending.toLocaleString("es-ES")} €</div><p>Coste presupuestado pendiente de conciliar.</p></div>
        <div className="card"><span className="badge">Modo MVP</span><div className="metric">Manual</div><p>Subida PDF/JPG/PNG y revisión humana.</p></div>
      </section>
      <section className="card" style={{ marginTop: 18 }}>
        <table>
          <thead><tr><th>Expediente</th><th>Proveedor</th><th>Servicio</th><th>Estado</th><th>Importe previsto</th><th>Acción</th></tr></thead>
          <tbody>
            {expectedPurchases.map((item) => (
              <tr key={`${item.case_code}-${item.supplier}`}>
                <td><strong>{item.case_code}</strong></td>
                <td>{item.supplier}</td>
                <td>{item.service}</td>
                <td><span className="badge">{item.status}</span></td>
                <td>{item.amount.toLocaleString("es-ES")} €</td>
                <td><button className="btn secondary">Revisar</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </AppShell>
  );
}
