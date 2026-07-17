import { NextRequest, NextResponse } from "next/server";
import { jsonAccessDenied, requireInternalAccess } from "@/lib/api-security";
import { updateCommunicationFollowupStatus } from "@/lib/communications-server";
import { sendTransactionalEmail } from "@/lib/smtp-email-server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { sendWhatsAppText } from "@/lib/whatsapp-cloud-server";

export async function POST(request: NextRequest, { params }: { params: Promise<{ followupId: string }> }) {
  const access = await requireInternalAccess(request);
  if (!access.ok) return jsonAccessDenied(access);
  const { followupId } = await params;
  const db = getSupabaseAdminClient();
  const { data: followup, error } = await db
    .from("communication_followups")
    .select("id,channel,recipient_email,recipient_phone,subject,body,status,provider,provider_message_id")
    .eq("id", followupId)
    .eq("organization_id", access.organizationId)
    .maybeSingle();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  if (!followup) return NextResponse.json({ ok: false, error: "communication_followup_not_found" }, { status: 404 });
  if (!['planned', 'prepared'].includes(String(followup.status))) return NextResponse.json({ ok: false, error: "communication_not_sendable" }, { status: 409 });

  try {
    if (followup.provider_message_id) {
      const data = await updateCommunicationFollowupStatus({ organizationId: access.organizationId, followupId, actorId: access.actorId, status: "sent" });
      return NextResponse.json({ ok: true, data, recovered: true });
    }

    const result = followup.channel === "email"
      ? await sendTransactionalEmail({ organizationId: access.organizationId, to: String(followup.recipient_email || ""), subject: String(followup.subject || "Mensaje de Routsify"), body: String(followup.body || "") })
      : await sendWhatsAppText({ organizationId: access.organizationId, to: String(followup.recipient_phone || ""), body: String(followup.body || "") });

    if (!result.ok) {
      await db.from("communication_followups").update({ provider_status: "failed", provider_error: result.error, failed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", followupId).eq("organization_id", access.organizationId);
      return NextResponse.json({ ok: false, error: result.error, data: result }, { status: result.status });
    }

    const provider = followup.channel === "email" ? "hostinger_smtp" : "meta_whatsapp_cloud";
    const { error: providerError } = await db.from("communication_followups").update({
      provider,
      provider_message_id: result.messageId,
      provider_status: "accepted",
      provider_error: null,
      failed_at: null,
      updated_at: new Date().toISOString(),
    }).eq("id", followupId).eq("organization_id", access.organizationId).is("provider_message_id", null);
    if (providerError) throw new Error(providerError.message);

    const data = await updateCommunicationFollowupStatus({ organizationId: access.organizationId, followupId, actorId: access.actorId, status: "sent" });
    return NextResponse.json({ ok: true, data: { ...data, provider, provider_message_id: result.messageId, provider_status: "accepted" } });
  } catch (sendError) {
    return NextResponse.json({ ok: false, error: sendError instanceof Error ? sendError.message : "communication_send_failed" }, { status: 500 });
  }
}
