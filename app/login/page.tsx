import { Logo } from "@/components/Logo";
import { LoginForm } from "./LoginForm";

export default function LoginPage() {
  return (
    <main className="proposal-hero">
      <div className="proposal-wrap" style={{ maxWidth: 1040 }}>
        <section className="grid grid-2" style={{ alignItems: "stretch" }}>
          <div className="card" style={{ display: "grid", gap: 18 }}>
            <Logo size={72} />
            <div>
              <div className="eyebrow" style={{ marginTop: 18 }}>Backoffice privado</div>
              <h1>Entrar en Routsify Software</h1>
              <p>Acceso solo para usuarios internos. Las sesiones se validan con Supabase Auth y las pantallas quedan sujetas a RLS y rol operativo.</p>
            </div>
            <LoginForm />
          </div>
          <aside className="card" style={{ background: "linear-gradient(160deg, #003d26, #006b3f)", color: "white", display: "grid", alignContent: "space-between", gap: 24 }}>
            <div>
              <span className="badge" style={{ background: "rgba(255,255,255,.14)", color: "white" }}>Seguridad preparada</span>
              <h2 style={{ color: "white" }}>Acceso controlado antes de operar</h2>
              <p>La versión final no debe abrir Inicio, Clientes o Expedientes sin sesión válida.</p>
            </div>
            <div style={{ display: "grid", gap: 12 }}>
              <p>✓ Login con email y contraseña</p>
              <p>✓ Recuperación por email</p>
              <p>✓ Sesión compatible con middleware</p>
              <p>✓ Perfil interno y roles</p>
              <p>✓ Demo solo si se activa explícitamente</p>
            </div>
            <small>Si no puedes entrar, revisa que el usuario exista en Supabase Auth y que las variables públicas estén configuradas en Vercel/Netlify.</small>
          </aside>
        </section>
      </div>
    </main>
  );
}
