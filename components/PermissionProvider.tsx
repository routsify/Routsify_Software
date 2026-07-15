"use client";

import { createContext, useContext, type ReactNode } from "react";
import { hasPermission, type AppPermission } from "@/lib/rbac";

const PermissionContext = createContext<string | null>(null);

export function PermissionProvider({ role, children }: { role: string | null | undefined; children: ReactNode }) {
  return <PermissionContext.Provider value={role || null}>{children}</PermissionContext.Provider>;
}

export function useAppRole() {
  return useContext(PermissionContext);
}

export function usePermission(permission: AppPermission) {
  return hasPermission(useAppRole(), permission);
}
