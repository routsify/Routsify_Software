import { NextRequest, NextResponse } from "next/server";
import { jsonAccessDenied, requireInternalAccess } from "@/lib/api-security";
import { testFilloutApi } from "@/lib/fillout-api-server";
import { testHoldedModules } from "@/lib/holded-server";
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
      return NextResponse.json({ ok: data.ok, integration, data }, { status: data.ok ? 200 : 424 });
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
      const data = await testFilloutApi(organizationId);
      return NextResponse.json({ ok: data.ok, integration, data, error: data.ok ? undefined : data.error }, { status: data.ok ? 200 : data.status });
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
