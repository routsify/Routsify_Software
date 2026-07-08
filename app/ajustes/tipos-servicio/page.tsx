import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { serviceTypes } from "@/lib/mock-data";

export default function ServiceTypesPage() {
  return (
    <AppShell>
      <PageHeader eyebrow="Configuración" title="Tipos de servicio" description="Los tipos mínimos salen preparados como tabla configurable para ampliarlos desde backoffice sin tocar código." action={<button className="btn">Añadir tipo</button>} />
      <section className="grid grid-2">
        <div className="card">
          <table>
            <thead><tr><th>Código</th><th>Nombre</th><th>Activo</th></tr></thead>
            <tbody>{serviceTypes.map((item) => <tr key={item.code}><td>{item.code}</td><td><strong>{item.name}</strong></td><td>{item.active ? "Sí" : "No"}</td></tr>)}</tbody>
          </table>
        </div>
        <div className="card">
          <div className="eyebrow">Nuevo tipo</div>
          <h2>Formulario previsto</h2>
          <form className="form">
            <input className="input" placeholder="Código: train" />
            <input className="input" placeholder="Nombre: Tren" />
            <select><option>Activo</option><option>Inactivo</option></select>
            <button className="btn" type="button">Guardar tipo</button>
          </form>
        </div>
      </section>
    </AppShell>
  );
}
