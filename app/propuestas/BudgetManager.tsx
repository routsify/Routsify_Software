"use client";

import { ChangeEvent, FormEvent, useMemo, useState } from "react";

type CaseOption = { id: string; case_code: string; title?: string | null; destination?: string | null; currency?: string | null; clients?: { display_name?: string | null } | null };
type Supplier = { id: string; name: string; fiscal_name?: string | null; category?: string | null; email?: string | null; active?: boolean; default_margin_pct?: number | null };
type Line = {
  id: string;
  service_type_code?: string | null;
  description_public: string;
  description_internal?: string | null;
  supplier_id?: string | null;
  supplier_name?: string | null;
  destination_segment?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  cost_budget?: number | string | null;
  cost_real?: number | string | null;
  cost_real_source?: string | null;
  sale_price?: number | string | null;
  margin_applied?: number | string | null;
  margin_snapshot?: Record<string, unknown> | null;
  origin_margin?: string | null;
  creates_expected_purchase?: boolean;
  included?: boolean;
  requirement_level?: "required" | "conditional" | "optional" | string;
  source_reference?: string | null;
  ai_generated?: boolean;
  ai_confidence?: number | string | null;
};
type Version = {
  id: string;
  version_number: number;
  status?: string | null;
  locked?: boolean;
  created_at?: string | null;
  expires_at?: string | null;
  total_sale?: number | string | null;
  total_cost_budget?: number | string | null;
  total_cost_real?: number | string | null;
  budgeted_profit?: number | string | null;
  real_profit?: number | string | null;
  real_margin_pct?: number | string | null;
  cost_deviation?: number | string | null;
  budget_lines?: Line[] | null;
};
type Proposal = { id: string; status?: string | null; current_version_id?: string | null; cases?: CaseOption | null; proposal_versions?: Version[] | null };
type LineDraft = {
  service_type_code: string;
  description_public: string;
  description_internal: string;
  supplier_id: string;
  supplier_name: string;
  destination_segment: string;
  start_date: string;
  end_date: string;
  cost_budget: string;
  margin_applied: string;
  sale_price: string;
  creates_expected_purchase: boolean;
  included: boolean;
  requirement_level: "required" | "conditional" | "optional";
  source_reference: string;
  ai_generated: boolean;
  ai_confidence: number;
};
type ImportRow = LineDraft & { rowNumber: number };
type ShareData = { url: string; expires_at: string; email?: string | null; phone?: string | null; mailto_url?: string | null; whatsapp_url?: string | null };
type WorkspaceTab = "manual" | "import" | "ai" | "versions";

const serviceTypes = [
  ["flight", "Vuelo"], ["accommodation", "Alojamiento"], ["transfer", "Traslado"], ["rail", "Tren"],
  ["ferry", "Ferry"], ["rental_car", "Coche de alquiler"], ["insurance", "Seguro"], ["activity", "Actividad / excursión"],
  ["esim", "eSIM"], ["visa", "Visado"], ["fees", "Tasas / gestión"], ["custom", "Otro servicio"],
] as const;
const emptyLine: LineDraft = { service_type_code: "custom", description_public: "", description_internal: "", supplier_id: "", supplier_name: "", destination_segment: "", start_date: "", end_date: "", cost_budget: "", margin_applied: "", sale_price: "", creates_expected_purchase: true, included: true, requirement_level: "required", source_reference: "", ai_generated: false, ai_confidence: 0 };
const statuses = [["draft", "Borrador"], ["internal_review", "Revisión interna"], ["sent", "Enviado"], ["accepted", "Aceptado"], ["rejected", "Rechazado"]] as const;

function asCase(input: unknown): CaseOption {
  const row = input as Record<string, unknown>;
  const rawClients = Array.isArray(row.clients) ? row.clients[0] : row.clients;
  return { id: String(row.id || ""), case_code: String(row.case_code || "Expediente"), title: row.title ? String(row.title) : null, destination: row.destination ? String(row.destination) : null, currency: row.currency ? String(row.currency) : "EUR", clients: rawClients && typeof rawClients === "object" ? rawClients as CaseOption["clients"] : null };
}
function asSupplier(input: unknown): Supplier { const row = input as Record<string, unknown>; return { id: String(row.id || ""), name: String(row.name || "Proveedor"), fiscal_name: row.fiscal_name ? String(row.fiscal_name) : null, category: row.category ? String(row.category) : null, email: row.email ? String(row.email) : null, active: row.active !== false, default_margin_pct: row.default_margin_pct === null || row.default_margin_pct === undefined ? null : Number(row.default_margin_pct) }; }
function asProposal(input: unknown): Proposal {
  const row = input as Record<string, unknown>;
  const rawCase = Array.isArray(row.cases) ? row.cases[0] : row.cases;
  return { id: String(row.id || crypto.randomUUID()), status: row.status ? String(row.status) : "draft", current_version_id: row.current_version_id ? String(row.current_version_id) : null, cases: rawCase && typeof rawCase === "object" ? asCase(rawCase) : null, proposal_versions: Array.isArray(row.proposal_versions) ? row.proposal_versions as Version[] : [] };
}
function sortedVersions(proposal?: Proposal | null) { return [...(proposal?.proposal_versions || [])].sort((a, b) => Number(b.version_number || 0) - Number(a.version_number || 0)); }
function latestVersion(proposal?: Proposal | null) { return sortedVersions(proposal)[0] || null; }
function num(value: unknown) { const number = Number(value || 0); return Number.isFinite(number) ? number : 0; }
function money(value: unknown, currency = "EUR") { return new Intl.NumberFormat("es-ES", { style: "currency", currency }).format(num(value)); }
function statusText(value?: string | null) { return statuses.find(([key]) => key === value)?.[1] || value || "Borrador"; }
function serviceText(value?: string | null) { return serviceTypes.find(([key]) => key === value)?.[1] || value || "Otro servicio"; }
function linesOfVersion(version?: Version | null) { return [...(version?.budget_lines || [])].sort((a, b) => String(a.start_date || "").localeCompare(String(b.start_date || ""))); }
function totalsFromVersion(version?: Version | null) {
  const lines = linesOfVersion(version).filter((line) => line.included !== false);
  const cost = lines.reduce((sum, line) => sum + num(line.cost_budget), 0);
  const sale = lines.reduce((sum, line) => sum + num(line.sale_price), 0);
  const hasRealCost = lines.some((line) => line.cost_real !== null && line.cost_real !== undefined);
  const realCost = hasRealCost ? lines.reduce((sum, line) => sum + (line.cost_real === null || line.cost_real === undefined ? num(line.cost_budget) : num(line.cost_real)), 0) : (num(version?.total_cost_real) || cost);
  const profit = sale - cost;
  const realProfit = sale - realCost;
  return { cost, realCost, sale, profit, realProfit, margin: sale ? (profit / sale) * 100 : 0, realMargin: sale ? (realProfit / sale) * 100 : 0, deviation: realCost - cost, hasRealCost };
}
function totals(proposal?: Proposal | null) { return totalsFromVersion(latestVersion(proposal)); }
function salePreview(cost: string, margin: string, explicitSale = "", automaticMargin = 0) { if (explicitSale.trim()) return num(explicitSale); const numericCost = num(cost); const numericMargin = Math.min(Math.max(margin.trim() ? num(margin) : automaticMargin, 0), 95); return numericCost > 0 ? numericCost / (1 - numericMargin / 100) : 0; }
function percentFromStored(value: unknown) { const number = num(value); return String(number <= 1 ? number * 100 : number); }
function draftFromLine(line: Line): LineDraft {
  const source = String(line.margin_snapshot?.source || line.origin_margin || "");
  const forced = ["line", "manual", "forced", "budget_global"].includes(source);
  const manualSale = line.margin_snapshot?.sale_source === "manual";
  return { service_type_code: line.service_type_code || "custom", description_public: line.description_public || "", description_internal: line.description_internal || "", supplier_id: line.supplier_id || "", supplier_name: line.supplier_name || "", destination_segment: line.destination_segment || "", start_date: line.start_date || "", end_date: line.end_date || "", cost_budget: String(line.cost_budget ?? ""), margin_applied: forced ? percentFromStored(line.margin_applied) : "", sale_price: manualSale ? String(line.sale_price ?? "") : "", creates_expected_purchase: line.creates_expected_purchase !== false, included: line.included !== false, requirement_level: ["required", "conditional", "optional"].includes(String(line.requirement_level)) ? line.requirement_level as LineDraft["requirement_level"] : "required", source_reference: line.source_reference || "", ai_generated: line.ai_generated === true, ai_confidence: num(line.ai_confidence) };
}
function normalizeHeader(value: string) { return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, ""); }
function parseDelimitedLine(line: string, delimiter: string) { const cells: string[] = []; let current = ""; let quoted = false; for (let index = 0; index < line.length; index += 1) { const char = line[index]; if (char === '"') { if (quoted && line[index + 1] === '"') { current += '"'; index += 1; } else quoted = !quoted; } else if (char === delimiter && !quoted) { cells.push(current.trim()); current = ""; } else current += char; } cells.push(current.trim()); return cells; }
function delimiterFor(text: string) { const first = text.split(/\r?\n/)[0] || ""; if (first.includes("\t")) return "\t"; const semicolons = (first.match(/;/g) || []).length; const commas = (first.match(/,/g) || []).length; return semicolons > commas ? ";" : ","; }
function boolValue(value: string, fallback = true) { if (!value.trim()) return fallback; return ["1", "true", "yes", "si", "sí", "x", "generar"].includes(value.trim().toLowerCase()); }
const headerAliases: Record<string, keyof LineDraft> = {
  tipo: "service_type_code", tipo_servicio: "service_type_code", service_type: "service_type_code", service_type_code: "service_type_code",
  descripcion: "description_public", descripcion_publica: "description_public", description: "description_public", description_public: "description_public",
  descripcion_interna: "description_internal", notas_internas: "description_internal", description_internal: "description_internal",
  proveedor: "supplier_name", supplier: "supplier_name", supplier_name: "supplier_name",
  destino: "destination_segment", tramo_destino: "destination_segment", destination: "destination_segment", destination_segment: "destination_segment",
  fecha_inicio: "start_date", inicio: "start_date", start_date: "start_date",
  fecha_fin: "end_date", fin: "end_date", end_date: "end_date",
  coste: "cost_budget", costo: "cost_budget", importe_coste: "cost_budget", cost: "cost_budget", cost_budget: "cost_budget",
  margen: "margin_applied", margen_porcentaje: "margin_applied", margin: "margin_applied", margin_applied: "margin_applied",
  venta: "sale_price", precio_venta: "sale_price", sale: "sale_price", sale_price: "sale_price",
  compra_proveedor: "creates_expected_purchase", generar_compra: "creates_expected_purchase", creates_expected_purchase: "creates_expected_purchase",
};

