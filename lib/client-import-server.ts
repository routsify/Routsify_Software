import { getSupabaseAdminClient } from "@/lib/supabase-admin";

type JsonRow = Record<string, unknown>;

type ImportError = {
  row: number;
  message: string;
};

export type ClientImportResult = {
  totalRows: number;
  imported: number;
  duplicates: number;
  invalid: number;
  errors: ImportError[];
};

const MAX_IMPORT_ROWS = 2_000;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function text(value: unknown) {
  return String(value || "").trim();
}

function normalizeHeader(value: string) {
  return value
    .replace(/^\uFEFF/, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function detectDelimiter(source: string) {
  const firstLine = source.split(/\r?\n/, 1)[0] || "";
  const commas = (firstLine.match(/,/g) || []).length;
  const semicolons = (firstLine.match(/;/g) || []).length;
  return semicolons > commas ? ";" : ",";
}

function parseDelimited(source: string, delimiter: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = "";
  let quoted = false;

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    const next = source[index + 1];
    if (character === '"') {
      if (quoted && next === '"') {
        value += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === delimiter && !quoted) {
      row.push(value.trim());
      value = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && next === "\n") index += 1;
      row.push(value.trim());
      if (row.some((cell) => cell !== "")) rows.push(row);
      row = [];
      value = "";
    } else {
      value += character;
    }
  }

  row.push(value.trim());
  if (row.some((cell) => cell !== "")) rows.push(row);
  return rows;
}

function chunk<T>(values: T[], size = 100) {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += size) result.push(values.slice(index, index + size));
  return result;
}

function field(row: JsonRow, aliases: string[]) {
  for (const alias of aliases) {
    const value = text(row[alias]);
    if (value) return value;
  }
  return "";
}

function importMessage(error: unknown) {
  const message = error instanceof Error ? error.message : text(error);
  if (message.includes("email_normalized")) return "Ya existe un cliente con ese email.";
  return message || "No se pudo importar esta fila.";
}

export async function importClientsFromCsv(organizationId: string, csv: string): Promise<ClientImportResult> {
  const source = csv.replace(/^\uFEFF/, "").trim();
  if (!source) throw new Error("empty_import_file");
  const rows = parseDelimited(source, detectDelimiter(source));
  if (rows.length < 2) throw new Error("import_file_has_no_rows");
  if (rows.length - 1 > MAX_IMPORT_ROWS) throw new Error("import_row_limit_exceeded");

  const headers = rows[0].map(normalizeHeader);
  const acceptedNameHeaders = ["nombre", "nombre_o_razon_social", "razon_social", "display_name", "cliente"];
  if (!headers.some((header) => acceptedNameHeaders.includes(header))) throw new Error("import_name_column_required");

  const rawRows = rows.slice(1).map((cells, index) => ({
    rowNumber: index + 2,
    values: Object.fromEntries(headers.map((header, cellIndex) => [header, cells[cellIndex] || ""])),
  }));

  const errors: ImportError[] = [];
  const candidates: Array<{ rowNumber: number; insert: JsonRow; email: string; phone: string }> = [];
  const seenEmails = new Set<string>();
  const seenPhones = new Set<string>();
  let duplicates = 0;

  for (const raw of rawRows) {
    const values = raw.values;
    const firstName = field(values, acceptedNameHeaders);
    const lastName = field(values, ["apellidos", "apellido", "last_name"]);
    const displayName = [firstName, lastName].filter(Boolean).join(" ").trim();
    const email = field(values, ["email", "correo", "correo_electronico", "e_mail"]).toLowerCase();
    const phone = field(values, ["telefono", "movil", "telefono_movil", "phone"]);
    const phoneNormalized = phone.replace(/\D/g, "");
    const typeValue = field(values, ["tipo", "tipo_cliente", "client_type"]).toLowerCase();
    const clientType = ["empresa", "company", "sociedad"].includes(typeValue) ? "company" : "person";
    const country = (field(values, ["pais", "country", "codigo_pais"]) || "ES").toUpperCase();
    const taxId = field(values, ["nif", "dni", "cif", "tax_id", "identificacion_fiscal"]);
    const billingAddress = field(values, ["direccion_fiscal", "direccion", "billing_address"]);
    const notes = field(values, ["notas", "observaciones", "notes"]);

    if (displayName.length < 2) {
      errors.push({ row: raw.rowNumber, message: "Falta el nombre o razón social." });
      continue;
    }
    if (email && !EMAIL_PATTERN.test(email)) {
      errors.push({ row: raw.rowNumber, message: "El email no tiene un formato válido." });
      continue;
    }
    if (!/^[A-Z]{2}$/.test(country)) {
      errors.push({ row: raw.rowNumber, message: "El país debe tener dos letras, por ejemplo ES." });
      continue;
    }
    if (email && seenEmails.has(email)) {
      duplicates += 1;
      continue;
    }
    if (phoneNormalized && seenPhones.has(phoneNormalized)) {
      duplicates += 1;
      continue;
    }
    if (email) seenEmails.add(email);
    if (phoneNormalized) seenPhones.add(phoneNormalized);

    candidates.push({
      rowNumber: raw.rowNumber,
      email,
      phone: phoneNormalized,
      insert: {
        organization_id: organizationId,
        client_type: clientType,
        display_name: displayName,
        first_name: clientType === "person" ? firstName : null,
        last_name: clientType === "person" ? lastName || null : null,
        company_name: clientType === "company" ? displayName : null,
        email: email || null,
        email_normalized: email || null,
        phone: phone || null,
        phone_normalized: phoneNormalized || null,
        tax_id: taxId || null,
        billing_address: billingAddress ? { address: billingAddress } : {},
        country,
        language: "es",
        source: "csv_import",
        notes: notes || null,
      },
    });
  }

  const db = getSupabaseAdminClient();
  const existingEmails = new Set<string>();
  const existingPhones = new Set<string>();
  for (const values of chunk(Array.from(new Set(candidates.map((item) => item.email).filter(Boolean))), 200)) {
    const { data, error } = await db.from("clients").select("email_normalized").eq("organization_id", organizationId).in("email_normalized", values);
    if (error) throw new Error(error.message);
    for (const item of data || []) if (item.email_normalized) existingEmails.add(String(item.email_normalized));
  }
  for (const values of chunk(Array.from(new Set(candidates.map((item) => item.phone).filter(Boolean))), 200)) {
    const { data, error } = await db.from("clients").select("phone_normalized").eq("organization_id", organizationId).in("phone_normalized", values);
    if (error) throw new Error(error.message);
    for (const item of data || []) if (item.phone_normalized) existingPhones.add(String(item.phone_normalized));
  }

  const pending = candidates.filter((candidate) => {
    const duplicate = (candidate.email && existingEmails.has(candidate.email)) || (candidate.phone && existingPhones.has(candidate.phone));
    if (duplicate) duplicates += 1;
    return !duplicate;
  });

  let imported = 0;
  for (const batch of chunk(pending, 100)) {
    const { data, error } = await db.from("clients").insert(batch.map((item) => item.insert)).select("id");
    if (!error) {
      imported += data?.length || batch.length;
      continue;
    }
    for (const item of batch) {
      const { error: rowError } = await db.from("clients").insert(item.insert);
      if (rowError) errors.push({ row: item.rowNumber, message: importMessage(rowError.message) });
      else imported += 1;
    }
  }

  return {
    totalRows: rawRows.length,
    imported,
    duplicates,
    invalid: errors.length,
    errors: errors.slice(0, 100),
  };
}
