"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { TeamLogo } from "@/modules/events/components/team-logo";
import { CompetitionEmblem } from "@/modules/events/components/competition-emblem";
import { updateEvent, deleteEvent } from "@/modules/events/actions";
import { ArrowLeft, Save, Check, Trash2, X } from "lucide-react";
import type { Team, EventWithTeams } from "@/modules/events/types";
import {
  COMPETITION_NAMES,
  COMPETITION_LEAGUES,
  MANUAL_SPORT_NAMES,
  isManualSport,
  isMotorSport,
  getSportEmoji,
} from "@/modules/football-data/config/competitions";

interface EditEventFormProps {
  event: EventWithTeams;
  teams: Team[];
}

const SCREENS = [
  { id: "TV1", label: "TV1", color: "bg-[#7f1d1d] border-[#b91c1c]" },
  { id: "TV2", label: "TV2", color: "bg-[#1e3a5f] border-[#3b82f6]" },
  { id: "PROYECTOR", label: "PROYECTOR", color: "bg-[#92700c] border-[#D4AF37]" },
];

const DURATION_OPTIONS = [
  { value: 60, label: "1 h" },
  { value: 90, label: "1 h 30" },
  { value: 120, label: "2 h" },
  { value: 180, label: "3 h" },
  { value: 240, label: "4 h" },
];

const INPUT_CLASS =
  "w-full bg-[#1a1a1a] border border-white/20 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#D4AF37] placeholder:text-white/30";

function getInitialScreens(event: EventWithTeams): string[] {
  if (!event.screens) return ["PROYECTOR"];
  return event.screens.split(",").filter(Boolean);
}

function formatDateForInput(date: Date | string): string {
  const d = new Date(date);
  return d.toISOString().split("T")[0];
}

function formatTimeForInput(date: Date | string): string {
  const d = new Date(date);
  return d.toTimeString().slice(0, 5);
}

