"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="page-state" role="alert">
      <div>
        <span className="eyebrow">No hemos podido cargar esta vista</span>
        <h1>Algo ha fallado</h1>
        <p>La información sigue a salvo. Puedes volver a intentarlo o regresar al panel.</p>
        <div className="form-actions">
          <button className="btn" type="button" onClick={reset}>Reintentar</button>
          <Link className="btn secondary" href="/">Volver a Hoy</Link>
        </div>
      </div>
    </div>
  );
}
