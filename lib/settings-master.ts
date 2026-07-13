export type SettingScope = "global" | "module" | "user" | "role";
export type SettingValueType = "string" | "number" | "boolean" | "select" | "multi_select" | "json" | "color" | "file" | "date" | "time";

export type AppSetting = {
  id: string;
  key: string;
  module: string;
  label: string;
  description?: string;
  value: string | number | boolean | string[] | Record<string, unknown>;
  defaultValue: string | number | boolean | string[] | Record<string, unknown>;
  valueType: SettingValueType;
  scope: SettingScope;
  editable: boolean;
  options?: string[];
  isSensitive?: boolean;
  isEncrypted?: boolean;
  requiresReload?: boolean;
  requiresRecalculation?: boolean;
  requiresPermission?: string;
  validationRules?: Record<string, unknown>;
  affectedModules?: string[];
  eventName?: string;
  updatedBy?: string;
  updatedAt?: string;
};

export type SettingsModule = { id: string; label: string; description: string; icon: string; eventName: string };
export type SettingsAuditLog = { id: string; settingKey: string; module: string; oldValue: string; newValue: string; userName: string; level: "info" | "warning" | "error" | "critical"; eventName: string; createdAt: string; applied: boolean; requiresRecalculation: boolean };
export type SettingsAction = { id: string; label: string; description: string; category: "sync" | "recalculate" | "system" | "security" | "backup"; requiresConfirmation: boolean; eventName: string };

export const appRoles = ["admin", "direction", "sales", "operations", "billing", "viewer"] as const;
export type AppRole = (typeof appRoles)[number];
export const appRoleLabels: Record<AppRole, string> = {
  admin: "Administrador",
  direction: "Dirección",
  sales: "Ventas",
  operations: "Operaciones",
  billing: "Facturación",
  viewer: "Solo lectura",
};

export const visibleNavigationModules = ["Inicio", "Control operativo", "Clientes", "Expedientes", "Presupuestos", "Compras / Proveedores", "Informes", "Ajustes"];

export const settingsModules: SettingsModule[] = [
  { id: "general", label: "General", description: "Empresa, idioma, moneda, fechas y comportamiento base.", icon: "⚙", eventName: "system_settings.updated" },
  { id: "appearance", label: "Apariencia y marca", description: "Colores, tipografía, densidad, radios y sidebar.", icon: "🎨", eventName: "theme.updated" },
  { id: "navigation", label: "Menú y navegación", description: "Módulos visibles del backoffice.", icon: "☰", eventName: "navigation.updated" },
  { id: "clients", label: "Clientes y CRM", description: "Dedupe, datos fiscales, origen, Holded e historial.", icon: "👥", eventName: "client_settings.updated" },
  { id: "cases", label: "Expedientes", description: "Estados, bloqueos, viajeros, contrato, pago y cierre.", icon: "▣", eventName: "case_settings.updated" },
  { id: "budgets", label: "Presupuestos", description: "Versiones, snapshots, validez, landing y revisión interna.", icon: "📄", eventName: "budget_settings.updated" },
  { id: "margins", label: "Márgenes y precios", description: "Fórmula activa, límites y redondeos.", icon: "%", eventName: "margin_rules.updated" },
  { id: "purchases", label: "Compras / Proveedores", description: "Compras esperadas, matching y tolerancias.", icon: "🛒", eventName: "purchase_settings.updated" },
  { id: "documents", label: "Documentación", description: "Retención y revisión de documentos.", icon: "📁", eventName: "document_settings.updated" },
  { id: "contracts", label: "Contrato y pago", description: "Firma, pago externo, bloqueo y evidencia.", icon: "✍", eventName: "contract_payment_settings.updated" },
  { id: "reports", label: "Informes y KPIs", description: "KPIs visibles, objetivos y exportación.", icon: "📊", eventName: "report_config.updated" },
  { id: "integrations", label: "Integraciones", description: "Holded, Fillout, Booking, pagos y OCR.", icon: "🔌", eventName: "integration.updated" },
  { id: "fiscal", label: "Fiscal y contabilidad", description: "Modo fiscal, documentos y revisión de asesoría.", icon: "€", eventName: "fiscal_mode.updated" },
  { id: "security", label: "Seguridad y privacidad", description: "HMAC, sesiones, RGPD, cifrado y backups.", icon: "🛡", eventName: "security_policy.updated" },
  { id: "logs", label: "Logs y auditoría", description: "Cambios sensibles, reintentos y accesos.", icon: "🧾", eventName: "audit_settings.updated" },
  { id: "system", label: "Sistema", description: "Entorno, jobs, caché, backup y salud.", icon: "🖥", eventName: "system_settings.updated" },
];

