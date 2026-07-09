import { notFound } from "next/navigation";
import { Logo } from "@/components/Logo";
import { resolvePublicProposal } from "@/lib/proposal-public-server";
import { AcceptProposalBox } from "./AcceptProposalBox";

export default async function PublicProposalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const resolved = resolvePublicProposal(token);
  if (!resolved.ok) notFound();
  const { proposal } = resolved;

  return (
    <div className="proposal-hero">
      <div className="proposal-wrap">
        <section className="hero-panel">
          <div>
            <Logo size={112} />
            <div className="eyebrow" style={{ marginTop: 24 }}>Propuesta privada para {proposal.client}</div>
            <h1>{proposal.title}</h1>
            <p style={{ fontSize: 20 }}>{proposal.headline}</p>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 24 }}>
              <span className="badge">{proposal.destination}</span><span className="badge">{proposal.dates}</span><span className="badge">{proposal.travelers}</span>
            </div>
            <p style={{ marginTop: 12 }}><small>Acceso validado · versión {resolved.versionId} · token hash {resolved.tokenHash.slice(0, 10)}…</small></p>
          </div>
          <div className="card">
            <AcceptProposalBox total={proposal.total} token={token} />
          </div>
        </section>
        <section className="grid grid-2" style={{ marginTop: 28 }}>
          <div className="card"><div className="eyebrow">Highlights</div><h2>Lo que hace especial este viaje</h2>{proposal.highlights.map((h) => <p key={h}>✓ {h}</p>)}</div>
          <div className="card"><div className="eyebrow">Itinerario</div><div className="timeline">{proposal.itinerary.map(([place, text]) => <div key={place}><strong>{place}</strong><p>{text}</p></div>)}</div></div>
        </section>
        <section className="card" style={{ marginTop: 28 }}>
          <div className="eyebrow">Servicios incluidos</div>
          <table><thead><tr><th>Servicio</th><th>Detalle</th><th>Precio</th></tr></thead><tbody>{proposal.lines.map(([name, text, price]) => <tr key={String(name)}><td><strong>{name}</strong></td><td>{text}</td><td>{Number(price).toLocaleString("es-ES")} €</td></tr>)}</tbody></table>
        </section>
      </div>
    </div>
  );
}
