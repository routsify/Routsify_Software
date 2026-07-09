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

export const settingsModules: SettingsModule[] = [
  { id: "general", label: "General", description: "Empresa, idioma, moneda, fechas y comportamiento base.", icon: "⚙", eventName: "system_settings.updated" },
  { id: "appearance", label: "Apariencia y marca", description: "Colores, logos, sidebar, densidad, radios y gráficos.", icon: "🎨", eventName: "theme.updated" },
  { id: "navigation", label: "Menú y navegación", description: "Módulos visibles, orden, accesos rápidos y página inicial por rol.", icon: "☰", eventName: "navigation.updated" },
  { id: "clients", label: "Clientes y CRM", description: "Dedupe, campos obligatorios, fiscalidad mínima y origen de leads.", icon: "👥", eventName: "client_settings.updated" },
  { id: "cases", label: "Expedientes", description: "Estados, bloqueos, preflight y cierre operativo.", icon: "▣", eventName: "case_settings.updated" },
  { id: "budgets", label: "Presupuestos", description: "Versiones, snapshots, validez, landing y revisión interna.", icon: "📄", eventName: "budget_settings.updated" },
  { id: "margins", label: "Márgenes y precios", description: "Fórmula activa, jerarquía de margen, límites y redondeos.", icon: "%", eventName: "margin_rules.updated" },
  { id: "purchases", label: "Compras / Proveedores", description: "Compras esperadas, matching Holded, tolerancias y not_required.", icon: "🛒", eventName: "purchase_settings.updated" },
  { id: "documents", label: "Documentación e IA", description: "OCR, documentos permitidos, confianza, revisión humana y retención.", icon: "🤖", eventName: "document_settings.updated" },
  { id: "contracts", label: "Contrato, firma y pago", description: "Plantillas, firma, pago externo, bloqueo y evidencia.", icon: "✍", eventName: "contract_payment_settings.updated" },
  { id: "reports", label: "Informes y KPIs", description: "KPIs visibles, gráficos, Apache ECharts, objetivos y exportación.", icon: "📊", eventName: "report_config.updated" },
  { id: "automations", label: "Automatizaciones", description: "Triggers, condiciones, responsables, vencimientos y errores.", icon: "⚡", eventName: "automation_settings.updated" },
  { id: "integrations", label: "Integraciones", description: "Holded, Fillout, Booking, pagos, IA/OCR, email, storage y calendario.", icon: "🔌", eventName: "integration.updated" },
  { id: "fiscal", label: "Fiscal y contabilidad", description: "Fiscal mode, documentos, IVA, series y revisión de asesoría.", icon: "€", eventName: "fiscal_mode.updated" },
  { id: "notifications", label: "Notificaciones", description: "Eventos, canales, destinatarios, ventanas horarias y resúmenes.", icon: "🔔", eventName: "notification_settings.updated" },
  { id: "roles", label: "Usuarios y roles", description: "Roles, permisos por módulo y acceso a costes/documentos/logs.", icon: "🔐", eventName: "roles.updated" },
  { id: "security", label: "Seguridad y privacidad", description: "HMAC, tokens, 2FA, sesiones, RGPD, cifrado y backups.", icon: "🛡", eventName: "security_policy.updated" },
  { id: "logs", label: "Logs y auditoría", description: "Errores, cambios sensibles, reintentos, accesos y acciones técnicas.", icon: "🧾", eventName: "audit_settings.updated" },
  { id: "system", label: "Sistema", description: "Versión, entorno, jobs, caché, métricas, backup y salud.", icon: "🖥", eventName: "system_settings.updated" },
];

export const settingsEvents = ["settings.updated", "settings.reset", "settings.exported", "settings.imported", "theme.updated", "integration.connected", "integration.disconnected", "margin_rules.updated", "fiscal_mode.updated", "report_config.updated", "roles.updated", "security_policy.updated", "system_cache_cleared", "metrics_recalculated"];

