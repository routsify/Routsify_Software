export type AppModule = {
  href: string;
  label: string;
  stage: string;
  owner: string;
  description: string;
  status: "ready" | "prepared" | "needs_configuration";
};

export const appModules: AppModule[] = [
  { href: "/hoy", label: "Inicio", stage: "01", owner: "Equipo", description: "KPIs, expedientes activos, compras pendientes y acciones del día.", status: "ready" },
  { href: "/clientes", label: "Clientes", stage: "02", owner: "Ventas", description: "Ficha única del cliente con datos de contacto, fiscalidad, notas y expedientes relacionados.", status: "ready" },
  { href: "/expedientes", label: "Expedientes", stage: "03", owner: "Operaciones", description: "Centro del flujo: viaje, estado, bloqueo, próxima acción, cliente y seguimiento operativo.", status: "ready" },
  { href: "/propuestas", label: "Presupuestos", stage: "04", owner: "Ventas", description: "Presupuestos por expediente con líneas, costes, margen, venta y estados.", status: "ready" },
  { href: "/compras", label: "Compras / Proveedores", stage: "05", owner: "Operaciones", description: "Compras, proveedores, importes y estados corregibles.", status: "ready" },
  { href: "/informes", label: "Informes", stage: "06", owner: "Dirección", description: "Resumen operativo de clientes, expedientes, presupuestos y compras.", status: "ready" },
  { href: "/ajustes", label: "Ajustes", stage: "07", owner: "Admin", description: "Configuración básica de empresa, márgenes, compras, integraciones y fiscalidad.", status: "prepared" },
];

export function moduleSummary(modules: AppModule[]) {
  const ready = modules.filter((module) => module.status === "ready").length;
  const prepared = modules.filter((module) => module.status === "prepared").length;
  const needsConfiguration = modules.filter((module) => module.status === "needs_configuration").length;
  return { total: modules.length, ready, prepared, needsConfiguration };
}
