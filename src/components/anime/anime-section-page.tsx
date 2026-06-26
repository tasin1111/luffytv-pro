"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useAppStore } from "./store";
import ContentCard from "./anime-card";
import BrowsePage from "./browse-page-new";
import type { MiruroAnimeResult } from "@/lib/miruro-api";

/* ═══════════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════════ */

type DiscoverTab = "trending" | "popular" | "topRated";

interface FeaturedAnime {
  id: number;
  title: { romaji?: string; english?: string; native?: string };
  bannerImage?: string;
  coverImage?: { extraLarge?: string; large?: string; medium?: string; color?: string };
  description?: string;
  type?: string;
  format?: string;
  episodes?: number;
  averageScore?: number;
  genres?: string[];
  season?: string;
  seasonYear?: number;
  status?: string;
}

interface SearchResultItem {
  id: number;
  title: { romaji?: string; english?: string; native?: string };
  coverImage?: { extraLarge?: string; large?: string; medium?: string };
  type?: string;
  format?: string;
  episodes?: number;
  seasonYear?: number;
  averageScore?: number;
  genres?: string[];
  status?: string;
  description?: string;
}

/* ═══════════════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════════════ */

function mapAniListToMiruro(items: any[]): MiruroAnimeResult[] {
  return items.map(item => {
    if (!item) return { id: 0, title: { romaji: "Unknown" } };
    return {
      id: item.id || 0,
      title: {
        romaji: typeof item.title?.romaji === "string" ? item.title.romaji : undefined,
        english: typeof item.title?.english === "string" ? item.title.english : undefined,
        native: typeof item.title?.native === "string" ? item.title.native : undefined,
      },
      coverImage: item.coverImage ? {
        extraLarge: typeof item.coverImage.extraLarge === "string" ? item.coverImage.extraLarge : undefined,
        large: typeof item.coverImage.large === "string" ? item.coverImage.large : undefined,
        medium: typeof item.coverImage.medium === "string" ? item.coverImage.medium : undefined,
        color: typeof item.coverImage.color === "string" ? item.coverImage.color : undefined,
      } : undefined,
      bannerImage: typeof item.bannerImage === "string" ? item.bannerImage : undefined,
      type: typeof item.type === "string" ? item.type : undefined,
      format: typeof item.format === "string" ? item.format : undefined,
      status: typeof item.status === "string" ? item.status : undefined,
      description: typeof item.description === "string" ? item.description : undefined,
      season: typeof item.season === "string" ? item.season : undefined,
      seasonYear: typeof item.seasonYear === "number" ? item.seasonYear : undefined,
      episodes: typeof item.episodes === "number" ? item.episodes : undefined,
      duration: typeof item.duration === "number" ? item.duration : undefined,
      genres: Array.isArray(item.genres) ? item.genres.filter((g: any) => typeof g === "string") : undefined,
      averageScore: typeof item.averageScore === "number" ? item.averageScore : undefined,
      popularity: typeof item.popularity === "number" ? item.popularity : undefined,
      trending: typeof item.trending === "number" ? item.trending : undefined,
      countryOfOrigin: typeof item.countryOfOrigin === "string" ? item.countryOfOrigin : undefined,
      isAdult: !!item.isAdult,
    };
  });
}

const ANIME_GENRES = [
  "Action", "Adventure", "Comedy", "Drama", "Fantasy", "Horror",
  "Mystery", "Romance", "Sci-Fi", "Slice of Life", "Sports",
  "Supernatural", "Thriller", "Ecchi", "Mecha", "Psychological",
  "Shounen", "Seinen", "Shoujo", "Isekai",
];

const GENRE_COLORS: Record<string, string> = {
  Action: "#ef4444", Adventure: "#f59e0b", Comedy: "#eab308",
  Drama: "#6366f1", Fantasy: "#ffffff", Horror: "#dc2626",
  Mystery: "#0ea5e9", Romance: "#ec4899", "Sci-Fi": "#06b6d4",
  "Slice of Life": "#10b981", Sports: "#22c55e", Supernatural: "#a855f7",
  Thriller: "#f97316", Ecchi: "#f43f5e", Mecha: "#64748b",
  Psychological: "#ffffff", Shounen: "#ef4444", Seinen: "#6366f1",
  Shoujo: "#ec4899", Isekai: "#ffffff",
};

const RANK_COLORS = [
  "#ffffff",
  "#FF6B00",
  "#FFB800",
  "#00D4AA",
  "#4A90E2",
  "#5dbbe4",
  "#e45d86",
  "#ffffff",
  "#6366f1",
  "#a855f7",
];

/* ─── Section Tag Config ─── */
const SECTION_TAGS: Record<string, { label: string; color: string }> = {
  trending: { label: "HOT", color: "#ffffff" },
  thisSeason: { label: "SEASONAL", color: "#00D4AA" },
  topRated: { label: "TOP", color: "#4A90E2" },
  nextSeason: { label: "UPCOMING", color: "#FF6B00" },
  topThisYear: { label: "TOP", color: "#4A90E2" },
  popular: { label: "HOT", color: "#ffffff" },
};

const GROTESK = "var(--font-space-grotesk), 'Space Grotesk', sans-serif";
const INTER = "var(--font-inter), 'Inter', sans-serif";

/* ═══════════════════════════════════════════════════════════════
   SECTION HEADER — Anikage-style with colored category tag
   ═══════════════════════════════════════════════════════════════ */

