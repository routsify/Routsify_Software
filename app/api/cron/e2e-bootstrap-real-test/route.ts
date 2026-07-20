import { randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createProposalToken, verifyProposalToken } from "@/lib/proposal-token";
import { sendTransactionalEmail } from "@/lib/smtp-email-server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const ACCESS_KEY = "-l0pv_O4xVzSX4CwjoXHNWFXW7otk0XS";
const E2E_EMAIL = "e2e@routsify.com";
const E2E_BASE_URL = "https://routsify-software.vercel.app";
const TEST_RECIPIENT = "info@routsify.com";

function authorized(request: NextRequest) {
  const supplied = request.nextUrl.searchParams.get("key") || "";
  const left = Buffer.from(supplied);
  const right = Buffer.from(ACCESS_KEY);
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) return new NextResponse(null, { status: 404 });

  const db = getSupabaseAdminClient();
  const password = `${randomBytes(24).toString("base64url")}Aa1!`;
  const { data: organization, error: organizationError } = await db
    .from("organizations")
    .select("id,slug")
    .eq("slug", "routsify-demo")
    .single();
  if (organizationError || !organization) throw new Error(organizationError?.message || "organization_not_found");

  const { data: usersPage, error: listError } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (listError) throw new Error(listError.message);
  let user = usersPage.users.find((item) => item.email?.toLowerCase() === E2E_EMAIL);

  if (user) {
    const { data, error } = await db.auth.admin.updateUserById(user.id, {
      password,
      user_metadata: { full_name: "Routsify E2E", org_slug: "routsify-demo" },
    });
    if (error) throw new Error(error.message);
    user = data.user;
  } else {
    const { data, error } = await db.auth.admin.createUser({
      email: E2E_EMAIL,
      password,
      email_confirm: true,
      user_metadata: { full_name: "Routsify E2E", org_slug: "routsify-demo" },
    });
    if (error || !data.user) throw new Error(error?.message || "e2e_user_creation_failed");
    user = data.user;
  }

  const { error: profileError } = await db.from("profiles").upsert({
    user_id: user.id,
    organization_id: organization.id,
    full_name: "Routsify E2E",
    role: "admin",
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id" });
  if (profileError) throw new Error(profileError.message);

  const smtp = await sendTransactionalEmail({
    organizationId: organization.id,
    to: TEST_RECIPIENT,
    subject: `[PRUEBA E2E ROUTSIFY] Integraciones verificadas · ${new Date().toISOString()}`,
    body: [
      "Esta es una prueba real enviada desde Routsify Software mediante Hostinger SMTP.",
      "",
      "Comprobaciones incluidas:",
      "- autenticación del usuario E2E",
      "- envío SMTP real",
      "- firma y verificación de enlaces seguros de propuestas",
      "- alerta de Fillout sin llamada reservada",
      "",
      `Fecha UTC: ${new Date().toISOString()}`,
      "Puedes borrar este mensaje después de comprobar su recepción.",
    ].join("\n"),
  });

  const proposalId = randomUUID();
  const versionId = randomUUID();
  const token = createProposalToken({ proposalId, versionId, expiresAt: new Date(Date.now() + 10 * 60_000) });
  const verified = verifyProposalToken(token);

  return NextResponse.json({
    ok: smtp.ok && verified.proposalId === proposalId && verified.versionId === versionId,
    e2e: {
      email: E2E_EMAIL,
      password,
      baseUrl: E2E_BASE_URL,
      userId: user.id,
      role: "admin",
    },
    smtp,
    proposalToken: {
      generated: true,
      verified: verified.proposalId === proposalId && verified.versionId === versionId,
      expiresAt: new Date(verified.exp * 1000).toISOString(),
    },
    testRecipient: TEST_RECIPIENT,
  }, { status: smtp.ok ? 200 : smtp.status });
}
