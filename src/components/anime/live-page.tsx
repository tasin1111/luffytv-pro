"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useAppStore } from "./store";
import LiveNewsPage from "./live-news-page";
import LiveTVPage from "./live-tv-page";
import LiveSchedulePage from "./live-schedule-page";

// ============================================================
// LIVE TV & SPORTS — WatchFooty-Style Complete Redesign
// Single scroll page with:
// A. News Ticker Bar (marquee, top)
// B. Sport Navigation Bar (sticky) + LIVE TV / NEWS tabs
// C. Sports Category Cards (horizontal scroll)
// D. Popular Live Section (landscape poster cards)
// E. All Matches Section (grouped by sport/time, vertical list)
// F. News Section (grid at bottom)
// Sub-pages: Live TV (900+ channels), News
// ============================================================

const WF_BASE = "https://api.watchfooty.st";

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
  { id: "billiards", label: "Billiards", icon: "🎱", color: "#ffffff" },
  { id: "afl", label: "AFL", icon: "🏈", color: "#14b8a6" },
  { id: "darts", label: "Darts", icon: "🎯", color: "#f43f5e" },
  { id: "other", label: "Other", icon: "📺", color: "#6b7280" },
];

// Sport-specific gradient pairs for cards
const SPORT_GRADIENTS: Record<string, [string, string]> = {
  football: ["#1a472a", "#0d2818"],
  basketball: ["#8B0000", "#4a0000"],
  "american-football": ["#8B0000", "#3d0c02"],
  hockey: ["#003366", "#001a33"],
  baseball: ["#003087", "#001a4d"],
  tennis: ["#5b2c6f", "#2d1637"],
  fight: ["#b35900", "#5c2d00"],
  "motor-sports": ["#8b8000", "#454000"],
  rugby: ["#0b5345", "#052e28"],
  golf: ["#3d6b33", "#1e3519"],
  cricket: ["#7d6608", "#3e3304"],
  other: ["#2c2c2c", "#1a1a1a"],
};

interface MatchSource { source: string; id: string; }

interface LiveMatch {
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
  sources: MatchSource[];
  isLive: boolean;
  apiSource?: string;
  streamKey?: string;
  streamCategory?: string;
  channelCode?: string;
  channelName?: string;
  damitvId?: string;
  damitvName?: string;
  damitvIds?: { id: string; name: string; embed?: string }[];
  damitvEmbedUrl?: string;
  watchfootyId?: number;
  sportsrcCategory?: string;
  sportsrcId?: string;
  watchfootyStreams?: { id: string; url: string; quality: string; language: string; isRedirect: boolean; nsfw: boolean; ads: boolean }[];
  league?: string;
  leagueLogo?: string;
  homeScore?: number;
  awayScore?: number;
  currentMinute?: string;
}

interface TVChannel {
  id: string;
  title: string;
  sport: string;
  sportName: string;
  isLive: boolean;
  apiSource: string;
  streamKey?: string;
  streamCategory?: string;
  channelName?: string;
  channelCode?: string;
  damitvId?: string;
  damitvName?: string;
  poster?: string;
  sources?: { source: string; id: string }[];
  embedUrl?: string;
  streamUrl?: string;
  damitvEmbedUrl?: string;
}

interface SportCategory { id: string; name: string; displayName?: string; liveCount?: number; }

interface NewsArticle {
  id: string;
  headline: string;
  description: string;
  url: string;
  imageUrl: string;
  publishedAt: string;
  editedAt: string | null;
  sport: string;
  author: string;
  content?: string | null;
  mentions?: {
    name: string;
    url: string;
    entityId: string;
    entityType: string;
  }[] | null;
}

function getSportColor(sport: string): string {
  const cat = defaultSportCategories.find(c => c.id === sport);
  return cat?.color || "#6b7280";
}

function getSportIcon(sport: string): string {
  const cat = defaultSportCategories.find(c => c.id === sport);
  return cat?.icon || "📺";
}

function getSportGradient(sport: string): [string, string] {
  return SPORT_GRADIENTS[sport] || SPORT_GRADIENTS.other;
}

// ── Format helpers ──
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