function parseImportTable(text: string) {
  const lines = text.trim().split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) return { rows: [] as ImportRow[], errors: ["La tabla debe incluir cabecera y al menos una línea."] };
  const delimiter = delimiterFor(text);
  const headers = parseDelimitedLine(lines[0], delimiter).map((header) => headerAliases[normalizeHeader(header)] || null);
  if (!headers.includes("description_public") || !headers.includes("cost_budget")) return { rows: [] as ImportRow[], errors: ["La cabecera debe incluir como mínimo Descripción y Coste."] };
  const errors: string[] = [];
  const rows = lines.slice(1).map((rawLine, rowIndex) => {
    const values = parseDelimitedLine(rawLine, delimiter);
    const draft: LineDraft = { ...emptyLine };
    headers.forEach((field, columnIndex) => { if (!field) return; const value = values[columnIndex] || ""; if (field === "creates_expected_purchase") draft[field] = boolValue(value); else (draft as unknown as Record<keyof LineDraft, string | boolean | number>)[field] = value; });
    draft.service_type_code = serviceTypes.some(([key]) => key === draft.service_type_code) ? draft.service_type_code : "custom";
    if (!draft.description_public.trim()) errors.push(`Fila ${rowIndex + 2}: falta la descripción.`);
    if (!draft.cost_budget.trim() || !Number.isFinite(Number(draft.cost_budget.replace(",", ".")))) errors.push(`Fila ${rowIndex + 2}: coste no válido.`);
    if (draft.margin_applied && (!Number.isFinite(Number(draft.margin_applied.replace(",", "."))) || num(draft.margin_applied.replace(",", ".")) < 0 || num(draft.margin_applied.replace(",", ".")) >= 100)) errors.push(`Fila ${rowIndex + 2}: margen no válido.`);
    if (draft.start_date && !/^\d{4}-\d{2}-\d{2}$/.test(draft.start_date)) errors.push(`Fila ${rowIndex + 2}: usa YYYY-MM-DD para la fecha de inicio.`);
    if (draft.end_date && !/^\d{4}-\d{2}-\d{2}$/.test(draft.end_date)) errors.push(`Fila ${rowIndex + 2}: usa YYYY-MM-DD para la fecha de fin.`);
    return { ...draft, cost_budget: draft.cost_budget.replace(",", "."), margin_applied: draft.margin_applied.replace(",", "."), sale_price: draft.sale_price.replace(",", "."), rowNumber: rowIndex + 2 };
  });
  return { rows, errors };
}

