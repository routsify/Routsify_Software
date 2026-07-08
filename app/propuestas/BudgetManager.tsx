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
import { isDemoMode } from "@/lib/supabase-browser";

type DraftLine = {
  service_type_code: string;
  description_public: string;
  supplier_name: string;
  cost_budget: string;
  margin_percent: string;
  creates_expected_purchase: boolean;
};

const initialDraft: DraftLine = {
  service_type_code: "hotel",
  description_public: "",
  supplier_name: "",
  cost_budget: "0",
  margin_percent: "25",
  creates_expected_purchase: true,
};

export function BudgetManager() {
  const [lines, setLines] = useState<BudgetLine[]>(demoBudgetLines as BudgetLine[]);
  const [draft, setDraft] = useState<DraftLine>(initialDraft);
  const [message, setMessage] = useState<string | null>(null);

  const totals = useMemo(() => calculateBudgetTotals(lines), [lines]);
  const previewSale = useMemo(() => {
    const cost = Number(draft.cost_budget) || 0;
    const margin = (Number(draft.margin_percent) || 0) / 100;
    return calculateSalePriceFromMargin(cost, margin);
  }, [draft.cost_budget, draft.margin_percent]);

  function updateDraft<K extends keyof DraftLine>(key: K, value: DraftLine[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function addLine(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

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
      description_internal: description,
      supplier_name: draft.supplier_name.trim() || "Pendiente de proveedor",
      destination_segment: "",
      start_date: "",
      end_date: "",
      cost_budget: cost,
      margin_applied: margin,
      sale_price: salePrice,
      creates_expected_purchase: draft.creates_expected_purchase,
    };

    setLines((current) => [...current, line]);
    setDraft(initialDraft);
    setMessage(isDemoMode() ? "Línea añadida en modo demo. La persistencia real se activará al pasar a Supabase conectado." : "Línea preparada. Pendiente de persistencia contra versión de propuesta real.");
  }

  function removeLine(id: string) {
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
          <div className="eyebrow">Nueva línea de presupuesto</div>
          <h2>Margen por línea</h2>
          <form className="form" onSubmit={addLine}>
            <label>
              Tipo de servicio
              <select value={draft.service_type_code} onChange={(event) => updateDraft("service_type_code", event.target.value)}>
                {serviceTypes.map((type) => <option key={type.code} value={type.code}>{type.name}</option>)}
              </select>
            </label>
            <label>
              Descripción pública
              <textarea className="input" rows={4} value={draft.description_public} onChange={(event) => updateDraft("description_public", event.target.value)} placeholder="Texto comercial que verá el cliente" />
            </label>
            <label>
              Proveedor
              <input className="input" value={draft.supplier_name} onChange={(event) => updateDraft("supplier_name", event.target.value)} placeholder="Proveedor externo o Routsify" />
            </label>
            <div className="grid grid-2">
              <label>
                Coste previsto
                <input className="input" type="number" min="0" step="0.01" value={draft.cost_budget} onChange={(event) => updateDraft("cost_budget", event.target.value)} />
              </label>
              <label>
                Margen %
                <input className="input" type="number" min="0" max="95" step="0.1" value={draft.margin_percent} onChange={(event) => updateDraft("margin_percent", event.target.value)} />
              </label>
            </div>
            <label style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <input type="checkbox" checked={draft.creates_expected_purchase} onChange={(event) => updateDraft("creates_expected_purchase", event.target.checked)} />
              Genera compra esperada de proveedor
            </label>
            <div className="card" style={{ boxShadow: "none" }}>
              <span className="badge">Precio de venta estimado</span>
              <div className="metric">{formatCurrency(previewSale)}</div>
            </div>
            {message ? <p>{message}</p> : null}
            <button className="btn" type="submit">Añadir línea</button>
          </form>
        </div>

        <div className="card">
          <div className="eyebrow">Control operativo</div>
          <h2>Qué quedará bloqueado al aceptar</h2>
          <p>Cuando una versión pase a aceptada, se bloquearán venta, condiciones y fórmulas. Las líneas con proveedor externo crearán compras esperadas para conciliar facturas antes del cierre.</p>
          <table>
            <tbody>
              <tr><th>Líneas</th><td>{lines.length}</td></tr>
              <tr><th>Compras esperadas</th><td>{totals.expectedPurchases}</td></tr>
              <tr><th>Modo actual</th><td>{isDemoMode() ? "Demo" : "Supabase"}</td></tr>
              <tr><th>Estado sugerido</th><td><span className="badge">budget_draft</span></td></tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="card">
        <div className="header" style={{ marginBottom: 0 }}>
          <div>
            <div className="eyebrow">Presupuesto nativo</div>
            <h2>Líneas de la versión 1</h2>
          </div>
          <a className="btn secondary" href="/propuestas/demo-public-token">Vista pública</a>
        </div>
        <table>
          <thead>
            <tr><th>Servicio</th><th>Descripción pública</th><th>Proveedor</th><th>Coste</th><th>Margen</th><th>Venta</th><th>Compra</th><th></th></tr>
          </thead>
          <tbody>
            {lines.map((line) => (
              <tr key={line.id}>
                <td><span className="badge">{line.service_type_code}</span></td>
                <td>{line.description_public}</td>
                <td>{line.supplier_name || "—"}</td>
                <td>{formatCurrency(line.cost_budget)}</td>
                <td>{formatPercent(line.margin_applied)}</td>
                <td><strong>{formatCurrency(line.sale_price)}</strong></td>
                <td>{line.creates_expected_purchase ? "Sí" : "No"}</td>
                <td><button className="btn secondary" type="button" onClick={() => removeLine(line.id)}>Quitar</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
