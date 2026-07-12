"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useAppStore } from "./store";

/* ═══════════════════════════════════════════════════════════════
   LUFFYTV MANGA — v7 (site-blue, mirrors anime-section-page layout)
   ─────────────────────────────────────────────────────────────────
   DATA
   • Provider: atsumaru via manga-scrape-api.vercel.app
   • Home sections: /api/manga/home (posters only — no banners/scores
     on the home feed)
   • Banner enrichment: /api/manga/banners?ids=…  (AniList GraphQL →
     real bannerImage + score + genres + description for the hero &
     featured titles; anilistId is resolved by fetching /api/manga/detail
     for the top-rated candidates)
   • Search: /api/manga/search?q=…

   STRUCTURE — mirrors anime-section-page.tsx:
   1. Full-screen hero carousel (bottom-left content, square buttons,
      nav dots)
   2. Top Trending rail (Netflix-style ranking numbers + tabs)
   3. Featured Manga card (backdrop + poster + info)
   4. Per-section carousels (scroll arrows)
   5. Discover grid + sidebar (Top Manga + Recent Updates)
   6. Inline search bar + filter chips folded into the page flow
      (no competing second navbar)

   ACCENT — site blue #1e88ff (matches the site's primary accent)
   ═══════════════════════════════════════════════════════════════ */

const ACCENT = "#1e88ff";

// Type badge colors
const TYPE_COLORS: Record<string, string> = {
  manga: "#8E7CE6",
  manhwa: "#3B82F6",
  manhua: "#F59E0B",
  novel: "#10B981",
  "one shot": "#EC4899",
};

// ────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────

interface MangaEntry {
  id: string;
  title: string;
  englishTitle?: string;
  poster?: string;
  cover?: string;
  type?: string;
  status?: string;
  year?: number;
  genres?: string[];
  source?: string;
  rating?: number;
  chapterCount?: number;
  description?: string;
  anilistId?: number;
}

interface MangaSection {
  title: string;
  type: string;
  items: MangaEntry[];
}

// Enriched with AniList banner/score/genres
interface EnrichedManga extends MangaEntry {
  banner?: string;
  anilistScore?: number;
  anilistGenres?: string[];
  anilistDescription?: string;
  anilistStatus?: string;
  anilistFormat?: string;
}

// ────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────

function getTitle(m: MangaEntry | EnrichedManga): string {
  return m.englishTitle || m.title || "Unknown";
}
function getCover(m: MangaEntry | EnrichedManga): string {
  return m.poster || m.cover || "";
}
function getBanner(m: EnrichedManga): string {
  return m.banner || m.poster || m.cover || "";
}
function getScore(m: MangaEntry | EnrichedManga): number {
  const e = m as EnrichedManga;
  if (e.anilistScore && e.anilistScore > 0) {
    return e.anilistScore > 20 ? e.anilistScore : Math.round(e.anilistScore * 10);
  }
  if (!m.rating) return 0;
  return m.rating > 10 ? Math.round(m.rating) : Math.round(m.rating * 10);
}
function getGenres(m: EnrichedManga): string[] {
  return m.anilistGenres?.length ? m.anilistGenres : (m.genres || []);
}
function getDescription(m: EnrichedManga): string {
  const d = m.anilistDescription || m.description || "";
  return d.replace(/<[^>]*>/g, "");
}

// ═══════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════

