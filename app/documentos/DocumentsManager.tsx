"use client";

import { useMemo, useState } from "react";
import { demoDocuments, documentStatuses, documentSummary, CaseDocument } from "@/lib/documents";

export function DocumentsManager() {
  const [items, setItems] = useState<CaseDocument[]>(demoDocuments);
  const [query, setQuery] = useState("");
  const summary = useMemo(() => documentSummary(items), [items]);
  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return items;
    return items.filter((item) => [item.case_code, item.type, item.title, item.file_name, item.owner, item.status].some((value) => String(value ?? "").toLowerCase().includes(normalized)));
  }, [items, query]);

  function updateStatus(id: string, status: CaseDocument["status"]) {
    setItems((current) => current.map((item) => item.id === id ? { ...item, status } : item));
  }

  return (
    <div className="grid">
      <section className="grid grid-3">
        <div className="card"><span className="badge">Documentos</span><div className="metric">{summary.total}</div><p>Registro documental demo por expediente.</p></div>
        <div className="card"><span className="badge">Faltan</span><div className="metric">{summary.missing}</div><p>Bloquean contrato, proveedor o cierre.</p></div>
        <div className="card"><span className="badge">En revisión</span><div className="metric">{summary.reviewing}</div><p>Subidos o pendientes de validar.</p></div>
      </section>

      <section className="card">
        <div className="header" style={{ marginBottom: 0 }}>
          <div>
            <div className="eyebrow">Repositorio operativo</div>
            <h2>Documentos por expediente</h2>
            <p>Centraliza propuestas, contratos, documentos de viajeros, facturas proveedor, pagos y documentación fiscal.</p>
          </div>
          <input className="input" style={{ maxWidth: 320 }} placeholder="Buscar documento" value={query} onChange={(event) => setQuery(event.target.value)} />
        </div>
        <table>
          <thead><tr><th>Expediente</th><th>Tipo</th><th>Documento</th><th>Archivo</th><th>Responsable</th><th>Estado</th><th>Notas</th></tr></thead>
          <tbody>{filtered.map((item) => <tr key={item.id}><td><a href={`/expedientes/${item.case_code}`}><strong>{item.case_code}</strong></a></td><td><span className="badge">{item.type}</span></td><td>{item.title}<br/><small>{item.uploaded_at || "sin subida"}{item.expires_at ? ` · caduca ${item.expires_at}` : ""}</small></td><td>{item.file_name || "—"}</td><td>{item.owner}</td><td><select value={item.status} onChange={(event) => updateStatus(item.id, event.target.value as CaseDocument["status"])}>{documentStatuses.map((status) => <option key={status} value={status}>{status}</option>)}</select></td><td>{item.notes || "—"}</td></tr>)}</tbody>
        </table>
      </section>

      <section className="card">
        <div className="eyebrow">Regla MVP</div>
        <h2>Archivos privados, no públicos</h2>
        <p>Cuando activemos Supabase, los archivos sensibles deberán ir a buckets privados con acceso por rol y trazabilidad. La propuesta pública solo debe mostrar información comercial aprobada.</p>
      </section>
    </div>
  );
}
