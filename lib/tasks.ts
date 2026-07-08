export type TaskStatus = "todo" | "doing" | "waiting" | "done" | "blocked";
export type TaskPriority = "low" | "normal" | "high" | "urgent";

export type TaskItem = {
  id: string;
  case_code: string;
  title: string;
  area: string;
  owner: string;
  due_date: string;
  status: TaskStatus;
  priority: TaskPriority;
  blocker?: string;
  notes?: string;
};

export const taskStatuses: TaskStatus[] = ["todo", "doing", "waiting", "done", "blocked"];
export const taskPriorities: TaskPriority[] = ["low", "normal", "high", "urgent"];

export const demoTasks: TaskItem[] = [
  { id: "task-1", case_code: "EXP-2026-0001", title: "Confirmar costes finales con Hotel Aurora Kyoto", area: "Compras proveedor", owner: "Operaciones Demo", due_date: "2026-02-14", status: "blocked", priority: "high", blocker: "Proveedor pendiente de respuesta." },
  { id: "task-2", case_code: "EXP-2026-0001", title: "Solicitar documento del acompañante", area: "Viajeros", owner: "Operaciones Demo", due_date: "2026-02-13", status: "todo", priority: "urgent", notes: "Bloquea contrato." },
  { id: "task-3", case_code: "EXP-2026-0002", title: "Seguimiento de propuesta enviada", area: "Ventas", owner: "Ventas Demo", due_date: "2026-02-13", status: "doing", priority: "normal" },
  { id: "task-4", case_code: "EXP-2026-0002", title: "Revisar borrador fiscal antes de sincronizar", area: "Facturación", owner: "Facturación Demo", due_date: "2026-02-15", status: "waiting", priority: "normal" },
];

export function taskSummary(items: TaskItem[]) {
  const open = items.filter((item) => item.status !== "done").length;
  const blocked = items.filter((item) => item.status === "blocked").length;
  const urgent = items.filter((item) => item.priority === "urgent" && item.status !== "done").length;
  const done = items.filter((item) => item.status === "done").length;
  return { total: items.length, open, blocked, urgent, done };
}
