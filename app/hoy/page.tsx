import { AppShell } from "@/components/AppShell";
import { cases } from "@/lib/mock-data";
import { demoTasks } from "@/lib/tasks";
import { demoDocuments } from "@/lib/documents";
import { demoPayments, demoBillingDocuments } from "@/lib/billing";
import { demoCommunications } from "@/lib/communications";
import { demoOutbox } from "@/lib/integrations";
import { demoSuppliers } from "@/lib/suppliers";
import { buildOperationalInbox, workbenchSummary } from "@/lib/workbench";

function priorityLabel(priority: string) {
  if (priority === "urgent") return "Alta";
  if (priority === "high") return "Alta";
  if (priority === "normal") return "Media";
  return "Baja";
}

function caseStatusLabel(status: string) {
  if (status === "proposal_sent") return "En progreso";
  if (status === "budget_draft") return "Pendiente";
  if (status === "closed") return "Cerrado";
  return status.replaceAll("_", " ");
}

export default function TodayWorkbenchPage() {
  const inbox = buildOperationalInbox();
  const summary = workbenchSummary(inbox);
  const openTasks = demoTasks.filter((item) => item.status !== "done");
  const activeCases = cases.filter((item) => item.status !== "closed");
  const pendingDocuments = demoDocuments.filter((item) => item.status === "missing" || item.status === "reviewing" || item.status === "expired").length;
  const todayCalls = demoCommunications.filter((item) => item.channel === "phone" || item.channel === "meeting").length;
  const pendingBudgets = cases.filter((item) => item.status === "budget_draft" || item.status === "proposal_sent").length;
  const pendingPayments = demoPayments.filter((item) => item.status === "pending" || item.status === "failed").length;
  const activeSuppliers = demoSuppliers.filter((item) => item.status === "active").length;
  const holdedIssues = demoBillingDocuments.filter((item) => item.status === "blocked" || item.status === "error").length + demoOutbox.filter((item) => item.channel === "fiscal" && item.status !== "done").length;

  const kpis = [
    { label: "Urgente", value: summary.critical, note: "Requieren atención", icon: "!", href: "/hoy" },
    { label: "Llamadas de hoy", value: todayCalls, note: "+ reuniones y seguimientos", icon: "☎", href: "/comunicaciones" },
    { label: "Presupuestos pendientes", value: pendingBudgets, note: "A la espera de respuesta", icon: "€", href: "/propuestas" },
    { label: "Documentos", value: pendingDocuments, note: "Pendientes de gestionar", icon: "□", href: "/documentos" },
    { label: "Pagos", value: pendingPayments, note: "Vencen o faltan confirmar", icon: "▭", href: "/facturacion" },
    { label: "Proveedores", value: activeSuppliers, note: "Activos", icon: "👥", href: "/compras" },
    { label: "Errores Holded", value: holdedIssues, note: "Por revisar", icon: "!", href: "/integraciones" },
  ];

  return (
    <AppShell>
      <section className="home-title">
        <h1>Inicio / Dashboard</h1>
      </section>

      <section className="home-kpis">
        {kpis.map((item) => (
          <a className="kpi-card" href={item.href} key={item.label}>
            <span className="kpi-icon">{item.icon}</span>
            <span className="kpi-copy"><strong>{item.label}</strong><b>{item.value}</b><small>{item.note}</small></span>
          </a>
        ))}
      </section>

      <section className="dashboard-panels">
        <div className="card dashboard-table-card">
          <div className="panel-head">
            <h2>Tareas</h2>
            <a className="btn secondary" href="/tareas">Ver todas las tareas</a>
          </div>
          <table>
            <thead><tr><th>Tarea</th><th>Prioridad</th><th>Responsable</th><th>Vence</th></tr></thead>
            <tbody>
              {openTasks.slice(0, 7).map((task) => (
                <tr key={task.id}>
                  <td><a href={`/expedientes/${task.case_code}`}><strong>{task.title}</strong></a><br/><small>{task.case_code} · {task.area}</small></td>
                  <td><span className={`status-pill priority-${task.priority}`}>{priorityLabel(task.priority)}</span></td>
                  <td>{task.owner}</td>
                  <td>{task.due_date}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <a className="table-footer-link" href="/tareas">Ver todas las tareas →</a>
        </div>

        <div className="card dashboard-table-card">
          <div className="panel-head">
            <h2>Expedientes activos</h2>
            <a className="btn secondary" href="/expedientes">Ver todos los expedientes</a>
          </div>
          <table>
            <thead><tr><th>Expediente</th><th>Cliente</th><th>Estado</th><th>Próxima acción</th></tr></thead>
            <tbody>
              {activeCases.map((item) => (
                <tr key={item.case_code}>
                  <td><a href={`/expedientes/${item.case_code}`}><strong>{item.case_code}</strong></a></td>
                  <td>{item.client}</td>
                  <td><span className={`status-pill ${item.blocker ? "status-pending" : "status-progress"}`}>{caseStatusLabel(item.status)}</span></td>
                  <td>{item.next_action}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <a className="table-footer-link" href="/expedientes">Ver todos los expedientes →</a>
        </div>
      </section>
    </AppShell>
  );
}
