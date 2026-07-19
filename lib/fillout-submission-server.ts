function normalizedKey(value: unknown) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function hasValue(value: unknown) {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.some(hasValue);
  return true;
}

function scalarValue(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.map(scalarValue).filter(hasValue).join(", ");
  if (typeof value === "object") {
    const row = value as Record<string, unknown>;
    if (row.fullName || row.email) return row.fullName || row.email;
    if (row.start || row.end) return [row.start, row.end].filter(Boolean).join(" / ");
    if (row.formattedAddress) return row.formattedAddress;
    if (row.name) return row.name;
    return JSON.stringify(value);
  }
  return String(value);
}

const questionIdAliases: Record<string, string> = {
  bvxh: "first_name",
  wMFK: "last_name",
  dJ3x: "country",
  b3qB: "phone",
  uhVZ: "email",
  kNSL: "destination",
  qrvn: "travelers",
  tgLZ: "budget",
};

function assignValue(output: Record<string, unknown>, key: string, value: unknown, overwrite = false) {
  if (!hasValue(value)) return;
  if (overwrite || !hasValue(output[key])) output[key] = value;
}

function assignAlias(output: Record<string, unknown>, key: string, value: unknown) {
  const aliases: Record<string, string> = {
    nombre: "first_name",
    nombres: "first_name",
    apellidos: "last_name",
    nombre_completo: "name",
    nombre_y_apellidos: "name",
    name: "name",
    full_name: "name",
    correo: "email",
    correo_electronico: "email",
    email: "email",
    email_address: "email",
    telefono: "phone",
    numero_de_telefono: "phone",
    movil: "phone",
    whatsapp: "phone",
    phone: "phone",
    destino: "destination",
    destinos: "destination",
    destino_s: "destination",
    destination: "destination",
    a_que_pais_o_paises_viajas: "destination",
    numero_de_personas: "travelers",
    numero_de_viajeros: "travelers",
    cuantos_sois: "travelers",
    personas: "travelers",
    viajeros: "travelers",
    travelers: "travelers",
    travellers: "travelers",
    presupuesto: "budget",
    presupuesto_orientativo: "budget",
    budget: "budget",
    fecha_de_salida: "travel_start",
    fecha_inicio: "travel_start",
    fecha_de_inicio: "travel_start",
    travel_start: "travel_start",
    start_date: "travel_start",
    fecha_de_regreso: "travel_end",
    fecha_fin: "travel_end",
    fecha_de_fin: "travel_end",
    travel_end: "travel_end",
    end_date: "travel_end",
    campana: "campaign",
    campaign: "campaign",
    utm_campaign: "campaign",
  };
  assignValue(output, key, value);
  const alias = aliases[key];
  if (alias) assignValue(output, alias, value);
}

function processQuestion(output: Record<string, unknown>, row: Record<string, unknown>) {
  const id = String(row.id || "");
  const key = normalizedKey(row.name || id);
  const value = row.value;
  if (key) assignAlias(output, key, scalarValue(value));

  const exactAlias = questionIdAliases[id];
  if (exactAlias) assignValue(output, exactAlias, scalarValue(value), true);

  if (id === "7QYu" && value && typeof value === "object" && !Array.isArray(value)) {
    const range = value as Record<string, unknown>;
    assignValue(output, "travel_start", range.start, true);
    assignValue(output, "travel_end", range.end, true);
  }
}

export function normalizeFilloutSubmission(payload: Record<string, unknown>) {
  const submission = payload.submission && typeof payload.submission === "object" && !Array.isArray(payload.submission)
    ? payload.submission as Record<string, unknown>
    : payload;
  const output: Record<string, unknown> = {
    ...submission,
    source: "fillout",
    submission_id: submission.submissionId || submission.submission_id || payload.submissionId || payload.submission_id,
    submitted_at: submission.submissionTime || submission.submission_time,
    fillout_submission: submission,
  };

  if (Array.isArray(submission.questions)) {
    for (const item of submission.questions) {
      if (item && typeof item === "object") processQuestion(output, item as Record<string, unknown>);
    }
  }

  for (const group of [submission.calculations, submission.urlParameters]) {
    if (!Array.isArray(group)) continue;
    for (const item of group) {
      if (!item || typeof item !== "object") continue;
      const row = item as Record<string, unknown>;
      const key = normalizedKey(row.name || row.id);
      if (key) assignAlias(output, key, scalarValue(row.value));
    }
  }

  if (Array.isArray(submission.scheduling)) {
    for (const item of submission.scheduling) {
      if (!item || typeof item !== "object") continue;
      const value = (item as Record<string, unknown>).value;
      if (!value || typeof value !== "object") continue;
      const schedule = value as Record<string, unknown>;
      assignValue(output, "name", schedule.fullName);
      assignValue(output, "email", schedule.email);
      output.scheduling_event_id = schedule.eventId || null;
      output.scheduling_start = schedule.eventStartTime || null;
      output.scheduling_end = schedule.eventEndTime || null;
    }
  }

  if (submission.login && typeof submission.login === "object") {
    assignValue(output, "email", (submission.login as Record<string, unknown>).email);
  }

  const firstName = String(output.first_name || "").trim();
  const lastName = String(output.last_name || "").trim();
  if (firstName || lastName) output.name = [firstName, lastName].filter(Boolean).join(" ");

  return output;
}
