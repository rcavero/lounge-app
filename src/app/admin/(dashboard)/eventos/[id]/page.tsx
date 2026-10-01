import { notFound } from "next/navigation";
import { getAllTeams, getEventById } from "@/modules/events/actions";
import { EditEventForm } from "./client";
import { redirectUnlessAdmin } from "@/lib/auth-guard";

interface EditEventPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditEventPage({ params }: EditEventPageProps) {
  await redirectUnlessAdmin();

  const { id } = await params;
  const [event, teams] = await Promise.all([getEventById(id), getAllTeams()]);

  if (!event) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-black flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-black/95 backdrop-blur border-b border-white/10">
        <div className="flex items-center justify-between px-4 py-3">
          <div>
            <h1 className="text-white font-semibold text-sm">Editar Evento</h1>
            <p className="text-white/50 text-xs">Modifica los detalles del partido</p>
          </div>
        </div>
      </header>

      {/* Form */}
      <main className="flex-1 px-4 py-4">
        <div className="max-w-lg mx-auto">
          <EditEventForm event={event} teams={teams} />
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
