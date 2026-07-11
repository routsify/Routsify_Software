"use client";

import { FormEvent, useState } from "react";
import type { DocumentRow } from "./workspace-types";
import { formatDate } from "./workspace-types";

export function DocumentsTab({ caseId, caseCode, initialDocuments }: { caseId: string; caseCode: string; initialDocuments: DocumentRow[] }) {
  const [items, setItems] = useState(initialDocuments);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

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
      const confirmResponse = await fetch("/api/documentos/confirm-upload", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ caseId, ownerType: "case", title: String(values.get("title") || file.name), type: String(values.get("type") || "documento"), storagePath: upload.path, fileName: file.name, mimeType: file.type, sizeBytes: file.size, sensitivity: "private", retentionDays: 90 }) });
      const confirm = await confirmResponse.json().catch(() => null);
      if (!confirmResponse.ok || !confirm?.ok) throw new Error(confirm?.error || "No se pudo confirmar el documento.");
      setItems((current) => [confirm.data, ...current]); form.reset(); setMessage("Documento subido correctamente.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Error subiendo documento."); } finally { setSaving(false); }
  }

  async function openDocument(documentId: string) {
    setSaving(true); setMessage(null);
    const response = await fetch("/api/documentos/read-url", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ documentId }) });
    const result = await response.json().catch(() => null); setSaving(false);
    if (!response.ok || !result?.ok || !result.signedUrl) return setMessage(String(result?.error || "No se pudo abrir el documento."));
    window.open(result.signedUrl, "_blank", "noopener,noreferrer");
  }

  return <section className="workspace-grid">
    <div className="card"><h2>Subir documento</h2><form className="form" onSubmit={uploadDocument}><label>Título<input className="input" name="title" placeholder="Ej. Pasaporte de Ana" /></label><label>Tipo<select name="type"><option value="pasaporte">Pasaporte</option><option value="dni">DNI</option><option value="seguro">Seguro</option><option value="reserva">Reserva</option><option value="factura_proveedor">Factura de proveedor</option><option value="otro">Otro</option></select></label><label>Archivo *<input className="input" name="file" type="file" required accept="application/pdf,image/jpeg,image/png,image/webp" /></label><p className="field-help">PDF o imagen, máximo 10 MB. El archivo se almacena de forma privada.</p><button className="btn" disabled={saving}>{saving ? "Subiendo..." : "Subir documento"}</button></form>{message ? <p className="client-message">{message}</p> : null}</div>
    <div className="card workspace-wide"><h2>Documentación</h2>{items.length ? <div className="table-scroll"><table><thead><tr><th>Documento</th><th>Tipo</th><th>Estado</th><th>Fecha</th><th></th></tr></thead><tbody>{items.map((item) => <tr key={item.id}><td><strong>{item.title || item.file_name || "Documento"}</strong></td><td>{item.type || "general"}</td><td>{item.status || "reviewing"}</td><td>{formatDate(item.created_at)}</td><td><button className="link-button" type="button" onClick={() => void openDocument(item.id)} disabled={saving}>Abrir</button></td></tr>)}</tbody></table></div> : <p>No hay documentos.</p>}</div>
  </section>;
}
