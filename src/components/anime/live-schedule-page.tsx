"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useAppStore } from "./store";

// Reuse same types and helpers from live-page
const defaultSportCategories = [
  { id: "all", label: "All Sports", icon: "🏟️", color: "#ffffff" },
  { id: "football", label: "Football", icon: "⚽", color: "#22c55e" },
  { id: "basketball", label: "Basketball", icon: "🏀", color: "#ef4444" },
  { id: "american-football", label: "NFL", icon: "🏈", color: "#dc2626" },
  { id: "hockey", label: "Hockey", icon: "🏒", color: "#06b6d4" },
  { id: "baseball", label: "Baseball", icon: "⚾", color: "#3b82f6" },
  { id: "tennis", label: "Tennis", icon: "🎾", color: "#a855f7" },
  { id: "fight", label: "MMA/Boxing", icon: "🥊", color: "#f97316" },
  { id: "motor-sports", label: "Motorsport", icon: "🏎️", color: "#eab308" },
  { id: "rugby", label: "Rugby", icon: "🏉", color: "#10b981" },
  { id: "golf", label: "Golf", icon: "⛳", color: "#84cc16" },
  { id: "cricket", label: "Cricket", icon: "🏏", color: "#f59e0b" },
  { id: "other", label: "Other", icon: "📺", color: "#6b7280" },
];

interface ScheduleMatch {
  id: string;
  title: string;
  sport: string;
  sportName: string;
  date: number;
  poster: string;
  popular: boolean;
  homeTeam: string;
  awayTeam: string;
  homeBadge: string;
  awayBadge: string;
  isLive: boolean;
  league?: string;
  leagueLogo?: string;
  homeScore?: number;
  awayScore?: number;
  currentMinute?: string;
}

function getSportColor(sport: string): string {
  const cat = defaultSportCategories.find(c => c.id === sport);
  return cat?.color || "#6b7280";
}

function getSportIcon(sport: string): string {
  const cat = defaultSportCategories.find(c => c.id === sport);
  return cat?.icon || "📺";
}

