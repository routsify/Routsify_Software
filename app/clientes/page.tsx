import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { clients } from "@/lib/mock-data";

const fields = ["display_name","client_type","first_name","last_name","company_name","email","email_normalized","phone","phone_normalized","tax_id","billing_address","country","language","source","holded_contact_id","notes"];

export default function ClientsPage() {
  return (
    <AppShell>
      <PageHeader eyebrow="CRM operativo" title="Clientes" description="Vista completa de campos de cliente según el modelo MVP: fiscal/comercial, deduplicación por email/teléfono y referencia Holded." action={<button className="btn">Nuevo cliente</button>} />
      <div className="grid">
        {clients.map((client) => (
          <article className="card" key={client.id}>
            <div className="header" style={{ marginBottom: 8 }}>
              <div><span className="badge">{client.source}</span><h2>{client.display_name}</h2></div>
              <a className="btn secondary" href="/expedientes">Ver expedientes</a>
            </div>
            <table><tbody>{fields.map((field) => <tr key={field}><th>{field}</th><td>{String((client as Record<string, unknown>)[field] ?? "")}</td></tr>)}</tbody></table>
          </article>
        ))}
      </div>
    </AppShell>
  );
}
