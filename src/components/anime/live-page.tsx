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

function Stream247Card({ stream, onWatch, isActive }: { stream: Stream247; onWatch: (s: Stream247) => void; isActive: boolean }) {
  return (
    <button
      onClick={() => onWatch(stream)}
      className="group relative w-full overflow-hidden cursor-pointer"
      style={{
        opacity: isActive ? 1 : 0,
        transform: isActive ? 'scale(1)' : 'scale(0.95)',
        transition: 'all 0.6s ease',
        borderRadius: '14px',
        border: '1px solid #1a1a1a',
      }}
    >
      <div className="relative h-[280px] sm:h-[320px]" style={{ background: `linear-gradient(135deg, ${stream.color}25, #0a0a0a 80%)` }}>
        {/* Watermark icon */}
        {!stream.backgroundImage && (
          <div className="absolute right-12 top-1/2 -translate-y-1/2 opacity-[0.06] text-[160px] select-none pointer-events-none">
            {stream.icon}
          </div>
        )}
        {stream.backgroundImage && (
          <img src={stream.backgroundImage} alt="" loading="lazy" className="absolute inset-0 w-full h-full object-cover opacity-50" />
        )}

        {/* Gradient overlay — dami-tv style: strong left-to-right */}
        <div className="absolute inset-0" style={{ background: 'linear-gradient(90deg, #0a0a0a 0%, rgba(10,10,10,0.85) 25%, rgba(10,10,10,0.4) 50%, rgba(10,10,10,0.2) 70%, rgba(10,10,10,0.4) 90%, #0a0a0a 100%)' }} />

        {/* Content — left-aligned like dami-tv hero */}
        <div className="absolute inset-0 p-8 sm:p-10 flex items-center">
          <div className="flex-1 min-w-0" style={{ maxWidth: '420px' }}>
            {/* Badge */}
            <span style={{ display: 'inline-block', background: '#1a1a1a', border: '1px solid #333', padding: '4px 12px', fontSize: '12px', fontWeight: 600, marginBottom: '16px', borderRadius: '2px', color: '#fff' }}>
              LIVE 24/7
            </span>
            {/* Channel name */}
            <h2 style={{ fontSize: '32px', fontWeight: 800, marginBottom: '12px', lineHeight: 1.2, color: '#fff' }}>
              {stream.name}
            </h2>
            {/* Description */}
            <p style={{ fontSize: '15px', color: '#bbb', marginBottom: '24px', lineHeight: 1.5 }}>
              {stream.description}
            </p>
            {/* CTA button — dami-tv style */}
            <button
              className="group-hover:bg-[#e8471b] group-hover:text-white transition-all"
              style={{ background: '#fff', color: '#000', padding: '14px 40px', fontSize: '15px', fontWeight: 700, border: 'none', borderRadius: '4px', cursor: 'pointer' }}
            >
              Watch Now
            </button>
          </div>
        </div>
      </div>
    </button>
  );
}

