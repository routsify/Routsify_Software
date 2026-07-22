import { Logo } from "@/components/Logo";
import { LoginForm } from "./LoginForm";
import { loadDefaultPublicBrand } from "@/lib/app-theme-server";

export default async function LoginPage() {
  const brand = await loadDefaultPublicBrand().catch(() => ({ logoUrl: "" }));
  return (
    <main className="login-page">
      <section className="login-card">
        <Logo size={74} src={brand.logoUrl} alt="Logo corporativo" />
        <div className="login-heading">
          <h1>Accede a Routsify Software</h1>
          <p>Inicia sesión para continuar.</p>
        </div>
        <LoginForm />
      </section>
    </main>
  );
}
