import { getSupabaseAdminClient } from "@/lib/supabase-admin";

type JsonRow = Record<string, unknown>;
type ImportError = { row: number; message: string };

export type SupplierImportResult = {
  totalRows: number;
  imported: number;
  duplicates: number;
  invalid: number;
  errors: ImportError[];
};

const MAX_IMPORT_ROWS = 2_000;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function text(value: unknown) { return String(value || "").trim(); }
function normalizeHeader(value: string) {
  return value.replace(/^\uFEFF/, "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}
function normalizeIdentity(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}
function detectDelimiter(source: string) {
  const firstLine = source.split(/\r?\n/, 1)[0] || "";
  return (firstLine.match(/;/g) || []).length > (firstLine.match(/,/g) || []).length ? ";" : ",";
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
      if (quoted && next === '"') { value += '"'; index += 1; } else quoted = !quoted;
    } else if (character === delimiter && !quoted) {
      row.push(value.trim()); value = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && next === "\n") index += 1;
      row.push(value.trim());
      if (row.some((cell) => cell !== "")) rows.push(row);
      row = []; value = "";
    } else value += character;
  }
  row.push(value.trim());
  if (row.some((cell) => cell !== "")) rows.push(row);
  return rows;
}
function field(row: JsonRow, aliases: string[]) {
  for (const alias of aliases) { const value = text(row[alias]); if (value) return value; }
  return "";
}
function chunk<T>(values: T[], size = 100) {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += size) result.push(values.slice(index, index + size));
  return result;
}
function booleanValue(value: string, fallback = true) {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return fallback;
  return !["no", "false", "0", "inactivo", "inactive", "bloqueado", "blocked"].includes(normalized);
}

export async function importSuppliersFromCsv(organizationId: string, csv: string): Promise<SupplierImportResult> {
  const source = csv.replace(/^\uFEFF/, "").trim();
  if (!source) throw new Error("empty_import_file");
  const rows = parseDelimited(source, detectDelimiter(source));
  if (rows.length < 2) throw new Error("import_file_has_no_rows");
  if (rows.length - 1 > MAX_IMPORT_ROWS) throw new Error("import_row_limit_exceeded");

  const headers = rows[0].map(normalizeHeader);
  const acceptedNameHeaders = ["nombre", "nombre_interno", "proveedor", "name"];
  const acceptedFiscalNameHeaders = ["nombre_fiscal", "nombre_comercial", "razon_social", "fiscal_name", "legal_name"];
  if (!headers.some((header) => acceptedNameHeaders.includes(header))) throw new Error("import_name_column_required");
  if (!headers.some((header) => acceptedFiscalNameHeaders.includes(header))) throw new Error("import_fiscal_name_column_required");

  const rawRows = rows.slice(1).map((cells, index) => ({
    rowNumber: index + 2,
    values: Object.fromEntries(headers.map((header, cellIndex) => [header, cells[cellIndex] || ""])),
  }));

  const errors: ImportError[] = [];
  const candidates: Array<{ rowNumber: number; nameKey: string; taxKey: string; emailKey: string; insert: JsonRow }> = [];
  const seenNames = new Set<string>();
  const seenTaxIds = new Set<string>();
  const seenEmails = new Set<string>();
  let duplicates = 0;

  for (const raw of rawRows) {
    const values = raw.values;
    const name = field(values, acceptedNameHeaders);
    const fiscalName = field(values, acceptedFiscalNameHeaders);
    const category = field(values, ["categoria", "tipo", "category"]);
    const email = field(values, ["email", "correo", "correo_electronico"]).toLowerCase();
    const phone = field(values, ["telefono", "movil", "phone"]);
    const taxId = field(values, ["nif", "cif", "tax_id", "identificacion_fiscal"]);
    const country = (field(values, ["pais", "country", "codigo_pais"]) || "ES").toUpperCase();
    const billingAddress = field(values, ["direccion_fiscal", "direccion", "billing_address"]);
    const notes = field(values, ["notas", "observaciones", "notes"]);
    const active = booleanValue(field(values, ["activo", "estado", "active"]), true);
    const nameKey = normalizeIdentity(name);
    const taxKey = taxId.replace(/\s+/g, "").toUpperCase();
    const emailKey = email;

    if (name.length < 2) { errors.push({ row: raw.rowNumber, message: "Falta el nombre del proveedor." }); continue; }
    if (fiscalName.length < 2) { errors.push({ row: raw.rowNumber, message: "Falta el nombre fiscal o comercial." }); continue; }
    if (email && !EMAIL_PATTERN.test(email)) { errors.push({ row: raw.rowNumber, message: "El email no tiene un formato válido." }); continue; }
    if (!/^[A-Z]{2}$/.test(country)) { errors.push({ row: raw.rowNumber, message: "El país debe tener dos letras, por ejemplo ES." }); continue; }
    if (seenNames.has(nameKey) || (taxKey && seenTaxIds.has(taxKey)) || (emailKey && seenEmails.has(emailKey))) { duplicates += 1; continue; }
    seenNames.add(nameKey);
    if (taxKey) seenTaxIds.add(taxKey);
    if (emailKey) seenEmails.add(emailKey);

    candidates.push({
      rowNumber: raw.rowNumber,
      nameKey,
      taxKey,
      emailKey,
      insert: {
        organization_id: organizationId,
        name,
        fiscal_name: fiscalName,
        category: category || null,
        email: email || null,
        phone: phone || null,
        tax_id: taxId || null,
        country,
        billing_address: billingAddress ? { address: billingAddress } : {},
        notes: notes || null,
        active,
      },
    });
  }

  const db = getSupabaseAdminClient();
  const { data: existing, error: existingError } = await db.from("suppliers").select("name,email,tax_id").eq("organization_id", organizationId).limit(10_000);
  if (existingError) throw new Error(existingError.message);
  const existingNames = new Set((existing || []).map((item) => normalizeIdentity(String(item.name || ""))).filter(Boolean));
  const existingTaxIds = new Set((existing || []).map((item) => String(item.tax_id || "").replace(/\s+/g, "").toUpperCase()).filter(Boolean));
  const existingEmails = new Set((existing || []).map((item) => String(item.email || "").trim().toLowerCase()).filter(Boolean));

  const pending = candidates.filter((candidate) => {
    const duplicate = existingNames.has(candidate.nameKey) || Boolean(candidate.taxKey && existingTaxIds.has(candidate.taxKey)) || Boolean(candidate.emailKey && existingEmails.has(candidate.emailKey));
    if (duplicate) duplicates += 1;
    return !duplicate;
  });

  let imported = 0;
  for (const batch of chunk(pending, 100)) {
    const { data, error } = await db.from("suppliers").insert(batch.map((item) => item.insert)).select("id");
    if (!error) { imported += data?.length || batch.length; continue; }
    for (const item of batch) {
      const { error: rowError } = await db.from("suppliers").insert(item.insert);
      if (rowError) errors.push({ row: item.rowNumber, message: rowError.code === "23505" ? "El proveedor ya existe." : rowError.message });
      else imported += 1;
    }
  }

  return { totalRows: rawRows.length, imported, duplicates, invalid: errors.length, errors: errors.slice(0, 100) };
}
