import { Logo } from "@/components/Logo";
import { LoginForm } from "./LoginForm";

export default function LoginPage() {
  return (
    <main className="login-page">
      <section className="login-card">
        <Logo size={74} />
        <div className="login-heading">
          <h1>Accede a Routsify Software</h1>
          <p>Inicia sesión para continuar.</p>
        </div>
        <LoginForm />
      </section>
    </main>
  );
}
