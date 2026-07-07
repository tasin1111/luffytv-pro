"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useAppStore } from "./store";

/* ═══════════════════════════════════════════════════════════════
   LUFFYTV MANGA — v5 (matches site structure exactly)
   ─────────────────────────────────────────────────────────────────
   DATA SOURCE
   • Provider: atsumaru (atsu.moe)
   • API:      https://manga-scrape-api.vercel.app/api/scrape/*
               (search, info, chapters, pages — all 4 methods)
   • Routes:   /api/manga/home | /api/manga/search | /api/manga/detail

   STRUCTURE — matches anime-section-page.tsx exactly:
   1. Hero carousel (full-screen, featured manga with backdrop)
   2. Featured Manga section (rounded card, poster + info + buttons)
   3. Horizontal carousel sections (Trending / Popular / Top Rated / etc.)
   4. Discover section (tabs + grid + sidebar with Top Manga)

   COLORS — matches site:
   • bg-black, text-white, text-white/60, text-white/40
   • White buttons (bg-white text-black)
   • Orange/gold ratings (text-yellow-400, bg-orange-500/20)
   • Borders: border-white/[0.08], border-white/10
   • Cards: bg-white/5, rounded-[4px]
   ═══════════════════════════════════════════════════════════════ */

interface MangaEntry {
  id: string;
  title: string;
  englishTitle?: string;
  poster?: string;
  cover?: string;
  type?: string;
  status?: string;
  year?: number;
  isAdult?: boolean;
  genres?: string[];
  source?: string;
  rating?: number;
  chapterCount?: number;
  latestChapter?: string;
  description?: string;
}

interface MangaSection {
  title: string;
  type: string;
  items: MangaEntry[];
}

// ────────────────────────────────────────────────────────────────────────
// Helpers (match anime-section-page helpers)
// ────────────────────────────────────────────────────────────────────────

function getTitle(m: MangaEntry): string {
  return m.englishTitle || m.title || "Unknown";
}

function getCover(m: MangaEntry): string {
  return m.poster || m.cover || "";
}

function getScore(m: MangaEntry): number {
  if (!m.rating) return 0;
  // atsumaru ratings are 0-10; convert to 0-100 to match site's anime scores
  return m.rating > 10 ? Math.round(m.rating) : Math.round(m.rating * 10);
}

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════

