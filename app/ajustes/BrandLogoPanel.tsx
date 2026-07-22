"use client";

import { ChangeEvent, useState } from "react";
import Image from "next/image";

const allowedTypes = new Set(["image/png", "image/jpeg", "image/webp"]);

export function BrandLogoPanel({ initialUrl = "", initialPath = "", canManage }: { initialUrl?: string; initialPath?: string; canManage: boolean }) {
  const [logoUrl, setLogoUrl] = useState(initialUrl);
  const [logoPath, setLogoPath] = useState(initialPath);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !canManage) return;
    if (!allowedTypes.has(file.type)) return setMessage("Usa una imagen PNG, JPG o WebP.");
    if (file.size > 5 * 1024 * 1024) return setMessage("El logo no puede superar 5 MB.");
    setBusy(true); setMessage(null);
    const signedResponse = await fetch("/api/routsify/settings/logo/upload-url", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ fileName: file.name, mimeType: file.type, sizeBytes: file.size }) });
    const signed = await signedResponse.json().catch(() => null);
    if (!signedResponse.ok || !signed?.ok) { setBusy(false); return setMessage(String(signed?.error || "No se pudo preparar la subida.")); }
    const uploadResponse = await fetch(signed.signedUrl, { method: "PUT", headers: { "content-type": file.type }, body: file });
    if (!uploadResponse.ok) { setBusy(false); return setMessage("No se pudo subir la imagen."); }
    const confirmResponse = await fetch("/api/routsify/settings/logo", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ path: signed.path, mimeType: file.type, sizeBytes: file.size }) });
    const result = await confirmResponse.json().catch(() => null);
    setBusy(false);
    if (!confirmResponse.ok || !result?.ok) return setMessage(String(result?.error || "No se pudo aplicar el logo."));
    setLogoUrl(String(result.data.url)); setLogoPath(String(result.data.path));
    setMessage("Logo guardado y aplicado en la marca del sistema.");
    window.location.reload();
  }

  async function remove() {
    if (!canManage || !logoPath || !window.confirm("¿Quitar el logo personalizado y volver al símbolo de Routsify?")) return;
    setBusy(true); setMessage(null);
    const response = await fetch("/api/routsify/settings/logo", { method: "DELETE" });
    const result = await response.json().catch(() => null);
    setBusy(false);
    if (!response.ok || !result?.ok) return setMessage(String(result?.error || "No se pudo quitar el logo."));
    setLogoUrl(""); setLogoPath(""); setMessage("Logo personalizado eliminado.");
    window.location.reload();
  }

  return <article className="setting-field brand-logo-panel">
    <div className="setting-field-head"><div><strong>Logo corporativo</strong><p>Se aplica a la navegación, acceso, presupuestos públicos y páginas de marca. Formato PNG, JPG o WebP; máximo 5 MB.</p></div></div>
    <div className="brand-logo-control">
      <div className="brand-logo-preview">{logoUrl ? <Image src={logoUrl} alt="Logo corporativo actual" width={112} height={112} /> : <span aria-label="Sin logo personalizado">✦</span>}</div>
      <div className="form-actions"><label className="btn secondary">{busy ? "Procesando…" : logoUrl ? "Cambiar imagen" : "Adjuntar imagen"}<input className="sr-only" type="file" accept="image/png,image/jpeg,image/webp" disabled={!canManage || busy} onChange={(event) => void upload(event)} /></label>{logoPath ? <button className="btn secondary" type="button" disabled={!canManage || busy} onClick={() => void remove()}>Quitar logo</button> : null}</div>
    </div>
    {message ? <p className="client-message" role="status">{message}</p> : null}
  </article>;
}
