"use client";

import { createContext, useContext, type ReactNode } from "react";
import { hasPermission, type AppPermission } from "@/lib/rbac";
import type { AppRole } from "@/lib/settings-master";

const PermissionContext = createContext<AppRole | null>(null);

export function PermissionProvider({ role, children }: { role: AppRole | null; children: ReactNode }) {
  return <PermissionContext.Provider value={role}>{children}</PermissionContext.Provider>;
}

export function useAppRole() {
  return useContext(PermissionContext);
}

export function usePermission(permission: AppPermission) {
  return hasPermission(useAppRole(), permission);
}
