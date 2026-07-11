"use client";

export function CloseManager() {
  return (
    <section className="card">
      <div className="eyebrow">Cierre</div>
      <h2>Cierre integrado en Expedientes</h2>
      <p>Esta pantalla legacy queda desactivada. El cierre operativo se gestiona dentro del módulo Expedientes.</p>
      <a className="btn" href="/expedientes">Ir a Expedientes</a>
    </section>
  );
}
