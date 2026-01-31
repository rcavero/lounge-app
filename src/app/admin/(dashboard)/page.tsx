import Link from "next/link";
import { Calendar, Armchair, ClipboardList } from "lucide-react";

export default function AdminDashboardPage() {
  return (
    <div className="min-h-screen bg-black flex flex-col">
      <main className="flex-1 px-4 py-8">
        <div className="max-w-lg mx-auto">
          <h1 className="text-white text-xl font-semibold mb-6">
            Panel de Administracion
          </h1>

          <div className="space-y-3">
            <Link
              href="/admin/eventos"
              className="flex items-center gap-4 bg-[#1a1a1a] border border-white/10 rounded-xl p-4 hover:border-[#D4AF37]/50 transition-colors"
            >
              <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-[#D4AF37]/10">
                <Calendar className="w-6 h-6 text-[#D4AF37]" />
              </div>
              <div>
                <h2 className="text-white font-semibold text-sm">Configurar eventos</h2>
                <p className="text-white/50 text-xs">Crear, editar o eliminar eventos</p>
              </div>
            </Link>

            <Link
              href="/admin/reservas"
              className="flex items-center gap-4 bg-[#1a1a1a] border border-white/10 rounded-xl p-4 hover:border-[#D4AF37]/50 transition-colors"
            >
              <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-[#D4AF37]/10">
                <ClipboardList className="w-6 h-6 text-[#D4AF37]" />
              </div>
              <div>
                <h2 className="text-white font-semibold text-sm">Administrar reservas</h2>
                <p className="text-white/50 text-xs">Ver y gestionar reservas por evento</p>
              </div>
            </Link>

            <Link
              href="/admin/asientos"
              className="flex items-center gap-4 bg-[#1a1a1a] border border-white/10 rounded-xl p-4 hover:border-[#D4AF37]/50 transition-colors"
            >
              <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-[#D4AF37]/10">
                <Armchair className="w-6 h-6 text-[#D4AF37]" />
              </div>
              <div>
                <h2 className="text-white font-semibold text-sm">Configurar asientos</h2>
                <p className="text-white/50 text-xs">Posicionar asientos en el mapa del local</p>
              </div>
            </Link>
          </div>
        </div>
      </main>

      <footer className="py-4 text-center border-t border-white/10">
        <p className="text-xs text-white/40 tracking-wider">
          THE LOUNGE BEERHOUSE &bull; VALENCIA
        </p>
      </footer>
    </div>
  );
}