export function EditEventForm({ event, teams }: EditEventFormProps) {
  const router = useRouter();
  const [competition, setCompetition] = useState<string>(event.competition || "La Liga");
  // Football state
  const [homeTeamId, setHomeTeamId] = useState<string>(event.homeTeamId ?? "");
  const [awayTeamId, setAwayTeamId] = useState<string>(event.awayTeamId ?? "");
  // Manual sport state
  const [homeTeamName, setHomeTeamName] = useState<string>(event.homeTeamName ?? "");
  const [awayTeamName, setAwayTeamName] = useState<string>(event.awayTeamName ?? "");
  // Common state
  const [eventDate, setEventDate] = useState<string>(formatDateForInput(event.eventDate));
  const [eventTime, setEventTime] = useState<string>(formatTimeForInput(event.eventDate));
  const [selectedScreens, setSelectedScreens] = useState<string[]>(getInitialScreens(event));
  const [pricePerSeat, setPricePerSeat] = useState<number>(event.pricePerSeat ?? 10);
  const [durationMinutes, setDurationMinutes] = useState<number>(event.durationMinutes ?? 120);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isManual = isManualSport(competition);
  const isMotor = isMotorSport(competition);
  const sportEmoji = getSportEmoji(competition);

  // Eventos históricos pueden tener una competición ya retirada del sync (p.ej.
  // Championship o Brasileirão). Sin esta opción, el <select> controlado no
  // encontraría su valor y mostraría la primera de la lista, dando a entender
  // que el evento es de otra competición.
  const isRetiredCompetition =
    !!competition &&
    !COMPETITION_NAMES.includes(competition) &&
    !MANUAL_SPORT_NAMES.includes(competition);

  // Filter teams based on selected competition (football only)
  const filteredTeams = useMemo(() => {
    const leagues = COMPETITION_LEAGUES[competition] || [];
    return teams.filter((team) => leagues.includes(team.league));
  }, [teams, competition]);

  const homeTeam = teams.find((t) => t.id === homeTeamId);
  const awayTeam = teams.find((t) => t.id === awayTeamId);

  const toggleScreen = (screenId: string) => {
    setSelectedScreens((prev) =>
      prev.includes(screenId) ? prev.filter((s) => s !== screenId) : [...prev, screenId]
    );
  };

  const handleCompetitionChange = (newCompetition: string) => {
    const newLeagues = COMPETITION_LEAGUES[newCompetition] || [];
    const currentHomeTeam = teams.find((t) => t.id === homeTeamId);
    const currentAwayTeam = teams.find((t) => t.id === awayTeamId);

    setCompetition(newCompetition);
    setHomeTeamName("");
    setAwayTeamName("");

    if (currentHomeTeam && !newLeagues.includes(currentHomeTeam.league)) {
      setHomeTeamId("");
    }
    if (currentAwayTeam && !newLeagues.includes(currentAwayTeam.league)) {
      setAwayTeamId("");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!eventDate || !eventTime) {
      setError("Por favor, introduce la fecha y hora del evento");
      return;
    }

    if (selectedScreens.length === 0) {
      setError("Selecciona al menos una pantalla");
      return;
    }

    if (isMotor) {
      if (!homeTeamName.trim()) {
        setError("Introduce el nombre del Gran Premio");
        return;
      }
    } else if (isManual) {
      if (!homeTeamName.trim() || !awayTeamName.trim()) {
        setError("Introduce los nombres de los dos participantes");
        return;
      }
    } else {
      if (!homeTeamId || !awayTeamId) {
        setError("Selecciona el equipo local y visitante");
        return;
      }
      if (homeTeamId === awayTeamId) {
        setError("El equipo local y visitante no pueden ser el mismo");
        return;
      }
    }

    setIsSaving(true);

    try {
      const dateTime = new Date(`${eventDate}T${eventTime}`);

      const result = await updateEvent(
        event.id,
        isManual
          ? {
              homeTeamName: homeTeamName.trim(),
              awayTeamName: isMotor ? undefined : awayTeamName.trim(),
              eventDate: dateTime,
              screens: selectedScreens,
              competition,
              pricePerSeat,
              durationMinutes,
            }
          : {
              homeTeamId,
              awayTeamId,
              eventDate: dateTime,
              screens: selectedScreens,
              competition,
              pricePerSeat,
              durationMinutes,
            }
      );

      if (result.success) {
        router.push("/admin/eventos");
      } else {
        setError(result.error || "Error al actualizar el evento");
      }
    } catch {
      setError("Error al actualizar el evento");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const result = await deleteEvent(event.id);
      if (result.success) {
        router.push("/admin/eventos");
      } else {
        setError(result.error || "Error al eliminar el evento");
        setShowDeleteModal(false);
      }
    } catch {
      setError("Error al eliminar el evento");
      setShowDeleteModal(false);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Back button */}
        <Link
          href="/admin/eventos"
          className="inline-flex items-center text-white/70 hover:text-white text-sm"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Volver al listado
        </Link>

        {/* Competition Selection */}
        <div className="space-y-2">
          <label className="text-white/70 text-xs font-medium">Competición</label>
          <div className="flex items-center gap-2">
            <CompetitionEmblem competition={competition} className="shrink-0" />
            <select
              value={competition}
              onChange={(e) => handleCompetitionChange(e.target.value)}
              className={INPUT_CLASS}
            >
              {isRetiredCompetition && (
                <option value={competition}>{competition} (retirada)</option>
              )}
              <optgroup label="Fútbol">
                {COMPETITION_NAMES.map((comp) => (
                  <option key={comp} value={comp}>
                    {comp}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Otros deportes">
                {MANUAL_SPORT_NAMES.map((sport) => (
                  <option key={sport} value={sport}>
                    {sport}
                  </option>
                ))}
              </optgroup>
            </select>
          </div>
        </div>

        {/* Team / Participant Section */}
        {isMotor ? (
          // Motor sports: single Gran Premio field
          <div className="space-y-2">
            <label className="text-white/70 text-xs font-medium">Gran Premio</label>
            <input
              type="text"
              value={homeTeamName}
              onChange={(e) => setHomeTeamName(e.target.value)}
              placeholder="Gran Premio de España"
              className={INPUT_CLASS}
            />
            {homeTeamName.trim() && (
              <div className="flex items-center justify-center gap-3 p-3 bg-[#1a1a1a] rounded-xl">
                <span className="text-3xl">{sportEmoji}</span>
                <span className="text-white text-sm font-medium">{homeTeamName.trim()}</span>
              </div>
            )}
          </div>
        ) : isManual ? (
          // Other manual sports: two text inputs
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-white/70 text-xs font-medium">Participante Local</label>
              <input
                type="text"
                value={homeTeamName}
                onChange={(e) => setHomeTeamName(e.target.value)}
                placeholder="Nombre..."
                className={INPUT_CLASS}
              />
              {homeTeamName.trim() && (
                <div className="flex items-center gap-2 p-2 bg-[#1a1a1a] rounded-lg">
                  <span className="text-lg">{sportEmoji}</span>
                  <span className="text-white text-sm">{homeTeamName.trim()}</span>
                </div>
              )}
            </div>
            <div className="space-y-2">
              <label className="text-white/70 text-xs font-medium">Participante Visitante</label>
              <input
                type="text"
                value={awayTeamName}
                onChange={(e) => setAwayTeamName(e.target.value)}
                placeholder="Nombre..."
                className={INPUT_CLASS}
              />
              {awayTeamName.trim() && (
                <div className="flex items-center gap-2 p-2 bg-[#1a1a1a] rounded-lg">
                  <span className="text-lg">{sportEmoji}</span>
                  <span className="text-white text-sm">{awayTeamName.trim()}</span>
                </div>
              )}
            </div>
          </div>
        ) : (
          // Football: team selects
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-white/70 text-xs font-medium">Equipo Local</label>
              <select
                value={homeTeamId}
                onChange={(e) => setHomeTeamId(e.target.value)}
                className={INPUT_CLASS}
              >
                <option value="">Seleccionar...</option>
                {filteredTeams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </select>
              {homeTeam && (
                <div className="flex items-center gap-2 mt-2 p-2 bg-[#1a1a1a] rounded-lg">
                  <TeamLogo team={homeTeam} size="sm" />
                  <span className="text-white text-sm">{homeTeam.shortName}</span>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-white/70 text-xs font-medium">Equipo Visitante</label>
              <select
                value={awayTeamId}
                onChange={(e) => setAwayTeamId(e.target.value)}
                className={INPUT_CLASS}
              >
                <option value="">Seleccionar...</option>
                {filteredTeams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </select>
              {awayTeam && (
                <div className="flex items-center gap-2 mt-2 p-2 bg-[#1a1a1a] rounded-lg">
                  <TeamLogo team={awayTeam} size="sm" />
                  <span className="text-white text-sm">{awayTeam.shortName}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Match Preview */}
        {isMotor ? null : isManual ? (
          homeTeamName.trim() && awayTeamName.trim() && (
            <div className="bg-[#1a1a1a] rounded-xl p-4 flex items-center justify-center gap-4">
              <div className="flex flex-col items-center">
                <span className="text-3xl">{sportEmoji}</span>
                <span className="text-white/70 text-xs mt-1">{homeTeamName.trim()}</span>
              </div>
              <span className="text-white/50 text-lg font-bold">vs</span>
              <div className="flex flex-col items-center">
                <span className="text-3xl">{sportEmoji}</span>
                <span className="text-white/70 text-xs mt-1">{awayTeamName.trim()}</span>
              </div>
            </div>
          )
        ) : (
          homeTeam && awayTeam && (
            <div className="bg-[#1a1a1a] rounded-xl p-4 flex items-center justify-center gap-4">
              <div className="flex flex-col items-center">
                <TeamLogo team={homeTeam} size="lg" />
                <span className="text-white/70 text-xs mt-1">{homeTeam.shortName}</span>
              </div>
              <span className="text-white/50 text-lg font-bold">vs</span>
              <div className="flex flex-col items-center">
                <TeamLogo team={awayTeam} size="lg" />
                <span className="text-white/70 text-xs mt-1">{awayTeam.shortName}</span>
              </div>
            </div>
          )
        )}

        {/* Date and Time */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-white/70 text-xs font-medium">Fecha</label>
            <input
              type="date"
              value={eventDate}
              onChange={(e) => setEventDate(e.target.value)}
              className={INPUT_CLASS}
            />
          </div>
          <div className="space-y-2">
            <label className="text-white/70 text-xs font-medium">Hora</label>
            <input
              type="time"
              value={eventTime}
              onChange={(e) => setEventTime(e.target.value)}
              className={INPUT_CLASS}
            />
          </div>
        </div>

        {/* Price per seat */}
        <div className="space-y-2">
          <label className="text-white/70 text-xs font-medium">Precio por asiento</label>
          <div className="flex gap-2">
            {[10, 15, 20, 25, 30].map((price) => (
              <button
                key={price}
                type="button"
                onClick={() => setPricePerSeat(price)}
                className={`flex-1 py-2.5 rounded-lg border-2 text-sm font-semibold transition-all ${
                  pricePerSeat === price
                    ? "bg-[#92700c] border-[#D4AF37] text-white"
                    : "bg-transparent border-white/20 text-white/50"
                }`}
              >
                {price}€
              </button>
            ))}
          </div>
        </div>

        {/* Duration Selection */}
        <div className="space-y-2">
          <label className="text-white/70 text-xs font-medium">Duración estimada</label>
          <div className="flex gap-2">
            {DURATION_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setDurationMinutes(opt.value)}
                className={`flex-1 py-2.5 rounded-lg border-2 text-sm font-semibold transition-all ${
                  durationMinutes === opt.value
                    ? "bg-[#92700c] border-[#D4AF37] text-white"
                    : "bg-transparent border-white/20 text-white/50"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Screen Selection */}
        <div className="space-y-2">
          <label className="text-white/70 text-xs font-medium">
            Pantallas donde se emitirá (selecciona una o más)
          </label>
          <div className="flex gap-2">
            {SCREENS.map((screen) => (
              <button
                key={screen.id}
                type="button"
                onClick={() => toggleScreen(screen.id)}
                className={`flex-1 py-3 px-4 rounded-lg border-2 text-sm font-semibold transition-all ${
                  selectedScreens.includes(screen.id)
                    ? `${screen.color} text-white`
                    : "bg-transparent border-white/20 text-white/50"
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  {selectedScreens.includes(screen.id) && <Check className="w-4 h-4" />}
                  {screen.label}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="space-y-3">
          <Button
            type="submit"
            disabled={isSaving}
            className="w-full bg-[#D4AF37] hover:bg-[#b8972e] text-black font-semibold py-3"
          >
            <Save className="w-4 h-4 mr-2" />
            {isSaving ? "Guardando..." : "Guardar Cambios"}
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={() => setShowDeleteModal(true)}
            className="w-full border-red-500/50 text-red-400 hover:bg-red-500/10 hover:text-red-300 font-semibold py-3"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Eliminar Evento
          </Button>
        </div>
      </form>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1a1a1a] rounded-2xl p-6 max-w-sm w-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-semibold text-lg">Eliminar Evento</h3>
              <button
                onClick={() => setShowDeleteModal(false)}
                className="text-white/50 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-white/70 text-sm mb-6">
              ¿Estás seguro de que quieres eliminar este evento? Esta acción no se puede deshacer y
              se eliminarán todas las reservas asociadas.
            </p>

            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowDeleteModal(false)}
                className="flex-1 border-white/20 text-white hover:bg-white/10"
              >
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white"
              >
                {isDeleting ? "Eliminando..." : "Eliminar"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