export const settingsEvents = ["settings.updated", "settings.reset", "settings.exported", "settings.imported", "theme.updated", "integration.connected", "integration.disconnected", "margin_rules.updated", "fiscal_mode.updated", "report_config.updated", "roles.updated", "security_policy.updated", "system_cache_cleared", "metrics_recalculated"];

export const defaultSettings: AppSetting[] = [
  { id: "company_name", key: "company.name", module: "general", label: "Nombre de la empresa", description: "Se muestra en la cabecera y documentos internos.", value: "Routsify", defaultValue: "Routsify", valueType: "string", scope: "global", editable: true, affectedModules: ["all"] },
  { id: "timezone", key: "company.timezone", module: "general", label: "Zona horaria", value: "Europe/Madrid", defaultValue: "Europe/Madrid", valueType: "select", options: ["Europe/Madrid", "UTC", "Europe/London", "America/Costa_Rica", "America/Mexico_City"], scope: "global", editable: true, requiresRecalculation: true, affectedModules: ["tasks", "reports", "calendar"] },
  { id: "currency", key: "money.currency", module: "general", label: "Moneda por defecto", value: "EUR", defaultValue: "EUR", valueType: "select", options: ["EUR", "USD", "GBP", "CRC", "MXN"], scope: "global", editable: true, requiresRecalculation: true, affectedModules: ["budgets", "reports", "payments"] },
  { id: "date_format", key: "company.date_format", module: "general", label: "Formato de fecha", value: "DD/MM/YYYY", defaultValue: "DD/MM/YYYY", valueType: "select", options: ["DD/MM/YYYY", "YYYY-MM-DD", "MM/DD/YYYY"], scope: "global", editable: true, affectedModules: ["all"] },

  { id: "primary_color", key: "theme.primary", module: "appearance", label: "Color principal", description: "Botones, enlaces y elementos activos.", value: "#379237", defaultValue: "#379237", valueType: "color", scope: "global", editable: true, eventName: "theme.updated", affectedModules: ["all"] },
  { id: "sidebar_color", key: "theme.sidebar", module: "appearance", label: "Color del menú lateral", value: "#14532d", defaultValue: "#14532d", valueType: "color", scope: "global", editable: true, eventName: "theme.updated", affectedModules: ["all"] },
  { id: "accent_color", key: "theme.accent", module: "appearance", label: "Color de acento", value: "#f0a528", defaultValue: "#f0a528", valueType: "color", scope: "global", editable: true, eventName: "theme.updated", affectedModules: ["all"] },
  { id: "background_color", key: "theme.background", module: "appearance", label: "Fondo de la aplicación", value: "#f7faf7", defaultValue: "#f7faf7", valueType: "color", scope: "global", editable: true, eventName: "theme.updated", affectedModules: ["all"] },
  { id: "surface_color", key: "theme.surface", module: "appearance", label: "Fondo de tarjetas", value: "#ffffff", defaultValue: "#ffffff", valueType: "color", scope: "global", editable: true, eventName: "theme.updated", affectedModules: ["all"] },
  { id: "theme_radius", key: "theme.radius", module: "appearance", label: "Redondeo de tarjetas", value: 16, defaultValue: 16, valueType: "number", scope: "global", editable: true, validationRules: { min: 4, max: 28 }, eventName: "theme.updated", affectedModules: ["all"] },
  { id: "theme_density", key: "theme.density", module: "appearance", label: "Densidad visual", value: "comfortable", defaultValue: "comfortable", valueType: "select", options: ["compact", "comfortable", "spacious"], scope: "global", editable: true, eventName: "theme.updated", affectedModules: ["all"] },
  { id: "theme_font", key: "theme.font", module: "appearance", label: "Tipografía", value: "Inter", defaultValue: "Inter", valueType: "select", options: ["Inter", "System", "Serif"], scope: "global", editable: true, eventName: "theme.updated", affectedModules: ["all"] },
  { id: "sidebar_width", key: "theme.sidebar_width", module: "appearance", label: "Ancho del menú lateral", value: 236, defaultValue: 236, valueType: "number", scope: "global", editable: true, validationRules: { min: 200, max: 320 }, eventName: "theme.updated", affectedModules: ["all"] },

  { id: "nav_modules", key: "navigation.modules", module: "navigation", label: "Módulos visibles", value: visibleNavigationModules, defaultValue: visibleNavigationModules, valueType: "multi_select", options: visibleNavigationModules, scope: "role", editable: true, eventName: "navigation.updated", affectedModules: ["all"] },
  { id: "client_dedupe_email", key: "clients.dedupe.email", module: "clients", label: "Dedupe por email", value: true, defaultValue: true, valueType: "boolean", scope: "global", editable: true, affectedModules: ["clients", "cases", "integrations"] },
  { id: "client_fiscal_required", key: "clients.fiscal.required", module: "clients", label: "Datos fiscales obligatorios", value: true, defaultValue: true, valueType: "boolean", scope: "global", editable: true, affectedModules: ["clients", "contracts", "fiscal"] },
  { id: "case_close_requires_purchases", key: "cases.close.requires_purchases", module: "cases", label: "Bloquear cierre con compras pendientes", value: true, defaultValue: true, valueType: "boolean", scope: "global", editable: true, requiresRecalculation: true, affectedModules: ["cases", "purchases", "reports"] },
  { id: "budget_validity", key: "budgets.validity_days", module: "budgets", label: "Validez por defecto (días)", value: 15, defaultValue: 15, valueType: "number", scope: "global", editable: true, validationRules: { min: 1, max: 90 }, affectedModules: ["budgets", "tasks"] },
  { id: "budget_lock_accepted", key: "budgets.lock_accepted", module: "budgets", label: "Bloquear versión aceptada", value: true, defaultValue: true, valueType: "boolean", scope: "global", editable: true, affectedModules: ["budgets", "contracts", "reports"] },
  { id: "margin_formula", key: "margins.formula", module: "margins", label: "Fórmula activa", description: "Margen sobre venta o markup sobre coste.", value: "margin_on_sale", defaultValue: "margin_on_sale", valueType: "select", options: ["margin_on_sale", "markup_on_cost"], scope: "global", editable: true, requiresRecalculation: true, eventName: "margin_rules.updated", affectedModules: ["budgets", "reports"] },
  { id: "minimum_margin", key: "margins.minimum", module: "margins", label: "Margen mínimo global (%)", value: 12, defaultValue: 12, valueType: "number", scope: "global", editable: true, validationRules: { min: 0, max: 100 }, requiresRecalculation: true, eventName: "margin_rules.updated", affectedModules: ["budgets", "reports"] },
  { id: "purchase_auto_create", key: "purchases.auto_create", module: "purchases", label: "Generar compras esperadas", value: true, defaultValue: true, valueType: "boolean", scope: "global", editable: true, affectedModules: ["budgets", "purchases"] },
  { id: "purchase_confidence", key: "purchases.match.min_confidence", module: "purchases", label: "Confianza mínima de match (%)", value: 70, defaultValue: 70, valueType: "number", scope: "global", editable: true, validationRules: { min: 0, max: 100 }, affectedModules: ["purchases", "reports"] },

  { id: "document_retention", key: "documents.retention", module: "documents", label: "Retención documentos sensibles", value: "5 años", defaultValue: "5 años", valueType: "select", options: ["5 años"], scope: "global", editable: false, affectedModules: ["documents", "security"] },
  { id: "contract_block_fiscal", key: "contracts.block_missing_fiscal", module: "contracts", label: "Bloquear contrato sin datos fiscales", value: true, defaultValue: true, valueType: "boolean", scope: "global", editable: true, affectedModules: ["contracts", "clients"] },
  { id: "payment_provider", key: "payments.provider", module: "contracts", label: "Proveedor de pago", value: "Teya manual", defaultValue: "Teya manual", valueType: "select", options: ["Teya manual"], scope: "global", editable: false, affectedModules: ["contracts", "fiscal"] },

  { id: "fillout_enabled", key: "integrations.fillout.enabled", module: "integrations", label: "Activar Fillout", description: "Acepta solicitudes firmadas desde el webhook de Fillout.", value: true, defaultValue: true, valueType: "boolean", scope: "global", editable: true, eventName: "integration.updated", affectedModules: ["clients", "leads"] },
  { id: "fillout_form_id", key: "integrations.fillout.form_id", module: "integrations", label: "ID del formulario Fillout", description: "Opcional hasta configurar el formulario definitivo.", value: "", defaultValue: "", valueType: "string", scope: "global", editable: true, validationRules: { allowEmpty: true }, eventName: "integration.updated", affectedModules: ["clients", "leads"] },
  { id: "fillout_public_url", key: "integrations.fillout.public_url", module: "integrations", label: "URL pública del formulario Fillout", description: "Enlace que aparece en la tarea y en los mensajes de recordatorio tras reservar una llamada.", value: "", defaultValue: "", valueType: "string", scope: "global", editable: true, validationRules: { allowEmpty: true }, eventName: "integration.updated", affectedModules: ["clients", "bookings", "tasks"] },
  { id: "fillout_source", key: "integrations.fillout.source_label", module: "integrations", label: "Nombre del origen Fillout", value: "Fillout", defaultValue: "Fillout", valueType: "string", scope: "global", editable: true, eventName: "integration.updated", affectedModules: ["clients", "reports"] },
  { id: "booking_enabled", key: "integrations.booking.enabled", module: "integrations", label: "Activar Routsify Booking", description: "Acepta altas y cambios de reservas desde el webhook de Booking.", value: true, defaultValue: true, valueType: "boolean", scope: "global", editable: true, eventName: "integration.updated", affectedModules: ["clients", "bookings"] },
  { id: "booking_base_url", key: "integrations.booking.base_url", module: "integrations", label: "URL de Routsify Booking", description: "URL base del sistema de reservas; puede dejarse vacía hasta conectar la API.", value: "", defaultValue: "", valueType: "string", scope: "global", editable: true, validationRules: { allowEmpty: true }, eventName: "integration.updated", affectedModules: ["bookings"] },
  { id: "booking_calendar_id", key: "integrations.booking.calendar_id", module: "integrations", label: "Calendario o agenda", value: "", defaultValue: "", valueType: "string", scope: "global", editable: true, validationRules: { allowEmpty: true }, eventName: "integration.updated", affectedModules: ["bookings"] },
  { id: "booking_source", key: "integrations.booking.source_label", module: "integrations", label: "Nombre del origen Booking", value: "Routsify Booking", defaultValue: "Routsify Booking", valueType: "string", scope: "global", editable: true, eventName: "integration.updated", affectedModules: ["clients", "reports"] },
  { id: "holded_mode", key: "integrations.holded.mode", module: "integrations", label: "Modo Holded", value: "outbox_idempotent", defaultValue: "outbox_idempotent", valueType: "select", options: ["outbox_idempotent"], scope: "global", editable: false, eventName: "integration.updated", affectedModules: ["holded", "outbox"] },
  { id: "holded_modules", key: "integrations.holded.modules", module: "integrations", label: "Módulos Holded", value: ["contacts", "estimates", "proformas", "invoices", "purchases", "payments"], defaultValue: ["contacts", "estimates", "proformas", "invoices", "purchases", "payments"], valueType: "multi_select", scope: "global", editable: false, affectedModules: ["holded", "outbox"] },
  { id: "ocr_provider", key: "integrations.ocr.provider", module: "integrations", label: "Proveedor OCR", value: "OpenAI", defaultValue: "OpenAI", valueType: "select", options: ["OpenAI"], scope: "global", editable: false, affectedModules: ["documents", "travelers"] },

  { id: "fiscal_mode", key: "fiscal.mode", module: "fiscal", label: "Modo fiscal", value: "proforma_on_payment_final_after_trip", defaultValue: "proforma_on_payment_final_after_trip", valueType: "select", options: ["proforma_on_payment_final_after_trip"], scope: "global", editable: false, eventName: "fiscal_mode.updated", affectedModules: ["contracts", "holded", "reports"] },
  { id: "final_invoice_delay", key: "fiscal.final_invoice_delay_days", module: "fiscal", label: "Espera para factura final", value: 5, defaultValue: 5, valueType: "number", scope: "global", editable: false, affectedModules: ["fiscal", "close"] },
  { id: "security_hmac", key: "security.webhooks.hmac_required", module: "security", label: "HMAC obligatorio en webhooks", value: true, defaultValue: true, valueType: "boolean", scope: "global", editable: true, eventName: "security_policy.updated", affectedModules: ["integrations"] },
  { id: "logs_retention", key: "logs.retention_days", module: "logs", label: "Retención de logs (días)", value: 180, defaultValue: 180, valueType: "number", scope: "global", editable: true, validationRules: { min: 30, max: 730 }, affectedModules: ["audit", "system"] },
  { id: "system_cache", key: "system.cache.enabled", module: "system", label: "Caché de configuración", value: true, defaultValue: true, valueType: "boolean", scope: "global", editable: true, eventName: "system_settings.updated" },
];

