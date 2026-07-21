import { NextRequest, NextResponse } from "next/server";
import { jsonAccessDenied, requireInternalAccess } from "@/lib/api-security";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

const actions = ["mark_won", "mark_lost", "archive", "reopen", "mark_form_sent", "mark_booking_sent", "convert"] as const;
type ReviewAction = (typeof actions)[number];

function isReviewAction(value: unknown): value is ReviewAction {
  return actions.includes(String(value) as ReviewAction);
}

function reviewPatch(action: ReviewAction, actorId: string, note: string | null) {
  const now = new Date().toISOString();
  if (action === "mark_form_sent") {
    return { form_reminder_sent_at: now, ...(note ? { review_note: note } : {}), updated_at: now };
  }
  if (action === "mark_booking_sent") {
    return { booking_invite_sent_at: now, ...(note ? { review_note: note } : {}), updated_at: now };
  }
  if (action === "convert") {
    return {
      status: "converted",
      review_status: "reviewed",
      outcome: "open",
      reviewed_at: now,
      reviewed_by: actorId,
      review_note: note || "Formulario y llamada confirmados; oportunidad convertida manualmente.",
      archived_at: null,
      updated_at: now,
    };
  }
  if (action === "mark_won") {
    return {
      status: "won",
      review_status: "reviewed",
      outcome: "won",
      reviewed_at: now,
      reviewed_by: actorId,
      review_note: note || "Compra confirmada manualmente.",
      archived_at: null,
      updated_at: now,
    };
  }
  if (action === "mark_lost") {
    return {
      status: "lost",
      review_status: "reviewed",
      outcome: "lost",
      reviewed_at: now,
      reviewed_by: actorId,
      review_note: note || "Solicitud cerrada sin compra.",
      archived_at: now,
      updated_at: now,
    };
  }
  if (action === "archive") {
    return {
      status: "archived",
      review_status: "reviewed",
      outcome: "unknown",
      reviewed_at: now,
      reviewed_by: actorId,
      review_note: note || "Solicitud revisada y archivada sin resultado verificable.",
      archived_at: now,
      updated_at: now,
    };
  }
  return {
    status: "qualified",
    review_status: "pending",
    outcome: "open",
    reviewed_at: null,
    reviewed_by: null,
    review_note: note || "Solicitud reabierta para seguimiento.",
    archived_at: null,
    updated_at: now,
  };
}

export async function PATCH(request: NextRequest) {
  const access = await requireInternalAccess(request);
  if (!access.ok) return jsonAccessDenied(access);

  const body = await request.json().catch(() => null) as {
    leadId?: unknown;
    action?: unknown;
    note?: unknown;
  } | null;
  const leadId = String(body?.leadId || "");
  const action = body?.action;
  const note = String(body?.note || "").trim().slice(0, 500) || null;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(leadId) || !isReviewAction(action)) {
    return NextResponse.json({ ok: false, error: "invalid_lead_review" }, { status: 400 });
  }

  const db = getSupabaseAdminClient();
  const { data: current, error: readError } = await db
    .from("leads")
    .select("id,client_id,status,review_status,outcome,review_note,reviewed_at,reviewed_by,archived_at,form_received_at,call_booked_at,form_reminder_sent_at,booking_invite_sent_at")
    .eq("organization_id", access.organizationId)
    .eq("id", leadId)
    .maybeSingle();
  if (readError) return NextResponse.json({ ok: false, error: readError.message }, { status: 500 });
  if (!current) return NextResponse.json({ ok: false, error: "lead_not_found" }, { status: 404 });
  if (action === "convert" && (!current.form_received_at || !current.call_booked_at)) {
    return NextResponse.json({ ok: false, error: "lead_intake_incomplete" }, { status: 409 });
  }

  const patch = reviewPatch(action, access.actorId, note);
  const { data: lead, error: updateError } = await db
    .from("leads")
    .update(patch)
    .eq("organization_id", access.organizationId)
    .eq("id", leadId)
    .select("id,status,review_status,outcome,review_note,reviewed_at,reviewed_by,archived_at,form_received_at,call_booked_at,form_reminder_sent_at,booking_invite_sent_at,updated_at")
    .single();
  if (updateError) return NextResponse.json({ ok: false, error: updateError.message }, { status: 500 });

  const { error: auditError } = await db.from("audit_log").insert({
    organization_id: access.organizationId,
    actor_id: access.actorId,
    action: `lead_review.${action}`,
    entity_type: "lead",
    entity_id: leadId,
    before_data: current,
    after_data: lead,
  });
  if (auditError) return NextResponse.json({ ok: false, error: auditError.message }, { status: 500 });

  let warning: string | null = null;
  if (action === "reopen" && current.client_id) {
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const { error: taskError } = await db.from("tasks").upsert({
      organization_id: access.organizationId,
      client_id: current.client_id,
      title: "Revisar solicitud reabierta",
      status: "pending",
      priority: "high",
      due_at: tomorrow,
      assigned_to: access.actorId,
      payload: { source: "lead_review", lead_id: leadId, action_type: "review_reopened_lead" },
      idempotency_key: `lead_reopened:${leadId}`,
      updated_at: new Date().toISOString(),
    }, { onConflict: "organization_id,idempotency_key", ignoreDuplicates: false });
    if (taskError) warning = "lead_reopened_without_followup_task";
  }

  if (["mark_form_sent", "mark_booking_sent", "convert"].includes(action) && current.client_id) {
    const actionType = action === "mark_form_sent" ? "fillout_reminder" : action === "mark_booking_sent" ? "booking_invite" : "review_fillout";
    const { error: taskError } = await db.from("tasks")
      .update({ status: "done", updated_at: new Date().toISOString() })
      .eq("organization_id", access.organizationId)
      .eq("client_id", current.client_id)
      .in("status", ["pending", "in_progress"])
      .contains("payload", { action_type: actionType });
    if (taskError) warning = "lead_updated_without_task_completion";
  }

  if (["mark_form_sent", "mark_booking_sent", "convert"].includes(action) && current.client_id) {
    const titles: Record<string, string> = {
      mark_form_sent: "Formulario enviado manualmente",
      mark_booking_sent: "Enlace de reserva enviado manualmente",
      convert: "Oportunidad lista para trabajar",
    };
    const { error: timelineError } = await db.from("timeline_events").insert({
      organization_id: access.organizationId,
      client_id: current.client_id,
      event_type: `lead_review.${action}`,
      title: titles[action],
      payload: { lead_id: leadId },
      created_by: access.actorId,
    });
    if (timelineError) warning = "lead_updated_without_timeline_event";
  }

  return NextResponse.json({ ok: true, lead, warning });
}
