"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useAppStore } from "./store";
import type { MiruroAnimeResult } from "@/lib/miruro-api";

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
  const anilistBanner = getBanner(anime);
  // Prefer TMDB backdrop (higher quality), fall back to AniList banner
  const banner = backdrops[anime.id] || anilistBanner;
  const logoUrl = logos[anime.id];
  const title = getTitle(anime);
  const score = getScore(anime);
  const seasonStr = anime.season && anime.seasonYear ? `${anime.season} ${anime.seasonYear}` : anime.seasonYear ? String(anime.seasonYear) : "";

  return (
    <div
      className="relative w-full h-screen overflow-hidden bg-black"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Background image — FULL SCREEN, high quality TMDB backdrop */}
      {banner && (
        <img
          src={banner}
          alt=""
          className="absolute inset-0 w-full h-full object-cover object-center"
          style={{ animation: "ltv-hero-fade 0.8s ease-out" }}
          key={current}
        />
      )}
      {/* Gradient overlays — darker at bottom for text readability */}
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-transparent to-transparent" />

      {/* Content — bottom left */}
      <div className="absolute bottom-0 left-0 right-0 p-6 md:p-12 lg:p-16 pb-16">
        <div className="max-w-2xl space-y-4">
          {/* TMDB Logo — smaller, cleaner */}
          {logoUrl && (
            <img
              src={logoUrl}
              alt={title}
              className="max-w-[240px] max-h-[80px] mb-3 drop-shadow-lg"
              style={{ objectFit: "contain", objectPosition: "left" }}
            />
          )}

          {/* Title — large, white (shown if no logo) */}
          {!logoUrl && (
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold text-white leading-[1.05] tracking-tight">
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

          {/* Synopsis */}
          {anime.description && (
            <p className="text-sm md:text-base text-white/60 leading-relaxed line-clamp-3 max-w-xl">
              {anime.description.replace(/<[^>]*>/g, "")}
            </p>
          )}

          {/* Watch button — square shaped */}
          <button
            onClick={() => navigate({ page: "anime", id: String(anime.id) })}
            className="inline-flex items-center gap-2 px-8 py-3 bg-white text-black font-bold text-sm hover:bg-white/90 transition-colors"
            style={{ borderRadius: "4px" }}
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3" /></svg>
            Watch Now
          </button>
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
   CONTINUE WATCHING — From history
   ═══════════════════════════════════════════════════════════════ */

function ContinueWatching({ navigate }: { navigate: (r: any) => void }) {
  const history = useAppStore(s => s.history);
  const recent = history.slice(0, 6);

  if (recent.length === 0) return null;

  return (
    <section className="px-6 md:px-12 lg:px-16 py-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-white">Continue Watching</h2>
      </div>
      <div className="flex gap-4 overflow-x-auto pb-2" style={{ scrollbarWidth: "none" }}>
        {recent.map(h => (
          <button
            key={h.animeId + h.episode}
            onClick={() => navigate({ page: "watch", id: h.animeId, episode: h.episode, title: h.animeName, image: h.thumbnail })}
            className="group shrink-0 w-[280px] text-left"
          >
            <div className="relative w-full aspect-video bg-white/5 overflow-hidden" style={{ borderRadius: "4px" }}>
              {h.thumbnail && (
                <img src={h.thumbnail} alt="" className="w-full h-full object-cover" loading="lazy" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
              {/* Progress bar */}
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/10">
                <div className="h-full bg-white" style={{ width: "30%" }} />
              </div>
              {/* Play button overlay */}
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center">
                  <svg className="w-5 h-5 text-black ml-0.5" fill="currentColor" viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3" /></svg>
                </div>
              </div>
            </div>
            <div className="mt-2">
              <p className="text-sm font-semibold text-white truncate">{h.animeName}</p>
              <p className="text-xs text-white/40">Episode {h.episode}</p>
            </div>
          </button>
        ))}
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
    <button
      onClick={() => navigate({ page: "anime", id: String(anime.id) })}
      className="group shrink-0 w-[160px] md:w-[180px] text-left"
    >
      <div className="relative w-full aspect-[2/3] bg-white/5 overflow-hidden" style={{ borderRadius: "4px" }}>
        {cover ? (
          <img src={cover} alt={title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-white/10 font-bold text-2xl">{title.charAt(0)}</div>
        )}
        {/* Score badge */}
        {score > 0 && (
          <div className="absolute top-2 left-2 px-2 py-0.5 bg-black/80 backdrop-blur-sm text-xs font-bold text-white" style={{ borderRadius: "3px" }}>
            ★ {score}%
          </div>
        )}
        {/* Format badge */}
        {anime.format && (
          <div className="absolute top-2 right-2 px-2 py-0.5 bg-black/80 backdrop-blur-sm text-[10px] font-bold text-white/70" style={{ borderRadius: "3px" }}>
            {anime.format}
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
    <section className="px-6 md:px-12 lg:px-16 py-6">
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
    <section className="px-6 md:px-12 lg:px-16 py-6">
      <div className="grid lg:grid-cols-[1fr_320px] gap-8">
        {/* Left: Discover with tabs */}
        <div>
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
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-5 gap-3">
            {items.slice(0, 15).map(a => (
              <PosterCard key={a.id} anime={a} navigate={navigate} />
            ))}
          </div>
        </div>

        {/* Right: Recently Added */}
        <div>
          <h3 className="text-sm font-bold text-white/60 uppercase tracking-wider mb-4">Recently Added</h3>
          <div className="flex flex-col gap-3">
            {recent.slice(0, 8).map(a => {
              const cover = getCover(a);
              const title = getTitle(a);
              return (
                <button
                  key={a.id}
                  onClick={() => navigate({ page: "anime", id: String(a.id) })}
                  className="flex items-center gap-3 text-left group"
                >
                  <div className="w-12 h-16 shrink-0 bg-white/5 overflow-hidden" style={{ borderRadius: "3px" }}>
                    {cover && <img src={cover} alt="" className="w-full h-full object-cover" loading="lazy" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-white truncate group-hover:text-white/80">{title}</p>
                    <div className="flex items-center gap-2 text-xs text-white/30">
                      {a.format && <span>{a.format}</span>}
                      {a.seasonYear && <span>• {a.seasonYear}</span>}
                      {a.status === "RELEASING" && <span className="text-white/50">• Releasing</span>}
                    </div>
                  </div>
                </button>
              );
            })}
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
  const upcoming = items.filter(a => a.status === "NOT_YET_RELEASED");
  if (upcoming.length === 0) return null;

  return (
    <Carousel
      title="Coming Soon"
      items={upcoming}
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
    <aside className="px-6 md:px-12 lg:px-16 py-6">
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
        const res = await fetch("/api/anime/anilist-trending");
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;

        const all = data.all || data.trending || data.media || [];
        const trend = data.trending || all;
        const pop = data.popular || all;
        const top = data.topRated || all;
        const seas = data.season || all;

        if (trend.length > 0) setFeatured(trend.slice(0, 6));
        if (trend.length > 0) setTrending(trend);
        if (pop.length > 0) setPopular(pop);
        if (top.length > 0) setTopRated(top);
        if (seas.length > 0) setSeason(seas);

        // Use trending as "recently added" fallback
        setRecent(all.length > 0 ? all : trend);
      } catch (e) {
        console.error("Home page load error:", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  // If sub-page is browse, show browse page
  if (sectionSubPage === "browse") {
    return (
      <div className="w-full" style={{ paddingTop: "0" }}>
        <BrowsePageInline navigate={navigate} />
      </div>
    );
  }

  // If sub-page is schedule, show schedule inline
  if (sectionSubPage === "schedule") {
    return (
      <div className="w-full" style={{ paddingTop: "0" }}>
        <ScheduleInline navigate={navigate} />
      </div>
    );
  }

  return (
    <div className="w-full bg-black text-white" style={{ fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif" }}>
      {/* Hero Carousel — full screen */}
      <HeroCarousel items={featured} navigate={navigate} />

      {/* Continue Watching */}
      <ContinueWatching navigate={navigate} />

      {/* Trending Now */}
      <Carousel
        title="Trending Now"
        subtitle="What everyone's watching this week"
        items={trending}
        navigate={navigate}
      />

      {/* Discover + Recently Added */}
      <Discover
        trending={season.length > 0 ? season : trending}
        popular={popular}
        topRated={topRated}
        recent={recent}
        navigate={navigate}
      />

      {/* Popular This Season */}
      <Carousel
        title="Popular This Season"
        items={season.length > 0 ? season : trending}
        navigate={navigate}
      />

      {/* Coming Soon */}
      <ComingSoon items={trending} navigate={navigate} />

      {/* Sidebar — Top Airing, Top Rated, Most Popular, Upcoming */}
      <Sidebar trending={trending} navigate={navigate} />

      {/* Footer spacing */}
      <div className="h-8" />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   INLINE BROWSE PAGE — simplified
   ═══════════════════════════════════════════════════════════════ */

function BrowsePageInline({ navigate }: { navigate: (r: any) => void }) {
  return (
    <div className="w-full bg-black text-white px-6 md:px-12 lg:px-16 py-8" style={{ paddingTop: "80px" }}>
      <h1 className="text-2xl font-bold mb-6">Browse</h1>
      <p className="text-white/40">Browse page content...</p>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   INLINE SCHEDULE PAGE — simplified
   ═══════════════════════════════════════════════════════════════ */

function ScheduleInline({ navigate }: { navigate: (r: any) => void }) {
  return (
    <div className="w-full bg-black text-white px-6 md:px-12 lg:px-16 py-8" style={{ paddingTop: "80px" }}>
      <h1 className="text-2xl font-bold mb-6">Schedule</h1>
      <p className="text-white/40">Schedule page content...</p>
    </div>
  );
}
