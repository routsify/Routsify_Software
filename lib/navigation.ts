export type AppModule = {
  href: string;
  label: string;
  stage: string;
  owner: string;
  description: string;
  status: "ready_demo" | "prepared" | "needs_supabase";
};

export const appModules: AppModule[] = [
  { href: "/hoy", label: "Inicio", stage: "01", owner: "Equipo", description: "KPIs, alertas, tareas urgentes, expedientes activos y acciones del día.", status: "ready_demo" },
  { href: "/clientes", label: "Clientes", stage: "02", owner: "Ventas", description: "Ficha única del cliente, deduplicación, origen, datos fiscales, historial y estado Holded.", status: "ready_demo" },
  { href: "/expedientes", label: "Expedientes", stage: "03", owner: "Operaciones", description: "Centro del flujo: estado, bloqueo, próxima acción, timeline y resumen económico del viaje.", status: "ready_demo" },
  { href: "/propuestas", label: "Presupuestos", stage: "04", owner: "Ventas", description: "Presupuesto nativo versionado con costes, margen, venta, snapshot y compras esperadas.", status: "ready_demo" },
  { href: "/compras", label: "Compras / Proveedores", stage: "05", owner: "Operaciones", description: "Compras esperadas, facturas proveedor, matching Holded, revisión y desbloqueo de cierre.", status: "ready_demo" },
  { href: "/viajeros", label: "Viajeros y Documentos", stage: "06", owner: "Operaciones", description: "Datos mínimos, OCR/revisión humana, documentos privados, caducidades y aprobación documental.", status: "ready_demo" },
  { href: "/contratos", label: "Contrato, Firma y Pago", stage: "07", owner: "Operaciones", description: "Preflight, contrato, firma, pago externo, excepciones auditadas y fiscalidad.", status: "ready_demo" },
  { href: "/informes", label: "Informes", stage: "08", owner: "Dirección", description: "Funnel, origen, pipeline, margen previsto/real, desviaciones, proveedores y Holded.", status: "ready_demo" },
  { href: "/ajustes", label: "Ajustes", stage: "09", owner: "Admin", description: "Integraciones, fiscalidad, márgenes, roles, OCR, retención y auditoría.", status: "prepared" },
];

export function moduleSummary(modules: AppModule[]) {
  const demoReady = modules.filter((module) => module.status === "ready_demo").length;
  const prepared = modules.filter((module) => module.status === "prepared").length;
  const needsSupabase = modules.filter((module) => module.status === "needs_supabase").length;
  return { total: modules.length, demoReady, prepared, needsSupabase };
}
