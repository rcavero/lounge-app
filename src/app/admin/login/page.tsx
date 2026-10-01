import { redirect } from "next/navigation";
import { getSessionData } from "@/modules/auth/actions";
import { LoginForm } from "./client";
import { Logo } from "@/shared/components/logo";

export default async function AdminLoginPage() {
  // Con una sesión que la base da por buena, al panel. Con una cookie que ya no vale se
  // queda aquí, y el siguiente login la sobrescribe.
  if ((await getSessionData()).isLoggedIn) redirect("/admin");

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center px-4">
      <div className="mb-8">
        <Logo size="lg" />
      </div>

      <h1 className="text-lg font-medium tracking-widest text-white/90 mb-8">
        PANEL DE ADMINISTRACION
      </h1>

      <div className="w-full max-w-sm">
        <LoginForm />
      </div>

      <footer className="mt-12">
        <p className="text-xs text-white/40 tracking-wider">
          THE LOUNGE BEERHOUSE &bull; VALENCIA
        </p>
      </footer>
    </div>
  );
}
