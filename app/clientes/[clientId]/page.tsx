import { notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { requireAppPermission } from "@/lib/app-auth";
import { getOrganizationClient360 } from "@/lib/client-360-server";
import { BookingApiPanel } from "./BookingApiPanel";
import { Client360Workspace } from "./Client360Workspace";
import "./client-360.css";

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

  return <AppShell>
    <PageHeader
      eyebrow="Cliente 360"
      title={name}
      description={contact}
    />
    <Client360Workspace data={result.data} />
    <BookingApiPanel client={result.data.client} initialBookings={result.data.bookings} />
  </AppShell>;
}
