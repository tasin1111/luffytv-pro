"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useAppStore } from "./store";
import type { MiruroAnimeResult } from "@/lib/miruro-api";
import BrowsePage from "./browse-page";
import SchedulePage from "./schedule-page";
import AnimeHoverCard from "./anime-hover-card";
import WatchPageExtras from "./watch-page-extras";

type DiscoverTab = "season" | "topRated" | "popular";
type SubPage = "home" | "browse" | "schedule";

interface FeaturedAnime {
  id: number;
  title: { romaji?: string; english?: string; native?: string };
  bannerImage?: string;
  coverImage?: { extraLarge?: string; large?: string; medium?: string; color?: string };
  description?: string;
  format?: string;
  episodes?: number;
  averageScore?: number;
  genres?: string[];
  season?: string;
  seasonYear?: number;
  status?: string;
  nextAiringEpisode?: { episode: number; airingAt: number };
}

interface AnimeItem {
  id: number;
  title: { romaji?: string; english?: string; native?: string };
  coverImage?: { extraLarge?: string; large?: string; medium?: string };
  bannerImage?: string;
  format?: string;
  episodes?: number;
  seasonYear?: number;
  averageScore?: number;
  genres?: string[];
  status?: string;
  description?: string;
  nextAiringEpisode?: { episode: number; airingAt: number };
}

/* ═══════════════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════════════ */

function getTitle(a: any): string {
  return a?.title?.english || a?.title?.romaji || a?.title?.native || "Unknown";
}

function getBanner(a: any): string {
  // Prefer bannerImage (high quality), then extraLarge cover
  const banner = a?.bannerImage;
  if (banner) return banner;
  // Fallback to cover image (extra large)
  return a?.coverImage?.extraLarge || a?.coverImage?.large || "";
}

function getCover(a: any): string {
  return a?.coverImage?.extraLarge || a?.coverImage?.large || a?.coverImage?.medium || "";
}

function getScore(a: any): number {
  const s = a?.averageScore;
  if (!s) return 0;
  return s > 100 ? Math.round(s / 10) : s;
}

/* ═══════════════════════════════════════════════════════════════
   HERO CAROUSEL — Full-screen featured anime
   ═══════════════════════════════════════════════════════════════ */

