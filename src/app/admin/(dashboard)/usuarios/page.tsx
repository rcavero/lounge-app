import Link from "next/link";
import { LinkPendingIndicator, PRESSABLE } from "@/shared/components/link-pending";
import { ArrowLeft, Plus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getAllUsers } from "@/modules/users/actions";

const roleLabels = {
  ADMIN: "Admin",
  WORKER: "Worker",
};

const roleColors = {
  ADMIN: "bg-[#D4AF37] text-black",
  WORKER: "bg-white/20 text-white",
};

export default async function AdminUsersPage() {
  const users = await getAllUsers();

  return (
    <div className="min-h-screen bg-black flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-black/95 backdrop-blur border-b border-white/10">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <Link
              href="/admin"
              className="text-white/70 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-white font-semibold text-sm">Administrar Usuarios</h1>
              <p className="text-white/50 text-xs">Gestiona los usuarios del sistema</p>
            </div>
          </div>
          <Link href="/admin/usuarios/nuevo">
            <Button size="sm" className="bg-[#D4AF37] hover:bg-[#b8972e] text-black">
              <Plus className="w-4 h-4 mr-1" />
              Añadir usuario
            </Button>
          </Link>
        </div>
      </header>

      {/* Users List */}
      <main className="flex-1 px-4 py-4">
        {users.length === 0 ? (
          <div className="text-center py-16">
            <Users className="w-12 h-12 text-white/30 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">No hay usuarios</h3>
            <p className="text-white/50 mb-6">Crea tu primer usuario para empezar.</p>
            <Link href="/admin/usuarios/nuevo">
              <Button className="bg-[#D4AF37] hover:bg-[#b8972e] text-black">
                <Plus className="w-4 h-4 mr-2" />
                Crear usuario
              </Button>
            </Link>
          </div>
        ) : (
          <div className="max-w-lg mx-auto space-y-3">
            {users.map((user) => (
              <Link
                key={user.id}
                href={`/admin/usuarios/${user.id}`}
                className={`block relative ${PRESSABLE}`}
              >
                <div className="bg-[#1a1a1a] rounded-2xl px-4 py-4 flex items-center justify-between hover:bg-[#222] transition-colors border border-white/10">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-white font-semibold text-base truncate">
                      {user.name || "Sin nombre"}
                    </h3>
                    <p className="text-white/50 text-sm truncate">{user.email}</p>
                  </div>
                  <span
                    className={`text-xs font-semibold px-3 py-1 rounded-full ${roleColors[user.role]}`}
                  >
                    {roleLabels[user.role]}
                  </span>
                </div>
                <LinkPendingIndicator />
              </Link>
            ))}
          </div>
        )}
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
