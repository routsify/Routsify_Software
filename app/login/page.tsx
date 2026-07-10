import { Logo } from "@/components/Logo";
import { LoginForm } from "./LoginForm";

export default function LoginPage() {
  return (
    <main className="proposal-hero">
      <div className="proposal-wrap" style={{ maxWidth: 520 }}>
        <section className="card" style={{ display: "grid", gap: 20 }}>
          <div style={{ textAlign: "center", display: "grid", gap: 10, justifyItems: "center" }}>
            <Logo size={76} />
            <div>
              <h1 style={{ marginBottom: 8 }}>Entrar</h1>
              <p style={{ color: "var(--muted)", margin: 0 }}>Accede a Routsify Software</p>
            </div>
          </div>
          <LoginForm />
        </section>
      </div>
    </main>
  );
}
