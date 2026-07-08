import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "Content-Type": "application/json" },
});

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const configuredSecret = Deno.env.get("WEBHOOK_SECRET");
  const receivedSecret = req.headers.get("x-routsify-secret");
  if (configuredSecret && receivedSecret !== configuredSecret) {
    return json({ error: "unauthorized" }, 401);
  }

  const payload = await req.json().catch(() => null);
  if (!payload) return json({ error: "invalid_json" }, 400);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const orgSlug = payload.organization_slug ?? "routsify-demo";
  const { data: org, error: orgError } = await supabase
    .from("organizations")
    .select("id")
    .eq("slug", orgSlug)
    .single();

  if (orgError || !org) return json({ error: "organization_not_found" }, 404);

  const externalBookingId = String(payload.external_booking_id ?? payload.id ?? "");
  if (!externalBookingId) return json({ error: "missing_external_booking_id" }, 400);

  const eventType = String(payload.event_type ?? "booking.created");
  const email = String(payload.email ?? payload.customer?.email ?? "").trim().toLowerCase();
  let clientId: string | null = null;

  if (email) {
    const existing = await supabase
      .from("clients")
      .select("id")
      .eq("organization_id", org.id)
      .eq("email_normalized", email)
      .maybeSingle();
    clientId = existing.data?.id ?? null;
  }

  const booking = await supabase
    .from("bookings")
    .upsert({
      organization_id: org.id,
      client_id: clientId,
      external_booking_id: externalBookingId,
      event_type: eventType,
      starts_at: payload.starts_at ?? payload.start_time ?? null,
      ends_at: payload.ends_at ?? payload.end_time ?? null,
      status: payload.status ?? "created",
      payload,
    }, { onConflict: "organization_id,external_booking_id,event_type" })
    .select("id")
    .single();

  if (booking.error) return json({ error: booking.error.message }, 500);
  return json({ ok: true, booking_id: booking.data.id, client_id: clientId });
});
