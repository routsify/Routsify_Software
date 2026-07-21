"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";

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
        placeholder="Buscar en Routsify…"
      />
      <button type="submit" aria-label="Buscar"><Search aria-hidden="true" size={18} /><span>Buscar</span></button>
    </form>
  );
}
