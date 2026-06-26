"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useAppStore } from "./store";
import Hls from "hls.js";
import { proxifyM3u8, PROXY_BASE } from "@/lib/proxy";

// ============================================================
// LIVE WATCH PAGE — DamiTV + WatchFooty + StreamFree iframe Embed Player
// PRIMARY: DamiTV CDN embed + WatchFooty embed + StreamFree embed
// SECONDARY: StreamFree M3U8 via hls.js (NO DamiTV HLS — removed per user request)
// NO sandbox attribute on iframes — it blocks embeds from loading
// ============================================================

interface StreamInfo {
  id: string;
  streamNo: number;
  language: string;
  hd: boolean;
  m3u8Url: string;
  quality: string;
  source: string;
  viewers?: number;
  provider?: string;
  embedUrl?: string;
  corsEnabled: boolean;
  referer?: string;
  streamType: "m3u8" | "embed";
}

interface LiveWatchProps {
  matchId: string;
  matchTitle: string;
  matchSport: string;
  matchSportName: string;
  matchHomeTeam: string;
  matchAwayTeam: string;
  matchHomeBadge: string;
  matchAwayBadge: string;
  matchPoster: string;
  matchPopular: boolean;
  matchSources: string;
  matchDate: number;
  matchStreamKey?: string;
  matchStreamCategory?: string;
  matchChannelName?: string;
  matchChannelCode?: string;
  matchDamitvId?: string;
  matchDamitvName?: string;
  matchDamitvIds?: string; // JSON array: [{id, name, embed?}]
  matchDamitvEmbedUrl?: string; // Pre-built embed URL from DamiTV API
  matchWatchfootyId?: string;
  matchApiSource?: string;
  matchSportsrcCategory?: string;
  matchSportsrcId?: string;
  matchWatchfootyStreams?: string;
  matchLeague?: string;
  matchLeagueLogo?: string;
  matchHomeScore?: number;
  matchAwayScore?: number;
  matchCurrentMinute?: string;
}

const sportIcons: Record<string, string> = {
  football: "⚽", basketball: "🏀", "american-football": "🏈", hockey: "🏒",
  baseball: "⚾", tennis: "🎾", fight: "🥊", "motor-sports": "🏎️",
  rugby: "🏉", golf: "⛳", cricket: "🏏", billiards: "🎱",
  afl: "🏈", darts: "🎯", other: "📺",
};

const sportColors: Record<string, string> = {
  football: "#22c55e", basketball: "#ef4444", "american-football": "#dc2626", hockey: "#06b6d4",
  baseball: "#3b82f6", tennis: "#a855f7", fight: "#f97316", "motor-sports": "#eab308",
  rugby: "#10b981", golf: "#84cc16", cricket: "#f59e0b", billiards: "#ffffff",
  afl: "#14b8a6", darts: "#f43f5e", other: "#6b7280",
};

const sportNames: Record<string, string> = {
  football: "Football", basketball: "Basketball", "american-football": "American Football",
  hockey: "Hockey", baseball: "Baseball", tennis: "Tennis", fight: "Fight / UFC / Boxing",
  "motor-sports": "Motor Sports", rugby: "Rugby", golf: "Golf", cricket: "Cricket",
  billiards: "Billiards", afl: "AFL", darts: "Darts", other: "Other",
};

function formatMatchTime(timestamp: number): string {
  if (!timestamp) return "";
  const d = new Date(timestamp);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const isTomorrow = new Date(now.getTime() + 86400000).toDateString() === d.toDateString();
  const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (isToday) return `Today, ${time}`;
  if (isTomorrow) return `Tomorrow, ${time}`;
  return d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" }) + `, ${time}`;
}

