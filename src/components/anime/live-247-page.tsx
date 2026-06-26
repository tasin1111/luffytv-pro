"use client";

import { useState, useEffect, useCallback } from "react";
import { useAppStore } from "./store";

// ============================================================
// 24/7 LIVE CHANNELS PAGE — Always-on streams
// Sources: DamiTV + StreamFree
// Uses API-provided logos from dami-tv.pro
// ============================================================

interface TVChannel {
  id: string;
  name: string;
  category: string;
  sport?: string;
  country: { code: string; name: string; flag: string };
  embedUrl: string;
  source: "damitv" | "streamfree";
  poster?: string;
  logoUrl?: string;
  isLive?: boolean;
  isAlwaysLive?: boolean;
  status?: string;
  league?: string;
  homeTeam?: string;
  awayTeam?: string;
  homeBadge?: string;
  awayBadge?: string;
  streamKey?: string;
  streamCategory?: string;
  viewers?: number;
}

interface CategoryInfo {
  name: string;
  count: number;
}

// Category colors
const CAT_COLORS: Record<string, string> = {
  Sports: "#f97316",
  News: "#3b82f6",
  Entertainment: "#a855f7",
  Kids: "#22c55e",
  Music: "#ec4899",
  Documentary: "#06b6d4",
  Movies: "#eab308",
  General: "#6b7280",
};

// Source colors and labels
const SOURCE_CONFIG: Record<string, { color: string; label: string; shortLabel: string }> = {
  damitv: { color: "#f97316", label: "DamiTV", shortLabel: "DAMI" },
  streamfree: { color: "#a855f7", label: "StreamFree", shortLabel: "SF" },
};

