import { NextRequest, NextResponse } from "next/server";
import { jsonAccessDenied, requireInternalAccess } from "@/lib/api-security";
import { testFilloutConnection } from "@/lib/fillout-api-server";
import { testHoldedModules } from "@/lib/holded-server";
import { recordIntegrationRun } from "@/lib/integration-health-server";
import { testOpenAIConnection } from "@/lib/openai-ocr-server";
import { resolveOrganizationId } from "@/lib/request-context";
import { testRoutsifyBookingApi } from "@/lib/routsify-booking-api-server";
import { testSmtpConnection } from "@/lib/smtp-email-server";
import { testWhatsAppConnection } from "@/lib/whatsapp-cloud-server";

async function recordedResponse(input: {
  organizationId: string;
  integration: string;
  startedAt: string;
  ok: boolean;
  status: number;
  summary: string;
  error?: string;
  data?: unknown;
}) {
  await recordIntegrationRun({
    organizationId: input.organizationId,
    integration: input.integration,
    kind: "connection_test",
    status: input.ok ? "done" : "failed",
    startedAt: input.startedAt,
    triggerSource: "settings",
    summary: input.summary,
    lastError: input.error,
    metadata: { http_status: input.status },
  }).catch(() => undefined);
  return NextResponse.json({ ok: input.ok, integration: input.integration, data: input.data, error: input.error }, { status: input.status });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ integration: string }> }) {
  const access = await requireInternalAccess(request);
  if (!access.ok) return jsonAccessDenied(access);
  const { integration } = await params;
  const organizationId = await resolveOrganizationId(request, access.organizationId);
  const startedAt = new Date().toISOString();
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
      const status = fullyReady ? 200 : data.invalidKey ? 401 : 424;
      return recordedResponse({ organizationId, integration, startedAt, ok: fullyReady, status, summary: fullyReady ? "Módulos requeridos de Holded disponibles." : "Holded requiere revisar clave o permisos.", error, data: { ...data, fullyReady } });
    }
    if (integration === "openai") {
      const data = await testOpenAIConnection(organizationId);
      return recordedResponse({ organizationId, integration, startedAt, ok: data.ok, status: data.ok ? 200 : data.status, summary: data.ok ? "Conexión de OpenAI verificada." : "No se pudo verificar OpenAI.", error: data.ok ? undefined : "openai_connection_failed", data });
    }
    if (integration === "email") {
      const data = await testSmtpConnection(organizationId);
      return recordedResponse({ organizationId, integration, startedAt, ok: data.ok, status: data.ok ? 200 : data.status, summary: data.ok ? "Conexión SMTP verificada." : "No se pudo verificar el servidor SMTP.", error: data.ok ? undefined : data.error, data });
    }
    if (integration === "whatsapp") {
      const data = await testWhatsAppConnection(organizationId);
      return recordedResponse({ organizationId, integration, startedAt, ok: data.ok, status: data.ok ? 200 : data.status, summary: data.ok ? "Conexión con Meta Cloud API verificada." : "No se pudo verificar WhatsApp.", error: data.ok ? undefined : data.error, data });
    }
    if (integration === "fillout") {
      const data = await testFilloutConnection(organizationId);
      return recordedResponse({ organizationId, integration, startedAt, ok: data.ok, status: data.ok ? 200 : data.status, summary: data.ok ? "Formulario de Fillout accesible." : "No se pudo verificar Fillout.", error: data.ok ? undefined : data.error, data });
    }
    if (integration === "booking") {
      const data = await testRoutsifyBookingApi(organizationId);
      return recordedResponse({ organizationId, integration, startedAt, ok: data.ok, status: data.ok ? 200 : data.status, summary: data.ok ? "API de reservas accesible." : "No se pudo verificar Routsify Booking.", error: data.ok ? undefined : data.error, data });
    }
    return NextResponse.json({ ok: false, integration, error: "unsupported_integration" }, { status: 404 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "integration_test_failed";
    return recordedResponse({ organizationId, integration, startedAt, ok: false, status: 500, summary: "La prueba de conexión terminó con un error.", error: message });
  }
}
