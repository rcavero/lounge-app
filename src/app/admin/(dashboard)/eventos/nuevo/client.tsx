"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { TeamLogo } from "@/modules/events/components/team-logo";
import { createEvent } from "@/modules/events/actions";
import { ArrowLeft, Save, Check } from "lucide-react";
import type { Team } from "@/modules/events/types";

interface NewEventFormProps {
  teams: Team[];
}

const COMPETITIONS = [
  "La Liga",
  "Premier League",
  "Serie A",
  "Bundesliga",
  "Ligue 1",
  "Champions League",
  "Europa League",
];

// Mapping from competition to leagues that participate
const COMPETITION_LEAGUES: Record<string, string[]> = {
  "La Liga": ["La Liga"],
  "Premier League": ["Premier League"],
  "Serie A": ["Serie A"],
  "Bundesliga": ["Bundesliga"],
  "Ligue 1": ["Ligue 1"],
  "Champions League": ["La Liga", "Premier League", "Serie A", "Bundesliga", "Ligue 1"],
  "Europa League": ["La Liga", "Premier League", "Serie A", "Bundesliga", "Ligue 1"],
};

const SCREENS = [
  { id: "TV1", label: "TV1", color: "bg-[#7f1d1d] border-[#b91c1c]" },
  { id: "TV2", label: "TV2", color: "bg-[#1e3a5f] border-[#3b82f6]" },
  { id: "PROYECTOR", label: "PROYECTOR", color: "bg-[#92700c] border-[#D4AF37]" },
];

export function NewEventForm({ teams }: NewEventFormProps) {
  const router = useRouter();
  const [competition, setCompetition] = useState<string>("La Liga");
  const [homeTeamId, setHomeTeamId] = useState<string>("");
  const [awayTeamId, setAwayTeamId] = useState<string>("");
  const [eventDate, setEventDate] = useState<string>("");
  const [eventTime, setEventTime] = useState<string>("");
  const [selectedScreens, setSelectedScreens] = useState<string[]>(["PROYECTOR"]);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filter teams based on selected competition
  const filteredTeams = useMemo(() => {
    const leagues = COMPETITION_LEAGUES[competition] || [];
    return teams.filter((team) => leagues.includes(team.league));
  }, [teams, competition]);

  const homeTeam = teams.find((t) => t.id === homeTeamId);
  const awayTeam = teams.find((t) => t.id === awayTeamId);

  const toggleScreen = (screenId: string) => {
    setSelectedScreens((prev) =>
      prev.includes(screenId)
        ? prev.filter((s) => s !== screenId)
        : [...prev, screenId]
    );
  };

  // Reset team selection when competition changes
  const handleCompetitionChange = (newCompetition: string) => {
    setCompetition(newCompetition);
    setHomeTeamId("");
    setAwayTeamId("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!homeTeamId || !awayTeamId || !eventDate || !eventTime) {
      setError("Por favor, completa todos los campos obligatorios");
      return;
    }

    if (homeTeamId === awayTeamId) {
      setError("El equipo local y visitante no pueden ser el mismo");
      return;
    }

    if (selectedScreens.length === 0) {
      setError("Selecciona al menos una pantalla");
      return;
    }

    setIsSaving(true);

    try {
      const dateTime = new Date(`${eventDate}T${eventTime}`);

      const result = await createEvent({
        homeTeamId,
        awayTeamId,
        eventDate: dateTime,
        screens: selectedScreens,
        competition,
      });

      if (result.success) {
        router.push("/admin/eventos");
      } else {
        setError(result.error || "Error al crear el evento");
      }
    } catch (err) {
      setError("Error al crear el evento");
    } finally {
      setIsSaving(false);
    }
  };

  return (
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
        <select
          value={competition}
          onChange={(e) => handleCompetitionChange(e.target.value)}
          className="w-full bg-[#1a1a1a] border border-white/20 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#D4AF37]"
        >
          {COMPETITIONS.map((comp) => (
            <option key={comp} value={comp}>
              {comp}
            </option>
          ))}
        </select>
      </div>

      {/* Team Selection */}
      <div className="grid grid-cols-2 gap-4">
        {/* Home Team */}
        <div className="space-y-2">
          <label className="text-white/70 text-xs font-medium">Equipo Local</label>
          <select
            value={homeTeamId}
            onChange={(e) => setHomeTeamId(e.target.value)}
            className="w-full bg-[#1a1a1a] border border-white/20 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#D4AF37]"
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

        {/* Away Team */}
        <div className="space-y-2">
          <label className="text-white/70 text-xs font-medium">Equipo Visitante</label>
          <select
            value={awayTeamId}
            onChange={(e) => setAwayTeamId(e.target.value)}
            className="w-full bg-[#1a1a1a] border border-white/20 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#D4AF37]"
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

      {/* Match Preview */}
      {homeTeam && awayTeam && (
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
      )}

      {/* Date and Time */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-white/70 text-xs font-medium">Fecha</label>
          <input
            type="date"
            value={eventDate}
            onChange={(e) => setEventDate(e.target.value)}
            className="w-full bg-[#1a1a1a] border border-white/20 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#D4AF37]"
          />
        </div>
        <div className="space-y-2">
          <label className="text-white/70 text-xs font-medium">Hora</label>
          <input
            type="time"
            value={eventTime}
            onChange={(e) => setEventTime(e.target.value)}
            className="w-full bg-[#1a1a1a] border border-white/20 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#D4AF37]"
          />
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
                {selectedScreens.includes(screen.id) && (
                  <Check className="w-4 h-4" />
                )}
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

      {/* Submit Button */}
      <Button
        type="submit"
        disabled={isSaving}
        className="w-full bg-[#D4AF37] hover:bg-[#b8972e] text-black font-semibold py-3"
      >
        <Save className="w-4 h-4 mr-2" />
        {isSaving ? "Guardando..." : "Guardar Evento"}
      </Button>
    </form>
  );
}
