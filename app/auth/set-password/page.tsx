import { Logo } from "@/components/Logo";
import { loadDefaultPublicBrand } from "@/lib/app-theme-server";
import { SetPasswordForm } from "./SetPasswordForm";

export default async function SetPasswordPage() {
  const brand = await loadDefaultPublicBrand().catch(() => ({ logoUrl: "" }));
  return (
    <main className="login-page">
      <section className="login-card">
        <Logo size={74} src={brand.logoUrl} alt="Logo corporativo" />
        <div className="login-heading">
          <h1>Define tu contraseña</h1>
          <p>Completa el acceso antes de entrar al software.</p>
        </div>
        <SetPasswordForm />
      </section>
    </main>
  );
}