// ═══════════════════════════════════════════════════════════════
// NEWS TICKER BAR — dami-tv style: sticky, orange LIVE label, scrolling
// ═══════════════════════════════════════════════════════════════
function NewsTicker({ articles }: { articles: NewsArticle[] }) {
  if (articles.length === 0) return null;
  const items = articles.slice(0, 20);
  const content = items.map((a, i) => (
    <span key={a.id} className="inline-flex items-center gap-2 whitespace-nowrap">
      <span style={{ background: '#e8471b', color: '#fff', fontSize: '9px', fontWeight: 800, padding: '2px 6px', borderRadius: '2px', textTransform: 'uppercase' }}>
        {a.sport || "NEWS"}
      </span>
      <a href={a.url} target="_blank" rel="noopener noreferrer" style={{ color: '#ccc', fontSize: '12px', fontWeight: 600, transition: 'color 0.2s' }}
         onMouseEnter={(e) => (e.target as HTMLAnchorElement).style.color = '#fff'}
         onMouseLeave={(e) => (e.target as HTMLAnchorElement).style.color = '#ccc'}>
        {a.headline}
      </a>
      {i < items.length - 1 && <span style={{ color: '#333', margin: '0 8px' }}>•</span>}
    </span>
  ));
  return (
    <div style={{ position: 'sticky', top: '60px', zIndex: 900, background: 'linear-gradient(180deg, #0d0d0d 0%, #111 100%)', borderBottom: '1px solid #1a1a1a', overflow: 'hidden', height: '42px', display: 'flex', alignItems: 'center' }}>
      <div style={{ flexShrink: 0, background: '#e8471b', color: '#fff', fontSize: '10px', fontWeight: 800, letterSpacing: '0.08em', padding: '4px 12px', textTransform: 'uppercase', zIndex: 2, height: '100%', display: 'flex', alignItems: 'center' }}>
        LIVE
      </div>
      <div style={{ overflow: 'hidden', flex: 1, position: 'relative' }}>
        <div className="damitv-ticker-track" style={{ display: 'flex', alignItems: 'center', whiteSpace: 'nowrap', willChange: 'transform', animation: 'damitvTickerScroll 60s linear infinite' }}>
          <div style={{ display: 'flex', alignItems: 'center', padding: '0 16px' }}>{content}</div>
          <div style={{ display: 'flex', alignItems: 'center', padding: '0 16px' }}>{content}</div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MATCH CARD — dami-tv style: 280px landscape poster card
// ═══════════════════════════════════════════════════════════════
function MatchCard({ match, onWatch, variant }: { match: LiveMatch; onWatch: (m: LiveMatch) => void; onWatchChannel: (channelName: string, channelId?: string, embedUrl?: string) => void; variant: "poster" | "compact" }) {
  const sportColor = getSportColor(match.sport);
  const poster = match.poster || match.homeBadge || "";
  const title = match.title || `${match.homeTeam || ""} vs ${match.awayTeam || ""}`.trim() || "Unknown Event";

  if (variant === "compact") {
    // Compact row variant for "Upcoming Matches" list
    return (
      <button
        onClick={() => onWatch(match)}
        style={{
          display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px',
          background: '#141414', border: '1px solid #1e1e1e', borderRadius: '8px',
          cursor: 'pointer', transition: 'all 0.2s', textAlign: 'left', width: '100%',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#333'; e.currentTarget.style.background = '#181818'; }}
        onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#1e1e1e'; e.currentTarget.style.background = '#141414'; }}
      >
        {/* Time/Live badge */}
        {match.isLive ? (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#dc2626', color: '#fff', fontSize: '9px', fontWeight: 700, padding: '3px 8px', borderRadius: '4px', flexShrink: 0 }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#fff' }} />
            LIVE
          </span>
        ) : (
          <span style={{ background: 'rgba(0,0,0,0.6)', color: '#fff', fontSize: '10px', fontWeight: 700, padding: '3px 9px', borderRadius: '4px', flexShrink: 0 }}>
            {formatTimeOnly(match.date)}
          </span>
        )}
        {/* Sport tag */}
        <span style={{ fontSize: '11px', fontWeight: 800, color: sportColor, flexShrink: 0, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          {(match.sportName || match.sport || '').replace(/-/g, ' ').toUpperCase().slice(0, 12)}
        </span>
        {/* Title */}
        <span style={{ fontSize: '13px', fontWeight: 600, color: '#ccc', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {title}
        </span>
        {/* League */}
        {match.league && (
          <span style={{ fontSize: '10px', color: '#555', flexShrink: 0 }}>
            {match.league}
          </span>
        )}
      </button>
    );
  }

  // Poster variant — dami-tv card style (280px wide, landscape image)
  return (
    <button
      onClick={() => onWatch(match)}
      style={{
        flex: '0 0 auto', width: '280px', display: 'block',
        cursor: 'pointer', padding: 0, border: 'none', background: 'transparent', textAlign: 'left',
      }}
    >
      {/* Image container */}
      <div style={{ position: 'relative', width: '280px', height: '158px', background: '#151515', borderRadius: '10px', overflow: 'hidden' }}>
        {poster ? (
          <img src={poster} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '48px', background: `linear-gradient(135deg, ${sportColor}30, #151515)` }}>
            {getSportIcon(match.sport)}
          </div>
        )}
        {/* Gradient overlay */}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, transparent 40%, rgba(0,0,0,0.7) 100%)' }} />

        {/* LIVE badge — top left */}
        {match.isLive && (
          <span style={{ position: 'absolute', top: '8px', left: '8px', display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#dc2626', color: '#fff', fontSize: '9px', fontWeight: 700, padding: '3px 10px', borderRadius: '4px' }}>
            <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#fff' }} />
            LIVE
          </span>
        )}

        {/* Time badge — bottom right (for upcoming) */}
        {!match.isLive && match.date > 0 && (
          <span style={{ position: 'absolute', bottom: '8px', right: '8px', background: 'rgba(0,0,0,0.6)', color: '#fff', fontSize: '10px', fontWeight: 700, padding: '3px 9px', borderRadius: '4px' }}>
            {formatTimeOnly(match.date)}
          </span>
        )}

        {/* League — top right */}
        {match.league && (
          <span style={{ position: 'absolute', top: '8px', right: '8px', background: 'rgba(0,0,0,0.7)', color: '#fff', fontSize: '10px', fontWeight: 800, padding: '3px 8px', borderRadius: '4px', maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {match.league}
          </span>
        )}
      </div>

      {/* Info below image */}
      <div style={{ padding: '8px 4px 0' }}>
        <p style={{ fontSize: '13px', fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: 0 }}>
          {title}
        </p>
        {match.sportName && (
          <p style={{ fontSize: '11px', fontWeight: 800, color: sportColor, textTransform: 'uppercase', letterSpacing: '0.04em', margin: '2px 0 0' }}>
            {match.sportName}
          </p>
        )}
      </div>
    </button>
  );
}

// ═══════════════════════════════════════════════════════════════
// NEWS CARD — dami-tv style
// ═══════════════════════════════════════════════════════════════
function NewsCard({ article, onClick }: { article: NewsArticle; onClick: (a: NewsArticle) => void }) {
  return (
    <button
      onClick={() => onClick(article)}
      style={{
        display: 'grid', gridTemplateColumns: '140px 1fr', gap: '16px',
        background: '#141414', border: '1px solid #1e1e1e', borderRadius: '10px',
        overflow: 'hidden', cursor: 'pointer', transition: 'all 0.2s', padding: 0, textAlign: 'left',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#333'; e.currentTarget.style.background = '#181818'; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#1e1e1e'; e.currentTarget.style.background = '#141414'; }}
    >
      {article.imageUrl && (
        <img src={article.imageUrl} alt="" loading="lazy" style={{ width: '140px', height: '100%', minHeight: '90px', objectFit: 'cover' }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
      )}
      <div style={{ padding: '12px 16px 12px 0', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
          <span style={{ fontSize: '9px', fontWeight: 800, color: '#e8471b', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            {article.sport || "NEWS"}
          </span>
          <span style={{ fontSize: '10px', color: '#555' }}>{timeAgo(article.publishedAt)}</span>
        </div>
        <p style={{ fontSize: '13px', fontWeight: 700, color: '#fff', lineHeight: 1.3, margin: 0, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {article.headline}
        </p>
      </div>
    </button>
  );
}

// ═══════════════════════════════════════════════════════════════
// TV CHANNEL CARD — dami-tv style
// ═══════════════════════════════════════════════════════════════
function TVChannelCard({ channel, onWatch }: { channel: TVChannel; onWatch: (ch: TVChannel) => void }) {
  const sportColor = getSportColor(channel.sport);
  return (
    <button
      onClick={() => onWatch(channel)}
      style={{
        flex: '0 0 auto', width: '150px', cursor: 'pointer', padding: 0, border: 'none', background: 'transparent', textAlign: 'left',
      }}
    >
      <div style={{ position: 'relative', width: '150px', height: '90px', background: `linear-gradient(135deg, ${sportColor}25, #141414)`, borderRadius: '10px', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {channel.poster ? (
          <img src={channel.poster} alt="" loading="lazy" style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover' }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
        ) : (
          <span style={{ fontSize: '32px' }}>{getSportIcon(channel.sport)}</span>
        )}
        <span style={{ position: 'absolute', top: '6px', left: '6px', display: 'inline-flex', alignItems: 'center', gap: '3px', background: '#dc2626', color: '#fff', fontSize: '8px', fontWeight: 700, padding: '2px 6px', borderRadius: '3px' }}>
          <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#fff' }} />
          LIVE
        </span>
      </div>
      <p style={{ fontSize: '11px', fontWeight: 600, color: '#ccc', padding: '6px 4px 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: 0 }}>
        {channel.channelName || channel.title}
      </p>
    </button>
  );
}

// ═══════════════════════════════════════════════════════════════
// SECTION HEADER — dami-tv style: orange label + divider + h2
// ═══════════════════════════════════════════════════════════════
function SectionHeader({ label, title, onPrev, onNext, viewAll }: { label?: string; title: string; onPrev?: () => void; onNext?: () => void; viewAll?: () => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {label && <span style={{ fontSize: '14px', fontWeight: 600, color: '#e8471b' }}>{label}</span>}
        {label && <div style={{ width: '1px', height: '20px', background: '#333' }} />}
        <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#fff', margin: 0 }}>{title}</h2>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {viewAll && (
          <button onClick={viewAll} style={{ fontSize: '12px', fontWeight: 600, color: '#888', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px' }}
            onMouseEnter={(e) => (e.currentTarget as HTMLButtonElement).style.color = '#e8471b'}
            onMouseLeave={(e) => (e.currentTarget as HTMLButtonElement).style.color = '#888'}>
            View All →
          </button>
        )}
        {onPrev && (
          <button onClick={onPrev} style={{ width: '32px', height: '32px', borderRadius: '6px', background: '#1a1a1a', border: '1px solid #333', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#e8471b'; e.currentTarget.style.color = '#e8471b'; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#333'; e.currentTarget.style.color = '#fff'; }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M15 19l-7-7 7-7" /></svg>
          </button>
        )}
        {onNext && (
          <button onClick={onNext} style={{ width: '32px', height: '32px', borderRadius: '6px', background: '#1a1a1a', border: '1px solid #333', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#e8471b'; e.currentTarget.style.color = '#e8471b'; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#333'; e.currentTarget.style.color = '#fff'; }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M9 5l7 7-7 7" /></svg>
          </button>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// CARD ROW — horizontal scrollable row of cards with scroll buttons
// ═══════════════════════════════════════════════════════════════
function CardRow({ children, onPrev, onNext }: { children: React.ReactNode; onPrev: () => void; onNext: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const scroll = (dir: "left" | "right") => {
    if (!ref.current) return;
    ref.current.scrollBy({ left: dir === "left" ? -400 : 400, behavior: "smooth" });
  };
  return (
    <div style={{ position: 'relative' }}>
      <div ref={ref} style={{ display: 'flex', gap: '16px', overflowX: 'auto', scrollBehavior: 'smooth', paddingBottom: '4px', scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        className="damitv-card-row">
        {children}
      </div>
      <button onClick={() => scroll("left")} style={{ position: 'absolute', left: '-20px', top: '50%', transform: 'translateY(-50%)', width: '36px', height: '36px', borderRadius: '50%', background: 'rgba(10,10,10,0.9)', border: '1px solid #333', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10, transition: 'all 0.2s' }}
        onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#e8471b'; e.currentTarget.style.color = '#e8471b'; }}
        onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#333'; e.currentTarget.style.color = '#fff'; }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M15 19l-7-7 7-7" /></svg>
      </button>
      <button onClick={() => scroll("right")} style={{ position: 'absolute', right: '-20px', top: '50%', transform: 'translateY(-50%)', width: '36px', height: '36px', borderRadius: '50%', background: 'rgba(10,10,10,0.9)', border: '1px solid #333', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10, transition: 'all 0.2s' }}
        onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#e8471b'; e.currentTarget.style.color = '#e8471b'; }}
        onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#333'; e.currentTarget.style.color = '#fff'; }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M9 5l7 7-7 7" /></svg>
      </button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// SPORT TAG — dami-tv category pill
// ═══════════════════════════════════════════════════════════════
function SportTag({ label, icon, active, onClick, count }: { label: string; icon?: string; active?: boolean; onClick?: () => void; count?: number }) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: '0 0 auto', display: 'flex', alignItems: 'center', gap: '6px',
        background: active ? '#e8471b' : '#1a1a1a',
        color: active ? '#fff' : '#888',
        border: `1px solid ${active ? '#e8471b' : '#333'}`,
        padding: '7px 14px', borderRadius: '6px',
        fontSize: '12px', fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s',
        textTransform: 'uppercase', letterSpacing: '0.04em',
      }}
      onMouseEnter={(e) => { if (!active) { e.currentTarget.style.borderColor = '#555'; e.currentTarget.style.color = '#fff'; } }}
      onMouseLeave={(e) => { if (!active) { e.currentTarget.style.borderColor = '#333'; e.currentTarget.style.color = '#888'; } }}
    >
      {icon && <span>{icon}</span>}
      {label}
      {count !== undefined && count > 0 && (
        <span style={{ display: 'inline-block', background: 'rgba(255,255,255,0.15)', borderRadius: '10px', padding: '1px 6px', fontSize: '10px', fontWeight: 800 }}>
          {count}
        </span>
      )}
    </button>
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

  // ── 24/7 Slider state ──
  const [slider247Index, setSlider247Index] = useState(0);

  // ── Hero carousel state (popular live matches) ──
  const [heroIndex, setHeroIndex] = useState(0);

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

  // Auto-rotate 24/7 slider
  useEffect(() => {
    if (STREAMS_247.length <= 1) return;
    const timer = setInterval(() => {
      setSlider247Index(prev => (prev + 1) % STREAMS_247.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [STREAMS_247.length]);

  // Auto-rotate hero carousel (popular live matches)
  useEffect(() => {
    const heroCount = Math.min(popularLive.length, 8);
    if (heroCount <= 1) return;
    const timer = setInterval(() => {
      setHeroIndex(prev => (prev + 1) % heroCount);
    }, 6000);
    return () => clearInterval(timer);
  }, [popularLive.length]);

  // Snapshot of sectionSubPage as a plain string for use in tab-button comparisons.
  // The early returns below narrow `sectionSubPage`'s literal-union type, which
  // would otherwise make later `=== "tv-channels"` / `=== "schedule"` / `=== "news"`
  // comparisons fail TypeScript's strict narrowing checks.
  const currentSubPage: string = sectionSubPage;

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
    <div style={{ minHeight: '100vh', background: '#0a0a0a', color: '#fff', fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", position: 'relative', paddingBottom: '40px' }}>
      {/* Style tag with ticker animation */}
      <style>{`
        @keyframes damitvTickerScroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        @keyframes damitvSpin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        .damitv-card-row::-webkit-scrollbar { display: none; }
        .damitv-card-row { -ms-overflow-style: none; scrollbar-width: none; }
        .damitv-spin { animation: damitvSpin 0.8s linear infinite; }
      `}</style>

      {/* News Ticker */}
      <NewsTicker articles={newsArticles} />

      {/* Sticky Top Navigation Bar */}
      <div style={{ position: 'sticky', top: '60px', zIndex: 40, background: '#0a0a0a', borderBottom: '1px solid #1a1a1a' }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '0 40px', display: 'flex', alignItems: 'center', gap: '12px', height: '56px' }}>
          {/* Home button */}
          <button
            onClick={() => { setSelectedSport("all"); setLiveOnly(false); setSectionSubPage("sports"); }}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', padding: '6px 10px', fontSize: '13px', fontWeight: 700 }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>
            Home
          </button>

          {/* Tab buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <button
              onClick={() => setSectionSubPage("sports")}
              style={{
                padding: '6px 12px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', borderRadius: '4px',
                background: (currentSubPage === "sports" || !currentSubPage || currentSubPage === "home") ? '#e8471b' : 'transparent',
                color: (currentSubPage === "sports" || !currentSubPage || currentSubPage === "home") ? '#fff' : '#888',
                border: 'none', textTransform: 'uppercase', letterSpacing: '0.04em',
              }}
            >⚽ Live Sports</button>
            <button
              onClick={() => setSectionSubPage("tv-channels")}
              style={{
                padding: '6px 12px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', borderRadius: '4px',
                background: currentSubPage === "tv-channels" ? '#e8471b' : 'transparent',
                color: currentSubPage === "tv-channels" ? '#fff' : '#888',
                border: 'none', textTransform: 'uppercase', letterSpacing: '0.04em',
              }}
            >📺 Live TV</button>
            <button
              onClick={() => setSectionSubPage("schedule")}
              style={{
                padding: '6px 12px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', borderRadius: '4px',
                background: currentSubPage === "schedule" ? '#e8471b' : 'transparent',
                color: currentSubPage === "schedule" ? '#fff' : '#888',
                border: 'none', textTransform: 'uppercase', letterSpacing: '0.04em',
              }}
            >📅 Schedule</button>
            <button
              onClick={() => setSectionSubPage("news")}
              style={{
                padding: '6px 12px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', borderRadius: '4px',
                background: currentSubPage === "news" ? '#e8471b' : 'transparent',
                color: currentSubPage === "news" ? '#fff' : '#888',
                border: 'none', textTransform: 'uppercase', letterSpacing: '0.04em',
              }}
            >📰 News</button>
          </div>

          {/* Divider */}
          <div style={{ width: '1px', height: '24px', background: '#333', flexShrink: 0 }} />

          {/* Live Only toggle */}
          <button
            onClick={() => setLiveOnly(!liveOnly)}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', fontSize: '12px', fontWeight: 700,
              cursor: 'pointer', borderRadius: '4px', border: 'none', textTransform: 'uppercase', letterSpacing: '0.04em',
              background: liveOnly ? 'rgba(220,38,38,0.15)' : 'transparent',
              color: liveOnly ? '#dc2626' : '#888',
              flexShrink: 0,
            }}
          >
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: liveOnly ? '#dc2626' : '#444' }} />
            Live only
          </button>

          {/* Divider */}
          <div style={{ width: '1px', height: '24px', background: '#333', flexShrink: 0 }} />

          {/* Sport category pills - horizontal scroll */}
          <div className="damitv-card-row" style={{ display: 'flex', alignItems: 'center', gap: '6px', overflowX: 'auto', flex: 1 }}>
            {displayCategories.map(cat => (
              <SportTag
                key={cat.id}
                label={cat.label}
                icon={cat.icon}
                active={selectedSport === cat.id}
                onClick={() => setSelectedSport(selectedSport === cat.id ? "all" : cat.id)}
                count={cat.liveCount}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Main content */}
      <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '24px 40px 0' }}>
        {/* Loading state */}
        {loading && matches.length === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 0', gap: '12px' }}>
            <div className="damitv-spin" style={{ width: '40px', height: '40px', borderRadius: '50%', border: '3px solid #222', borderTopColor: '#e8471b' }} />
            <p style={{ fontSize: '13px', color: '#888' }}>Loading live sports...</p>
            <p style={{ fontSize: '11px', color: '#555' }}>Fetching from multiple sources</p>
          </div>
        )}

        {/* Error state */}
        {error && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 0', gap: '12px' }}>
            <div style={{ fontSize: '48px' }}>⚠️</div>
            <p style={{ fontSize: '13px', color: '#888' }}>{error}</p>
            <button onClick={fetchData} style={{ padding: '8px 16px', borderRadius: '4px', background: '#e8471b', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 700 }}>Retry</button>
          </div>
        )}

        {!loading && (
          <>
            {/* Hero Carousel - popular live matches (400px height) */}
            {popularLive.length > 0 && (() => {
              const heroSlides = popularLive.slice(0, 8);
              return (
                <div style={{ position: 'relative', height: '400px', borderRadius: '10px', overflow: 'hidden', marginBottom: '40px', background: '#000' }}>
                  {heroSlides.map((match, i) => (
                    <div key={match.id} style={{ position: 'absolute', inset: 0, opacity: i === heroIndex ? 1 : 0, transition: 'opacity 0.6s ease', pointerEvents: i === heroIndex ? 'auto' : 'none' }}>
                      {match.poster ? (
                        <img src={match.poster} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                      ) : (
                        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: `linear-gradient(135deg, ${getSportColor(match.sport)}40, #000)` }}>
                          <span style={{ fontSize: '120px', opacity: 0.3 }}>{getSportIcon(match.sport)}</span>
                        </div>
                      )}
                      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.6) 40%, rgba(0,0,0,0.2) 70%, transparent 100%)' }} />
                      {/* Left-aligned content */}
                      <div style={{ position: 'absolute', inset: 0, padding: '40px', display: 'flex', alignItems: 'center' }}>
                        <div style={{ maxWidth: '500px' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#dc2626', color: '#fff', fontSize: '9px', fontWeight: 700, padding: '4px 10px', borderRadius: '3px', marginBottom: '14px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#fff' }} />
                            LIVE NOW
                          </span>
                          <h2 style={{ fontSize: '32px', fontWeight: 800, color: '#fff', margin: '0 0 12px', lineHeight: 1.2 }}>
                            {match.title}
                          </h2>
                          <p style={{ fontSize: '14px', color: '#e8471b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 24px' }}>
                            {match.league || match.sportName}
                          </p>
                          <button
                            onClick={() => handleWatchMatch(match)}
                            style={{ background: '#e8471b', color: '#fff', border: 'none', padding: '12px 32px', fontSize: '14px', fontWeight: 700, borderRadius: '4px', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.04em' }}
                          >
                            ▶ Watch Now
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                  {/* Prev/Next arrows */}
                  {heroSlides.length > 1 && (
                    <>
                      <button
                        onClick={() => setHeroIndex(prev => (prev - 1 + heroSlides.length) % heroSlides.length)}
                        style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(0,0,0,0.6)', border: '1px solid #333', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 5 }}
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M15 19l-7-7 7-7" /></svg>
                      </button>
                      <button
                        onClick={() => setHeroIndex(prev => (prev + 1) % heroSlides.length)}
                        style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(0,0,0,0.6)', border: '1px solid #333', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 5 }}
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M9 5l7 7-7 7" /></svg>
                      </button>
                      {/* Dots */}
                      <div style={{ position: 'absolute', bottom: '16px', left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: '8px', zIndex: 5 }}>
                        {heroSlides.map((_, i) => (
                          <button
                            key={i}
                            onClick={() => setHeroIndex(i)}
                            style={{ width: i === heroIndex ? '24px' : '8px', height: '8px', borderRadius: '4px', background: i === heroIndex ? '#e8471b' : 'rgba(255,255,255,0.3)', border: 'none', cursor: 'pointer', transition: 'all 0.3s', padding: 0 }}
                          />
                        ))}
                      </div>
                    </>
                  )}
                </div>
              );
            })()}

            {/* Sport category tags row (horizontal pills) */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '32px', overflowX: 'auto' }} className="damitv-card-row">
              {displayCategories.filter(c => c.id !== "all").map(cat => (
                <SportTag
                  key={cat.id}
                  label={cat.label}
                  icon={cat.icon}
                  active={selectedSport === cat.id}
                  onClick={() => setSelectedSport(selectedSport === cat.id ? "all" : cat.id)}
                  count={cat.liveCount}
                />
              ))}
            </div>

            {/* Trending Today section */}
            {popularLive.length > 0 && (
              <div style={{ marginBottom: '40px' }}>
                <SectionHeader label="Trending" title="Trending Today" />
                <CardRow onPrev={() => {}} onNext={() => {}}>
                  {popularLive.map(match => (
                    <MatchCard key={match.id} match={match} onWatch={handleWatchMatch} onWatchChannel={handleWatchTVFromMatch} variant="poster" />
                  ))}
                </CardRow>
              </div>
            )}

            {/* Live Now section */}
            {liveMatchesNoPopular.length > 0 && (
              <div style={{ marginBottom: '40px' }}>
                <SectionHeader label="Live" title="Live Now" />
                <CardRow onPrev={() => {}} onNext={() => {}}>
                  {liveMatchesNoPopular.map(match => (
                    <MatchCard key={match.id} match={match} onWatch={handleWatchMatch} onWatchChannel={handleWatchTVFromMatch} variant="poster" />
                  ))}
                </CardRow>
              </div>
            )}

            {/* Upcoming Matches section */}
            {todayUpcoming.length > 0 && (
              <div style={{ marginBottom: '40px' }}>
                <SectionHeader label="Schedule" title="Upcoming Matches" viewAll={() => setSectionSubPage("schedule")} />
                <CardRow onPrev={() => {}} onNext={() => {}}>
                  {todayUpcoming.map(match => (
                    <MatchCard key={match.id} match={match} onWatch={handleWatchMatch} onWatchChannel={handleWatchTVFromMatch} variant="poster" />
                  ))}
                </CardRow>
              </div>
            )}

            {/* 24/7 Streams section */}
            {STREAMS_247.length > 0 && (
              <div style={{ marginBottom: '40px' }}>
                <SectionHeader label="24/7" title="24/7 Streams" viewAll={() => setSectionSubPage("tv-channels")} />
                <div style={{ position: 'relative', height: '280px', borderRadius: '10px', overflow: 'hidden', marginBottom: '12px', background: '#000' }}>
                  {STREAMS_247.map((stream, i) => (
                    <div key={stream.id} style={{ position: 'absolute', inset: 0, opacity: i === slider247Index ? 1 : 0, transition: 'opacity 0.6s ease', pointerEvents: i === slider247Index ? 'auto' : 'none' }}>
                      <Stream247Card stream={stream} onWatch={handleWatch247} isActive={i === slider247Index} />
                    </div>
                  ))}
                  {STREAMS_247.length > 1 && (
                    <>
                      <button
                        onClick={() => setSlider247Index(prev => (prev - 1 + STREAMS_247.length) % STREAMS_247.length)}
                        style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(0,0,0,0.6)', border: '1px solid #333', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M15 19l-7-7 7-7" /></svg>
                      </button>
                      <button
                        onClick={() => setSlider247Index(prev => (prev + 1) % STREAMS_247.length)}
                        style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(0,0,0,0.6)', border: '1px solid #333', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M9 5l7 7-7 7" /></svg>
                      </button>
                    </>
                  )}
                </div>
                {STREAMS_247.length > 1 && (
                  <div style={{ display: 'flex', justifyContent: 'center', gap: '8px' }}>
                    {STREAMS_247.map((_, i) => (
                      <button
                        key={i}
                        onClick={() => setSlider247Index(i)}
                        style={{ width: i === slider247Index ? '24px' : '8px', height: '8px', borderRadius: '4px', background: i === slider247Index ? '#e8471b' : 'rgba(255,255,255,0.3)', border: 'none', cursor: 'pointer', transition: 'all 0.3s', padding: 0 }}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* News section */}
            <div style={{ marginBottom: '40px' }}>
              <SectionHeader label="News" title="Latest Sports News" viewAll={() => setSectionSubPage("news")} />
              {newsLoading && newsArticles.length === 0 ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
                  <div className="damitv-spin" style={{ width: '32px', height: '32px', borderRadius: '50%', border: '3px solid #222', borderTopColor: '#e8471b' }} />
                </div>
              ) : newsArticles.length > 0 ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
                  {newsArticles.slice(0, 8).map(article => (
                    <NewsCard key={article.id} article={article} onClick={setSelectedNewsArticle} />
                  ))}
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '40px', color: '#555', fontSize: '13px' }}>No news available</div>
              )}
            </div>

            {/* No matches */}
            {filteredMatches.length === 0 && !loading && !error && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 0', gap: '12px' }}>
                <div style={{ fontSize: '48px' }}>🏟️</div>
                <p style={{ fontSize: '14px', color: '#888' }}>No matches found</p>
                <p style={{ fontSize: '11px', color: '#555' }}>Try a different sport or check back later</p>
                <button
                  onClick={() => { setSelectedSport("all"); setLiveOnly(false); }}
                  style={{ padding: '8px 16px', borderRadius: '4px', background: '#e8471b', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 700 }}
                >
                  Show All
                </button>
              </div>
            )}

            {/* Last updated */}
            {lastUpdated && (
              <div style={{ textAlign: 'center', padding: '20px 0', fontSize: '11px', color: '#444' }}>
                Last updated {lastUpdated.toLocaleTimeString()} • Auto-refreshes every 60s
              </div>
            )}
          </>
        )}
      </div>

      {/* News Article Detail Modal */}
      {selectedNewsArticle && (
        <div
          onClick={() => setSelectedNewsArticle(null)}
          style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: '#141414', border: '1px solid #222', borderRadius: '12px', maxWidth: '640px', width: '100%', maxHeight: '85vh', overflowY: 'auto' }}
          >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid #222', position: 'sticky', top: 0, background: '#141414', zIndex: 2 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '10px', fontWeight: 800, color: '#e8471b', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  {selectedNewsArticle.sport || "NEWS"}
                </span>
                {selectedNewsArticle.author && (
                  <span style={{ fontSize: '11px', color: '#555' }}>by {selectedNewsArticle.author}</span>
                )}
              </div>
              <button
                onClick={() => setSelectedNewsArticle(null)}
                style={{ width: '28px', height: '28px', borderRadius: '4px', background: '#222', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            {/* Image */}
            {selectedNewsArticle.imageUrl && (
              <div style={{ position: 'relative', height: '220px', overflow: 'hidden' }}>
                <img
                  src={selectedNewsArticle.imageUrl}
                  alt=""
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, transparent 50%, #141414 100%)' }} />
              </div>
            )}
            {/* Content */}
            <div style={{ padding: '20px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#fff', margin: '0 0 8px', lineHeight: 1.3 }}>
                {selectedNewsArticle.headline}
              </h2>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', fontSize: '11px', color: '#555' }}>
                <span>{timeAgo(selectedNewsArticle.publishedAt)}</span>
                {selectedNewsArticle.editedAt && <span>(edited)</span>}
              </div>
              {newsArticleLoading ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '20px 0' }}>
                  <div className="damitv-spin" style={{ width: '16px', height: '16px', borderRadius: '50%', border: '2px solid #333', borderTopColor: '#e8471b' }} />
                  <span style={{ fontSize: '12px', color: '#888' }}>Loading article...</span>
                </div>
              ) : selectedNewsArticle.content ? (
                <div style={{ fontSize: '14px', color: '#bbb', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                  {selectedNewsArticle.content}
                </div>
              ) : selectedNewsArticle.description ? (
                <p style={{ fontSize: '14px', color: '#bbb', lineHeight: 1.6, margin: 0 }}>
                  {selectedNewsArticle.description}
                </p>
              ) : (
                <p style={{ fontSize: '14px', color: '#555' }}>No content available.</p>
              )}
              {/* Read more link */}
              <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid #222', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <a
                  href={selectedNewsArticle.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '4px', fontSize: '12px', fontWeight: 700, background: 'rgba(232,71,27,0.15)', color: '#e8471b', textDecoration: 'none' }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" /></svg>
                  Read Full Article
                </a>
                <button
                  onClick={() => setSelectedNewsArticle(null)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '4px', fontSize: '12px', fontWeight: 700, background: '#222', color: '#888', border: 'none', cursor: 'pointer' }}
                >
                  Close
                </button>
              </div>
              {/* Mentions */}
              {selectedNewsArticle.mentions && selectedNewsArticle.mentions.length > 0 && (
                <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #222' }}>
                  <p style={{ fontSize: '10px', fontWeight: 700, color: '#444', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 8px' }}>Mentions</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {selectedNewsArticle.mentions.map((mention, i) => (
                      <a
                        key={i}
                        href={mention.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ padding: '3px 8px', borderRadius: '3px', fontSize: '11px', fontWeight: 500, background: '#1a1a1a', color: '#888', textDecoration: 'none' }}
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
        <div onClick={() => setShowMoreDropdown(false)} style={{ position: 'fixed', inset: 0, zIndex: 30 }} />
      )}
    </div>
  );
}