function formatTimeOnly(timestamp: number): string {
  if (!timestamp) return "";
  return new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function timeAgo(dateStr: string): string {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function capitalize(s: string) { return s ? s.charAt(0).toUpperCase() + s.slice(1).replace(/-/g, " ") : ""; }
// Safe primitive extraction: handles WatchFooty {value, displayValue} objects
// NOTE: Do NOT restrict by key count — WatchFooty objects can have extra keys
function toPrimitive(v: any): any {
  if (v === null || v === undefined) return v;
  if (typeof v === "object") {
    if ("value" in v) return toPrimitive(v.value);
    if ("displayValue" in v) return toPrimitive(v.displayValue);
    return undefined;
  }
  return v;
}
function safeStr(v: any): string { const p = toPrimitive(v); if (p === null || p === undefined) return ""; if (typeof p === "object") return ""; return String(p); }

const sportTagColors: Record<string, string> = {
  football: "bg-emerald-600",
  basketball: "bg-red-700",
  hockey: "bg-cyan-700",
  baseball: "bg-blue-700",
  tennis: "bg-red-700",
  fight: "bg-orange-700",
  "motor-sports": "bg-yellow-700",
  rugby: "bg-emerald-800",
  cricket: "bg-amber-700",
  other: "bg-gray-700",
  news: "bg-blue-900",
};

// Source badge config — shows which provider the match comes from
const SOURCE_BADGES: Record<string, { label: string; color: string; bg: string }> = {
  damitv: { label: "DamiTV", color: "#f97316", bg: "rgba(249,115,22,0.15)" },
  "damitv-ppview": { label: "DamiTV", color: "#f97316", bg: "rgba(249,115,22,0.15)" },
  streamfree: { label: "StreamFree", color: "#a855f7", bg: "rgba(168,85,247,0.15)" },
  watchfooty: { label: "WatchFooty", color: "#3b82f6", bg: "rgba(59,130,246,0.15)" },
  streamedpk: { label: "StreamedPK", color: "#22c55e", bg: "rgba(34,197,94,0.15)" },
  espn: { label: "ESPN", color: "#ef4444", bg: "rgba(239,68,68,0.15)" },
  sportsembed: { label: "SportsEmbed", color: "#06b6d4", bg: "rgba(6,182,212,0.15)" },
  "ppv-to": { label: "PPV.to", color: "#eab308", bg: "rgba(234,179,8,0.15)" },
  vipstreamed: { label: "VIPStreamed", color: "#ffffff", bg: "rgba(139,92,246,0.15)" },
};

// ═══════════════════════════════════════════════════════════════
// 24/7 STREAMS — Dynamic StreamFree + EmbleSports featured channels
// Fetched from APIs, not hardcoded DamiTV URLs
// ═══════════════════════════════════════════════════════════════
interface Stream247 {
  id: string;
  name: string;
  icon: string;
  color: string;
  embedUrl: string;
  category: string;
  streamCategory: string;
  description: string;
  source: "streamfree" | "emblesports";
  backgroundImage?: string;
}

// Static fallback entries using StreamFree + EmbleSports (NOT DamiTV)
const FALLBACK_STREAMS_247: Stream247[] = [
  {
    id: "sf-willow",
    name: "Willow Cricket",
    icon: "🏏",
    color: "#f59e0b",
    embedUrl: "https://streamfree.app/embed/cricket/willow",
    category: "Cricket",
    streamCategory: "cricket",
    source: "streamfree",
    description: "24/7 Cricket — Live ICC matches, bilateral series & highlights",
  },
  {
    id: "sf-skysports",
    name: "Sky Sports Football",
    icon: "⚽",
    color: "#22c55e",
    embedUrl: "https://streamfree.app/embed/soccer/skysports",
    category: "Football",
    streamCategory: "football",
    source: "streamfree",
    description: "24/7 Football — Premier League, EFL & live match coverage",
  },
  {
    id: "sf-nba",
    name: "NBA Live",
    icon: "🏀",
    color: "#ef4444",
    embedUrl: "https://streamfree.app/embed/basketball/nba",
    category: "Basketball",
    streamCategory: "basketball",
    source: "streamfree",
    description: "24/7 Basketball — NBA games, playoffs & live coverage",
  },
  {
    id: "es-ufc",
    name: "UFC Fight Night",
    icon: "🥊",
    color: "#f97316",
    embedUrl: "https://embedsports.top/embed/admin/admin-sky-sports-action/1",
    category: "MMA",
    streamCategory: "fight",
    source: "emblesports",
    description: "24/7 Combat — UFC fights, MMA events & boxing",
  },
  {
    id: "sf-f1",
    name: "Sky Sports F1",
    icon: "🏎️",
    color: "#eab308",
    embedUrl: "https://streamfree.app/embed/racing/skyf1",
    category: "Motorsport",
    streamCategory: "motor-sports",
    source: "streamfree",
    description: "24/7 F1 Racing — Live GPs, qualifying sessions & analysis",
  },
];

// Map StreamFree channel keys to their sport metadata for dynamic banner building
const SF_CHANNEL_META: Record<string, { icon: string; color: string; category: string; streamCategory: string; description: string }> = {
  skyf1: { icon: "🏎️", color: "#eab308", category: "Motorsport", streamCategory: "motor-sports", description: "24/7 F1 Racing — Live GPs, qualifying & analysis" },
  willow: { icon: "🏏", color: "#f59e0b", category: "Cricket", streamCategory: "cricket", description: "24/7 Cricket — Live ICC matches & highlights" },
  cricketsky: { icon: "🏏", color: "#f59e0b", category: "Cricket", streamCategory: "cricket", description: "24/7 Cricket — Sky Sports coverage" },
  skytennis: { icon: "🎾", color: "#a855f7", category: "Tennis", streamCategory: "tennis", description: "24/7 Tennis — Grand Slams & ATP/WTA" },
  skysports: { icon: "⚽", color: "#22c55e", category: "Football", streamCategory: "football", description: "24/7 Football — Premier League & live coverage" },
  skysportsfootball: { icon: "⚽", color: "#22c55e", category: "Football", streamCategory: "football", description: "24/7 Football — Sky Sports Football" },
  skysportsnews: { icon: "📺", color: "#6b7280", category: "News", streamCategory: "other", description: "24/7 Sports News — Latest updates" },
  skysportsgolf: { icon: "⛳", color: "#84cc16", category: "Golf", streamCategory: "golf", description: "24/7 Golf — PGA Tour & live coverage" },
  skysportsaction: { icon: "🏟️", color: "#22c55e", category: "Sports", streamCategory: "football", description: "24/7 Action — Live sports coverage" },
  skysportsarena: { icon: "🏟️", color: "#22c55e", category: "Sports", streamCategory: "football", description: "24/7 Arena — Live sports events" },
  btsport: { icon: "⚽", color: "#22c55e", category: "Football", streamCategory: "football", description: "24/7 BT Sport — Premier League & more" },
  tntsports1: { icon: "⚽", color: "#22c55e", category: "Football", streamCategory: "football", description: "24/7 TNT Sports — Live football" },
  espn: { icon: "🏟️", color: "#ef4444", category: "Sports", streamCategory: "football", description: "24/7 ESPN — Multi-sport coverage" },
  cbc: { icon: "🏒", color: "#06b6d4", category: "Sports", streamCategory: "football", description: "24/7 CBC Sports — Live events" },
  bbc: { icon: "⚽", color: "#22c55e", category: "Football", streamCategory: "football", description: "24/7 BBC Sport — Premier League & more" },
  supersport: { icon: "🏟️", color: "#22c55e", category: "Sports", streamCategory: "football", description: "24/7 SuperSport — Multi-sport coverage" },
};

// ═══════════════════════════════════════════════════════════════
// HERO CAROUSEL — featured event, top of page (DamiTV-style)
// ═══════════════════════════════════════════════════════════════
function HeroCarousel({ matches, onWatch }: { matches: LiveMatch[]; onWatch: (m: LiveMatch) => void }) {
  const [current, setCurrent] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused || matches.length <= 1) return;
    const t = setTimeout(() => setCurrent(p => (p + 1) % matches.length), 7000);
    return () => clearTimeout(t);
  }, [current, paused, matches.length]);

  if (matches.length === 0) return null;
  const match = matches[Math.min(current, matches.length - 1)];
  const sportColor = getSportColor(match.sport);
  const [gFrom, gTo] = getSportGradient(match.sport);

  return (
    <div
      className="relative w-full h-[300px] sm:h-[360px] md:h-[420px] rounded-2xl overflow-hidden border border-white/[0.06]"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {match.poster ? (
        <img src={match.poster} alt="" loading="lazy" decoding="async" className="absolute inset-0 w-full h-full object-cover opacity-50" key={`hero-bg-${match.id}`} />
      ) : (
        <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${gFrom}, ${gTo})` }} />
      )}
      <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/55 to-black/15" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-black/20" />

      <div className="relative h-full flex items-center px-6 sm:px-10 md:px-14" key={`hero-content-${match.id}`}>
        <div className="max-w-lg space-y-3">
          <span
            className="inline-block px-2.5 py-1 rounded text-[10px] font-black uppercase tracking-wider"
            style={{ background: sportColor, color: "#000" }}
          >
            {match.sportName || capitalize(match.sport)}
          </span>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-white leading-tight tracking-tight" style={{ fontFamily: "var(--font-space-mono), 'Space Mono', monospace" }}>
            {match.title}
          </h1>
          <p className="text-sm text-white/60 flex items-center gap-2">
            {match.isLive ? (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-red-600/90 text-white text-[10px] font-black uppercase tracking-wider">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" /> Live Now
              </span>
            ) : (
              <span>{formatMatchTime(match.date)} — {match.sportName || capitalize(match.sport)}</span>
            )}
          </p>
          <button
            onClick={() => onWatch(match)}
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-white text-black font-bold text-sm rounded-lg hover:bg-white/90 transition-colors"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
            Watch Event
          </button>
        </div>

        {(match.homeBadge || match.awayBadge) && (
          <div className="hidden md:flex items-center gap-4 absolute right-10 top-1/2 -translate-y-1/2">
            {match.homeBadge && <img src={match.homeBadge} alt="" loading="lazy" decoding="async" className="w-20 h-20 lg:w-24 lg:h-24 object-contain drop-shadow-2xl" />}
            <span className="text-white/40 font-black text-lg">VS</span>
            {match.awayBadge && <img src={match.awayBadge} alt="" loading="lazy" decoding="async" className="w-20 h-20 lg:w-24 lg:h-24 object-contain drop-shadow-2xl" />}
          </div>
        )}
      </div>

      {matches.length > 1 && (
        <>
          <button
            onClick={() => setCurrent(p => (p - 1 + matches.length) % matches.length)}
            className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/50 backdrop-blur-sm text-white/70 hover:text-white hover:bg-black/70 transition-all flex items-center justify-center border border-white/10"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M15 19l-7-7 7-7" /></svg>
          </button>
          <button
            onClick={() => setCurrent(p => (p + 1) % matches.length)}
            className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/50 backdrop-blur-sm text-white/70 hover:text-white hover:bg-black/70 transition-all flex items-center justify-center border border-white/10"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M9 5l7 7-7 7" /></svg>
          </button>
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1.5">
            {matches.slice(0, 9).map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrent(i)}
                className="h-1.5 rounded-full transition-all"
                style={{ width: i === current ? "20px" : "6px", background: i === current ? "#ffffff" : "rgba(255,255,255,0.25)" }}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// COMPACT 24/7 CARD — small square tile for the "Live Now" rail
// ═══════════════════════════════════════════════════════════════
function Stream247MiniCard({ stream, onWatch }: { stream: Stream247; onWatch: (s: Stream247) => void }) {
  return (
    <button
      onClick={() => onWatch(stream)}
      className="group relative flex-shrink-0 w-[150px] rounded-xl overflow-hidden border border-white/[0.06] hover:border-white/[0.15] transition-all"
    >
      <div className="relative h-[90px] flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${stream.color}30, #0d0d12)` }}>
        {stream.backgroundImage ? (
          <img src={stream.backgroundImage} alt="" loading="lazy" decoding="async" className="absolute inset-0 w-full h-full object-cover opacity-60" />
        ) : (
          <span className="text-3xl opacity-30">{stream.icon}</span>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
        <span className="absolute top-1.5 left-1.5 inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-red-600 text-white text-[7px] font-black uppercase tracking-wider">
          <span className="w-1 h-1 rounded-full bg-white animate-pulse" /> Live
        </span>
      </div>
      <div className="px-2 py-1.5 bg-[#0d0d12]">
        <p className="text-[10px] font-bold text-white truncate group-hover:text-white/80 transition-colors">{stream.name}</p>
        <p className="text-[8px] text-white/30 truncate">{stream.category}</p>
      </div>
    </button>
  );
}