function formatTimeOnly(timestamp: number): string {
  if (!timestamp) return "";
  return new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDayGroup(timestamp: number): string {
  if (!timestamp) return "Unknown";
  const d = new Date(timestamp);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const isTomorrow = new Date(now.getTime() + 86400000).toDateString() === d.toDateString();
  if (isToday) return "Today";
  if (isTomorrow) return "Tomorrow";
  return d.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" });
}

function toPrimitive(v: any): any {
  if (v === null || v === undefined) return v;
  if (typeof v === "object") {
    if ("value" in v) return toPrimitive(v.value);
    if ("displayValue" in v) return toPrimitive(v.displayValue);
    return undefined;
  }
  return v;
}

function safeStr(v: any): string {
  const p = toPrimitive(v);
  if (p === null || p === undefined) return "";
  if (typeof p === "object") return "";
  return String(p);
}

export default function LiveSchedulePage() {
  const navigate = useAppStore(s => s.navigate);
  const [matches, setMatches] = useState<ScheduleMatch[]>([]);
  const [selectedSport, setSelectedSport] = useState("all");
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedSport !== "all") params.set("sport", selectedSport);
      const res = await fetch(`/api/live?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        const matchList: ScheduleMatch[] = (data.matches || []).map((m: any) => ({ ...m }));
        // Sort by date for schedule
        matchList.sort((a, b) => a.date - b.date);
        setMatches(matchList);
      }
    } catch {}
    setLoading(false);
  }, [selectedSport]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filteredMatches = useMemo(() => {
    if (selectedSport === "all") return matches;
    return matches.filter(m => m.sport === selectedSport);
  }, [matches, selectedSport]);

  // Group by day
  const groupedByDay = useMemo(() => {
    const groups: Record<string, ScheduleMatch[]> = {};
    for (const m of filteredMatches) {
      const key = formatDayGroup(m.date);
      if (!groups[key]) groups[key] = [];
      groups[key].push(m);
    }
    return groups;
  }, [filteredMatches]);

  const handleWatch = (match: ScheduleMatch) => {
    navigate({
      page: "live-watch",
      matchId: match.id,
      matchTitle: safeStr(match.title),
      matchSport: safeStr(match.sport),
      matchSportName: safeStr(match.sportName),
      matchHomeTeam: safeStr(match.homeTeam),
      matchAwayTeam: safeStr(match.awayTeam),
      matchHomeBadge: safeStr(match.homeBadge),
      matchAwayBadge: safeStr(match.awayBadge),
      matchPoster: safeStr(match.poster),
      matchPopular: match.popular,
      matchSources: "[]",
      matchDate: match.date,
      matchApiSource: "",
    } as any);
  };

  return (
    <div className="min-h-screen pb-8 -mx-4 lg:-mx-8">
      {/* Header */}
      <div className="px-4 lg:px-8 pt-6 pb-4">
        <div className="max-w-[1400px] mx-auto">
          <h1 className="text-xl font-black text-white flex items-center gap-3" style={{ fontFamily: "var(--font-space-mono), 'Space Mono', monospace" }}>
            <span className="text-2xl">📅</span> Schedule
          </h1>
          <p className="text-xs text-white/30 mt-1">Upcoming matches and events</p>
        </div>
      </div>

      {/* Sport filter tabs */}
      <div className="px-4 lg:px-8 mb-6">
        <div className="max-w-[1400px] mx-auto">
          <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-2">
            {defaultSportCategories.map(cat => (
              <button
                key={cat.id}
                onClick={() => setSelectedSport(cat.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold whitespace-nowrap transition-all ${
                  selectedSport === cat.id
                    ? "text-white"
                    : "text-white/40 bg-white/[0.03] border border-white/[0.06] hover:text-white/60 hover:bg-white/[0.05]"
                }`}
                style={{
                  ...(selectedSport === cat.id ? {
                    background: `linear-gradient(135deg, ${cat.color}25, ${cat.color}10)`,
                    border: `1px solid ${cat.color}40`,
                    color: cat.color,
                  } : {}),
                  fontFamily: "var(--font-space-mono), 'Space Mono', monospace",
                }}
              >
                <span>{cat.icon}</span> {cat.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 lg:px-8">
        <div className="max-w-[1400px] mx-auto space-y-8">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-8 h-8 border-2 border-[#ffffff] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : Object.keys(groupedByDay).length === 0 ? (
            <div className="text-center py-20">
              <p className="text-white/30 text-sm">No upcoming matches found</p>
            </div>
          ) : (
            Object.entries(groupedByDay).map(([day, dayMatches]) => (
              <div key={day}>
                {/* Day header */}
                <div className="flex items-center gap-3 mb-4">
                  <h2 className="text-sm font-bold text-white" style={{ fontFamily: "var(--font-space-mono), 'Space Mono', monospace" }}>
                    {day}
                  </h2>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/[0.06] text-white/40">
                    {dayMatches.length} {dayMatches.length === 1 ? "match" : "matches"}
                  </span>
                  <div className="flex-1 h-px bg-white/[0.06]" />
                </div>

                {/* Match rows */}
                <div className="space-y-2">
                  {dayMatches.map(match => {
                    const sportColor = getSportColor(match.sport);
                    return (
                      <button
                        key={match.id}
                        onClick={() => handleWatch(match)}
                        className="group w-full flex items-center gap-4 px-4 py-3 rounded-xl border border-white/[0.06] hover:border-white/[0.12] transition-all cursor-pointer text-left"
                        style={{ background: `linear-gradient(135deg, ${sportColor}08, transparent)` }}
                      >
                        {/* Time */}
                        <div className="flex-shrink-0 w-16 text-center">
                          <span className="text-sm font-black text-white/80">{formatTimeOnly(match.date)}</span>
                        </div>

                        {/* Sport icon */}
                        <div
                          className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center"
                          style={{
                            background: `linear-gradient(135deg, ${sportColor}25, ${sportColor}10)`,
                            border: `1px solid ${sportColor}30`,
                          }}
                        >
                          {match.homeBadge ? (
                            <img src={match.homeBadge} alt="" className="w-6 h-6 object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                          ) : (
                            <span className="text-base">{getSportIcon(match.sport)}</span>
                          )}
                        </div>

                        {/* Match info */}
                        <div className="flex-1 min-w-0">
                          <p className="text-[12px] font-bold text-white truncate">{match.title}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            {match.isLive && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-red-600/20 text-red-400 text-[7px] font-black uppercase tracking-wider">
                                <span className="w-1 h-1 rounded-full bg-red-500 animate-pulse" />
                                LIVE
                              </span>
                            )}
                            {match.league && (
                              <span className="text-[9px] text-white/25 font-medium truncate max-w-[150px]">{match.league}</span>
                            )}
                            <span className="text-[9px] text-white/15">{match.sportName}</span>
                          </div>
                        </div>

                        {/* Watch/Remind button */}
                        <div className="flex-shrink-0">
                          {match.isLive ? (
                            <span
                              className="px-4 py-1.5 rounded-lg text-[9px] font-bold uppercase text-white"
                              style={{
                                background: `linear-gradient(135deg, ${sportColor}, ${sportColor}cc)`,
                              }}
                            >
                              Watch Live
                            </span>
                          ) : (
                            <span className="px-4 py-1.5 rounded-lg text-[9px] font-bold uppercase text-white/40 bg-white/[0.04] border border-white/[0.06] group-hover:text-white/60 group-hover:bg-white/[0.06] transition-all">
                              Remind
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
