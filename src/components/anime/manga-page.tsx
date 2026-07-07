"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useAppStore } from "./store";

/* ═══════════════════════════════════════════════════════════════
   LUFFYTV MANGA — v6 (matches anime-section-page structure exactly)
   ─────────────────────────────────────────────────────────────────
   DATA SOURCE
   • Provider: atsumaru (atsu.moe) via manga-scrape-api.vercel.app
   • API:      /api/scrape/{search,info,chapters,pages}?provider=atsumaru
   • Banner enrichment: /api/manga/banners?ids=... (fetches real
     banner images from AniList GraphQL using the anilistId that
     atsumaru returns on the info endpoint — atsumaru only has posters)

   STRUCTURE — matches anime-section-page.tsx EXACTLY:
   1. Hero carousel (full-screen banner, bottom-left content, square buttons)
   2. Top Trending (Netflix-style ranking numbers, tabs)
   3. Featured Manga section (rounded card)
   4. Horizontal carousel sections (Trending / Popular / etc.)
   5. Discover section (tabs + grid + sidebar with Top Manga + Recent)

   COLORS — matches site exactly:
   • bg-black, text-white, text-white/70, text-white/40
   • White square buttons (bg-white text-black, rounded-[4px])
   • Glass buttons (bg-white/15 border-white/20 backdrop-blur)
   • Tabs: active=bg-white text-black, inactive=text-white/40
   • Score badges: bg-black/80 backdrop-blur text-white
   • Sidebar: bg-[#0D0D0D] border-white/[0.08]
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
  anilistId?: number;
}

interface MangaSection {
  title: string;
  type: string;
  items: MangaEntry[];
}

// Enriched manga (with banner from AniList)
interface EnrichedManga extends MangaEntry {
  banner?: string;
  anilistId?: number;
  anilistScore?: number;
  anilistGenres?: string[];
  anilistDescription?: string;
  anilistStatus?: string;
  anilistFormat?: string;
}

// ────────────────────────────────────────────────────────────────────────
// Helpers (match anime-section-page helpers)
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
  // Prefer AniList score if enriched
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

  // Enriched manga (with AniList banners) for hero + featured
  const [enriched, setEnriched] = useState<EnrichedManga[]>([]);

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

  // ── Fetch banners for top manga (for hero + featured) ──
  // Get info for top ~10 manga to extract their anilistIds, then
  // batch-fetch banners from AniList via /api/manga/banners
  useEffect(() => {
    if (sections.length === 0) return;
    async function enrich() {
      try {
        // Collect candidate manga (deduped, top-rated first)
        const seen = new Set<string>();
        const candidates: MangaEntry[] = [];
        for (const m of sections.flatMap(s => s.items)) {
          if (seen.has(m.id)) continue;
          seen.add(m.id);
          candidates.push(m);
        }
        // Sort by rating desc, take top 12
        candidates.sort((a, b) => (b.rating || 0) - (a.rating || 0));
        const top = candidates.slice(0, 12);

        // Fetch info for each to get anilistId (parallel, capped)
        const infos = await Promise.all(
          top.slice(0, 8).map(async m => {
            try {
              const res = await fetch(`/api/manga/detail?id=${encodeURIComponent(m.id)}`);
              if (res.ok) {
                const d = await res.json();
                return { ...m, anilistId: d.anilistId };
              }
            } catch { /* ignore */ }
            return m;
          }),
        );

        // Collect anilistIds
        const anilistIds = infos
          .map(m => m.anilistId)
          .filter((id): id is number => typeof id === "number" && id > 0);

        if (anilistIds.length === 0) {
          setEnriched(infos as EnrichedManga[]);
          return;
        }

        // Batch-fetch banners from AniList
        const bannerRes = await fetch(`/api/manga/banners?ids=${anilistIds.join(",")}`);
        const bannerData = bannerRes.ok ? await bannerRes.json() : { banners: {} };
        const banners: Record<number, any> = bannerData.banners || {};

        // Merge banners into the manga entries
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

        // Sort: manga WITH banners first (for hero), then by score
        enrichedManga.sort((a, b) => {
          const aBanner = a.banner ? 1 : 0;
          const bBanner = b.banner ? 1 : 0;
          if (aBanner !== bBanner) return bBanner - aBanner;
          return getScore(b) - getScore(a);
        });

        setEnriched(enrichedManga);
      } catch (err) {
        console.error("[manga-page] enrich error:", err);
      }
    }
    enrich();
  }, [sections]);

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
  const heroItems = enriched.filter(m => m.banner).slice(0, 6);
  const trending = enriched.length > 0 ? enriched : allItems.slice(0, 12);
  const topRated = [...allItems].sort((a, b) => (b.rating || 0) - (a.rating || 0)).slice(0, 10);
  const popular = [...allItems].sort((a, b) => (b.rating || 0) - (a.rating || 0)).slice(0, 12);
  const recent = allItems.slice(0, 12);
  const featured = enriched.find(m => m.banner) || enriched[0] || popular[0];

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
      {!searchMode && heroItems.length > 0 && (
        <HeroCarousel items={heroItems} navigate={navigate} />
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
            style={{ borderRadius: "4px" }}
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
          {/* ═══ TOP TRENDING (with ranking numbers) ═══ */}
          <TopTrending trending={trending} topRated={topRated} navigate={navigate} />

          {/* ═══ FEATURED MANGA ═══ */}
          {featured && (
            <FeaturedMangaSection manga={featured} navigate={navigate} />
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
   HERO CAROUSEL — Full-screen, bottom-left content (matches site)
   ═══════════════════════════════════════════════════════════════ */

function HeroCarousel({ items, navigate }: { items: EnrichedManga[]; navigate: (r: any) => void }) {
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
      {/* Background image — full banner */}
      {banner && (
        <img
          src={banner}
          alt=""
          className="absolute inset-0 w-full h-full object-cover object-center"
          style={{ animation: "ltv-hero-crossfade 1.2s ease-in-out" }}
          key={`bg-${current}`}
        />
      )}
      {/* Gradient overlays — match anime-section-page exactly */}
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-transparent to-transparent" />

      {/* Content — bottom left, matches anime hero */}
      <div
        className="absolute bottom-0 left-0 right-0 p-6 md:p-12 lg:p-16 pb-16"
        key={`content-${current}`}
        style={{ animation: "ltv-hero-content-slide 1s ease-out" }}
      >
        <div className="max-w-2xl space-y-3">
          {/* Title */}
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-extrabold text-white leading-[1.05] tracking-tight">
            {title}
          </h1>

          {/* Meta row — matches site exactly */}
          <div className="flex items-center gap-3 flex-wrap text-sm text-white/70">
            {score > 0 && (
              <span className="flex items-center gap-1">
                <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
                {score}%
              </span>
            )}
            {type && <span>{type}</span>}
            {status && (
              <span className="flex items-center gap-1 text-white">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                {status === "RELEASING" ? "Releasing" : status === "FINISHED" ? "Complete" : status}
              </span>
            )}
          </div>

          {/* Genres — pill style matching site */}
          {genres.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              {genres.slice(0, 4).map(g => (
                <span key={g} className="px-3 py-1 text-xs font-medium text-white/60 border border-white/15 rounded-full">
                  {g}
                </span>
              ))}
            </div>
          )}

          {/* Synopsis — matches site */}
          {description && (
            <p className="text-sm md:text-base text-white/70 leading-relaxed line-clamp-3 max-w-xl drop-shadow-md">
              {description.slice(0, 280)}{description.length > 280 ? "..." : ""}
            </p>
          )}

          {/* Action buttons — square, Netflix-style, matches site */}
          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={() => navigate({ page: "manga-detail", id: manga.id })}
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
              onClick={() => navigate({ page: "manga-detail", id: manga.id })}
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

      {/* Navigation dots — matches site */}
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
   TOP TRENDING — Netflix-style ranking numbers (matches site)
   ═══════════════════════════════════════════════════════════════ */

type TrendingTab = "trending" | "topRated" | "newest";

function TopTrending({ trending, topRated, navigate }: {
  trending: EnrichedManga[];
  topRated: MangaEntry[];
  navigate: (r: any) => void;
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
          <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
            <path d="M13.5.67s.74 2.65.74 4.8c0 2.06-1.35 3.73-3.41 3.73-2.07 0-3.63-1.67-3.63-3.73l.03-.36C5.21 7.51 4 10.62 4 14c0 4.42 3.58 8 8 8s8-3.58 8-8C20 8.61 17.41 3.8 13.5.67zM11.71 19c-1.78 0-3.22-1.4-3.22-3.14 0-1.62 1.05-2.76 2.81-3.12 1.77-.36 3.6-1.21 4.62-2.58.39 1.29.59 2.65.59 4.04 0 2.65-2.15 4.8-4.8 4.8z" />
          </svg>
          <h2 className="text-xl font-bold text-white">Top Trending</h2>
          {/* Tabs */}
          <div className="flex gap-1 ml-4">
            {([
              { id: "trending" as const, label: "Trending" },
              { id: "topRated" as const, label: "Top Rated" },
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
        {items.map((manga, idx) => {
          const cover = getCover(manga);
          const title = getTitle(manga);
          const score = getScore(manga);
          const rank = idx + 1;
          return (
            <button
              key={`${tab}-${manga.id}-${idx}`}
              onClick={() => navigate({ page: "manga-detail", id: manga.id })}
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
                {/* Ranking number — matches site exactly */}
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
   FEATURED MANGA SECTION — rounded card (matches site)
   ═══════════════════════════════════════════════════════════════ */

function FeaturedMangaSection({ manga, navigate }: { manga: EnrichedManga; navigate: (r: any) => void }) {
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
        {/* Background image */}
        {bgImage && (
          <img src={bgImage} alt="" className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
        )}
        {/* Dark gradient overlay — matches site */}
        <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/50 to-black/20" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />

        {/* Content — poster on left, info on right */}
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
  trending: EnrichedManga[];
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
