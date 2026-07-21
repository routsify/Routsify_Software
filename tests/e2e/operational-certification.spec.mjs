import { test, expect } from "@playwright/test";

const enabled = process.env.E2E_OPERATIONAL_CERTIFICATION === "1";
const hasCredentials = Boolean(process.env.E2E_EMAIL && process.env.E2E_PASSWORD);

test.describe.configure({ mode: "serial", retries: 0 });

function text(value) {
  return String(value ?? "").trim();
}

function dateOffset(days) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function taggedEmail(email, tag) {
  const [local, domain] = text(email).toLowerCase().split("@");
  return local && domain ? `${local}+certificacion-${tag}@${domain}` : text(email).toLowerCase();
}

function redacted(value) {
  if (Array.isArray(value)) return value.map(redacted);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [
    key,
    /password|secret|token|authorization|username|api.?key/i.test(key) ? "[redacted]" : redacted(item),
  ]));
}

async function api(request, method, path, data, options = {}) {
  const response = await request.fetch(path, {
    method,
    timeout: options.timeout ?? 30_000,
    ...(data === undefined ? {} : { data }),
  });
  const raw = await response.text();
  let body = null;
  try { body = raw ? JSON.parse(raw) : null; } catch { body = { raw: raw.slice(0, 1000) }; }
  if (!response.ok() && (options.acceptedStatuses || []).includes(response.status())) {
    return {
      ...(body && typeof body === "object" && !Array.isArray(body) ? body : { data: body }),
      _responseStatus: response.status(),
    };
  }
  expect(response.ok(), `${method} ${path} devolvió ${response.status()}: ${JSON.stringify(redacted(body))}`).toBeTruthy();
  if (body && typeof body === "object" && "ok" in body) {
    expect(body.ok, `${method} ${path} respondió ok=false: ${JSON.stringify(redacted(body))}`).toBe(true);
  }
  return body;
}

async function signIn(page) {
  await page.goto("/login");
  await expect(page.getByLabel("Email")).toBeVisible();
  await page.getByLabel("Email").fill(process.env.E2E_EMAIL);
  await page.getByLabel("Contraseña").fill(process.env.E2E_PASSWORD);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page).toHaveURL(/\/(hoy|clientes|expedientes|propuestas)/, { timeout: 20_000 });
}

async function processOutbox(request) {
  const summary = { processed: 0, details: [] };
  for (let round = 0; round < 10; round += 1) {
    const result = await api(request, "POST", "/api/routsify/outbox/process", { limit: 50 });
    expect(result.failed, `El outbox falló en la ronda ${round + 1}`).toBe(0);
    expect(result.manualReview, `El outbox dejó revisión manual en la ronda ${round + 1}`).toBe(0);
    summary.processed += Number(result.processed || 0);
    summary.details.push(...(Array.isArray(result.details) ? result.details : []));
    if (!result.processed) break;
  }
  return summary;
}

const legacySyntheticBookingIds = [
  "763de89f-5dd3-45b2-99eb-7b607337469f",
  "a6f3e095-330a-4e23-b64d-30addf222d7c",
];

async function bookingMutation(request, method, path, data, { allowNotFound = false } = {}) {
  const retryableStatuses = [424, 429, 502, 503, 504];
  const acceptedStatuses = allowNotFound ? [...retryableStatuses, 404] : retryableStatuses;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const result = await api(request, method, path, data, { timeout: 60_000, acceptedStatuses });
    if (allowNotFound && result._responseStatus === 404) return null;
    if (!retryableStatuses.includes(result._responseStatus)) return result;
    if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, attempt * 500));
  }
  expect(false, `${method} ${path} agotó los reintentos transitorios`).toBe(true);
  return null;
}

