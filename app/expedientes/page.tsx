import { PageHeader } from "@/components/PageHeader";
import { cases, expectedPurchases } from "@/lib/mock-data";

export default function CasesPage() {
  return (
    <>
      <PageHeader eyebrow="Operación de viajes" title="Expedientes" description="Estado, próxima acción, bloqueo, cliente, fechas, destino y compras proveedor pendientes." action={<button className="btn">Nuevo expediente</button>} />
      <section className="card">
        <table>
          <thead><tr><th>Código</th><th>Cliente</th><th>Estado</th><th>Destino</th><th>Próxima acción</th><th>Bloqueo</th></tr></thead>
          <tbody>{cases.map((item) => <tr key={item.case_code}><td><strong>{item.case_code}</strong></td><td>{item.client}</td><td><span className="badge">{item.status}</span></td><td>{item.destination}<br/><small>{item.trip_start} → {item.trip_end}</small></td><td>{item.next_action}</td><td>{item.blocker || "—"}</td></tr>)}</tbody>
        </table>
      </section>
      <section className="card" style={{ marginTop: 18 }}>
        <div className="eyebrow">Compras esperadas</div>
        <table>
          <thead><tr><th>Expediente</th><th>Proveedor</th><th>Servicio</th><th>Estado</th><th>Importe previsto</th></tr></thead>
          <tbody>{expectedPurchases.map((item) => <tr key={`${item.case_code}-${item.supplier}`}><td>{item.case_code}</td><td>{item.supplier}</td><td>{item.service}</td><td><span className="badge">{item.status}</span></td><td>{item.amount.toLocaleString("es-ES")} €</td></tr>)}</tbody>
        </table>
      </section>
    </>
  );
}