function SectionHeader({ title, tag, viewAllAction, children }: {
  title: string;
  tag?: { label: string; color: string };
  viewAllAction?: () => void;
  children?: React.ReactNode;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const scroll = (dir: "left" | "right") => {
    if (scrollRef.current) scrollRef.current.scrollBy({ left: dir === "left" ? -500 : 500, behavior: "smooth" });
  };

  return (
    <section className="mb-12">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          {tag && (
            <span
              className="shrink-0 px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider"
              style={{
                fontFamily: GROTESK,
                color: tag.color,
                backgroundColor: `${tag.color}15`,
                border: `1px solid ${tag.color}25`,
              }}
            >
              {tag.label}
            </span>
          )}
          <h2 className="text-lg sm:text-2xl font-semibold text-white tracking-tight" style={{ fontFamily: GROTESK }}>
            {title}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          {viewAllAction && (
            <button onClick={viewAllAction} className="text-xs font-medium text-[#AAAAAA] hover:text-white transition-colors mr-1 flex items-center gap-1" style={{ fontFamily: GROTESK }}>
              View All
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M9 5l7 7-7 7" /></svg>
            </button>
          )}
          <button onClick={() => scroll("left")} className="p-2 rounded-lg bg-white/[0.03] border border-white/[0.06] text-white/40 hover:text-white hover:bg-white/[0.06] transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M15 19l-7-7 7-7" /></svg>
          </button>
          <button onClick={() => scroll("right")} className="p-2 rounded-lg bg-white/[0.03] border border-white/[0.06] text-white/40 hover:text-white hover:bg-white/[0.06] transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M9 5l7 7-7 7" /></svg>
          </button>
        </div>
      </div>
      {children ? (
        <div ref={scrollRef} className="scroll-container flex gap-3 overflow-x-auto pb-2">
          {children}
        </div>
      ) : null}
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════
   FULL-SCREEN HERO — Anikuro-style with numbered thumbnails
   ═══════════════════════════════════════════════════════════════ */

function FullScreenHero({ items }: { items: FeaturedAnime[] }) {
  const [current, setCurrent] = useState(0);
  const navigate = useAppStore(s => s.navigate);

  useEffect(() => {
    if (items.length <= 1) return;
    const timer = setInterval(() => {
      setCurrent(prev => (prev + 1) % items.length);
    }, 8000);
    return () => clearInterval(timer);
  }, [items.length]);

  const anime = items[current];
  if (!anime) return null;

  const title = anime.title?.english || anime.title?.romaji || "Unknown";
  const banner = anime.bannerImage || anime.coverImage?.extraLarge || anime.coverImage?.large || "";

  return (
    <div className="relative w-full h-[72vh] sm:h-[90vh] lg:h-[100dvh] overflow-hidden group">
      {/* Background image */}
      {banner && (
        <img
          src={banner}
          alt={title}
          className="absolute inset-0 w-full h-full object-cover transition-all duration-1000 scale-105"
        />
      )}

      {/* Multi-layered gradient overlays */}
      <div className="absolute inset-0 bg-gradient-to-r from-[#0D0D0D] via-[#0D0D0D]/70 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#0D0D0D] via-[#0D0D0D]/40 to-transparent" />
      <div className="absolute inset-0 bg-black/15" />

      {/* Content at bottom-left */}
      <div className="absolute bottom-0 left-0 right-0 px-5 pb-20 sm:px-14 sm:pb-32 lg:px-14 lg:pb-36">
        {/* Trending badge + Rating */}
        <div className="flex items-center gap-2 mb-4">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold bg-[#ffffff]/20 text-[#ffffff] border border-[#ffffff]/25">
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 23c-3.2 0-6-3.2-6-7.8 0-3 2.4-6.6 6-11.2 3.6 4.6 6 8.2 6 11.2 0 4.6-2.8 7.8-6 7.8z"/></svg>
            Trending
          </span>
          {anime.status === "RELEASING" && (
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-semibold bg-[#00D4AA]/15 text-[#00D4AA] border border-[#00D4AA]/20 animate-pulse">
              Airing
            </span>
          )}
          {anime.averageScore && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-white/[0.08] border border-white/[0.12] text-white backdrop-blur-sm">
              <svg className="w-3.5 h-3.5 text-[#FFB800]" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
              {anime.averageScore}%
            </span>
          )}
        </div>

        {/* Title */}
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white line-clamp-2 mb-4 tracking-tight" style={{ fontFamily: GROTESK }}>
          {title}
        </h1>

        {/* Genre pills */}
        {anime.genres && anime.genres.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 mb-4">
            {anime.genres.slice(0, 4).map(g => (
              <span key={g} className="px-3 py-1 rounded-full text-[11px] font-medium bg-black/50 border border-white/10 text-white/75">
                {g}
              </span>
            ))}
          </div>
        )}

        {/* Description */}
        {anime.description && (
          <p className="text-sm text-[#AAAAAA] line-clamp-2 max-w-lg mb-6" style={{ fontFamily: INTER }}>
            {anime.description.replace(/<[^>]+>/g, "").slice(0, 180)}...
          </p>
        )}

        {/* CTA Buttons */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate({ page: "watch", id: String(anime.id), episode: 1 })}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-[#ffffff] text-white text-sm font-semibold hover:bg-[#d32f3f] transition-colors shadow-lg shadow-[#ffffff]/25"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3" /></svg>
            Watch Now
          </button>
          <button
            onClick={() => navigate({ page: "anime", id: String(anime.id) })}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-white/[0.08] text-white text-sm font-medium border border-white/[0.15] backdrop-blur-sm hover:bg-white/[0.12] transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            More Info
          </button>
        </div>
      </div>

      {/* ═══ Numbered thumbnail previews — bottom-right (Anikuro style) ═══ */}
      {items.length > 1 && (
        <div className="absolute bottom-6 right-5 sm:bottom-10 sm:right-14 flex items-end gap-2">
          {items.map((item, i) => {
            const thumb = item.coverImage?.medium || item.coverImage?.large || item.coverImage?.extraLarge || "";
            const isActive = i === current;
            return (
              <button
                key={i}
                onClick={() => setCurrent(i)}
                className={`relative shrink-0 rounded-lg overflow-hidden transition-all duration-300 ${
                  isActive
                    ? "w-[72px] h-[48px] sm:w-[90px] sm:h-[60px] ring-2 ring-[#ffffff] ring-offset-1 ring-offset-[#0D0D0D]"
                    : "w-[48px] h-[32px] sm:w-[60px] sm:h-[40px] opacity-50 hover:opacity-80"
                }`}
              >
                {thumb ? (
                  <img src={thumb} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full ltv-card-flat" />
                )}
                {/* Rank number overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent flex items-end justify-center pb-0.5">
                  <span className="text-[9px] sm:text-[10px] font-bold text-white" style={{ fontFamily: GROTESK }}>
                    {String(i + 1).padStart(2, "0")}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Navigation arrows — appear on hover */}
      <button
        onClick={() => setCurrent(prev => (prev - 1 + items.length) % items.length)}
        className="absolute left-4 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-black/40 backdrop-blur-sm border border-white/10 text-white/50 hover:text-white hover:bg-black/60 transition-all opacity-0 group-hover:opacity-100"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M15 19l-7-7 7-7" /></svg>
      </button>
      <button
        onClick={() => setCurrent(prev => (prev + 1) % items.length)}
        className="absolute right-4 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-black/40 backdrop-blur-sm border border-white/10 text-white/50 hover:text-white hover:bg-black/60 transition-all opacity-0 group-hover:opacity-100"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M9 5l7 7-7 7" /></svg>
      </button>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   FEATURED ANIME — Large detailed card (from Anikage)
   ═══════════════════════════════════════════════════════════════ */

function FeaturedAnimeCard({ anime }: { anime: MiruroAnimeResult | null }) {
  const navigate = useAppStore(s => s.navigate);
  if (!anime) return null;

  const title = anime.title?.english || anime.title?.romaji || "Unknown";
  const image = anime.coverImage?.extraLarge || anime.coverImage?.large || anime.coverImage?.medium || "";
  const banner = anime.bannerImage || image;
  const score = anime.averageScore;
  const type = anime.format || anime.type;
  const episodes = anime.episodes;
  const genres = anime.genres || [];
  const description = anime.description;
  const status = anime.status;
  const season = anime.season;
  const seasonYear = anime.seasonYear;

  return (
    <div className="relative rounded-2xl overflow-hidden border border-white/[0.06] ltv-card-flat/60 backdrop-blur-sm group">
      {/* Background blur image */}
      {banner && (
        <div className="absolute inset-0 opacity-20">
          <img src={banner} alt="" className="w-full h-full object-cover blur-2xl scale-110" />
        </div>
      )}
      <div className="absolute inset-0 bg-gradient-to-r from-[#1A1A1A] via-[#1A1A1A]/90 to-[#1A1A1A]/70" />

      <div className="relative z-10 flex flex-col sm:flex-row gap-6 p-5 sm:p-6">
        {/* Poster */}
        <div className="shrink-0 w-[160px] sm:w-[200px] mx-auto sm:mx-0">
          <div className="aspect-[2/3] rounded-xl overflow-hidden border border-white/[0.08] shadow-2xl shadow-black/50">
            {image && <img src={image} alt={title} className="w-full h-full object-cover" />}
          </div>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0 py-1">
          {/* Tag + Score */}
          <div className="flex items-center gap-2 mb-3">
            <span className="px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-[#ffffff]/15 text-[#ffffff] border border-[#ffffff]/25" style={{ fontFamily: GROTESK }}>
              #1 Trending
            </span>
            {status === "RELEASING" && (
              <span className="px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-[#00D4AA]/15 text-[#00D4AA] border border-[#00D4AA]/25" style={{ fontFamily: GROTESK }}>
                Airing
              </span>
            )}
          </div>

          {/* Title */}
          <h2 className="text-2xl sm:text-3xl font-bold text-white line-clamp-2 mb-3 tracking-tight" style={{ fontFamily: GROTESK }}>
            {title}
          </h2>

          {/* Score + Meta */}
          <div className="flex items-center gap-4 mb-3">
            {score && (
              <div className="flex items-center gap-2">
                <div className="w-11 h-11 rounded-full border-2 border-[#FFB800] flex items-center justify-center bg-[#FFB800]/10">
                  <span className="text-sm font-bold text-[#FFB800]" style={{ fontFamily: GROTESK }}>{score}%</span>
                </div>
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2 text-xs text-[#AAAAAA]" style={{ fontFamily: INTER }}>
              {type && <span className="px-2 py-0.5 rounded bg-white/[0.06] border border-white/[0.08] text-white font-medium">{type}</span>}
              {episodes && <span>{episodes} Episodes</span>}
              {season && <span>{season.charAt(0) + season.slice(1).toLowerCase()} {seasonYear}</span>}
            </div>
          </div>

          {/* Genre tags */}
          {genres.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 mb-3">
              {genres.slice(0, 5).map(g => {
                const color = GENRE_COLORS[g] || "#ffffff";
                return (
                  <span
                    key={g}
                    className="px-2.5 py-0.5 rounded-full text-[10px] font-medium"
                    style={{
                      fontFamily: GROTESK,
                      color,
                      backgroundColor: `${color}12`,
                      border: `1px solid ${color}20`,
                    }}
                  >
                    {g}
                  </span>
                );
              })}
            </div>
          )}

          {/* Synopsis */}
          {description && (
            <p className="text-sm text-[#AAAAAA] line-clamp-3 max-w-xl mb-4" style={{ fontFamily: INTER }}>
              {description.replace(/<[^>]+>/g, "").slice(0, 240)}...
            </p>
          )}

          {/* CTA Buttons */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate({ page: "watch", id: String(anime.id), episode: 1 })}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#ffffff] text-white text-sm font-semibold hover:bg-[#d32f3f] transition-colors shadow-lg shadow-[#ffffff]/20"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3" /></svg>
              Watch Now
            </button>
            <button
              onClick={() => navigate({ page: "anime", id: String(anime.id) })}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-white/[0.08] text-white text-sm font-medium border border-white/[0.12] hover:bg-white/[0.12] transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              Details
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   GENRE PILLS — Horizontal scrollable (from Anikage)
   ═══════════════════════════════════════════════════════════════ */

function GenrePillsRow({ onGenreClick }: { onGenreClick: (genre: string) => void }) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-2 scroll-container">
      {ANIME_GENRES.map(genre => {
        const color = GENRE_COLORS[genre] || "#ffffff";
        return (
          <button
            key={genre}
            onClick={() => onGenreClick(genre)}
            className="group relative shrink-0 px-4 py-2 rounded-full text-[12px] font-medium border transition-all hover:scale-105"
            style={{
              fontFamily: GROTESK,
              color,
              borderColor: `${color}25`,
              backgroundColor: `${color}08`,
            }}
          >
            {/* Hover glow */}
            <div
              className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none rounded-full"
              style={{ boxShadow: `0 0 20px ${color}30, inset 0 0 20px ${color}08` }}
            />
            <span className="relative z-[1]">{genre}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   TOP 10 LIST — Enhanced with accent bar + larger ranks + icon header
   ═══════════════════════════════════════════════════════════════ */

function RankedListItem({ anime, rank }: { anime: MiruroAnimeResult; rank: number }) {
  const navigate = useAppStore(s => s.navigate);
  const title = anime.title?.english || anime.title?.romaji || "Unknown";
  const image = anime.coverImage?.extraLarge || anime.coverImage?.large || anime.coverImage?.medium || "";
  const score = anime.averageScore;
  const type = anime.format || anime.type;
  const episodes = anime.episodes;
  const status = anime.status;
  const color = RANK_COLORS[rank - 1] || RANK_COLORS[9];
  const season = anime.season;

  return (
    <button
      onClick={() => navigate({ page: "anime", id: String(anime.id) })}
      className="w-full flex items-center gap-3 p-2.5 pr-4 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.08] hover:border-white/[0.12] transition-all duration-150 group text-left relative overflow-hidden"
    >
      {/* Colored accent bar on left */}
      <div
        className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l-xl"
        style={{ backgroundColor: color }}
      />

      {/* Rank number — large and prominent */}
      <span
        className="text-2xl sm:text-3xl font-black shrink-0 w-10 text-center pl-1"
        style={{ fontFamily: GROTESK, color }}
      >
        {rank}
      </span>

      {/* Thumbnail */}
      <div className="h-[70px] w-[55px] sm:h-[85px] sm:w-[60px] rounded-lg overflow-hidden shrink-0 bg-white/[0.02]">
        {image && <img src={image} alt={title} className="w-full h-full object-cover" loading="lazy" />}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <h3 className="text-sm font-medium text-white line-clamp-1 transition-colors"
          onMouseEnter={e => (e.currentTarget.style.color = color)}
          onMouseLeave={e => (e.currentTarget.style.color = '')}
        >
          {title}
        </h3>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-xs text-[#666666]">
            {season ? season.charAt(0) + season.slice(1).toLowerCase() : ""}{anime.seasonYear ? ` · ${anime.seasonYear}` : ""}
          </span>
          <span className="text-xs" style={{ color: status === "RELEASING" ? "#00D4AA" : status === "FINISHED" ? "#4A90E2" : "#666666" }}>
            {status === "RELEASING" ? "Airing" : status === "FINISHED" ? "Finished" : ""}
          </span>
        </div>
        {score && (
          <div className="flex items-center gap-1 mt-1">
            <svg className="w-3 h-3 text-[#FFB800]" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
            <span className="text-xs font-semibold text-[#FFB800]">{score}%</span>
          </div>
        )}
      </div>

      {/* Right side: type + episodes */}
      <div className="shrink-0 text-right hidden sm:block">
        <div className="text-xs font-semibold text-white">{type || ""}</div>
        <div className="text-xs text-[#666666]">{episodes ? `${episodes} eps` : ""}</div>
      </div>
    </button>
  );
}

function Top10Section({ items, title }: { items: MiruroAnimeResult[]; title: string }) {
  return (
    <div>
      {/* Header with trophy icon */}
      <div className="flex items-center gap-2.5 mb-4">
        <div className="w-8 h-8 rounded-lg bg-[#FFB800]/15 flex items-center justify-center border border-[#FFB800]/25">
          <svg className="w-4.5 h-4.5 text-[#FFB800]" viewBox="0 0 24 24" fill="currentColor">
            <path d="M5 3h14l-2 4H7L5 3zm0 6h14v1c0 4.42-3.58 8-8 8s-8-3.58-8-8V9zm7 9v4H8v1h8v-1h-4v-4c3.87-.5 7-3.58 7-8V9l-2-4H7L5 9v1c0 4.42 3.13 7.5 7 8z"/>
          </svg>
        </div>
        <h2 className="text-lg sm:text-2xl font-bold text-white tracking-tight" style={{ fontFamily: GROTESK }}>
          {title}
        </h2>
        <span className="px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider bg-[#FFB800]/15 text-[#FFB800] border border-[#FFB800]/25" style={{ fontFamily: GROTESK }}>
          TOP 10
        </span>
      </div>
      <div className="space-y-2">
        {items.slice(0, 10).map((anime, i) => (
          <RankedListItem key={`${anime.id}-${i}`} anime={anime} rank={i + 1} />
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SCHEDULE SUB-PAGE — Shiroko-style time-grouped layout
   ═══════════════════════════════════════════════════════════════ */

function CountdownTimer({ airingAt }: { airingAt: number }) {
  const [now, setNow] = useState(Math.floor(Date.now() / 1000));

  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Math.floor(Date.now() / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const diff = airingAt - now;
  if (diff <= 0) {
    return (
      <span className="text-[10px] font-bold text-[#00D4AA] animate-pulse" style={{ fontFamily: GROTESK }}>
        AIRING NOW
      </span>
    );
  }

  const days = Math.floor(diff / 86400);
  const hours = Math.floor((diff % 86400) / 3600);
  const minutes = Math.floor((diff % 3600) / 60);
  const seconds = diff % 60;

  const pad = (n: number) => String(n).padStart(2, "0");

  if (days > 0) {
    return (
      <span className="text-[10px] font-bold text-[#FF6B00]/80" style={{ fontFamily: GROTESK }}>
        {days}d {pad(hours)}h {pad(minutes)}m
      </span>
    );
  }

  return (
    <span className="text-[10px] font-bold text-[#FF6B00]/80" style={{ fontFamily: GROTESK }}>
      {pad(hours)}:{pad(minutes)}:{pad(seconds)}
    </span>
  );
}

function SchedulePage() {
  const navigate = useAppStore(s => s.navigate);
  const [schedule, setSchedule] = useState<Record<string, any[]>>({});
  const [days, setDays] = useState<string[]>([]);
  const [dayLabels, setDayLabels] = useState<Record<string, string>>({});
  const [activeDay, setActiveDay] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/anime/anilist-schedule");
        if (res.ok) {
          const data = await res.json();
          setSchedule(data.schedule || {});
          setDays(data.days || []);
          setDayLabels(data.dayLabels || {});
          if (data.days?.length > 0) {
            setActiveDay(data.days[0]);
          }
        }
      } catch (err) {
        console.error("[Schedule] Load error:", err);
      }
      setLoading(false);
    }
    load();
  }, []);

  const dayEntries = activeDay ? (schedule[activeDay] || []) : [];

  // Group entries by time
  const timeGroups: Record<string, any[]> = {};
  dayEntries.forEach((entry: any) => {
    const time = entry.airTime || "Unknown";
    if (!timeGroups[time]) timeGroups[time] = [];
    timeGroups[time].push(entry);
  });

  const parseDayKey = (key: string) => {
    const [name, date] = key.split("|");
    return { name: name || key, date: date || "" };
  };

  const isToday = (key: string) => {
    const { date } = parseDayKey(key);
    const todayStr = new Date().toISOString().split("T")[0];
    return date === todayStr;
  };

  // Find next upcoming entry for countdown
  const now = Math.floor(Date.now() / 1000);
  const nextUpcoming = dayEntries.find((entry: any) => entry.airingAt && entry.airingAt > now);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-xl sm:text-2xl font-semibold text-white tracking-tight" style={{ fontFamily: GROTESK }}>
          Upcoming Schedule
        </h2>
        <p className="text-sm text-[#666666] mt-1" style={{ fontFamily: INTER }}>
          Track your favorite anime releases — one week ahead
        </p>
        {nextUpcoming && (
          <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#FF6B00]/10 border border-[#FF6B00]/20">
            <svg className="w-3.5 h-3.5 text-[#FF6B00]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
            <span className="text-xs text-[#AAAAAA]">Next:</span>
            <span className="text-xs font-medium text-white line-clamp-1">
              {nextUpcoming.media?.title?.english || nextUpcoming.media?.title?.romaji || "Unknown"}
            </span>
            <CountdownTimer airingAt={nextUpcoming.airingAt} />
          </div>
        )}
      </div>

      {/* Day tabs — glass pills with "All" tab */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scroll-container">
        <button
          onClick={() => {
            // Show all days' entries combined
            const allEntries: any[] = [];
            days.forEach(dk => { allEntries.push(...(schedule[dk] || [])); });
            // We'll just set activeDay to empty for "All" — but need a special handler
            setActiveDay("");
          }}
          className={`shrink-0 flex flex-col items-center gap-1 px-4 py-3 rounded-xl border transition-all ${
            activeDay === ""
              ? "bg-[#4A90E2]/15 border-[#4A90E2]/25 text-white"
              : "bg-white/[0.02] border-white/[0.04] text-[#666666] hover:bg-white/[0.05] hover:text-white/75"
          }`}
        >
          <span className="text-[11px] font-semibold" style={{ fontFamily: GROTESK }}>All</span>
        </button>
        {days.map(dayKey => {
          const { name: dayName, date: dateStr } = parseDayKey(dayKey);
          const count = (schedule[dayKey] || []).length;
          const isActive = activeDay === dayKey;
          const today = isToday(dayKey);

          return (
            <button
              key={dayKey}
              onClick={() => setActiveDay(dayKey)}
              className={`shrink-0 flex flex-col items-center gap-1 px-4 py-3 rounded-xl border transition-all ${
                isActive
                  ? today
                    ? "bg-[#00D4AA]/15 border-[#00D4AA]/25 text-white"
                    : "bg-white/[0.08] border-white/[0.15] text-white"
                  : "bg-white/[0.02] border-white/[0.04] text-[#666666] hover:bg-white/[0.05] hover:text-white/75"
              }`}
            >
              <span className="text-[11px] font-semibold" style={{ fontFamily: GROTESK }}>
                {today ? "Today" : dayName.slice(0, 3)}
              </span>
              {dateStr && (
                <span className="text-[9px] text-[#666666]">{dateStr}</span>
              )}
              <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${count > 0 ? (isActive ? "bg-[#00D4AA]/15 text-[#00D4AA]" : "bg-white/[0.04] text-[#666666]") : "bg-white/[0.02] text-[#666666]"}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Schedule entries — time-grouped (Shiroko style) */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 p-4 rounded-xl bg-white/[0.03] border border-white/[0.06]">
              <div className="w-16 skeleton rounded-lg h-5" />
              <div className="w-12 h-16 skeleton rounded-lg" />
              <div className="flex-1 space-y-2">
                <div className="w-48 h-4 skeleton rounded" />
                <div className="w-32 h-3 skeleton rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : (activeDay === "" ? Object.entries(schedule).flatMap(([, entries]) => entries) : dayEntries).length === 0 ? (
        <div className="text-center py-16 ltv-card-flat/40 rounded-2xl border border-white/[0.06]">
          <svg className="w-12 h-12 mx-auto text-[#666666] mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          <p className="text-[#666666] text-sm">No episodes scheduled for this day</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Group by time if a specific day is selected */}
          {activeDay !== "" ? (
            Object.entries(timeGroups).map(([time, entries]) => (
              <div key={time}>
                {/* Time heading — H3 */}
                <h3 className="text-sm font-bold text-[#AAAAAA] mb-3 flex items-center gap-2" style={{ fontFamily: GROTESK }}>
                  <div className="w-1.5 h-1.5 rounded-full bg-[#00D4AA]" />
                  {time}
                </h3>
                <div className="space-y-2">
                  {entries.map((entry: any) => {
                    const media = entry.media;
                    if (!media) return null;
                    const entryTitle = media.title?.english || media.title?.romaji || "Unknown";
                    const entryImage = media.coverImage?.extraLarge || media.coverImage?.large || media.coverImage?.medium || "";
                    const entryScore = media.averageScore;
                    const entryType = media.format || media.type;
                    const entryDuration = media.duration;
                    const entryGenres = media.genres || [];
                    const entryStatus = media.status;

                    return (
                      <div
                        key={entry.id}
                        className="flex items-start gap-4 p-4 rounded-xl ltv-card-flat/40 border border-white/[0.06] hover:ltv-card-flat/70 hover:border-white/[0.1] transition-all group"
                      >
                        {/* Poster */}
                        <div className="w-14 h-20 rounded-lg overflow-hidden shrink-0 ltv-card-flat">
                          {entryImage && <img src={entryImage} alt={entryTitle} className="w-full h-full object-cover" loading="lazy" />}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#4A90E2]/15 text-[#4A90E2] border border-[#4A90E2]/25" style={{ fontFamily: GROTESK }}>
                              EP {entry.episode}
                            </span>
                            {entryType && (
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white/[0.06] border border-white/[0.08] text-[#AAAAAA]" style={{ fontFamily: GROTESK }}>
                                {entryType}
                              </span>
                            )}
                            {entryStatus === "RELEASING" && (
                              <span className="text-[10px] font-semibold text-[#00D4AA]" style={{ fontFamily: GROTESK }}>Airing</span>
                            )}
                          </div>
                          <h4
                            className="text-sm font-medium text-white line-clamp-1 group-hover:text-[#4A90E2] transition-colors cursor-pointer"
                            onClick={() => navigate({ page: "anime", id: String(media.id) })}
                          >
                            {entryTitle}
                          </h4>

                          <div className="flex items-center gap-2 mt-1">
                            {entryDuration && (
                              <span className="text-[9px] text-[#666666]">{entryDuration}min</span>
                            )}
                            {entryScore && (
                              <span className="flex items-center gap-0.5 text-[10px] font-semibold text-[#FFB800]">
                                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                                {entryScore}%
                              </span>
                            )}
                          </div>

                          {/* Genre pills */}
                          {entryGenres.length > 0 && (
                            <div className="flex flex-wrap items-center gap-1.5 mt-2">
                              {entryGenres.slice(0, 3).map((g: string) => {
                                const gc = GENRE_COLORS[g] || "#ffffff";
                                return (
                                  <span key={g} className="px-1.5 py-0.5 rounded-full text-[8px] font-medium" style={{ color: gc, backgroundColor: `${gc}10`, border: `1px solid ${gc}18` }}>
                                    {g}
                                  </span>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        {/* Countdown + Watch */}
                        <div className="shrink-0 flex flex-col items-end gap-2 pt-1">
                          <CountdownTimer airingAt={entry.airingAt} />
                          <button
                            onClick={() => navigate({ page: "watch", id: String(media.id), episode: Number(entry.episode) || 1 })}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#ffffff]/15 border border-[#ffffff]/25 text-[#ffffff] text-[11px] font-medium hover:bg-[#ffffff]/25 transition-colors"
                            style={{ fontFamily: GROTESK }}
                          >
                            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3" /></svg>
                            Watch
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          ) : (
            /* "All" tab — simple list without time grouping */
            <div className="space-y-2">
              {Object.entries(schedule).flatMap(([dayKey, entries]) =>
                (entries as any[]).map((entry: any) => {
                  const media = entry.media;
                  if (!media) return null;
                  const entryTitle = media.title?.english || media.title?.romaji || "Unknown";
                  const entryImage = media.coverImage?.extraLarge || media.coverImage?.large || media.coverImage?.medium || "";
                  const entryType = media.format || media.type;
                  const { name: dayName } = parseDayKey(dayKey);

                  return (
                    <div
                      key={`${dayKey}-${entry.id}`}
                      className="flex items-center gap-4 p-3 rounded-xl ltv-card-flat/40 border border-white/[0.06] hover:ltv-card-flat/70 transition-all group"
                    >
                      <span className="shrink-0 text-[10px] font-bold text-[#666666] w-12" style={{ fontFamily: GROTESK }}>{entry.airTime}</span>
                      <div className="w-10 h-14 rounded-md overflow-hidden shrink-0 ltv-card-flat">
                        {entryImage && <img src={entryImage} alt={entryTitle} className="w-full h-full object-cover" loading="lazy" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-xs font-medium text-white line-clamp-1 group-hover:text-[#4A90E2] transition-colors cursor-pointer" onClick={() => navigate({ page: "anime", id: String(media.id) })}>
                          {entryTitle}
                        </h4>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[9px] text-[#666666]">{dayName.slice(0, 3)}</span>
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-[#4A90E2]/10 text-[#4A90E2]" style={{ fontFamily: GROTESK }}>EP {entry.episode}</span>
                          {entryType && <span className="text-[9px] text-[#666666]">{entryType}</span>}
                        </div>
                      </div>
                      <CountdownTimer airingAt={entry.airingAt} />
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   BROWSE GENRES SUB-PAGE — Redesigned with gradient cards
   ═══════════════════════════════════════════════════════════════ */

function BrowseGenresPage() {
  const navigate = useAppStore(s => s.navigate);
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);
  const [genreResults, setGenreResults] = useState<MiruroAnimeResult[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!selectedGenre) return;
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/anime/genre?genre=${encodeURIComponent(selectedGenre!)}`);
        if (res.ok) {
          const data = await res.json();
          if (!cancelled) {
            setGenreResults((data.anime || data.results || []).map((a: any) => ({
              id: a.id || a._id || 0,
              title: {
                romaji: typeof a.name === "string" ? a.name : "Unknown",
                english: typeof (a.englishName || a.name) === "string" ? (a.englishName || a.name) : "Unknown",
              },
              coverImage: a.thumbnail ? { extraLarge: a.thumbnail, large: a.thumbnail } : undefined,
              averageScore: typeof a.score === "number" ? Math.round(a.score * 10) : undefined,
              type: typeof a.type === "string" ? a.type : undefined,
              status: typeof a.status === "string" ? a.status : undefined,
              genres: Array.isArray(a.genres) ? a.genres.filter((g: any) => typeof g === "string") : undefined,
            })));
          }
        }
      } catch { /* ignore */ }
      if (!cancelled) setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [selectedGenre]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-xl sm:text-2xl font-semibold text-white tracking-tight" style={{ fontFamily: GROTESK }}>
          Browse Genres
        </h2>
        <p className="text-sm text-[#666666] mt-1" style={{ fontFamily: INTER }}>
          Discover anime by your favorite genre
        </p>
      </div>

      {/* Genre grid — larger cards with gradient backgrounds */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
        {ANIME_GENRES.map(genre => {
          const isActive = selectedGenre === genre;
          const color = GENRE_COLORS[genre] || "#ffffff";
          return (
            <button
              key={genre}
              onClick={() => setSelectedGenre(isActive ? null : genre)}
              className={`group relative flex items-center justify-center p-5 rounded-xl border transition-all duration-300 hover:scale-[1.03] overflow-hidden ${
                isActive
                  ? "border-white/[0.15]"
                  : "border-white/[0.06] hover:border-white/[0.1]"
              }`}
              style={{
                backgroundColor: isActive ? `${color}15` : '#1A1A1A',
              }}
            >
              {/* Gradient background with genre color */}
              <div
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                style={{ background: `linear-gradient(135deg, ${color}20 0%, ${color}05 50%, transparent 100%)` }}
              />
              {/* Glow effect */}
              <div
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                style={{ boxShadow: `inset 0 0 40px ${color}10, 0 0 30px ${color}08` }}
              />
              <span
                className="relative z-[1] text-sm font-bold transition-colors"
                style={{
                  fontFamily: GROTESK,
                  color: isActive ? color : "#AAAAAA",
                }}
              >
                {genre}
              </span>
              {/* Active indicator dot */}
              {isActive && (
                <div className="absolute top-2 right-2 w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
              )}
            </button>
          );
        })}
      </div>

      {/* Genre results */}
      {selectedGenre && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-white" style={{ fontFamily: GROTESK }}>
              {selectedGenre} Anime
            </h3>
            <span className="text-xs text-[#666666]">({genreResults.length})</span>
          </div>

          {loading ? (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-3">
              {Array.from({ length: 14 }).map((_, i) => (
                <div key={i} className="aspect-[2/3] skeleton rounded-xl" />
              ))}
            </div>
          ) : genreResults.length > 0 ? (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-3">
              {genreResults.map((anime, i) => (
                <div key={`${anime.id}-${i}`} className="shrink-0">
                  <ContentCard anime={anime} index={i} />
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 ltv-card-flat/40 rounded-2xl border border-white/[0.06]">
              <p className="text-[#666666] text-sm">No anime found for this genre</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN ANIME SECTION PAGE
   ═══════════════════════════════════════════════════════════════ */

export default function AnimeSectionPage() {
  const navigate = useAppStore(s => s.navigate);
  const subPage = useAppStore(s => s.sectionSubPage);
  const setSectionSubPage = useAppStore(s => s.setSectionSubPage);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResultItem[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchDropdownOpen, setSearchDropdownOpen] = useState(false);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // Close search dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setSearchDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Debounced live search
  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    if (!searchQuery.trim()) return;
    let cancelled = false;
    searchDebounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/anime/search?q=${encodeURIComponent(searchQuery.trim())}`);
        if (res.ok && !cancelled) {
          const data = await res.json();
          const results: SearchResultItem[] = data.results || [];
          setSearchResults(results);
          setSearchDropdownOpen(results.length > 0);
        }
      } catch {
        if (!cancelled) setSearchResults([]);
      }
      if (!cancelled) setSearchLoading(false);
    }, 350);
    return () => {
      cancelled = true;
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, [searchQuery]);

  // Data states
  const [featured, setFeatured] = useState<FeaturedAnime[]>([]);
  const [trending, setTrending] = useState<MiruroAnimeResult[]>([]);
  const [popular, setPopular] = useState<MiruroAnimeResult[]>([]);
  const [topRated, setTopRated] = useState<MiruroAnimeResult[]>([]);
  const [thisSeason, setThisSeason] = useState<MiruroAnimeResult[]>([]);
  const [nextSeason, setNextSeason] = useState<MiruroAnimeResult[]>([]);
  const [topThisYear, setTopThisYear] = useState<MiruroAnimeResult[]>([]);
  const [discoverTab, setDiscoverTab] = useState<DiscoverTab>("trending");
  const [loading, setLoading] = useState(true);

  // Load all data
  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [trendingRes, seasonRes] = await Promise.all([
          fetch("/api/anime/anilist-trending").catch(() => null),
          fetch("/api/anime/anilist-trending?section=season").catch(() => null),
        ]);

        let tData: any = null;
        if (trendingRes?.ok) {
          try { tData = await trendingRes.json(); } catch { tData = null; }
        }

        let sData: any = null;
        if (seasonRes?.ok) {
          try { sData = await seasonRes.json(); } catch { sData = null; }
        }

        // Trending
        const trendingData = tData?.trending || [];
        if (trendingData.length > 0) {
          setTrending(mapAniListToMiruro(trendingData));
          setFeatured(trendingData.slice(0, 5).filter((a: any) => a.bannerImage || a.coverImage?.extraLarge));
        }

        // Popular
        const popularData = tData?.popular || [];
        if (popularData.length > 0) {
          setPopular(mapAniListToMiruro(popularData));
        }

        // Top Rated
        const topRatedData = tData?.topRated || [];
        if (topRatedData.length > 0) {
          setTopRated(mapAniListToMiruro(topRatedData));
          setTopThisYear(mapAniListToMiruro(topRatedData));
        }

        // This Season
        const seasonData = sData?.season || [];
        if (seasonData.length > 0) {
          setThisSeason(mapAniListToMiruro(seasonData));
        }

        // Next Season
        const now = new Date();
        const currentMonth = now.getMonth();
        let nextSeasonName: string;
        let nextSeasonYear: number;
        if (currentMonth >= 0 && currentMonth <= 2) { nextSeasonName = "SPRING"; nextSeasonYear = now.getFullYear(); }
        else if (currentMonth >= 3 && currentMonth <= 5) { nextSeasonName = "SUMMER"; nextSeasonYear = now.getFullYear(); }
        else if (currentMonth >= 6 && currentMonth <= 8) { nextSeasonName = "FALL"; nextSeasonYear = now.getFullYear(); }
        else { nextSeasonName = "WINTER"; nextSeasonYear = now.getFullYear() + 1; }

        try {
          const nextRes = await fetch(`/api/anime/anilist-trending?section=season&season=${nextSeasonName}&year=${nextSeasonYear}`);
          if (nextRes.ok) {
            const nextData = await nextRes.json();
            if (nextData.season?.length > 0) {
              setNextSeason(mapAniListToMiruro(nextData.season));
            }
          }
        } catch { /* ignore */ }

      } catch (err) {
        console.error("[AnimeSection] Load error:", err);
      }
      setLoading(false);
    }
    load();
  }, []);

  // Search handler
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate({ page: "search", query: searchQuery.trim() });
      setSearchQuery("");
    }
  };

  // Get discover data based on active tab
  const discoverData = discoverTab === "trending" ? trending : discoverTab === "popular" ? popular : topRated;

  // Featured anime (top trending)
  const featuredAnime = trending.length > 0 ? trending[0] : null;

  const navItems = [
    { key: "home", label: "Home" },
    { key: "browse", label: "Browse" },
    { key: "schedule", label: "Schedule" },
    { key: "genres", label: "Genres" },
  ] as const;

  // Early return for browse sub-page
  if (subPage === "browse") {
    return <BrowsePage />;
  }

  return (
    <div className="lu-page" style={{ paddingTop: '0px', overflowX: 'hidden', width: '100%', maxWidth: '100vw', boxSizing: 'border-box', background: '#0D0D0D' }}>

      {/* ═══════════════════════════════════════════
          FULL-SCREEN HERO (only on home sub-page)
          ═══════════════════════════════════════════ */}
      {subPage === "home" && (
        <>
          {loading ? (
            <div className="w-full h-[72vh] sm:h-[90vh] lg:h-[100dvh] ltv-card-flat skeleton" />
          ) : featured.length > 0 ? (
            <FullScreenHero items={featured} />
          ) : (
            <div className="w-full h-[72vh] sm:h-[90vh] lg:h-[100dvh] bg-black flex items-center justify-center">
              <div className="text-center px-6">
                <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white tracking-tight mb-4" style={{ fontFamily: GROTESK }}>
                  Discover Anime
                </h1>
                <p className="text-[#AAAAAA] text-sm max-w-md mx-auto" style={{ fontFamily: INTER }}>
                  Explore trending, popular, and top-rated anime. Stream in sub, dub, or Hindi.
                </p>
              </div>
            </div>
          )}

          {/* Search bar overlay on hero */}
          <div className="relative z-20 -mt-16 sm:-mt-20 px-5 sm:px-14 lg:px-14 pb-4">
            <div ref={searchContainerRef} className="relative z-[100] max-w-2xl">
              <form onSubmit={handleSearch} className="flex items-center gap-3">
                <div className="flex-1 flex items-center gap-3 px-4 py-3 rounded-xl ltv-card-flat/80 border border-white/[0.1] focus-within:border-[#ffffff]/40 focus-within:ltv-card-flat/90 transition-all backdrop-blur-md">
                  <svg className="w-4 h-4 text-[#666666] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                  <input
                    value={searchQuery}
                    onChange={e => { setSearchQuery(e.target.value); if (!e.target.value.trim()) setSearchDropdownOpen(false); }}
                    onFocus={() => { if (searchResults.length > 0 && searchQuery.trim()) setSearchDropdownOpen(true); }}
                    placeholder="Search for anime..."
                    className="flex-1 bg-transparent text-white placeholder-[#666666] text-sm outline-none"
                    style={{ fontFamily: INTER }}
                  />
                  {searchLoading && (
                    <svg className="w-4 h-4 text-[#ffffff] animate-spin shrink-0" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                  )}
                  {searchQuery && !searchLoading && (
                    <button type="button" onClick={() => { setSearchQuery(""); setSearchResults([]); setSearchDropdownOpen(false); }} className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[#666666] hover:text-white hover:bg-white/[0.08] transition-colors">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M18 6L6 18M6 6l12 12" /></svg>
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setSectionSubPage("genres")}
                  className="shrink-0 flex items-center gap-2 px-4 py-3 rounded-xl ltv-card-flat/80 border border-white/[0.1] hover:border-white/[0.15] text-[#666666] hover:text-white transition-colors backdrop-blur-md"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path d="M3 4h18M3 8h12M3 12h18M3 16h6" />
                  </svg>
                  <span className="text-sm font-medium hidden sm:inline">Filters</span>
                </button>
              </form>

              {/* Live search dropdown */}
              {searchDropdownOpen && searchResults.length > 0 && (() => {
                const bgItem = searchResults.find(r => r.coverImage?.extraLarge) || searchResults[0];
                const bgImage = bgItem?.coverImage?.extraLarge || bgItem?.coverImage?.large || "";
                return (
                <div className="absolute left-0 right-0 top-full mt-2 z-[200] rounded-xl border border-white/[0.08] shadow-[0_8px_40px_rgba(0,0,0,0.7)] overflow-hidden backdrop-blur-xl ltv-card-flat/95">
                  <div className="relative z-10">
                    <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/[0.06]">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-[#666666]" style={{ fontFamily: GROTESK }}>Results</span>
                      <button type="button" onClick={() => setSearchDropdownOpen(false)} className="w-5 h-5 rounded-full flex items-center justify-center text-[#666666] hover:text-white hover:bg-white/[0.08] transition-colors">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M18 6L6 18M6 6l12 12" /></svg>
                      </button>
                    </div>
                    <div className="max-h-80 overflow-y-auto scroll-container">
                      {searchResults.slice(0, 10).map((item) => {
                        const itemTitle = item.title?.english || item.title?.romaji || item.title?.native || "Unknown";
                        const thumb = item.coverImage?.medium || item.coverImage?.large || item.coverImage?.extraLarge || "";
                        const formatLabel = item.format || item.type || "ANIME";
                        const formatShort = formatLabel === "TV_SHORT" ? "TV SHORT" : formatLabel === "MOVIE" ? "MOVIE" : formatLabel === "OVA" ? "OVA" : formatLabel === "ONA" ? "ONA" : formatLabel === "TV" ? "TV" : formatLabel;
                        const metaParts: string[] = [];
                        if (formatShort) metaParts.push(formatShort);
                        if (item.seasonYear) metaParts.push(String(item.seasonYear));
                        if (item.episodes) metaParts.push(`${item.episodes} ep${item.episodes > 1 ? "s" : ""}`);
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => {
                              navigate({ page: "anime", id: String(item.id) });
                              setSearchDropdownOpen(false);
                              setSearchQuery("");
                              setSearchResults([]);
                            }}
                            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/[0.06] transition-colors text-left group"
                          >
                            <div className="w-10 h-14 rounded-md overflow-hidden shrink-0 ltv-card-flat border border-white/[0.04]">
                              {thumb && <img src={thumb} alt={itemTitle} className="w-full h-full object-cover" loading="lazy" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-[13px] font-medium text-white line-clamp-1 group-hover:text-[#ffffff] transition-colors">{itemTitle}</p>
                              <p className="text-[11px] text-[#666666] mt-0.5" style={{ fontFamily: GROTESK }}>{metaParts.join(" · ")}</p>
                            </div>
                            {item.averageScore != null && item.averageScore > 0 && (
                              <div className="flex items-center gap-1 shrink-0">
                                <svg className="w-3.5 h-3.5 text-[#FFB800]" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                                <span className="text-[11px] font-semibold text-[#FFB800]">{item.averageScore}%</span>
                              </div>
                            )}
                            <svg className="w-3.5 h-3.5 text-[#666666] group-hover:text-[#ffffff]/50 shrink-0 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M9 5l7 7-7 7" /></svg>
                          </button>
                        );
                      })}
                    </div>
                    <div className="border-t border-white/[0.06] px-4 py-2.5">
                      <button type="button" onClick={() => { handleSearch(new Event("submit") as any); setSearchDropdownOpen(false); }} className="text-[10px] font-semibold uppercase tracking-wider text-[#ffffff]/60 hover:text-[#ffffff] transition-colors" style={{ fontFamily: GROTESK }}>
                        View all results →
                      </button>
                    </div>
                  </div>
                </div>
                );
              })()}
            </div>
          </div>
        </>
      )}

      {/* ═══════════════════════════════════════════
          CONTENT AREA
          ═══════════════════════════════════════════ */}
      <div className="pl-0 max-w-[1400px] mx-auto px-5 sm:px-14 lg:px-14 py-8" style={{ position: "relative", zIndex: 1 }}>

        {/* ═══════════════════════════════════════════
            SUB-PAGES
            ═══════════════════════════════════════════ */}

        {subPage === "schedule" && <SchedulePage />}
        {subPage === "genres" && <BrowseGenresPage />}

        {subPage === "home" && (
          <>
            {loading ? (
              <div className="space-y-8">
                {/* Featured skeleton */}
                <div className="h-[250px] skeleton rounded-2xl" />
                {/* Genre pills skeleton */}
                <div className="flex gap-2">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="h-9 w-24 skeleton rounded-full shrink-0" />
                  ))}
                </div>
                {/* Top 10 skeleton */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <div className="w-48 h-6 skeleton rounded" />
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} className="h-[70px] skeleton rounded-xl" />
                    ))}
                  </div>
                  <div className="space-y-2">
                    <div className="w-48 h-6 skeleton rounded" />
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} className="h-[70px] skeleton rounded-xl" />
                    ))}
                  </div>
                </div>
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="space-y-4">
                    <div className="w-48 h-6 skeleton rounded" />
                    <div className="flex gap-3 overflow-hidden">
                      {Array.from({ length: 7 }).map((_, j) => (
                        <div key={j} className="shrink-0 w-[160px] aspect-[2/3] skeleton rounded-xl" />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-12">

                {/* ═══════════════════════════════════════════
                    FEATURED ANIME CARD
                    ═══════════════════════════════════════════ */}
                {featuredAnime && (
                  <FeaturedAnimeCard anime={featuredAnime} />
                )}

                {/* ═══════════════════════════════════════════
                    GENRE PILLS ROW
                    ═══════════════════════════════════════════ */}
                <section>
                  <GenrePillsRow onGenreClick={() => setSectionSubPage("genres")} />
                </section>

                {/* ═══════════════════════════════════════════
                    SPLIT LAYOUT: Top 10 LEFT + Popular This Season RIGHT
                    ═══════════════════════════════════════════ */}
                {(topRated.length > 0 || thisSeason.length > 0) && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {topRated.length > 0 && (
                      <div className="ltv-card-flat/40 rounded-2xl border border-white/[0.06] p-4 sm:p-6">
                        <Top10Section items={topRated} title="Top 10 Anime" />
                      </div>
                    )}
                    {thisSeason.length > 0 && (
                      <div className="ltv-card-flat/40 rounded-2xl border border-white/[0.06] p-4 sm:p-6">
                        <Top10Section items={thisSeason} title="Popular This Season" />
                      </div>
                    )}
                  </div>
                )}

                {/* ═══════════════════════════════════════════
                    DISCOVER ANIME (with tabs)
                    ═══════════════════════════════════════════ */}
                <section>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2.5">
                      <span
                        className="px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider"
                        style={{
                          fontFamily: GROTESK,
                          color: "#ffffff",
                          backgroundColor: "#ffffff15",
                          border: "1px solid #ffffff25",
                        }}
                      >
                        HOT
                      </span>
                      <h2 className="text-lg sm:text-2xl font-semibold text-white tracking-tight" style={{ fontFamily: GROTESK }}>
                        Discover Anime
                      </h2>
                    </div>
                    {/* Tabs */}
                    <div className="flex items-center gap-1 ltv-card-flat/60 rounded-full p-0.5 border border-white/[0.06]">
                      {(["trending", "popular", "topRated"] as const).map(tab => {
                        const tabColors: Record<string, string> = {
                          trending: "#ffffff",
                          popular: "#FF6B00",
                          topRated: "#4A90E2",
                        };
                        const isActive = discoverTab === tab;
                        return (
                          <button
                            key={tab}
                            onClick={() => setDiscoverTab(tab)}
                            className={`px-3 py-1.5 rounded-full text-[11px] font-medium transition-colors ${
                              isActive
                                ? "text-white"
                                : "text-[#666666] hover:text-[#AAAAAA]"
                            }`}
                            style={isActive ? {
                              backgroundColor: `${tabColors[tab]}20`,
                              border: `1px solid ${tabColors[tab]}30`,
                              color: tabColors[tab],
                            } : { border: "1px solid transparent" }}
                          >
                            {tab === "topRated" ? "Top Rated" : tab.charAt(0).toUpperCase() + tab.slice(1)}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div className="scroll-container flex gap-3 overflow-x-auto pb-2">
                    {discoverData.slice(0, 20).map((anime, i) => (
                      <div key={`${anime.id}-${i}`} className="shrink-0 w-[140px] sm:w-[160px] lg:w-[180px]">
                        <ContentCard anime={anime} index={i} />
                      </div>
                    ))}
                  </div>
                </section>

                {/* ═══════════════════════════════════════════
                    THIS SEASON — with SEASONAL tag
                    ═══════════════════════════════════════════ */}
                {thisSeason.length > 0 && (
                  <SectionHeader
                    title="Popular This Season"
                    tag={SECTION_TAGS.thisSeason}
                    viewAllAction={() => setSectionSubPage("browse")}
                  >
                    {thisSeason.slice(0, 20).map((anime, i) => (
                      <div key={`season-${anime.id}-${i}`} className="shrink-0 w-[140px] sm:w-[160px] lg:w-[180px]">
                        <ContentCard anime={anime} index={i} />
                      </div>
                    ))}
                  </SectionHeader>
                )}

                {/* ═══════════════════════════════════════════
                    NEXT SEASON — with UPCOMING tag
                    ═══════════════════════════════════════════ */}
                {nextSeason.length > 0 && (
                  <SectionHeader
                    title="Next Season"
                    tag={SECTION_TAGS.nextSeason}
                    viewAllAction={() => setSectionSubPage("browse")}
                  >
                    {nextSeason.slice(0, 20).map((anime, i) => (
                      <div key={`next-${anime.id}-${i}`} className="shrink-0 w-[140px] sm:w-[160px] lg:w-[180px]">
                        <ContentCard anime={anime} index={i} />
                      </div>
                    ))}
                  </SectionHeader>
                )}

                {/* ═══════════════════════════════════════════
                    TOP THIS YEAR — with TOP tag
                    ═══════════════════════════════════════════ */}
                {topThisYear.length > 0 && (
                  <SectionHeader
                    title="Top This Year"
                    tag={SECTION_TAGS.topThisYear}
                    viewAllAction={() => setSectionSubPage("browse")}
                  >
                    {topThisYear.slice(0, 20).map((anime, i) => (
                      <div key={`topyear-${anime.id}-${i}`} className="shrink-0 w-[140px] sm:w-[160px] lg:w-[180px]">
                        <ContentCard anime={anime} index={i} />
                      </div>
                    ))}
                  </SectionHeader>
                )}

                {/* ═══════════════════════════════════════════
                    POPULAR GENRES — redesigned as pill grid
                    ═══════════════════════════════════════════ */}
                <section>
                  <div className="flex items-center gap-2.5 mb-4">
                    <span
                      className="px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider"
                      style={{
                        fontFamily: GROTESK,
                        color: "#ffffff",
                        backgroundColor: "#ffffff15",
                        border: "1px solid #ffffff25",
                      }}
                    >
                      GENRES
                    </span>
                    <h2 className="text-lg sm:text-2xl font-semibold text-white tracking-tight" style={{ fontFamily: GROTESK }}>
                      Popular Genres
                    </h2>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {ANIME_GENRES.map(genre => {
                      const color = GENRE_COLORS[genre] || "#ffffff";
                      return (
                        <button
                          key={genre}
                          onClick={() => {
                            setSectionSubPage("genres");
                          }}
                          className="group relative px-4 py-2 rounded-full text-[12px] font-medium border transition-all hover:scale-105"
                          style={{
                            fontFamily: GROTESK,
                            color,
                            borderColor: `${color}25`,
                            backgroundColor: `${color}08`,
                          }}
                        >
                          {/* Hover glow */}
                          <div
                            className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none rounded-full"
                            style={{ boxShadow: `0 0 20px ${color}30, inset 0 0 20px ${color}08` }}
                          />
                          <span className="relative z-[1]">{genre}</span>
                        </button>
                      );
                    })}
                  </div>
                </section>

                {/* Empty state */}
                {!loading && trending.length === 0 && popular.length === 0 && topRated.length === 0 && (
                  <div className="text-center py-20 ltv-card-flat/40 rounded-2xl border border-white/[0.06]">
                    <div className="space-y-4">
                      <div className="w-16 h-16 mx-auto rounded-full bg-[#ffffff]/10 flex items-center justify-center">
                        <svg className="w-8 h-8 text-[#ffffff]/50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                        </svg>
                      </div>
                      <p className="text-[#666666] text-sm">Loading anime from backup sources...</p>
                      <button
                        onClick={() => window.location.reload()}
                        className="px-4 py-2 text-xs font-medium bg-[#ffffff]/15 text-[#ffffff] rounded-full hover:bg-[#ffffff]/25 transition-colors border border-[#ffffff]/25"
                        style={{ fontFamily: GROTESK }}
                      >
                        Refresh Page
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