// ── COUNTDOWN TIMER ──
function CountdownTimer({ targetDate, sportColor }: { targetDate: number; sportColor: string }) {
  const [timeLeft, setTimeLeft] = useState({ d: 0, h: 0, m: 0, s: 0, total: 0 });

  useEffect(() => {
    const update = () => {
      const diff = targetDate - Date.now();
      if (diff <= 0) { setTimeLeft({ d: 0, h: 0, m: 0, s: 0, total: 0 }); return; }
      setTimeLeft({
        d: Math.floor(diff / 86400000),
        h: Math.floor((diff % 86400000) / 3600000),
        m: Math.floor((diff % 3600000) / 60000),
        s: Math.floor((diff % 60000) / 1000),
        total: diff,
      });
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [targetDate]);

  const pad = (n: number) => String(n).padStart(2, "0");

  if (timeLeft.total <= 0) {
    return (
      <div className="flex flex-col items-center gap-3">
        <span className="relative flex h-4 w-4">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-4 w-4 bg-red-500" />
        </span>
        <span className="text-xl font-black text-red-400 animate-pulse">MATCH STARTING!</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <span className="text-[10px] text-white/25 uppercase tracking-[0.2em] font-bold">Kickoff In</span>
      <div className="flex items-center gap-2">
        {timeLeft.d > 0 && (
          <>
            <div className="flex flex-col items-center gap-1">
              <div className="w-14 h-14 rounded-lg flex items-center justify-center text-xl font-black" style={{ background: `${sportColor}20`, color: sportColor }}>{timeLeft.d}</div>
              <span className="text-[8px] text-white/20 uppercase">days</span>
            </div>
            <span className="text-xl font-black text-white/10 -mt-3">:</span>
          </>
        )}
        <div className="flex flex-col items-center gap-1">
          <div className="w-14 h-14 rounded-lg flex items-center justify-center text-xl font-black" style={{ background: `${sportColor}20`, color: sportColor }}>{pad(timeLeft.h)}</div>
          <span className="text-[8px] text-white/20 uppercase">hrs</span>
        </div>
        <span className="text-xl font-black text-white/10 -mt-3">:</span>
        <div className="flex flex-col items-center gap-1">
          <div className="w-14 h-14 rounded-lg flex items-center justify-center text-xl font-black" style={{ background: `${sportColor}20`, color: sportColor }}>{pad(timeLeft.m)}</div>
          <span className="text-[8px] text-white/20 uppercase">min</span>
        </div>
        <span className="text-xl font-black text-white/10 -mt-3">:</span>
        <div className="flex flex-col items-center gap-1">
          <div className="w-14 h-14 rounded-lg flex items-center justify-center text-xl font-black" style={{ background: `${sportColor}20`, color: sportColor }}>{pad(timeLeft.s)}</div>
          <span className="text-[8px] text-white/20 uppercase">sec</span>
        </div>
      </div>
    </div>
  );
}

export default function LiveWatchPage(props: LiveWatchProps) {
  const navigate = useAppStore(s => s.navigate);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const playerContainerRef = useRef<HTMLDivElement>(null);

  const [streams, setStreams] = useState<StreamInfo[]>([]);
  const [activeStream, setActiveStream] = useState<StreamInfo | null>(null);
  const [loadingStreams, setLoadingStreams] = useState(true);
  const [playerState, setPlayerState] = useState<"loading" | "playing" | "error" | "countdown" | "no-stream" | "ready" | "scoreboard">("loading");
  const [playerError, setPlayerError] = useState("");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [showPlayButton, setShowPlayButton] = useState(false); // Embed auto-plays, M3U8 needs click
  const [iframeFailed, setIframeFailed] = useState(false);
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const iframeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [iframeElapsed, setIframeElapsed] = useState(0); // seconds elapsed since iframe started loading
  const iframeElapsedRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Scoreboard live score state ──
  const [scoreboardData, setScoreboardData] = useState<{ homeScore: string; awayScore: string; period: string; clock: string; statusDetail: string } | null>(null);
  const [scoreboardLoading, setScoreboardLoading] = useState(false);

  // ── Match Stats state ──
  const [matchStats, setMatchStats] = useState<any>(null);
  const [matchStatsLoading, setMatchStatsLoading] = useState(false);

  // ── Fetched match data (when page is refreshed directly from URL, props are empty) ──
  const [fetchedMatch, setFetchedMatch] = useState<LiveMatch | null>(null);

  // When props are empty (page refresh/direct URL), fetch match data from API
  useEffect(() => {
    if (!props.matchId) return;
    // Only fetch if we're missing critical data
    if (props.matchHomeTeam && props.matchTitle) return;
    const mid = props.matchId;
    const fetchMatchData = async () => {
      try {
        const res = await fetch(`/api/live`);
        if (!res.ok) return;
        const data = await res.json();
        const match = (data.matches || []).find((m: LiveMatch) => m.id === mid);
        if (match) {
          setFetchedMatch(match);
          // Update the route in the store with the full match data
          const currentRoute = useAppStore.getState().route;
          if (currentRoute.page === "live-watch" && currentRoute.matchId === mid) {
            useAppStore.setState({
              route: {
                ...currentRoute,
                matchTitle: match.title || currentRoute.matchTitle,
                matchSportName: match.sportName || (currentRoute as any).matchSportName,
                matchHomeTeam: match.homeTeam || (currentRoute as any).matchHomeTeam,
                matchAwayTeam: match.awayTeam || (currentRoute as any).matchAwayTeam,
                matchHomeBadge: match.homeBadge || (currentRoute as any).matchHomeBadge,
                matchAwayBadge: match.awayBadge || (currentRoute as any).matchAwayBadge,
                matchPoster: match.poster || (currentRoute as any).matchPoster,
                matchSources: JSON.stringify(match.sources) || (currentRoute as any).matchSources,
                matchDate: match.date || (currentRoute as any).matchDate,
                matchWatchfootyId: match.watchfootyId ? String(match.watchfootyId) : (currentRoute as any).matchWatchfootyId,
                matchApiSource: match.apiSource || (currentRoute as any).matchApiSource,
                matchWatchfootyStreams: match.watchfootyStreams ? JSON.stringify(match.watchfootyStreams) : (currentRoute as any).matchWatchfootyStreams,
                matchLeague: match.league || (currentRoute as any).matchLeague,
                matchLeagueLogo: match.leagueLogo || (currentRoute as any).matchLeagueLogo,
                matchHomeScore: toVal(match.homeScore) ?? (currentRoute as any).matchHomeScore,
                matchAwayScore: toVal(match.awayScore) ?? (currentRoute as any).matchAwayScore,
                matchCurrentMinute: toVal(match.currentMinute) || (currentRoute as any).matchCurrentMinute,
                matchStreamKey: match.streamKey || (currentRoute as any).matchStreamKey,
                matchStreamCategory: match.streamCategory || (currentRoute as any).matchStreamCategory,
                matchDamitvId: match.damitvId || (currentRoute as any).matchDamitvId,
                matchDamitvName: match.damitvName || (currentRoute as any).matchDamitvName,
                matchDamitvIds: match.damitvIds ? JSON.stringify(match.damitvIds) : (currentRoute as any).matchDamitvIds,
                matchSportsrcCategory: match.sportsrcCategory || (currentRoute as any).matchSportsrcCategory,
                matchSportsrcId: match.sportsrcId || (currentRoute as any).matchSportsrcId,
                matchChannelName: match.channelName || (currentRoute as any).matchChannelName,
                matchChannelCode: match.channelCode || (currentRoute as any).matchChannelCode,
              } as any,
            });
          }
        }
      } catch {}
    };
    fetchMatchData();
  }, [props.matchId]);

  const sportIcon = sportIcons[props.matchSport || fetchedMatch?.sport || "other"] || "📺";
  const sportColor = sportColors[props.matchSport || fetchedMatch?.sport || "other"] || "#6b7280";
  const isUpcoming = (props.matchDate || fetchedMatch?.date) ? (props.matchDate || fetchedMatch?.date || 0) > Date.now() : false;
  const matchTime = (props.matchDate || fetchedMatch?.date) ? formatMatchTime(props.matchDate || fetchedMatch?.date || 0) : "";
  const hasTeams = props.matchHomeTeam || props.matchAwayTeam || fetchedMatch?.homeTeam || fetchedMatch?.awayTeam;
  const isEmbedStream = activeStream?.streamType === "embed";

  // ── SAFETY HELPERS (must be defined BEFORE use) ──
  // Safely handle API values that might be objects like {value, displayValue}
  // NOTE: Do NOT restrict by key count — WatchFooty objects can have extra keys
  const toVal = (v: any): any => {
    if (v === null || v === undefined) return undefined;
    if (typeof v === "object" && v !== null) {
      if ("value" in v) return toVal(v.value);
      if ("displayValue" in v) return toVal(v.displayValue);
      return undefined;
    }
    return v;
  };
  // Safe string conversion for JSX rendering — NEVER render objects as React children
  const safeStr = (v: any): string => {
    const val = toVal(v);
    if (val === null || val === undefined) return "";
    if (typeof val === "object") return ""; // Final safety net
    return String(val);
  };

  // Use fetched match data as fallback when props are empty (page refresh)
  // ALL values go through safeStr() to prevent React error #31 from {value, displayValue} objects
  const _homeTeam = safeStr(props.matchHomeTeam || fetchedMatch?.homeTeam);
  const _awayTeam = safeStr(props.matchAwayTeam || fetchedMatch?.awayTeam);
  const _homeBadge = safeStr(props.matchHomeBadge || fetchedMatch?.homeBadge);
  const _awayBadge = safeStr(props.matchAwayBadge || fetchedMatch?.awayBadge);
  const _title = safeStr(props.matchTitle || fetchedMatch?.title);
  const _poster = safeStr(props.matchPoster || fetchedMatch?.poster);
  const _sport = safeStr(props.matchSport || fetchedMatch?.sport) || "other";
  const _sportName = safeStr(props.matchSportName || fetchedMatch?.sportName);
  const _league = safeStr(props.matchLeague || fetchedMatch?.league);
  const _leagueLogo = safeStr(props.matchLeagueLogo || fetchedMatch?.leagueLogo);

  // WatchFooty score data from props (with fetched fallback)
  const wfHomeScore = toVal(props.matchHomeScore ?? fetchedMatch?.homeScore);
  const wfAwayScore = toVal(props.matchAwayScore ?? fetchedMatch?.awayScore);
  const wfCurrentMinute = toVal(props.matchCurrentMinute || fetchedMatch?.currentMinute);
  const wfLeague = _league;
  const wfLeagueLogo = _leagueLogo;
  const hasWfScore = wfHomeScore !== undefined && wfAwayScore !== undefined;

  // Computed best available scores (WatchFooty props > matchStats > ESPN scoreboardData)
  const bestHomeScore = hasWfScore ? String(wfHomeScore) : (matchStats?.details?.scores?.home ? safeStr(matchStats.details.scores.home) : scoreboardData?.homeScore ?? null);
  const bestAwayScore = hasWfScore ? String(wfAwayScore) : (matchStats?.details?.scores?.away ? safeStr(matchStats.details.scores.away) : scoreboardData?.awayScore ?? null);
  const bestMinute = wfCurrentMinute ? String(wfCurrentMinute) : (matchStats?.details?.currentMinute ? safeStr(matchStats.details.currentMinute) : scoreboardData?.clock || null);
  const hasAnyScore = bestHomeScore !== null && bestAwayScore !== null;

  // Parse WatchFooty streams from props
  const wfStreamsFromProps = useMemo(() => {
    if (!props.matchWatchfootyStreams) return [];
    try {
      const parsed = JSON.parse(props.matchWatchfootyStreams);
      return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
  }, [props.matchWatchfootyStreams]);

  // ── Normalize team name for cross-provider matching ──
  const normalizeTeam = (name: string): string => {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9 ]/g, "")
      .replace(/\bman\b/g, "manchester")
      .replace(/\bunited\b/g, "utd")
      .replace(/\bwolverhampton\b/g, "wolves")
      .replace(/\btottenham\b/g, "spurs")
      .replace(/\bfc\b/g, "")
      .replace(/\bsc\b/g, "")
      .replace(/\bafc\b/g, "")
      .trim();
  };

  // Fetch stream URLs from our resolver API + individual provider routes
  useEffect(() => {
    if (!props.matchId) return;
    const fetchStreams = async () => {
      setLoadingStreams(true);
      try {
        // ── CROSS-PROVIDER FALLBACK ──
        // If matchSources is empty or "[]", fetch from /api/live and find matches
        // with the same team names, then use their sources
        let effectiveSources = props.matchSources || "";
        let effectiveWatchfootyId = props.matchWatchfootyId || "";
        let effectiveDamitvId = props.matchDamitvId || "";
        let effectiveDamitvName = props.matchDamitvName || "";
        let effectiveDamitvIds = props.matchDamitvIds || ""; // JSON array of multiple DamiTV IDs
        let effectiveStreamKey = props.matchStreamKey || "";
        let effectiveStreamCategory = props.matchStreamCategory || "";
        let effectiveChannelCode = props.matchChannelCode || "";
        let effectiveSportsrcCategory = props.matchSportsrcCategory || "";
        let effectiveSportsrcId = props.matchSportsrcId || "";

        const parsedMatchSources = (() => {
          try { const p = JSON.parse(effectiveSources); return Array.isArray(p) ? p : []; } catch { return []; }
        })();

        if (parsedMatchSources.length === 0) {
          // No sources in props — try cross-provider lookup
          try {
            const liveRes = await fetch("/api/live");
            if (liveRes.ok) {
              const liveData = await liveRes.json();
              const allMatches = liveData.matches || [];
              const homeNorm = normalizeTeam(props.matchHomeTeam || "");
              const awayNorm = normalizeTeam(props.matchAwayTeam || "");

              for (const m of allMatches) {
                const mHomeNorm = normalizeTeam(m.homeTeam || "");
                const mAwayNorm = normalizeTeam(m.awayTeam || "");
                // Check if teams match (same or swapped, with partial matching)
                const teamsMatch = (homeNorm && awayNorm) &&
                  ((mHomeNorm === homeNorm && mAwayNorm === awayNorm) ||
                   (mHomeNorm === awayNorm && mAwayNorm === homeNorm) ||
                   ((homeNorm.includes(mHomeNorm) || mHomeNorm.includes(homeNorm)) &&
                    (awayNorm.includes(mAwayNorm) || mAwayNorm.includes(awayNorm))));

                if (teamsMatch) {
                  // Found a match with sources! Use them.
                  if (m.sources && m.sources.length > 0) {
                    effectiveSources = JSON.stringify(m.sources);
                  }
                  // Also fill in other missing IDs — BUT only merge provider-specific IDs
                  // from their own source to prevent DamiTV/StreamFree showing everywhere
                  if (!effectiveWatchfootyId && m.watchfootyId && m.apiSource === "watchfooty") effectiveWatchfootyId = String(m.watchfootyId);
                  if (!effectiveDamitvId && m.damitvId && m.apiSource === "damitv") { effectiveDamitvId = m.damitvId; effectiveDamitvName = m.damitvName || m.title || ""; }
                  // Also pick up damitvIds array (multiple DamiTV channels for same match)
                  if (m.damitvIds && m.damitvIds.length > 0) { effectiveDamitvIds = JSON.stringify(m.damitvIds); }
                  if (!effectiveStreamKey && m.streamKey && m.apiSource === "streamfree") effectiveStreamKey = m.streamKey;
                  if (!effectiveStreamCategory && m.streamCategory && m.apiSource === "streamfree") effectiveStreamCategory = m.streamCategory;
                  if (!effectiveChannelCode && m.channelCode) effectiveChannelCode = m.channelCode;
                  if (!effectiveSportsrcCategory && m.sportsrcCategory && m.apiSource === "sportsembed") effectiveSportsrcCategory = m.sportsrcCategory;
                  if (!effectiveSportsrcId && m.sportsrcId && m.apiSource === "sportsembed") effectiveSportsrcId = m.sportsrcId;
                  break; // Use first matching match
                }
              }
            }
          } catch {}
        }

        // WatchFooty streams — HIGH PRIORITY (direct embed URLs, reliable)
        const wfStreams: StreamInfo[] = wfStreamsFromProps
          .filter((s: any) => s.url && !s.isRedirect)
          .map((s: any, i: number) => ({
            id: `wf-direct-${s.id || i}`,
            streamNo: i + 1,
            language: s.language || "english",
            hd: s.quality === "hd",
            m3u8Url: "",
            quality: s.quality === "hd" ? "720p" : "480p",
            source: `WatchFooty ${s.language || ""} ${s.quality || ""}`.trim(),
            viewers: 0,
            provider: "watchfooty",
            embedUrl: s.url,
            corsEnabled: false,
            referer: "https://watchfooty.st/",
            streamType: "embed" as const,
          }));

        // DamiTV pre-built embed URL — HIGHEST PRIORITY (direct from API, most reliable)
        const damiApiStreams: StreamInfo[] = [];
        if (props.matchDamitvEmbedUrl) {
          damiApiStreams.push({
            id: `dami-api-direct`,
            streamNo: 1,
            language: "English",
            hd: true,
            m3u8Url: "",
            quality: "720p",
            source: "DamiTV",
            viewers: 0,
            provider: "damitv",
            embedUrl: props.matchDamitvEmbedUrl,
            corsEnabled: false,
            referer: "https://dami-tv.pro/",
            streamType: "embed" as const,
          });
        }

        // Fetch from main resolver API (DamiTV PRIMARY, then StreamFree, WatchFooty, SportsEmbed)
        const params = new URLSearchParams();
        params.set("matchId", props.matchId);
        params.set("provider", props.matchApiSource || "");
        // PASS TEAM NAMES so the server can search providers by teams when sources are missing
        if (_homeTeam) params.set("homeTeam", _homeTeam);
        if (_awayTeam) params.set("awayTeam", _awayTeam);
        if (_sport) params.set("sport", _sport);
        if (effectiveStreamKey) params.set("streamKey", effectiveStreamKey);
        if (effectiveStreamCategory) params.set("streamCategory", effectiveStreamCategory);
        if (props.matchChannelName) params.set("channelName", props.matchChannelName);
        if (effectiveChannelCode) params.set("channelCode", effectiveChannelCode);
        if (effectiveDamitvId) params.set("damitvId", effectiveDamitvId);
        if (effectiveDamitvName) params.set("damitvName", effectiveDamitvName);
        if (effectiveDamitvIds) params.set("damitvIds", effectiveDamitvIds);
        if (effectiveWatchfootyId) params.set("watchfootyId", effectiveWatchfootyId);
        if (effectiveSources) params.set("sources", effectiveSources);
        if (effectiveSportsrcCategory) params.set("sportsrcCategory", effectiveSportsrcCategory);
        if (effectiveSportsrcId) params.set("sportsrcId", effectiveSportsrcId);

        const res = await fetch(`/api/live/embed?${params.toString()}`);
        let resolverStreams: StreamInfo[] = [];
        if (res.ok) {
          const data = await res.json();
          if (data.streams?.length > 0) {
            resolverStreams = data.streams;
          }
        }

        // ALSO fetch from individual provider routes
        // ONLY for providers that the match actually has — don't fetch providers
        // that don't have this match (prevents showing broken/non-working streams)
        let providerStreams: StreamInfo[] = [];
        try {
          const matchSources: { source: string; id: string }[] = effectiveSources
            ? (() => { try { const p = JSON.parse(effectiveSources); return Array.isArray(p) ? p : []; } catch { return []; } })()
            : [];
          // ONLY use sources that the match actually has — no fallback to all providers
          const spSourceIds = matchSources.filter(s => s.source && s.id);
          if (spSourceIds.length > 0) {
            // ONLY call provider routes for providers that have this match
            const providerFetches = spSourceIds.map(async (src) => {
              try {
                const prov = src.source.toLowerCase();
                const streamId = src.id;
                const category = effectiveStreamCategory || effectiveSportsrcCategory || "sports";
                const provRes = await fetch(`/api/stream/${prov}/${encodeURIComponent(streamId)}?category=${encodeURIComponent(category)}`);
                if (provRes.ok) {
                  const provData = await provRes.json();
                  return Array.isArray(provData.streams) ? provData.streams : [];
                }
              } catch {}
              return [];
            });
            const providerResults = await Promise.all(providerFetches);
            providerStreams = providerResults.flat();
          }
        } catch {}

        // Merge: DamiTV API embed (highest), WatchFooty (high), then resolver + provider routes
        const allStreams = [...damiApiStreams, ...wfStreams, ...resolverStreams, ...providerStreams];

        // Deduplicate by embedUrl / m3u8Url
        const seen = new Set<string>();
        const uniqueStreams = allStreams.filter(s => {
          const key = s.streamType === "m3u8" && s.m3u8Url ? s.m3u8Url : (s.embedUrl || s.id);
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });

        // Sort: DamiTV CDN embeds first, WatchFooty second, StreamedPK third, other embeds, M3U8 last
        const providerPriority: Record<string, number> = { damitv: 1, watchfooty: 2, streamedpk: 3 };
        uniqueStreams.sort((a, b) => {
          // Provider priority: DamiTV > WatchFooty > StreamedPK > others
          const aPrio = providerPriority[a.provider || ""] || 99;
          const bPrio = providerPriority[b.provider || ""] || 99;
          if (aPrio !== bPrio) return aPrio - bPrio;
          // Within same provider: embed before M3U8
          if (a.streamType === "embed" && b.streamType !== "embed") return -1;
          if (a.streamType !== "embed" && b.streamType === "embed") return 1;
          // Then by CORS
          if (a.corsEnabled && !b.corsEnabled) return -1;
          if (!a.corsEnabled && b.corsEnabled) return 1;
          return 0;
        });

        if (uniqueStreams.length > 0) {
          setStreams(uniqueStreams);
          // Prefer DamiTV or any embed, then M3U8
          const embedStream = uniqueStreams.find((s: StreamInfo) => s.streamType === "embed" && s.embedUrl);
          const corsStream = uniqueStreams.find((s: StreamInfo) => s.streamType === "m3u8" && s.m3u8Url && s.corsEnabled);
          const m3u8Stream = uniqueStreams.find((s: StreamInfo) => s.streamType === "m3u8" && s.m3u8Url);
          const best = embedStream || corsStream || m3u8Stream || uniqueStreams[0];
          setActiveStream(best);
        } else if (wfStreams.length === 0 && resolverStreams.length === 0 && providerStreams.length === 0) {
          // No streams at all
          if (isUpcoming) setPlayerState("countdown");
          else if (hasTeams) setPlayerState("scoreboard");
          else setPlayerState("error");
        }
      } catch (err) {
        console.error("Failed to fetch streams:", err);
      }
      setLoadingStreams(false);
    };
    fetchStreams();
  }, [props.matchId, props.matchSources, retryCount, wfStreamsFromProps]);

  // When activeStream changes, prepare the player
  // Iframe elapsed time tracker
  useEffect(() => {
    if (iframeLoaded || iframeFailed || !isEmbedStream) {
      setIframeElapsed(0);
      if (iframeElapsedRef.current) {
        clearInterval(iframeElapsedRef.current);
        iframeElapsedRef.current = null;
      }
      return;
    }

    setIframeElapsed(0);
    iframeElapsedRef.current = setInterval(() => {
      setIframeElapsed(prev => prev + 1);
    }, 1000);

    return () => {
      if (iframeElapsedRef.current) {
        clearInterval(iframeElapsedRef.current);
        iframeElapsedRef.current = null;
      }
    };
  }, [activeStream, iframeLoaded, iframeFailed, isEmbedStream]);

  useEffect(() => {
    // Reset iframe failure state on stream switch
    setIframeFailed(false);
    setIframeLoaded(false);
    setIframeElapsed(0);
    if (iframeTimeoutRef.current) {
      clearTimeout(iframeTimeoutRef.current);
      iframeTimeoutRef.current = null;
    }

    // For embed streams, auto-play in iframe (no click needed)
    if (activeStream?.streamType === "embed" && activeStream?.embedUrl) {
      setPlayerState("playing");
      setShowPlayButton(false);
      // Add a 20s timeout for embed iframes — if not loaded by then, try next stream
      // DamiTV especially can hang forever, so we need a fallback
      iframeTimeoutRef.current = setTimeout(() => {
        if (!iframeLoaded) {
          console.log(`Iframe timeout for ${activeStream.provider} — trying next stream`);
          // Try next stream in the list
          const currentIdx = streams.findIndex(s => s.id === activeStream.id);
          const nextStream = streams.find((s, i) => i > currentIdx && s.streamType === "embed" && s.embedUrl);
          if (nextStream) {
            setActiveStream(nextStream);
          } else {
            // No more embed streams — try M3U8 or show scoreboard
            const m3u8Stream = streams.find(s => s.streamType === "m3u8" && s.m3u8Url);
            if (m3u8Stream) {
              setActiveStream(m3u8Stream);
            } else if (hasTeams) {
              setIframeFailed(true);
              setPlayerState("scoreboard");
            } else {
              setIframeFailed(true);
              setPlayerState("error");
              setPlayerError("Stream failed to load. Try a different server.");
            }
          }
        }
      }, 20000);
      return;
    }

    if (!activeStream?.m3u8Url) {
      if (isUpcoming) setPlayerState("countdown");
      else setPlayerState("scoreboard"); // Show scoreboard instead of plain "no stream"
      return;
    }

    // For M3U8 streams, show play button first
    setShowPlayButton(true);
    setPlayerState("ready");
  }, [activeStream]);

  // ── Fetch Match Stats from WatchFooty ──
  useEffect(() => {
    const wfId = props.matchWatchfootyId;
    if (!wfId) return;

    const fetchStats = async () => {
      setMatchStatsLoading(true);
      try {
        const res = await fetch(`/api/match-stats?id=${encodeURIComponent(wfId)}`);
        if (res.ok) {
          const data = await res.json();
          setMatchStats(data);
          // Update scores from match details if available
          if (data?.details?.scores) {
            const homeScore = toVal(data.details.scores.home);
            const awayScore = toVal(data.details.scores.away);
            if (homeScore !== undefined && awayScore !== undefined && !hasWfScore) {
              setScoreboardData(prev => ({
                homeScore: String(homeScore),
                awayScore: String(awayScore),
                period: safeStr(data.details.currentMinute) || prev?.period || "",
                clock: data.details.currentMinute ? `${safeStr(data.details.currentMinute)}'` : prev?.clock || "",
                statusDetail: safeStr(data.details.status) || prev?.statusDetail || "",
              }));
            }
          }
          // Also try extracting team info from matchStats if not available in props
          if (data?.details?.homeTeam && !props.matchHomeTeam) {
            // matchStats has team data that props don't — useful for scoreboard overlay
          }
        }
      } catch {}
      setMatchStatsLoading(false);
    };

    fetchStats();
    const iv = setInterval(fetchStats, 60000); // Refresh every 60s
    return () => clearInterval(iv);
  }, [props.matchWatchfootyId]);

  // ── Fetch ESPN live score (always when team names are available) ──
  useEffect(() => {
    if (!_homeTeam && !_awayTeam) return;

    const fetchScore = async () => {
      setScoreboardLoading(true);
      try {
        // Map our sport to ESPN sport/league
        const espnMap: Record<string, { sport: string; league: string }[]> = {
          basketball: [{ sport: "basketball", league: "nba" }],
          "american-football": [{ sport: "football", league: "nfl" }],
          football: [{ sport: "soccer", league: "eng.1" }, { sport: "soccer", league: "usa.1" }, { sport: "soccer", league: "uefa.champions" }],
          hockey: [{ sport: "hockey", league: "nhl" }],
          baseball: [{ sport: "baseball", league: "mlb" }],
        };

        const leagues = espnMap[_sport] || [];
        let found = false;

        for (const { sport, league } of leagues) {
          try {
            const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/${sport}/${league}/scoreboard`);
            if (!res.ok) continue;
            const data = await res.json();

            for (const event of data.events || []) {
              const comp = event.competitions?.[0];
              if (!comp) continue;

              const home = comp.competitors?.find((c: any) => c.homeAway === "home");
              const away = comp.competitors?.find((c: any) => c.homeAway === "away");

              const homeName = home?.team?.displayName || "";
              const awayName = away?.team?.displayName || "";

              // Match by team name similarity (use fallback team names for page refresh)
              const homeMatch = homeName && _homeTeam &&
                (homeName.toLowerCase().includes(_homeTeam.toLowerCase()) ||
                 _homeTeam.toLowerCase().includes(homeName.toLowerCase()));
              const awayMatch = awayName && _awayTeam &&
                (awayName.toLowerCase().includes(_awayTeam.toLowerCase()) ||
                 _awayTeam.toLowerCase().includes(awayName.toLowerCase()));

              if (homeMatch || awayMatch || (homeMatch && awayMatch)) {
                const statusDetail = comp.status?.type?.detail || "";
                const period = comp.status?.period ? `Period ${comp.status.period}` : "";
                const clock = comp.status?.displayClock || "";

                setScoreboardData({
                  homeScore: home?.score || "0",
                  awayScore: away?.score || "0",
                  period,
                  clock,
                  statusDetail,
                });
                found = true;
                break;
              }
            }
            if (found) break;
          } catch { continue; }
        }
      } catch {}
      setScoreboardLoading(false);
    };

    fetchScore();
    // Refresh score every 30 seconds
    const iv = setInterval(fetchScore, 30000);
    return () => clearInterval(iv);
  }, [_sport, _homeTeam, _awayTeam]);

  const switchStream = useCallback((stream: StreamInfo) => {
    setActiveStream(stream);
    setShowPlayButton(true);
  }, []);

  // Start M3U8 playback
  const startM3U8Playback = useCallback(() => {
    if (!activeStream?.m3u8Url || !videoRef.current) return;
    const m3u8Url = activeStream.m3u8Url;

    setPlayerState("loading");
    setPlayerError("");

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        xhrSetup: (xhr, url) => {
          if (activeStream.referer) {
            xhr.setRequestHeader("Referer", activeStream.referer);
          }
        },
      });
      hlsRef.current = hls;

      const useProxy = !activeStream.corsEnabled;
      // Prefer Cloudflare Worker (handles Referer automatically via REFERER_MAP)
      // Fall back to legacy /api/live/proxy/<url> route if PROXY_BASE not set.
      const finalUrl = useProxy
        ? (PROXY_BASE
            ? proxifyM3u8(m3u8Url)
            : `/api/live/proxy/${m3u8Url}?referer=${encodeURIComponent(activeStream.referer || "")}`)
        : m3u8Url;

      hls.loadSource(finalUrl);
      hls.attachMedia(videoRef.current);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        videoRef.current?.play().catch(() => {});
        setPlayerState("playing");
        setShowPlayButton(false);
      });

      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          if (useProxy && data.type === Hls.ErrorTypes.NETWORK_ERROR) {
            console.log("Proxy failed, trying direct M3U8...");
            hls.destroy();
            hlsRef.current = null;

            const hls2 = new Hls({
              enableWorker: true,
              lowLatencyMode: true,
              xhrSetup: (xhr, url) => {
                if (activeStream.referer) xhr.setRequestHeader("Referer", activeStream.referer);
              },
            });
            hlsRef.current = hls2;
            hls2.loadSource(m3u8Url);
            hls2.attachMedia(videoRef.current!);

            hls2.on(Hls.Events.MANIFEST_PARSED, () => {
              videoRef.current?.play().catch(() => {});
              setPlayerState("playing");
              setShowPlayButton(false);
            });

            hls2.on(Hls.Events.ERROR, (_e2, data2) => {
              if (data2.fatal) {
                // M3U8 failed - auto-switch to embed if available, else show scoreboard
                const embedStream = streams.find(s => s.streamType === "embed" && s.embedUrl);
                if (embedStream) {
                  switchStream(embedStream);
                } else if (hasTeams) {
                  setPlayerState("scoreboard");
                } else {
                  setPlayerState("error");
                  setPlayerError("Stream failed to load. Try a different server.");
                }
              }
            });
            return;
          }
          // M3U8 fatal error - auto-switch to embed if available, else show scoreboard
          const embedStream = streams.find(s => s.streamType === "embed" && s.embedUrl);
          if (embedStream) {
            switchStream(embedStream);
          } else if (hasTeams) {
            setPlayerState("scoreboard");
          } else {
            setPlayerState("error");
            setPlayerError("Stream failed to load. Try a different server.");
          }
        }
      });
    } else if (videoRef.current.canPlayType("application/vnd.apple.mpegurl")) {
      const useProxy = !activeStream.corsEnabled;
      const finalUrl = useProxy
        ? (PROXY_BASE
            ? proxifyM3u8(m3u8Url)
            : `/api/live/proxy/${m3u8Url}?referer=${encodeURIComponent(activeStream.referer || "")}`)
        : m3u8Url;
      videoRef.current.src = finalUrl;
      videoRef.current.addEventListener("loadedmetadata", () => {
        videoRef.current?.play().catch(() => {});
        setPlayerState("playing");
        setShowPlayButton(false);
      });
    }
  }, [activeStream]);

  // Cleanup HLS on unmount
  useEffect(() => {
    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, []);

  // Handle play button click
  const handlePlayClick = () => {
    setShowPlayButton(false);
    if (activeStream?.m3u8Url) {
      // For M3U8: start HLS playback
      startM3U8Playback();
    }
  };

  const toggleFullscreen = async () => {
    if (!playerContainerRef.current) return;
    if (!document.fullscreenElement) {
      await playerContainerRef.current.requestFullscreen();
      setIsFullscreen(true);
    } else {
      await document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  const newTabUrl = activeStream?.embedUrl || (props.matchStreamKey && props.matchStreamCategory
    ? `https://streamfree.app/player/${props.matchStreamCategory}/${props.matchStreamKey}`
    : "");

  return (
    <div className="min-h-screen flex flex-col overflow-hidden">
      {/* ── PLAYER AREA ── */}
      <div
        ref={playerContainerRef}
        className="relative w-full bg-black overflow-hidden"
        style={{ height: isFullscreen ? "100vh" : "90vh", minHeight: "600px", maxHeight: isFullscreen ? "100vh" : "calc(100vh - 20px)" }}
      >
        {/* Video element for hls.js (M3U8 streams) */}
        {!isEmbedStream && (
          <video
            ref={videoRef}
            className="absolute inset-0 w-full h-full"
            style={{ zIndex: playerState === "playing" ? 10 : 0 }}
            playsInline
            controls
            autoPlay
          />
        )}

        {/* Iframe for embed streams — NO sandbox attribute (it blocks embeds from loading) */}
        {isEmbedStream && activeStream?.embedUrl && playerState === "playing" && !iframeFailed && (
          <iframe
            src={activeStream.embedUrl}
            title="Live Stream Player"
            className="absolute inset-0 w-full h-full border-0"
            style={{ zIndex: 15 }}
            marginWidth={0}
            marginHeight={0}
            scrolling="no"
            frameBorder={0}
            allowFullScreen
            allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
            referrerPolicy="no-referrer-when-downgrade"
            onLoad={() => {
              setIframeLoaded(true);
              // Clear timeout since iframe loaded successfully
              if (iframeTimeoutRef.current) {
                clearTimeout(iframeTimeoutRef.current);
                iframeTimeoutRef.current = null;
              }
            }}
            onError={() => {
              setIframeFailed(true);
              setPlayerState("scoreboard");
            }}
          />
        )}

        {/* Play button overlay — only for M3U8 streams, not embeds */}
        {showPlayButton && !isEmbedStream && activeStream && (playerState === "ready" || playerState === "loading") && (
          <div
            className="absolute inset-0 flex items-center justify-center z-25 cursor-pointer"
            style={{ zIndex: 25 }}
            onClick={handlePlayClick}
          >
            {/* Dark overlay */}
            <div className="absolute inset-0 bg-black/60" />
            {/* Play button */}
            <div className="relative z-10 flex flex-col items-center gap-4">
              <div
                className="w-20 h-20 rounded-full flex items-center justify-center transition-all duration-300 hover:scale-110"
                style={{
                  background: `linear-gradient(135deg, ${sportColor}dd, ${sportColor}99)`,
                  boxShadow: `0 0 40px ${sportColor}40, 0 0 80px ${sportColor}20`,
                }}
              >
                <svg className="w-10 h-10 text-white ml-1" viewBox="0 0 24 24" fill="currentColor">
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
              </div>
              <div className="text-center">
                <p className="text-white font-bold text-lg" style={{ fontFamily: "var(--font-space-mono), 'Space Mono', monospace" }}>Click to Play</p>
                <p className="text-white/40 text-xs mt-1">
                  {isEmbedStream ? `Embed Player • ${activeStream?.source || 'Stream'}` : `HLS Player • ${activeStream?.quality || 'HD'}`}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Loading overlay — M3U8 loading or embed iframe loading */}
        {(playerState === "loading" || (isEmbedStream && !iframeLoaded && !iframeFailed && playerState === "playing")) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black z-20">
            {/* Spinner with progress ring */}
            <div className="relative">
              <div className="w-16 h-16 rounded-full border-3 border-white/10 border-t-[#ffffff] animate-spin" />
              {/* Progress arc — 20s max for embed, indeterminate for M3U8 */}
              {isEmbedStream && (
                <svg className="absolute inset-0 w-16 h-16 -rotate-90" viewBox="0 0 64 64">
                  <circle
                    cx="32" cy="32" r="28"
                    fill="none"
                    stroke="#ffffff"
                    strokeWidth="2"
                    strokeDasharray={`${Math.min(iframeElapsed / 20, 1) * 176} 176`}
                    strokeLinecap="round"
                    className="transition-all duration-1000"
                  />
                </svg>
              )}
            </div>

            {/* Source-specific loading message */}
            <div className="text-center">
              <p className="text-sm font-bold text-white/60">
                {activeStream?.provider === "damitv" ? `Loading DamiTV CDN...` :
                 activeStream?.provider === "streamfree" ? "Loading StreamFree..." :
                 activeStream?.provider === "watchfooty" ? "Loading WatchFooty..." :
                 activeStream?.provider === "embedsports" ? "Loading EmbedSports..." :
                 activeStream?.provider === "streamedpk" ? "Loading StreamedPK..." :
                 activeStream?.provider === "sportsembed" ? "Loading SportsEmbed..." :
                 "Loading stream..."}
              </p>
              <p className="text-[11px] text-white/30 mt-1">
                {activeStream?.provider === "damitv" ? "cdnlivetv.tv" :
                 activeStream?.provider === "streamfree" ? "streamfree.app CDN" :
                 activeStream?.provider === "cdnlivetv" ? "cdnlivetv.tv" :
                 activeStream?.provider === "watchfooty" ? "watchfooty.st" :
                 activeStream?.provider === "embedsports" ? "embedsports.top" :
                 activeStream?.provider === "streamedpk" ? "streamed.pk" :
                 activeStream?.provider === "sportsembed" ? "sportsembed.su" :
                 "Connecting to server..."}
              </p>
              {isEmbedStream && iframeElapsed > 0 && (
                <p className="text-[10px] text-white/20 mt-1">{iframeElapsed}s / 20s timeout</p>
              )}
            </div>

            {activeStream?.corsEnabled && (
              <span className="text-[9px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400">CORS Direct</span>
            )}
            {isEmbedStream && (
              <span className="text-[9px] px-2 py-0.5 rounded-full bg-red-500/15 text-red-400">Embed Player</span>
            )}

            {/* Warning after 15s for embed */}
            {isEmbedStream && iframeElapsed >= 15 && (
              <div className="px-4 py-2 rounded-lg bg-amber-900/60 border border-amber-500/30 text-amber-200 text-[11px] font-bold text-center">
                Stream taking too long. Auto-switching in {20 - iframeElapsed}s...
              </div>
            )}
          </div>
        )}

        {/* Countdown for upcoming */}
        {playerState === "countdown" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 bg-gradient-to-br from-black via-[#0a0a0f] to-black z-20">
            <div className="absolute inset-0 opacity-30" style={{ background: `radial-gradient(circle at 50% 40%, ${sportColor}15, transparent 60%)` }} />
            <div className="relative z-10 flex flex-col items-center gap-6">
              <div className="w-24 h-24 rounded-2xl flex items-center justify-center" style={{ background: `${sportColor}10`, boxShadow: `0 0 40px ${sportColor}10` }}>
                <span className="text-5xl">{sportIcon}</span>
              </div>
              <h2 className="text-xl font-bold text-white/80">{_title}</h2>
              <CountdownTimer targetDate={props.matchDate} sportColor={sportColor} />
              <p className="text-xs text-white/20">{matchTime}</p>
            </div>
          </div>
        )}

        {/* Error */}
        {playerState === "error" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 bg-black z-20">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center bg-amber-500/10">
              <svg className="w-8 h-8 text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <p className="text-sm text-white/50">Stream could not load</p>
            <p className="text-[10px] text-white/20 max-w-xs text-center">{playerError || "Try a different server"}</p>
            <div className="flex gap-2 flex-wrap justify-center">
              {streams.filter(s => s.streamType === "embed" && s.embedUrl).length > 0 && (
                <button
                  onClick={() => {
                    const embedStream = streams.find(s => s.streamType === "embed" && s.embedUrl);
                    if (embedStream) switchStream(embedStream);
                  }}
                  className="mt-2 px-6 py-3 rounded-xl bg-red-500/15 text-red-400 text-sm font-bold hover:bg-red-500/25 border border-red-500/20 transition-all flex items-center gap-2"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><rect x="2" y="4" width="20" height="14" rx="2" /></svg>
                  Try Embed Player
                </button>
              )}
              {newTabUrl && (
                <a href={newTabUrl} target="_blank" rel="noopener noreferrer"
                  className="mt-2 px-6 py-3 rounded-xl bg-emerald-500/15 text-emerald-400 text-sm font-bold hover:bg-emerald-500/25 border border-emerald-500/20 transition-all flex items-center gap-2"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><polygon points="5 3 19 12 5 21 5 3" /></svg>
                  Watch in New Tab
                </a>
              )}
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════
            FULL STATS SCOREBOARD — Shows when no streams available OR iframe failed
            Displays team info, live score (ESPN + WatchFooty), match details,
            sport, league, status, viewers, time, and action buttons
            ═══════════════════════════════════════════════════ */}
        {playerState === "scoreboard" && !isUpcoming && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-black via-[#0a0a0f] to-black z-20 overflow-auto">
            {/* Background glow */}
            <div className="absolute inset-0 opacity-20" style={{ background: `radial-gradient(circle at 50% 40%, ${sportColor}20, transparent 60%)` }} />

            <div className="relative z-10 flex flex-col items-center gap-4 px-4 py-6 w-full max-w-xl">
              {/* Header badges row */}
              <div className="flex items-center gap-2 flex-wrap justify-center">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/15 text-red-400 text-[11px] font-bold">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
                  </span>
                  {iframeFailed ? "STREAM UNAVAILABLE" : "LIVE"}
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full" style={{ background: `${sportColor}15`, color: sportColor }}>{sportIcon} {_sportName || _sport}</span>
                {(wfLeague || matchStats?.details?.league) && (
                  <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/[0.06] text-white/50">
                    {(wfLeagueLogo || matchStats?.details?.leagueLogo) && <img src={wfLeagueLogo || matchStats?.details?.leagueLogo} alt="" className="w-3.5 h-3.5 object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />}
                    {safeStr(wfLeague || matchStats?.details?.league)}
                  </span>
                )}
              </div>

              {/* ═══ Main Scoreboard Card ═══ */}
              <div className="w-full rounded-2xl overflow-hidden border border-white/[0.06]" style={{ background: `linear-gradient(135deg, ${sportColor}08, rgba(255,255,255,0.02))` }}>
                {/* Top accent bar */}
                <div className="h-1" style={{ background: `linear-gradient(90deg, ${sportColor}, ${sportColor}50, transparent)` }} />

                <div className="p-5">
                  {/* Teams + Score */}
                  {(hasTeams || safeStr(matchStats?.details?.homeTeam) || safeStr(matchStats?.details?.awayTeam)) ? (
                    <div className="flex items-center justify-between gap-3">
                      {/* Home Team */}
                      <div className="flex flex-col items-center gap-2 flex-1 min-w-0">
                        {(_homeBadge || safeStr(matchStats?.details?.homeBadge)) ? (
                          <img src={_homeBadge || safeStr(matchStats?.details?.homeBadge)} alt={safeStr(_homeTeam || matchStats?.details?.homeTeam)} className="w-14 h-14 object-contain rounded-xl bg-white/5 p-1" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                        ) : (
                          <div className="w-14 h-14 rounded-xl flex items-center justify-center text-xl font-bold" style={{ background: `${sportColor}15`, color: `${sportColor}90` }}>{safeStr(_homeTeam || matchStats?.details?.homeTeam).charAt(0) || "H"}</div>
                        )}
                        <span className="text-xs text-white/80 font-semibold text-center truncate w-full">{safeStr(_homeTeam || matchStats?.details?.homeTeam) || "Home"}</span>
                      </div>

                      {/* Score / VS */}
                      <div className="flex flex-col items-center gap-1 px-3">
                        {hasAnyScore ? (
                          <>
                            <div className="flex items-center gap-2">
                              <span className="text-3xl font-black" style={{ color: sportColor }}>{bestHomeScore}</span>
                              <span className="text-base text-white/20 font-bold">-</span>
                              <span className="text-3xl font-black" style={{ color: sportColor }}>{bestAwayScore}</span>
                            </div>
                            {bestMinute && (
                              <span className="text-[10px] text-amber-400/70 font-bold bg-amber-400/10 px-2 py-0.5 rounded-full">{bestMinute}{!wfCurrentMinute && !matchStats?.details?.currentMinute ? "" : "'"}</span>
                            )}
                          </>
                        ) : (
                          <span className="text-xl font-black text-white/15 tracking-widest">VS</span>
                        )}
                        {/* Status below score */}
                        <span className="text-[9px] text-white/30 mt-0.5">
                          {scoreboardData?.statusDetail || (hasAnyScore ? "In Progress" : "Live Match")}
                        </span>
                      </div>

                      {/* Away Team */}
                      <div className="flex flex-col items-center gap-2 flex-1 min-w-0">
                        {(_awayBadge || safeStr(matchStats?.details?.awayBadge)) ? (
                          <img src={_awayBadge || safeStr(matchStats?.details?.awayBadge)} alt={safeStr(_awayTeam || matchStats?.details?.awayTeam)} className="w-14 h-14 object-contain rounded-xl bg-white/5 p-1" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                        ) : (
                          <div className="w-14 h-14 rounded-xl flex items-center justify-center text-xl font-bold" style={{ background: `${sportColor}15`, color: `${sportColor}90` }}>{safeStr(_awayTeam || matchStats?.details?.awayTeam).charAt(0) || "A"}</div>
                        )}
                        <span className="text-xs text-white/80 font-semibold text-center truncate w-full">{safeStr(_awayTeam || matchStats?.details?.awayTeam) || "Away"}</span>
                      </div>
                    </div>
                  ) : (
                    /* No team data — show match title */
                    <div className="text-center">
                      <h3 className="text-lg font-bold text-white/80 mb-2">{_title}</h3>
                      {hasAnyScore ? (
                        <div className="flex items-center justify-center gap-3">
                          <span className="text-2xl font-black" style={{ color: sportColor }}>{bestHomeScore}</span>
                          <span className="text-lg text-white/20 font-bold">-</span>
                          <span className="text-2xl font-black" style={{ color: sportColor }}>{bestAwayScore}</span>
                        </div>
                      ) : scoreboardData ? (
                        <div className="flex items-center justify-center gap-3">
                          <span className="text-2xl font-black" style={{ color: sportColor }}>{scoreboardData.homeScore}</span>
                          <span className="text-lg text-white/20 font-bold">-</span>
                          <span className="text-2xl font-black" style={{ color: sportColor }}>{scoreboardData.awayScore}</span>
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>
              </div>

              {/* ═══ Full Match Stats Details Grid ═══ */}
              <div className="w-full grid grid-cols-2 gap-2">
                {/* Sport */}
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm" style={{ background: `${sportColor}15` }}>{sportIcon}</div>
                  <div>
                    <p className="text-[8px] text-white/25 uppercase tracking-wider font-bold">Sport</p>
                    <p className="text-[11px] text-white/70 font-semibold">{_sportName || _sport || "N/A"}</p>
                  </div>
                </div>

                {/* League */}
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-white/[0.04]">
                    {(wfLeagueLogo || matchStats?.details?.leagueLogo) ? (
                      <img src={wfLeagueLogo || matchStats?.details?.leagueLogo} alt="" className="w-5 h-5 object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                    ) : (
                      <svg className="w-4 h-4 text-white/20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M3 21h18M3 10h18M5 6l7-3 7 3M4 10v11M20 10v11M8 14v7M12 14v7M16 14v7" /></svg>
                    )}
                  </div>
                  <div>
                    <p className="text-[8px] text-white/25 uppercase tracking-wider font-bold">League</p>
                    <p className="text-[11px] text-white/70 font-semibold truncate max-w-[120px]">{safeStr(wfLeague || matchStats?.details?.league) || "N/A"}</p>
                  </div>
                </div>

                {/* Status */}
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-red-500/10">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
                  </div>
                  <div>
                    <p className="text-[8px] text-white/25 uppercase tracking-wider font-bold">Status</p>
                    <p className="text-[11px] text-white/70 font-semibold">
                      {scoreboardData?.statusDetail ? safeStr(scoreboardData.statusDetail) : hasAnyScore ? "In Progress" : "Live"}
                    </p>
                  </div>
                </div>

                {/* Kickoff / Time */}
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-amber-500/10">
                    <svg className="w-4 h-4 text-amber-400/60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                  </div>
                  <div>
                    <p className="text-[8px] text-white/25 uppercase tracking-wider font-bold">Kickoff</p>
                    <p className="text-[11px] text-white/70 font-semibold">{matchTime || "N/A"}</p>
                  </div>
                </div>

                {/* Current Minute */}
                {(bestMinute || scoreboardData?.clock) && (
                  <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-emerald-500/10">
                      <svg className="w-4 h-4 text-emerald-400/60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" /></svg>
                    </div>
                    <div>
                      <p className="text-[8px] text-white/25 uppercase tracking-wider font-bold">Minute</p>
                      <p className="text-[11px] text-amber-400/80 font-semibold">{bestMinute ? `${bestMinute}'` : scoreboardData?.clock || "N/A"}</p>
                    </div>
                  </div>
                )}

                {/* Period / Quarter */}
                {scoreboardData?.period && (
                  <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-blue-500/10">
                      <svg className="w-4 h-4 text-blue-400/60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><rect x="3" y="3" width="18" height="18" rx="2" /><line x1="3" y1="9" x2="21" y2="9" /></svg>
                    </div>
                    <div>
                      <p className="text-[8px] text-white/25 uppercase tracking-wider font-bold">Period</p>
                      <p className="text-[11px] text-white/70 font-semibold">{safeStr(scoreboardData.period)}</p>
                    </div>
                  </div>
                )}

                {/* Available Streams */}
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-red-500/10">
                    <svg className="w-4 h-4 text-red-400/60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><polygon points="5 3 19 12 5 21 5 3" /></svg>
                  </div>
                  <div>
                    <p className="text-[8px] text-white/25 uppercase tracking-wider font-bold">Streams</p>
                    <p className="text-[11px] text-white/70 font-semibold">{loadingStreams ? "Loading..." : streams.length > 0 ? `${streams.length} available` : "None found"}</p>
                  </div>
                </div>

                {/* Viewers */}
                {(activeStream?.viewers || matchStats?.details?.viewers) && (
                  <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-cyan-500/10">
                      <svg className="w-4 h-4 text-cyan-400/60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                    </div>
                    <div>
                      <p className="text-[8px] text-white/25 uppercase tracking-wider font-bold">Viewers</p>
                      <p className="text-[11px] text-white/70 font-semibold">{activeStream?.viewers || matchStats?.details?.viewers || "N/A"}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Score loading indicator */}
              {scoreboardLoading && (
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full border border-white/20 border-t-white/60 animate-spin" />
                  <span className="text-[10px] text-white/25">Fetching live score...</span>
                </div>
              )}

              {/* Iframe failed / no stream message */}
              {iframeFailed ? (
                <div className="text-center px-4 py-3 rounded-xl bg-amber-500/[0.08] border border-amber-500/[0.15] w-full">
                  <p className="text-[11px] text-amber-400/70 mb-1">Stream failed to load — showing live stats instead</p>
                  <p className="text-[9px] text-white/20">Try a different server below or refresh</p>
                </div>
              ) : (
                <div className="text-center px-4 py-3 rounded-xl bg-white/[0.02] border border-white/[0.04] w-full">
                  <p className="text-[11px] text-white/30 mb-1">No streams available for this match</p>
                  <p className="text-[9px] text-white/15">The stream will appear when a source goes live</p>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex gap-2 flex-wrap justify-center w-full">
                {streams.filter(s => s.streamType === "embed").length > 0 && (
                  <button
                    onClick={() => {
                      setIframeFailed(false);
                      const embedStream = streams.find(s => s.streamType === "embed" && s.embedUrl);
                      if (embedStream) switchStream(embedStream);
                    }}
                    className="px-5 py-2.5 rounded-xl bg-red-500/15 text-red-400 text-[11px] font-bold hover:bg-red-500/25 border border-red-500/20 transition-all flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><rect x="2" y="4" width="20" height="14" rx="2" /></svg>
                    Try Embed Player
                  </button>
                )}
                {newTabUrl && (
                  <a href={newTabUrl} target="_blank" rel="noopener noreferrer"
                    className="px-5 py-2.5 rounded-xl bg-emerald-500/15 text-emerald-400 text-[11px] font-bold hover:bg-emerald-500/25 border border-emerald-500/20 transition-all flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><polygon points="5 3 19 12 5 21 5 3" /></svg>
                    Watch in New Tab
                  </a>
                )}
                <button onClick={() => { setIframeFailed(false); setRetryCount(c => c + 1); }} className="px-5 py-2.5 rounded-xl bg-white/[0.06] text-white/40 text-[11px] font-bold hover:bg-white/[0.08] transition-all flex items-center gap-2">
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M21 2v6h-6M3 12a9 9 0 0115.36-6.36L21 8M3 22v-6h6M21 12a9 9 0 01-15.36 6.36L3 16" /></svg>
                  Refresh
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Player controls overlay */}
        {playerState === "playing" && (
          <div className="absolute top-3 right-3 z-30 flex items-center gap-2">
            {isEmbedStream && (
              <span className="px-2 py-1 rounded-lg bg-red-500/60 backdrop-blur-sm text-white text-[9px] font-bold">EMBED</span>
            )}
            {newTabUrl && (
              <a href={newTabUrl} target="_blank" rel="noopener noreferrer" className="p-2 rounded-lg bg-black/40 backdrop-blur-sm text-white/80 hover:text-white hover:bg-black/60 transition-all" title="Open in new tab">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" /></svg>
              </a>
            )}
            <button onClick={toggleFullscreen} className="p-2 rounded-lg bg-black/40 backdrop-blur-sm text-white/80 hover:text-white hover:bg-black/60 transition-all">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                {isFullscreen ? <path d="M8 3v3a2 2 0 01-2 2H3m18 0h-3a2 2 0 01-2-2V3m0 18v-3a2 2 0 012-2h3M3 16h3a2 2 0 012 2v3" /> : <path d="M8 3H5a2 2 0 00-2 2v3m18 0V5a2 2 0 00-2-2h-3m0 18h3a2 2 0 002-2v-3M3 16v3a2 2 0 002 2h3" />}
              </svg>
            </button>
          </div>
        )}

        {/* Live badge when playing */}
        {playerState === "playing" && (
          <div className="absolute top-3 left-3 z-30">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500/80 backdrop-blur-sm text-white text-[10px] font-bold">
              <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
              LIVE
            </span>
          </div>
        )}
      </div>

      {/* ── BELOW PLAYER ── */}
      <div className="px-4 lg:px-8 py-6 flex flex-col lg:flex-row gap-6">
        <div className="flex-1 min-w-0">
          {/* Back */}
          <button onClick={() => { navigate({ page: "live" } as any); useAppStore.getState().setSectionSubPage("sports"); }} className="flex items-center gap-2 text-white/40 hover:text-white transition-colors mb-5">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M15 19l-7-7 7-7" /></svg>
            <span className="text-[11px] font-bold uppercase tracking-wider" style={{ fontFamily: "var(--font-space-mono), 'Space Mono', monospace" }}>Back to Sports</span>
          </button>

          {/* Match info card */}
          <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl overflow-hidden mb-6">
            <div className="h-1" style={{ background: `linear-gradient(90deg, ${sportColor}, ${sportColor}50, transparent)` }} />
            <div className="p-5">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <h2 className="text-lg font-bold text-white mb-1.5" style={{ fontFamily: "var(--font-space-mono), 'Space Mono', monospace" }}>{_title}</h2>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full" style={{ background: `${sportColor}15`, color: sportColor }}>{sportIcon} {_sportName || _sport}</span>
                    {isUpcoming ? (
                      <span className="px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 text-[10px] font-bold">UPCOMING</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 text-[10px] font-bold">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" /> LIVE
                      </span>
                    )}
                    {activeStream?.corsEnabled && playerState === "playing" && (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 text-[10px] font-bold">CORS DIRECT</span>
                    )}
                    {isEmbedStream && playerState === "playing" && (
                      <span className="px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 text-[10px] font-bold">EMBED PLAYER</span>
                    )}
                  </div>
                </div>
                {matchTime && <p className="text-xs text-white/40 flex-shrink-0">{matchTime}</p>}
              </div>

              {isUpcoming && props.matchDate > 0 && (
                <div className="mb-5 p-5 rounded-xl flex justify-center" style={{ background: `${sportColor}08`, border: `1px solid ${sportColor}15` }}>
                  <CountdownTimer targetDate={props.matchDate} sportColor={sportColor} />
                </div>
              )}

              {/* Team info card — always visible */}
              <div className="bg-white/[0.02] border border-white/[0.04] rounded-xl p-5">
                {/* League name */}
                {(wfLeague || matchStats?.details?.league) && (
                  <div className="flex items-center justify-center gap-2 mb-4">
                    {(wfLeagueLogo || matchStats?.details?.leagueLogo) && <img src={wfLeagueLogo || matchStats?.details?.leagueLogo} alt="" className="w-4 h-4 object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />}
                    <span className="text-[10px] font-bold text-white/40 uppercase tracking-wider">{safeStr(wfLeague || matchStats?.details?.league)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <div className="flex flex-col items-center gap-2 flex-1 min-w-0">
                    {(_homeBadge || safeStr(matchStats?.details?.homeBadge)) ? (
                      <img src={_homeBadge || safeStr(matchStats?.details?.homeBadge)} alt={safeStr(_homeTeam || matchStats?.details?.homeTeam)} className="w-16 h-16 object-contain rounded-xl bg-white/5 p-1" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                    ) : (
                      <div className="w-16 h-16 rounded-xl flex items-center justify-center text-2xl font-bold" style={{ background: `${sportColor}10`, color: `${sportColor}80` }}>{safeStr(_homeTeam || matchStats?.details?.homeTeam).charAt(0) || "H"}</div>
                    )}
                    <span className="text-sm text-white/80 font-semibold text-center truncate w-full">{safeStr(_homeTeam || matchStats?.details?.homeTeam) || "Home"}</span>
                  </div>
                  <div className="flex flex-col items-center gap-1 px-6">
                    {hasAnyScore ? (
                      <>
                        <div className="flex items-center gap-3">
                          <span className="text-2xl font-black" style={{ color: sportColor }}>{bestHomeScore}</span>
                          <span className="text-lg text-white/20 font-bold">-</span>
                          <span className="text-2xl font-black" style={{ color: sportColor }}>{bestAwayScore}</span>
                        </div>
                        {bestMinute && (
                          <span className="text-[10px] text-amber-400/60 font-bold">{bestMinute}{!wfCurrentMinute && !matchStats?.details?.currentMinute ? "" : "'"}</span>
                        )}
                      </>
                    ) : (
                      <span className="text-lg font-black text-white/15 tracking-widest">VS</span>
                    )}
                  </div>
                  <div className="flex flex-col items-center gap-2 flex-1 min-w-0">
                    {(_awayBadge || safeStr(matchStats?.details?.awayBadge)) ? (
                      <img src={_awayBadge || safeStr(matchStats?.details?.awayBadge)} alt={safeStr(_awayTeam || matchStats?.details?.awayTeam)} className="w-16 h-16 object-contain rounded-xl bg-white/5 p-1" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                    ) : (
                      <div className="w-16 h-16 rounded-xl flex items-center justify-center text-2xl font-bold" style={{ background: `${sportColor}10`, color: `${sportColor}80` }}>{safeStr(_awayTeam || matchStats?.details?.awayTeam).charAt(0) || "A"}</div>
                    )}
                    <span className="text-sm text-white/80 font-semibold text-center truncate w-full">{safeStr(_awayTeam || matchStats?.details?.awayTeam) || "Away"}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── SERVERS ── */}
          <div className="mb-6">
            <h3 className="text-[11px] font-bold text-white/25 uppercase tracking-wider mb-3" style={{ fontFamily: "var(--font-space-mono), 'Space Mono', monospace" }}>
              Stream Servers {streams.length > 0 && `(${streams.length})`}
            </h3>

            {streams.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                {streams.map((stream, idx) => {
                  const isActive = activeStream?.id === stream.id;
                  return (
                    <button
                      key={`${stream.id}-${idx}`}
                      onClick={() => switchStream(stream)}
                      className={`flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl text-[11px] font-bold transition-all ${
                        isActive ? "bg-[#ffffff] text-white shadow-[0_0_16px_rgba(124,108,240,0.3)]" : "bg-white/[0.04] text-white/50 hover:text-white/70 hover:bg-white/[0.06] border border-white/[0.06]"
                      }`}
                    >
                      <div className="flex items-center gap-1.5 truncate">
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${stream.streamType === "embed" ? "bg-red-400" : "bg-emerald-400"}`} />
                        <span className="truncate">{stream.source?.charAt(0).toUpperCase()}{stream.source?.slice(1)}</span>
                        <span className="text-[9px] opacity-50">{stream.quality}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        {stream.corsEnabled && <span className="text-[7px] px-1 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-black">CORS</span>}
                        {stream.streamType === "embed" && <span className="text-[7px] px-1 py-0.5 rounded bg-red-500/20 text-red-400 font-black">EMB</span>}
                        {stream.hd && <span className="text-[7px] px-1 py-0.5 rounded bg-amber-500/20 text-amber-400 font-black">HD</span>}
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : !loadingStreams ? (
              <div className="text-center py-6 bg-white/[0.02] rounded-xl border border-white/[0.04]">
                <p className="text-xs text-white/25">No servers found</p>
                <p className="text-[10px] text-white/15 mt-1">The stream will appear when the event goes live</p>
              </div>
            ) : (
              <div className="flex items-center gap-2 px-3 py-2">
                <div className="w-4 h-4 rounded-full border border-[#ffffff]/30 border-t-[#ffffff] animate-spin" />
                <span className="text-[10px] text-white/30">Finding servers...</span>
              </div>
            )}

            <div className="flex flex-wrap gap-2 mt-3">
              {newTabUrl && (
                <a href={newTabUrl} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-[12px] font-bold bg-emerald-500/10 text-emerald-400/70 hover:text-emerald-400 hover:bg-emerald-500/15 border border-emerald-500/10 transition-all"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" /></svg>
                  Watch in New Tab
                </a>
              )}
              <button onClick={() => setRetryCount(c => c + 1)} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-bold bg-white/[0.04] text-white/30 hover:text-white/50 border border-white/[0.06] transition-all">
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M21 2v6h-6M3 12a9 9 0 0115.36-6.36L21 8M3 22v-6h6M21 12a9 9 0 01-15.36 6.36L3 16" /></svg>
                Refresh
              </button>
            </div>
          </div>

          {/* ═══ Match Stats ═══ */}
          {(matchStats || matchStatsLoading) && props.matchWatchfootyId && (
            <div className="mb-6">
              <h3 className="text-[11px] font-bold text-white/25 uppercase tracking-wider mb-3" style={{ fontFamily: "var(--font-space-mono), 'Space Mono', monospace" }}>
                📊 Match Statistics
              </h3>

              {matchStatsLoading && !matchStats && (
                <div className="flex items-center gap-2 py-6 justify-center">
                  <div className="w-4 h-4 rounded-full border border-white/20 border-t-white/60 animate-spin" />
                  <span className="text-[10px] text-white/25">Loading match stats...</span>
                </div>
              )}

              {matchStats?.statistics && (
                <div className="space-y-4">
                  {/* Boxscore / Key Stats */}
                  {matchStats.statistics.boxscore?.teams && (
                    <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl overflow-hidden">
                      <div className="h-0.5" style={{ background: `linear-gradient(90deg, ${sportColor}, transparent)` }} />
                      <div className="p-4">
                        <h4 className="text-[10px] font-bold text-white/40 uppercase tracking-wider mb-3">Key Stats</h4>
                        {matchStats.statistics.boxscore.teams.map((team: any, idx: number) => (
                          <div key={idx} className="mb-3 last:mb-0">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-[11px] font-bold text-white/70">{team.name || (idx === 0 ? _homeTeam : _awayTeam)}</span>
                              {idx === 0 && <span className="text-[8px] px-1.5 py-0.5 rounded bg-white/5 text-white/30">HOME</span>}
                              {idx === 1 && <span className="text-[8px] px-1.5 py-0.5 rounded bg-white/5 text-white/30">AWAY</span>}
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              {team.statistics?.slice(0, 6).map((stat: any, si: number) => (
                                <div key={si} className="flex items-center justify-between py-1.5 px-2 rounded-lg bg-white/[0.02]">
                                  <span className="text-[10px] text-white/35">{safeStr(stat.name)}</span>
                                  <span className="text-[10px] font-bold" style={{ color: sportColor }}>{safeStr(stat.value)}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Commentary Feed */}
                  {matchStats.statistics.commentary && matchStats.statistics.commentary.length > 0 && (
                    <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl overflow-hidden">
                      <div className="h-0.5" style={{ background: `linear-gradient(90deg, ${sportColor}50, transparent)` }} />
                      <div className="p-4">
                        <h4 className="text-[10px] font-bold text-white/40 uppercase tracking-wider mb-3">Commentary</h4>
                        <div className="max-h-64 overflow-y-auto space-y-2 scrollbar-hide">
                          {matchStats.statistics.commentary.slice(0, 20).map((comment: any, ci: number) => (
                            <div key={ci} className="flex gap-3 py-2 border-b border-white/[0.03] last:border-0">
                              {comment.time && (
                                <span className="text-[9px] font-bold text-white/25 flex-shrink-0 w-10 text-right">{safeStr(comment.time)}</span>
                              )}
                              <span className="text-[10px] text-white/50 leading-relaxed">{safeStr(comment.text || comment.comment)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Lineups / Rosters */}
                  {matchStats.statistics.rosters && matchStats.statistics.rosters.length > 0 && (
                    <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl overflow-hidden">
                      <div className="h-0.5" style={{ background: `linear-gradient(90deg, ${sportColor}30, transparent)` }} />
                      <div className="p-4">
                        <h4 className="text-[10px] font-bold text-white/40 uppercase tracking-wider mb-3">Lineups</h4>
                        <div className="grid grid-cols-2 gap-3">
                          {matchStats.statistics.rosters.map((roster: any, ri: number) => (
                            <div key={ri}>
                              <div className="flex items-center gap-2 mb-2">
                                <span className="text-[10px] font-bold text-white/60">{safeStr(roster.team?.name) || (ri === 0 ? _homeTeam : _awayTeam)}</span>
                                {ri === 0 && <span className="text-[7px] px-1 py-0.5 rounded bg-white/5 text-white/25">HOME</span>}
                                {ri === 1 && <span className="text-[7px] px-1 py-0.5 rounded bg-white/5 text-white/25">AWAY</span>}
                              </div>
                              <div className="space-y-1">
                                {roster.roster?.filter((p: any) => p.starter).slice(0, 11).map((player: any, pi: number) => (
                                  <div key={pi} className="flex items-center gap-2 py-1">
                                    <span className="text-[9px] font-bold w-5 text-center text-white/25">{safeStr(player.jersey) || pi + 1}</span>
                                    <span className="text-[10px] text-white/45 truncate">{safeStr(player.name)}</span>
                                    {player.plays?.length > 0 && (
                                      <span className="ml-auto text-[8px] px-1 py-0.5 rounded bg-amber-500/10 text-amber-400/60">{player.plays.length}</span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Venue */}
                  {matchStats.statistics.venue && (
                    <div className="flex items-center gap-3 py-2 px-4 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                      <svg className="w-4 h-4 text-white/20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" /><circle cx="12" cy="10" r="3" /></svg>
                      <div>
                        <span className="text-[10px] text-white/30">Venue</span>
                        <span className="text-[11px] text-white/60 ml-2">{safeStr(matchStats.statistics.venue.name || matchStats.statistics.venue)}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* No stats available */}
              {matchStats && !matchStats.statistics && !matchStatsLoading && (
                <div className="text-center py-6 bg-white/[0.02] rounded-xl border border-white/[0.04]">
                  <p className="text-[11px] text-white/25">No statistics available for this match</p>
                </div>
              )}
            </div>
          )}

          {/* Tips */}
          <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.04]">
            <h4 className="text-[11px] font-bold text-white/25 uppercase tracking-wider mb-2" style={{ fontFamily: "var(--font-space-mono), 'Space Mono', monospace" }}>Stream Tips</h4>
            <div className="space-y-1.5 text-[11px] text-white/20 leading-relaxed">
              <p>Servers with <strong className="text-emerald-400/60">CORS</strong> badge play directly via hls.js</p>
              <p>Servers with <strong className="text-red-400/60">EMB</strong> badge use iframe embed player</p>
              <p>If one server doesn&apos;t work, try another — different sources have different reliability</p>
              <p>Upcoming matches show a countdown timer until kickoff</p>
            </div>
          </div>
        </div>

        {/* ── RIGHT SIDEBAR ── */}
        <div className="lg:w-80 xl:w-96 flex-shrink-0">
          <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl overflow-hidden">
            <div className="h-[3px]" style={{ background: `linear-gradient(90deg, ${sportColor}, transparent)` }} />
            <div className="p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{sportIcon}</span>
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full" style={{ background: `${sportColor}15`, color: sportColor }}>{_sportName || "Sports"}</span>
                </div>
                {isUpcoming ? (
                  <span className="px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 text-[10px] font-bold">UPCOMING</span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 text-[10px] font-bold">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" /> LIVE
                  </span>
                )}
              </div>

              <h2 className="text-lg font-bold text-white mb-4 text-center leading-snug" style={{ fontFamily: "var(--font-space-mono), 'Space Mono', monospace" }}>{_title}</h2>

              {isUpcoming && props.matchDate > 0 && (
                <div className="mb-4 p-3 rounded-xl flex justify-center" style={{ background: `${sportColor}08`, border: `1px solid ${sportColor}12` }}>
                  <CountdownTimer targetDate={props.matchDate} sportColor={sportColor} />
                </div>
              )}

              <div className="space-y-2">
                {matchTime && (
                  <div className="flex items-center justify-between py-1.5">
                    <span className="text-[11px] text-white/25">Schedule</span>
                    <span className="text-[11px] text-white/60 font-medium">{matchTime}</span>
                  </div>
                )}
                <div className="flex items-center justify-between py-1.5">
                  <span className="text-[11px] text-white/25">Status</span>
                  <span className="text-[11px] font-medium" style={{ color: isUpcoming ? "#f59e0b" : "#ef4444" }}>{isUpcoming ? "Upcoming" : "Live"}</span>
                </div>
                {streams.length > 0 && (
                  <div className="flex items-center justify-between py-1.5">
                    <span className="text-[11px] text-white/25">Servers</span>
                    <span className="text-[11px] text-white/60 font-medium">{streams.length} ({streams.filter(s => s.streamType === "m3u8").length} M3U8, {streams.filter(s => s.streamType === "embed").length} Embed)</span>
                  </div>
                )}
                <div className="flex items-center justify-between py-1.5">
                  <span className="text-[11px] text-white/25">Player</span>
                  <span className="text-[11px] text-white/60 font-medium">
                    {playerState === "playing" ? (isEmbedStream ? "Embed (iframe)" : activeStream?.corsEnabled ? "HLS Direct" : "HLS via Proxy") : "Connecting..."}
                  </span>
                </div>
                {activeStream?.provider && (
                  <div className="flex items-center justify-between py-1.5">
                    <span className="text-[11px] text-white/25">Source</span>
                    <span className="text-[11px] text-white/60 font-medium">{activeStream.provider}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <button onClick={() => { navigate({ page: "live" } as any); useAppStore.getState().setSectionSubPage("sports"); }} className="py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] text-[11px] font-bold text-white/40 hover:text-white/60 hover:bg-white/[0.06] transition-all">Browse More</button>
            {newTabUrl ? (
              <a href={newTabUrl} target="_blank" rel="noopener noreferrer" className="py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/15 text-[11px] font-bold text-emerald-400/60 hover:text-emerald-400 hover:bg-emerald-500/15 transition-all text-center">Watch in Tab</a>
            ) : (
              <button onClick={() => setRetryCount(c => c + 1)} className="py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] text-[11px] font-bold text-white/40 hover:text-white/60 transition-all">Refresh</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
