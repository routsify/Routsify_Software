export type AppModule = {
  href: string;
  label: string;
  stage: string;
  owner: string;
  description: string;
  status: "ready_demo" | "prepared" | "needs_supabase";
};

export const appModules: AppModule[] = [
  { href: "/hoy", label: "Inicio / Dashboard", stage: "01", owner: "Equipo", description: "KPIs, alertas, tareas urgentes, expedientes activos y acciones del día.", status: "ready_demo" },
  { href: "/clientes", label: "Clientes", stage: "02", owner: "Ventas", description: "CRM operativo con origen, valor aceptado, estado fiscal/Holded, responsable e historial resumido.", status: "ready_demo" },
  { href: "/expedientes", label: "Expedientes", stage: "03", owner: "Operaciones", description: "Vista 360 del viaje con estado, cliente, destino, fechas, timeline, resumen financiero y módulos relacionados.", status: "ready_demo" },
  { href: "/propuestas", label: "Presupuestos", stage: "04", owner: "Ventas", description: "Presupuesto nativo versionado con costes, margen, venta, compras esperadas y aceptación pública.", status: "ready_demo" },
  { href: "/compras", label: "Compras / Proveedores", stage: "05", owner: "Operaciones", description: "Compras esperadas, facturas proveedor, matching manual, revisión y base de proveedores validados.", status: "ready_demo" },
  { href: "/viajeros", label: "Viajeros y Documentos", stage: "06", owner: "Operaciones", description: "Viajeros, documentos cargados, caducidades, validaciones y repositorio documental privado.", status: "ready_demo" },
  { href: "/contratos", label: "Contrato, Firma y Pago", stage: "07", owner: "Operaciones", description: "Preflight, contrato, firma, pago confirmado y línea de tiempo hasta desbloquear cierre.", status: "ready_demo" },
  { href: "/informes", label: "Informes", stage: "08", owner: "Dirección", description: "Resumen ejecutivo, embudo, tiempos, margen previsto/real, desviaciones y proveedores problemáticos.", status: "ready_demo" },
];

export function moduleSummary(modules: AppModule[]) {
  const demoReady = modules.filter((module) => module.status === "ready_demo").length;
  const prepared = modules.filter((module) => module.status === "prepared").length;
  const needsSupabase = modules.filter((module) => module.status === "needs_supabase").length;
  return { total: modules.length, demoReady, prepared, needsSupabase };
}
