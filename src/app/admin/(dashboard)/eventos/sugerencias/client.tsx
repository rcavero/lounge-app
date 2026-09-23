"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  RefreshCw,
  Check,
  Loader2,
  Download,
  AlertTriangle,
} from "lucide-react";
import {
  syncTeamsFromAPI,
  getMatchSuggestions,
  createEventFromSuggestion,
} from "@/modules/football-data/actions";
import { COMPETITION_EMBLEM } from "@/modules/football-data/config/competitions";
import type { MatchSuggestion, SyncResult } from "@/modules/football-data/types";

interface SuggestionsClientProps {
  competitions: { code: string; name: string }[];
}

const SCREENS = [
  { id: "TV1", label: "TV1", color: "bg-[#7f1d1d] border-[#b91c1c]" },
  { id: "TV2", label: "TV2", color: "bg-[#1e3a5f] border-[#3b82f6]" },
  { id: "TV3", label: "TV3", color: "bg-[#92700c] border-[#D4AF37]" },
];

function formatDate(utcDate: string): string {
  const d = new Date(utcDate);
  return d.toLocaleDateString("es-ES", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function TeamCrest({
  crest,
  name,
  size = 40,
}: {
  crest: string;
  name: string;
  size?: number;
}) {
  if (!crest) {
    const initials = (name || "?").substring(0, 3).toUpperCase();
    return (
      <div
        className="rounded-full bg-[#2a2a2a] flex items-center justify-center font-bold text-[#D4AF37] text-xs"
        style={{ width: size, height: size }}
      >
        {initials}
      </div>
    );
  }

  return (
    <Image
      src={crest}
      alt={name}
      width={size}
      height={size}
      className="object-contain"
      unoptimized
    />
  );
}

export function SuggestionsClient({ competitions }: SuggestionsClientProps) {
  const [selectedCompetition, setSelectedCompetition] = useState<string>("");
  const [suggestions, setSuggestions] = useState<MatchSuggestion[]>([]);
  const [isLoadingMatches, setIsLoadingMatches] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [expandedMatch, setExpandedMatch] = useState<number | null>(null);
  const [selectedScreens, setSelectedScreens] = useState<string[]>(["TV3"]);
  const [creatingMatchId, setCreatingMatchId] = useState<number | null>(null);
  const [createdMatches, setCreatedMatches] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const handleSync = async () => {
    setIsSyncing(true);
    setSyncResult(null);
    setError(null);
    try {
      const result = await syncTeamsFromAPI();
      setSyncResult(result);
    } catch {
      setError("Error al sincronizar equipos. Inténtalo de nuevo en unos minutos.");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleFetchMatches = async () => {
    setIsLoadingMatches(true);
    setError(null);
    setSuggestions([]);
    try {
      const code = selectedCompetition || undefined;
      const results = await getMatchSuggestions(code);
      setSuggestions(results);
    } catch {
      setError("Error al obtener partidos. Inténtalo de nuevo en unos minutos.");
    } finally {
      setIsLoadingMatches(false);
    }
  };

  const toggleScreen = (screenId: string) => {
    setSelectedScreens((prev) =>
      prev.includes(screenId) ? prev.filter((s) => s !== screenId) : [...prev, screenId],
    );
  };

  const handleCreateEvent = async (suggestion: MatchSuggestion) => {
    if (selectedScreens.length === 0) {
      setError("Selecciona al menos una pantalla");
      return;
    }

    setCreatingMatchId(suggestion.externalMatchId);
    setError(null);

    try {
      const result = await createEventFromSuggestion(suggestion, selectedScreens);
      if (result.success) {
        setCreatedMatches((prev) => new Set([...prev, suggestion.externalMatchId]));
        setExpandedMatch(null);
      } else {
        setError(result.error || "Error al crear el evento");
      }
    } catch {
      setError("Error al crear el evento");
    } finally {
      setCreatingMatchId(null);
    }
  };

  // Group suggestions by competition
  const groupedSuggestions = suggestions.reduce<Record<string, MatchSuggestion[]>>(
    (acc, s) => {
      if (!acc[s.competition]) acc[s.competition] = [];
      acc[s.competition].push(s);
      return acc;
    },
    {},
  );

  return (
    <div className="min-h-screen bg-black flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-black/95 backdrop-blur border-b border-white/10">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <Link
              href="/admin/eventos"
              className="text-white/70 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-white font-semibold text-sm">
                Sugerencias de Partidos
              </h1>
              <p className="text-white/50 text-xs">ESPN API</p>
            </div>
          </div>
          <Button
            size="sm"
            onClick={handleSync}
            disabled={isSyncing}
            className="bg-[#D4AF37] hover:bg-[#b8972e] text-black"
          >
            {isSyncing ? (
              <Loader2 className="w-4 h-4 mr-1 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4 mr-1" />
            )}
            {isSyncing ? "Sincronizando..." : "Sincronizar equipos"}
          </Button>
        </div>
      </header>

      <main className="flex-1 px-4 py-4 max-w-lg mx-auto w-full">
        {/* Sync result */}
        {syncResult && (
          <div className="mb-4 bg-green-500/10 border border-green-500/30 rounded-lg p-3">
            <p className="text-green-400 text-sm">
              Sincronización completada: {syncResult.created} creados,{" "}
              {syncResult.updated} actualizados
              {syncResult.errors.length > 0 && `, ${syncResult.errors.length} errores`}
            </p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mb-4 bg-red-500/10 border border-red-500/30 rounded-lg p-3">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        {/* Competition filter */}
        <div className="mb-4 space-y-3">
          <div className="flex gap-2">
            <select
              value={selectedCompetition}
              onChange={(e) => setSelectedCompetition(e.target.value)}
              className="flex-1 bg-[#1a1a1a] border border-white/20 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#D4AF37]"
            >
              <option value="">Todas las competiciones</option>
              {competitions.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </select>
            <Button
              onClick={handleFetchMatches}
              disabled={isLoadingMatches}
              className="bg-[#D4AF37] hover:bg-[#b8972e] text-black"
            >
              {isLoadingMatches ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
            </Button>
          </div>
        </div>

        {/* Loading state */}
        {isLoadingMatches && (
          <div className="text-center py-12">
            <Loader2 className="w-8 h-8 text-[#D4AF37] mx-auto mb-3 animate-spin" />
            <p className="text-white/50 text-sm">Obteniendo partidos...</p>
          </div>
        )}

        {/* Match suggestions */}
        {!isLoadingMatches && suggestions.length > 0 && (
          <div className="space-y-6">
            {Object.entries(groupedSuggestions).map(([competitionName, matches]) => (
              <div key={competitionName}>
                <h2 className="text-white/70 text-xs font-semibold uppercase tracking-wider mb-2 flex items-center gap-2">
                  {COMPETITION_EMBLEM[competitionName] && (
                    <Image
                      src={COMPETITION_EMBLEM[competitionName]}
                      alt={competitionName}
                      width={20}
                      height={20}
                      className="object-contain"
                      unoptimized
                    />
                  )}
                  {competitionName}
                </h2>
                <div className="space-y-2">
                  {matches.map((match) => {
                    const isCreated = createdMatches.has(match.externalMatchId);
                    const isExpanded = expandedMatch === match.externalMatchId;
                    const isCreating = creatingMatchId === match.externalMatchId;

                    return (
                      <div
                        key={match.externalMatchId}
                        className="bg-[#1a1a1a] rounded-lg border border-white/10 overflow-hidden"
                      >
                        {/* Match row */}
                        <div className="flex items-center gap-3 p-3">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <TeamCrest
                              crest={match.homeTeam.crest}
                              name={match.homeTeam.shortName}
                              size={32}
                            />
                            <span className="text-white text-xs truncate">
                              {match.homeTeam.shortName}
                            </span>
                          </div>

                          <div className="flex flex-col items-center shrink-0">
                            <span className="text-white/40 text-[10px]">
                              {formatDate(match.utcDate)}
                            </span>
                            <span className="text-white/60 text-xs font-bold">vs</span>
                          </div>

                          <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
                            <span className="text-white text-xs truncate text-right">
                              {match.awayTeam.shortName}
                            </span>
                            <TeamCrest
                              crest={match.awayTeam.crest}
                              name={match.awayTeam.shortName}
                              size={32}
                            />
                          </div>

                          {/* Action button */}
                          <div className="shrink-0 ml-1">
                            {isCreated ? (
                              <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center">
                                <Check className="w-4 h-4 text-green-400" />
                              </div>
                            ) : !match.canCreate ? (
                              <div
                                className="w-8 h-8 rounded-full bg-yellow-500/20 flex items-center justify-center"
                                title="Sincroniza equipos primero"
                              >
                                <AlertTriangle className="w-4 h-4 text-yellow-400" />
                              </div>
                            ) : (
                              <button
                                onClick={() =>
                                  setExpandedMatch(
                                    isExpanded ? null : match.externalMatchId,
                                  )
                                }
                                className="w-8 h-8 rounded-full bg-[#D4AF37]/20 flex items-center justify-center hover:bg-[#D4AF37]/30 transition-colors"
                              >
                                <span className="text-[#D4AF37] text-lg leading-none">
                                  +
                                </span>
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Expanded: screen selector */}
                        {isExpanded && match.canCreate && (
                          <div className="border-t border-white/10 p-3 space-y-3">
                            <p className="text-white/50 text-xs">
                              Selecciona las pantallas:
                            </p>
                            <div className="flex gap-2">
                              {SCREENS.map((screen) => (
                                <button
                                  key={screen.id}
                                  type="button"
                                  onClick={() => toggleScreen(screen.id)}
                                  className={`flex-1 py-2 px-2 rounded-lg border-2 text-xs font-semibold transition-all ${
                                    selectedScreens.includes(screen.id)
                                      ? `${screen.color} text-white`
                                      : "bg-transparent border-white/20 text-white/50"
                                  }`}
                                >
                                  <div className="flex items-center justify-center gap-1">
                                    {selectedScreens.includes(screen.id) && (
                                      <Check className="w-3 h-3" />
                                    )}
                                    {screen.label}
                                  </div>
                                </button>
                              ))}
                            </div>
                            <Button
                              size="sm"
                              onClick={() => handleCreateEvent(match)}
                              disabled={isCreating || selectedScreens.length === 0}
                              className="w-full bg-[#D4AF37] hover:bg-[#b8972e] text-black text-xs"
                            >
                              {isCreating ? (
                                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                              ) : null}
                              {isCreating ? "Creando..." : "Confirmar y crear evento"}
                            </Button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!isLoadingMatches && suggestions.length === 0 && (
          <div className="text-center py-16">
            <Download className="w-12 h-12 text-white/30 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">
              Buscar partidos programados
            </h3>
            <p className="text-white/50 text-sm mb-4">
              Selecciona una competición y pulsa el botón de descarga para ver los
              próximos partidos.
            </p>
            <p className="text-white/40 text-xs">
              Asegúrate de sincronizar equipos primero si es la primera vez.
            </p>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="py-4 text-center border-t border-white/10">
        <p className="text-xs text-white/40 tracking-wider">
          THE LOUNGE BEERHOUSE &bull; VALENCIA
        </p>
      </footer>
    </div>
  );
}
