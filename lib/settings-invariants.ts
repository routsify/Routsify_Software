export const protectedSettingValues = {
  "budgets.lock_accepted": true,
  "security.webhooks.hmac_required": true,
} as const;

export type ProtectedSettingKey = keyof typeof protectedSettingValues;

export function isProtectedSetting(key: string): key is ProtectedSettingKey {
  return Object.prototype.hasOwnProperty.call(protectedSettingValues, key);
}

export function enforceProtectedSettingValue(key: string, value: unknown) {
  return isProtectedSetting(key) ? protectedSettingValues[key] : value;
}

export function protectedSettingDescription(key: string) {
  if (key === "budgets.lock_accepted") return "Las versiones aceptadas permanecen inmutables para conservar trazabilidad económica y contractual.";
  if (key === "security.webhooks.hmac_required") return "La firma HMAC es obligatoria para impedir que entradas externas no autenticadas modifiquen el sistema.";
  return null;
}