export const quickActions: SettingsAction[] = [
  { id: "recalculate-margins", label: "Recalcular márgenes", description: "Recalcula borradores y mantiene intactos los snapshots aceptados.", category: "recalculate", requiresConfirmation: true, eventName: "margin_rules.updated" },
  { id: "view-audit", label: "Ver auditoría de ajustes", description: "Historial de cambios realizados.", category: "security", requiresConfirmation: false, eventName: "settings.updated" },
];

export function moduleFor(id: string) { return settingsModules.find((module) => module.id === id) || settingsModules[0]; }
export function settingsForModule(moduleId: string, settings = defaultSettings) { return settings.filter((setting) => setting.module === moduleId); }
export function filterSettings(settings: AppSetting[], query: string) { const term = query.trim().toLowerCase(); if (!term) return settings; return settings.filter((setting) => [setting.key, setting.module, setting.label, setting.description, String(setting.value)].some((value) => String(value || "").toLowerCase().includes(term))); }
export function settingValueToText(value: AppSetting["value"]) { return Array.isArray(value) ? value.join(", ") : typeof value === "object" ? JSON.stringify(value) : String(value); }
export function settingsSummary(settings = defaultSettings) { return { totalSettings: settings.length, sensitive: settings.filter((setting) => setting.isSensitive).length, recalculations: settings.filter((setting) => setting.requiresRecalculation).length, editable: settings.filter((setting) => setting.editable).length }; }

