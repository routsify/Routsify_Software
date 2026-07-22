import { notFound } from "next/navigation";
import { Logo } from "@/components/Logo";
import { resolvePublicProposal } from "@/lib/proposal-public-server";
import { AcceptProposalBox } from "./AcceptProposalBox";
import { loadAppTheme } from "@/lib/app-theme-server";

export default async function PublicProposalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const resolved = await resolvePublicProposal(token);
  if (!resolved.ok) notFound();
  const { proposal } = resolved;
  const brand = await loadAppTheme(resolved.organizationId);

  return (
    <div className="proposal-hero">
      <div className="proposal-wrap">
        <section className="hero-panel">
          <div>
            <Logo size={112} src={brand.logoUrl} alt={`Logo de ${brand.companyName}`} />
            <div className="eyebrow" style={{ marginTop: 24 }}>Propuesta privada para {proposal.client}</div>
            <h1>{proposal.title}</h1>
            <p style={{ fontSize: 20 }}>{proposal.headline}</p>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 24 }}><span className="badge">{proposal.destination}</span><span className="badge">{proposal.dates}</span><span className="badge">{proposal.travelers}</span></div>
            <p style={{ marginTop: 12 }}><small>Acceso privado validado · propuesta preparada por {brand.companyName}</small></p>
          </div>
          <div className="card"><AcceptProposalBox total={proposal.total} token={token} initialAccepted={resolved.accepted} clientName={proposal.client} clientEmail={proposal.clientEmail || ""} /></div>
        </section>

        {(proposal.highlights.length > 0 || proposal.itinerary.length > 0) ? <section className="grid grid-2" style={{ marginTop: 28 }}>
          <div className="card"><div className="eyebrow">Resumen</div><h2>Lo más importante</h2>{proposal.highlights.length ? proposal.highlights.map((item) => <p key={item}>✓ {item}</p>) : <p>Los detalles principales están incluidos en los servicios de la propuesta.</p>}</div>
          <div className="card"><div className="eyebrow">Itinerario</div>{proposal.itinerary.length ? <div className="timeline">{proposal.itinerary.map(([place, text]) => <div key={`${place}-${text}`}><strong>{place}</strong><p>{text}</p></div>)}</div> : <p>El itinerario detallado se concretará durante la coordinación del viaje.</p>}</div>
        </section> : null}

        <section className="card" style={{ marginTop: 28 }}>
          <div className="eyebrow">Servicios incluidos</div>
          <h2>Detalle económico</h2>
          <div className="table-scroll"><table><thead><tr><th>Servicio</th><th>Detalle</th><th>Precio</th></tr></thead><tbody>{proposal.lines.map(([name, text, price], index) => <tr key={`${name}-${index}`}><td><strong>{name}</strong></td><td>{text}</td><td>{Number(price).toLocaleString("es-ES", { style: "currency", currency: "EUR" })}</td></tr>)}</tbody><tfoot><tr><th colSpan={2}>Total</th><th>{proposal.total.toLocaleString("es-ES", { style: "currency", currency: "EUR" })}</th></tr></tfoot></table></div>
        </section>

        <section className="card" style={{ marginTop: 28 }}><div className="eyebrow">Condiciones</div><h2>Aceptación y siguientes pasos</h2><p>{proposal.terms}</p></section>
      </div>
    </div>
  );
}