export const demoSettings: AppSetting[] = [
  { id: "company_name", key: "company.name", module: "general", label: "Nombre de la empresa", description: "Visible en pantalla, emails, contratos y PDFs.", value: "Routsify Travel", defaultValue: "Routsify Travel", valueType: "string", scope: "global", editable: true, affectedModules: ["documents", "contracts", "emails"], eventName: "system_settings.updated" },
  { id: "timezone", key: "company.timezone", module: "general", label: "Zona horaria", value: "(GMT+02:00) Madrid", defaultValue: "(GMT+02:00) Madrid", valueType: "select", options: ["(GMT+02:00) Madrid", "UTC", "Europe/London"], scope: "global", editable: true, requiresRecalculation: true, affectedModules: ["tasks", "reports", "calendar"] },
  { id: "currency", key: "money.currency", module: "general", label: "Moneda por defecto", value: "EUR (€)", defaultValue: "EUR (€)", valueType: "select", options: ["EUR (€)", "USD ($)", "GBP (£)"], scope: "global", editable: true, requiresRecalculation: true, affectedModules: ["budgets", "reports", "payments"] },
  { id: "date_format", key: "format.date", module: "general", label: "Formato de fechas", value: "DD/MM/YYYY", defaultValue: "DD/MM/YYYY", valueType: "select", options: ["DD/MM/YYYY", "YYYY-MM-DD", "MM/DD/YYYY"], scope: "global", editable: true },
  { id: "primary_color", key: "theme.primary", module: "appearance", label: "Color primario", value: "#006b3f", defaultValue: "#006b3f", valueType: "color", scope: "global", editable: true, eventName: "theme.updated", affectedModules: ["all"] },
  { id: "sidebar_color", key: "theme.sidebar", module: "appearance", label: "Color sidebar", value: "#003d26", defaultValue: "#003d26", valueType: "color", scope: "global", editable: true, eventName: "theme.updated", affectedModules: ["all"] },
  { id: "radius", key: "theme.radius", module: "appearance", label: "Radio de bordes", value: "12px", defaultValue: "12px", valueType: "select", options: ["8px", "12px", "16px", "24px"], scope: "global", editable: true, eventName: "theme.updated" },
  { id: "dark_mode", key: "theme.dark_mode", module: "appearance", label: "Modo oscuro", value: false, defaultValue: false, valueType: "boolean", scope: "user", editable: true, eventName: "theme.updated" },
  { id: "nav_modules", key: "navigation.modules", module: "navigation", label: "Módulos visibles", value: ["Inicio", "Clientes", "Expedientes", "Presupuestos", "Compras / Proveedores", "Viajeros y Documentos", "Contrato, Firma y Pago", "Informes", "Ajustes"], defaultValue: ["Inicio", "Clientes", "Expedientes", "Presupuestos", "Compras / Proveedores", "Viajeros y Documentos", "Contrato, Firma y Pago", "Informes", "Ajustes"], valueType: "multi_select", scope: "role", editable: true, eventName: "navigation.updated" },
  { id: "client_dedupe_email", key: "clients.dedupe.email", module: "clients", label: "Dedupe por email", value: true, defaultValue: true, valueType: "boolean", scope: "global", editable: true, affectedModules: ["clients", "cases", "integrations"] },
  { id: "client_fiscal_required", key: "clients.fiscal.required", module: "clients", label: "Datos fiscales obligatorios", value: true, defaultValue: true, valueType: "boolean", scope: "global", editable: true, affectedModules: ["clients", "contracts", "fiscal"] },
  { id: "case_prefix", key: "cases.prefix", module: "cases", label: "Prefijo de expediente", value: "EXP-", defaultValue: "EXP-", valueType: "string", scope: "global", editable: true, affectedModules: ["cases", "reports"] },
  { id: "case_close_requires_purchases", key: "cases.close.requires_purchases", module: "cases", label: "Bloquear cierre si hay compras pendientes", value: true, defaultValue: true, valueType: "boolean", scope: "global", editable: true, requiresRecalculation: true, affectedModules: ["cases", "purchases", "reports"] },
  { id: "budget_validity", key: "budgets.validity_days", module: "budgets", label: "Validez por defecto", value: 15, defaultValue: 15, valueType: "number", scope: "global", editable: true, affectedModules: ["budgets", "tasks"] },
  { id: "budget_lock_accepted", key: "budgets.lock_accepted", module: "budgets", label: "Versión aceptada bloquea edición", value: true, defaultValue: true, valueType: "boolean", scope: "global", editable: true, affectedModules: ["budgets", "contracts", "reports"] },
  { id: "margin_formula", key: "margins.formula", module: "margins", label: "Fórmula activa", description: "Margen sobre precio de venta, no markup sobre coste.", value: "margin_on_sale", defaultValue: "margin_on_sale", valueType: "select", options: ["margin_on_sale", "markup_on_cost"], scope: "global", editable: true, requiresRecalculation: true, eventName: "margin_rules.updated", affectedModules: ["budgets", "reports"] },
  { id: "minimum_margin", key: "margins.minimum", module: "margins", label: "Margen mínimo global", value: 12, defaultValue: 12, valueType: "number", scope: "global", editable: true, requiresRecalculation: true, eventName: "margin_rules.updated", affectedModules: ["budgets", "reports"] },
  { id: "purchase_auto_create", key: "purchases.auto_create", module: "purchases", label: "Generar compras esperadas automáticamente", value: true, defaultValue: true, valueType: "boolean", scope: "global", editable: true, affectedModules: ["budgets", "purchases"] },
  { id: "purchase_confidence", key: "purchases.match.min_confidence", module: "purchases", label: "Confianza mínima para sugerir match", value: 70, defaultValue: 70, valueType: "number", scope: "global", editable: true, affectedModules: ["purchases", "reports"] },
  { id: "ocr_enabled", key: "documents.ocr.enabled", module: "documents", label: "OCR activo", value: true, defaultValue: true, valueType: "boolean", scope: "global", editable: true, affectedModules: ["documents", "travelers", "security"] },
  { id: "ocr_confidence", key: "documents.ocr.confidence", module: "documents", label: "Confianza OCR", value: "media", defaultValue: "media", valueType: "select", options: ["alta", "media", "baja"], scope: "global", editable: true, affectedModules: ["documents", "travelers"] },
  { id: "document_retention", key: "documents.retention", module: "documents", label: "Retención documentos", value: "60 días", defaultValue: "60 días", valueType: "select", options: ["30 días", "60 días", "90 días"], scope: "global", editable: true, affectedModules: ["documents", "security"] },
  { id: "contract_block_fiscal", key: "contracts.block_missing_fiscal", module: "contracts", label: "Bloquear contrato si faltan datos fiscales", value: true, defaultValue: true, valueType: "boolean", scope: "global", editable: true, affectedModules: ["contracts", "clients"] },
  { id: "payment_provider", key: "payments.provider", module: "contracts", label: "Proveedor de pago", value: "manual", defaultValue: "manual", valueType: "select", options: ["manual", "Teya", "otro"], scope: "global", editable: true, affectedModules: ["contracts", "fiscal"] },
  { id: "reports_charts", key: "reports.charts.visible", module: "reports", label: "Gráficos visibles", value: ["accepted_value_line", "conversion_funnel", "destination_donut", "timing_bars", "pain_points"], defaultValue: ["accepted_value_line", "conversion_funnel", "destination_donut", "timing_bars", "pain_points"], valueType: "multi_select", scope: "role", editable: true, eventName: "report_config.updated", affectedModules: ["reports"] },
  { id: "reports_period", key: "reports.period", module: "reports", label: "Periodo por defecto", value: "mes", defaultValue: "mes", valueType: "select", options: ["hoy", "semana", "mes", "trimestre", "año"], scope: "global", editable: true, eventName: "report_config.updated" },
  { id: "automation_budget_followup", key: "automations.budget_followup_days", module: "automations", label: "Seguimiento presupuesto enviado", value: 7, defaultValue: 7, valueType: "number", scope: "global", editable: true, affectedModules: ["tasks", "budgets"] },
  { id: "holded_mode", key: "integrations.holded.mode", module: "integrations", label: "Modo sync Holded", value: "manual_review", defaultValue: "manual_review", valueType: "select", options: ["manual_review", "manual", "daily", "hourly"], scope: "global", editable: true, eventName: "integration.updated", affectedModules: ["holded", "outbox"] },
  { id: "fillout_enabled", key: "integrations.fillout.enabled", module: "integrations", label: "Fillout activo", value: true, defaultValue: true, valueType: "boolean", scope: "global", editable: true, eventName: "integration.updated" },
  { id: "booking_enabled", key: "integrations.booking.enabled", module: "integrations", label: "Booking activo", value: true, defaultValue: true, valueType: "boolean", scope: "global", editable: true, eventName: "integration.updated" },
  { id: "fiscal_mode", key: "fiscal.mode", module: "fiscal", label: "Fiscal mode", value: "manual_review", defaultValue: "manual_review", valueType: "select", options: ["manual_review", "proforma_on_payment", "invoice_on_advance", "final_invoice_after_trip"], scope: "global", editable: true, eventName: "fiscal_mode.updated", affectedModules: ["contracts", "holded", "reports"] },
  { id: "notification_holded_error", key: "notifications.holded_error", module: "notifications", label: "Notificar error Holded", value: true, defaultValue: true, valueType: "boolean", scope: "role", editable: true, affectedModules: ["hoy", "integrations"] },
  { id: "role_admin_settings", key: "roles.admin.change_settings", module: "roles", label: "Cambiar ajustes", value: true, defaultValue: true, valueType: "boolean", scope: "role", editable: true, eventName: "roles.updated", affectedModules: ["all"] },
  { id: "security_hmac", key: "security.webhooks.hmac_required", module: "security", label: "HMAC obligatorio en webhooks", value: true, defaultValue: true, valueType: "boolean", scope: "global", editable: true, eventName: "security_policy.updated", affectedModules: ["integrations"] },
  { id: "security_token_hours", key: "security.public_token_hours", module: "security", label: "Duración tokens públicos", value: 72, defaultValue: 72, valueType: "number", scope: "global", editable: true, eventName: "security_policy.updated" },
  { id: "logs_retention", key: "logs.retention_days", module: "logs", label: "Retención logs", value: 180, defaultValue: 180, valueType: "number", scope: "global", editable: true, affectedModules: ["audit", "system"] },
  { id: "system_cache", key: "system.cache.enabled", module: "system", label: "Caché de configuración", value: true, defaultValue: true, valueType: "boolean", scope: "global", editable: true, eventName: "system_settings.updated" },
];

