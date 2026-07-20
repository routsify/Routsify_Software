"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export function GlobalSearch() {
  const router = useRouter();
  const [query, setQuery] = useState("");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleaned = query.trim();
    if (!cleaned) return;
    router.push(`/buscar?q=${encodeURIComponent(cleaned)}`);
  }

  return (
    <form className="global-search" onSubmit={submit} role="search">
      <input
        aria-label="Buscar"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Buscar clientes, proveedores, expedientes o compras..."
      />
      <button type="submit">Buscar</button>
    </form>
  );
}
