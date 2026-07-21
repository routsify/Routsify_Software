import Link from "next/link";

export default function NotFound() {
  return (
    <div className="page-state">
      <div>
        <span className="eyebrow">Página no encontrada</span>
        <h1>Esta ruta no existe</h1>
        <p>Puede que el enlace haya cambiado o que el elemento ya no esté disponible.</p>
        <Link className="btn" href="/">Volver a Hoy</Link>
      </div>
    </div>
  );
}
