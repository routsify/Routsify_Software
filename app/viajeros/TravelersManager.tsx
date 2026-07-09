"use client";

import { FormEvent, useMemo, useState } from "react";
import { cases } from "@/lib/mock-data";
import { demoOcrForTraveler, ocrSummary } from "@/lib/demo-ocr";
import { demoTravelers, documentStatuses, travelerSummary, Traveler } from "@/lib/travelers";
import { caseTravelerReadiness, documentExpiresSoon, inferTravelerStatus, travelerBlockers, travelerNextAction } from "@/lib/traveler-rules";
import { isDemoMode } from "@/lib/supabase-browser";

type TravelerDraft = {
  case_code: string;
  full_name: string;
  date_of_birth: string;
  nationality: string;
  document_type: string;
  document_number: string;
  document_expiry: string;
  document_file: string;
  notes: string;
};

const emptyDraft: TravelerDraft = {
  case_code: "EXP-2026-0001",
  full_name: "",
  date_of_birth: "",
  nationality: "ES",
  document_type: "passport",
  document_number: "",
  document_expiry: "",
  document_file: "",
  notes: "",
};

function buildTraveler(draft: TravelerDraft): Traveler {
  const base: Traveler = {
    id: `traveler-${Date.now()}`,
    case_code: draft.case_code,
    full_name: draft.full_name.trim(),
    date_of_birth: draft.date_of_birth,
    nationality: draft.nationality.trim() || "ES",
    document_type: draft.document_type,
    document_number: draft.document_number.trim(),
    document_expiry: draft.document_expiry,
    document_file: draft.document_file.trim() || undefined,
    status: "missing",
    notes: draft.notes.trim() || undefined,
  };
  return { ...base, status: inferTravelerStatus(base) };
}