async function cleanupSyntheticBookings(request) {
  const clients = await api(request, "GET", "/api/routsify/clients?paginated=1&pageSize=200&q=PRUEBA%20E2E");
  const rows = Array.isArray(clients.data?.items) ? clients.data.items : [];
  let cancelled = 0;
  let supportsListing = true;
  for (const client of rows.filter((item) => item.source === "production_certification" && text(item.display_name).startsWith("[PRUEBA E2E "))) {
    const result = await api(request, "GET", `/api/routsify/clients/booking/reservations?clientId=${encodeURIComponent(client.id)}`, undefined, { acceptedStatuses: [404, 405] });
    if ([404, 405].includes(result._responseStatus)) {
      supportsListing = false;
      break;
    }
    const bookings = Array.isArray(result.data?.bookings) ? result.data.bookings : [];
    for (const booking of bookings.filter((item) => text(item.status).toLowerCase() !== "cancelled" && text(item.external_booking_id || item.external_id))) {
      const response = await bookingMutation(request, "DELETE", `/api/routsify/clients/booking/reservations/${encodeURIComponent(booking.id)}`, undefined, { allowNotFound: true });
      if (!response) continue;
      expect(response.data.booking.status).toBe("cancelled");
      cancelled += 1;
    }
  }
  if (!supportsListing) {
    for (const bookingId of legacySyntheticBookingIds) {
      const response = await bookingMutation(request, "DELETE", `/api/routsify/clients/booking/reservations/${bookingId}`, undefined, { allowNotFound: true });
      if (!response) continue;
      expect(response.data.booking.status).toBe("cancelled");
      cancelled += 1;
    }
  }
  return cancelled;
}

function buildSyntheticPdf() {
  const content = [
    "BT",
    "/F1 18 Tf",
    "72 720 Td",
    "(TEST DOCUMENT - NOT VALID) Tj",
    "0 -32 Td",
    "/F1 12 Tf",
    "(Name: ANA PRUEBA) Tj",
    "0 -20 Td",
    "(Document: TEST-E2E-0001) Tj",
    "0 -20 Td",
    "(Nationality: ESP) Tj",
    "ET",
  ].join("\n");
  const objects = [
    "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
    "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n",
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>\nendobj\n",
    `4 0 obj\n<< /Length ${Buffer.byteLength(`${content}\n`, "latin1")} >>\nstream\n${content}\nendstream\nendobj\n`,
    "5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n",
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (const object of objects) {
    offsets.push(Buffer.byteLength(pdf, "latin1"));
    pdf += object;
  }
  const xrefOffset = Buffer.byteLength(pdf, "latin1");
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let index = 1; index <= objects.length; index += 1) pdf += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(pdf, "latin1");
}

