export type CaseRow = { id: string; case_code: string; title?: string | null; status?: string | null; destination?: string | null; trip_start?: string | null; trip_end?: string | null; accepted_value?: number | string | null; currency?: string | null; next_action?: string | null; clients?: { id?: string; display_name?: string | null; email?: string | null; phone?: string | null; tax_id?: string | null; billing_address?: unknown } | null };
export type Traveler = { id: string; traveler_type?: string; first_name?: string; last_name?: string; birth_date?: string | null; nationality?: string | null; document_country?: string | null; document_number?: string | null; document_expires_at?: string | null; review_status?: string | null; ocr_status?: string | null; ocr_confidence?: number | string | null };
export type DocumentRow = { id: string; title?: string | null; file_name?: string | null; type?: string | null; document_type?: string | null; status?: string | null; mime_type?: string | null; ocr_status?: string | null; created_at?: string | null };
export type TaskRow = { id: string; title?: string; status?: string; priority?: string; due_at?: string | null; payload?: Record<string, unknown> | null };
export type TimelineRow = { id: string; event_type?: string; title?: string; payload?: Record<string, unknown> | null; created_at?: string };
export type ContractRow = { id: string; title?: string; status?: string; external_url?: string | null; signed_at?: string | null; notes?: string | null };
export type PaymentRow = { id: string; payment_reference?: string; amount?: number | string; currency?: string; method?: string; status?: string; confirmed_at?: string | null };
export type FiscalRow = { id: string; document_kind?: string; document_number?: string | null; status?: string; amount?: number | string; tax_amount?: number | string; currency?: string; issued_at?: string | null };
export type PurchaseRow = { id: string; supplier_name?: string | null; service?: string | null; expected_amount?: number | string | null; amount?: number | string | null; status?: string | null };
export type ProposalRow = { id: string; status?: string | null; proposal_versions?: Array<{ version_number?: number; total_sale?: number | string }> | null };
export type WorkspaceProps = { initialCase: CaseRow; initialTravelers?: Traveler[]; initialDocuments?: DocumentRow[]; initialTasks?: TaskRow[]; initialTimeline?: TimelineRow[]; initialContracts?: ContractRow[]; initialPayments?: PaymentRow[]; initialFiscal?: FiscalRow[]; initialPurchases?: PurchaseRow[]; initialProposals?: ProposalRow[] };

export function numberValue(value: unknown) { const parsed = Number(value || 0); return Number.isFinite(parsed) ? parsed : 0; }
export function money(value: unknown, currency = "EUR") { return new Intl.NumberFormat("es-ES", { style: "currency", currency }).format(numberValue(value)); }
export function formatDate(value?: string | null) { return value ? new Date(value).toLocaleDateString("es-ES") : "—"; }
export function formatDateTime(value?: string | null) { return value ? new Date(value).toLocaleString("es-ES") : "—"; }