export function BudgetManager({ initialProposals = [], initialCases = [], initialSuppliers = [], initialCaseId = "", initialGlobalMargin = 12 }: { initialProposals?: unknown[]; initialCases?: unknown[]; initialSuppliers?: unknown[]; initialCaseId?: string; initialGlobalMargin?: number }) {
  const [proposals, setProposals] = useState<Proposal[]>(() => initialProposals.map(asProposal));
  const [cases] = useState<CaseOption[]>(() => initialCases.map(asCase).filter((item) => item.id));
  const [suppliers, setSuppliers] = useState<Supplier[]>(() => initialSuppliers.map(asSupplier).filter((item) => item.id));
  const [selectedId, setSelectedId] = useState<string | null>(() => proposals.find((item) => item.cases?.id === initialCaseId)?.id || proposals[0]?.id || null);
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [caseId, setCaseId] = useState(() => cases.some((item) => item.id === initialCaseId) ? initialCaseId : "");
  const [showCreate, setShowCreate] = useState(() => Boolean(initialCaseId && !proposals.some((item) => item.cases?.id === initialCaseId)));
  const [tab, setTab] = useState<WorkspaceTab>("manual");
  const [line, setLine] = useState<LineDraft>(emptyLine);
  const [editingLineId, setEditingLineId] = useState<string | null>(null);
  const [importText, setImportText] = useState("");
  const [importRows, setImportRows] = useState<ImportRow[]>([]);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [aiFile, setAiFile] = useState<File | null>(null);
  const [aiRows, setAiRows] = useState<ImportRow[]>([]);
  const [aiWarnings, setAiWarnings] = useState<string[]>([]);
  const [aiSummary, setAiSummary] = useState("");
  const [aiModel, setAiModel] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [shareData, setShareData] = useState<ShareData | null>(null);
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [supplierDraft, setSupplierDraft] = useState({ name: "", fiscal_name: "", category: "", email: "", default_margin_pct: "" });
  const [globalMargin, setGlobalMargin] = useState(String(initialGlobalMargin));
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);

  const filtered = useMemo(() => { const needle = query.trim().toLowerCase(); if (!needle) return proposals; return proposals.filter((proposal) => [proposal.cases?.case_code, proposal.cases?.title, proposal.cases?.destination, proposal.cases?.clients?.display_name, proposal.cases?.currency, proposal.status].filter(Boolean).join(" ").toLowerCase().includes(needle)); }, [proposals, query]);
  const availableCases = useMemo(() => cases.filter((item) => !proposals.some((proposal) => proposal.cases?.id === item.id)), [cases, proposals]);
  const activeSuppliers = useMemo(() => suppliers.filter((item) => item.active !== false), [suppliers]);
  const selected = proposals.find((proposal) => proposal.id === selectedId) || filtered[0] || proposals[0] || null;
  const versions = sortedVersions(selected);
  const selectedVersion = versions.find((version) => version.id === selectedVersionId) || versions.find((version) => version.id === selected?.current_version_id) || versions[0] || null;
  const latest = versions[0] || null;
  const selectedLines = linesOfVersion(selectedVersion);
  const selectedTotals = totalsFromVersion(selectedVersion);
  const selectedCurrency = String(selected?.cases?.currency || "EUR");
  const selectedSupplier = suppliers.find((item) => item.id === line.supplier_id) || null;
  const automaticMargin = selectedSupplier?.default_margin_pct ?? initialGlobalMargin;
  const preview = salePreview(line.cost_budget, line.margin_applied, line.sale_price, automaticMargin);
  const editable = Boolean(selected && selectedVersion && selectedVersion.id === selected.current_version_id && !selectedVersion.locked && ["draft", "internal_review"].includes(String(selectedVersion.status || "draft")) && ["draft", "internal_review"].includes(String(selected.status || "draft")));
  const hasEditableVersion = Boolean(selected && versions.some((version) => version.id === selected.current_version_id && !version.locked && ["draft", "internal_review"].includes(String(version.status || "draft"))) && ["draft", "internal_review"].includes(String(selected.status || "draft")));

  function resetAiImport() { setAiFile(null); setAiRows([]); setAiWarnings([]); setAiSummary(""); setAiModel(""); }
  function selectProposal(id: string) { setSelectedId(id); setSelectedVersionId(null); setEditingLineId(null); setLine(emptyLine); setShareData(null); resetAiImport(); setMessage(null); }
  function replaceVersion(proposalId: string, versionId: string, transform: (version: Version) => Version) { setProposals((current) => current.map((proposal) => proposal.id === proposalId ? { ...proposal, proposal_versions: (proposal.proposal_versions || []).map((version) => version.id === versionId ? transform(version) : version) } : proposal)); }
  function setLineValue<K extends keyof LineDraft>(key: K, value: LineDraft[K]) { setLine((current) => ({ ...current, [key]: value })); }
  function setSupplier(value: string) { const supplier = suppliers.find((item) => item.id === value); setLine((current) => ({ ...current, supplier_id: value, supplier_name: supplier?.name || "", creates_expected_purchase: value ? true : current.creates_expected_purchase })); }

  async function createSupplierInline(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = supplierDraft.name.trim();
    if (name.length < 2) return setMessage("Introduce un nombre de proveedor válido.");
    const fiscalName = supplierDraft.fiscal_name.trim();
    if (fiscalName.length < 2) return setMessage("Introduce el nombre fiscal o comercial del proveedor.");
    setSaving(true); setMessage(null);
    const response = await fetch("/api/routsify/suppliers", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name,
        fiscal_name: fiscalName,
        category: supplierDraft.category.trim() || null,
        email: supplierDraft.email.trim() || null,
        default_margin_pct: supplierDraft.default_margin_pct === "" ? null : Number(supplierDraft.default_margin_pct.replace(",", ".")),
        active: true,
      }),
    });
    const result = await response.json().catch(() => null);
    setSaving(false);
    if (!response.ok || !result?.ok) return setMessage(result?.error === "supplier_already_exists" ? "Ya existe un proveedor con ese nombre." : String(result?.error || "No se pudo crear el proveedor."));
    const created = asSupplier(result.data);
    setSuppliers((current) => [...current.filter((item) => item.id !== created.id), created].sort((left, right) => left.name.localeCompare(right.name, "es")));
    setLine((current) => ({ ...current, supplier_id: created.id, supplier_name: created.name, creates_expected_purchase: true }));
    setSupplierDraft({ name: "", fiscal_name: "", category: "", email: "", default_margin_pct: "" });
    setShowSupplierModal(false);
    setMessage(`Proveedor “${created.name}” creado y seleccionado.`);
  }

  async function applyGlobalMargin() {
    if (!selected || !selectedVersion || !editable || !selectedLines.length) return setMessage("Añade servicios antes de aplicar un margen global.");
    const margin = Number(globalMargin.replace(",", "."));
    if (!Number.isFinite(margin) || margin < 0 || margin >= 100) return setMessage("Introduce un margen global entre 0 y 99%. ");
    if (!window.confirm(`¿Aplicar un margen del ${margin}% a los ${selectedLines.length} servicios de esta versión?`)) return;
    setSaving(true); setMessage(null);
    const response = await fetch(`/api/routsify/proposals/${selected.id}/lines/bulk`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ proposal_version_id: selectedVersion.id, margin_percentage: margin }),
    });
    const result = await response.json().catch(() => null);
    setSaving(false);
    if (!response.ok || !result?.ok) return setMessage(String(result?.error || "No se pudo aplicar el margen global."));
    replaceVersion(selected.id, selectedVersion.id, (version) => ({ ...version, budget_lines: result.data as Line[] }));
    setMessage(`Margen global del ${margin}% aplicado a ${result.updated} servicios.`);
  }

  async function createProposal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!caseId) return setMessage("Selecciona un expediente.");
    const existing = proposals.find((proposal) => proposal.cases?.id === caseId);
    if (existing) { selectProposal(existing.id); setShowCreate(false); return setMessage("Ese expediente ya tiene presupuesto. Se ha abierto el existente."); }
    setSaving(true); setMessage(null);
    const response = await fetch("/api/routsify/proposals", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ case_id: caseId }) });
    const result = await response.json().catch(() => null); setSaving(false);
    if (!response.ok || !result?.ok) return setMessage(String(result?.error || "No se pudo crear el presupuesto."));
    const created = asProposal(result.data); setProposals((current) => [created, ...current.filter((item) => item.id !== created.id)]); setSelectedId(created.id); setSelectedVersionId(null); setCaseId(""); setShowCreate(false); setTab("manual"); setMessage("Presupuesto creado. Ya puedes añadir servicios manualmente o importar una tabla.");
  }

  async function changeStatus(proposalId: string, nextStatus: string) {
    const proposal = proposals.find((item) => item.id === proposalId); if (!proposal) return;
    if (proposal.status === "accepted") return setMessage("El presupuesto aceptado está bloqueado. Crea una nueva versión para hacer cambios.");
    if (nextStatus === "sent") return setMessage("Utiliza Preparar enlace para enviar el presupuesto con acceso seguro.");
    if (["internal_review", "accepted"].includes(nextStatus) && linesOfVersion(latestVersion(proposal)).length === 0) return setMessage("Añade al menos una línea antes de avanzar.");
    setSavingId(proposalId); setMessage(null);
    const response = await fetch(`/api/routsify/proposals/${proposalId}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status: nextStatus }) });
    const result = await response.json().catch(() => null); setSavingId(null);
    if (!response.ok || !result?.ok) return setMessage(String(result?.error || "No se pudo actualizar el presupuesto."));
    const updated = asProposal(result.data); setProposals((current) => current.map((item) => item.id === proposalId ? updated : item)); setSelectedId(updated.id); setMessage("Estado actualizado correctamente.");
  }

  async function submitLine(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || !selectedVersion || !editable) return setMessage("Esta versión no admite cambios.");
    const description = line.description_public.trim(); const cost = num(line.cost_budget); const margin = line.margin_applied.trim() ? num(line.margin_applied) : null;
    if (!description) return setMessage("La línea necesita descripción.");
    if (cost < 0 || (margin !== null && (margin < 0 || margin >= 100))) return setMessage("Revisa el coste y el margen.");
    if (line.start_date && line.end_date && line.start_date > line.end_date) return setMessage("La fecha final no puede ser anterior a la inicial.");
    const supplier = suppliers.find((item) => item.id === line.supplier_id);
    const payload = { ...line, supplier_id: supplier?.id || null, supplier_name: supplier?.name || null, description_public: description, proposal_version_id: selectedVersion.id, margin_applied: margin, sale_price: line.sale_price.trim() || null };
    setSaving(true); setMessage(null);
    const response = await fetch(editingLineId ? `/api/routsify/proposals/${selected.id}/lines/${editingLineId}` : `/api/routsify/proposals/${selected.id}/lines`, { method: editingLineId ? "PATCH" : "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
    const result = await response.json().catch(() => null); setSaving(false);
    if (!response.ok || !result?.ok) return setMessage(String(result?.error || "No se pudo guardar la línea."));
    replaceVersion(selected.id, selectedVersion.id, (version) => ({ ...version, budget_lines: editingLineId ? (version.budget_lines || []).map((item) => item.id === editingLineId ? result.data : item) : [...(version.budget_lines || []), result.data] }));
    setLine(emptyLine); setEditingLineId(null); setMessage(editingLineId ? "Línea actualizada correctamente." : "Línea añadida correctamente.");
  }

  async function removeLine(lineId: string) {
    if (!selected || !selectedVersion || !editable || !window.confirm("¿Eliminar esta línea del presupuesto?")) return;
    setSaving(true); setMessage(null);
    const response = await fetch(`/api/routsify/proposals/${selected.id}/lines/${lineId}`, { method: "DELETE" });
    const result = await response.json().catch(() => null); setSaving(false);
    if (!response.ok || !result?.ok) return setMessage(String(result?.error || "No se pudo eliminar la línea."));
    replaceVersion(selected.id, selectedVersion.id, (version) => ({ ...version, budget_lines: (version.budget_lines || []).filter((item) => item.id !== lineId) })); setMessage("Línea eliminada correctamente.");
  }

  function previewImportTable() { const parsed = parseImportTable(importText); setImportRows(parsed.rows); setImportErrors(parsed.errors); setMessage(parsed.errors.length ? "Corrige los errores antes de importar." : `${parsed.rows.length} líneas preparadas para importar.`); }
  async function readImportFile(event: ChangeEvent<HTMLInputElement>) { const file = event.target.files?.[0]; if (!file) return; const content = await file.text(); setImportText(content); const parsed = parseImportTable(content); setImportRows(parsed.rows); setImportErrors(parsed.errors); setMessage(parsed.errors.length ? "El archivo contiene errores." : `${parsed.rows.length} líneas leídas correctamente.`); }
  function downloadTemplate() { const content = "tipo_servicio;descripcion;descripcion_interna;proveedor;destino;fecha_inicio;fecha_fin;coste;margen;precio_venta;generar_compra\nflight;Vuelo Madrid - Tokio;Tarifa con maleta;Iberia;Japón;2026-10-01;2026-10-02;850;18;;si\naccommodation;Hotel en Tokio 4 noches;;Hotel ejemplo;Tokio;2026-10-02;2026-10-06;620;20;;si"; const blob = new Blob([content], { type: "text/csv;charset=utf-8" }); const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = "plantilla_presupuesto_routsify.csv"; link.click(); URL.revokeObjectURL(url); }
  async function importAll() {
    if (!selected || !selectedVersion || !editable) return setMessage("Esta versión no admite cambios.");
    if (!importRows.length || importErrors.length) return setMessage("Previsualiza una tabla válida antes de importar.");
    setSaving(true); setMessage(null);
    const response = await fetch(`/api/routsify/proposals/${selected.id}/lines/bulk`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ proposal_version_id: selectedVersion.id, rows: importRows }) });
    const result = await response.json().catch(() => null); setSaving(false);
    if (!response.ok || !result?.ok) { const details = Array.isArray(result?.details) ? result.details.map((item: { row?: number; error?: string }) => `Fila ${item.row}: ${item.error}`).join(" · ") : ""; return setMessage(`${String(result?.error || "No se pudo importar la tabla.")}${details ? ` · ${details}` : ""}`); }
    replaceVersion(selected.id, selectedVersion.id, (version) => ({ ...version, budget_lines: [...(version.budget_lines || []), ...(result.data as Line[])] })); setImportText(""); setImportRows([]); setImportErrors([]); setTab("manual"); setMessage(`${result.imported} líneas importadas. Los proveedores se han vinculado al directorio cuando existía coincidencia.`);
  }

  async function createVersion() {
    if (!selected || !selectedVersion) return;
    setSaving(true); setMessage(null); setShareData(null);
    const response = await fetch(`/api/routsify/proposals/${selected.id}/versions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ source_version_id: selectedVersion.id }),
    });
    const result = await response.json().catch(() => null); setSaving(false);
    if (!response.ok || !result?.ok) {
      const error = String(result?.error || "No se pudo crear la versión.");
      if (error.includes("editable_version_exists")) return setMessage("Ya existe una versión editable. Selecciónala en la barra de versiones para continuar los cambios.");
      if (error === "signed_contract_requires_amendment") return setMessage("Este expediente ya tiene un contrato firmado. Los cambios deben tramitarse mediante una adenda.");
      return setMessage(error);
    }
    const created = result.data as Version;
    setProposals((current) => current.map((proposal) => proposal.id === selected.id ? { ...proposal, status: "draft", current_version_id: created.id, proposal_versions: [created, ...(proposal.proposal_versions || []).filter((version) => version.id !== created.id)] } : proposal));
    setSelectedVersionId(created.id); setEditingLineId(null); setLine(emptyLine); resetAiImport(); setTab("manual");
    setMessage(`V${created.version_number} creada a partir de V${selectedVersion.version_number}. Ya puedes editarla sin alterar el histórico.`);
  }
  async function prepareShare() {
    if (!selected || linesOfVersion(latest).length === 0) return setMessage("Añade líneas antes de preparar el enlace."); setSaving(true); setMessage(null);
    const response = await fetch(`/api/routsify/proposals/${selected.id}/send`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ proposal_version_id: selectedVersion?.id }) }); const result = await response.json().catch(() => null); setSaving(false);
    if (!response.ok || !result?.ok) return setMessage(String(result?.error || "No se pudo generar el enlace."));
    setShareData(result.data); setProposals((current) => current.map((proposal) => proposal.id === selected.id ? { ...proposal, status: "sent", proposal_versions: (proposal.proposal_versions || []).map((version) => version.id === latest?.id ? { ...version, status: "sent", expires_at: result.data.expires_at } : version) } : proposal)); setMessage("Enlace privado preparado con la validez configurada en Ajustes.");
  }
  async function copyShareLink() { if (!shareData?.url) return; await navigator.clipboard.writeText(shareData.url); setMessage("Enlace copiado al portapapeles."); }

  function aiErrorMessage(error: unknown) {
    const code = String(error || "ai_import_failed");
    if (code === "openai_api_key_not_configured") return "Configura la clave de OpenAI en Ajustes > Integraciones antes de usar la importación AI.";
    if (code === "openai_timeout") return "El análisis ha tardado demasiado. Vuelve a intentarlo; si el PDF es muy extenso, divídelo.";
    if (code.includes("429")) return "OpenAI ha limitado temporalmente las solicitudes. Espera un momento y vuelve a intentarlo.";
    if (code === "proposal_version_locked" || code === "proposal_version_is_not_selected") return "Selecciona la versión editable actual antes de importar.";
    if (code === "openai_no_services_detected") return "No se han detectado servicios comprables. Revisa el PDF o ajusta el prompt en Ajustes > AI.";
    return `No se pudo analizar el itinerario (${code}).`;
  }

  async function analyzeItinerary() {
    if (!selected || !selectedVersion || !editable) return setMessage("Selecciona o crea una versión editable antes de importar con AI.");
    if (!aiFile) return setMessage("Selecciona un fichero PDF con la propuesta de itinerario.");
    if (aiFile.type !== "application/pdf" && !aiFile.name.toLowerCase().endsWith(".pdf")) return setMessage("El itinerario debe ser un fichero PDF.");
    if (aiFile.size <= 0 || aiFile.size > 15 * 1024 * 1024) return setMessage("El PDF debe ocupar entre 1 byte y 15 MB.");
    setAnalyzing(true); setMessage(null); setAiRows([]); setAiWarnings([]); setAiSummary(""); setAiModel("");
    try {
      const uploadResponse = await fetch(`/api/routsify/proposals/${selected.id}/ai-import/upload-url`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ proposal_version_id: selectedVersion.id, file_name: aiFile.name, size_bytes: aiFile.size, mime_type: "application/pdf" }),
      });
      const uploadResult = await uploadResponse.json().catch(() => null);
      if (!uploadResponse.ok || !uploadResult?.ok) throw new Error(String(uploadResult?.error || "upload_url_failed"));
      const putResponse = await fetch(String(uploadResult.signedUrl), { method: "PUT", headers: { "content-type": "application/pdf", "cache-control": "max-age=3600", "x-upsert": "false" }, body: aiFile });
      if (!putResponse.ok) throw new Error("pdf_upload_failed");
      const analyzeResponse = await fetch(`/api/routsify/proposals/${selected.id}/ai-import`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ proposal_version_id: selectedVersion.id, storage_path: uploadResult.path, file_name: aiFile.name, size_bytes: aiFile.size }),
      });
      const analyzeResult = await analyzeResponse.json().catch(() => null);
      if (!analyzeResponse.ok || !analyzeResult?.ok) throw new Error(String(analyzeResult?.error || "ai_import_failed"));
      const rows = Array.isArray(analyzeResult.data.rows) ? analyzeResult.data.rows as ImportRow[] : [];
      setAiRows(rows); setAiWarnings(Array.isArray(analyzeResult.data.warnings) ? analyzeResult.data.warnings : []); setAiSummary(String(analyzeResult.data.summary || "")); setAiModel(String(analyzeResult.data.model || ""));
      setMessage(`${rows.length} servicios detectados. Revísalos antes de incorporarlos a la versión.`);
    } catch (error) {
      setMessage(aiErrorMessage(error instanceof Error ? error.message : error));
    } finally {
      setAnalyzing(false);
    }
  }

  function setAiRowValue<K extends keyof ImportRow>(index: number, key: K, value: ImportRow[K]) {
    setAiRows((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, [key]: value } : row));
  }

  async function importAiServices() {
    if (!selected || !selectedVersion || !editable) return setMessage("Esta versión no admite cambios.");
    if (!aiRows.length) return setMessage("Analiza y revisa primero un itinerario.");
    if (aiRows.some((row) => !row.description_public.trim())) return setMessage("Todos los servicios necesitan una descripción.");
    setSaving(true); setMessage(null);
    const response = await fetch(`/api/routsify/proposals/${selected.id}/lines/bulk`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ proposal_version_id: selectedVersion.id, rows: aiRows }) });
    const result = await response.json().catch(() => null); setSaving(false);
    if (!response.ok || !result?.ok) return setMessage(String(result?.error || "No se pudieron importar los servicios detectados."));
    replaceVersion(selected.id, selectedVersion.id, (version) => ({ ...version, budget_lines: [...(version.budget_lines || []), ...(result.data as Line[])] }));
    const imported = Number(result.imported || aiRows.length); resetAiImport(); setTab("manual");
    setMessage(`${imported} servicios incorporados. Completa ahora proveedores, costes y márgenes.`);
  }

  return <div className="budget-page">
    <section className="client-kpis"><div className="kpi-card"><span className="kpi-icon">P</span><span className="kpi-copy"><strong>Presupuestos</strong><b>{proposals.length}</b><small>Total creados</small></span></div><div className="kpi-card"><span className="kpi-icon">B</span><span className="kpi-copy"><strong>Borradores</strong><b>{proposals.filter((item) => item.status === "draft").length}</b><small>En preparación</small></span></div><div className="kpi-card"><span className="kpi-icon">A</span><span className="kpi-copy"><strong>Aceptados</strong><b>{proposals.filter((item) => item.status === "accepted").length}</b><small>Cerrados con cliente</small></span></div></section>

    <section className="card budget-selector"><div className="client-filters client-filters-simple"><input className="input" placeholder="Buscar por expediente, cliente, destino o moneda..." value={query} onChange={(event) => setQuery(event.target.value)} /><button className={showCreate ? "btn secondary" : "btn"} type="button" onClick={() => setShowCreate((current) => !current)}>{showCreate ? "Cerrar formulario" : "Nuevo presupuesto"}</button></div>
      {showCreate ? <section className="creation-panel"><div className="creation-panel-header"><div><div className="eyebrow">Nuevo presupuesto</div><h2>Vincular a expediente</h2><p>Cada expediente trabaja con un presupuesto principal, varias versiones y una moneda estable.</p></div><button className="btn secondary" type="button" onClick={() => setShowCreate(false)}>Cancelar</button></div><form className="form" onSubmit={createProposal}><label>Expediente *<select autoFocus required value={caseId} onChange={(event) => setCaseId(event.target.value)}><option value="">Selecciona expediente</option>{availableCases.map((item) => <option key={item.id} value={item.id}>{item.case_code} · {item.clients?.display_name || item.destination || item.title || "Expediente"} · {item.currency || "EUR"}</option>)}</select></label>{availableCases.length === 0 ? <p className="form-warning">No hay expedientes sin presupuesto.</p> : null}<div className="form-actions"><button className="btn" type="submit" disabled={saving || availableCases.length === 0}>{saving ? "Guardando..." : "Crear y abrir presupuesto"}</button></div></form></section> : null}
      {message ? <p className="client-message" role="status">{message}</p> : null}
      {proposals.length === 0 ? <div className="empty-state"><h2>Todavía no hay presupuestos</h2><p>Crea un expediente y después su presupuesto.</p></div> : <div className="table-scroll"><table><thead><tr><th>Expediente</th><th>Cliente</th><th>Estado</th><th>Versión</th><th>Líneas</th><th>Venta</th><th></th></tr></thead><tbody>{filtered.map((proposal) => <tr key={proposal.id} className={proposal.id === selected?.id ? "selected-row" : ""}><td><strong>{proposal.cases?.case_code || "Presupuesto"}</strong><br /><small>{proposal.cases?.currency || "EUR"}</small></td><td>{proposal.cases?.clients?.display_name || "—"}</td><td>{statusText(proposal.status)}</td><td>v{latestVersion(proposal)?.version_number || 1}</td><td>{linesOfVersion(latestVersion(proposal)).length}</td><td>{money(totals(proposal).sale, String(proposal.cases?.currency || "EUR"))}</td><td><button className="btn secondary" type="button" onClick={() => selectProposal(proposal.id)}>Abrir</button></td></tr>)}</tbody></table></div>}
    </section>

    {selected ? <section className="card budget-workspace"><div className="budget-workspace-header"><div><span className="eyebrow">{selected.cases?.case_code}</span><h2>{selected.cases?.clients?.display_name || "Presupuesto"} · {selected.cases?.destination || "Sin destino"}</h2><p>V{selectedVersion?.version_number || 1} · {statusText(selectedVersion?.status || selected.status)} · {selectedLines.length} servicios · {selectedCurrency}</p></div><div className="budget-header-actions"><a className="btn secondary" href={`/expedientes?caseId=${encodeURIComponent(selected.cases?.id || "")}`}>Abrir expediente</a><a className="btn secondary" href={`/compras?caseId=${encodeURIComponent(selected.cases?.id || "")}`}>Compras</a><a className="btn secondary" href="/proveedores">Proveedores</a></div></div>
      <div className="budget-version-rail" aria-label="Versiones del presupuesto">{versions.map((version) => <button key={version.id} type="button" className={`budget-version-chip${selectedVersion?.id === version.id ? " active" : ""}`} onClick={() => { setSelectedVersionId(version.id); setEditingLineId(null); setLine(emptyLine); setShareData(null); }}><strong>V{version.version_number}</strong><span>{statusText(version.status)}</span>{version.id === selected.current_version_id ? <small>Actual</small> : version.locked ? <small>Histórico</small> : null}</button>)}<button className="budget-version-add" type="button" disabled={saving || hasEditableVersion || !selectedVersion} onClick={() => void createVersion()}>+ Nueva versión desde V{selectedVersion?.version_number || 1}</button></div>
      <div className="budget-totals"><div><span>Coste presupuestado</span><strong>{money(selectedTotals.cost, selectedCurrency)}</strong></div><div><span>Venta</span><strong>{money(selectedTotals.sale, selectedCurrency)}</strong></div><div><span>Beneficio previsto</span><strong>{money(selectedTotals.profit, selectedCurrency)}</strong></div><div><span>Margen previsto</span><strong>{selectedTotals.sale ? `${selectedTotals.margin.toFixed(1)}%` : "0%"}</strong></div><div><span>Coste real / estimado</span><strong>{money(selectedTotals.realCost, selectedCurrency)}</strong></div><div><span>Beneficio real / estimado</span><strong>{money(selectedTotals.realProfit, selectedCurrency)}</strong><small>{selectedTotals.hasRealCost ? ` · margen ${selectedTotals.realMargin.toFixed(1)}% · desviación ${money(selectedTotals.deviation, selectedCurrency)}` : " · pendiente de compras reales"}</small></div></div>
      <nav className="budget-tabs"><button className={tab === "manual" ? "active" : ""} type="button" onClick={() => setTab("manual")}>Servicios</button><button className={tab === "import" ? "active" : ""} type="button" onClick={() => setTab("import")}>Importar tabla</button><button className={tab === "ai" ? "active" : ""} type="button" onClick={() => setTab("ai")}>Importar con AI</button><button className={tab === "versions" ? "active" : ""} type="button" onClick={() => setTab("versions")}>Enviar</button></nav>

      {tab === "manual" ? <div className="budget-manual-layout"><section className="budget-lines-panel"><div className="panel-head"><div><h3>Servicios del presupuesto</h3><p>Todos los importes y compras quedan relacionados con esta versión.</p></div>{editable && selectedLines.length ? <div className="budget-global-margin"><label>Margen global %<input className="input" type="number" min="0" max="99" step="0.1" value={globalMargin} onChange={(event) => setGlobalMargin(event.target.value)} /></label><button className="btn secondary" type="button" disabled={saving} onClick={() => void applyGlobalMargin()}>Aplicar a todos</button></div> : null}</div>{selectedLines.length ? <div className="table-scroll"><table><thead><tr><th>Tipo / descripción</th><th>Fechas</th><th>Proveedor</th><th>Coste previsto / real</th><th>Venta</th><th>Compra</th><th></th></tr></thead><tbody>{selectedLines.map((item) => <tr key={item.id}><td><strong>{serviceText(item.service_type_code)}</strong><br />{item.description_public}<br />{item.description_internal ? <small>{item.description_internal}</small> : null}</td><td>{item.start_date || "—"}<br /><small>{item.end_date || ""}</small></td><td>{item.supplier_name || "—"}<br /><small>{item.destination_segment || ""}</small></td><td>{money(item.cost_budget, selectedCurrency)}{item.cost_real !== null && item.cost_real !== undefined ? <><br /><small>Real: {money(item.cost_real, selectedCurrency)}{item.cost_real_source ? ` · ${item.cost_real_source}` : ""}</small></> : null}</td><td>{money(item.sale_price, selectedCurrency)}<br /><small>{percentFromStored(item.margin_applied)}% margen</small></td><td>{item.creates_expected_purchase ? "Sí" : "No"}</td><td>{editable ? <div className="table-actions"><button className="link-button" type="button" onClick={() => { setLine(draftFromLine(item)); setEditingLineId(item.id); window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" }); }}>Editar</button><button className="link-button danger-text" type="button" onClick={() => void removeLine(item.id)}>Eliminar</button></div> : null}</td></tr>)}</tbody></table></div> : <div className="empty-state"><h3>Presupuesto vacío</h3><p>Añade el primer servicio con el formulario o utiliza Importar tabla.</p><button className="btn secondary" type="button" onClick={() => setTab("import")}>Importar tabla</button></div>}</section>
        <section className="budget-line-editor"><div className="panel-head"><div><h3>{editingLineId ? "Editar servicio" : "Añadir servicio manualmente"}</h3><p>La venta se calcula con el margen, salvo que indiques un precio de venta.</p></div>{editingLineId ? <button className="link-button" type="button" onClick={() => { setEditingLineId(null); setLine(emptyLine); }}>Cancelar edición</button> : null}</div>{editable ? <form className="form" onSubmit={submitLine}><div className="grid grid-2"><label>Tipo de servicio *<select value={line.service_type_code} onChange={(event) => setLineValue("service_type_code", event.target.value)}>{serviceTypes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label><span className="supplier-picker-head">Proveedor<button aria-label="Crear proveedor" className="link-button" type="button" onClick={() => { setShowSupplierModal(true); setMessage(null); }}>+ Nuevo</button></span><select aria-label="Proveedor" value={line.supplier_id} onChange={(event) => setSupplier(event.target.value)}><option value="">Sin proveedor</option>{activeSuppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}{supplier.category ? ` · ${supplier.category}` : ""}{supplier.default_margin_pct === null || supplier.default_margin_pct === undefined ? "" : ` · ${supplier.default_margin_pct}%`}</option>)}</select>{line.supplier_name && !line.supplier_id ? <small>Proveedor histórico sin ficha: {line.supplier_name}</small> : null}</label></div>{activeSuppliers.length === 0 ? <p className="field-help">No hay proveedores activos. Créalo sin salir del presupuesto.</p> : null}<label>Descripción para el cliente *<input className="input" required value={line.description_public} onChange={(event) => setLineValue("description_public", event.target.value)} /></label><label>Descripción / notas internas<textarea className="input" rows={2} value={line.description_internal} onChange={(event) => setLineValue("description_internal", event.target.value)} /></label><div className="grid grid-2"><label>Destino o tramo<input className="input" value={line.destination_segment} onChange={(event) => setLineValue("destination_segment", event.target.value)} /></label><label>Generar compra proveedor<span className="checkbox-control"><input type="checkbox" checked={line.creates_expected_purchase} onChange={(event) => setLineValue("creates_expected_purchase", event.target.checked)} /> Sí, al aceptar</span></label></div><div className="grid grid-2"><label>Fecha inicio<input className="input" type="date" value={line.start_date} onChange={(event) => setLineValue("start_date", event.target.value)} /></label><label>Fecha fin<input className="input" type="date" min={line.start_date || undefined} value={line.end_date} onChange={(event) => setLineValue("end_date", event.target.value)} /></label></div><div className="grid grid-3"><label>Coste *<input className="input" type="number" min="0" step="0.01" required value={line.cost_budget} onChange={(event) => setLineValue("cost_budget", event.target.value)} /></label><label>Margen %<input className="input" type="number" min="0" max="99" step="0.1" value={line.margin_applied} onChange={(event) => setLineValue("margin_applied", event.target.value)} placeholder={`Automático (${automaticMargin}%)`} /><small>{line.margin_applied ? "Margen forzado para esta línea." : selectedSupplier?.default_margin_pct === null || selectedSupplier?.default_margin_pct === undefined ? "Se aplicará el margen global de Ajustes." : `Se aplicará el margen de ${selectedSupplier.name}.`}</small></label><label>Venta manual<input className="input" type="number" min="0" step="0.01" placeholder="Opcional" value={line.sale_price} onChange={(event) => setLineValue("sale_price", event.target.value)} /></label></div><p className="field-help">Prioridad: margen escrito en la línea → proveedor → global de Ajustes. Moneda: <strong>{selectedCurrency}</strong> · Margen efectivo: <strong>{line.margin_applied || automaticMargin}%</strong> · Venta resultante: <strong>{money(preview, selectedCurrency)}</strong> · Beneficio: <strong>{money(preview - num(line.cost_budget), selectedCurrency)}</strong></p><button className="btn" type="submit" disabled={saving}>{saving ? "Guardando..." : editingLineId ? "Guardar cambios" : "Añadir servicio"}</button></form> : <p className="form-warning">Esta versión está bloqueada. Crea una nueva versión para modificarla.</p>}</section></div> : null}

      {showSupplierModal ? <div className="budget-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setShowSupplierModal(false); }}><section className="budget-mini-modal" role="dialog" aria-modal="true" aria-labelledby="new-supplier-title"><div className="panel-head"><div><span className="eyebrow">Alta rápida</span><h2 id="new-supplier-title">Nuevo proveedor</h2><p>Define cómo lo buscaréis y cómo debe figurar fiscalmente.</p></div><button className="link-button" type="button" disabled={saving} onClick={() => setShowSupplierModal(false)}>Cerrar</button></div><form className="form" onSubmit={createSupplierInline}><label>Nombre interno *<input className="input" autoFocus required value={supplierDraft.name} onChange={(event) => setSupplierDraft((current) => ({ ...current, name: event.target.value }))} /><small>El nombre corto para encontrarlo en presupuestos.</small></label><label>Nombre fiscal / comercial *<input className="input" required value={supplierDraft.fiscal_name} onChange={(event) => setSupplierDraft((current) => ({ ...current, fiscal_name: event.target.value }))} /><small>El que se enviará a Holded y figurará en documentación fiscal.</small></label><div className="grid grid-2"><label>Categoría<input className="input" placeholder="Hotel, aerolínea, DMC…" value={supplierDraft.category} onChange={(event) => setSupplierDraft((current) => ({ ...current, category: event.target.value }))} /></label><label>Email<input className="input" type="email" value={supplierDraft.email} onChange={(event) => setSupplierDraft((current) => ({ ...current, email: event.target.value }))} /></label></div><label>Margen predeterminado (%)<input className="input" type="number" min="0" max="99" step="0.1" placeholder={`Global (${initialGlobalMargin}%)`} value={supplierDraft.default_margin_pct} onChange={(event) => setSupplierDraft((current) => ({ ...current, default_margin_pct: event.target.value }))} /></label><div className="form-actions"><button className="btn secondary" type="button" disabled={saving} onClick={() => setShowSupplierModal(false)}>Cancelar</button><button className="btn" type="submit" disabled={saving}>{saving ? "Creando…" : "Crear y seleccionar"}</button></div></form></section></div> : null}

      {tab === "import" ? <section className="budget-import-panel"><div className="panel-head"><div><h3>Importar tabla de servicios</h3><p>Copia desde Excel o Google Sheets, o sube un archivo CSV/TSV. Los nombres de proveedor se vinculan al directorio cuando existe coincidencia. Los importes se interpretan en {selectedCurrency}.</p></div><button className="btn secondary" type="button" onClick={downloadTemplate}>Descargar plantilla</button></div><div className="grid grid-2"><label>Archivo CSV o TSV<input className="input" type="file" accept=".csv,.tsv,text/csv,text/tab-separated-values" onChange={(event) => void readImportFile(event)} /></label><div className="field-help">Cabeceras aceptadas: tipo, descripción, proveedor, destino, fecha inicio, fecha fin, coste, margen, precio venta y generar compra.</div></div><label>Pegar tabla<textarea className="input budget-import-text" rows={10} value={importText} onChange={(event) => setImportText(event.target.value)} placeholder="tipo_servicio;descripcion;proveedor;fecha_inicio;fecha_fin;coste;margen;generar_compra" /></label><div className="form-actions"><button className="btn secondary" type="button" onClick={previewImportTable}>Previsualizar</button><button className="btn" type="button" disabled={saving || !importRows.length || Boolean(importErrors.length) || !editable} onClick={() => void importAll()}>{saving ? "Importando..." : `Importar ${importRows.length || ""} líneas`}</button></div>{importErrors.length ? <div className="form-warning"><strong>Errores detectados:</strong><ul>{importErrors.map((error) => <li key={error}>{error}</li>)}</ul></div> : null}{importRows.length ? <div className="table-scroll"><table><thead><tr><th>Fila</th><th>Tipo</th><th>Descripción</th><th>Proveedor</th><th>Coste</th><th>Margen</th><th>Venta prevista</th></tr></thead><tbody>{importRows.slice(0, 50).map((item) => <tr key={item.rowNumber}><td>{item.rowNumber}</td><td>{serviceText(item.service_type_code)}</td><td>{item.description_public}</td><td>{item.supplier_name || "—"}</td><td>{money(item.cost_budget, selectedCurrency)}</td><td>{item.margin_applied ? `${item.margin_applied}%` : `Automático (${initialGlobalMargin}%)`}</td><td>{money(salePreview(item.cost_budget, item.margin_applied, item.sale_price, initialGlobalMargin), selectedCurrency)}</td></tr>)}</tbody></table>{importRows.length > 50 ? <p className="field-help">Se muestran 50 de {importRows.length} líneas.</p> : null}</div> : null}</section> : null}

      {tab === "ai" ? <section className="budget-import-panel budget-ai-panel"><div className="panel-head"><div><span className="eyebrow">PDF → servicios</span><h3>Importar itinerario con AI</h3><p>La AI identifica todos los servicios que habrá que comprar, también los opcionales y condicionales. Nada se añade al presupuesto hasta que revises y confirmes el resultado.</p></div><a className="btn secondary" href="/ajustes?tab=ai">Configurar prompt y modelo</a></div>{editable ? <><div className="budget-ai-uploader"><label>Propuesta de itinerario en PDF (máximo 15 MB)<input className="input" type="file" accept="application/pdf,.pdf" disabled={analyzing} onChange={(event) => { setAiFile(event.target.files?.[0] || null); setAiRows([]); setAiWarnings([]); setAiSummary(""); }} /></label><button className="btn" type="button" disabled={!aiFile || analyzing} onClick={() => void analyzeItinerary()}>{analyzing ? "Analizando itinerario…" : "Analizar PDF"}</button></div>{analyzing ? <p className="field-help" role="status">Extrayendo fechas, tramos, alojamientos, transportes, actividades, seguros y opcionales. Puede tardar alrededor de un minuto.</p> : null}{aiRows.length ? <><div className="budget-ai-result"><div><strong>{aiRows.length} servicios detectados</strong>{aiModel ? <small>Modelo: {aiModel}</small> : null}</div>{aiSummary ? <p>{aiSummary}</p> : null}</div>{aiWarnings.length ? <div className="form-warning"><strong>Revisión recomendada:</strong><ul>{aiWarnings.map((warning) => <li key={warning}>{warning}</li>)}</ul></div> : null}<div className="table-scroll"><table className="budget-ai-table"><thead><tr><th>Incluir</th><th>Prioridad</th><th>Tipo</th><th>Servicio</th><th>Fechas / destino</th><th>Referencia</th><th></th></tr></thead><tbody>{aiRows.map((item, index) => <tr key={`${item.rowNumber}-${index}`}><td><input aria-label={`Incluir servicio ${index + 1}`} type="checkbox" checked={item.included} onChange={(event) => setAiRowValue(index, "included", event.target.checked)} /></td><td><select aria-label={`Prioridad servicio ${index + 1}`} value={item.requirement_level} onChange={(event) => setAiRowValue(index, "requirement_level", event.target.value as LineDraft["requirement_level"])}><option value="required">Obligatorio</option><option value="conditional">Condicional</option><option value="optional">Opcional</option></select></td><td><select aria-label={`Tipo servicio ${index + 1}`} value={item.service_type_code} onChange={(event) => setAiRowValue(index, "service_type_code", event.target.value)}>{serviceTypes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></td><td><textarea aria-label={`Descripción servicio ${index + 1}`} rows={2} value={item.description_public} onChange={(event) => setAiRowValue(index, "description_public", event.target.value)} /><small>{Math.round(item.ai_confidence * 100)}% confianza</small></td><td><div className="budget-ai-dates"><input aria-label="Fecha inicial" type="date" value={item.start_date} onChange={(event) => setAiRowValue(index, "start_date", event.target.value)} /><input aria-label="Fecha final" type="date" value={item.end_date} onChange={(event) => setAiRowValue(index, "end_date", event.target.value)} /><input aria-label="Destino" placeholder="Destino / tramo" value={item.destination_segment} onChange={(event) => setAiRowValue(index, "destination_segment", event.target.value)} /></div></td><td><textarea aria-label={`Referencia servicio ${index + 1}`} rows={2} value={item.source_reference} onChange={(event) => setAiRowValue(index, "source_reference", event.target.value)} /></td><td><button className="link-button danger-text" type="button" onClick={() => setAiRows((current) => current.filter((_, rowIndex) => rowIndex !== index))}>Quitar</button></td></tr>)}</tbody></table></div><div className="form-actions"><button className="btn secondary" type="button" disabled={saving} onClick={resetAiImport}>Descartar resultado</button><button className="btn" type="button" disabled={saving || !aiRows.length} onClick={() => void importAiServices()}>{saving ? "Importando…" : `Incorporar ${aiRows.length} servicios`}</button></div><p className="field-help">Se incorporan con coste 0 y sin proveedor. Después completa costes y márgenes desde Servicios. Los opcionales no suman al total mientras no marques “Incluir”.</p></> : null}</> : <div className="form-warning">Esta versión es histórica y no se puede alterar. Crea una nueva versión desde la barra superior.</div>}</section> : null}

      {tab === "versions" ? <section className="budget-versions-panel"><div className="grid grid-2"><div><h3>Versión que se enviará</h3><p><strong>V{selectedVersion?.version_number}</strong> · {statusText(selectedVersion?.status)} · {selectedLines.length} servicios · {money(selectedTotals.sale, selectedCurrency)}</p>{editable ? <p className="field-help">Esta es la versión actual y editable. El enlace privado y la aceptación quedarán vinculados exactamente a ella.</p> : <p className="field-help">Estás viendo una versión histórica. Selecciona la versión “Actual” en la barra superior o crea una nueva versión desde esta.</p>}<button className="btn secondary" type="button" onClick={() => void createVersion()} disabled={saving || hasEditableVersion || !selectedVersion}>Crear V{(versions[0]?.version_number || 0) + 1} desde V{selectedVersion?.version_number}</button></div><div><h3>Estado y envío</h3>{editable ? <><label>Estado interno<select value={selected.status || "draft"} onChange={(event) => void changeStatus(selected.id, event.target.value)} disabled={savingId === selected.id}>{statuses.filter(([value]) => value !== "accepted").map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><button className="btn" type="button" onClick={() => void prepareShare()} disabled={saving || selectedLines.length === 0}>{saving ? "Preparando..." : `Preparar enlace de V${selectedVersion?.version_number}`}</button></> : <p className="field-help">Las versiones aceptadas permanecen bloqueadas como histórico. La versión finalmente aceptada será la única disponible al crear el contrato.</p>}{shareData ? <div className="share-panel"><label>Enlace privado<input className="input" readOnly value={shareData.url} /></label><div className="form-actions"><button className="btn secondary" type="button" onClick={() => void copyShareLink()}>Copiar enlace</button>{shareData.mailto_url ? <a className="btn secondary" href={shareData.mailto_url}>Email</a> : null}{shareData.whatsapp_url ? <a className="btn" href={shareData.whatsapp_url} target="_blank" rel="noreferrer">WhatsApp</a> : null}</div><small>Válido hasta {new Date(shareData.expires_at).toLocaleDateString("es-ES")} según la política configurada.</small></div> : null}</div></div></section> : null}
    </section> : null}
  </div>;
}
