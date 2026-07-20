import { notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { requireAppPermission } from "@/lib/app-auth";
import { getOrganizationClient360 } from "@/lib/client-360-server";
import { BookingApiPanel } from "./BookingApiPanel";
import { Client360Workspace } from "./Client360Workspace";
import { ClientProfileSection } from "./ClientProfileSection";
import "./client-360.css";
import "./client-profile.css";

type Row = Record<string, unknown>;

function numberValue(value: unknown) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function relation(value: unknown): Row | null {
  if (Array.isArray(value)) return value[0] && typeof value[0] === "object" ? value[0] as Row : null;
  return value && typeof value === "object" ? value as Row : null;
}

function clientMetrics(data: { cases: Row[]; proposals: Row[]; payments: Row[] }) {
  const accepted = data.proposals.filter((proposal) => String(proposal.status || "") === "accepted");
  const acceptedSale = accepted.reduce((sum, proposal) => sum + numberValue(relation(proposal.current_version)?.total_sale), 0);
  const paid = data.payments
    .filter((payment) => ["confirmed", "paid", "received"].includes(String(payment.status || "")))
    .reduce((sum, payment) => sum + numberValue(payment.amount), 0);
  return {
    acceptedSale,
    paid,
    acceptedTrips: accepted.length,
    activeCases: data.cases.filter((item) => String(item.status || "") !== "closed").length,
  };
}

export default async function Client360Page({ params }: { params: Promise<{ clientId: string }> }) {
  const session = await requireAppPermission("clients.view");
  const { clientId } = await params;
  const result = await getOrganizationClient360(session.organizationId, clientId);
  if (!result.ok) {
    if (result.error === "client_not_found") notFound();
    throw new Error(result.error);
  }

  const name = String(result.data.client.display_name || "Cliente");
  const contact = String(result.data.client.email || result.data.client.phone || "Ficha operativa completa");
  const metrics = clientMetrics(result.data);

  return <AppShell>
    <PageHeader
      eyebrow="Cliente 360"
      title={name}
      description={contact}
    />
    <Client360Workspace data={result.data} />
    <ClientProfileSection initialClient={result.data.client} communications={result.data.communications} metrics={metrics} />
    <BookingApiPanel client={result.data.client} initialBookings={result.data.bookings} />
  </AppShell>;
}