// ═══════════════════════════════════════════════════════════════
// NEWS TICKER BAR — Scrolling marquee at top
// ═══════════════════════════════════════════════════════════════
function NewsTicker({ articles }: { articles: NewsArticle[] }) {
  if (articles.length === 0) return null;

  const items = articles.slice(0, 20);
  const content = items.map((a, i) => (
    <span key={a.id} className="inline-flex items-center gap-2 whitespace-nowrap">
      <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider text-white ${sportTagColors[a.sport] || "bg-gray-700"}`}>
        {a.sport || "NEWS"}
      </span>
      <a href={a.url} target="_blank" rel="noopener noreferrer" className="text-white/80 hover:text-white text-[11px] font-medium transition-colors">
        {a.headline}
      </a>
      {i < items.length - 1 && <span className="text-white/20 mx-2">/</span>}
    </span>
  ));

  return (
    <div className="w-full overflow-hidden relative" style={{ background: "linear-gradient(90deg, rgba(239,68,68,0.08), rgba(0,0,0,0.95), rgba(239,68,68,0.08))" }}>
      {/* Fade edges */}
      <div className="absolute left-0 top-0 bottom-0 w-12 bg-gradient-to-r from-black/80 to-transparent z-10 pointer-events-none" />
      <div className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-black/80 to-transparent z-10 pointer-events-none" />
      <div className="flex items-center h-9 border-b border-white/[0.06]">
        <div className="flex-shrink-0 px-3 bg-gradient-to-r from-red-600 to-red-700 h-full flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
          <span className="text-white text-[9px] font-black uppercase tracking-widest">LIVE</span>
        </div>
        <div className="overflow-hidden flex-1 relative">
          <div className="flex animate-marquee whitespace-nowrap">
            <div className="flex items-center gap-0 px-4">{content}</div>
            <div className="flex items-center gap-0 px-4">{content}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// HORIZONTAL ROW MATCH CARD (compact variant)
// Full-width horizontal row, ~85px tall
// Left: sport icon circle | Middle: match info | Right: score/watch
// ═══════════════════════════════════════════════════════════════
function MatchCard({ match, onWatch, onWatchChannel, variant }: { match: LiveMatch; onWatch: (m: LiveMatch) => void; onWatchChannel: (channelName: string, channelId?: string, embedUrl?: string) => void; variant: "poster" | "compact" }) {
  const sportColor = getSportColor(match.sport);
  const hasScore = match.homeScore !== undefined && match.awayScore !== undefined;
  const sourceBadge = match.apiSource ? SOURCE_BADGES[match.apiSource] : null;
  // TV channel broadcast info from DamiTV
  // Filter out entries that are match descriptions (contain "vs", ":", or match title) — only show actual TV channel names
  const tvChannels = (() => {
    if (match.damitvIds && match.damitvIds.length > 0) {
      // Filter to only show entries that look like TV channels, not match descriptions
      const channels = match.damitvIds.filter(ch => {
        const n = ch.name.toLowerCase();
        // Skip if it looks like a match title (contains "vs" or matches the match title)
        if (n.includes(" vs ") || n.includes(" vs. ")) return false;
        if (match.title && n === match.title.toLowerCase()) return false;
        // Keep if it contains common TV channel indicators
        return true;
      });
      // If all were filtered out but we have multiple IDs, they might all be channel-specific streams
      // Show them anyway if there's more than 1 (means same event on different channels)
      if (channels.length === 0 && match.damitvIds.length > 1) {
        return match.damitvIds.slice(0, 4);
      }
      return channels.slice(0, 4);
    }
    if (match.channelName) return [{ id: "", name: match.channelName, embed: "" }];
    return [];
  })();

  if (variant === "compact") {
    return (
      <button
        onClick={() => onWatch(match)}
        className="group w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border border-white/[0.06] transition-all duration-300 hover:border-white/[0.15] cursor-pointer backdrop-blur-md hover:shadow-lg hover:shadow-black/20 hover:translate-x-1"
        style={{
          background: `linear-gradient(135deg, ${sportColor}15, ${sportColor}08, rgba(255,255,255,0.02))`,
        }}
      >
        {/* Left: Sport icon circle with gradient */}
        <div
          className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-sm"
          style={{
            background: `linear-gradient(135deg, ${sportColor}30, ${sportColor}15)`,
            border: `1px solid ${sportColor}25`,
          }}
        >
          {match.homeBadge ? (
            <img src={match.homeBadge} alt="" loading="lazy" decoding="async" className="w-6 h-6 object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; (e.target as HTMLImageElement).parentElement!.querySelector('.fallback-icon')?.classList.remove('hidden'); }} />
          ) : null}
          <span className={match.homeBadge ? "hidden fallback-icon" : ""}>{getSportIcon(match.sport)}</span>
        </div>

        {/* Middle: Match info */}
        <div className="flex-1 min-w-0 text-left">
          <div className="flex items-center gap-2">
            <p className="text-[11px] font-bold text-white truncate">{match.title}</p>
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            {match.isLive ? (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-red-600/20 text-red-400 text-[8px] font-black uppercase tracking-wider">
                <span className="w-1 h-1 rounded-full bg-red-500 animate-pulse" />
                LIVE
              </span>
            ) : (
              <span className="text-[9px] text-white/30 font-medium">{formatTimeOnly(match.date)}</span>
            )}
            {match.sources && match.sources.length > 0 ? (
              match.sources.slice(0, 4).map((src, idx) => {
                const badge = SOURCE_BADGES[src.source] || SOURCE_BADGES[src.source.replace(/^streamed-/, "streamedpk")];
                if (!badge) return null;
                return (
                  <span
                    key={src.source + idx}
                    className="px-1.5 py-0.5 rounded text-[7px] font-bold"
                    style={{ background: badge.bg, color: badge.color }}
                  >
                    {badge.label}
                  </span>
                );
              })
            ) : sourceBadge ? (
              <span
                className="px-1.5 py-0.5 rounded text-[7px] font-bold"
                style={{ background: sourceBadge.bg, color: sourceBadge.color }}
              >
                {sourceBadge.label}
              </span>
            ) : null}
            {match.league && (
              <span className="text-[8px] text-white/25 font-medium truncate max-w-[120px]">{match.league}</span>
            )}
            {match.currentMinute && match.isLive && (
              <span className="text-[8px] text-amber-400/80 font-bold">{safeStr(match.currentMinute)}&apos;</span>
            )}
          </div>
          {/* TV Channel broadcast badges — clickable to open channel stream */}
          {tvChannels.length > 0 && (
            <div className="flex items-center gap-1 mt-1 flex-wrap">
              <span className="text-[7px] text-white/15">📺</span>
              {tvChannels.map((ch, i) => (
                <button
                  key={i}
                  onClick={(e) => { e.stopPropagation(); onWatchChannel(ch.name, ch.id, ch.embed); }}
                  className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[7px] font-bold bg-cyan-500/10 text-cyan-400/70 border border-cyan-500/15 truncate max-w-[90px] hover:bg-cyan-500/25 hover:text-cyan-300 hover:border-cyan-500/30 transition-all cursor-pointer"
                >
                  <svg className="w-2 h-2 flex-shrink-0 opacity-50" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                  {ch.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right: Score or Watch button */}
        <div className="flex-shrink-0 flex items-center">
          {hasScore ? (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-black/30 border border-white/[0.08]">
              <span className="text-[12px] font-black text-white">{safeStr(match.homeScore)}</span>
              <span className="text-[9px] text-white/30 font-bold">-</span>
              <span className="text-[12px] font-black text-white">{safeStr(match.awayScore)}</span>
            </div>
          ) : match.isLive ? (
            <span
              className="px-3 py-1 rounded-lg text-[9px] font-bold uppercase text-white transition-all group-hover:opacity-90"
              style={{
                background: `linear-gradient(135deg, ${sportColor}40, ${sportColor}20)`,
                border: `1px solid ${sportColor}30`,
              }}
            >
              Watch
            </span>
          ) : (
            <span className="text-[9px] text-white/20 font-medium">{match.sportName}</span>
          )}
        </div>
      </button>
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // LANDSCAPE POSTER CARD (poster variant)
  // ~220px wide, ~140px tall, landscape orientation
  // ═══════════════════════════════════════════════════════════════
  return (
    <button
      onClick={() => onWatch(match)}
      className="group relative flex-shrink-0 w-[200px] sm:w-[220px] rounded-xl overflow-hidden transition-all duration-500 hover:scale-[1.05] hover:shadow-2xl cursor-pointer border border-white/[0.06] hover:border-white/[0.15]"
    >
      <div className="relative h-[130px] sm:h-[140px]" style={{ background: `linear-gradient(135deg, ${sportColor}30, #0d0d12)` }}>
        {/* Poster as background — full opacity, gradient handles readability */}
        {match.poster ? (
          <img
            src={match.poster}
            alt={match.title}
            loading="lazy"
            decoding="async"
            className="absolute inset-0 w-full h-full object-cover"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
        ) : (
          /* Fallback: Sport-themed gradient with icon when no poster */
          <div className="absolute inset-0 flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${sportColor}25, ${sportColor}08)` }}>
            <span className="text-4xl opacity-20">{getSportIcon(match.sport)}</span>
          </div>
        )}

        {/* Gradient overlay — lighter to show image better */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

        {/* Top-left: LIVE badge */}
        <div className="absolute top-2 left-2">
          {match.isLive ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-red-600 text-white text-[8px] font-black uppercase tracking-wider shadow-lg">
              <span className="w-1 h-1 rounded-full bg-white animate-pulse" />
              LIVE
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded-md bg-black/70 text-white text-[8px] font-bold">
              {formatTimeOnly(match.date)}
            </span>
          )}
        </div>

        {/* Top-right: Source badges + League badge */}
        <div className="absolute top-2 right-2 flex flex-col items-end gap-1">
          {match.sources && match.sources.length > 0 ? (
            <div className="flex flex-wrap justify-end gap-0.5">
              {match.sources.slice(0, 4).map((src, idx) => {
                const badge = SOURCE_BADGES[src.source] || SOURCE_BADGES[src.source.replace(/^streamed-/, "streamedpk")];
                if (!badge) return null;
                return (
                  <span
                    key={src.source + idx}
                    className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[7px] font-bold backdrop-blur-sm"
                    style={{ background: badge.bg, color: badge.color }}
                  >
                    {badge.label}
                  </span>
                );
              })}
            </div>
          ) : sourceBadge ? (
            <span
              className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[7px] font-bold backdrop-blur-sm"
              style={{ background: sourceBadge.bg, color: sourceBadge.color }}
            >
              {sourceBadge.label}
            </span>
          ) : null}
          {match.league && (
            <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-black/50 backdrop-blur-sm text-white text-[7px] font-bold uppercase max-w-[100px] truncate">
              {match.leagueLogo && <img src={match.leagueLogo} alt="" loading="lazy" decoding="async" className="w-2.5 h-2.5 object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />}
              {match.league}
            </span>
          )}
        </div>

        {/* Bottom: Team names and score */}
        <div className="absolute bottom-0 left-0 right-0 p-2.5 pt-6 bg-gradient-to-t from-black/90 to-transparent">
          {hasScore ? (
            <div className="flex items-center justify-center gap-2 mb-1">
              <span className="text-[10px] font-bold text-white/80 truncate max-w-[70px]">{safeStr(match.homeTeam)}</span>
              <span className="text-[12px] font-black text-white">{safeStr(match.homeScore)}</span>
              <span className="text-[8px] text-white/30">-</span>
              <span className="text-[12px] font-black text-white">{safeStr(match.awayScore)}</span>
              <span className="text-[10px] font-bold text-white/80 truncate max-w-[70px]">{safeStr(match.awayTeam)}</span>
            </div>
          ) : (
            <p className="text-[10px] font-bold text-white truncate">{match.title}</p>
          )}
          {match.currentMinute && match.isLive && (
            <p className="text-[7px] text-amber-400 font-bold text-center">{safeStr(match.currentMinute)}&apos;</p>
          )}
          {!hasScore && (
            <p className="text-[8px] text-white/40 mt-0.5">{match.sportName}</p>
          )}
          {/* TV Channel broadcast badges on poster card — clickable */}
          {tvChannels.length > 0 && (
            <div className="flex items-center gap-1 mt-1 flex-wrap justify-center">
              {tvChannels.map((ch, i) => (
                <button
                  key={i}
                  onClick={(e) => { e.stopPropagation(); onWatchChannel(ch.name, ch.id, ch.embed); }}
                  className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[6px] font-bold bg-cyan-500/15 text-cyan-300/80 border border-cyan-500/20 truncate max-w-[80px] hover:bg-cyan-500/30 hover:text-cyan-200 hover:border-cyan-500/35 transition-all cursor-pointer"
                >
                  <svg className="w-2 h-2 flex-shrink-0 opacity-50" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                  {ch.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </button>
  );
}

// ═══════════════════════════════════════════════════════════════
// NEWS CARD — with in-app detail view
// ═══════════════════════════════════════════════════════════════
function NewsCard({ article, onClick }: { article: NewsArticle; onClick: (a: NewsArticle) => void }) {
  return (
    <button
      onClick={() => onClick(article)}
      className="group block w-full text-left rounded-xl overflow-hidden bg-white/[0.02] border border-white/[0.06] hover:border-white/[0.15] transition-all duration-500 hover:scale-[1.02] hover:shadow-xl hover:shadow-black/20 backdrop-blur-sm"
      style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))" }}
    >
      {article.imageUrl && (
        <div className="h-36 overflow-hidden">
          <img src={article.imageUrl} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
        </div>
      )}
      <div className="p-3">
        <div className="flex items-center gap-2 mb-2">
          <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider text-white ${sportTagColors[article.sport] || "bg-gray-700"}`}>
            {article.sport || "NEWS"}
          </span>
          <span className="text-[8px] text-white/25">{timeAgo(article.publishedAt)}</span>
        </div>
        <p className="text-[11px] font-bold text-white/80 group-hover:text-white line-clamp-2 mb-1">{article.headline}</p>
        {article.description && (
          <p className="text-[9px] text-white/35 line-clamp-2">{article.description}</p>
        )}
      </div>
    </button>
  );
}

// ═══════════════════════════════════════════════════════════════
// TV CHANNEL CARD
// ═══════════════════════════════════════════════════════════════
function TVChannelCard({ channel, onWatch }: { channel: TVChannel; onWatch: (ch: TVChannel) => void }) {
  const sportColor = getSportColor(channel.sport);
  const sportIcon = getSportIcon(channel.sport);
  const sourceTag = channel.apiSource === "streamfree" ? "StreamFree" :
                    channel.apiSource === "damitv" ? "DamiTV" : channel.apiSource;

  return (
    <button
      onClick={() => onWatch(channel)}
      className="group relative flex-shrink-0 w-[150px] sm:w-[170px] rounded-xl overflow-hidden transition-all duration-500 hover:scale-[1.05] hover:shadow-2xl cursor-pointer border border-white/[0.06] hover:border-white/[0.15] backdrop-blur-sm"
    >
      <div className="relative h-[100px] sm:h-[110px] flex flex-col items-center justify-center p-3" style={{ background: `linear-gradient(135deg, ${sportColor}30, ${sportColor}10, rgba(255,255,255,0.02))` }}>
        {/* Channel icon */}
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center text-lg mb-2"
          style={{
            background: `linear-gradient(135deg, ${sportColor}40, ${sportColor}20)`,
            border: `1.5px solid ${sportColor}50`,
          }}
        >
          {channel.poster ? (
            <img src={channel.poster} alt="" loading="lazy" decoding="async" className="w-7 h-7 rounded-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
          ) : (
            <span>{sportIcon}</span>
          )}
        </div>

        {/* Channel name */}
        <p className="text-[10px] font-bold text-white text-center truncate w-full">{channel.channelName || channel.title}</p>

        {/* Source badge + LIVE */}
        <div className="flex items-center gap-1.5 mt-1.5">
          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-red-600/20 text-red-400 text-[7px] font-black uppercase tracking-wider">
            <span className="w-1 h-1 rounded-full bg-red-500 animate-pulse" />
            LIVE
          </span>
          <span className="text-[7px] font-bold text-white/25 px-1 py-0.5 rounded bg-white/[0.04]">{sourceTag}</span>
        </div>
      </div>
    </button>
  );
}

// ═══════════════════════════════════════════════════════════════
// MATCH SECTION (grouped matches — vertical list layout)
// ═══════════════════════════════════════════════════════════════
function MatchSection({ title, icon, matches, onWatch, onWatchChannel, liveCount }: {
  title: string;
  icon: string;
  matches: LiveMatch[];
  onWatch: (m: LiveMatch) => void;
  onWatchChannel: (channelName: string, channelId?: string, embedUrl?: string) => void;
  liveCount?: number;
}) {
  const [showAll, setShowAll] = useState(false);
  const INITIAL_SHOW = 5;
  const displayedMatches = showAll ? matches : matches.slice(0, INITIAL_SHOW);
  const hasMore = matches.length > INITIAL_SHOW;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-bold text-white flex items-center gap-2" style={{ fontFamily: "var(--font-space-mono), 'Space Mono', monospace" }}>
          <span className="text-base">{icon}</span> {title}
          {liveCount !== undefined && liveCount > 0 && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-500/15 text-red-400">Live ({liveCount})</span>
          )}
        </h2>
        {hasMore && (
          <button
            onClick={() => setShowAll(!showAll)}
            className="text-[10px] font-bold text-white/30 hover:text-white/60 transition-all"
            style={{ fontFamily: "var(--font-space-mono), 'Space Mono', monospace" }}
          >
            {showAll ? "Show less" : `+${matches.length - INITIAL_SHOW} more`}
          </button>
        )}
      </div>
      <div className="flex flex-col gap-2">
        {displayedMatches.map(match => (
          <MatchCard key={match.id} match={match} onWatch={onWatch} onWatchChannel={onWatchChannel} variant="compact" />
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MAIN LIVE PAGE
// ═══════════════════════════════════════════════════════════════
export default function LivePage() {
  const navigate = useAppStore(s => s.navigate);
  const sectionSubPage = useAppStore(s => s.sectionSubPage);
  const setSectionSubPage = useAppStore(s => s.setSectionSubPage);

  // ── Sports state ──
  // NOTE: ALL hooks must be called before any conditional returns.
  // Violating this causes React error #300 when switching between navbar tabs.
  const [selectedSport, setSelectedSport] = useState("all");
  const [liveOnly, setLiveOnly] = useState(false);
  const [matches, setMatches] = useState<LiveMatch[]>([]);
  const [tvChannels, setTvChannels] = useState<TVChannel[]>([]);
  const [sports, setSports] = useState<SportCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // ── News state ──
  const [newsArticles, setNewsArticles] = useState<NewsArticle[]>([]);
  const [newsLoading, setNewsLoading] = useState(false);
  const [newsOffset, setNewsOffset] = useState(0);
  const [newsHasMore, setNewsHasMore] = useState(true);
  const [selectedNewsArticle, setSelectedNewsArticle] = useState<NewsArticle | null>(null);
  const [newsArticleLoading, setNewsArticleLoading] = useState(false);

  // ── TV channel database for match→channel linking ──
  // Preloaded from /api/live-tv/channels so clicks are instant
  const [channelLookup, setChannelLookup] = useState<Map<string, { id: string; name: string; category: string; streamUrl: string; logoUrl: string; damitvId: number; country: { code: string; name: string; flag: string } }>>(new Map());

  // Load the full channel database once on mount
  useEffect(() => {
    fetch('/api/live-tv/channels?category=Sports')
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (!data || !data.channels) return;
        const map = new Map<string, { id: string; name: string; category: string; streamUrl: string; logoUrl: string; damitvId: number; country: { code: string; name: string; flag: string } }>();
        for (const ch of data.channels) {
          // Index by lowercase name for fast lookup
          map.set(ch.name.toLowerCase(), ch);
          // Also index by base name without suffix like "USA", "UK", etc.
          const lower = ch.name.toLowerCase();
          const suffixes = [" usa", " uk", " france", " turkey", " spain", " portugal", " germany", " poland", " serbia", " croatia", " bulgaria", " malaysia", " australia", " canada", " brasil", " israel", " qatar", " uae", " hd", " premium"];
          for (const suf of suffixes) {
            if (lower.endsWith(suf)) {
              const base = lower.slice(0, -suf.length).trim();
              if (!map.has(base)) map.set(base, ch);
            }
          }
        }
        setChannelLookup(map);
      })
      .catch(() => {});
  }, []);

  // ── Refs ──
  const sportCardsRef = useRef<HTMLDivElement>(null);
  const popularRef = useRef<HTMLDivElement>(null);
  const stream247Ref = useRef<HTMLDivElement>(null);
  const liveNowRef = useRef<HTMLDivElement>(null);
  const upcomingRailRef = useRef<HTMLDivElement>(null);
  const fightsRef = useRef<HTMLDivElement>(null);

  // ── Fetch data ──
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (selectedSport !== "all") params.set("sport", selectedSport);
      if (liveOnly) params.set("filter", "live");

      // Add frontend timeout (30s) — prevents infinite loading if API hangs
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      const res = await fetch(`/api/live?${params.toString()}`, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (!res.ok) throw new Error("API failed");
      const data = await res.json();

      const matchList: LiveMatch[] = (data.matches || []).map((m: any) => ({
        ...m,
        // Trust the server's isLive determination (it already applies proper status checks + time-based sanity)
        // Don't override with status strings that may be stale
      }));

      matchList.sort((a, b) => {
        if (a.isLive && !b.isLive) return -1;
        if (!a.isLive && b.isLive) return 1;
        if (a.popular && !b.popular) return -1;
        if (!a.popular && b.popular) return 1;
        return a.date - b.date;
      });

      setMatches(matchList);
      setTvChannels(data.tvChannels || []);
      setSports(data.sports || []);
      setLastUpdated(new Date());
    } catch (err: any) {
      setError(err.message || "Failed to load live data");
    } finally {
      setLoading(false);
    }
  }, [selectedSport, liveOnly]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => {
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // ── Fetch News ──
  const fetchNews = useCallback(async (offset: number = 0, append: boolean = false) => {
    setNewsLoading(true);
    try {
      const res = await fetch(`/api/news?limit=12&offset=${offset}&sort=newest`);
      if (res.ok) {
        const data = await res.json();
        const articles: NewsArticle[] = data.articles || [];
        if (append) {
          setNewsArticles(prev => [...prev, ...articles]);
        } else {
          setNewsArticles(articles);
        }
        setNewsHasMore(articles.length >= 12);
        setNewsOffset(offset + articles.length);
      }
    } catch {}
    setNewsLoading(false);
  }, []);

  useEffect(() => { fetchNews(0, false); }, [fetchNews]);

  // Fetch full article content when a news article is selected
  useEffect(() => {
    if (!selectedNewsArticle?.id) return;
    const articleId = selectedNewsArticle.id;
    setNewsArticleLoading(true);
    fetch(`/api/news/article/${encodeURIComponent(articleId)}`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data && data.id === articleId) {
          // Merge full content into selected article
          setSelectedNewsArticle(prev => prev ? { ...prev, ...data } : prev);
        }
      })
      .catch(() => {})
      .finally(() => setNewsArticleLoading(false));
  }, [selectedNewsArticle?.id]);

  // ── Navigate to watch a 24/7 stream ──
  const handleWatch247 = (stream: Stream247) => {
    navigate({
      page: "live-tv-watch",
      channelId: stream.id,
      channelName: stream.name,
      channelCategory: stream.category,
      channelStreamCategory: stream.streamCategory,
      channelEmbedUrl: stream.embedUrl,
    } as any);
  };

  // ── Navigate to watch a TV channel from match card badge ──
  // Uses preloaded channel database for instant lookup — plays the m3u8 stream via HLS
  const handleWatchTVFromMatch = useCallback((channelName: string, channelId?: string, embedUrl?: string) => {
    const lower = channelName.toLowerCase().trim();
    
    // 1. Try exact match from preloaded channel database
    const ch = channelLookup.get(lower);
    if (ch) {
      navigate({
        page: "live-tv-watch",
        channelId: ch.id,
        channelName: ch.name,
        channelCategory: ch.category || "Sports",
        channelStreamCategory: "",
        channelEmbedUrl: ch.streamUrl || "",
        channelDamitvId: ch.damitvId ? Number(ch.damitvId) : undefined,
        channelDamitvEmbedUrl: `https://dami-tv.pro/embed/?id=${ch.damitvId}`,
        channelStreamUrl: ch.streamUrl || "",
        channelLogoUrl: ch.logoUrl || "",
        channelCountryCode: ch.country?.code || "",
        channelCountryName: ch.country?.name || "",
      } as any);
      return;
    }

    // 2. Try partial match — search for a channel whose name contains the search term
    for (const [key, ch2] of channelLookup) {
      if (key.includes(lower) || lower.includes(key)) {
        navigate({
          page: "live-tv-watch",
          channelId: ch2.id,
          channelName: ch2.name,
          channelCategory: ch2.category || "Sports",
          channelStreamCategory: "",
          channelEmbedUrl: ch2.streamUrl || "",
          channelDamitvId: ch2.damitvId ? Number(ch2.damitvId) : undefined,
          channelDamitvEmbedUrl: `https://dami-tv.pro/embed/?id=${ch2.damitvId}`,
          channelStreamUrl: ch2.streamUrl || "",
          channelLogoUrl: ch2.logoUrl || "",
          channelCountryCode: ch2.country?.code || "",
          channelCountryName: ch2.country?.name || "",
        } as any);
        return;
      }
    }

    // 3. Fallback: async search the channels API (covers channels not in Sports category)
    fetch(`/api/live-tv/channels?search=${encodeURIComponent(channelName)}`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (!data || !data.channels || data.channels.length === 0) return;
        const exactMatch = data.channels.find((c: any) => c.name.toLowerCase() === lower);
        const channel = exactMatch || data.channels[0];
        navigate({
          page: "live-tv-watch",
          channelId: channel.id,
          channelName: channel.name,
          channelCategory: channel.category || "Sports",
          channelStreamCategory: "",
          channelEmbedUrl: channel.streamUrl || "",
          channelDamitvId: channel.damitvId ? Number(channel.damitvId) : undefined,
          channelDamitvEmbedUrl: channel.damitvEmbedUrl || "",
          channelStreamUrl: channel.streamUrl || "",
          channelLogoUrl: channel.logoUrl || "",
          channelCountryCode: channel.country?.code || "",
          channelCountryName: channel.country?.name || "",
        } as any);
      })
      .catch(() => {});
  }, [channelLookup, navigate]);

  // ── Navigate to watch a TV channel ──
  const handleWatchChannel = (channel: TVChannel) => {
    navigate({
      page: "live-tv-watch",
      channelId: channel.id,
      channelName: safeStr(channel.channelName || channel.title),
      channelCategory: safeStr(channel.sport),
      channelStreamCategory: safeStr(channel.streamCategory),
      channelEmbedUrl: safeStr(channel.embedUrl || channel.streamUrl || ""),
      channelDamitvId: channel.damitvId ? parseInt(channel.damitvId) : undefined,
      channelDamitvEmbedUrl: safeStr(channel.damitvEmbedUrl),
      channelStreamUrl: safeStr(channel.streamUrl),
      channelLogoUrl: safeStr(channel.poster),
    } as any);
  };

  // ── Navigate to watch ──
  const handleWatchMatch = (match: LiveMatch) => {
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
      matchSources: JSON.stringify(match.sources),
      matchDate: match.date,
      matchStreamKey: safeStr(match.streamKey),
      matchStreamCategory: safeStr(match.streamCategory),
      matchChannelName: safeStr(match.channelName),
      matchChannelCode: safeStr(match.channelCode),
      matchDamitvId: safeStr(match.damitvId),
      matchDamitvName: safeStr(match.damitvName || match.title),
      matchDamitvIds: match.damitvIds ? JSON.stringify(match.damitvIds) : "",
      matchDamitvEmbedUrl: safeStr(match.damitvEmbedUrl),
      matchApiSource: safeStr(match.apiSource),
      matchSportsrcCategory: safeStr(match.sportsrcCategory),
      matchSportsrcId: safeStr(match.sportsrcId),
      matchWatchfootyId: match.watchfootyId ? String(match.watchfootyId) : "",
      matchWatchfootyStreams: match.watchfootyStreams ? JSON.stringify(match.watchfootyStreams) : "",
      matchLeague: safeStr(match.league),
      matchLeagueLogo: safeStr(match.leagueLogo),
      matchHomeScore: toPrimitive(match.homeScore) ?? undefined,
      matchAwayScore: toPrimitive(match.awayScore) ?? undefined,
      matchCurrentMinute: toPrimitive(match.currentMinute) || "",
    } as any);
  };

  // ── Derived state ──
  const now = Date.now();
  const filteredMatches = useMemo(() => {
    let result = matches;
    if (selectedSport !== "all") result = result.filter(m => m.sport === selectedSport);
    if (liveOnly) result = result.filter(m => m.isLive);
    return result;
  }, [matches, selectedSport, liveOnly]);

  const liveMatches = useMemo(() => filteredMatches.filter(m => m.isLive), [filteredMatches]);
  const startingSoon = useMemo(() => filteredMatches.filter(m => !m.isLive && m.date > now && m.date - now < 3600000), [filteredMatches, now]);
  const todayUpcoming = useMemo(() => filteredMatches.filter(m => !m.isLive && m.date > now && m.date - now >= 3600000 && m.date - now < 86400000), [filteredMatches, now]);
  const laterMatches = useMemo(() => filteredMatches.filter(m => !m.isLive && m.date > now && m.date - now >= 86400000), [filteredMatches, now]);

  // Popular Live — ONLY truly popular/featured matches (with poster or explicitly marked)
  // NOT all live matches — those go in the "Live Now" section below
  const popularLive = useMemo(() => {
    const popular = liveMatches.filter(m => m.popular && m.poster);
    // Deduplicate by match id or team combination
    const seen = new Set<string>();
    const combined = popular.filter(m => {
      const key = m.homeTeam && m.awayTeam ? `${m.sport}:${m.homeTeam}:${m.awayTeam}` : m.id;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    // Sort: popular + has poster first, then by date
    combined.sort((a, b) => {
      if (a.popular && !b.popular) return -1;
      if (!a.popular && b.popular) return 1;
      if (a.poster && !b.poster) return -1;
      if (!a.poster && b.poster) return 1;
      return 0;
    });
    return combined.slice(0, 20);
  }, [liveMatches]);

  // Live matches WITHOUT the popular ones — for "Live Now" section
  // This prevents duplicate display between "Popular Live" and "Live Now"
  const liveMatchesNoPopular = useMemo(() => {
    const popularIds = new Set(popularLive.map(m => m.id));
    return liveMatches.filter(m => !popularIds.has(m.id));
  }, [liveMatches, popularLive]);

  // Featured events for the top hero carousel — popular live/upcoming with a poster,
  // falling back to the next upcoming matches if none are marked popular.
  const heroMatches = useMemo(() => {
    const withPoster = filteredMatches.filter(m => m.poster);
    const popular = withPoster.filter(m => m.popular);
    const pool = popular.length > 0 ? popular : withPoster;
    return pool.slice(0, 6);
  }, [filteredMatches]);

  // Upcoming matches — flat horizontal rail (DamiTV-style), independent of the
  // time-grouped vertical sections further down the page.
  const upcomingRail = useMemo(() => {
    return [...startingSoon, ...todayUpcoming, ...laterMatches].slice(0, 14);
  }, [startingSoon, todayUpcoming, laterMatches]);

  // Upcoming fights — combat-sport matches that haven't started yet.
  const upcomingFights = useMemo(() => {
    return filteredMatches.filter(m => (m.sport === "fight" || m.sport === "combat") && !m.isLive).slice(0, 10);
  }, [filteredMatches]);

  // Group matches by sport for sport sections
  const matchesBySport = useMemo(() => {
    const groups: Record<string, LiveMatch[]> = {};
    for (const m of filteredMatches) {
      if (!groups[m.sport]) groups[m.sport] = [];
      groups[m.sport].push(m);
    }
    return groups;
  }, [filteredMatches]);

  const liveCountBySport: Record<string, number> = {};
  for (const m of matches) {
    if (m.isLive) liveCountBySport[m.sport] = (liveCountBySport[m.sport] || 0) + 1;
  }
  const totalLiveCount = Object.values(liveCountBySport).reduce((a, b) => a + b, 0);

  // Merge sports from API with defaults
  const displayCategories = useMemo(() => {
    const cats = defaultSportCategories.map(cat => {
      const apiSport = sports.find(s => s.id === cat.id);
      return {
        ...cat,
        label: apiSport?.displayName || apiSport?.name || cat.label,
        liveCount: liveCountBySport[cat.id] || apiSport?.liveCount || 0,
      };
    });
    for (const s of sports) {
      if (!cats.find(c => c.id === s.id)) {
        cats.push({
          id: s.id,
          label: s.displayName || s.name || capitalize(s.id),
          icon: getSportIcon(s.id),
          color: getSportColor(s.id),
          liveCount: liveCountBySport[s.id] || s.liveCount || 0,
        });
      }
    }
    return cats;
  }, [sports, liveCountBySport]);

  const sortedNavSports = useMemo(() => {
    return [...displayCategories]
      .filter(c => c.id !== "all")
      .sort((a, b) => (b.liveCount || 0) - (a.liveCount || 0));
  }, [displayCategories]);

  const topNavSports = sortedNavSports.slice(0, 7);
  const moreNavSports = sortedNavSports.slice(7);
  const [showMoreDropdown, setShowMoreDropdown] = useState(false);

  // Dynamic 24/7 streams: Build from available TV channels (StreamFree + EmbleSports)
  // Falls back to static FALLBACK_STREAMS_247 if no channels are loaded yet
  const STREAMS_247 = useMemo(() => {
    if (tvChannels.length === 0) return FALLBACK_STREAMS_247;

    // Build dynamic streams from available StreamFree channels
    const dynamicStreams: Stream247[] = [];
    const seenKeys = new Set<string>();

    for (const ch of tvChannels) {
      if (!ch.streamKey || seenKeys.has(ch.streamKey)) continue;
      seenKeys.add(ch.streamKey);

      const meta = SF_CHANNEL_META[ch.streamKey];
      if (meta) {
        // Build StreamFree embed URL from streamKey + streamCategory
        const embedCat = ch.streamCategory || meta.streamCategory;
        dynamicStreams.push({
          id: ch.id,
          name: ch.channelName || ch.title,
          icon: meta.icon,
          color: meta.color,
          embedUrl: `https://streamfree.app/embed/${embedCat}/${ch.streamKey}`,
          category: meta.category,
          streamCategory: meta.streamCategory,
          description: meta.description,
          source: "streamfree",
        });
      }
    }

    // Add EmbleSports channels (not from StreamFree)
    const embleChannels: Stream247[] = [
      {
        id: "es-ufc",
        name: "UFC Fight Night",
        icon: "🥊",
        color: "#f97316",
        embedUrl: "https://embedsports.top/embed/admin/admin-sky-sports-action/1",
        category: "MMA",
        streamCategory: "fight",
        source: "emblesports",
        description: "24/7 Combat — UFC fights, MMA events & boxing",
      },
      {
        id: "es-nfl",
        name: "NFL Network",
        icon: "🏈",
        color: "#dc2626",
        embedUrl: "https://embedsports.top/embed/admin/admin-nfl-network/1",
        category: "NFL",
        streamCategory: "american-football",
        source: "emblesports",
        description: "24/7 NFL — Live games, analysis & highlights",
      },
    ];
    for (const ec of embleChannels) {
      if (!seenKeys.has(ec.id)) {
        dynamicStreams.push(ec);
      }
    }

    return dynamicStreams.length > 0 ? dynamicStreams : FALLBACK_STREAMS_247;
  }, [tvChannels]);

  const scrollContainer = (ref: React.RefObject<HTMLDivElement | null>, direction: "left" | "right") => {
    if (!ref.current) return;
    ref.current.scrollBy({ left: direction === "left" ? -400 : 400, behavior: "smooth" });
  };

  // ═══════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════

  // ── Tab: If on news sub-page, render LiveNewsPage instead ──
  if (sectionSubPage === "news") {
    return <LiveNewsPage />;
  }

  // ── Tab: If on tv-channels sub-page, render LiveTVPage instead ──
  if (sectionSubPage === "tv-channels") {
    return <LiveTVPage />;
  }

  // ── Tab: If on schedule sub-page, render LiveSchedulePage instead ──
  if (sectionSubPage === "schedule") {
    return <LiveSchedulePage />;
  }

  return (
    <div className="min-h-screen pb-8 -mx-4 lg:-mx-8 relative" style={{ background: "linear-gradient(180deg, rgba(7,7,12,1) 0%, rgba(12,12,20,1) 30%, rgba(7,7,12,1) 100%)" }}>

      {/* ══════════════════════════════════════════
          A. NEWS TICKER BAR (top of page)
          ══════════════════════════════════════════ */}
      <NewsTicker articles={newsArticles} />

      {/* ══════════════════════════════════════════
          B. STICKY TOP NAVIGATION BAR
          ══════════════════════════════════════════ */}
      <div className="sticky top-[65px] z-40 bg-[#0d0d12]/95 backdrop-blur-md border-b border-white/[0.06] px-4 lg:px-8">
        <div className="max-w-[1400px] mx-auto flex items-center gap-3 h-12">
          {/* Home Button */}
          <button
            onClick={() => { setSelectedSport("all"); setLiveOnly(false); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold text-white/60 hover:text-white hover:bg-white/[0.06] transition-all flex-shrink-0"
            style={{ fontFamily: "var(--font-space-mono), 'Space Mono', monospace" }}
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
            Home
          </button>

          {/* Tab Buttons: LIVE SPORTS | LIVE TV | SCHEDULE | NEWS */}
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={() => setSectionSubPage("sports")}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all ${
                sectionSubPage === "sports" || !sectionSubPage || sectionSubPage === "home"
                  ? "bg-[#ffffff]/20 text-[#ffffff] border border-[#ffffff]/30"
                  : "text-white/40 hover:text-white/60 hover:bg-white/[0.04]"
              }`}
              style={{ fontFamily: "var(--font-space-mono), 'Space Mono', monospace" }}
            >
              ⚽ Live Sports
            </button>
            <button
              onClick={() => setSectionSubPage("tv-channels")}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all ${
                sectionSubPage === "tv-channels"
                  ? "bg-red-500/20 text-red-400 border border-red-500/30"
                  : "text-white/40 hover:text-white/60 hover:bg-white/[0.04]"
              }`}
              style={{ fontFamily: "var(--font-space-mono), 'Space Mono', monospace" }}
            >
              📺 Live TV
            </button>
            <button
              onClick={() => setSectionSubPage("schedule")}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all ${
                sectionSubPage === "schedule"
                  ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                  : "text-white/40 hover:text-white/60 hover:bg-white/[0.04]"
              }`}
              style={{ fontFamily: "var(--font-space-mono), 'Space Mono', monospace" }}
            >
              📅 Schedule
            </button>
            <button
              onClick={() => setSectionSubPage("news")}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all ${
                sectionSubPage === "news"
                  ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                  : "text-white/40 hover:text-white/60 hover:bg-white/[0.04]"
              }`}
              style={{ fontFamily: "var(--font-space-mono), 'Space Mono', monospace" }}
            >
              📰 News
            </button>
          </div>

          {/* Divider */}
          <div className="w-px h-6 bg-white/[0.06] flex-shrink-0" />

          {/* Live Only Toggle */}
          <button
            onClick={() => setLiveOnly(!liveOnly)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all flex-shrink-0 ${
              liveOnly
                ? "bg-red-500/20 text-red-400 border border-red-500/30"
                : "text-white/40 hover:text-white/60 hover:bg-white/[0.04]"
            }`}
            style={{ fontFamily: "var(--font-space-mono), 'Space Mono', monospace" }}
          >
            <span className={`w-2 h-2 rounded-full ${liveOnly ? "bg-red-500 animate-pulse" : "bg-white/20"}`} />
            Live only
          </button>

          {/* Divider */}
          <div className="w-px h-6 bg-white/[0.06] flex-shrink-0" />

          {/* Sport Category Buttons */}
          <div className="flex items-center gap-1 overflow-x-auto flex-1 scrollbar-hide">
            {topNavSports.map(cat => {
              const isActive = selectedSport === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedSport(cat.id)}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-bold whitespace-nowrap transition-all flex-shrink-0 ${
                    isActive
                      ? "text-white"
                      : "text-white/40 hover:text-white/70 hover:bg-white/[0.04]"
                  }`}
                  style={{
                    ...(isActive ? {
                      background: `linear-gradient(135deg, ${cat.color}25, ${cat.color}10)`,
                      border: `1px solid ${cat.color}40`,
                    } : {}),
                    fontFamily: "var(--font-space-mono), 'Space Mono', monospace",
                  }}
                >
                  <span className="text-sm">{cat.icon}</span>
                  {cat.label}
                  {cat.liveCount > 0 && (
                    <span className="text-[8px] px-1 py-0.5 rounded-full bg-blue-500/20 text-blue-400 font-bold">Live ({cat.liveCount})</span>
                  )}
                </button>
              );
            })}

            {/* More Dropdown */}
            {moreNavSports.length > 0 && (
              <div className="relative flex-shrink-0">
                <button
                  onClick={() => setShowMoreDropdown(!showMoreDropdown)}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-bold text-white/40 hover:text-white/70 hover:bg-white/[0.04] transition-all"
                >
                  More
                  <svg className={`w-3 h-3 transition-transform ${showMoreDropdown ? "rotate-180" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M6 9l6 6 6-6" /></svg>
                </button>
                {showMoreDropdown && (
                  <div className="absolute top-full right-0 mt-2 w-48 bg-[#1a1a24] border border-white/[0.08] rounded-xl shadow-2xl py-2 z-50">
                    {moreNavSports.map(cat => (
                      <button
                        key={cat.id}
                        onClick={() => { setSelectedSport(cat.id); setShowMoreDropdown(false); }}
                        className={`w-full flex items-center gap-2 px-3 py-2 text-[11px] hover:bg-white/[0.04] transition-all ${
                          selectedSport === cat.id ? "text-white" : "text-white/50"
                        }`}
                      >
                        <span>{cat.icon}</span>
                        {cat.label}
                        {cat.liveCount > 0 && (
                          <span className="ml-auto text-[8px] px-1.5 py-0.5 rounded-full bg-blue-500/20 text-blue-400">{cat.liveCount}</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════
          CONTENT AREA (single scroll, no tabs)
          ══════════════════════════════════════════ */}
      <div className="px-4 lg:px-8 max-w-[1400px] mx-auto pt-4 space-y-8">

        {/* Loading */}
        {loading && matches.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-12 h-12 rounded-full border-2 border-[#ffffff]/30 border-t-[#ffffff] animate-spin" />
            <p className="text-sm text-white/30">Loading live sports...</p>
            <p className="text-[10px] text-white/15">Fetching from multiple sources</p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="text-5xl">⚠️</div>
            <p className="text-sm text-white/40">{error}</p>
            <button onClick={fetchData} className="px-4 py-2 rounded-lg bg-white/[0.06] text-white/50 text-[11px] font-bold hover:bg-white/[0.08]">Retry</button>
          </div>
        )}

        {!loading && (
          <>
            {/* ══════════════════════════════════════════
                HERO — featured event carousel (top of page)
                ══════════════════════════════════════════ */}
            <HeroCarousel matches={heroMatches} onWatch={handleWatchMatch} />

            {/* ══════════════════════════════════════════
                SPORTS — flat category pill row (DamiTV-style)
                ══════════════════════════════════════════ */}
            <div ref={sportCardsRef} className="flex flex-wrap gap-2">
              {displayCategories.filter(c => c.id !== "all").map(cat => {
                const isActive = selectedSport === cat.id;
                return (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedSport(isActive ? "all" : cat.id)}
                    className={`px-3.5 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider whitespace-nowrap transition-all ${
                      isActive ? "text-white" : "bg-[#1a1a1a] text-white/50 hover:text-white/80 hover:bg-[#222]"
                    }`}
                    style={isActive ? { background: `${cat.color}25`, border: `1px solid ${cat.color}50`, color: cat.color } : undefined}
                  >
                    {cat.label}
                    {cat.liveCount > 0 && <span className="ml-1.5 text-red-400">{cat.liveCount}</span>}
                  </button>
                );
              })}
            </div>

            {/* ══════════════════════════════════════════
                TRENDING TODAY — Popular live/featured matches
                ══════════════════════════════════════════ */}
            {popularLive.length > 0 && (
              <div ref={popularRef}>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-bold text-white flex items-center gap-2" style={{ fontFamily: "var(--font-space-mono), 'Space Mono', monospace" }}>
                    <span className="text-red-500 uppercase text-[10px] tracking-widest">Popular</span> Trending Today
                  </h2>
                  <div className="flex items-center gap-1">
                    <button onClick={() => scrollContainer(popularRef, "left")} className="p-1 rounded-lg bg-white/[0.04] text-white/30 hover:text-white/60 hover:bg-white/[0.06] transition-all">
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M15 19l-7-7 7-7" /></svg>
                    </button>
                    <button onClick={() => scrollContainer(popularRef, "right")} className="p-1 rounded-lg bg-white/[0.04] text-white/30 hover:text-white/60 hover:bg-white/[0.06] transition-all">
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M9 5l7 7-7 7" /></svg>
                    </button>
                  </div>
                </div>
                <div className="flex gap-4 overflow-x-auto scrollbar-hide pb-2">
                  {popularLive.map(match => (
                    <MatchCard key={match.id} match={match} onWatch={handleWatchMatch} onWatchChannel={handleWatchTVFromMatch} variant="poster" />
                  ))}
                </div>
              </div>
            )}

            {/* ══════════════════════════════════════════
                LIVE NOW — 24/7 streams (compact rail)
                ══════════════════════════════════════════ */}
            {STREAMS_247.length > 0 && (
              <div ref={liveNowRef}>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-bold text-white flex items-center gap-2" style={{ fontFamily: "var(--font-space-mono), 'Space Mono', monospace" }}>
                    <span className="text-red-500 uppercase text-[10px] tracking-widest">Live</span> Live Now
                  </h2>
                  <div className="flex items-center gap-1">
                    <button onClick={() => scrollContainer(liveNowRef, "left")} className="p-1 rounded-lg bg-white/[0.04] text-white/30 hover:text-white/60 hover:bg-white/[0.06] transition-all">
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M15 19l-7-7 7-7" /></svg>
                    </button>
                    <button onClick={() => scrollContainer(liveNowRef, "right")} className="p-1 rounded-lg bg-white/[0.04] text-white/30 hover:text-white/60 hover:bg-white/[0.06] transition-all">
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M9 5l7 7-7 7" /></svg>
                    </button>
                  </div>
                </div>
                <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-2">
                  {STREAMS_247.map(stream => (
                    <Stream247MiniCard key={stream.id} stream={stream} onWatch={handleWatch247} />
                  ))}
                </div>
              </div>
            )}

            {/* ══════════════════════════════════════════
                UPCOMING MATCHES — flat rail (DamiTV-style)
                ══════════════════════════════════════════ */}
            {upcomingRail.length > 0 && (
              <div ref={upcomingRailRef}>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-bold text-white flex items-center gap-2" style={{ fontFamily: "var(--font-space-mono), 'Space Mono', monospace" }}>
                    Upcoming Matches
                  </h2>
                  <div className="flex items-center gap-1">
                    <button onClick={() => scrollContainer(upcomingRailRef, "left")} className="p-1 rounded-lg bg-white/[0.04] text-white/30 hover:text-white/60 hover:bg-white/[0.06] transition-all">
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M15 19l-7-7 7-7" /></svg>
                    </button>
                    <button onClick={() => scrollContainer(upcomingRailRef, "right")} className="p-1 rounded-lg bg-white/[0.04] text-white/30 hover:text-white/60 hover:bg-white/[0.06] transition-all">
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M9 5l7 7-7 7" /></svg>
                    </button>
                  </div>
                </div>
                <div className="flex gap-4 overflow-x-auto scrollbar-hide pb-2">
                  {upcomingRail.map(match => (
                    <MatchCard key={`rail-${match.id}`} match={match} onWatch={handleWatchMatch} onWatchChannel={handleWatchTVFromMatch} variant="poster" />
                  ))}
                </div>
              </div>
            )}

            {/* ══════════════════════════════════════════
                D.5. TV CHANNELS (Sky F1, Willow, 24/7, etc.)
                ══════════════════════════════════════════ */}
            {tvChannels.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-bold text-white flex items-center gap-2" style={{ fontFamily: "var(--font-space-mono), 'Space Mono', monospace" }}>
                    <span className="text-base">📺</span> Live TV Channels
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-500/15 text-red-400">{tvChannels.length} channels</span>
                  </h2>
                </div>
                <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-2">
                  {tvChannels.map(channel => (
                    <TVChannelCard key={channel.id} channel={channel} onWatch={handleWatchChannel} />
                  ))}
                </div>
              </div>
            )}

            {/* ══════════════════════════════════════════
                UPCOMING FIGHTS — combat sports rail
                ══════════════════════════════════════════ */}
            {upcomingFights.length > 0 && (
              <div ref={fightsRef}>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-bold text-white flex items-center gap-2" style={{ fontFamily: "var(--font-space-mono), 'Space Mono', monospace" }}>
                    <span className="text-base">🥊</span> Upcoming Fights
                  </h2>
                  <div className="flex items-center gap-1">
                    <button onClick={() => scrollContainer(fightsRef, "left")} className="p-1 rounded-lg bg-white/[0.04] text-white/30 hover:text-white/60 hover:bg-white/[0.06] transition-all">
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M15 19l-7-7 7-7" /></svg>
                    </button>
                    <button onClick={() => scrollContainer(fightsRef, "right")} className="p-1 rounded-lg bg-white/[0.04] text-white/30 hover:text-white/60 hover:bg-white/[0.06] transition-all">
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M9 5l7 7-7 7" /></svg>
                    </button>
                  </div>
                </div>
                <div className="flex gap-4 overflow-x-auto scrollbar-hide pb-2">
                  {upcomingFights.map(match => (
                    <MatchCard key={`fight-${match.id}`} match={match} onWatch={handleWatchMatch} onWatchChannel={handleWatchTVFromMatch} variant="poster" />
                  ))}
                </div>
              </div>
            )}

            {/* ══════════════════════════════════════════
                E. MATCHES BY SPORT SECTIONS (Vertical List)
                ══════════════════════════════════════════ */}
            {/* Live Matches */}
            {liveMatchesNoPopular.length > 0 && (
              <MatchSection
                title="Live Matches"
                icon="🔴"
                matches={liveMatchesNoPopular}
                onWatch={handleWatchMatch}
                onWatchChannel={handleWatchTVFromMatch}
                liveCount={liveMatchesNoPopular.length}
              />
            )}

            {/* Starting Soon */}
            {startingSoon.length > 0 && (
              <MatchSection
                title="Starting Soon"
                icon="⏰"
                matches={startingSoon}
                onWatch={handleWatchMatch}
                onWatchChannel={handleWatchTVFromMatch}
              />
            )}

            {/* Today */}
            {todayUpcoming.length > 0 && (
              <MatchSection
                title="Today"
                icon="📅"
                matches={todayUpcoming}
                onWatch={handleWatchMatch}
                onWatchChannel={handleWatchTVFromMatch}
              />
            )}

            {/* All Matches (full list, further out than Today) */}
            {laterMatches.length > 0 && (
              <MatchSection
                title="All Matches"
                icon="📆"
                matches={laterMatches}
                onWatch={handleWatchMatch}
                onWatchChannel={handleWatchTVFromMatch}
              />
            )}

            {/* No matches */}
            {filteredMatches.length === 0 && !loading && (
              <div className="flex flex-col items-center justify-center py-20 gap-4">
                <div className="text-5xl">🏟️</div>
                <p className="text-sm text-white/40">No matches found</p>
                <p className="text-[10px] text-white/20">Try a different sport or check back later</p>
                <button onClick={() => { setSelectedSport("all"); setLiveOnly(false); }} className="px-4 py-2 rounded-full bg-white/[0.06] text-white/50 text-[11px] font-bold hover:bg-white/[0.08]">Show All</button>
              </div>
            )}

            {/* ══════════════════════════════════════════
                F. NEWS SECTION
                ══════════════════════════════════════════ */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-bold text-white flex items-center gap-2" style={{ fontFamily: "var(--font-space-mono), 'Space Mono', monospace" }}>
                  <span className="text-base">📰</span> Latest Sports News
                </h2>
              </div>

              {newsLoading && newsArticles.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 gap-4">
                  <div className="w-10 h-10 rounded-full border-2 border-[#ffffff]/30 border-t-[#ffffff] animate-spin" />
                  <p className="text-sm text-white/30">Loading news...</p>
                </div>
              )}

              {newsArticles.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {newsArticles.map(article => (
                    <NewsCard key={article.id} article={article} onClick={setSelectedNewsArticle} />
                  ))}
                </div>
              )}

              {!newsLoading && newsArticles.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 gap-4">
                  <div className="text-4xl">📰</div>
                  <p className="text-sm text-white/40">No news available</p>
                </div>
              )}

              {newsHasMore && newsArticles.length > 0 && (
                <div className="flex justify-center mt-6">
                  <button
                    onClick={() => fetchNews(newsOffset, true)}
                    disabled={newsLoading}
                    className="px-6 py-2.5 rounded-xl bg-white/[0.04] text-white/40 text-[11px] font-bold hover:bg-white/[0.06] hover:text-white/60 transition-all disabled:opacity-50"
                  >
                    {newsLoading ? "Loading..." : "Load More"}
                  </button>
                </div>
              )}
            </div>

            {/* Last updated */}
            {lastUpdated && (
              <div className="text-center">
                <span className="text-[9px] text-white/15">Last updated {lastUpdated.toLocaleTimeString()} • Auto-refreshes every 60s</span>
              </div>
            )}
          </>
        )}
      </div>

      {/* News Article Detail Modal */}
      {selectedNewsArticle && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setSelectedNewsArticle(null)}>
          <div
            className="bg-[#12121a] border border-white/[0.08] rounded-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <div className="sticky top-0 z-10 flex items-center justify-between p-4 bg-[#12121a]/95 backdrop-blur-sm border-b border-white/[0.06]">
              <div className="flex items-center gap-2">
                <span
                  className="px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider text-white"
                  style={{ background: `${getSportColor(selectedNewsArticle.sport)}30`, color: getSportColor(selectedNewsArticle.sport) }}
                >
                  {selectedNewsArticle.sport || "NEWS"}
                </span>
                {selectedNewsArticle.author && (
                  <span className="text-[10px] text-white/30">by {selectedNewsArticle.author}</span>
                )}
              </div>
              <button
                onClick={() => setSelectedNewsArticle(null)}
                className="p-1.5 rounded-lg bg-white/[0.06] text-white/40 hover:text-white hover:bg-white/[0.10] transition-all"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Article image */}
            {selectedNewsArticle.imageUrl && (
              <div className="relative h-48 sm:h-64 overflow-hidden">
                <img
                  src={selectedNewsArticle.imageUrl}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="w-full h-full object-cover"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#12121a] via-transparent to-transparent" />
              </div>
            )}

            {/* Article content */}
            <div className="p-5">
              <h2 className="text-lg font-bold text-white mb-2 leading-snug" style={{ fontFamily: "var(--font-space-mono), 'Space Mono', monospace" }}>
                {selectedNewsArticle.headline}
              </h2>

              <div className="flex items-center gap-2 mb-4">
                <span className="text-[10px] text-white/25">{timeAgo(selectedNewsArticle.publishedAt)}</span>
                {selectedNewsArticle.editedAt && (
                  <span className="text-[10px] text-white/15">(edited)</span>
                )}
              </div>

              {newsArticleLoading ? (
                <div className="flex items-center gap-2 py-6">
                  <div className="w-5 h-5 rounded-full border-2 border-orange-500/30 border-t-orange-500 animate-spin" />
                  <span className="text-xs text-white/30">Loading article...</span>
                </div>
              ) : selectedNewsArticle.content ? (
                <div className="text-sm text-white/60 leading-relaxed whitespace-pre-wrap">
                  {selectedNewsArticle.content}
                </div>
              ) : selectedNewsArticle.description ? (
                <p className="text-sm text-white/60 leading-relaxed">{selectedNewsArticle.description}</p>
              ) : (
                <p className="text-sm text-white/30">No content available.</p>
              )}

              {/* Read more link */}
              <div className="mt-4 pt-3 border-t border-white/[0.06] flex items-center gap-3 flex-wrap">
                <a
                  href={selectedNewsArticle.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold bg-orange-500/15 text-orange-400 hover:bg-orange-500/25 transition-all"
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" />
                  </svg>
                  Read Full Article
                </a>
                <button
                  onClick={() => setSelectedNewsArticle(null)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold bg-white/[0.04] text-white/30 hover:text-white/60 hover:bg-white/[0.06] transition-all"
                >
                  Close
                </button>
              </div>

              {/* Entity mentions */}
              {selectedNewsArticle.mentions && selectedNewsArticle.mentions.length > 0 && (
                <div className="mt-3 pt-3 border-t border-white/[0.06]">
                  <p className="text-[10px] text-white/20 font-bold uppercase tracking-wider mb-2">Mentions</p>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedNewsArticle.mentions.map((mention, i) => (
                      <a
                        key={i}
                        href={mention.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2 py-0.5 rounded text-[10px] font-medium bg-white/[0.04] text-white/40 hover:text-white/70 hover:bg-white/[0.06] transition-all"
                      >
                        {mention.name}
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Click-outside handler for More dropdown */}
      {showMoreDropdown && (
        <div className="fixed inset-0 z-30" onClick={() => setShowMoreDropdown(false)} />
      )}

      {/* Marquee animation styles */}
      <style jsx global>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-marquee {
          animation: marquee 60s linear infinite;
        }
        .animate-marquee:hover {
          animation-play-state: paused;
        }
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .line-clamp-2 {
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
      `}</style>
    </div>
  );
}