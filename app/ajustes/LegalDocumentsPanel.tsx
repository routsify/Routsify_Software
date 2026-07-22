"use client";

import { useState, type FormEvent } from "react";

export type LegalDocumentRow = {
  id: string;
  document_type: string;
  title: string;
  version_label: string;
  file_name: string;
  status: string;
  is_active: boolean;
  is_test?: boolean;
  size_bytes: number | string;
  created_at: string;
  activated_at?: string | null;
  archived_at?: string | null;
};

const documentTypes = [
  ["travel_contract", "Contrato de viaje"],
  ["general_terms", "Condiciones generales"],
  ["precontractual_information", "Información precontractual"],
  ["privacy_policy", "Política de privacidad"],
  ["other", "Otro documento legal"],
] as const;

function typeLabel(value: string) {
  return documentTypes.find(([type]) => type === value)?.[1] || "Documento legal";
}

function dateTime(value?: string | null) {
  return value ? new Date(value).toLocaleString("es-ES") : "—";
}

function fileSize(value: number | string) {
  const bytes = Number(value || 0);
  if (!Number.isFinite(bytes) || bytes <= 0) return "—";
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.ceil(bytes / 1024)} KB`;
}

function sorted(rows: LegalDocumentRow[]) {
  return [...rows].sort((left, right) => Number(right.is_active) - Number(left.is_active) || new Date(right.created_at).getTime() - new Date(left.created_at).getTime());
}

function friendlyError(value: unknown) {
  const raw = String(value || "No se pudo completar la operación.");
  const messages: Record<string, string> = {
    legal_document_pdf_required: "Selecciona un archivo PDF válido.",
    invalid_legal_document_size: "El PDF debe ocupar entre 1 byte y 15 MB.",
    legal_document_title_required: "Indica un título para identificar el documento.",
    legal_document_version_required: "Indica la versión o fecha de vigencia.",
    legal_document_upload_not_found: "La subida no llegó a completarse. Vuelve a intentarlo.",
  };
  return messages[raw] || raw;
}

async function sha256(file: File) {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, "0")).join("");
}

export function LegalDocumentsPanel({ initialDocuments = [], canManage = false }: { initialDocuments?: LegalDocumentRow[]; canManage?: boolean }) {
  const [documents, setDocuments] = useState(() => sorted(initialDocuments));
  const [documentType, setDocumentType] = useState("travel_contract");
  const [title, setTitle] = useState("Contrato de viaje combinado");
  const [versionLabel, setVersionLabel] = useState("v1");
  const [file, setFile] = useState<File | null>(null);
  const [activate, setActivate] = useState(true);
  const [busy, setBusy] = useState(false);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function uploadDocument(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canManage || !file) return setError("Selecciona el PDF que quieres adjuntar.");
    if (!file.name.toLowerCase().endsWith(".pdf") || (file.type && file.type !== "application/pdf")) return setError("Selecciona un archivo PDF válido.");
    if (file.size <= 0 || file.size > 15 * 1024 * 1024) return setError("El PDF debe ocupar menos de 15 MB.");
    setBusy(true); setMessage(null); setError(null);
    try {
      const uploadResponse = await fetch("/api/routsify/settings/legal-documents/upload-url", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ documentType, fileName: file.name, sizeBytes: file.size, mimeType: "application/pdf" }),
      });
      const upload = await uploadResponse.json().catch(() => null);
      if (!uploadResponse.ok || !upload?.ok) throw new Error(friendlyError(upload?.error));
      const putResponse = await fetch(upload.signedUrl, { method: "PUT", headers: { "content-type": "application/pdf" }, body: file });
      if (!putResponse.ok) throw new Error("No se pudo subir el PDF al almacenamiento privado.");
      const checksum = await sha256(file);
      const confirmResponse = await fetch("/api/routsify/settings/legal-documents", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          documentType,
          title: title.trim(),
          versionLabel: versionLabel.trim(),
          fileName: file.name,
          sizeBytes: file.size,
          mimeType: "application/pdf",
          checksum,
          bucket: upload.bucket,
          storagePath: upload.path,
          activate,
        }),
      });
      const confirmed = await confirmResponse.json().catch(() => null);
      if (!confirmResponse.ok || !confirmed?.ok) throw new Error(friendlyError(confirmed?.error));
      const created = confirmed.data as LegalDocumentRow;
      setDocuments((current) => sorted([created, ...current.map((item) => activate && item.document_type === created.document_type ? { ...item, is_active: false } : item)]));
      setFile(null);
      setVersionLabel("");
      const input = document.getElementById("legal-document-file") as HTMLInputElement | null;
      if (input) input.value = "";
      setMessage(activate ? "PDF adjuntado y marcado como vigente." : "PDF adjuntado como versión disponible.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo adjuntar el PDF.");
    } finally {
      setBusy(false);
    }
  }

  async function changeState(item: LegalDocumentRow, action: "activate" | "archive") {
    if (!canManage || (action === "archive" && !window.confirm(`¿Archivar “${item.title}”? Los contratos históricos conservarán el PDF.`))) return;
    setWorkingId(item.id); setMessage(null); setError(null);
    try {
      const response = await fetch(`/api/routsify/settings/legal-documents/${encodeURIComponent(item.id)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.ok) throw new Error(friendlyError(result?.error));
      const updated = result.data as LegalDocumentRow;
      setDocuments((current) => sorted(current.map((document) => {
        if (document.id === updated.id) return updated;
        if (action === "activate" && document.document_type === updated.document_type) return { ...document, is_active: false };
        return document;
      })));
      setMessage(action === "activate" ? "Versión vigente actualizada." : "Documento archivado sin afectar a contratos históricos.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo actualizar el documento.");
    } finally {
      setWorkingId(null);
    }
  }

  return <div className="legal-documents-panel">
    <section className="card">
      <div className="panel-head"><div><h3>Adjuntar nueva versión</h3><p>Los archivos se guardan de forma privada. Al activar una versión, sustituye a la vigente del mismo tipo sin borrar el histórico.</p></div><span className="badge">PDF · máx. 15 MB</span></div>
      <form className="form" onSubmit={uploadDocument}>
        <div className="grid grid-2">
          <label>Tipo de documento *<select value={documentType} disabled={!canManage || busy} onChange={(event) => { const nextType = event.target.value; setDocumentType(nextType); if (nextType !== "other") setTitle(typeLabel(nextType)); }}>{documentTypes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label>Versión o vigencia *<input className="input" required value={versionLabel} disabled={!canManage || busy} onChange={(event) => setVersionLabel(event.target.value)} placeholder="Ej. 2026.1 o 21/07/2026" /></label>
        </div>
        <label>Título *<input className="input" required minLength={3} value={title} disabled={!canManage || busy} onChange={(event) => setTitle(event.target.value)} /></label>
        <label>Archivo PDF *<input id="legal-document-file" className="input" type="file" accept=".pdf,application/pdf" required disabled={!canManage || busy} onChange={(event) => setFile(event.target.files?.[0] || null)} /></label>
        <label className="checkbox-control"><input type="checkbox" checked={activate} disabled={!canManage || busy} onChange={(event) => setActivate(event.target.checked)} /> Marcar esta versión como vigente</label>
        <div className="form-actions"><button className="btn" type="submit" disabled={!canManage || busy || !file}>{busy ? "Adjuntando…" : "Adjuntar PDF"}</button></div>
      </form>
      {!canManage ? <p className="form-warning">Puedes consultar los documentos; solo un administrador puede adjuntar o cambiar versiones.</p> : null}
    </section>

    <section className="card">
      <div className="panel-head"><div><h3>Biblioteca legal</h3><p>El contrato de viaje vigente se selecciona en cada expediente. El resto de documentos vigentes se incorpora a su evidencia legal.</p></div><span className="badge">{documents.length} versiones</span></div>
      {documents.length ? <div className="table-scroll"><table><thead><tr><th>Documento</th><th>Versión</th><th>Archivo</th><th>Estado</th><th></th></tr></thead><tbody>{documents.map((item) => <tr key={item.id}>
        <td><strong>{item.title}</strong><br /><small>{typeLabel(item.document_type)} · {dateTime(item.created_at)}</small></td>
        <td>{item.version_label}</td>
        <td><a href={`/api/routsify/legal-documents/${encodeURIComponent(item.id)}/file`} target="_blank" rel="noreferrer">Abrir PDF</a><br /><small>{item.file_name} · {fileSize(item.size_bytes)}</small></td>
        <td><span className={`status-pill ${item.is_active ? "status-success" : item.status === "archived" ? "" : "status-warning"}`}>{item.is_active ? "Vigente" : item.status === "archived" ? "Archivado" : "Disponible"}</span></td>
        <td>{canManage && item.status !== "archived" ? <div className="form-actions">{!item.is_active ? <button className="link-button" type="button" disabled={workingId === item.id} onClick={() => void changeState(item, "activate")}>Activar</button> : null}<button className="link-button danger-text" type="button" disabled={workingId === item.id} onClick={() => void changeState(item, "archive")}>Archivar</button></div> : "—"}</td>
      </tr>)}</tbody></table></div> : <div className="empty-state"><h3>Aún no hay documentación legal</h3><p>Adjunta primero el contrato de viaje. No será posible enviar un contrato sin seleccionar un PDF legal.</p></div>}
    </section>
    {message ? <p className="client-message" role="status">{message}</p> : null}
    {error ? <p className="form-warning" role="alert">{error}</p> : null}
  </div>;
}
