import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";

const settings = [
  { area: "Fillout", status: "prepared", purpose: "Webhook, token, mapeo de campos y deduplicación por payload_hash/submission_id.", action: "Validar secreto y mapeo antes de activar datos reales." },
  { area: "Booking", status: "prepared", purpose: "HMAC, booking_id, eventos updated/completed/no-show y actualización de llamada existente.", action: "Conectar API propia de reservas cuando esté estable." },
  { area: "Holded", status: "manual_review", purpose: "Contactos, documentos fiscales, compras y conciliación sin duplicar entidades.", action: "Mantener server-side y revisar errores desde outbox." },
  { area: "Fiscal mode", status: "manual_review", purpose: "manual_review, proforma_on_payment, invoice_on_advance, final_invoice_after_trip.", action: "No emitir automáticamente sin pago, contrato y reglas fiscales." },
  { area: "Márgenes", status: "active", purpose: "Margen global, por tipo, proveedor y línea, con snapshot económico al aceptar.", action: "Bloquear fórmula de la versión aceptada." },
  { area: "Roles", status: "prepared", purpose: "Comercial, operaciones, administración, dirección y técnico con RLS/auditoría.", action: "Activar con Supabase real y perfiles verificados." },
  { area: "OCR / IA", status: "manual_review", purpose: "Extracción asistida de datos de viajeros con confianza mínima y revisión humana.", action: "No usar para aprobar documentos sin evidencia de revisión." },
  { area: "Retención", status: "prepared", purpose: "Minimización y borrado programado de documentos sensibles.", action: "Configurar job mensual antes de usar documentos reales." },
  { area: "Auditoría", status: "active", purpose: "Cambios económicos, accesos, errores, reintentos, pagos, firma y excepciones.", action: "Todo cambio sensible debe quedar trazado." },
];

const canonicalRoutes = [
  ["/hoy", "Inicio", "Prioriza qué hacer hoy."],
  ["/clientes", "Clientes", "Ficha única y dedupe."],
  ["/expedientes", "Expedientes", "Centro del flujo."],
  ["/propuestas", "Presupuestos", "Venta, margen, versiones."],
  ["/compras", "Compras / Proveedores", "Facturas y conciliación."],
  ["/viajeros", "Viajeros y Documentos", "Documentación mínima."],
  ["/contratos", "Contrato, Firma y Pago", "Preflight y cobro."],
  ["/informes", "Informes", "Funnel, margen y bloqueos."],
  ["/ajustes", "Ajustes", "Configuración y seguridad."],
];

export default function SettingsPage() {
  return (
    <AppShell>
      <PageHeader
        eyebrow="Ajustes / Sistema"
        title="Configuración esencial del MVP"
        description="Solo queda la configuración que sostiene el flujo alrededor del expediente: integraciones, fiscalidad, márgenes, roles, OCR, retención y auditoría."
        action={<a className="btn" href="/api/health">Ver health</a>}
      />

      <section className="grid grid-3">
        <div className="card"><span className="badge">Páginas definitivas</span><div className="metric">9</div><p>8 operativas y ajustes de sistema.</p></div>
        <div className="card"><span className="badge">Fuente operativa</span><div className="metric">Routsify</div><p>Holded queda fiscal/financiero, no operativo.</p></div>
        <div className="card"><span className="badge">Regla base</span><div className="metric">EXP</div><p>Todo cuelga del expediente.</p></div>
      </section>

      <section className="grid grid-2" style={{ marginTop: 18 }}>
        <div className="card">
          <div className="eyebrow">Sistema</div>
          <h2>Ajustes activos</h2>
          <table>
            <thead><tr><th>Ajuste</th><th>Estado</th><th>Función</th><th>Regla</th></tr></thead>
            <tbody>{settings.map((item) => <tr key={item.area}><td><strong>{item.area}</strong></td><td><span className="badge">{item.status}</span></td><td>{item.purpose}</td><td>{item.action}</td></tr>)}</tbody>
          </table>
        </div>

        <div className="card">
          <div className="eyebrow">Navegación limpia</div>
          <h2>Páginas canónicas</h2>
          <p>Las pantallas técnicas o duplicadas quedan redirigidas a estas páginas para que el equipo trabaje siempre desde el mismo flujo.</p>
          <table>
            <thead><tr><th>Ruta</th><th>Página</th><th>Uso</th></tr></thead>
            <tbody>{canonicalRoutes.map(([href, label, use]) => <tr key={href}><td><a href={href}>{href}</a></td><td><strong>{label}</strong></td><td>{use}</td></tr>)}</tbody>
          </table>
        </div>
      </section>
    </AppShell>
  );
}
