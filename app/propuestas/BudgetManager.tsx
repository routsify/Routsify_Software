"use client";

import { FormEvent, useMemo, useState } from "react";
import { budgetLines as demoBudgetLines, serviceTypes } from "@/lib/mock-data";
import {
  BudgetLine,
  calculateBudgetTotals,
  calculateSalePriceFromMargin,
  formatCurrency,
  formatPercent,
  roundMoney,
} from "@/lib/budget";
import { canEditVersion, demoProposalVersions, ProposalVersion, proposalStatuses, proposalVersionSummary } from "@/lib/proposal-versioning";
import { isDemoMode } from "@/lib/supabase-browser";

type DraftLine = {
  service_type_code: string;
  description_public: string;
  description_internal: string;
  supplier_name: string;
  destination_segment: string;
  cost_budget: string;
  margin_percent: string;
  creates_expected_purchase: boolean;
};

const initialDraft: DraftLine = {
  service_type_code: "hotel",
  description_public: "",
  description_internal: "",
  supplier_name: "",
  destination_segment: "",
  cost_budget: "0",
  margin_percent: "25",
  creates_expected_purchase: true,
};

export function BudgetManager() {
  const [lines, setLines] = useState<BudgetLine[]>(demoBudgetLines as BudgetLine[]);
  const [versions, setVersions] = useState<ProposalVersion[]>(demoProposalVersions);
  const [activeVersionId, setActiveVersionId] = useState(demoProposalVersions[0].id);
  const [draft, setDraft] = useState<DraftLine>(initialDraft);
  const [message, setMessage] = useState<string | null>(null);

  const activeVersion = versions.find((version) => version.id === activeVersionId) || versions[0];
  const isEditable = canEditVersion(activeVersion);
  const totals = useMemo(() => calculateBudgetTotals(lines), [lines]);
  const previewSale = useMemo(() => {
    const cost = Number(draft.cost_budget) || 0;
    const margin = (Number(draft.margin_percent) || 0) / 100;
    return calculateSalePriceFromMargin(cost, margin);
  }, [draft.cost_budget, draft.margin_percent]);

  function updateDraft<K extends keyof DraftLine>(key: K, value: DraftLine[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function updateVersion(status: ProposalVersion["status"]) {
    setVersions((current) => current.map((version) => version.id === activeVersion.id ? {
      ...version,
      status,
      locked: status === "accepted" || status === "sent",
      sent_at: status === "sent" ? new Date().toISOString().slice(0, 10) : version.sent_at,
      accepted_at: status === "accepted" ? new Date().toISOString().slice(0, 10) : version.accepted_at,
      snapshot_note: status === "accepted" ? "Snapshot aceptado: venta, fórmulas, condiciones y compras esperadas quedan bloqueadas." : proposalVersionSummary({ ...version, status }),
    } : version));
    setMessage(status === "accepted" ? "Versión aceptada y bloqueada en modo demo. Cualquier cambio económico debe crear nueva versión." : "Estado de versión actualizado.");
  }

  function createRevision() {
    const nextNumber = Math.max(...versions.map((version) => version.version_number)) + 1;
    const revision: ProposalVersion = {
      id: `proposal-version-${Date.now()}`,
      version_number: nextNumber,
      status: "draft",
      created_at: new Date().toISOString().slice(0, 10),
      expires_at: "",
      locked: false,
      snapshot_note: "Nueva versión editable creada desde la versión anterior.",
    };
    setVersions((current) => [revision, ...current]);
    setActiveVersionId(revision.id);
    setMessage("Nueva versión creada. Las versiones enviadas o aceptadas quedan como histórico auditable.");
  }

  function addLine(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!isEditable) {
      setMessage("Esta versión está bloqueada. Crea una nueva versión para cambiar importes, margen o condiciones.");
      return;
    }

    const cost = roundMoney(Number(draft.cost_budget) || 0);
    const margin = Math.min(Math.max((Number(draft.margin_percent) || 0) / 100, 0), 0.95);
    const description = draft.description_public.trim();

    if (!description) {
      setMessage("Añade una descripción pública para que pueda aparecer en la propuesta.");
      return;
    }

    const salePrice = calculateSalePriceFromMargin(cost, margin);
    const line: BudgetLine = {
      id: `demo-budget-${Date.now()}`,
      service_type_code: draft.service_type_code,
      description_public: description,
      description_internal: draft.description_internal.trim() || description,
      supplier_name: draft.supplier_name.trim() || "Pendiente de proveedor",
      destination_segment: draft.destination_segment.trim(),
      start_date: "",
      end_date: "",
      cost_budget: cost,
      margin_applied: margin,
      sale_price: salePrice,
      creates_expected_purchase: draft.creates_expected_purchase,
    };

    setLines((current) => [...current, line]);
    setDraft(initialDraft);
    setMessage(isDemoMode() ? "Línea añadida en modo demo. Al aceptar, si tiene proveedor externo, generará compra esperada." : "Línea preparada contra versión de propuesta real.");
  }

  function removeLine(id: string) {
    if (!isEditable) {
      setMessage("No se puede quitar una línea de una versión enviada o aceptada. Crea una nueva versión.");
      return;
    }
    setLines((current) => current.filter((line) => line.id !== id));
  }

  return (
    <div className="grid">
      <section className="grid grid-3">
        <div className="card"><span className="badge">Venta propuesta</span><div className="metric">{formatCurrency(totals.totalSale)}</div><p>Precio total calculado desde coste y margen por línea.</p></div>
        <div className="card"><span className="badge">Coste previsto</span><div className="metric">{formatCurrency(totals.totalCost)}</div><p>Base para compras esperadas y control de facturas proveedor.</p></div>
        <div className="card"><span className="badge">Margen global</span><div className="metric">{formatPercent(totals.margin)}</div><p>Beneficio previsto: {formatCurrency(totals.profit)}.</p></div>
      </section>

      <section className="grid grid-2">
        <div className="card">
          <div className="eyebrow">Versión económica</div>
          <h2>v{activeVersion.version_number} · {activeVersion.status}</h2>
          <p>{proposalVersionSummary(activeVersion)}</p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
            <select value={activeVersionId} onChange={(event) => setActiveVersionId(event.target.value)}>{versions.map((version) => <option key={version.id} value={version.id}>v{version.version_number} · {version.status}</option>)}</select>
            <button className="btn secondary" type="button" onClick={createRevision}>Nueva versión</button>
          </div>
          <table><tbody><tr><th>Estado</th><td><select value={activeVersion.status} onChange={(event) => updateVersion(event.target.value as ProposalVersion["status"])}>{proposalStatuses.map((status) => <option key={status} value={status}>{status}</option>)}</select></td></tr><tr><th>Bloqueada</th><td>{activeVersion.locked ? "Sí" : "No"}</td></tr><tr><th>Creada</th><td>{activeVersion.created_at}</td></tr><tr><th>Enviada</th><td>{activeVersion.sent_at || "—"}</td></tr><tr><th>Aceptada</th><td>{activeVersion.accepted_at || "—"}</td></tr><tr><th>Snapshot</th><td>{activeVersion.snapshot_note}</td></tr></tbody></table>
        </div>

        <div className="card">
          <div className="eyebrow">Control operativo</div>
          <h2>Qué se congela al aceptar</h2>
          <p>La versión aceptada bloquea venta, fórmulas, condiciones y conjunto de compras esperadas. Los cambios económicos posteriores deben vivir en una nueva versión.</p>
          <table><tbody><tr><th>Líneas</th><td>{lines.length}</td></tr><tr><th>Compras esperadas</th><td>{totals.expectedPurchases}</td></tr><tr><th>Modo actual</th><td>{isDemoMode() ? "Demo" : "Supabase"}</td></tr><tr><th>Edición</th><td>{isEditable ? "Permitida" : "Bloqueada"}</td></tr></tbody></table>
        </div>
      </section>

      <section className="grid grid-2">
        <div className="card">
          <div className="eyebrow">Nueva línea de presupuesto</div>
          <h2>Margen por línea</h2>
          <form className="form" onSubmit={addLine}>
            <label>Tipo de servicio<select disabled={!isEditable} value={draft.service_type_code} onChange={(event) => updateDraft("service_type_code", event.target.value)}>{serviceTypes.map((type) => <option key={type.code} value={type.code}>{type.name}</option>)}</select></label>
            <label>Descripción pública<textarea disabled={!isEditable} className="input" rows={4} value={draft.description_public} onChange={(event) => updateDraft("description_public", event.target.value)} placeholder="Texto comercial que verá el cliente" /></label>
            <label>Descripción interna<textarea disabled={!isEditable} className="input" rows={3} value={draft.description_internal} onChange={(event) => updateDraft("description_internal", event.target.value)} placeholder="Notas operativas que no verá el cliente" /></label>
            <div className="grid grid-2"><label>Proveedor<input disabled={!isEditable} className="input" value={draft.supplier_name} onChange={(event) => updateDraft("supplier_name", event.target.value)} placeholder="Proveedor externo o Routsify" /></label><label>Destino/tramo<input disabled={!isEditable} className="input" value={draft.destination_segment} onChange={(event) => updateDraft("destination_segment", event.target.value)} placeholder="Kioto, Tokio, etapa..." /></label></div>
            <div className="grid grid-2"><label>Coste previsto<input disabled={!isEditable} className="input" type="number" min="0" step="0.01" value={draft.cost_budget} onChange={(event) => updateDraft("cost_budget", event.target.value)} /></label><label>Margen %<input disabled={!isEditable} className="input" type="number" min="0" max="95" step="0.1" value={draft.margin_percent} onChange={(event) => updateDraft("margin_percent", event.target.value)} /></label></div>
            <label style={{ display: "flex", gap: 10, alignItems: "center" }}><input disabled={!isEditable} type="checkbox" checked={draft.creates_expected_purchase} onChange={(event) => updateDraft("creates_expected_purchase", event.target.checked)} />Genera compra esperada de proveedor</label>
            <div className="card" style={{ boxShadow: "none" }}><span className="badge">Precio de venta estimado</span><div className="metric">{formatCurrency(previewSale)}</div></div>
            {message ? <p>{message}</p> : null}
            <button className="btn" type="submit" disabled={!isEditable}>Añadir línea</button>
          </form>
        </div>

        <div className="card">
          <div className="eyebrow">Reglas MVP</div>
          <h2>Versionado y trazabilidad</h2>
          <table><tbody><tr><th>Borrador</th><td>Editable libremente.</td></tr><tr><th>Enviada</th><td>Cualquier cambio económico requiere nueva versión.</td></tr><tr><th>Aceptada</th><td>Bloquea venta, condiciones, fórmulas y compras esperadas.</td></tr><tr><th>Revisión interna</th><td>Permite revisar coste real sin cambiar venta aceptada.</td></tr><tr><th>Perdida/caducada</th><td>Conserva histórico y no genera compras activas.</td></tr></tbody></table>
        </div>
      </section>

      <section className="card">
        <div className="header" style={{ marginBottom: 0 }}>
          <div><div className="eyebrow">Presupuesto nativo</div><h2>Líneas de la versión {activeVersion.version_number}</h2></div>
          <a className="btn secondary" href="/propuestas/demo-public-token">Vista pública</a>
        </div>
        <table>
          <thead><tr><th>Servicio</th><th>Descripción pública</th><th>Proveedor</th><th>Tramo</th><th>Coste</th><th>Margen</th><th>Venta</th><th>Compra</th><th></th></tr></thead>
          <tbody>{lines.map((line) => <tr key={line.id}><td><span className="badge">{line.service_type_code}</span></td><td>{line.description_public}</td><td>{line.supplier_name || "—"}</td><td>{line.destination_segment || "—"}</td><td>{formatCurrency(line.cost_budget)}</td><td>{formatPercent(line.margin_applied)}</td><td><strong>{formatCurrency(line.sale_price)}</strong></td><td>{line.creates_expected_purchase ? "Sí" : "No"}</td><td><button className="btn secondary" type="button" onClick={() => removeLine(line.id)} disabled={!isEditable}>Quitar</button></td></tr>)}</tbody>
        </table>
      </section>
    </div>
  );
}