export default function MangaPage() {
  const navigate = useAppStore(s => s.navigate);

  const [sections, setSections] = useState<MangaSection[]>([]);
  const [searchResults, setSearchResults] = useState<MangaEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [searchMode, setSearchMode] = useState(false);

  // ── Load home data ──
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/manga/home");
        if (res.ok) {
          const data = await res.json();
          setSections(data.sections || []);
        }
      } catch { /* ignore */ }
      setLoading(false);
    }
    load();
  }, []);

  // ── Search (debounced) ──
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleSearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchMode(false);
      setSearchResults([]);
      return;
    }
    setSearchMode(true);
    setSearching(true);
    try {
      const res = await fetch(`/api/manga/search?q=${encodeURIComponent(query.trim())}`);
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data.results || []);
      }
    } catch { /* ignore */ }
    setSearching(false);
  }, []);

  const onSearchChange = (value: string) => {
    setSearchQuery(value);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => handleSearch(value), 450);
  };

  // ── Derived data ──
  const allItems = sections.flatMap(s => s.items);
  const trending = sections.find(s => s.type === "trending")?.items || allItems.slice(0, 12);
  const popular = sections.find(s => s.type === "top_rated")?.items || [...allItems].sort((a, b) => (b.rating || 0) - (a.rating || 0)).slice(0, 12);
  const topRated = [...allItems].sort((a, b) => (b.rating || 0) - (a.rating || 0)).slice(0, 12);
  const recent = [...allItems].slice(0, 12);

  // ── Loading state ──
  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-white/10 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white pb-12">
      {/* ═══ HERO CAROUSEL ═══ */}
      {!searchMode && trending.length > 0 && (
        <HeroCarousel items={trending.slice(0, 6)} navigate={navigate} />
      )}

      {/* ═══ SEARCH BAR ═══ */}
      <section className="px-4 md:px-8 lg:px-8 py-6">
        <div className="max-w-2xl mx-auto relative">
          <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="Search manga by title..."
            value={searchQuery}
            onChange={e => onSearchChange(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-white/5 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:border-white/30 transition-colors"
            style={{ borderRadius: "8px" }}
          />
          {searching && (
            <div className="absolute right-4 top-1/2 -translate-y-1/2">
              <div className="w-5 h-5 border-2 border-white/10 border-t-white rounded-full animate-spin" />
            </div>
          )}
        </div>
      </section>

      {/* ═══ SEARCH RESULTS ═══ */}
      {searchMode ? (
        <section className="px-4 md:px-8 lg:px-8 py-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-white">
              Search Results {searchResults.length > 0 && `(${searchResults.length})`}
            </h2>
            <button
              onClick={() => {
                setSearchQuery("");
                setSearchMode(false);
                setSearchResults([]);
              }}
              className="text-xs text-white/40 hover:text-white transition-colors"
            >
              Clear
            </button>
          </div>
          {searchResults.length > 0 ? (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
              {searchResults.map(m => (
                <PosterCard key={m.id} manga={m} navigate={navigate} />
              ))}
            </div>
          ) : !searching ? (
            <div className="text-center py-12 text-white/40 text-sm">
              No manga found for &quot;{searchQuery}&quot;
            </div>
          ) : null}
        </section>
      ) : (
        <>
          {/* ═══ FEATURED MANGA ═══ */}
          {popular.length > 0 && (
            <FeaturedMangaSection manga={popular[0]} navigate={navigate} />
          )}

          {/* ═══ CAROUSEL SECTIONS ═══ */}
          {sections.map((section, si) => (
            <Carousel
              key={si}
              title={section.title}
              items={section.items}
              navigate={navigate}
            />
          ))}

          {/* ═══ DISCOVER ═══ */}
          <Discover
            trending={trending}
            popular={popular}
            topRated={topRated}
            recent={recent}
            navigate={navigate}
          />
        </>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   HERO CAROUSEL — Full-screen featured manga (matches site hero)
   ═══════════════════════════════════════════════════════════════ */

function HeroCarousel({ items, navigate }: { items: MangaEntry[]; navigate: (r: any) => void }) {
  const [current, setCurrent] = useState(0);
  const [paused, setPaused] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (paused || items.length === 0) return;
    timerRef.current = setTimeout(() => {
      setCurrent(prev => (prev + 1) % items.length);
    }, 8000);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [current, paused, items.length]);

  if (items.length === 0) return null;

  const manga = items[current];
  const title = getTitle(manga);
  const cover = getCover(manga);
  const score = getScore(manga);
  const description = manga.description || "";
  const type = manga.type?.toUpperCase() || "MANGA";
  const status = manga.status || "";

  return (
    <div
      className="relative w-full h-[60vh] min-h-[400px] overflow-hidden bg-black"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Background — blurred cover */}
      {cover && (
        <img
          src={cover}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
          style={{ filter: "blur(20px) brightness(0.4)", transform: "scale(1.2)" }}
          key={`bg-${current}`}
        />
      )}
      {/* Gradient overlays */}
      <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/60 to-black/30" />
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />

      {/* Content — poster on left, info on right */}
      <div className="relative flex items-center gap-6 md:gap-10 p-6 md:p-12 h-full max-w-7xl mx-auto" style={{ zIndex: 10 }}>
        {/* Poster */}
        <div className="shrink-0 w-[120px] h-[170px] md:w-[180px] md:h-[260px] overflow-hidden hidden sm:block" style={{ borderRadius: "12px" }}>
          {cover && (
            <img src={cover} alt={title} className="w-full h-full object-cover" />
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0 space-y-3">
          {/* Badges */}
          <div className="flex items-center gap-3">
            <span className="px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider bg-white/10 text-white/60 border border-white/10">
              {type}
            </span>
            {status && (
              <span className="px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider bg-white/10 text-white/60 border border-white/10">
                {status}
              </span>
            )}
            <span className="text-xs font-bold text-white/40 uppercase tracking-wider">Featured Manga</span>
          </div>

          {/* Title */}
          <h1 className="text-2xl md:text-4xl lg:text-5xl font-extrabold text-white leading-tight tracking-tight">
            {title}
          </h1>

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
            {manga.genres?.slice(0, 3).map(g => (
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
          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={() => navigate({ page: "manga-detail", id: manga.id })}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-white text-black font-bold text-sm hover:bg-white/90 transition-colors"
              style={{ borderRadius: "8px" }}
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
              </svg>
              Read Now
            </button>
            <button
              onClick={() => navigate({ page: "manga-detail", id: manga.id })}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-white/10 text-white font-bold text-sm hover:bg-white/20 transition-colors border border-white/20 backdrop-blur-sm"
              style={{ borderRadius: "8px" }}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="16" x2="12" y2="12" />
                <line x1="12" y1="8" x2="12.01" y2="8" />
              </svg>
              Details
            </button>
          </div>
        </div>
      </div>

      {/* Dots */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2" style={{ zIndex: 20 }}>
        {items.map((_, idx) => (
          <button
            key={idx}
            onClick={() => setCurrent(idx)}
            className={`h-1.5 rounded-full transition-all ${idx === current ? "w-8 bg-white" : "w-1.5 bg-white/40"}`}
            aria-label={`Slide ${idx + 1}`}
          />
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   FEATURED MANGA SECTION — rounded card (matches site's FeaturedAnimeSection)
   ═══════════════════════════════════════════════════════════════ */

function FeaturedMangaSection({ manga, navigate }: { manga: MangaEntry; navigate: (r: any) => void }) {
  if (!manga) return null;
  const title = getTitle(manga);
  const cover = getCover(manga);
  const score = getScore(manga);
  const description = manga.description || "";
  const bgImage = cover;

  return (
    <section className="px-4 md:px-8 lg:px-8 py-4">
      <div className="relative w-full overflow-hidden" style={{ borderRadius: "20px", minHeight: "300px" }}>
        {/* Background image */}
        {bgImage && (
          <img src={bgImage} alt="" className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
        )}
        {/* Dark gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/50 to-black/20" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />

        {/* Content */}
        <div className="relative flex items-center gap-6 p-6 md:p-8 lg:p-10" style={{ zIndex: 10 }}>
          {/* Poster */}
          <div className="shrink-0 w-[120px] h-[170px] md:w-[150px] md:h-[210px] overflow-hidden" style={{ borderRadius: "12px" }}>
            {cover && <img src={cover} alt={title} className="w-full h-full object-cover" loading="lazy" />}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0 space-y-3">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <svg className="w-4 h-4 text-orange-400" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
                <span className="text-xs font-bold text-white/60 uppercase tracking-wider">Featured Manga</span>
              </div>
              <span className="px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider bg-white/10 text-white/50 border border-white/10">
                Editor&apos;s Pick
              </span>
            </div>

            <h2 className="text-2xl md:text-3xl lg:text-4xl font-extrabold text-white leading-tight tracking-tight">{title}</h2>

            <div className="flex items-center gap-3 flex-wrap">
              {score > 0 && (
                <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-orange-500/20 border border-orange-500/30">
                  <svg className="w-3.5 h-3.5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                  <span className="text-sm font-bold text-yellow-400">{score}%</span>
                </div>
              )}
              {manga.genres?.slice(0, 3).map(g => (
                <span key={g} className="px-2.5 py-1 rounded-lg text-xs font-medium text-white/60 bg-white/5 border border-white/10">
                  {g}
                </span>
              ))}
            </div>

            {description && (
              <p className="text-sm text-white/50 leading-relaxed line-clamp-2 max-w-xl">
                {description.slice(0, 200)}{description.length > 200 ? "..." : ""}
              </p>
            )}

            <div className="flex items-center gap-3 pt-1">
              <button
                onClick={() => navigate({ page: "manga-detail", id: manga.id })}
                className="inline-flex items-center gap-2 px-6 py-2.5 bg-white text-black font-bold text-sm hover:bg-white/90 transition-colors"
                style={{ borderRadius: "8px" }}
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
                  <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
                </svg>
                Read Now
              </button>
              <button
                onClick={() => navigate({ page: "manga-detail", id: manga.id })}
                className="inline-flex items-center gap-2 px-6 py-2.5 bg-white/10 text-white font-bold text-sm hover:bg-white/20 transition-colors border border-white/20 backdrop-blur-sm"
                style={{ borderRadius: "8px" }}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="16" x2="12" y2="12" />
                  <line x1="12" y1="8" x2="12.01" y2="8" />
                </svg>
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
   POSTER CARD — matches site's PosterCard exactly
   ═══════════════════════════════════════════════════════════════ */

function PosterCard({ manga, navigate }: { manga: MangaEntry; navigate: (r: any) => void }) {
  const title = getTitle(manga);
  const cover = getCover(manga);
  const score = getScore(manga);

  return (
    <button
      onClick={() => navigate({ page: "manga-detail", id: manga.id })}
      className="group shrink-0 w-[170px] md:w-[185px] text-left"
    >
      <div className="relative w-full aspect-[3/4] bg-white/5 overflow-hidden" style={{ borderRadius: "4px" }}>
        {cover ? (
          <img src={cover} alt={title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-white/10 font-bold text-2xl">{title.charAt(0)}</div>
        )}
        {/* Score badge — bottom-left */}
        {score > 0 && (
          <div className="absolute bottom-2 left-2 px-2 py-0.5 bg-black/80 backdrop-blur-sm text-xs font-bold text-white" style={{ borderRadius: "3px" }}>
            ★ {score}%
          </div>
        )}
        {/* Type badge — top-right */}
        {manga.type && (
          <div className="absolute top-2 right-2 px-1.5 py-0.5 bg-black/80 backdrop-blur-sm text-[8px] font-bold text-white/80 uppercase" style={{ borderRadius: "3px" }}>
            {manga.type}
          </div>
        )}
      </div>
      <div className="mt-2">
        <p className="text-sm font-semibold text-white truncate group-hover:text-white/80 transition-colors">{title}</p>
        <div className="flex items-center gap-2 mt-0.5 text-xs text-white/40">
          {manga.status && <span>{manga.status}</span>}
        </div>
      </div>
    </button>
  );
}

/* ═══════════════════════════════════════════════════════════════
   CAROUSEL — Section with title + scrollable posters (matches site)
   ═══════════════════════════════════════════════════════════════ */

function Carousel({ title, items, navigate }: {
  title: string;
  items: MangaEntry[];
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
        <h2 className="text-xl font-bold text-white">{title}</h2>
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
        {items.map(m => (
          <PosterCard key={m.id} manga={m} navigate={navigate} />
        ))}
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════
   DISCOVER — Tabs + grid + sidebar (matches site's Discover)
   ═══════════════════════════════════════════════════════════════ */

type DiscoverTab = "trending" | "topRated" | "popular";

function Discover({ trending, popular, topRated, recent, navigate }: {
  trending: MangaEntry[];
  popular: MangaEntry[];
  topRated: MangaEntry[];
  recent: MangaEntry[];
  navigate: (r: any) => void;
}) {
  const [tab, setTab] = useState<DiscoverTab>("trending");
  const tabData = { trending, topRated, popular };
  const items = tabData[tab];

  return (
    <section className="px-4 md:px-8 lg:px-8 py-4">
      <div className="grid lg:grid-cols-[1fr_380px] gap-1">
        {/* Left: Discover with tabs */}
        <div>
          {/* Tabs */}
          <div className="flex items-center gap-4 mb-4">
            <h2 className="text-xl font-bold text-white">Discover</h2>
            <div className="flex gap-1">
              {([
                { id: "trending" as const, label: "Trending" },
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

          {/* Manga grid */}
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-4 lg:grid-cols-4 gap-2">
            {items.slice(0, 12).map(m => (
              <PosterCard key={m.id} manga={m} navigate={navigate} />
            ))}
          </div>
        </div>

        {/* Right: Top Manga sidebar (matches site's Top Anime sidebar) */}
        <div className="flex flex-col gap-3" style={{ marginTop: "52px" }}>
          <div>
            <div className="flex flex-col gap-2 rounded-xl border border-white/[0.08] bg-[#0D0D0D] p-2">
              <h3 className="text-sm font-extrabold text-white uppercase tracking-wider px-1 pt-1 pb-2 border-b border-white/[0.06]">Top Manga</h3>
              {topRated.slice(0, 5).map(m => {
                const cover = getCover(m);
                const title = getTitle(m);
                const score = getScore(m);
                return (
                  <button
                    key={m.id}
                    onClick={() => navigate({ page: "manga-detail", id: m.id })}
                    className="relative flex items-center gap-2.5 text-left group overflow-hidden rounded-lg border border-white/[0.06] bg-[#0D0D0D] transition-all duration-300 hover:border-white/20"
                  >
                    {cover && (
                      <img src={cover} alt="" className="absolute inset-0 w-full h-full object-cover transition-all duration-500 group-hover:grayscale-0 group-hover:brightness-50" style={{ filter: "grayscale(1) brightness(0.25)", opacity: 0.6 }} loading="lazy" />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-r from-[#0D0D0D] via-[#0D0D0D]/70 to-transparent transition-opacity duration-300 group-hover:via-[#0D0D0D]/50" />
                    <div className="relative shrink-0 w-[64px] h-[90px] overflow-hidden rounded z-10 transition-transform duration-300 group-hover:scale-105">
                      {cover && <img src={cover} alt="" className="w-full h-full object-cover" loading="lazy" />}
                    </div>
                    <div className="relative min-w-0 flex-1 z-10 py-2 pr-2 transition-transform duration-300 group-hover:translate-x-1">
                      <p className="text-sm font-bold text-white truncate group-hover:text-white transition-colors">{title}</p>
                      <div className="flex items-center gap-1.5 mt-0.5 text-xs text-white/40 flex-wrap">
                        {m.type && <span className="px-1 py-0.5 rounded bg-white/10 text-white/50 font-medium uppercase">{m.type}</span>}
                        {m.status && <span>{m.status}</span>}
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

          {/* Recent Updates sidebar */}
          <div>
            <div className="flex flex-col gap-2 rounded-xl border border-white/[0.08] bg-[#0D0D0D] p-2">
              <h3 className="text-sm font-extrabold text-white uppercase tracking-wider px-1 pt-1 pb-2 border-b border-white/[0.06]">Recent Updates</h3>
              {recent.slice(0, 5).map(m => {
                const cover = getCover(m);
                const title = getTitle(m);
                return (
                  <button
                    key={m.id}
                    onClick={() => navigate({ page: "manga-detail", id: m.id })}
                    className="relative flex items-center gap-2.5 text-left group overflow-hidden rounded-lg border border-white/[0.06] bg-[#0D0D0D] transition-all duration-300 hover:border-white/20"
                  >
                    {cover && (
                      <img src={cover} alt="" className="absolute inset-0 w-full h-full object-cover transition-all duration-500 group-hover:grayscale-0 group-hover:brightness-50" style={{ filter: "grayscale(1) brightness(0.25)", opacity: 0.6 }} loading="lazy" />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-r from-[#0D0D0D] via-[#0D0D0D]/70 to-transparent transition-opacity duration-300 group-hover:via-[#0D0D0D]/50" />
                    <div className="relative shrink-0 w-[64px] h-[90px] overflow-hidden rounded z-10 transition-transform duration-300 group-hover:scale-105">
                      {cover && <img src={cover} alt="" className="w-full h-full object-cover" loading="lazy" />}
                    </div>
                    <div className="relative min-w-0 flex-1 z-10 py-2 pr-2 transition-transform duration-300 group-hover:translate-x-1">
                      <p className="text-sm font-bold text-white truncate group-hover:text-white transition-colors">{title}</p>
                      <div className="flex items-center gap-1.5 mt-0.5 text-xs text-white/40 flex-wrap">
                        {m.type && <span className="px-1 py-0.5 rounded bg-white/10 text-white/50 font-medium uppercase">{m.type}</span>}
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
