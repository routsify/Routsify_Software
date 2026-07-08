export type AppModule = {
  href: string;
  label: string;
  stage: string;
  owner: string;
  description: string;
  status: "ready_demo" | "prepared" | "needs_supabase";
};

export const appModules: AppModule[] = [
  { href: "/clientes", label: "Clientes", stage: "01", owner: "Ventas", description: "CRM operativo con campos base, fuente y datos de facturación.", status: "ready_demo" },
  { href: "/expedientes", label: "Expedientes", stage: "02", owner: "Operaciones", description: "Casos con estado, destino, fechas, próxima acción y bloqueos.", status: "ready_demo" },
  { href: "/viajeros", label: "Viajeros", stage: "03", owner: "Operaciones", description: "Documentación mínima, caducidades y bloqueo antes de contrato.", status: "ready_demo" },
  { href: "/propuestas", label: "Propuestas", stage: "04", owner: "Ventas", description: "Presupuesto nativo con coste, margen, venta y compras esperadas.", status: "ready_demo" },
  { href: "/propuestas/demo-public-token", label: "Propuesta pública", stage: "05", owner: "Cliente", description: "Vista comercial compartible mediante token seguro en fase real.", status: "ready_demo" },
  { href: "/contratos", label: "Contratos", stage: "06", owner: "Operaciones", description: "Contrato operativo desde propuesta aceptada con bloqueos documentales.", status: "ready_demo" },
  { href: "/compras", label: "Compras", stage: "07", owner: "Operaciones", description: "Facturas proveedor, revisión manual y conciliación operativa.", status: "ready_demo" },
  { href: "/facturacion", label: "Pagos y facturación", stage: "08", owner: "Facturación", description: "Cobros manuales y borradores fiscales para sincronización conservadora.", status: "ready_demo" },
  { href: "/integraciones", label: "Integraciones", stage: "09", owner: "Admin", description: "Outbox, reintentos, entradas externas y tareas programadas.", status: "prepared" },
  { href: "/cierre", label: "Cierre operativo", stage: "10", owner: "Dirección", description: "Checklist final de contrato, pago, proveedores y notas.", status: "ready_demo" },
  { href: "/seguridad", label: "Seguridad", stage: "11", owner: "Admin", description: "Roles, permisos y auditoría antes de activar datos reales.", status: "prepared" },
  { href: "/ajustes/tipos-servicio", label: "Tipos de servicio", stage: "12", owner: "Admin", description: "Catálogo ampliable de servicios para presupuestos.", status: "ready_demo" },
];

export function moduleSummary(modules: AppModule[]) {
  const demoReady = modules.filter((module) => module.status === "ready_demo").length;
  const prepared = modules.filter((module) => module.status === "prepared").length;
  const needsSupabase = modules.filter((module) => module.status === "needs_supabase").length;
  return { total: modules.length, demoReady, prepared, needsSupabase };
}