export default function MangaPage() {
  const navigate = useAppStore(s => s.navigate);
  const sectionSubPage = useAppStore(s => s.sectionSubPage);

  // Helper: navigate to manga detail, storing poster as fallback
  // (mangaball info endpoint is broken for some manga, so the detail
  // page may get an empty poster — this ensures we always have one)
  const goToDetail = useCallback((manga: { id: string; poster?: string; cover?: string; title?: string; englishTitle?: string }) => {
    try {
      const poster = manga.poster || manga.cover || "";
      const title = manga.englishTitle || manga.title || "";
      if (poster) sessionStorage.setItem(`manga-poster-${manga.id}`, poster);
      if (title) sessionStorage.setItem(`manga-title-${manga.id}`, title);
    } catch { /* ignore */ }
    navigate({ page: "manga-detail", id: manga.id });
  }, [navigate]);

  const [sections, setSections] = useState<MangaSection[]>([]);
  const [searchResults, setSearchResults] = useState<MangaEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [searchMode, setSearchMode] = useState(false);
  const [enriched, setEnriched] = useState<EnrichedManga[]>([]);

  // Sub-page data (Popular, Top Rated, Recently Added, Schedule)
  const [subPageData, setSubPageData] = useState<MangaEntry[]>([]);
  const [subPageLoading, setSubPageLoading] = useState(false);

  // Inline filter state (folded into page, not a second navbar)
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [sort, setSort] = useState<"latest" | "rating" | "az">("latest");

  // ── Load home ──
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

  // ── Enrich top manga with AniList banners (for hero + featured) ──
  useEffect(() => {
    if (sections.length === 0) return;
    let cancelled = false;
    async function enrich() {
      try {
        const seen = new Set<string>();
        const candidates: MangaEntry[] = [];
        for (const m of sections.flatMap(s => s.items)) {
          if (seen.has(m.id)) continue;
          seen.add(m.id);
          candidates.push(m);
        }
        candidates.sort((a, b) => (b.rating || 0) - (a.rating || 0));
        const top = candidates.slice(0, 10);

        // Fetch META ONLY (no chapters) for anilistId (parallel, capped at 8).
        // Uses the lightweight /api/manga/meta endpoint instead of /api/manga/detail
        // to avoid the expensive cross-provider chapter merge on the home page.
        const infos = await Promise.all(
          top.slice(0, 8).map(async m => {
            try {
              const res = await fetch(`/api/manga/meta?id=${encodeURIComponent(m.id)}`);
              if (res.ok) {
                const d = await res.json();
                // anilistId may come back as a string from the API — parse to number
                const alId = d.anilistId ? parseInt(String(d.anilistId), 10) : undefined;
                return { ...m, anilistId: alId && !isNaN(alId) ? alId : undefined };
              }
            } catch { /* ignore */ }
            return m;
          }),
        );

        const anilistIds = infos
          .map(m => m.anilistId)
          .filter((id): id is number => typeof id === "number" && id > 0);

        if (anilistIds.length === 0) {
          if (!cancelled) setEnriched(infos as EnrichedManga[]);
          return;
        }

        const bannerRes = await fetch(`/api/manga/banners?ids=${anilistIds.join(",")}`);
        const bannerData = bannerRes.ok ? await bannerRes.json() : { banners: {} };
        const banners: Record<number, any> = bannerData.banners || {};

        const enrichedManga: EnrichedManga[] = infos.map(m => {
          const al = m.anilistId ? banners[m.anilistId] : null;
          return {
            ...m,
            banner: al?.banner || "",
            anilistScore: al?.score || 0,
            anilistGenres: al?.genres || [],
            anilistDescription: al?.description || "",
            anilistStatus: al?.status || "",
            anilistFormat: al?.format || "",
          };
        });

        // Banners first, then by score
        enrichedManga.sort((a, b) => {
          const ab = a.banner ? 1 : 0;
          const bb = b.banner ? 1 : 0;
          if (ab !== bb) return bb - ab;
          return getScore(b) - getScore(a);
        });

        if (!cancelled) setEnriched(enrichedManga);
      } catch (err) {
        console.error("[manga-page] enrich error:", err);
      }
    }
    enrich();
    return () => { cancelled = true; };
  }, [sections]);

  // ── Load sub-page data (Popular / Top Rated / Recently Added / Schedule) ──
  useEffect(() => {
    if (sectionSubPage === "home") {
      setSubPageData([]);
      return;
    }
    let cancelled = false;
    async function loadSubPage() {
      setSubPageLoading(true);
      try {
        let endpoint = "";
        let label = "";
        if (sectionSubPage === "popular") { endpoint = "/api/manga/popular"; label = "Popular"; }
        else if (sectionSubPage === "top-rated") { endpoint = "/api/manga/top-rated"; label = "Top Rated"; }
        else if (sectionSubPage === "recently-added") { endpoint = "/api/manga/recently-added"; label = "Recently Added"; }
        if (!endpoint) { setSubPageLoading(false); return; }
        const res = await fetch(endpoint);
        if (res.ok && !cancelled) {
          const data = await res.json();
          setSubPageData(data.items || data.results || []);
        }
      } catch { /* ignore */ }
      if (!cancelled) setSubPageLoading(false);
    }
    loadSubPage();
    return () => { cancelled = true; };
  }, [sectionSubPage]);

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

  // ── Derived ──
  const allItems = sections.flatMap(s => s.items);
  const heroItems = enriched.filter(m => m.banner).slice(0, 6);
  const trending = enriched.length > 0 ? enriched : allItems.slice(0, 12);
  const topRated = [...allItems].sort((a, b) => (b.rating || 0) - (a.rating || 0)).slice(0, 10);
  const popular = [...allItems].sort((a, b) => (b.rating || 0) - (a.rating || 0)).slice(0, 12);
  const recent = allItems.slice(0, 12);
  const featured = enriched.find(m => m.banner) || enriched[0] || popular[0];

  // Filter logic for the Discover grid
  const applyFilters = (items: MangaEntry[]) => {
    let out = [...items];
    if (typeFilter !== "all") {
      out = out.filter(m => (m.type || "manga").toLowerCase() === typeFilter);
    }
    if (sort === "rating") out.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    else if (sort === "az") out.sort((a, b) => getTitle(a).localeCompare(getTitle(b)));
    return out;
  };

  // ── Loading ──
  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-white/10 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white pb-12">
      {/* ═══ HERO (only on home sub-page) ═══ */}
      {!searchMode && sectionSubPage === "home" && heroItems.length > 0 && (
        <HeroCarousel items={heroItems} goToDetail={goToDetail} />
      )}

      {/* ═══ INLINE SEARCH + FILTER BAR ═══ */}
      <section className="px-4 md:px-8 lg:px-8 py-6">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
          {/* Search */}
          <div className="relative flex-1">
            <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              placeholder="Search manga…"
              value={searchQuery}
              onChange={e => onSearchChange(e.target.value)}
              className="w-full pl-12 pr-4 py-2.5 bg-white/5 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:border-white/30 transition-colors"
              style={{ borderRadius: "4px" }}
            />
            {searching && (
              <div className="absolute right-4 top-1/2 -translate-y-1/2">
                <div className="w-4 h-4 border-2 border-white/10 border-t-white rounded-full animate-spin" />
              </div>
            )}
          </div>
          {/* Filter chips */}
          {!searchMode && sectionSubPage === "home" && (
            <div className="flex gap-1.5 flex-wrap">
              {(["all", "manga", "manhwa", "manhua"] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setTypeFilter(t)}
                  className="px-3 py-2 text-xs font-semibold transition-colors capitalize"
                  style={{
                    borderRadius: "4px",
                    background: typeFilter === t ? ACCENT : "rgba(255,255,255,0.05)",
                    color: typeFilter === t ? "#fff" : "rgba(255,255,255,0.5)",
                    border: `1px solid ${typeFilter === t ? ACCENT : "rgba(255,255,255,0.1)"}`,
                  }}
                >
                  {t === "all" ? "All" : t}
                </button>
              ))}
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
                <PosterCard key={m.id} manga={m} goToDetail={goToDetail} />
              ))}
            </div>
          ) : !searching ? (
            <div className="text-center py-12 text-white/40 text-sm">
              No manga found for &quot;{searchQuery}&quot;
            </div>
          ) : null}
        </section>
      ) : sectionSubPage !== "home" ? (
        /* ═══ SUB-PAGE GRID (Popular / Top Rated / Recently Added / Schedule) ═══ */
        <SubPageGrid
          title={sectionSubPage === "popular" ? "Popular Manga"
            : sectionSubPage === "top-rated" ? "Top Rated Manga"
            : sectionSubPage === "recently-added" ? "Recently Added Manga"
            : "Manga"}
          items={subPageData}
          loading={subPageLoading}
          goToDetail={goToDetail}
        />
      ) : (
        <>
          {/* ═══ TOP TRENDING ═══ */}
          <TopTrending trending={trending} topRated={topRated} goToDetail={goToDetail} />

          {/* ═══ FEATURED ═══ */}
          {featured && <FeaturedMangaSection manga={featured} goToDetail={goToDetail} />}

          {/* ═══ CAROUSELS ═══ */}
          {sections.map((section, si) => (
            <Carousel
              key={si}
              title={section.title}
              items={applyFilters(section.items)}
              goToDetail={goToDetail}
            />
          ))}

          {/* ═══ DISCOVER ═══ */}
          <Discover
            trending={trending}
            popular={popular}
            topRated={topRated}
            recent={recent}
            goToDetail={goToDetail}
            typeFilter={typeFilter}
            sort={sort}
            setSort={setSort}
            applyFilters={applyFilters}
          />
        </>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SUB-PAGE GRID — Popular / Top Rated / Recently Added / Schedule
   A full-width poster grid with a title header.
   ═══════════════════════════════════════════════════════════════ */

function SubPageGrid({ title, items, loading, goToDetail }: {
  title: string;
  items: MangaEntry[];
  loading: boolean;
  goToDetail: (m: any) => void;
}) {
  if (loading) {
    return (
      <section className="px-4 md:px-8 lg:px-8 py-8">
        <div className="h-8 w-64 skeleton rounded mb-6" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="h-32 skeleton rounded-lg" />
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="px-4 md:px-8 lg:px-8 py-8 max-w-7xl mx-auto">
      <h2 className="text-2xl font-bold text-white mb-6">{title}</h2>
      {items.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {items.map(m => (
            <RecentUpdateCard key={m.id} manga={m} goToDetail={goToDetail} />
          ))}
        </div>
      ) : (
        <div className="text-center py-12 text-white/40 text-sm">
          No manga found.
        </div>
      )}
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════
   RECENT UPDATE CARD — 2-column wide card (matches screenshot style)
   Poster on left, title + type + rating + status on right
   ═══════════════════════════════════════════════════════════════ */

function RecentUpdateCard({ manga, goToDetail }: { manga: MangaEntry; goToDetail: (m: any) => void }) {
  const [imgLoaded, setImgLoaded] = useState(false);
  const displayTitle = manga.englishTitle || manga.title;
  const poster = manga.poster || manga.cover || "";
  const score = manga.rating ? (manga.rating > 10 ? Math.round(manga.rating) : Math.round(manga.rating * 10)) : 0;
  const tColor = manga.type ? (TYPE_COLORS[manga.type.toLowerCase()] || "#8E7CE6") : "#8E7CE6";

  return (
    <button
      onClick={() => goToDetail(manga)}
      className="group flex items-center gap-4 p-3 bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06] hover:border-white/20 transition-all text-left w-full"
      style={{ borderRadius: "8px" }}
    >
      {/* Poster thumbnail */}
      <div className="shrink-0 w-16 h-24 sm:w-20 sm:h-28 rounded-lg overflow-hidden bg-white/5 relative">
        {!imgLoaded && <div className="absolute inset-0 skeleton" />}
        {poster && (
          <img
            src={poster}
            alt={displayTitle}
            className={`w-full h-full object-cover transition-all duration-300 group-hover:scale-105 ${imgLoaded ? "opacity-100" : "opacity-0"}`}
            onLoad={() => setImgLoaded(true)}
            loading="lazy"
          />
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0 flex flex-col gap-1.5">
        {/* Top row: type badge + time */}
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className="text-[8px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider"
            style={{ background: `${tColor}20`, color: tColor, border: `1px solid ${tColor}40` }}
          >
            {manga.type || "Manga"}
          </span>
          {manga.status && (
            <span className="text-[9px] text-white/40 font-medium uppercase tracking-wider">
              {manga.status}
            </span>
          )}
        </div>

        {/* Title */}
        <h3 className="text-sm font-bold text-white line-clamp-1 group-hover:text-white/80 transition-colors">
          {displayTitle}
        </h3>

        {/* Bottom row: rating + chapter hint */}
        <div className="flex items-center gap-3 flex-wrap text-[10px] text-white/40">
          {score > 0 && (
            <span className="flex items-center gap-0.5" style={{ color: ACCENT }}>
              <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
              {score}%
            </span>
          )}
          {manga.source && manga.source === "mangaball" && (
            <span className="px-1.5 py-0.5 rounded bg-white/5 text-white/50 font-medium uppercase text-[8px]">
              Multi-lang
            </span>
          )}
          <span className="text-white/30">Tap to read</span>
        </div>
      </div>

      {/* Arrow */}
      <svg className="w-4 h-4 text-white/20 group-hover:text-white/60 transition-colors shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path d="M9 5l7 7-7 7" />
      </svg>
    </button>
  );
}

/* ═══════════════════════════════════════════════════════════════
   HERO CAROUSEL — full-screen, bottom-left (mirrors anime-section-page)
   ═══════════════════════════════════════════════════════════════ */

function HeroCarousel({ items, goToDetail }: { items: EnrichedManga[]; goToDetail: (m: any) => void }) {
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
  const banner = getBanner(manga);
  const score = getScore(manga);
  const description = getDescription(manga);
  const genres = getGenres(manga);
  const type = manga.anilistFormat || manga.type?.toUpperCase() || "MANGA";
  const status = manga.anilistStatus || manga.status || "";

  return (
    <div
      className="relative w-full h-screen min-h-[560px] overflow-hidden bg-black"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {banner && (
        <img
          src={banner}
          alt=""
          className="absolute inset-0 w-full h-full object-cover object-center"
          style={{ animation: "ltv-hero-crossfade 1.2s ease-in-out" }}
          key={`bg-${current}`}
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-transparent to-transparent" />

      <div
        className="absolute bottom-0 left-0 right-0 p-6 md:p-12 lg:p-16 pb-16"
        key={`content-${current}`}
        style={{ animation: "ltv-hero-content-slide 1s ease-out" }}
      >
        <div className="max-w-2xl space-y-3">
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-extrabold text-white leading-[1.05] tracking-tight">
            {title}
          </h1>

          <div className="flex items-center gap-3 flex-wrap text-sm text-white/70">
            {score > 0 && (
              <span className="flex items-center gap-1">
                <svg className="w-4 h-4" fill="currentColor" style={{ color: ACCENT }} viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
                {score}%
              </span>
            )}
            {type && <span>{type}</span>}
            {status && (
              <span className="flex items-center gap-1 text-white">
                <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: ACCENT }} />
                {status === "RELEASING" ? "Releasing" : status === "FINISHED" ? "Complete" : status}
              </span>
            )}
          </div>

          {genres.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              {genres.slice(0, 4).map(g => (
                <span key={g} className="px-3 py-1 text-xs font-medium text-white/60 border border-white/15 rounded-full">
                  {g}
                </span>
              ))}
            </div>
          )}

          {description && (
            <p className="text-sm md:text-base text-white/70 leading-relaxed line-clamp-3 max-w-xl drop-shadow-md">
              {description.slice(0, 280)}{description.length > 280 ? "..." : ""}
            </p>
          )}

          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={() => goToDetail(manga)}
              className="inline-flex items-center gap-2 px-8 py-3 bg-white text-black font-bold text-sm hover:bg-white/90 transition-colors"
              style={{ borderRadius: "4px" }}
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
              </svg>
              Read Now
            </button>
            <button
              onClick={() => goToDetail(manga)}
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
   TOP TRENDING — Netflix-style ranking (mirrors anime-section-page)
   ═══════════════════════════════════════════════════════════════ */

type TrendingTab = "trending" | "topRated" | "newest";

function TopTrending({ trending, topRated, goToDetail }: {
  trending: EnrichedManga[];
  topRated: MangaEntry[];
  goToDetail: (m: any) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [tab, setTab] = useState<TrendingTab>("trending");

  const newest = [...trending].slice(0, 10);
  const tabData: Record<TrendingTab, any[]> = {
    trending,
    topRated: topRated as any,
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
          <svg className="w-5 h-5" fill="currentColor" style={{ color: ACCENT }} viewBox="0 0 24 24">
            <path d="M13.5.67s.74 2.65.74 4.8c0 2.06-1.35 3.73-3.41 3.73-2.07 0-3.63-1.67-3.63-3.73l.03-.36C5.21 7.51 4 10.62 4 14c0 4.42 3.58 8 8 8s8-3.58 8-8C20 8.61 17.41 3.8 13.5.67zM11.71 19c-1.78 0-3.22-1.4-3.22-3.14 0-1.62 1.05-2.76 2.81-3.12 1.77-.36 3.6-1.21 4.62-2.58.39 1.29.59 2.65.59 4.04 0 2.65-2.15 4.8-4.8 4.8z" />
          </svg>
          <h2 className="text-xl font-bold text-white">Top Trending</h2>
          <div className="flex gap-1 ml-4">
            {([
              { id: "trending" as const, label: "Trending" },
              { id: "topRated" as const, label: "Top Rated" },
              { id: "newest" as const, label: "Newest" },
            ]).map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className="px-3 py-1.5 text-xs font-semibold transition-colors"
                style={{
                  borderRadius: "4px",
                  background: tab === t.id ? ACCENT : "transparent",
                  color: tab === t.id ? "#fff" : "rgba(255,255,255,0.4)",
                }}
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
      <div ref={scrollRef} className="flex gap-4 overflow-x-auto pb-2" style={{ scrollbarWidth: "none" }}>
        {items.map((manga, idx) => {
          const cover = getCover(manga);
          const title = getTitle(manga);
          const score = getScore(manga);
          const rank = idx + 1;
          return (
            <button
              key={`${tab}-${manga.id}-${idx}`}
              onClick={() => goToDetail(manga)}
              className="group shrink-0 text-left"
              style={{ width: "170px" }}
            >
              <div className="relative w-full aspect-[2/3] bg-white/5 overflow-visible" style={{ borderRadius: "8px" }}>
                <div className="absolute inset-0 overflow-hidden" style={{ borderRadius: "8px" }}>
                  {cover ? (
                    <img src={cover} alt={title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-white/10 font-bold text-2xl">{title.charAt(0)}</div>
                  )}
                  <div className="absolute bottom-0 left-0 right-0 h-1/3 bg-gradient-to-t from-black/50 to-transparent" />
                </div>
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
                {score > 0 && (
                  <div className="absolute top-2 right-2 px-2 py-0.5 bg-black/80 backdrop-blur-sm text-xs font-bold text-white z-30" style={{ borderRadius: "3px" }}>
                    ★ {score}%
                  </div>
                )}
              </div>
              <div className="mt-2.5">
                <p className="text-sm font-semibold text-white truncate group-hover:text-white/80 transition-colors">{title}</p>
                <p className="text-xs text-white/40 mt-0.5">
                  {manga.type?.toUpperCase() || "MANGA"}
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
   FEATURED MANGA — rounded card (mirrors anime-section-page)
   ═══════════════════════════════════════════════════════════════ */

function FeaturedMangaSection({ manga, goToDetail }: { manga: EnrichedManga; goToDetail: (m: any) => void }) {
  const title = getTitle(manga);
  const cover = getCover(manga);
  const banner = getBanner(manga);
  const score = getScore(manga);
  const description = getDescription(manga);
  const genres = getGenres(manga);
  const bgImage = banner || cover;

  return (
    <section className="px-4 md:px-8 lg:px-8 py-4">
      <div className="relative w-full overflow-hidden" style={{ borderRadius: "20px", minHeight: "300px" }}>
        {bgImage && (
          <img src={bgImage} alt="" className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
        )}
        <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/50 to-black/20" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />

        <div className="relative flex items-center gap-6 p-6 md:p-8 lg:p-10" style={{ zIndex: 10 }}>
          <div className="shrink-0 w-[120px] h-[170px] md:w-[150px] md:h-[210px] overflow-hidden" style={{ borderRadius: "12px" }}>
            {cover && <img src={cover} alt={title} className="w-full h-full object-cover" loading="lazy" />}
          </div>

          <div className="flex-1 min-w-0 space-y-3">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <svg className="w-4 h-4" fill="currentColor" style={{ color: ACCENT }} viewBox="0 0 20 20">
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
                <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg" style={{ background: `${ACCENT}20`, border: `1px solid ${ACCENT}40` }}>
                  <svg className="w-3.5 h-3.5" fill="currentColor" style={{ color: ACCENT }} viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                  <span className="text-sm font-bold" style={{ color: ACCENT }}>{score}%</span>
                </div>
              )}
              {genres.slice(0, 3).map(g => (
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
                onClick={() => goToDetail(manga)}
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
                onClick={() => goToDetail(manga)}
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
   POSTER CARD (mirrors anime-section-page PosterCard)
   ═══════════════════════════════════════════════════════════════ */

function PosterCard({ manga, goToDetail }: { manga: MangaEntry; goToDetail: (m: any) => void }) {
  const title = getTitle(manga);
  const cover = getCover(manga);
  const score = getScore(manga);

  return (
    <button
      onClick={() => goToDetail(manga)}
      className="group shrink-0 w-[170px] md:w-[185px] text-left"
    >
      <div className="relative w-full aspect-[3/4] bg-white/5 overflow-hidden" style={{ borderRadius: "4px" }}>
        {cover ? (
          <img src={cover} alt={title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-white/10 font-bold text-2xl">{title.charAt(0)}</div>
        )}
        {score > 0 && (
          <div className="absolute bottom-2 left-2 px-2 py-0.5 bg-black/80 backdrop-blur-sm text-xs font-bold text-white" style={{ borderRadius: "3px" }}>
            ★ {score}%
          </div>
        )}
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
   CAROUSEL (mirrors anime-section-page Carousel)
   ═══════════════════════════════════════════════════════════════ */

function Carousel({ title, items, goToDetail }: {
  title: string;
  items: MangaEntry[];
  goToDetail: (m: any) => void;
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
          <PosterCard key={m.id} manga={m} goToDetail={goToDetail} />
        ))}
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════
   DISCOVER — tabs + grid + sidebar (mirrors anime-section-page)
   ═══════════════════════════════════════════════════════════════ */

type DiscoverTab = "trending" | "topRated" | "popular";

function Discover({ trending, popular, topRated, recent, goToDetail, typeFilter, sort, setSort, applyFilters }: {
  trending: EnrichedManga[];
  popular: MangaEntry[];
  topRated: MangaEntry[];
  recent: MangaEntry[];
  goToDetail: (m: any) => void;
  typeFilter: string;
  sort: "latest" | "rating" | "az";
  setSort: (s: "latest" | "rating" | "az") => void;
  applyFilters: (items: MangaEntry[]) => MangaEntry[];
}) {
  const [tab, setTab] = useState<DiscoverTab>("trending");
  const tabData = { trending, topRated, popular };
  const items = applyFilters(tabData[tab]);

  return (
    <section className="px-4 md:px-8 lg:px-8 py-4">
      <div className="grid lg:grid-cols-[1fr_380px] gap-1">
        {/* Left: Discover tabs + grid */}
        <div>
          <div className="flex items-center gap-4 mb-4 flex-wrap">
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
                  className="px-3 py-1.5 text-xs font-semibold transition-colors"
                  style={{
                    borderRadius: "4px",
                    background: tab === t.id ? ACCENT : "transparent",
                    color: tab === t.id ? "#fff" : "rgba(255,255,255,0.4)",
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>
            {/* Sort dropdown */}
            <select
              value={sort}
              onChange={e => setSort(e.target.value as any)}
              className="ml-auto px-2 py-1.5 text-xs font-semibold bg-white/5 border border-white/10 text-white/60 focus:outline-none"
              style={{ borderRadius: "4px" }}
            >
              <option value="latest">Latest</option>
              <option value="rating">Rating</option>
              <option value="az">A → Z</option>
            </select>
          </div>

          {items.length > 0 ? (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-4 lg:grid-cols-4 gap-2">
              {items.slice(0, 12).map(m => (
                <PosterCard key={m.id} manga={m} goToDetail={goToDetail} />
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-white/40 text-sm">No manga match this filter.</div>
          )}
        </div>

        {/* Right: Top Manga + Recent Updates sidebar */}
        <div className="flex flex-col gap-3" style={{ marginTop: "52px" }}>
          {/* Top Manga */}
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
                    onClick={() => goToDetail(m)}
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
                          <span className="flex items-center gap-0.5" style={{ color: ACCENT }}>
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

          {/* Recent Updates */}
          <div>
            <div className="flex flex-col gap-2 rounded-xl border border-white/[0.08] bg-[#0D0D0D] p-2">
              <h3 className="text-sm font-extrabold text-white uppercase tracking-wider px-1 pt-1 pb-2 border-b border-white/[0.06]">Recent Updates</h3>
              {recent.slice(0, 5).map(m => {
                const cover = getCover(m);
                const title = getTitle(m);
                return (
                  <button
                    key={m.id}
                    onClick={() => goToDetail(m)}
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
