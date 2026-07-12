"use client";

import { FormEvent, useEffect, useState } from "react";
import { appRoleLabels, appRoles, type AppRole } from "@/lib/settings-master";

type ManagedUser = {
  id: string;
  fullName: string;
  email: string;
  role: AppRole;
  status: "active" | "invited";
  invitedAt: string | null;
  lastSignInAt: string | null;
  current?: boolean;
};

function friendlyError(value: string) {
  if (value === "last_admin_cannot_be_demoted") return "No puedes quitar el rol al último administrador.";
  if (value === "invalid_email") return "Introduce un correo válido.";
  if (value === "invalid_full_name") return "Introduce el nombre completo.";
  if (value.toLowerCase().includes("already")) return "Ese correo ya tiene una cuenta o una invitación pendiente.";
  return value || "No se pudo completar la operación.";
}

function formatDate(value: string | null) {
  if (!value) return "Nunca";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" });
}

export function UserManagementPanel({ canManage }: { canManage: boolean }) {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<AppRole>("sales");

  useEffect(() => {
    if (!canManage) { setLoading(false); return; }
    let active = true;
    void fetch("/api/routsify/settings/users", { cache: "no-store" })
      .then(async (response) => ({ response, result: await response.json().catch(() => null) }))
      .then(({ response, result }) => {
        if (!active) return;
        if (!response.ok || !result?.ok) setError(friendlyError(String(result?.error || "users_load_failed")));
        else setUsers(result.data || []);
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [canManage]);

  async function invite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy("invite"); setMessage(null); setError(null);
    const response = await fetch("/api/routsify/settings/users", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ fullName, email, role }),
    });
    const result = await response.json().catch(() => null);
    setBusy(null);
    if (!response.ok || !result?.ok) { setError(friendlyError(String(result?.error || "invite_failed"))); return; }
    setUsers((current) => [...current, result.data]);
    setFullName(""); setEmail(""); setRole("sales");
    setMessage("Invitación enviada. El usuario podrá definir su acceso desde el correo recibido.");
  }

  async function changeRole(userId: string, nextRole: AppRole) {
    const previous = users.find((user) => user.id === userId)?.role;
    setUsers((current) => current.map((user) => user.id === userId ? { ...user, role: nextRole } : user));
    setBusy(`role:${userId}`); setMessage(null); setError(null);
    const response = await fetch("/api/routsify/settings/users", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId, role: nextRole }),
    });
    const result = await response.json().catch(() => null);
    setBusy(null);
    if (!response.ok || !result?.ok) {
      if (previous) setUsers((current) => current.map((user) => user.id === userId ? { ...user, role: previous } : user));
      setError(friendlyError(String(result?.error || "role_update_failed")));
      return;
    }
    setMessage("Permisos actualizados y aplicados al usuario.");
  }

  if (!canManage) return <section className="card"><h2>Usuarios y permisos</h2><p>Solo un administrador puede crear usuarios y modificar roles.</p></section>;

  return <div className="settings-users-layout">
    <section className="card settings-user-create">
      <div className="section-heading"><div><span className="eyebrow">Equipo</span><h2>Crear usuario</h2><p>El usuario recibirá una invitación segura para activar su cuenta.</p></div></div>
      <form className="form" onSubmit={(event) => void invite(event)}>
        <label>Nombre completo<input className="input" value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="Nombre y apellidos" required minLength={2} /></label>
        <label>Correo electrónico<input className="input" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="usuario@routsify.com" required /></label>
        <label>Rol inicial<select value={role} onChange={(event) => setRole(event.target.value as AppRole)}>{appRoles.map((item) => <option key={item} value={item}>{appRoleLabels[item]}</option>)}</select></label>
        <div className="role-guide">
          <strong>{appRoleLabels[role]}</strong>
          <span>{role === "admin" ? "Control completo, usuarios, ajustes y credenciales." : role === "direction" ? "Visión global y operación, sin gestión de credenciales ni usuarios." : role === "sales" ? "Clientes, expedientes, propuestas y pagos comerciales." : role === "operations" ? "Expedientes, viajeros, tareas y proveedores." : role === "billing" ? "Compras, pagos, fiscalidad e informes económicos." : "Consulta de información sin cambios operativos."}</span>
        </div>
        <button className="btn" type="submit" disabled={busy !== null}>{busy === "invite" ? "Enviando invitación..." : "Crear e invitar usuario"}</button>
      </form>
    </section>

    <section className="card settings-user-list">
      <div className="panel-head"><div><h2>Usuarios de la organización</h2><p>Roles efectivos aplicados por la API y el backoffice.</p></div><span className="badge">{users.length} usuarios</span></div>
      {loading ? <p>Cargando usuarios...</p> : null}
      {!loading && users.length === 0 ? <div className="empty-state"><h3>No hay usuarios visibles</h3><p>Crea el primer miembro del equipo desde el formulario.</p></div> : null}
      {users.length ? <div className="table-scroll"><table className="settings-users-table"><thead><tr><th>Usuario</th><th>Estado</th><th>Último acceso</th><th>Rol</th></tr></thead><tbody>{users.map((user) => <tr key={user.id}>
        <td><strong>{user.fullName}</strong>{user.current ? <span className="badge current-user-badge">Tú</span> : null}<br/><small>{user.email || "Correo pendiente"}</small></td>
        <td><span className={`status-pill ${user.status === "active" ? "status-success" : "status-warning"}`}>{user.status === "active" ? "Activo" : "Invitado"}</span><br/><small>{user.status === "invited" ? `Enviado ${formatDate(user.invitedAt)}` : "Acceso confirmado"}</small></td>
        <td>{formatDate(user.lastSignInAt)}</td>
        <td><select value={user.role} disabled={busy !== null} onChange={(event) => void changeRole(user.id, event.target.value as AppRole)}>{appRoles.map((item) => <option key={item} value={item}>{appRoleLabels[item]}</option>)}</select>{busy === `role:${user.id}` ? <small> Guardando...</small> : null}</td>
      </tr>)}</tbody></table></div> : null}
    </section>
    {message ? <p className="client-message settings-feedback" role="status">{message}</p> : null}
    {error ? <p className="form-warning settings-feedback" role="alert">{error}</p> : null}
  </div>;
}