export const quickActions: SettingsAction[] = [
  { id: "sync-holded", label: "Sincronizar con Holded", description: "Última sincronización: hace 12 min", category: "sync", requiresConfirmation: false, eventName: "integration.connected" },
  { id: "recalculate-margins", label: "Recalcular márgenes", description: "Recalcula borradores y deja snapshots aceptados intactos.", category: "recalculate", requiresConfirmation: true, eventName: "margin_rules.updated" },
  { id: "recalculate-reports", label: "Recalcular informes", description: "Actualiza KPIs y gráficos Apache ECharts.", category: "recalculate", requiresConfirmation: false, eventName: "metrics_recalculated" },
  { id: "clear-cache", label: "Limpiar caché del sistema", description: "Libera configuración y métricas cacheadas.", category: "system", requiresConfirmation: true, eventName: "system_cache_cleared" },
  { id: "export-config", label: "Exportar configuración", description: "Descarga copia JSON de seguridad.", category: "backup", requiresConfirmation: false, eventName: "settings.exported" },
  { id: "view-audit", label: "Ver auditoría de ajustes", description: "Historial de cambios realizados.", category: "security", requiresConfirmation: false, eventName: "settings.updated" },
  { id: "test-integrations", label: "Probar integraciones", description: "Holded, Fillout, Booking, OCR, pagos y email.", category: "sync", requiresConfirmation: false, eventName: "integration.connected" },
  { id: "restore-defaults", label: "Restaurar valores por defecto", description: "Requiere confirmación; no borra credenciales reales.", category: "backup", requiresConfirmation: true, eventName: "settings.reset" },
];

