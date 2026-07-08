"use client";

import { FormEvent, useMemo, useState } from "react";
import { cases } from "@/lib/mock-data";
import { canApproveDocument, demoDocuments, documentBlockers, documentNextAction, documentStatuses, documentSummary, documentTypes, documentVisibilities, CaseDocument } from "@/lib/documents";

type DocumentDraft = {
  case_code: string;
  type: CaseDocument["type"];
  title: string;
  file_name: string;
  owner: string;
  visibility: NonNullable<CaseDocument["visibility"]>;
  required: boolean;
  expires_at: string;
  notes: string;
};

const emptyDraft: DocumentDraft = {
  case_code: "EXP-2026-0001",
  type: "operations",
  title: "",
  file_name: "",
  owner: "Operaciones",
  visibility: "private",
  required: true,
  expires_at: "",
  notes: "",
};

export function DocumentsManager() {
  const [items, setItems] = useState<CaseDocument[]>(demoDocuments);
  const [query, setQuery] = useState("");
  const [caseCode, setCaseCode] = useState("EXP-2026-0001");
  const [draft, setDraft] = useState<DocumentDraft>(emptyDraft);
  const [message, setMessage] = useState<string | null>(null);
  const summary = useMemo(() => documentSummary(items), [items]);
  const selectedCaseItems = useMemo(() => items.filter((item) => item.case_code === caseCode), [items, caseCode]);
  const caseSummary = useMemo(() => documentSummary(selectedCaseItems), [selectedCaseItems]);
  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return items;
    return items.filter((item) => [item.case_code, item.type, item.title, item.file_name, item.owner, item.status, item.visibility].some((value) => String(value ?? "").toLowerCase().includes(normalized)));
  }, [items, query]);

  function updateDraft<K extends keyof DocumentDraft>(key: K, value: DocumentDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function addDocument(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft.title.trim()) {
      setMessage("Añade un título de documento.");
      return;
    }
    const item: CaseDocument = {
      id: `doc-${Date.now()}`,
      case_code: draft.case_code,
      type: draft.type,
      title: draft.title.trim(),
      file_name: draft.file_name.trim() || undefined,
      status: draft.file_name.trim() ? "uploaded" : "missing",
      owner: draft.owner.trim() || "Operaciones",
      visibility: draft.visibility,
      required: draft.required,
      uploaded_at: draft.file_name.trim() ? new Date().toISOString().slice(0, 10) : undefined,
      expires_at: draft.expires_at || undefined,
      notes: draft.notes.trim() || undefined,
    };
    setItems((current) => [item, ...current]);
    setDraft({ ...emptyDraft, case_code: draft.case_code });
    setCaseCode(item.case_code);
    setMessage("Documento registrado. Si es obligatorio, deberá revisarse antes de avanzar.");
  }

  function updateStatus(id: string, status: CaseDocument["status"]) {
    setItems((current) => current.map((item) => item.id === id ? { ...item, status } : item));
  }

  function approveDocument(id: string) {
    const current = items.find((item) => item.id === id);
    if (!current) return;
    if (!canApproveDocument(current)) {
      const blockers = documentBlockers(current);
      setItems((list) => list.map((item) => item.id === id ? { ...item, status: item.status === "missing" ? "missing" : "reviewing", notes: blockers.join(" · ") || item.notes } : item));
      setMessage("No se puede aprobar: " + (blockers.join(" · ") || "falta archivo o revisión"));
      return;
    }
    setItems((list) => list.map((item) => item.id === id ? { ...item, status: "approved", reviewed_at: new Date().toISOString().slice(0, 10), reviewed_by: "Operaciones Demo", rejection_reason: undefined } : item));
    setMessage("Documento aprobado. Ya cuenta para contrato, operación o cierre según su tipo.");
  }

  function rejectDocument(id: string) {
    setItems((list) => list.map((item) => item.id === id ? { ...item, status: "rejected", rejection_reason: "Revisión manual no superada", reviewed_at: new Date().toISOString().slice(0, 10), reviewed_by: "Operaciones Demo" } : item));
    setMessage("Documento rechazado. Queda pendiente corregirlo y volver a subirlo.");
  }

  return (
    <div className="grid">
      <section className="grid grid-3">
        <div className="card"><span className="badge">Documentos</span><div className="metric">{summary.total}</div><p>Registro documental demo por expediente.</p></div>
        <div className="card"><span className="badge">Obligatorios abiertos</span><div className="metric">{summary.requiredOpen}</div><p>{summary.missing} faltan · {summary.expired} caducados.</p></div>
        <div className="card"><span className="badge">Bloqueados</span><div className="metric">{summary.blocked}</div><p>Impiden contrato, publicación o cierre.</p></div>
      </section>

      <section className="card">
        <div className="header" style={{ marginBottom: 0 }}>
          <div><div className="eyebrow">Control por expediente</div><h2>{caseCode}</h2><p>{caseSummary.approved}/{caseSummary.total} aprobados · {caseSummary.blocked} bloqueados · {caseSummary.requiredOpen} obligatorios abiertos.</p></div>
          <select value={caseCode} onChange={(event) => setCaseCode(event.target.value)}>{cases.map((item) => <option key={item.case_code} value={item.case_code}>{item.case_code} · {item.client}</option>)}</select>
        </div>
      </section>

      <section className="grid grid-2">
        <div className="card">
          <div className="eyebrow">Alta documental</div>
          <h2>Registrar documento</h2>
          <form className="form" onSubmit={addDocument}>
            <label>Expediente<select value={draft.case_code} onChange={(event) => updateDraft("case_code", event.target.value)}>{cases.map((item) => <option key={item.case_code} value={item.case_code}>{item.case_code} · {item.client}</option>)}</select></label>
            <div className="grid grid-2"><label>Tipo<select value={draft.type} onChange={(event) => updateDraft("type", event.target.value as CaseDocument["type"])}>{documentTypes.map((type) => <option key={type} value={type}>{type}</option>)}</select></label><label>Responsable<input className="input" value={draft.owner} onChange={(event) => updateDraft("owner", event.target.value)} /></label></div>
            <label>Título<input className="input" value={draft.title} onChange={(event) => updateDraft("title", event.target.value)} placeholder="Pasaporte, contrato, factura proveedor..." /></label>
            <div className="grid grid-2"><label>Archivo<input className="input" value={draft.file_name} onChange={(event) => updateDraft("file_name", event.target.value)} placeholder="documento.pdf" /></label><label>Caducidad<input className="input" type="date" value={draft.expires_at} onChange={(event) => updateDraft("expires_at", event.target.value)} /></label></div>
            <div className="grid grid-2"><label>Visibilidad<select value={draft.visibility} onChange={(event) => updateDraft("visibility", event.target.value as DocumentDraft["visibility"])}>{documentVisibilities.map((visibility) => <option key={visibility} value={visibility}>{visibility}</option>)}</select></label><label style={{ display: "flex", gap: 10, alignItems: "center" }}><input type="checkbox" checked={draft.required} onChange={(event) => updateDraft("required", event.target.checked)} />Obligatorio para avanzar</label></div>
            <label>Notas<textarea className="input" rows={3} value={draft.notes} onChange={(event) => updateDraft("notes", event.target.value)} /></label>
            {message ? <p>{message}</p> : null}
            <button className="btn" type="submit">Registrar documento</button>
          </form>
        </div>

        <div className="card">
          <div className="eyebrow">Regla MVP</div>
          <h2>Control y aprobación</h2>
          <p>Antes de avanzar, cada documento obligatorio debe tener archivo, estado revisado y responsable asignado.</p>
          <table><tbody><tr><th>private</th><td>Viajeros, proveedor, pagos y fiscalidad.</td></tr><tr><th>client_public</th><td>Solo propuesta comercial aprobada.</td></tr><tr><th>internal</th><td>Notas y borradores de equipo.</td></tr><tr><th>Cierre</th><td>Todo obligatorio debe quedar aprobado o justificado.</td></tr></tbody></table>
        </div>
      </section>

      <section className="card">
        <div className="header" style={{ marginBottom: 0 }}>
          <div><div className="eyebrow">Repositorio operativo</div><h2>Documentos por expediente</h2><p>Centraliza propuestas, contratos, viajeros, facturas proveedor, pagos y documentación fiscal.</p></div>
          <input className="input" style={{ maxWidth: 320 }} placeholder="Buscar documento" value={query} onChange={(event) => setQuery(event.target.value)} />
        </div>
        <table>
          <thead><tr><th>Expediente</th><th>Tipo</th><th>Documento</th><th>Archivo</th><th>Responsable</th><th>Estado</th><th>Siguiente acción</th><th>Acción</th></tr></thead>
          <tbody>{filtered.map((item) => { const blockers = documentBlockers(item); return <tr key={item.id}><td><a href={`/expedientes/${item.case_code}`}><strong>{item.case_code}</strong></a></td><td><span className="badge">{item.type}</span><br/><small>{item.visibility || "private"}{item.required ? " · obligatorio" : ""}</small></td><td>{item.title}<br/><small>{item.uploaded_at || "sin subida"}{item.expires_at ? ` · caduca ${item.expires_at}` : ""}</small></td><td>{item.file_name || "—"}</td><td>{item.owner}<br/><small>{item.reviewed_by || "sin revisión"}</small></td><td><select value={item.status} onChange={(event) => updateStatus(item.id, event.target.value as CaseDocument["status"])}>{documentStatuses.map((status) => <option key={status} value={status}>{status}</option>)}</select></td><td>{documentNextAction(item)}<br/><small>{blockers.length ? blockers.join(" · ") : item.rejection_reason || item.notes || "—"}</small></td><td><button className="btn secondary" type="button" onClick={() => approveDocument(item.id)}>Aprobar</button><br/><button className="btn secondary" type="button" onClick={() => rejectDocument(item.id)} style={{ marginTop: 8 }}>Rechazar</button></td></tr>; })}</tbody>
        </table>
      </section>
    </div>
  );
}
