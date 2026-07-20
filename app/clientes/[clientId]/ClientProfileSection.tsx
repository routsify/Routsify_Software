"use client";

import { useState } from "react";
import { ClientProfilePanel } from "./ClientProfilePanel";

type Row = Record<string, unknown>;
type Metrics = { acceptedSale: number; paid: number; acceptedTrips: number; activeCases: number };

export function ClientProfileSection({ initialClient, communications, metrics }: { initialClient: Row; communications: Row[]; metrics: Metrics }) {
  const [client, setClient] = useState(initialClient);
  return <ClientProfilePanel client={client} communications={communications} metrics={metrics} onSaved={setClient} />;
}