function HeroCarousel({ items, navigate }: { items: FeaturedAnime[]; navigate: (r: any) => void }) {
  const [current, setCurrent] = useState(0);
  const [paused, setPaused] = useState(false);
  const [logos, setLogos] = useState<Record<number, string>>({});
  const [backdrops, setBackdrops] = useState<Record<number, string>>({});
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch TMDB logos + backdrops for featured anime
  useEffect(() => {
    items.forEach(async (anime) => {
      if (logos[anime.id]) return;
      try {
        const title = getTitle(anime);
        const res = await fetch(`/api/anime/tmdb-images?anilistId=${anime.id}&title=${encodeURIComponent(title)}`);
        if (res.ok) {
          const data = await res.json();
          if (data.logoUrl) setLogos(prev => ({ ...prev, [anime.id]: data.logoUrl }));
          if (data.backdropUrl) setBackdrops(prev => ({ ...prev, [anime.id]: data.backdropUrl }));
        }
      } catch {}
    });
  }, [items]);

  useEffect(() => {
    if (paused || items.length === 0) return;
    timerRef.current = setTimeout(() => {
      setCurrent(prev => (prev + 1) % items.length);
    }, 8000);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [current, paused, items.length]);

  if (items.length === 0) {
    return (
      <div className="relative w-full h-screen bg-black flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-white/10 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  const anime = items[current];
  // Use TMDB backdrop if available, otherwise AniList banner
  // TMDB backdrop only — NO AniList fallback (user requested removal)
  const banner = backdrops[anime.id] || anime.bannerImage || getBanner(anime) || "";
  const logoUrl = logos[anime.id];
  const title = getTitle(anime);
  const score = getScore(anime);
  const seasonStr = anime.season && anime.seasonYear ? `${anime.season} ${anime.seasonYear}` : anime.seasonYear ? String(anime.seasonYear) : "";
  const description = anime.description ? anime.description.replace(/<[^>]*>/g, "") : "";

  return (
    <div
      className="relative w-full h-screen overflow-hidden bg-black"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Background image — FULL SCREEN, smooth crossfade transition */}
      {banner && (
        <img
          src={banner}
          alt=""
          className="absolute inset-0 w-full h-full object-cover object-center"
          style={{ animation: "ltv-hero-crossfade 1.2s ease-in-out" }}
          key={`bg-${current}`}
        />
      )}
      {/* Gradient overlays — darker at bottom for text readability */}
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-transparent to-transparent" />

      {/* Content — bottom left, with smooth slide+fade transition */}
      <div
        className="absolute bottom-0 left-0 right-0 p-6 md:p-12 lg:p-16 pb-16"
        key={`content-${current}`}
        style={{ animation: "ltv-hero-content-slide 1s ease-out" }}
      >
        <div className="max-w-2xl space-y-3">
          {/* TMDB Logo — small like AniLight */}
          {logoUrl && (
            <img
              src={logoUrl}
              alt={title}
              className="max-w-[340px] max-h-[110px] mb-3 drop-shadow-lg"
              style={{ objectFit: "contain", objectPosition: "left" }}
            />
          )}

          {/* Title — shown if no TMDB logo */}
          {!logoUrl && (
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-extrabold text-white leading-[1.05] tracking-tight">
              {title}
            </h1>
          )}

          {/* Meta row */}
          <div className="flex items-center gap-3 flex-wrap text-sm text-white/70">
            {score > 0 && (
              <span className="flex items-center gap-1">
                <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
                {score}%
              </span>
            )}
            {seasonStr && <span>{seasonStr}</span>}
            {anime.format && <span>{anime.format}</span>}
            {anime.episodes && <span>{anime.episodes} eps</span>}
            {anime.status === "RELEASING" && (
              <span className="flex items-center gap-1 text-white">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                Airing
              </span>
            )}
          </div>

          {/* Genres */}
          {anime.genres && anime.genres.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              {anime.genres.slice(0, 4).map(g => (
                <span key={g} className="px-3 py-1 text-xs font-medium text-white/60 border border-white/15 rounded-full">
                  {g}
                </span>
              ))}
            </div>
          )}

          {/* Synopsis — always show, clearly visible */}
          {description && (
            <p className="text-sm md:text-base text-white/70 leading-relaxed line-clamp-3 max-w-xl drop-shadow-md">
              {description}
            </p>
          )}

          {/* Action buttons — square shaped, Netflix-style */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* Watch Now — starts playing episode 1 */}
            <button
              onClick={() => navigate({ page: "watch", id: String(anime.id), episode: 1, title: title, image: getCover(anime) })}
              className="inline-flex items-center gap-2 px-8 py-3 bg-white text-black font-bold text-sm hover:bg-white/90 transition-colors"
              style={{ borderRadius: "4px" }}
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3" /></svg>
              Watch Now
            </button>

            {/* More Info — goes to anime detail/info page */}
            <button
              onClick={() => navigate({ page: "anime", id: String(anime.id) })}
              className="inline-flex items-center gap-2 px-6 py-3 bg-white/15 text-white font-bold text-sm hover:bg-white/25 backdrop-blur-sm transition-colors border border-white/20"
              style={{ borderRadius: "4px" }}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="16" x2="12" y2="12" />
                <line x1="12" y1="8" x2="12.01" y2="8" />
              </svg>
              More Info
            </button>
          </div>
        </div>
      </div>

      {/* Navigation dots */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2">
        {items.slice(0, 8).map((_, i) => (
          <button
            key={i}
            onClick={() => setCurrent(i)}
            className={`h-1.5 rounded-full transition-all ${i === current ? "w-8 bg-white" : "w-1.5 bg-white/30"}`}
          />
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   TOP TRENDING — with ranking numbers (Netflix-style)
   Large white numbers overlap the bottom-left of each poster card.
   ═══════════════════════════════════════════════════════════════ */

type TrendingTab = "trending" | "topRated" | "upcoming" | "newest";

function TopTrending({ trending, topRated, navigate }: {
  trending: AnimeItem[];
  topRated: AnimeItem[];
  navigate: (r: any) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [tab, setTab] = useState<TrendingTab>("trending");

  // Build data for each tab
  const upcoming = trending.filter(a => a.status === "NOT_YET_RELEASED");
  const newest = [...trending].sort((a, b) => (b.id as number) - (a.id as number));
  const tabData: Record<TrendingTab, AnimeItem[]> = {
    trending,
    topRated,
    upcoming: upcoming.length > 0 ? upcoming : trending,
    newest: newest.length > 0 ? newest : trending,
  };
  const items = (tabData[tab] || trending).slice(0, 10);

  if (items.length === 0) return null;

  const scroll = (dir: "left" | "right") => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: dir === "right" ? 700 : -700, behavior: "smooth" });
    }
  };

  return (
    <section className="px-4 md:px-8 lg:px-8 py-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
            <path d="M13.5.67s.74 2.65.74 4.8c0 2.06-1.35 3.73-3.41 3.73-2.07 0-3.63-1.67-3.63-3.73l.03-.36C5.21 7.51 4 10.62 4 14c0 4.42 3.58 8 8 8s8-3.58 8-8C20 8.61 17.41 3.8 13.5.67zM11.71 19c-1.78 0-3.22-1.4-3.22-3.14 0-1.62 1.05-2.76 2.81-3.12 1.77-.36 3.6-1.21 4.62-2.58.39 1.29.59 2.65.59 4.04 0 2.65-2.15 4.8-4.8 4.8z" />
          </svg>
          <h2 className="text-xl font-bold text-white">Top Trending</h2>
          {/* Tabs — right next to the title */}
          <div className="flex gap-1 ml-4">
            {([
              { id: "trending" as const, label: "Trending" },
              { id: "topRated" as const, label: "Top Rated" },
              { id: "upcoming" as const, label: "Upcoming" },
              { id: "newest" as const, label: "Newest" },
            ]).map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`px-3 py-1.5 text-xs font-semibold transition-colors ${tab === t.id ? "bg-white text-black" : "text-white/40 hover:text-white"}`}
                style={{ borderRadius: "4px" }}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => scroll("left")} className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/60 hover:text-white transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M15 19l-7-7 7-7" /></svg>
          </button>
          <button onClick={() => scroll("right")} className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/60 hover:text-white transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M9 5l7 7-7 7" /></svg>
          </button>
        </div>
      </div>
      {/* Cards row — overflow visible so numbers can extend outside the card */}
      <div ref={scrollRef} className="flex gap-4 overflow-x-auto pb-2" style={{ scrollbarWidth: "none" }}>
        {items.map((anime, idx) => {
          const cover = getCover(anime);
          const title = getTitle(anime);
          const score = getScore(anime);
          const rank = idx + 1;
          return (
            <button
              key={`${tab}-${anime.id}-${idx}`}
              onClick={() => navigate({ page: "anime", id: String(anime.id) })}
              className="group shrink-0 text-left"
              style={{ width: "170px" }}
            >
              {/* Card — overflow VISIBLE so number extends half outside */}
              <div className="relative w-full aspect-[2/3] bg-white/5 overflow-visible" style={{ borderRadius: "8px" }}>
                {/* Poster image — clipped to rounded corners separately */}
                <div className="absolute inset-0 overflow-hidden" style={{ borderRadius: "8px" }}>
                  {cover ? (
                    <img src={cover} alt={title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-white/10 font-bold text-2xl">{title.charAt(0)}</div>
                  )}
                  <div className="absolute bottom-0 left-0 right-0 h-1/3 bg-gradient-to-t from-black/50 to-transparent" />
                </div>
                {/* Ranking number — aligned to bottom-left of card, italic, clean edges */}
                <span
                  className="absolute select-none"
                  style={{
                    fontSize: "75px",
                    fontStyle: "italic",
                    fontWeight: 900,
                    lineHeight: "0.85",
                    color: "#c8c8c8",
                    WebkitTextStroke: "2px #0a0a0a",
                    paintOrder: "stroke fill",
                    left: "4px",
                    bottom: "4px",
                    zIndex: 20,
                    fontFamily: "Arial Black, Impact, sans-serif",
                    letterSpacing: "-0.05em",
                    textShadow: "3px 3px 0 #0a0a0a",
                  }}
                >
                  {rank}
                </span>
                {/* Score badge */}
                {score > 0 && (
                  <div className="absolute top-2 right-2 px-2 py-0.5 bg-black/80 backdrop-blur-sm text-xs font-bold text-white z-30" style={{ borderRadius: "3px" }}>
                    ★ {score}%
                  </div>
                )}
              </div>
              {/* Title + meta below the card */}
              <div className="mt-2.5">
                <p className="text-sm font-semibold text-white truncate group-hover:text-white/80 transition-colors">{title}</p>
                <p className="text-xs text-white/40 mt-0.5">
                  {anime.format || "TV"} {anime.seasonYear ? `· ${anime.seasonYear}` : ""}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════
   FEATURED ANIME — Full-width rounded card with backdrop, poster, info
   Random popular anime suggested on each page load.
   ═══════════════════════════════════════════════════════════════ */

function FeaturedAnimeSection({ trending, navigate }: { trending: AnimeItem[]; navigate: (r: any) => void }) {
  const [anime, setAnime] = useState<AnimeItem | null>(null);
  const [backdrop, setBackdrop] = useState<string>("");
  const [logo, setLogo] = useState<string>("");

  // Pick a random popular anime on mount (different each page load)
  useEffect(() => {
    if (trending.length === 0) return;
    // Pick from top 15 trending (popular enough to have good backdrops)
    const pool = trending.filter(a => a.bannerImage || a.coverImage?.extraLarge);
    if (pool.length === 0) return;
    const random = pool[Math.floor(Math.random() * Math.min(pool.length, 15))];
    setAnime(random);
  }, [trending]);

  // Fetch TMDB backdrop + logo for the selected anime
  useEffect(() => {
    if (!anime) return;
    let cancelled = false;
    async function fetchTmdb() {
      if (!anime) return;
      try {
        const title = getTitle(anime);
        const res = await fetch(`/api/anime/tmdb-images?anilistId=${anime.id}&title=${encodeURIComponent(title)}`);
        if (res.ok && !cancelled) {
          const data = await res.json();
          if (data.backdropUrl) setBackdrop(data.backdropUrl);
          if (data.logoUrl) setLogo(data.logoUrl);
        }
      } catch {}
    }
    fetchTmdb();
    return () => { cancelled = true; };
  }, [anime]);

  if (!anime) return null;

  const title = getTitle(anime);
  const cover = getCover(anime);
  const score = getScore(anime);
  const description = anime.description ? anime.description.replace(/<[^>]*>/g, "") : "";
  const bgImage = backdrop || anime.bannerImage || cover || "";

  return (
    <section className="px-4 md:px-8 lg:px-8 py-4">
      <div className="relative w-full overflow-hidden" style={{ borderRadius: "20px", minHeight: "300px" }}>
        {/* Background image — anime backdrop */}
        {bgImage && (
          <img
            src={bgImage}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
            loading="lazy"
          />
        )}
        {/* Dark gradient overlay for text readability */}
        <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/50 to-black/20" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />

        {/* Content — poster on left, info on right */}
        <div className="relative flex items-center gap-6 p-6 md:p-8 lg:p-10" style={{ zIndex: 10 }}>
          {/* Poster — original size */}
          <div className="shrink-0 w-[120px] h-[170px] md:w-[150px] md:h-[210px] overflow-hidden" style={{ borderRadius: "12px" }}>
            {cover && (
              <img src={cover} alt={title} className="w-full h-full object-cover" loading="lazy" />
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0 space-y-3">
            {/* Header: "Featured Anime" + Editor's Pick badge — INSIDE the card */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <svg className="w-4 h-4 text-orange-400" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
                <span className="text-xs font-bold text-white/60 uppercase tracking-wider">Featured Anime</span>
              </div>
              <span className="px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider bg-white/10 text-white/50 border border-white/10">
                Editor's Pick
              </span>
            </div>

            {/* Title (or TMDB logo) — bigger */}
            {logo ? (
              <img src={logo} alt={title} className="max-w-[420px] max-h-[110px]" style={{ objectFit: "contain", objectPosition: "left" }} />
            ) : (
              <h2 className="text-2xl md:text-3xl lg:text-4xl font-extrabold text-white leading-tight tracking-tight">{title}</h2>
            )}

            {/* Score + genres */}
            <div className="flex items-center gap-3 flex-wrap">
              {score > 0 && (
                <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-orange-500/20 border border-orange-500/30">
                  <svg className="w-3.5 h-3.5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                  <span className="text-sm font-bold text-yellow-400">{score}%</span>
                </div>
              )}
              {anime.genres && anime.genres.slice(0, 3).map(g => (
                <span key={g} className="px-2.5 py-1 rounded-lg text-xs font-medium text-white/60 bg-white/5 border border-white/10">
                  {g}
                </span>
              ))}
            </div>

            {/* Description */}
            {description && (
              <p className="text-sm text-white/50 leading-relaxed line-clamp-2 max-w-xl">
                {description.slice(0, 200)}{description.length > 200 ? "..." : ""}
              </p>
            )}

            {/* Buttons */}
            <div className="flex items-center gap-3 pt-1">
              <button
                onClick={() => navigate({ page: "watch", id: String(anime.id), episode: 1, title, image: cover })}
                className="inline-flex items-center gap-2 px-6 py-2.5 bg-white text-black font-bold text-sm hover:bg-white/90 transition-colors"
                style={{ borderRadius: "8px" }}
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3" /></svg>
                Watch Now
              </button>
              <button
                onClick={() => navigate({ page: "anime", id: String(anime.id) })}
                className="inline-flex items-center gap-2 px-6 py-2.5 bg-white/10 text-white font-bold text-sm hover:bg-white/20 transition-colors border border-white/20 backdrop-blur-sm"
                style={{ borderRadius: "8px" }}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>
                Details
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════
   CONTINUE WATCHING — From history
   ═══════════════════════════════════════════════════════════════ */

function ContinueWatching({ navigate }: { navigate: (r: any) => void }) {
  const history = useAppStore(s => s.history);
  const recent = history.slice(0, 10);

  if (recent.length === 0) return null;

  return (
    <section className="px-4 md:px-8 lg:px-8 py-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-white">Continue Watching</h2>
        <button
          onClick={() => navigate({ page: "history" })}
          className="text-xs text-white/40 hover:text-white transition-colors"
        >
          View All
        </button>
      </div>
      <div className="flex gap-4 overflow-x-auto pb-2" style={{ scrollbarWidth: "none" }}>
        {recent.map(h => {
          const progressPercent = h.duration > 0 ? Math.min((h.progress / h.duration) * 100, 100) : (h.progress || 0);
          const remainingMin = h.duration > 0 ? Math.max(0, Math.round((h.duration - (h.progress / 100) * h.duration) / 60)) : 0;
          return (
            <button
              key={h.animeId + h.episode}
              onClick={() => navigate({ page: "watch", id: h.animeId, episode: h.episode, title: h.animeName, image: h.thumbnail })}
              className="group shrink-0 w-[300px] text-left"
            >
              <div className="relative w-full aspect-video bg-white/5 overflow-hidden" style={{ borderRadius: "4px" }}>
                {h.thumbnail && (
                  <img src={h.thumbnail} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
                {/* Play button overlay */}
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="w-14 h-14 rounded-full bg-white/90 flex items-center justify-center">
                    <svg className="w-6 h-6 text-black ml-1" fill="currentColor" viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3" /></svg>
                  </div>
                </div>
                {/* Progress bar */}
                <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-white/20">
                  <div className="h-full bg-white" style={{ width: `${progressPercent}%` }} />
                </div>
                {/* Episode badge */}
                <div className="absolute top-2 right-2 px-2 py-0.5 bg-black/80 backdrop-blur-sm text-[10px] font-bold text-white" style={{ borderRadius: "3px" }}>
                  EP {h.episode}
                </div>
              </div>
              <div className="mt-2.5">
                <p className="text-sm font-semibold text-white truncate group-hover:text-white/80 transition-colors">{h.animeName}</p>
                <div className="flex items-center justify-between mt-1">
                  <p className="text-xs font-medium text-white/60">Episode {h.episode}</p>
                  <p className="text-xs text-white/30">
                    {progressPercent > 0 ? `${Math.round(progressPercent)}%` : "Just started"}
                    {remainingMin > 0 && progressPercent < 95 ? ` · ${remainingMin}m left` : ""}
                  </p>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════
   POSTER CARD — Used in carousels
   ═══════════════════════════════════════════════════════════════ */

function PosterCard({ anime, navigate }: { anime: AnimeItem; navigate: (r: any) => void }) {
  const cover = getCover(anime);
  const title = getTitle(anime);
  const score = getScore(anime);

  return (
    <AnimeHoverCard anime={anime} navigate={navigate}>
      <button
        onClick={() => navigate({ page: "anime", id: String(anime.id) })}
        className="group shrink-0 w-[170px] md:w-[185px] text-left"
      >
        <div className="relative w-full aspect-[3/4] bg-white/5 overflow-hidden" style={{ borderRadius: "4px" }}>
          {cover ? (
            <img src={cover} alt={title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-white/10 font-bold text-2xl">{title.charAt(0)}</div>
          )}
          {/* Score badge — bottom-left, doesn't overlap the poster art */}
          {score > 0 && (
            <div className="absolute bottom-2 left-2 px-2 py-0.5 bg-black/80 backdrop-blur-sm text-xs font-bold text-white" style={{ borderRadius: "3px" }}>
              ★ {score}%
            </div>
          )}
        </div>
        <div className="mt-2">
          <p className="text-sm font-semibold text-white truncate group-hover:text-white/80 transition-colors">{title}</p>
          <div className="flex items-center gap-2 mt-0.5 text-xs text-white/40">
            {anime.seasonYear && <span>{anime.seasonYear}</span>}
            {anime.episodes && <span>• {anime.episodes} eps</span>}
          </div>
        </div>
      </button>
    </AnimeHoverCard>
  );
}

/* ═══════════════════════════════════════════════════════════════
   HORIZONTAL CAROUSEL — Section with title + scrollable posters
   ═══════════════════════════════════════════════════════════════ */

function Carousel({ title, subtitle, items, navigate }: {
  title: string;
  subtitle?: string;
  items: AnimeItem[];
  navigate: (r: any) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (dir: "left" | "right") => {
    if (scrollRef.current) {
      const amount = 600;
      scrollRef.current.scrollBy({ left: dir === "right" ? amount : -amount, behavior: "smooth" });
    }
  };

  if (items.length === 0) return null;

  return (
    <section className="px-4 md:px-8 lg:px-8 py-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold text-white">{title}</h2>
          {subtitle && <p className="text-sm text-white/40 mt-0.5">{subtitle}</p>}
        </div>
        <div className="flex gap-2">
          <button onClick={() => scroll("left")} className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/60 hover:text-white transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M15 19l-7-7 7-7" /></svg>
          </button>
          <button onClick={() => scroll("right")} className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/60 hover:text-white transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M9 5l7 7-7 7" /></svg>
          </button>
        </div>
      </div>
      <div ref={scrollRef} className="flex gap-4 overflow-x-auto pb-2" style={{ scrollbarWidth: "none" }}>
        {items.map(a => (
          <PosterCard key={a.id} anime={a} navigate={navigate} />
        ))}
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════
   DISCOVER — Tabs + Recently Added sidebar
   ═══════════════════════════════════════════════════════════════ */

function Discover({ trending, popular, topRated, recent, navigate }: {
  trending: AnimeItem[];
  popular: AnimeItem[];
  topRated: AnimeItem[];
  recent: AnimeItem[];
  navigate: (r: any) => void;
}) {
  const [tab, setTab] = useState<DiscoverTab>("season");
  const tabData = { season: trending, topRated, popular };
  const items = tabData[tab];

  return (
    <section className="px-4 md:px-8 lg:px-8 py-4">
      <div className="grid lg:grid-cols-[1fr_380px] gap-1">
        {/* Left: Love the Site card + Discover with tabs */}
        <div>
          {/* Love the Site + Follow Us card — half width */}
          <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-2 py-2 mb-3 flex items-center gap-2 max-w-[50%]">
            {/* LuffyTV logo circle */}
            <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center shrink-0 border border-white/10">
              <span className="text-xs font-bold text-white italic">L</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-white">Love the Site?</p>
              <p className="text-[10px] text-white/40">Share it with your friends!</p>
            </div>
            {/* Social icons */}
            <div className="flex items-center gap-1.5 shrink-0">
              <a href="https://twitter.com" target="_blank" rel="noopener noreferrer" className="w-7 h-7 rounded-lg bg-black/50 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-colors" title="Follow on X / Twitter">
                <svg className="w-3.5 h-3.5 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
              </a>
              <a href="https://discord.gg/Svc9yFjQBq" target="_blank" rel="noopener noreferrer" className="w-7 h-7 rounded-lg bg-black/50 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-colors" title="Join Discord">
                <svg className="w-3.5 h-3.5 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M20.317 4.37a19.791 19.791 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 00.031.057 19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 00-.041-.106 13.107 13.107 0 01-1.872-.892.077.077 0 01-.008-.128 10.2 10.2 0 00.372-.292.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127 12.299 12.299 0 01-1.873.892.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.839 19.839 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.03z"/></svg>
              </a>
              <a href="https://reddit.com" target="_blank" rel="noopener noreferrer" className="w-7 h-7 rounded-lg bg-black/50 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-colors" title="Reddit">
                <svg className="w-3.5 h-3.5 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0A12 12 0 000 12a12 12 0 0012 12 12 12 0 0012-12A12 12 0 0012 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 01-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.498.388-.397.924-.644 1.522-.644 1.178 0 2.135.957 2.135 2.135 0 .898-.558 1.668-1.348 1.982a4.2 4.2 0 01.063.708c0 2.998-3.432 5.428-7.67 5.428-4.238 0-7.67-2.43-7.67-5.428 0-.241.022-.477.063-.708-.79-.314-1.348-1.084-1.348-1.982 0-1.178.957-2.135 2.135-2.135.598 0 1.134.247 1.522.644 1.194-.866 2.85-1.428 4.674-1.498l.879-4.114a.328.328 0 01.385-.257l2.906.613a1.25 1.25 0 011.166-.803z"/></svg>
              </a>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-4 mb-4">
            <h2 className="text-xl font-bold text-white">Discover</h2>
            <div className="flex gap-1">
              {([
                { id: "season" as const, label: "This Season" },
                { id: "topRated" as const, label: "Top Rated" },
                { id: "popular" as const, label: "Most Popular" },
              ]).map(t => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`px-3 py-1.5 text-xs font-semibold transition-colors ${tab === t.id ? "bg-white text-black" : "text-white/40 hover:text-white"}`}
                  style={{ borderRadius: "4px" }}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Anime grid */}
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-4 lg:grid-cols-4 gap-2">
            {items.slice(0, 12).map(a => (
              <PosterCard key={a.id} anime={a} navigate={navigate} />
            ))}
          </div>
        </div>

        {/* Right: Top Anime (5) + Upcoming (5) — aligned with Discover cards */}
        <div className="flex flex-col gap-3" style={{ marginTop: "52px" }}>
          {/* Top Anime — 5 entries, title INSIDE the box */}
          <div>
            <div className="flex flex-col gap-2 rounded-xl border border-white/[0.08] bg-[#0D0D0D] p-2">
              <h3 className="text-sm font-extrabold text-white uppercase tracking-wider px-1 pt-1 pb-2 border-b border-white/[0.06]">Top Anime</h3>
              {recent.slice(0, 5).map(a => {
                const cover = getCover(a);
                const title = getTitle(a);
                const score = getScore(a);
                const banner = a.bannerImage || cover || "";
                return (
                  <button
                    key={a.id}
                    onClick={() => navigate({ page: "anime", id: String(a.id) })}
                    className="relative flex items-center gap-2.5 text-left group overflow-hidden rounded-lg border border-white/[0.06] bg-[#0D0D0D] transition-all duration-300 hover:border-white/20"
                  >
                    {banner && (
                      <img src={banner} alt="" className="absolute inset-0 w-full h-full object-cover transition-all duration-500 group-hover:grayscale-0 group-hover:brightness-50" style={{ filter: "grayscale(1) brightness(0.25)", opacity: 0.6 }} loading="lazy" />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-r from-[#0D0D0D] via-[#0D0D0D]/70 to-transparent transition-opacity duration-300 group-hover:via-[#0D0D0D]/50" />
                    <div className="relative shrink-0 w-[64px] h-[90px] overflow-hidden rounded z-10 transition-transform duration-300 group-hover:scale-105">
                      {cover && <img src={cover} alt="" className="w-full h-full object-cover" loading="lazy" />}
                    </div>
                    <div className="relative min-w-0 flex-1 z-10 py-2 pr-2 transition-transform duration-300 group-hover:translate-x-1">
                      <p className="text-sm font-bold text-white truncate group-hover:text-white transition-colors">{title}</p>
                      <div className="flex items-center gap-1.5 mt-0.5 text-xs text-white/40 flex-wrap">
                        {a.format && <span className="px-1 py-0.5 rounded bg-white/10 text-white/50 font-medium">{a.format}</span>}
                        {a.seasonYear && <span>{a.seasonYear}</span>}
                        {a.episodes && <span>{a.episodes} eps</span>}
                        {score > 0 && (
                          <span className="flex items-center gap-0.5 text-yellow-400/80">
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                            {score}%
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Upcoming — 5 entries, title INSIDE the box */}
          <div>
            <div className="flex flex-col gap-2 rounded-xl border border-white/[0.08] bg-[#0D0D0D] p-2">
              <h3 className="text-sm font-extrabold text-white uppercase tracking-wider px-1 pt-1 pb-2 border-b border-white/[0.06]">Upcoming</h3>
              {(trending.filter(a => a.status === "NOT_YET_RELEASED").length >= 5
                ? trending.filter(a => a.status === "NOT_YET_RELEASED")
                : [...trending.filter(a => a.status === "NOT_YET_RELEASED"), ...trending.filter(a => a.status !== "NOT_YET_RELEASED")]
              ).slice(0, 5).map(a => {
                const cover = getCover(a);
                const title = getTitle(a);
                const score = getScore(a);
                const banner = a.bannerImage || cover || "";
                return (
                  <button
                    key={`upc-${a.id}`}
                    onClick={() => navigate({ page: "anime", id: String(a.id) })}
                    className="relative flex items-center gap-2.5 text-left group overflow-hidden rounded-lg border border-white/[0.06] bg-[#0D0D0D] transition-all duration-300 hover:border-white/20"
                  >
                    {banner && (
                      <img src={banner} alt="" className="absolute inset-0 w-full h-full object-cover transition-all duration-500 group-hover:grayscale-0 group-hover:brightness-50" style={{ filter: "grayscale(1) brightness(0.25)", opacity: 0.6 }} loading="lazy" />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-r from-[#0D0D0D] via-[#0D0D0D]/70 to-transparent transition-opacity duration-300 group-hover:via-[#0D0D0D]/50" />
                    <div className="relative shrink-0 w-[64px] h-[90px] overflow-hidden rounded z-10 transition-transform duration-300 group-hover:scale-105">
                      {cover && <img src={cover} alt="" className="w-full h-full object-cover" loading="lazy" />}
                    </div>
                    <div className="relative min-w-0 flex-1 z-10 py-2 pr-2 transition-transform duration-300 group-hover:translate-x-1">
                      <p className="text-sm font-bold text-white truncate group-hover:text-white transition-colors">{title}</p>
                      <div className="flex items-center gap-1.5 mt-0.5 text-xs text-white/40 flex-wrap">
                        {a.format && <span className="px-1 py-0.5 rounded bg-white/10 text-white/50 font-medium">{a.format}</span>}
                        {a.seasonYear && <span>{a.seasonYear}</span>}
                        {a.episodes && <span>{a.episodes} eps</span>}
                        {score > 0 && (
                          <span className="flex items-center gap-0.5 text-yellow-400/80">
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                            {score}%
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════
   COMING SOON — Upcoming anime
   ═══════════════════════════════════════════════════════════════ */

function ComingSoon({ items, navigate }: { items: AnimeItem[]; navigate: (r: any) => void }) {
  const [extra, setExtra] = useState<AnimeItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Always fetch a dedicated batch of upcoming anime from AniList so the
  // section is never empty / too short (trending list rarely has NOT_YET_RELEASED).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("https://graphql.anilist.co", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: `
              query {
                Page(page: 1, perPage: 30) {
                  media(type: ANIME, status: NOT_YET_RELEASED, sort: POPULARITY_DESC, isAdult: false) {
                    id title { romaji english native }
                    coverImage { extraLarge large medium color }
                    bannerImage format status episodes genres
                    averageScore popularity season seasonYear
                    description(asHtml: false)
                    startDate { year month day }
                  }
                }
              }
            `,
          }),
        });
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        const list: AnimeItem[] = (data?.data?.Page?.media || []).map((a: any) => ({
          ...a,
          id: a.id,
        }));
        setExtra(list);
      } catch {}
      finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Merge: any upcoming from trending + dedicated AniList fetch, dedupe by id
  const fromTrending = items.filter(a => a.status === "NOT_YET_RELEASED");
  const seen = new Set<number>();
  const merged: AnimeItem[] = [];
  for (const a of [...fromTrending, ...extra]) {
    if (!seen.has(a.id)) {
      seen.add(a.id);
      merged.push(a);
    }
  }

  if (loading && merged.length === 0) {
    // Show skeleton placeholders while loading
    return (
      <section className="px-4 md:px-8 lg:px-8 py-4">
        <h2 className="text-xl font-bold text-white mb-4">Coming Soon</h2>
        <div className="flex gap-4 overflow-hidden">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="shrink-0 w-[170px] md:w-[185px]">
              <div className="w-full aspect-[3/4] bg-white/5 rounded animate-pulse" />
              <div className="h-3 w-3/4 bg-white/5 rounded mt-2 animate-pulse" />
              <div className="h-2 w-1/2 bg-white/5 rounded mt-1 animate-pulse" />
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (merged.length === 0) return null;

  return (
    <Carousel
      title="Coming Soon"
      items={merged}
      navigate={navigate}
    />
  );
}

/* ═══════════════════════════════════════════════════════════════
   RIGHT SIDEBAR — Top Airing, Schedule
   ═══════════════════════════════════════════════════════════════ */

function Sidebar({ trending, navigate }: { trending: AnimeItem[]; navigate: (r: any) => void }) {
  const airing = trending.filter(a => a.status === "RELEASING").slice(0, 5);

  return (
    <aside className="px-4 md:px-8 lg:px-8 py-4">
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Top Airing */}
        <div>
          <h3 className="text-sm font-bold text-white/60 uppercase tracking-wider mb-3">Top Airing</h3>
          <div className="flex flex-col gap-2">
            {airing.map((a, i) => (
              <button key={a.id} onClick={() => navigate({ page: "anime", id: String(a.id) })}
                className="flex items-center gap-2 text-left group">
                <span className="text-sm font-bold text-white/30 w-4">{i + 1}</span>
                <span className="text-sm text-white/70 truncate group-hover:text-white">{getTitle(a)}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Top Rated */}
        <div>
          <h3 className="text-sm font-bold text-white/60 uppercase tracking-wider mb-3">Top Rated</h3>
          <div className="flex flex-col gap-2">
            {[...trending].sort((a, b) => getScore(b) - getScore(a)).slice(0, 5).map((a, i) => (
              <button key={a.id} onClick={() => navigate({ page: "anime", id: String(a.id) })}
                className="flex items-center gap-2 text-left group">
                <span className="text-sm font-bold text-white/30 w-4">{i + 1}</span>
                <span className="text-sm text-white/70 truncate group-hover:text-white">{getTitle(a)}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Most Popular */}
        <div>
          <h3 className="text-sm font-bold text-white/60 uppercase tracking-wider mb-3">Most Popular</h3>
          <div className="flex flex-col gap-2">
            {trending.slice(0, 5).map((a, i) => (
              <button key={a.id} onClick={() => navigate({ page: "anime", id: String(a.id) })}
                className="flex items-center gap-2 text-left group">
                <span className="text-sm font-bold text-white/30 w-4">{i + 1}</span>
                <span className="text-sm text-white/70 truncate group-hover:text-white">{getTitle(a)}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Upcoming */}
        <div>
          <h3 className="text-sm font-bold text-white/60 uppercase tracking-wider mb-3">Upcoming</h3>
          <div className="flex flex-col gap-2">
            {trending.filter(a => a.status === "NOT_YET_RELEASED").slice(0, 5).map((a, i) => (
              <button key={a.id} onClick={() => navigate({ page: "anime", id: String(a.id) })}
                className="flex items-center gap-2 text-left group">
                <span className="text-sm font-bold text-white/30 w-4">{i + 1}</span>
                <span className="text-sm text-white/70 truncate group-hover:text-white">{getTitle(a)}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </aside>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════════════════
   RECENT COMMENTS — Community discussion from all anime
   ═══════════════════════════════════════════════════════════════ */

function RecentComments({ navigate }: { navigate: (r: any) => void }) {
  const [comments, setComments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    // 1. Load local comments (instant, works on Vercel where SQLite is read-only)
    const LOCAL_KEY = "luffytv_comments";
    const localAll: any[] = [];
    try {
      const raw = localStorage.getItem(LOCAL_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (typeof parsed === "object" && parsed !== null) {
          for (const animeId of Object.keys(parsed)) {
            for (const c of parsed[animeId] || []) {
              localAll.push({ ...c, animeId });
            }
          }
        }
      }
    } catch {}
    localAll.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const localTop = localAll.slice(0, 5).filter(c => c.id && c.id !== "0");

    // 2. Try server API for shared comments (in case DB is configured)
    fetch("/api/comments/recent?limit=5")
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (cancelled) return;
        const serverComments = (data?.comments || []).filter((c: any) => c && c.id && c.id !== "0");
        const seen = new Set<string>();
        const merged: any[] = [];
        for (const c of [...localTop, ...serverComments]) {
          if (!seen.has(c.id)) {
            seen.add(c.id);
            merged.push(c);
          }
        }
        merged.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setComments(merged.slice(0, 5));
      })
      .catch(() => {
        if (!cancelled) setComments(localTop);
      })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, []);

  const formatTime = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(dateStr).toLocaleDateString();
  };

  return (
    <section className="px-4 md:px-8 lg:px-8 py-6">
      {/* Header — black & white, bold, compact */}
      <div className="flex items-center gap-2 mb-3">
        <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
        <h2 className="text-sm font-extrabold text-white uppercase tracking-wider">Recent Comments</h2>
      </div>

      {loading ? (
        /* Compact skeletons */
        <div className="rounded-xl border border-white/[0.08] bg-black divide-y divide-white/[0.04]">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="p-3 flex items-center gap-3 animate-pulse">
              <div className="w-7 h-7 rounded-full bg-white/5 shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="h-2.5 w-20 bg-white/5 rounded" />
                <div className="h-2 w-full bg-white/5 rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : comments.length === 0 ? (
        /* Empty state — minimal */
        <div className="rounded-xl border border-white/[0.08] bg-black p-6 text-center">
          <p className="text-xs text-white/40 font-medium">No comments yet</p>
        </div>
      ) : (
        /* ── Single box, comments stacked one-by-one ── */
        <div className="rounded-xl border border-white/[0.08] bg-black divide-y divide-white/[0.05] overflow-hidden">
          {comments.map((c: any) => (
            <button
              key={c.id}
              onClick={() => navigate({ page: "anime", id: c.animeId })}
              className="block w-full text-left px-3.5 py-3 hover:bg-white/[0.03] transition-colors group"
            >
              {/* Row 1: avatar + username + time + rating */}
              <div className="flex items-center gap-2 mb-1.5">
                {/* Avatar — pure B/W */}
                <div className="w-7 h-7 rounded-full bg-white/[0.06] border border-white/10 flex items-center justify-center shrink-0">
                  <span className="text-[11px] font-extrabold text-white">
                    {(c.username || "A")[0].toUpperCase()}
                  </span>
                </div>
                <p className="text-xs font-bold text-white truncate">
                  {c.username || "Anonymous"}
                </p>
                <span className="text-[10px] text-white/30">·</span>
                <p className="text-[10px] text-white/40 shrink-0">{formatTime(c.createdAt)}</p>
                {/* Rating stars — B/W */}
                {c.rating && (
                  <div className="flex items-center gap-0.5 ml-auto shrink-0">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <svg key={i} className={`w-2.5 h-2.5 ${i < c.rating ? "text-white" : "text-white/15"}`} fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                    ))}
                  </div>
                )}
              </div>

              {/* Row 2: comment text — bold */}
              <p className="text-xs font-bold text-white/85 leading-snug line-clamp-2 group-hover:text-white transition-colors">
                {c.content}
              </p>

              {/* Row 3: anime title + episode + likes — compact B/W */}
              <div className="flex items-center gap-2 mt-1.5 text-[10px]">
                <span className="font-bold text-white/60 truncate">
                  {c.animeTitle || "Untitled"}
                </span>
                {c.episode != null && Number(c.episode) > 0 && (
                  <>
                    <span className="text-white/20">·</span>
                    <span className="font-bold text-white/50 uppercase tracking-wider shrink-0">
                      EP {c.episode}
                    </span>
                  </>
                )}
                {c.likes > 0 && (
                  <>
                    <span className="text-white/20">·</span>
                    <span className="font-bold text-white/50 shrink-0 flex items-center gap-0.5">
                      <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3zM7 22H4a2 2 0 01-2-2v-7a2 2 0 012-2h3" />
                      </svg>
                      {c.likes}
                    </span>
                  </>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

export default function AnimeSectionPage() {
  const navigate = useAppStore(s => s.navigate);
  const sectionSubPage = useAppStore(s => s.sectionSubPage);
  const setSectionSubPage = useAppStore(s => s.setSectionSubPage);

  const [loading, setLoading] = useState(true);
  const [featured, setFeatured] = useState<FeaturedAnime[]>([]);
  const [trending, setTrending] = useState<AnimeItem[]>([]);
  const [popular, setPopular] = useState<AnimeItem[]>([]);
  const [topRated, setTopRated] = useState<AnimeItem[]>([]);
  const [season, setSeason] = useState<AnimeItem[]>([]);
  const [recent, setRecent] = useState<AnimeItem[]>([]);

  // Fetch all data on mount
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        // Fetch trending only (faster, doesn't timeout)
        const res = await fetch("/api/anime/anilist-trending?section=trending");
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;

        // Dedupe by ID AND by base title (remove "Season X" suffix for comparison)
        const dedupe = (arr: any[]) => {
          const seenIds = new Set();
          const seenTitles = new Set();
          return arr.filter(a => {
            if (!a?.id) return false;
            // Dedupe by ID
            if (seenIds.has(a.id)) return false;
            seenIds.add(a.id);
            // Dedupe by base title (e.g. "Wistoria Season 2" and "Wistoria Season 3" = same base)
            const title = getTitle(a).toLowerCase().replace(/\s*(season|cour|part)\s*\d+/gi, "").replace(/:\s*.*/g, "").trim();
            if (title && seenTitles.has(title)) return false;
            seenTitles.add(title);
            return true;
          });
        };

        // Filter out Wistoria Season 3 from featured carousel (user request)
        const isWistoriaSeason3 = (a: any) => {
          const title = getTitle(a).toLowerCase();
          if (!title.includes("wistoria")) return false;
          // Match any form of season 3 marking
          return (
            /\bseason\s*3\b/i.test(title) ||
            /\bcour\s*3\b/i.test(title) ||
            /\bpart\s*3\b/i.test(title) ||
            /\biii\b/i.test(title) ||
            /\b3rd\b/i.test(title) ||
            /\bvol\.?\s*3\b/i.test(title) ||
            /\bs3\b/i.test(title)
          );
        };

        // Dedupe, then strip out Wistoria Season 3 entirely from the home page
        // (banner carousel, Trending Now, Discover, Sidebar — everywhere on home)
        let trend = dedupe(data.trending || data.all || data.media || []);
        trend = trend.filter(a => !isWistoriaSeason3(a));

        // Featured carousel: ONLY famous anime with description + banner image.
        // No weird/obscure anime in the banner.
        // Since the trending API may use MAL/Miruro sources (which don't have
        // descriptions), we fetch descriptions from AniList directly for the
        // top candidates before filtering.
        const topCandidates = trend.slice(0, 15);  // check top 15, pick best 8
        const idsToFetch = topCandidates
          .filter(a => !a?.description)
          .map(a => a.id)
          .slice(0, 10);

        // Batch-fetch descriptions from AniList (one GraphQL call for up to 10 IDs)
        // Use idMal_in since the trending API may return MAL IDs (not AniList IDs)
        if (idsToFetch.length > 0) {
          try {
            const descRes = await fetch("https://graphql.anilist.co", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                query: `query($ids:[Int]){Page(page:1,perPage:50){media(idMal_in:$ids,type:ANIME){id idMal description(asHtml:false) episodes averageScore bannerImage coverImage{extraLarge large}}}}`,
                variables: { ids: idsToFetch },
              }),
            });
            if (descRes.ok) {
              const descData = await descRes.json();
              const mediaList = descData?.data?.Page?.media || [];
              // Build map by idMal (since our trending items use MAL IDs)
              const descMap = new Map<number, any>();
              for (const m of mediaList) {
                if (m.idMal) descMap.set(m.idMal, m);
              }
              // Merge AniList data into our trending items
              topCandidates.forEach(a => {
                const al = descMap.get(a.id);
                if (al) {
                  if (!a.description && al.description) a.description = al.description;
                  if (!a.episodes && al.episodes) a.episodes = al.episodes;
                  if (!a.averageScore && al.averageScore) a.averageScore = al.averageScore;
                  if (!a.bannerImage && al.bannerImage) a.bannerImage = al.bannerImage;
                }
              });
            }
          } catch (e) {
            console.error("Failed to fetch descriptions:", e);
          }
        }

        // Now filter: only anime with description + banner + score + episodes
        const featuredCandidates = topCandidates.filter(a => {
          const hasDesc = a?.description && a.description.replace(/<[^>]*>/g, "").trim().length >= 50;
          const hasBanner = a?.bannerImage || a?.coverImage?.extraLarge || a?.coverImage?.large;
          const hasScore = a?.averageScore && a.averageScore > 0;
          const hasEps = (a?.episodes && a.episodes > 0) || a?.format === "MOVIE";
          return hasDesc && hasBanner && hasScore && hasEps;
        });

        // Use filtered list for featured, but full list for other sections
        let finalFeatured: FeaturedAnime[] = [];
        if (featuredCandidates.length > 0) finalFeatured = featuredCandidates.slice(0, 8);
        else if (trend.length > 0) finalFeatured = trend.slice(0, 8);

        // One Piece permanent first banner with TVDB background art
        const ONE_PIECE_TVDB_BG = "https://artworks.thetvdb.com/banners/v4/series/81797/backgrounds/616009a8bd688.jpg";
        const onePieceFromList = finalFeatured.find(a => a.id === 21) || trend.find(a => a.id === 21);
        const onePieceBanner: FeaturedAnime = onePieceFromList
          ? { ...onePieceFromList, bannerImage: ONE_PIECE_TVDB_BG }
          : {
              id: 21,
              title: { english: "ONE PIECE", romaji: "ONE PIECE" },
              bannerImage: ONE_PIECE_TVDB_BG,
              coverImage: { extraLarge: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx21-2YLkS1QzAyY7.jpg" },
              description: "Gold Roger was known as the Pirate King, the strongest and most infamous being to have sailed the Grand Line. The capture and execution of Roger by the World Government brought a change throughout the world. His last words before his death revealed the existence of the greatest treasure in the world, One Piece.",
              format: "TV",
              episodes: 1100,
              averageScore: 87,
              genres: ["Action", "Adventure", "Comedy", "Drama", "Fantasy"],
              season: "FALL",
              seasonYear: 1999,
              status: "RELEASING",
            };
        // Remove any existing One Piece from the list, then prepend it
        finalFeatured = [onePieceBanner, ...finalFeatured.filter(a => a.id !== 21)].slice(0, 8);

        setFeatured(finalFeatured);
        if (trend.length > 0) setTrending(trend);
        // Use trending for all sections (single fetch, no timeout)
        setPopular(trend);
        setTopRated([...trend].sort((a, b) => getScore(b) - getScore(a)));
        setSeason(trend);
        setRecent(trend);
      } catch (e) {
        console.error("Home page load error:", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  // If sub-page is browse, show the REAL BrowsePage (full filter UI + AniList results)
  if (sectionSubPage === "browse") {
    return (
      <div className="w-full bg-black text-white" style={{ paddingTop: "88px", minHeight: "100vh" }}>
        <div className="px-4 lg:px-8 pb-16">
          <BrowsePage />
        </div>
      </div>
    );
  }

  // If sub-page is schedule, show the REAL SchedulePage (live airing schedule from AniList)
  if (sectionSubPage === "schedule") {
    return (
      <div className="w-full bg-black text-white" style={{ paddingTop: "88px", minHeight: "100vh" }}>
        <div className="px-4 lg:px-8 pb-16">
          <SchedulePage />
        </div>
      </div>
    );
  }

  return (
    <div className="w-full bg-black text-white" style={{ fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif" }}>
      {/* Hero Carousel — full screen */}
      <HeroCarousel items={featured} navigate={navigate} />

      {/* Continue Watching */}
      <ContinueWatching navigate={navigate} />

      {/* Featured Anime — random popular anime with background backdrop */}
      <FeaturedAnimeSection trending={trending} navigate={navigate} />

      {/* Top Trending — with tabs (Trending/Top Rated/Upcoming/Newest) + ranking numbers */}
      <TopTrending trending={trending} topRated={topRated} navigate={navigate} />

      {/* Discover + Recently Added */}
      <Discover
        trending={season.length > 0 ? season : trending}
        popular={popular}
        topRated={topRated}
        recent={recent}
        navigate={navigate}
      />

      {/* Recent Comments — community discussion from all anime */}
      <RecentComments navigate={navigate} />

      {/* Today's Schedule (half) + Top 10 Anime (half) — side by side, replaces Popular This Season */}
      <section className="px-4 md:px-8 lg:px-8 py-4">
        <WatchPageExtras navigate={navigate} />
      </section>

      {/* Coming Soon */}
      <ComingSoon items={trending} navigate={navigate} />

      {/* Sidebar — Top Airing, Top Rated, Most Popular, Upcoming */}
      <Sidebar trending={trending} navigate={navigate} />

      {/* Footer spacing */}
      <div className="h-4" />
    </div>
  );
}

// Browse and Schedule sub-pages now use the real BrowsePage / SchedulePage components
// imported at the top of this file.