export function TravelersManager() {
  const [items, setItems] = useState<Traveler[]>(demoTravelers);
  const [draft, setDraft] = useState<TravelerDraft>(emptyDraft);
  const [caseCode, setCaseCode] = useState("EXP-2026-0001");
  const [message, setMessage] = useState<string | null>(null);
  const summary = useMemo(() => travelerSummary(items), [items]);
  const ocr = useMemo(() => ocrSummary(items), [items]);
  const selectedCaseItems = useMemo(() => items.filter((item) => item.case_code === caseCode), [items, caseCode]);
  const readiness = useMemo(() => caseTravelerReadiness(selectedCaseItems), [selectedCaseItems]);

  function updateDraft<K extends keyof TravelerDraft>(key: K, value: TravelerDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function addTraveler(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft.full_name.trim()) {
      setMessage("Añade el nombre completo del viajero.");
      return;
    }

    const item = buildTraveler(draft);
    setItems((current) => [item, ...current]);
    setDraft({ ...emptyDraft, case_code: draft.case_code });
    setCaseCode(item.case_code);
    setMessage(isDemoMode() ? "Viajero añadido en modo demo. OCR simulado y revisión humana siguen siendo obligatorios si hay baja confianza." : "Viajero preparado para guardado real.");
  }

  function updateStatus(id: string, status: Traveler["status"]) {
    setItems((current) => current.map((item) => item.id === id ? { ...item, status } : item));
  }

  function validateTraveler(id: string) {
    const current = items.find((item) => item.id === id);
    if (!current) return;
    const blockers = travelerBlockers(current);
    const ocrResult = demoOcrForTraveler(current);
    if (ocrResult.status === "revision_requerida") blockers.push("OCR con confianza baja/media");
    if (blockers.length > 0) {
      setItems((list) => list.map((item) => item.id === id ? { ...item, status: inferTravelerStatus(item), notes: blockers.join(" · ") } : item));
      setMessage("No se puede verificar: " + blockers.join(" · "));
      return;
    }
    setItems((list) => list.map((item) => item.id === id ? { ...item, status: "verified", notes: "OCR revisado y aprobado manualmente por operaciones." } : item));
    setMessage("Viajero verificado. Ya cuenta para contrato y cierre.");
  }

  function refreshStatuses() {
    setItems((list) => list.map((item) => ({ ...item, status: inferTravelerStatus(item), notes: documentExpiresSoon(item.document_expiry) ? "Documento caduca en menos de 180 días." : item.notes })));
    setMessage("Estados recalculados según datos mínimos, archivo, OCR demo y caducidad.");
  }

  return (
    <div className="grid">
      <section className="grid grid-3">
        <div className="card"><span className="badge">Viajeros</span><div className="metric">{summary.total}</div><p>Personas asociadas a expedientes activos.</p></div>
        <div className="card"><span className="badge">OCR / revisión</span><div className="metric">{ocr.done}/{ocr.total}</div><p>{ocr.review} requieren revisión humana.</p></div>
        <div className="card"><span className="badge">Estado contrato</span><div className="metric">{summary.ready ? "ready" : "blocked"}</div><p>El contrato no avanza si falta aprobación documental.</p></div>
      </section>

      <section className="card">
        <div className="header" style={{ marginBottom: 0 }}>
          <div><div className="eyebrow">Control por expediente</div><h2>{caseCode}</h2><p>{readiness.verified}/{readiness.total} viajeros verificados · {readiness.blockers} bloqueos documentales.</p></div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}><select value={caseCode} onChange={(event) => setCaseCode(event.target.value)}>{cases.map((item) => <option key={item.case_code} value={item.case_code}>{item.case_code} · {item.client}</option>)}</select><button className="btn secondary" type="button" onClick={refreshStatuses}>Recalcular estados</button></div>
        </div>
      </section>

      <section className="grid grid-2">
        <div className="card">
          <div className="eyebrow">Alta de viajero</div>
          <h2>Datos mínimos operativos</h2>
          <form className="form" onSubmit={addTraveler}>
            <label>Expediente<select value={draft.case_code} onChange={(event) => updateDraft("case_code", event.target.value)}>{cases.map((item) => <option key={item.case_code} value={item.case_code}>{item.case_code} · {item.client}</option>)}</select></label>
            <label>Nombre completo<input className="input" value={draft.full_name} onChange={(event) => updateDraft("full_name", event.target.value)} placeholder="Nombre y apellidos" /></label>
            <div className="grid grid-3"><label>Nacimiento<input className="input" type="date" value={draft.date_of_birth} onChange={(event) => updateDraft("date_of_birth", event.target.value)} /></label><label>Nacionalidad<input className="input" value={draft.nationality} onChange={(event) => updateDraft("nationality", event.target.value)} /></label><label>Tipo documento<select value={draft.document_type} onChange={(event) => updateDraft("document_type", event.target.value)}><option value="passport">Pasaporte</option><option value="dni">DNI</option><option value="other">Otro</option></select></label></div>
            <div className="grid grid-3"><label>Número<input className="input" value={draft.document_number} onChange={(event) => updateDraft("document_number", event.target.value)} /></label><label>Caducidad<input className="input" type="date" value={draft.document_expiry} onChange={(event) => updateDraft("document_expiry", event.target.value)} /></label><label>Archivo<input className="input" value={draft.document_file} onChange={(event) => updateDraft("document_file", event.target.value)} placeholder="pasaporte.pdf" /></label></div>
            <label>Notas<textarea className="input" rows={3} value={draft.notes} onChange={(event) => updateDraft("notes", event.target.value)} /></label>
            {message ? <p>{message}</p> : null}
            <button className="btn" type="submit">Añadir viajero</button>
          </form>
        </div>

        <div className="card">
          <div className="eyebrow">Regla MVP</div>
          <h2>OCR asistido, revisión humana</h2>
          <p>El OCR demo prellena campos y marca confianza por campo. La aprobación final siempre requiere revisión humana si hay confianza media/baja.</p>
          <table><tbody><tr><th>Formatos</th><td>JPG, PNG, PDF, WEBP</td></tr><tr><th>No se envía a Holded</th><td>DNI/pasaporte nunca se sincroniza como copia fiscal.</td></tr><tr><th>Retención</th><td>Corta, privada y auditada cuando haya datos reales.</td></tr><tr><th>Revisión</th><td>Usuario revisor + timestamp.</td></tr></tbody></table>
        </div>
      </section>

      <section className="card">
        <table>
          <thead><tr><th>Expediente</th><th>Viajero</th><th>Documento</th><th>OCR</th><th>Confianza campos</th><th>Estado</th><th>Siguiente acción</th><th>Acción</th></tr></thead>
          <tbody>{items.map((item) => { const blockers = travelerBlockers(item); const ocrResult = demoOcrForTraveler(item); return <tr key={item.id}><td><a href={`/expedientes/${item.case_code}`}><strong>{item.case_code}</strong></a></td><td>{item.full_name}<br/><small>{item.date_of_birth || "sin nacimiento"} · {item.nationality}</small></td><td>{item.document_type}<br/><small>{item.document_number || "sin número"} · {item.document_file || "sin archivo"}</small></td><td><span className="badge">{ocrResult.status}</span><br/><small>{ocrResult.reviewer}{ocrResult.reviewed_at ? ` · ${ocrResult.reviewed_at}` : ""}</small></td><td>{ocrResult.fields.length ? ocrResult.fields.map((field) => <span key={field.field}>{field.field}: {field.confidence}<br/></span>) : "—"}</td><td><select value={item.status} onChange={(event) => updateStatus(item.id, event.target.value as Traveler["status"])}>{documentStatuses.map((status) => <option key={status} value={status}>{status}</option>)}</select></td><td>{travelerNextAction(item)}<br/><small>{ocrResult.alert || blockers.join(" · ") || item.notes || "—"}</small></td><td><button className="btn secondary" type="button" onClick={() => validateTraveler(item.id)}>Verificar</button></td></tr>; })}</tbody>
        </table>
      </section>
    </div>
  );
}
