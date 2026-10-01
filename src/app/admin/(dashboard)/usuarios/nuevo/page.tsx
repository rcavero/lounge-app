import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { CreateUserForm } from "../components/create-user-form";
import { redirectUnlessAdmin } from "@/lib/auth-guard";

export default async function NewUserPage() {
  await redirectUnlessAdmin();

  return (
    <div className="min-h-screen bg-black flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-black/95 backdrop-blur border-b border-white/10">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <Link
              href="/admin/usuarios"
              className="text-white/70 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-white font-semibold text-sm">Añadir Usuario</h1>
              <p className="text-white/50 text-xs">Crea un nuevo usuario del sistema</p>
            </div>
          </div>
        </div>
      </header>

      {/* Form */}
      <main className="flex-1 px-4 py-4">
        <div className="max-w-lg mx-auto">
          <CreateUserForm />
        </div>
      </main>

      {/* Footer */}
      <footer className="py-4 text-center border-t border-white/10">
        <p className="text-xs text-white/40 tracking-wider">
          THE LOUNGE BEERHOUSE • VALENCIA
        </p>
      </footer>
    </div>
  );
}
