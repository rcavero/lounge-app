import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getAllSeats, getZoneLabels } from "@/modules/seating/actions";
import { SeatPositionEditor } from "./client";

export default async function AdminSeatsPage() {
  const [seats, zoneLabels] = await Promise.all([getAllSeats(), getZoneLabels()]);

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
              <h1 className="text-white font-semibold text-sm">Configurar Asientos</h1>
              <p className="text-white/50 text-xs">
                Arrastra los asientos para posicionarlos
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 px-4 py-4">
        <div className="max-w-lg mx-auto">
          <SeatPositionEditor seats={seats} zoneLabels={zoneLabels} />
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
