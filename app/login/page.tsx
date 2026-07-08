import { Logo } from "@/components/Logo";
import { LoginForm } from "./LoginForm";

export default function LoginPage() {
  return (
    <main className="proposal-hero">
      <div className="proposal-wrap" style={{ maxWidth: 760 }}>
        <section className="card">
          <Logo size={72} />
          <div className="eyebrow" style={{ marginTop: 18 }}>Backoffice privado</div>
          <h1>Entrar en Routsify Software</h1>
          <p>Usa un usuario creado en Supabase Auth. Después de entrar, las pantallas podrán leer los datos reales sujetos a RLS y rol interno.</p>
          <LoginForm />
        </section>
      </div>
    </main>
  );
}