test.describe("certificación operativa de producción", () => {
  test.skip(!enabled || !hasCredentials, "Requiere activación explícita y credenciales E2E.");

  test("un agente vende, documenta, cobra, concilia y cierra un viaje", async ({ page }) => {
    test.setTimeout(20 * 60_000);
    await signIn(page);
    const request = page.request;
    const runTag = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
    const clientPhone = `+34000${String(Math.floor(Math.random() * 1_000_000)).padStart(6, "0")}`;
    const clientEmail = taggedEmail(process.env.E2E_EMAIL, runTag);
    const tripStart = dateOffset(10);
    const tripEnd = dateOffset(13);
    const certification = { runTag, clientId: null, supplierId: null, caseId: null, caseCode: null, proposalId: null, purchaseId: null, documentId: null, ticketDocumentId: null, ocrRunId: null, paymentLinkId: null, bookingId: null, communicationId: null };

    await test.step("verificar conexiones configuradas", async () => {
      const health = await api(request, "GET", "/api/routsify/settings/integrations/health");
      expect(health.data.integrations).toHaveLength(6);
      for (const integration of ["holded", "openai", "email", "fillout", "booking"]) {
        const result = await api(request, "POST", `/api/routsify/settings/integrations/${integration}/test`, {});
        expect(result.integration).toBe(integration);
      }
      const filloutSync = await api(request, "POST", "/api/routsify/leads/sync-fillout", { maxPages: 2 }, { timeout: 120_000 });
      expect(filloutSync.data.skipped).toBe(false);
      expect(Number(filloutSync.data.failed || 0)).toBe(0);
      const whatsapp = health.data.integrations.find((item) => item.id === "whatsapp");
      expect(whatsapp).toBeTruthy();
      expect(["inactive", "setup_required", "disabled", "not_configured"]).toContain(whatsapp.state);
    });

    await test.step("cancelar reservas sintéticas activas de ensayos anteriores", async () => {
      await cleanupSyntheticBookings(request);
    });

    await test.step("crear cliente, proveedor y expediente sintéticos", async () => {
      const client = await api(request, "POST", "/api/routsify/clients", {
        display_name: `[PRUEBA E2E ${runTag}] Ana Prueba`,
        email: clientEmail,
        phone: clientPhone,
        client_type: "person",
        tax_id: `TEST-${runTag}`,
        billing_address: { address: "Calle Prueba 1", city: "Madrid", postal_code: "28001", country: "ES" },
        country: "ES",
        source: "production_certification",
        notes: "Dato sintético. Certificación operativa; no corresponde a una persona real.",
      });
      certification.clientId = text(client.data.id);
      expect(certification.clientId).toBeTruthy();
      await processOutbox(request);

      const supplier = await api(request, "POST", "/api/routsify/suppliers", {
        name: `[PRUEBA E2E ${runTag}] Hotel Certificación`,
        category: "accommodation",
        email: process.env.E2E_EMAIL,
        default_margin_pct: 33.3333,
        tax_id: `TEST-SUP-${runTag}`,
        country: "ES",
        billing_address: { address: "Avenida Prueba 2", city: "Lisboa", postal_code: "1000-001", country: "PT" },
        notes: "Proveedor sintético para certificación de producción.",
      });
      certification.supplierId = text(supplier.data.id);
      expect(certification.supplierId).toBeTruthy();
      expect(Number(supplier.data.default_margin_pct)).toBeCloseTo(33.3333, 3);

      const disposable = await api(request, "POST", "/api/routsify/clients", {
        display_name: `[PRUEBA E2E ${runTag}] Cliente eliminable`,
        email: taggedEmail(process.env.E2E_EMAIL, `${runTag}-delete`),
        client_type: "person",
        country: "ES",
        source: "production_certification",
      });
      await api(request, "DELETE", `/api/routsify/clients/${encodeURIComponent(disposable.data.id)}`);
      const deleted = await api(request, "GET", `/api/routsify/clients/${encodeURIComponent(disposable.data.id)}`, undefined, { acceptedStatuses: [404] });
      expect(deleted._responseStatus).toBe(404);

      const createdCase = await api(request, "POST", "/api/routsify/cases", {
        client_id: certification.clientId,
        destination: "Lisboa · PRUEBA E2E",
        title: `[PRUEBA E2E ${runTag}] Escapada integral a Lisboa`,
        trip_start: tripStart,
        trip_end: tripEnd,
        currency: "EUR",
        final_notes: "Certificación sintética de punta a punta. No es una reserva comercial real.",
      });
      certification.caseId = text(createdCase.data.id);
      certification.caseCode = text(createdCase.data.case_code);
      expect(certification.caseId).toBeTruthy();
      expect(certification.caseCode).toMatch(/^EXP-\d{4}-\d{4}$/);
    });

    let travelerId;
    await test.step("registrar viajero, documento privado y revisión OCR", async () => {
      const traveler = await api(request, "POST", `/api/routsify/cases/${certification.caseId}/travelers`, {
        traveler_type: "adult",
        first_name: "Ana",
        last_name: "Prueba",
        birth_date: "1990-01-01",
        nationality: "ES",
        document_country: "ES",
        document_number: `TEST-${runTag}`,
        document_expires_at: "2035-12-31",
      });
      travelerId = text(traveler.data.id);
      const pdf = buildSyntheticPdf();
      const upload = await api(request, "POST", "/api/documentos/upload-url", {
        caseCode: certification.caseCode,
        fileName: `TEST-NO-VALIDO-${runTag}.pdf`,
        sizeBytes: pdf.length,
        mimeType: "application/pdf",
        ownerType: "case",
      });
      const put = await request.put(upload.signedUrl, { data: pdf, headers: { "content-type": "application/pdf" } });
      expect(put.ok(), `La subida privada devolvió ${put.status()}`).toBeTruthy();

      const confirmed = await api(request, "POST", "/api/documentos/confirm-upload", {
        caseId: certification.caseId,
        ownerType: "case",
        title: "Documento sintético · NO VÁLIDO",
        type: "passport",
        bucket: upload.bucket,
        storagePath: upload.path,
        fileName: `TEST-NO-VALIDO-${runTag}.pdf`,
        mimeType: "application/pdf",
        sizeBytes: pdf.length,
        sensitivity: "sensitive",
        retentionDays: 30,
      });
      certification.documentId = text(confirmed.data.id);

      const ocr = await api(
        request,
        "POST",
        `/api/routsify/clients/documents/${certification.documentId}/ocr`,
        { travelerId },
        { timeout: 150_000 },
      );
      certification.ocrRunId = text(ocr.data.runId);
      expect(ocr.data.status).toBe("review_required");
      await api(request, "POST", `/api/routsify/clients/ocr/${certification.ocrRunId}/review`, {
        approve: true,
        fields: {
          document_type: "passport",
          first_name: "Ana",
          last_name: "Prueba",
          birth_date: "1990-01-01",
          nationality: "ES",
          document_number: `TEST-${runTag}`,
          document_country: "ES",
          document_expires_at: "2035-12-31",
          mrz: null,
        },
      });
      const travelers = await api(request, "GET", `/api/routsify/cases/${certification.caseId}/workspace?section=travelers`);
      expect(travelers.data.travelers.find((item) => item.id === travelerId)?.review_status).toBe("approved");

      const ticketUpload = await api(request, "POST", "/api/documentos/upload-url", {
        caseCode: certification.caseCode,
        fileName: `TICKET-PRUEBA-${runTag}.pdf`,
        sizeBytes: pdf.length,
        mimeType: "application/pdf",
        ownerType: "case",
      });
      const ticketPut = await request.put(ticketUpload.signedUrl, { data: pdf, headers: { "content-type": "application/pdf" } });
      expect(ticketPut.ok(), `La subida del ticket devolvió ${ticketPut.status()}`).toBeTruthy();
      const ticket = await api(request, "POST", "/api/documentos/confirm-upload", {
        caseId: certification.caseId,
        ownerType: "case",
        title: "Ticket sintético · NO VÁLIDO",
        type: "ticket_cliente",
        bucket: ticketUpload.bucket,
        storagePath: ticketUpload.path,
        fileName: `TICKET-PRUEBA-${runTag}.pdf`,
        mimeType: "application/pdf",
        sizeBytes: pdf.length,
        sensitivity: "private",
        retentionDays: 30,
      });
      certification.ticketDocumentId = text(ticket.data.id);
      expect(certification.ticketDocumentId).toBeTruthy();
    });

    await test.step("crear, enviar y aceptar una propuesta con margen", async () => {
      const proposal = await api(request, "POST", "/api/routsify/proposals", { case_id: certification.caseId });
      certification.proposalId = text(proposal.data.id);
      const version = Array.isArray(proposal.data.proposal_versions) ? proposal.data.proposal_versions[0] : null;
      expect(version?.id).toBeTruthy();
      const budgetLine = await api(request, "POST", `/api/routsify/proposals/${certification.proposalId}/lines`, {
        proposal_version_id: version.id,
        service_type_code: "accommodation",
        description_public: `[PRUEBA E2E ${runTag}] Hotel sintético Lisboa`,
        description_internal: "Coste 10 €, venta 15 €, beneficio esperado 5 €.",
        supplier_id: certification.supplierId,
        cost_budget: 10,
        creates_expected_purchase: true,
        start_date: tripStart,
        end_date: tripEnd,
        destination_segment: "Lisboa",
      });
      expect(Number(budgetLine.data.margin_applied)).toBeCloseTo(0.333333, 5);
      expect(Number(budgetLine.data.sale_price)).toBeCloseTo(15, 2);

      const globalMargin = await api(request, "PATCH", `/api/routsify/proposals/${certification.proposalId}/lines/bulk`, {
        proposal_version_id: version.id,
        margin_percentage: 33.3333,
      });
      expect(globalMargin.updated).toBe(1);
      expect(Number(globalMargin.data[0].margin_applied)).toBeCloseTo(0.333333, 5);

      await page.goto(`/propuestas?caseId=${encodeURIComponent(certification.caseId)}`);
      await expect(page.getByLabel("Margen global %")).toBeVisible();
      await expect(page.getByRole("button", { name: "Crear proveedor", exact: true })).toBeVisible();
      await expect(page.getByRole("combobox", { name: "Proveedor", exact: true })).toBeVisible();
      await page.getByRole("button", { name: "Crear proveedor", exact: true }).click();
      await expect(page.getByRole("heading", { name: "Nuevo proveedor", exact: true })).toBeVisible();
      await page.getByRole("button", { name: "Cerrar", exact: true }).click();

      const sent = await api(request, "POST", `/api/routsify/proposals/${certification.proposalId}/send`, { validity_days: 15 });
      expect(sent.data.holded_status).toBe("queued");
      await processOutbox(request);
      const publicUrl = new URL(sent.data.url);
      const token = decodeURIComponent(publicUrl.pathname.split("/").filter(Boolean).at(-1));
      const accepted = await api(request, "POST", `/api/propuestas/${encodeURIComponent(token)}/accept`, {
        acceptor_name: "Ana Prueba",
        acceptor_email: clientEmail,
        terms_accepted: true,
      });
      expect(accepted.proposalId).toBe(certification.proposalId);
    });

    await test.step("enviar comunicación controlada al proveedor", async () => {
      const purchases = await api(request, "GET", "/api/routsify/expected-purchases");
      const purchase = purchases.data.find((item) => item.case_id === certification.caseId);
      certification.purchaseId = text(purchase?.id);
      expect(certification.purchaseId).toBeTruthy();
      const synced = await api(request, "POST", "/api/routsify/communications/sync", {});
      expect(Number(synced.data.planned || 0)).toBeGreaterThanOrEqual(1);
      const activity = await api(request, "GET", `/api/routsify/cases/${certification.caseId}/workspace?section=activity`);
      const communicationTask = activity.data.tasks.find((item) => item.payload?.kind === "supplier_confirmation");
      certification.communicationId = text(communicationTask?.payload?.communication_followup_id);
      expect(certification.communicationId).toBeTruthy();
      const sent = await api(request, "POST", `/api/routsify/communications/${certification.communicationId}/send`, {});
      expect(sent.data.provider).toBe("hostinger_smtp");
      expect(sent.data.provider_status).toBe("accepted");
    });

    await test.step("sincronizar y aprobar la compra en Holded", async () => {
      await api(request, "POST", "/api/routsify/expected-purchases/sync-holded", { purchaseId: certification.purchaseId });
      await processOutbox(request);
      const purchase = await api(request, "GET", `/api/routsify/expected-purchases/${certification.purchaseId}`);
      expect(text(purchase.data.holded_purchase_id)).toBeTruthy();
      const approved = await api(request, "PATCH", `/api/routsify/expected-purchases/${certification.purchaseId}`, {
        status: "approved",
        approved_cost: 10,
        review_notes: "Coste sintético cotejado durante certificación E2E.",
      });
      expect(approved.data.status).toBe("approved");
    });

    let contractId;
    await test.step("versionar, enviar y firmar el contrato con evidencia", async () => {
      const contractWorkspace = await api(request, "GET", `/api/routsify/cases/${certification.caseId}/workspace?section=contract`);
      contractId = text(contractWorkspace.data.contracts[0]?.id);
      expect(contractId).toBeTruthy();
      const contractUrl = `https://example.com/routsify-certification/${runTag}`;
      const sent = await api(request, "POST", `/api/routsify/cases/${certification.caseId}/contracts`, {
        id: contractId,
        title: "Contrato de viaje · PRUEBA E2E",
        status: "sent",
        external_url: contractUrl,
        legal_version: `CERT-${runTag}`,
        notes: "Contrato sintético; no tiene validez comercial.",
      });
      expect(sent.data.status).toBe("sent");
      const signed = await api(request, "POST", `/api/routsify/cases/${certification.caseId}/contracts`, {
        id: contractId,
        title: "Contrato de viaje · PRUEBA E2E",
        status: "signed",
        external_url: contractUrl,
        legal_version: `CERT-${runTag}`,
        signer_name: "Ana Prueba",
        signer_email: clientEmail,
        review_confirmed: true,
        notes: "Firma sintética confirmada por el agente de certificación.",
      });
      expect(signed.data.status).toBe("signed");
      expect(text(signed.data.current_version_id)).toBeTruthy();
    });

    await test.step("registrar cobro, proforma y pago en Holded", async () => {
      const paymentLink = await api(request, "POST", `/api/routsify/proposals/${certification.proposalId}/payment-link`, {
        external_url: `https://example.com/teya-certification/${runTag}`,
        amount: 15,
      });
      certification.paymentLinkId = text(paymentLink.data.id);
      expect(certification.paymentLinkId).toBeTruthy();

      const payment = await api(request, "POST", `/api/routsify/payment-links/${certification.paymentLinkId}/confirm`, {
        reference: `E2E-${runTag}`,
        amount: 15,
        received_at: new Date().toISOString(),
        notes: "Cobro sintético. No se ha realizado ningún cargo real.",
      });
      expect(payment.data.payment.payment_reference).toBe(`E2E-${runTag}`);
      expect(Number(payment.data.payment.amount)).toBe(15);
      expect(payment.data.payment.payment_link_id).toBe(certification.paymentLinkId);
      await processOutbox(request);
      const workspace = await api(request, "GET", `/api/routsify/cases/${certification.caseId}/workspace?section=contract`);
      expect(workspace.data.payments.some((item) => item.payment_reference === `E2E-${runTag}` && Number(item.amount) === 15)).toBe(true);
      expect(workspace.data.fiscal_documents.some((item) => item.document_type === "proforma" && item.status === "issued")).toBe(true);

      const settings = await api(request, "GET", "/api/routsify/settings");
      const setting = (key) => text(settings.data.find((item) => item.key === key)?.value);
      const legalReady = Boolean(setting("legal.general_conditions_url") && setting("legal.standard_information_url"));
      const legal = await api(request, "POST", `/api/routsify/cases/${certification.caseId}/legal-delivery`, {}, { acceptedStatuses: [409] });
      if (legalReady) {
        expect(legal.data.event_type).toBe("legal_pack.sent");
        expect(legal.delivery.provider).toBe("hostinger_smtp");
        expect(legal.delivery.status).toBe("accepted");
      }
      else {
        expect(legal._responseStatus).toBe(409);
        expect(legal.error).toBe("legal_templates_incomplete");
      }
    });

    await test.step("crear, modificar y cancelar una reserva real de prueba", async () => {
      const from = new Date(Date.now() + 24 * 60 * 60_000).toISOString();
      const to = new Date(Date.now() + 45 * 24 * 60 * 60_000).toISOString();
      const availability = await api(request, "GET", `/api/routsify/clients/booking/availability?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&timezone=Europe%2FMadrid`);
      const candidates = availability.data.slots
        .filter((item) => item.available !== false && new Date(item.startsAt).getTime() > Date.now() + 60 * 60_000)
        .slice(0, 10);
      expect(candidates.length, "Booking no devolvió ningún hueco futuro disponible").toBeGreaterThan(0);

      let slot = null;
      let bookingDuration = 0;
      let created = null;
      let conflicts = 0;
      for (const candidate of candidates) {
        const candidateDuration = Number(candidate.durationMinutes || availability.data.durationMinutes || 0);
        expect(candidateDuration).toBeGreaterThanOrEqual(5);
        const result = await api(request, "POST", "/api/routsify/clients/booking/reservations", {
          clientId: certification.clientId,
          startsAt: candidate.startsAt,
          timezone: "Europe/Madrid",
          durationMinutes: candidateDuration,
          notes: `[PRUEBA E2E ${runTag}] Crear-modificar-cancelar`,
          privacyAccepted: true,
        }, { acceptedStatuses: [409] });
        if (result._responseStatus === 409) {
          conflicts += 1;
          continue;
        }
        slot = candidate;
        bookingDuration = candidateDuration;
        created = result;
        break;
      }
      expect(created, `Booking rechazó por conflicto los ${conflicts} huecos comprobados`).toBeTruthy();
      certification.bookingId = text(created.data.booking.id);
      expect(certification.bookingId).toBeTruthy();
      const expectedStartsAt = new Date(slot.startsAt).toISOString();
      const expectedEndsAt = new Date(new Date(slot.startsAt).getTime() + bookingDuration * 60_000).toISOString();
      expect(new Date(created.data.booking.starts_at).toISOString()).toBe(expectedStartsAt);
      expect(new Date(created.data.booking.ends_at).toISOString()).toBe(expectedEndsAt);
      const updated = await bookingMutation(request, "PATCH", `/api/routsify/clients/booking/reservations/${certification.bookingId}`, {
        notes: `[PRUEBA E2E ${runTag}] Reserva verificada; cancelar a continuación`,
      });
      expect(text(updated.data.booking.id)).toBe(certification.bookingId);
      expect(new Date(updated.data.booking.starts_at).toISOString()).toBe(expectedStartsAt);
      expect(new Date(updated.data.booking.ends_at).toISOString()).toBe(expectedEndsAt);
      const cancelled = await bookingMutation(request, "DELETE", `/api/routsify/clients/booking/reservations/${certification.bookingId}`);
      expect(cancelled.data.booking.status).toBe("cancelled");
      expect(new Date(cancelled.data.booking.starts_at).toISOString()).toBe(expectedStartsAt);
      expect(new Date(cancelled.data.booking.ends_at).toISOString()).toBe(expectedEndsAt);
    });

    await test.step("emitir factura final y cerrar el expediente", async () => {
      await api(request, "PATCH", `/api/routsify/cases/${certification.caseId}`, {
        trip_start: dateOffset(-10),
        trip_end: dateOffset(-7),
        final_notes: "Viaje sintético finalizado para comprobar factura y cierre.",
      });
      const fiscalJob = await api(request, "POST", "/api/routsify/jobs/run", { job: "fiscal_final_invoice_check" });
      const item = fiscalJob.data.find((row) => row.caseId === certification.caseId);
      expect(item?.ok).toBe(true);
      await processOutbox(request);
      const preflight = await api(request, "POST", `/api/routsify/cases/${certification.caseId}/close-preflight`, {});
      expect(preflight.data.ready, JSON.stringify(preflight.data.blockers || [])).toBe(true);
      const closed = await api(request, "PATCH", `/api/routsify/cases/${certification.caseId}`, { status: "closed" });
      expect(closed.data.status).toBe("closed");
      expect(closed.data.purchase_status, "El expediente cerrado debe reflejar todas las compras resueltas").toBe("resolved");
      const workspace = await api(request, "GET", `/api/routsify/cases/${certification.caseId}/workspace?section=contract`);
      expect(workspace.data.fiscal_documents.some((row) => row.document_type === "final_invoice" && row.status === "issued")).toBe(true);
    });

    await test.step("validar páginas, informes y estado final", async () => {
      const reportExport = await api(request, "GET", "/api/routsify/reports/export?period=30");
      expect(reportExport.raw).toContain("Informe de dirección Routsify");
      await processOutbox(request);
      const health = await api(request, "GET", "/api/routsify/settings/integrations/health");
      expect(health.data.integrations.find((item) => item.id === "holded")?.state).toBe("healthy");

      for (const path of [`/clientes/${certification.clientId}`, `/expedientes/${certification.caseCode}`, "/propuestas", "/compras", "/comunicaciones", "/informes"]) {
        const response = await page.goto(path, { waitUntil: "domcontentloaded" });
        expect(response?.status(), `${path} no abrió correctamente`).toBeLessThan(500);
        await expect(page).not.toHaveURL(/\/login(?:\?|$)/);
        await expect(page.getByRole("heading", { name: "Algo ha fallado", exact: true }), `${path} mostró la pantalla de error`).toHaveCount(0);
        await expect(page.locator("h1").first()).toBeVisible();
        await expect(page.locator("nextjs-portal")).toHaveCount(0);
        if (path.startsWith("/expedientes/")) {
          await expect(page.getByRole("heading", { name: "Del presupuesto aceptado a la entrega del viaje", exact: true })).toBeVisible();
          for (const heading of ["Información precontractual aceptada", "Datos de viajeros y documentación", "Redacción, enlace privado y firma del contrato", "Enlace de pago y confirmación del cobro", "Entrega de documentación legal", "Compras de proveedores y entrega de tickets"]) {
            await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible();
          }
          await expect(page.getByRole("button", { name: /Enviar documentación legal|Documentación enviada/ })).toBeVisible();
        }
      }
    });

    await test.step("verificar la retención técnica y de privacidad", async () => {
      const retention = await api(request, "POST", "/api/routsify/jobs/run", { job: "privacy_retention_review" });
      expect(retention.data.failed, JSON.stringify(retention.data.results || [])).toBe(0);
      expect(retention.data.technical_logs.failedOrganizations).toBe(0);
    });

    console.log(`ROUTSIFY_OPERATIONAL_CERTIFICATION=${JSON.stringify(certification)}`);
  });
});
