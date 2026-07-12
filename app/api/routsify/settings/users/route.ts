import { NextRequest, NextResponse } from "next/server";
import { jsonAccessDenied, requireInternalAccess } from "@/lib/api-security";
import { resolveOrganizationId } from "@/lib/request-context";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { appRoles, type AppRole } from "@/lib/settings-master";

const roleSet = new Set<string>(appRoles);

async function requireAdministrator(request: NextRequest) {
  const access = await requireInternalAccess(request);
  if (!access.ok) return { response: jsonAccessDenied(access), access: null };
  if (access.role !== "admin") return { response: NextResponse.json({ ok: false, error: "admin_required" }, { status: 403 }), access: null };
  return { response: null, access };
}

export async function GET(request: NextRequest) {
  const guard = await requireAdministrator(request);
  if (!guard.access) return guard.response;

  const organizationId = await resolveOrganizationId(request, guard.access.organizationId);
  const supabase = getSupabaseAdminClient();
  const [{ data: profiles, error: profileError }, { data: authData, error: authError }] = await Promise.all([
    supabase.from("profiles").select("user_id,full_name,role,created_at,updated_at").eq("organization_id", organizationId).order("created_at", { ascending: true }),
    supabase.auth.admin.listUsers({ page: 1, perPage: 1000 }),
  ]);

  if (profileError || authError) return NextResponse.json({ ok: false, error: profileError?.message || authError?.message || "users_load_failed" }, { status: 400 });
  const authUsers = new Map((authData.users || []).map((user) => [user.id, user]));
  const users = (profiles || []).map((profile) => {
    const user = authUsers.get(String(profile.user_id));
    return {
      id: String(profile.user_id),
      fullName: String(profile.full_name || user?.user_metadata?.full_name || "Usuario"),
      email: String(user?.email || ""),
      role: String(profile.role || "viewer"),
      status: user?.email_confirmed_at ? "active" : "invited",
      invitedAt: user?.invited_at || user?.created_at || profile.created_at,
      lastSignInAt: user?.last_sign_in_at || null,
      updatedAt: profile.updated_at,
      current: String(profile.user_id) === guard.access.actorId,
    };
  });

  return NextResponse.json({ ok: true, data: users });
}

export async function POST(request: NextRequest) {
  const guard = await requireAdministrator(request);
  if (!guard.access) return guard.response;

  const body = await request.json().catch(() => null);
  const email = String(body?.email || "").trim().toLowerCase();
  const fullName = String(body?.fullName || "").trim();
  const role = String(body?.role || "viewer") as AppRole;
  if (!/^\S+@\S+\.\S+$/.test(email)) return NextResponse.json({ ok: false, error: "invalid_email" }, { status: 400 });
  if (fullName.length < 2 || fullName.length > 120) return NextResponse.json({ ok: false, error: "invalid_full_name" }, { status: 400 });
  if (!roleSet.has(role)) return NextResponse.json({ ok: false, error: "invalid_role" }, { status: 400 });

  const organizationId = await resolveOrganizationId(request, guard.access.organizationId);
  const supabase = getSupabaseAdminClient();
  const { data: organization } = await supabase.from("organizations").select("slug").eq("id", organizationId).maybeSingle();
  const redirectTo = `${request.nextUrl.origin}/login`;
  const { data, error } = await supabase.auth.admin.inviteUserByEmail(email, {
    redirectTo,
    data: { full_name: fullName, org_slug: String(organization?.slug || "routsify-demo") },
  });

  if (error || !data.user) return NextResponse.json({ ok: false, error: error?.message || "invite_failed" }, { status: 400 });

  const { error: profileError } = await supabase.from("profiles").upsert({
    user_id: data.user.id,
    organization_id: organizationId,
    full_name: fullName,
    role,
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id" });
  if (profileError) return NextResponse.json({ ok: false, error: profileError.message }, { status: 400 });

  await supabase.from("routsify_settings_audit_log").insert({
    organization_id: organizationId,
    module: "security",
    key: "users.invite",
    setting_key: "users.invite",
    new_value: { user_id: data.user.id, email, role },
    action: "create",
    actor_id: guard.access.actorId,
    event_name: "roles.updated",
    requires_recalculation: false,
  });

  return NextResponse.json({ ok: true, data: { id: data.user.id, fullName, email, role, status: "invited", invitedAt: data.user.invited_at || data.user.created_at, lastSignInAt: null, current: false } }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const guard = await requireAdministrator(request);
  if (!guard.access) return guard.response;

  const body = await request.json().catch(() => null);
  const userId = String(body?.userId || "");
  const role = String(body?.role || "") as AppRole;
  const fullName = body?.fullName === undefined ? null : String(body.fullName || "").trim();
  if (!userId || !roleSet.has(role)) return NextResponse.json({ ok: false, error: "invalid_user_update" }, { status: 400 });
  if (fullName !== null && (fullName.length < 2 || fullName.length > 120)) return NextResponse.json({ ok: false, error: "invalid_full_name" }, { status: 400 });

  const organizationId = await resolveOrganizationId(request, guard.access.organizationId);
  const supabase = getSupabaseAdminClient();
  const { data: current, error: currentError } = await supabase.from("profiles").select("role,full_name").eq("user_id", userId).eq("organization_id", organizationId).maybeSingle();
  if (currentError || !current) return NextResponse.json({ ok: false, error: currentError?.message || "user_not_found" }, { status: 404 });

  if (current.role === "admin" && role !== "admin") {
    const { count } = await supabase.from("profiles").select("user_id", { count: "exact", head: true }).eq("organization_id", organizationId).eq("role", "admin");
    if ((count || 0) <= 1) return NextResponse.json({ ok: false, error: "last_admin_cannot_be_demoted" }, { status: 409 });
  }

  const update = { role, ...(fullName !== null ? { full_name: fullName } : {}), updated_at: new Date().toISOString() };
  const { error } = await supabase.from("profiles").update(update).eq("user_id", userId).eq("organization_id", organizationId);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  if (fullName !== null) await supabase.auth.admin.updateUserById(userId, { user_metadata: { full_name: fullName } });

  await supabase.from("routsify_settings_audit_log").insert({
    organization_id: organizationId,
    module: "security",
    key: "users.role",
    setting_key: "users.role",
    old_value: { role: current.role, full_name: current.full_name },
    new_value: { user_id: userId, role, full_name: fullName ?? current.full_name },
    action: "update",
    actor_id: guard.access.actorId,
    event_name: "roles.updated",
    requires_recalculation: false,
  });

  return NextResponse.json({ ok: true, data: { id: userId, role, fullName: fullName ?? current.full_name } });
}
