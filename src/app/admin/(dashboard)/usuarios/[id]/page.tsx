import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getUserForEdit } from "@/modules/users/actions";
import { redirectUnlessAdmin } from "@/lib/auth-guard";
import { FlashToast } from "@/shared/components/toast";
import { EditUser } from "../components/edit-user";

interface EditUserPageProps {
  params: Promise<{ id: string }>;
}

const MESSAGES = { guardado: "Cambios guardados" };

export default async function EditUserPage({ params }: EditUserPageProps) {
  await redirectUnlessAdmin();

  const { id } = await params;
  const result = await getUserForEdit(id);

  if (!result) {
    notFound();
  }

  const { user, permissions } = result;

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
              <h1 className="text-white font-semibold text-sm">
                {permissions.isSelf ? "Mi cuenta" : "Editar Usuario"}
              </h1>
              <p className="text-white/50 text-xs">{user.name || user.email}</p>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 px-4 py-4">
        <div className="max-w-lg mx-auto">
          <EditUser user={user} permissions={permissions} />
        </div>
      </main>

      {/* Footer */}
      <footer className="py-4 text-center border-t border-white/10">
        <p className="text-xs text-white/40 tracking-wider">
          THE LOUNGE BEERHOUSE • VALENCIA
        </p>
      </footer>

      <Suspense>
        <FlashToast messages={MESSAGES} />
      </Suspense>
    </div>
  );
}
