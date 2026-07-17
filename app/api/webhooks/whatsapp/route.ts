import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { verifyWhatsAppWebhookSignature, whatsappConfiguration } from "@/lib/whatsapp-cloud-server";

type WhatsAppWebhookPayload = {
  object?: string;
  entry?: Array<{
    changes?: Array<{
      value?: {
        statuses?: Array<Record<string, unknown>>;
        messages?: Array<Record<string, unknown>>;
        contacts?: Array<Record<string, unknown>>;
      };
    }>;
  }>;
};

function organizationId() {
  return process.env.ROUTSIFY_DEFAULT_ORGANIZATION_ID || "";
}

function digits(value: unknown) {
  return String(value || "").replace(/\D/g, "");
}

function safeEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(request: NextRequest) {
  const orgId = organizationId();
  if (!orgId) return new NextResponse("organization_not_configured", { status: 503 });
  const config = await whatsappConfiguration(orgId);
  const mode = request.nextUrl.searchParams.get("hub.mode");
  const token = request.nextUrl.searchParams.get("hub.verify_token") || "";
  const challenge = request.nextUrl.searchParams.get("hub.challenge") || "";
  if (mode === "subscribe" && config.verifyToken && safeEqual(token, config.verifyToken)) return new NextResponse(challenge, { status: 200, headers: { "content-type": "text/plain" } });
  return new NextResponse("verification_failed", { status: 403 });
}

export async function POST(request: NextRequest) {
  const orgId = organizationId();
  if (!orgId) return NextResponse.json({ ok: false, error: "organization_not_configured" }, { status: 503 });
  const rawBody = await request.text();
  const config = await whatsappConfiguration(orgId);
  const verification = verifyWhatsAppWebhookSignature(rawBody, request.headers.get("x-hub-signature-256"), config.appSecret);
  if (!verification.ok) return NextResponse.json({ ok: false, error: verification.error }, { status: verification.status });

  let payload: WhatsAppWebhookPayload | null = null;
  try {
    const parsed = JSON.parse(rawBody || "null");
    payload = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as WhatsAppWebhookPayload : null;
  } catch {
    payload = null;
  }
  if (!payload) return NextResponse.json({ ok: false, error: "invalid_whatsapp_payload" }, { status: 400 });
  if (payload.object && payload.object !== "whatsapp_business_account") return NextResponse.json({ ok: true, ignored: true, reason: "unsupported_whatsapp_object" });

  const db = getSupabaseAdminClient();
  let statusUpdates = 0;
  let replies = 0;

  for (const entry of payload.entry || []) {
    for (const change of entry.changes || []) {
      const value = change.value || {};
      for (const status of value.statuses || []) {
        const messageId = String(status.id || "");
        const providerStatus = String(status.status || "");
        if (!messageId || !providerStatus) continue;
        const timestampValue = Number(status.timestamp);
        const timestamp = Number.isFinite(timestampValue) ? new Date(timestampValue * 1000).toISOString() : new Date().toISOString();
        const patch: Record<string, unknown> = { provider_status: providerStatus, updated_at: new Date().toISOString() };
        if (providerStatus === "delivered") patch.delivered_at = timestamp;
        if (providerStatus === "read") patch.read_at = timestamp;
        if (providerStatus === "failed") {
          patch.failed_at = timestamp;
          patch.provider_error = JSON.stringify(status.errors || []).slice(0, 2000);
        }
        const { error } = await db.from("communication_followups").update(patch).eq("organization_id", orgId).eq("provider", "meta_whatsapp_cloud").eq("provider_message_id", messageId);
        if (!error) statusUpdates += 1;
      }

      for (const message of value.messages || []) {
        const from = digits(message.from);
        if (!from) continue;
        const { data: followup } = await db
          .from("communication_followups")
          .select("id,case_id,client_id,task_id,kind,channel,recipient_name,sequence_step,metadata")
          .eq("organization_id", orgId)
          .eq("channel", "whatsapp")
          .eq("recipient_phone", from)
          .eq("status", "sent")
          .order("sent_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (!followup) continue;
        const now = new Date().toISOString();
        await db.from("communication_followups").update({ status: "answered", answered_at: now, provider_status: "reply_received", updated_at: now, metadata: { ...(followup.metadata || {}), inbound_message_id: message.id || null, inbound_type: message.type || null } }).eq("id", followup.id).eq("organization_id", orgId);
        if (followup.task_id) await db.from("tasks").update({ status: "done", updated_at: now }).eq("id", followup.task_id).eq("organization_id", orgId).in("status", ["pending", "in_progress"]);
        await db.from("timeline_events").insert({
          organization_id: orgId,
          case_id: followup.case_id || null,
          client_id: followup.client_id || null,
          event_type: "communication.answered",
          title: "Respuesta recibida por WhatsApp",
          payload: { communication_followup_id: followup.id, kind: followup.kind, channel: "whatsapp", recipient_name: followup.recipient_name, sequence_step: followup.sequence_step, inbound_message_id: message.id || null },
          created_by: null,
        });
        replies += 1;
      }
    }
  }

  return NextResponse.json({ ok: true, statusUpdates, replies });
}