export default function Live247Page() {
  const navigate = useAppStore(s => s.navigate);

  const [channels, setChannels] = useState<TVChannel[]>([]);
  const [categories, setCategories] = useState<CategoryInfo[]>([]);
  const [totalAll, setTotalAll] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Filters
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => setSearchQuery(searchInput), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Fetch channels — get all and filter for 24/7
  const fetchChannels = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.set("search", searchQuery);

      const res = await fetch(`/api/live-tv/channels?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to load channels");
      const data = await res.json();

      // Filter to 24/7 channels only — isAlwaysLive or non-sports categories
      const allChannels: TVChannel[] = data.channels || [];
      const live247Channels = allChannels.filter(ch =>
        ch.isAlwaysLive ||
        ch.category === "Entertainment" ||
        ch.category === "News" ||
        ch.category === "Kids" ||
        ch.category === "Music" ||
        ch.category === "Documentary" ||
        ch.category === "Movies"
      );

      setChannels(live247Channels);
      setTotalAll(live247Channels.length);

      // Compute category counts from 24/7 channels
      const catCounts: Record<string, number> = {};
      for (const ch of live247Channels) {
        catCounts[ch.category] = (catCounts[ch.category] || 0) + 1;
      }
      setCategories(
        Object.entries(catCounts)
          .map(([name, count]) => ({ name, count }))
          .sort((a, b) => b.count - a.count)
      );
    } catch (err: any) {
      setError(err.message || "Failed to load channels");
    } finally {
      setLoading(false);
    }
  }, [searchQuery]);

  useEffect(() => { fetchChannels(); }, [fetchChannels]);

  // Watch channel
  const handleWatch = (channel: TVChannel) => {
    navigate({
      page: "live-tv-watch",
      channelId: channel.id,
      channelName: channel.name,
      channelCategory: channel.category,
      channelStreamCategory: (channel as any).streamCategory || "",
      channelCountryCode: channel.country.code,
      channelCountryName: channel.country.name,
      channelEmbedUrl: channel.embedUrl,
      channelDamitvId: (channel as any).damitvId,
      channelDamitvResolveUrl: (channel as any).damitvResolveUrl || "",
      channelDamitvEmbedUrl: (channel as any).damitvEmbedUrl || "",
    } as any);
  };

  // Filtered channels by category
  const filteredChannels = selectedCategory === "all"
    ? channels
    : channels.filter(ch => ch.category === selectedCategory);

  return (
    <div className="min-h-screen pb-8 -mx-4 lg:-mx-8">
      {/* Header */}
      <div className="px-4 lg:px-8 pt-4 pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1
              className="text-2xl font-black text-white flex items-center gap-2"
              style={{ fontFamily: "var(--font-space-mono), 'Space Mono', monospace" }}
            >
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-green-600/20 text-green-400 text-[10px] font-black uppercase tracking-wider">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                24/7
              </span>
              Live Channels
            </h1>
            <p className="text-white/30 text-xs mt-0.5">
              {totalAll > 0 ? `${totalAll} always-on channels` : "Loading..."}
            </p>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="px-4 lg:px-8 mb-3">
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/25" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search 24/7 channels..."
            className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-white/25 outline-none focus:border-[#ffffff]/40 focus:bg-white/[0.06] transition-all"
            style={{ fontFamily: "var(--font-inter), 'Inter', sans-serif" }}
          />
        </div>
      </div>

      {/* Category Filters */}
      <div className="px-4 lg:px-8 mb-2">
        <div className="flex gap-1.5 overflow-x-auto scrollbar-hide pb-1">
          <button
            onClick={() => setSelectedCategory("all")}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-bold whitespace-nowrap transition-all ${
              selectedCategory === "all"
                ? "bg-green-600/20 text-green-400 border border-green-500/30"
                : "bg-white/[0.03] text-white/40 hover:text-white/60 hover:bg-white/[0.06]"
            }`}
            style={{ fontFamily: "var(--font-space-mono), 'Space Mono', monospace" }}
          >
            All ({totalAll})
          </button>
          {categories.map(cat => {
            const color = CAT_COLORS[cat.name] || CAT_COLORS.General;
            const isActive = selectedCategory === cat.name;
            return (
              <button
                key={cat.name}
                onClick={() => setSelectedCategory(isActive ? "all" : cat.name)}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-bold whitespace-nowrap transition-all ${
                  isActive
                    ? "text-white"
                    : "bg-white/[0.03] text-white/40 hover:text-white/60 hover:bg-white/[0.06]"
                }`}
                style={{
                  ...(isActive ? {
                    background: `linear-gradient(135deg, ${color}25, ${color}10)`,
                    border: `1px solid ${color}35`,
                  } : {}),
                  fontFamily: "var(--font-space-mono), 'Space Mono', monospace",
                }}
              >
                {cat.name} ({cat.count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Channel count */}
      <div className="px-4 lg:px-8 mb-3">
        <p className="text-white/20 text-[10px] font-bold" style={{ fontFamily: "var(--font-space-mono), 'Space Mono', monospace" }}>
          Showing {filteredChannels.length} channels
        </p>
      </div>

      {/* Loading State */}
      {loading && filteredChannels.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <div className="w-12 h-12 rounded-full border-2 border-green-500/30 border-t-green-500 animate-spin" />
          <p className="text-sm text-white/30">Loading 24/7 channels...</p>
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <div className="text-5xl">📺</div>
          <p className="text-sm text-white/40">{error}</p>
          <button
            onClick={fetchChannels}
            className="px-4 py-2 rounded-lg bg-white/[0.06] text-white/50 text-[11px] font-bold hover:bg-white/[0.08]"
          >
            Retry
          </button>
        </div>
      )}

      {/* ── CHANNEL CARDS ── */}
      {!loading && !error && (
        <div className="px-4 lg:px-8">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            {filteredChannels.map(channel => {
              const color = CAT_COLORS[channel.category] || CAT_COLORS.General;
              const srcConfig = SOURCE_CONFIG[channel.source];
              const hasLogo = channel.logoUrl;

              return (
                <button
                  key={channel.id}
                  onClick={() => handleWatch(channel)}
                  className="group relative flex flex-col rounded-xl overflow-hidden transition-all duration-200 hover:scale-[1.02] hover:shadow-xl cursor-pointer border border-white/[0.06] hover:border-white/[0.15] text-left"
                  style={{
                    background: `linear-gradient(145deg, ${color}15, ${color}06, #0d0d12)`,
                  }}
                >
                  {/* Top section — logo area */}
                  <div className="relative h-[110px] sm:h-[120px] flex items-center justify-center overflow-hidden">
                    {channel.poster && (
                      <img
                        src={channel.poster}
                        alt=""
                        className="absolute inset-0 w-full h-full object-cover opacity-30"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                      />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />

                    {/* 24/7 badge top-left */}
                    <div className="absolute top-2 left-2 z-10">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-green-600/80 text-white text-[8px] font-black uppercase tracking-wider shadow-lg">
                        <span className="w-1 h-1 rounded-full bg-white animate-pulse" />
                        24/7
                      </span>
                    </div>

                    {/* Source badge top-right */}
                    <div className="absolute top-2 right-2 z-10">
                      <span
                        className="text-[7px] font-black px-1.5 py-0.5 rounded"
                        style={{
                          background: `${srcConfig.color}20`,
                          color: srcConfig.color,
                        }}
                      >
                        {srcConfig.shortLabel}
                      </span>
                    </div>

                    {/* Center — Channel logo from API or letter avatar */}
                    {hasLogo ? (
                      <div className="relative z-10 flex items-center justify-center">
                        <img
                          src={channel.logoUrl}
                          alt={channel.name}
                          className="w-14 h-14 sm:w-16 sm:h-16 object-contain drop-shadow-lg"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                        />
                      </div>
                    ) : (
                      <div
                        className="relative z-10 w-14 h-14 sm:w-16 sm:h-16 rounded-xl flex items-center justify-center text-xl sm:text-2xl font-black"
                        style={{
                          background: `linear-gradient(135deg, ${color}30, ${color}12)`,
                          border: `1px solid ${color}25`,
                          color,
                        }}
                      >
                        {channel.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>

                  {/* Bottom section — name + meta */}
                  <div className="p-2.5 pt-1.5">
                    <p className="text-[11px] font-bold text-white/85 group-hover:text-white truncate leading-tight">
                      {channel.name}
                    </p>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span
                        className="text-[8px] font-bold px-1.5 py-0.5 rounded"
                        style={{ background: `${color}15`, color: `${color}aa` }}
                      >
                        {channel.category}
                      </span>
                      {channel.country && channel.country.code !== "INT" && (
                        <span className="text-[8px] text-white/20">{channel.country.flag}</span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {filteredChannels.length === 0 && !loading && (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <div className="text-5xl">📺</div>
              <p className="text-sm text-white/40">No 24/7 channels found</p>
              <p className="text-[10px] text-white/20">Try adjusting your search</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