export function validateSetting(setting: AppSetting) {
  const allowEmpty = Boolean(setting.validationRules?.allowEmpty);
  if (setting.valueType === "number") {
    const numeric = Number(setting.value);
    if (!Number.isFinite(numeric)) return `${setting.label} debe ser numérico`;
    const min = Number(setting.validationRules?.min);
    const max = Number(setting.validationRules?.max);
    if (Number.isFinite(min) && numeric < min) return `${setting.label} no puede ser menor que ${min}`;
    if (Number.isFinite(max) && numeric > max) return `${setting.label} no puede ser mayor que ${max}`;
  }
  if (setting.valueType === "string" && !allowEmpty && String(setting.value).trim().length === 0) return `${setting.label} no puede estar vacío`;
  if (setting.valueType === "color" && !/^#[0-9a-f]{6}$/i.test(String(setting.value))) return `${setting.label} debe ser un color hexadecimal válido`;
  if (setting.valueType === "select" && setting.options?.length && !setting.options.includes(String(setting.value))) return `${setting.label} contiene una opción no válida`;
  if (setting.key === "fiscal.mode" && setting.value !== "proforma_on_payment_final_after_trip") return "El modo fiscal debe coincidir con la política validada por asesoría";
  return null;
}

export function buildAuditFromChange(setting: AppSetting, oldValue: AppSetting["value"], userName = "Sistema"): SettingsAuditLog { return { id: `audit-${Date.now()}-${setting.id}`, settingKey: setting.key, module: setting.module, oldValue: settingValueToText(oldValue), newValue: settingValueToText(setting.value), userName, level: setting.requiresRecalculation || setting.isSensitive ? "warning" : "info", eventName: setting.eventName || moduleFor(setting.module).eventName || "settings.updated", createdAt: "Ahora", applied: true, requiresRecalculation: Boolean(setting.requiresRecalculation) }; }
export function updateSettings(current: AppSetting[], updates: Partial<AppSetting>[]) { const audits: SettingsAuditLog[] = []; const updated = current.map((setting) => { const update = updates.find((item) => item.id === setting.id || item.key === setting.key); if (!update) return setting; const next = { ...setting, ...update, updatedAt: "Ahora", updatedBy: "Sistema" }; audits.push(buildAuditFromChange(next, setting.value)); return next; }); return { settings: updated, audits, events: Array.from(new Set(audits.map((audit) => audit.eventName))), recalculationRequired: audits.some((audit) => audit.requiresRecalculation) }; }
export function resetModule(moduleId: string, settings = defaultSettings) { const updates = settingsForModule(moduleId, settings).map((setting) => ({ ...setting, value: setting.defaultValue })); return updateSettings(settings, updates); }
export function exportSettings(settings = defaultSettings) { return { version: "1.1", exportedAt: new Date().toISOString(), settings: settings.reduce((acc, setting) => ({ ...acc, [setting.key]: setting.value }), {} as Record<string, AppSetting["value"]>) }; }
export function importSettingsPreview(payload: Record<string, unknown>, settings = defaultSettings) { return settings.map((setting) => ({ key: setting.key, currentValue: setting.value, incomingValue: payload[setting.key], valid: payload[setting.key] !== undefined, sensitive: Boolean(setting.isSensitive) })).filter((item) => item.incomingValue !== undefined); }
export function systemInfo() { return { version: "1.1.0", environment: "Producción", database: "PostgreSQL", region: "EU", backupStatus: "Pendiente de política", health: "ok" }; }
