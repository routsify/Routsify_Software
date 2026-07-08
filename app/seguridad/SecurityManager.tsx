"use client";

import { useMemo, useState } from "react";
import { demoAuditLog, demoTeam, permissionMatrix, roles, securitySummary, TeamMember } from "@/lib/security";
import { isDemoMode } from "@/lib/supabase-browser";

export function SecurityManager() {
  const [team, setTeam] = useState<TeamMember[]>(demoTeam);
  const summary = useMemo(() => securitySummary(team, demoAuditLog), [team]);

  function changeRole(id: string, role: TeamMember["role"]) {
    setTeam((current) => current.map((member) => member.id === id ? { ...member, role } : member));
  }

  function changeStatus(id: string, status: TeamMember["status"]) {
    setTeam((current) => current.map((member) => member.id === id ? { ...member, status } : member));
  }

  return (
    <div className="grid">
      <section className="grid grid-3">
        <div className="card"><span className="badge">Usuarios</span><div className="metric">{summary.total}</div><p>{summary.active} activos y {summary.invited} invitados.</p></div>
        <div className="card"><span className="badge">Riesgo alto</span><div className="metric">{summary.highRisk}</div><p>Acciones sensibles que requieren trazabilidad.</p></div>
        <div className="card"><span className="badge">Modo</span><div className="metric">{isDemoMode() ? "demo" : "real"}</div><p>Los roles reales se aplicarán con RLS al activar Supabase.</p></div>
      </section>

      <section className="card">
        <div className="eyebrow">Equipo interno</div>
        <h2>Usuarios y roles</h2>
        <table>
          <thead><tr><th>Usuario</th><th>Email</th><th>Rol</th><th>Estado</th><th>Última actividad</th></tr></thead>
          <tbody>
            {team.map((member) => (
              <tr key={member.id}>
                <td><strong>{member.full_name}</strong></td>
                <td>{member.email}</td>
                <td><select value={member.role} onChange={(event) => changeRole(member.id, event.target.value as TeamMember["role"])}>{roles.map((role) => <option key={role} value={role}>{role}</option>)}</select></td>
                <td><select value={member.status} onChange={(event) => changeStatus(member.id, event.target.value as TeamMember["status"])}><option value="active">active</option><option value="invited">invited</option><option value="disabled">disabled</option></select></td>
                <td>{member.last_seen}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="card">
        <div className="eyebrow">Matriz de permisos</div>
        <h2>Qué puede hacer cada rol</h2>
        <table>
          <thead><tr><th>Área</th>{roles.map((role) => <th key={role}>{role}</th>)}</tr></thead>
          <tbody>
            {permissionMatrix.map((row) => (
              <tr key={row.area}>
                <td><strong>{row.area}</strong></td>
                {roles.map((role) => <td key={role}>{row[role] ? "Sí" : "No"}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="card">
        <div className="eyebrow">Auditoría</div>
        <h2>Registro de acciones sensibles</h2>
        <table>
          <thead><tr><th>Fecha</th><th>Actor</th><th>Acción</th><th>Entidad</th><th>Riesgo</th></tr></thead>
          <tbody>{demoAuditLog.map((item) => <tr key={item.id}><td>{item.created_at}</td><td>{item.actor}</td><td>{item.action}</td><td>{item.entity}: {item.entity_label}</td><td><span className="badge">{item.risk}</span></td></tr>)}</tbody>
        </table>
      </section>
    </div>
  );
}
