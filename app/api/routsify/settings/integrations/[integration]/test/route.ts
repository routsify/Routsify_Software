import { NextRequest, NextResponse } from "next/server";
import { jsonAccessDenied, requireInternalAccess } from "@/lib/api-security";
import { testHoldedModules } from "@/lib/holded-server";
import { getWebhookIntegrationConfig } from "@/lib/integration-config-server";
import { testOpenAIConnection } from "@/lib/openai-ocr-server";
import { resolveOrganizationId } from "@/lib/request-context";
import { testRoutsifyBookingApi } from "@/lib/routsify-booking-api-server";
import { testSmtpConnection } from "@/lib/smtp-email-server";
import { testWhatsAppConnection } from "@/lib/whatsapp-cloud-server";

export async function POST(request: NextRequest, { params }: { params: Promise<{ integration: string }> }) {
  const access = await requireInternalAccess(request);
  if (!access.ok) return jsonAccessDenied(access);
  const { integration } = await params;
  const organizationId = await resolveOrganizationId(request, access.organizationId);
  try {
    if (integration === "holded") {
      const data = await testHoldedModules(organizationId);
      const error = data.ok
        ? undefined
        : data.invalidKey
          ? "holded_api_key_invalid"
          : data.missingReadScopes.length
            ? "holded_permissions_missing"
            : "holded_connection_unavailable";
      return NextResponse.json({ ok: data.ok, integration, data, error }, { status: data.ok ? 200 : data.invalidKey ? 401 : 424 });
    }
    if (integration === "openai") {
      const data = await testOpenAIConnection(organizationId);
      return NextResponse.json({ ok: data.ok, integration, data }, { status: data.ok ? 200 : data.status });
    }
    if (integration === "email") {
      const data = await testSmtpConnection(organizationId);
      return NextResponse.json({ ok: data.ok, integration, data, error: data.ok ? undefined : data.error }, { status: data.ok ? 200 : data.status });
    }
    if (integration === "whatsapp") {
      const data = await testWhatsAppConnection(organizationId);
      return NextResponse.json({ ok: data.ok, integration, data, error: data.ok ? undefined : data.error }, { status: data.ok ? 200 : data.status });
    }
    if (integration === "fillout") {
      const configuration = await getWebhookIntegrationConfig(organizationId, "fillout");
      const ok = configuration.enabled && Boolean(configuration.secret);
      const data = { enabled: configuration.enabled, secretConfigured: Boolean(configuration.secret) };
      return NextResponse.json({ ok, integration, data, error: ok ? undefined : configuration.enabled ? "fillout_webhook_secret_not_configured" : "fillout_integration_disabled" }, { status: ok ? 200 : 424 });
    }
    if (integration === "booking") {
      const data = await testRoutsifyBookingApi(organizationId);
      return NextResponse.json({ ok: data.ok, integration, data, error: data.ok ? undefined : data.error }, { status: data.ok ? 200 : data.status });
    }
    return NextResponse.json({ ok: false, integration, error: "unsupported_integration" }, { status: 404 });
  } catch (error) {
    return NextResponse.json({ ok: false, integration, error: error instanceof Error ? error.message : "integration_test_failed" }, { status: 500 });
  }
}
