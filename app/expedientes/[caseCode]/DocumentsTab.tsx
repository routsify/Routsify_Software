"use client";

import { FormEvent, useMemo, useState } from "react";
import type { DocumentRow, Traveler } from "./workspace-types";
import { formatDate } from "./workspace-types";

type OcrField = { name: string; value: string | null; confidence: number };
type OcrReview = { runId: string; documentId: string; fields: OcrField[]; values: Record<string, string>; confidence: number };

function isIdentityDocument(item: DocumentRow) {
  return ["pasaporte", "passport", "dni", "identity", "identity_document"].includes(String(item.type || item.document_type || "").toLowerCase());
}

export function DocumentsTab({ caseId, caseCode, initialDocuments, travelers }: { caseId: string; caseCode: string; initialDocuments: DocumentRow[]; travelers: Traveler[] }) {
  const [items, setItems] = useState(initialDocuments);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [travelerByDocument, setTravelerByDocument] = useState<Record<string, string>>({});
  const [review, setReview] = useState<OcrReview | null>(null);
  const travelerOptions = useMemo(() => travelers.map((item) => ({ id: item.id, label: `${item.first_name || ""} ${item.last_name || ""}`.trim() || "Viajero" })), [travelers]);

  async function uploadDocument(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    const file = values.get("file");
    if (!(file instanceof File) || !file.size) return setMessage("Selecciona un archivo.");
    setSaving(true); setMessage(null);
    try {
      const uploadResponse = await fetch("/api/documentos/upload-url", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ caseCode, fileName: file.name, sizeBytes: file.size, mimeType: file.type }) });
      const upload = await uploadResponse.json().catch(() => null);
      if (!uploadResponse.ok || !upload?.ok || !upload.signedUrl) throw new Error(upload?.error || "No se pudo preparar la subida.");
      const uploaded = await fetch(upload.signedUrl, { method: "PUT", headers: { "content-type": file.type }, body: file });
      if (!uploaded.ok) throw new Error("No se pudo subir el archivo.");
      const type = String(values.get("type") || "documento");
      const confirmResponse = await fetch("/api/documentos/confirm-upload", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ caseId, ownerType: "case", title: String(values.get("title") || file.name), type, documentType: type, storagePath: upload.path, fileName: file.name, mimeType: file.type, sizeBytes: file.size, sensitivity: isIdentityDocument({ id: "new", type }) ? "sensitive" : "private", retentionDays: 1825 }) });
      const confirm = await confirmResponse.json().catch(() => null);
      if (!confirmResponse.ok || !confirm?.ok) throw new Error(confirm?.error || "No se pudo confirmar el documento.");
      setItems((current) => [confirm.data, ...current]); form.reset(); setMessage("Documento subido correctamente. Se conservará durante cinco años.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Error subiendo documento."); } finally { setSaving(false); }
  }

  async function openDocument(documentId: string) {
    setSaving(true); setMessage(null);
    const response = await fetch("/api/documentos/read-url", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ documentId }) });
    const result = await response.json().catch(() => null); setSaving(false);
    if (!response.ok || !result?.ok || !result.signedUrl) return setMessage(String(result?.error || "No se pudo abrir el documento."));
    window.open(result.signedUrl, "_blank", "noopener,noreferrer");
  }

  async function processOcr(documentId: string) {
    const travelerId = travelerByDocument[documentId] || "";
    if (!travelerId) return setMessage("Selecciona el viajero al que pertenece el documento.");
    setSaving(true); setMessage("Procesando el documento con OpenAI…"); setReview(null);
    const response = await fetch(`/api/routsify/clients/documents/${documentId}/ocr`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ travelerId }) });
    const result = await response.json().catch(() => null); setSaving(false);
    if (!response.ok || !result?.ok) return setMessage(String(result?.error || "No se pudo procesar el documento."));
    const fields = Array.isArray(result.data.fields) ? result.data.fields as OcrField[] : [];
    setReview({ runId: result.data.runId, documentId, fields, values: Object.fromEntries(fields.map((field) => [field.name, field.value || ""])), confidence: Number(result.data.confidence || 0) });
    setItems((current) => current.map((item) => item.id === documentId ? { ...item, ocr_status: "review_required" } : item));
    setMessage("OCR completado. Revisa todos los campos antes de aprobar.");
  }

  async function approveOcr(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!review) return;
    setSaving(true); setMessage(null);
    const response = await fetch(`/api/routsify/clients/ocr/${review.runId}/review`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ approve: true, fields: review.values }) });
    const result = await response.json().catch(() => null); setSaving(false);
    if (!response.ok || !result?.ok) return setMessage(String(result?.error || "No se pudo aprobar el OCR."));
    setItems((current) => current.map((item) => item.id === review.documentId ? { ...item, ocr_status: "approved" } : item));
    setReview(null); setMessage("Datos documentales revisados y aprobados. El viajero se ha actualizado.");
  }

  return <section className="workspace-grid">
    <div className="card"><h2>Subir documento</h2><form className="form" onSubmit={uploadDocument}><label>Título<input className="input" name="title" placeholder="Ej. Pasaporte de Ana" /></label><label>Tipo<select name="type"><option value="pasaporte">Pasaporte</option><option value="dni">DNI</option><option value="seguro">Seguro</option><option value="reserva">Reserva</option><option value="factura_proveedor">Factura de proveedor</option><option value="otro">Otro</option></select></label><label>Archivo *<input className="input" name="file" type="file" required accept="application/pdf,image/jpeg,image/png,image/webp" /></label><p className="field-help">PDF o imagen, máximo 10 MB. Almacenamiento privado y retención de cinco años.</p><button className="btn" disabled={saving}>{saving ? "Procesando..." : "Subir documento"}</button></form>{message ? <p className="client-message">{message}</p> : null}</div>
    <div className="card workspace-wide"><h2>Documentación</h2>{items.length ? <div className="table-scroll"><table><thead><tr><th>Documento</th><th>Tipo</th><th>Estado</th><th>OCR</th><th>Fecha</th><th></th></tr></thead><tbody>{items.map((item) => <tr key={item.id}><td><strong>{item.title || item.file_name || "Documento"}</strong></td><td>{item.type || item.document_type || "general"}</td><td>{item.status || "reviewing"}</td><td>{isIdentityDocument(item) ? <div style={{ display: "grid", gap: 8 }}><select value={travelerByDocument[item.id] || ""} onChange={(event) => setTravelerByDocument((current) => ({ ...current, [item.id]: event.target.value }))}><option value="">Selecciona viajero</option>{travelerOptions.map((traveler) => <option key={traveler.id} value={traveler.id}>{traveler.label}</option>)}</select><button className="link-button" type="button" onClick={() => void processOcr(item.id)} disabled={saving || item.ocr_status === "approved"}>{item.ocr_status === "approved" ? "Aprobado" : item.ocr_status === "review_required" ? "Revisar OCR" : "Procesar OCR"}</button></div> : "—"}</td><td>{formatDate(item.created_at)}</td><td><button className="link-button" type="button" onClick={() => void openDocument(item.id)} disabled={saving}>Abrir</button></td></tr>)}</tbody></table></div> : <p>No hay documentos.</p>}</div>
    {review ? <div className="card workspace-wide"><div className="eyebrow">Revisión humana obligatoria</div><h2>Datos extraídos · confianza {(review.confidence * 100).toFixed(0)}%</h2><form className="form" onSubmit={approveOcr}><div className="grid grid-2">{review.fields.map((field) => <label key={field.name}>{field.name.replaceAll("_", " ")} <small>({Math.round(field.confidence * 100)}%)</small><input className="input" value={review.values[field.name] || ""} onChange={(event) => setReview((current) => current ? { ...current, values: { ...current.values, [field.name]: event.target.value } } : current)} /></label>)}</div><p className="form-warning">Comprueba el documento original. OpenAI solo propone los datos; ninguna extracción se aprueba automáticamente.</p><div className="form-actions"><button className="btn secondary" type="button" onClick={() => setReview(null)}>Cancelar</button><button className="btn" type="submit" disabled={saving}>Aprobar y actualizar viajero</button></div></form></div> : null}
  </section>;
}
