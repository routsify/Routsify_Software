import { NextRequest, NextResponse } from "next/server";
import { jsonAccessDenied, requireInternalAccess } from "@/lib/api-security";
import { testFilloutConnection } from "@/lib/fillout-api-server";
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
      const fullyReady = data.ok && data.missingReadScopes.length === 0 && data.availableModules.length === Object.keys(data.modules).length;
      const error = fullyReady
        ? undefined
        : data.invalidKey
          ? "La API Key de Holded es inválida, está revocada o se ha copiado incompleta. Genera una nueva clave en Holded → Ajustes → API."
          : data.missingReadScopes.length
            ? `La clave es válida, pero faltan permisos de lectura: ${data.missingReadScopes.join(", ")}. Actívalos en Holded y guarda de nuevo la clave.`
            : "Holded no ha permitido consultar todos los módulos necesarios. Revisa que la clave incluya permisos de lectura y escritura para contactos, presupuestos, proformas, facturas, compras y pagos.";
      return NextResponse.json({ ok: fullyReady, integration, data: { ...data, fullyReady }, error }, { status: fullyReady ? 200 : data.invalidKey ? 401 : 424 });
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
      const data = await testFilloutConnection(organizationId);
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
