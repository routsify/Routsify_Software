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

  const email = String(payload.email ?? "").trim().toLowerCase();
  const phone = String(payload.phone ?? "").replace(/\D/g, "");
  const displayName = String(payload.name ?? payload.display_name ?? email ?? "Lead sin nombre");

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

  if (!clientId) {
    const created = await supabase
      .from("clients")
      .insert({
        organization_id: org.id,
        display_name: displayName,
        email,
        email_normalized: email,
        phone: payload.phone ?? null,
        phone_normalized: phone || null,
        source: "fillout",
      })
      .select("id")
      .single();
    if (created.error) return json({ error: created.error.message }, 500);
    clientId = created.data.id;
  }

  const submissionId = String(payload.submission_id ?? crypto.randomUUID());
  const lead = await supabase
    .from("leads")
    .upsert({
      organization_id: org.id,
      client_id: clientId,
      source: "fillout",
      source_submission_id: submissionId,
      payload_redacted: payload,
      status: "new",
      campaign: payload.campaign ?? null,
      destination: payload.destination ?? null,
      travel_start: payload.travel_start ?? null,
      travel_end: payload.travel_end ?? null,
      budget_hint: payload.budget_hint ?? null,
    }, { onConflict: "organization_id,source,source_submission_id" })
    .select("id")
    .single();

  if (lead.error) return json({ error: lead.error.message }, 500);
  return json({ ok: true, lead_id: lead.data.id, client_id: clientId });
});
