export default function Loading() {
  return (
    <div className="page-state" role="status" aria-live="polite">
      <span className="loading-mark" aria-hidden="true" />
      <div>
        <strong>Cargando Routsify</strong>
        <p>Preparando la información operativa…</p>
      </div>
    </div>
  );
}