export const demoSettingsAuditLog: SettingsAuditLog[] = [
  { id: "audit-1", settingKey: "fiscal.mode", module: "fiscal", oldValue: "proforma_on_payment", newValue: "manual_review", userName: "María García", level: "warning", eventName: "fiscal_mode.updated", createdAt: "Hoy, 09:15", applied: true, requiresRecalculation: false },
  { id: "audit-2", settingKey: "margins.minimum", module: "margins", oldValue: "10", newValue: "12", userName: "Juan Pérez", level: "info", eventName: "margin_rules.updated", createdAt: "Ayer, 18:20", applied: true, requiresRecalculation: true },
  { id: "audit-3", settingKey: "reports.charts.visible", module: "reports", oldValue: "default", newValue: "echarts", userName: "María García", level: "info", eventName: "report_config.updated", createdAt: "Ayer, 13:40", applied: true, requiresRecalculation: false },
];

export function moduleFor(id: string) { return settingsModules.find((module) => module.id === id) || settingsModules[0]; }
export function settingsForModule(moduleId: string, settings = demoSettings) { return settings.filter((setting) => setting.module === moduleId); }
export function filterSettings(settings: AppSetting[], query: string) { const term = query.trim().toLowerCase(); if (!term) return settings; return settings.filter((setting) => [setting.key, setting.module, setting.label, setting.description, String(setting.value)].some((value) => String(value || "").toLowerCase().includes(term))); }
export function settingValueToText(value: AppSetting["value"]) { return Array.isArray(value) ? value.join(", ") : typeof value === "object" ? JSON.stringify(value) : String(value); }
export function settingsSummary(settings = demoSettings) { return { clients: 1248, activeCases: 64, monthlyBudgets: 156, pendingPurchases: 23, holdedStatus: "Sincronizado", ocrStatus: "Activo", totalSettings: settings.length, sensitive: settings.filter((setting) => setting.isSensitive).length, recalculations: settings.filter((setting) => setting.requiresRecalculation).length, editable: settings.filter((setting) => setting.editable).length }; }
export function changedSettings(current: AppSetting[], baseline = demoSettings) { return current.filter((setting) => settingValueToText(setting.value) !== settingValueToText(baseline.find((item) => item.id === setting.id)?.value ?? setting.defaultValue)); }
export function validateSetting(setting: AppSetting) { if (setting.valueType === "number" && Number.isNaN(Number(setting.value))) return `${setting.label} debe ser numérico`; if (setting.valueType === "string" && String(setting.value).trim().length === 0) return `${setting.label} no puede estar vacío`; if (setting.key === "fiscal.mode" && setting.value !== "manual_review") return "No activar fiscalidad automática sin validación de asesoría"; return null; }
export function buildAuditFromChange(setting: AppSetting, oldValue: AppSetting["value"], userName = "María García"): SettingsAuditLog { return { id: `audit-${Date.now()}-${setting.id}`, settingKey: setting.key, module: setting.module, oldValue: settingValueToText(oldValue), newValue: settingValueToText(setting.value), userName, level: setting.requiresRecalculation || setting.isSensitive ? "warning" : "info", eventName: setting.eventName || moduleFor(setting.module).eventName || "settings.updated", createdAt: "Ahora", applied: true, requiresRecalculation: Boolean(setting.requiresRecalculation) }; }
export function updateSettingsDemo(current: AppSetting[], updates: Partial<AppSetting>[]) { const audits: SettingsAuditLog[] = []; const updated = current.map((setting) => { const update = updates.find((item) => item.id === setting.id || item.key === setting.key); if (!update) return setting; const next = { ...setting, ...update, updatedAt: "Ahora", updatedBy: "María García" }; audits.push(buildAuditFromChange(next, setting.value)); return next; }); return { settings: updated, audits, events: Array.from(new Set(audits.map((audit) => audit.eventName))), recalculationRequired: audits.some((audit) => audit.requiresRecalculation) }; }
export function resetModuleDemo(moduleId: string, settings = demoSettings) { const updates = settingsForModule(moduleId, settings).map((setting) => ({ ...setting, value: setting.defaultValue })); return updateSettingsDemo(settings, updates); }
export function exportDemoSettings(settings = demoSettings) { return { version: "1.0", exportedAt: new Date().toISOString(), settings: settings.reduce((acc, setting) => ({ ...acc, [setting.key]: setting.value }), {} as Record<string, AppSetting["value"]>) }; }
export function importSettingsPreview(payload: Record<string, unknown>, settings = demoSettings) { return settings.map((setting) => ({ key: setting.key, currentValue: setting.value, incomingValue: payload[setting.key], valid: payload[setting.key] !== undefined, sensitive: Boolean(setting.isSensitive) })).filter((item) => item.incomingValue !== undefined); }
export function testIntegration(integration: string) { return { ok: true, integration, status: "connected", latencyMs: 124, lastSync: "hace 12 min", checked: ["credentials", "webhook", "field_mapping", "idempotency"], message: `${integration} probado correctamente en modo demo` }; }
export function runSystemAction(actionId: string) { const action = quickActions.find((item) => item.id === actionId); return { ok: Boolean(action), actionId, eventName: action?.eventName || "system_settings.updated", message: action ? `${action.label} ejecutado en modo demo` : "Acción no encontrada", affectedModules: actionId.includes("margin") ? ["budgets", "reports"] : actionId.includes("cache") ? ["all"] : ["settings"] }; }
export function systemInfo() { return { version: "1.1.0", environment: "Producción demo", database: "PostgreSQL preparada", region: "EU (Frankfurt)", storageUsedGb: 42.6, storageTotalGb: 200, backupStatus: "Activos", nextBackup: "Hoy, 23:30", health: "ok" }; }
