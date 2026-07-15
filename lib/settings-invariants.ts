export const protectedSettingValues = {
  "clients.dedupe.email": true,
  "budgets.lock_accepted": true,
  "security.webhooks.hmac_required": true,
  "system.cache.enabled": true,
} as const;

export type ProtectedSettingKey = keyof typeof protectedSettingValues;

export function isProtectedSetting(key: string): key is ProtectedSettingKey {
  return Object.prototype.hasOwnProperty.call(protectedSettingValues, key);
}

export function enforceProtectedSettingValue(key: string, value: unknown) {
  return isProtectedSetting(key) ? protectedSettingValues[key] : value;
}

export function protectedSettingDescription(key: string) {
  if (key === "clients.dedupe.email") return "El email identifica de forma única a un cliente dentro de cada organización y evita duplicados incompatibles con la integridad del CRM.";
  if (key === "budgets.lock_accepted") return "Las versiones aceptadas permanecen inmutables para conservar trazabilidad económica y contractual.";
  if (key === "security.webhooks.hmac_required") return "La firma HMAC es obligatoria para impedir que entradas externas no autenticadas modifiquen el sistema.";
  if (key === "system.cache.enabled") return "La caché interna de configuración permanece activa como optimización técnica de petición; no altera datos ni reglas de negocio y no se expone como interruptor operativo.";
  return null;
}
