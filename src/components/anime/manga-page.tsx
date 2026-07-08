"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useAppStore } from "./store";
import { proxifyMangaImage } from "@/lib/proxy";

/* ═══════════════════════════════════════════════════════════════
   LUFFYTV MANGA — "The Archive"
   ─────────────────────────────────────────────────────────────────
   Pink-accented (#F472B6) manga section. Real data comes straight
   from atsumaru's home feed (trending/popular/latest) via
   /api/manga/home. Solid surfaces, dense poster grid, one floating
   navbar (the site's) — no competing sticky sub-bar. Covers route
   through the Cloudflare Worker proxy for speed.
   ═══════════════════════════════════════════════════════════════ */

const ACCENT = "#F472B6";

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
  rating?: number;
  source?: string;
}

interface MangaSection {
  title: string;
  type: string;
  items: MangaEntry[];
}

function getTitle(m: MangaEntry): string {
  return m.englishTitle || m.title || "Unknown";
}

function getCover(m: MangaEntry): string {
  return proxifyMangaImage(m.poster || m.cover || "");
}

function typeColor(type?: string): string {
  const t = (type || "").toLowerCase();
  if (t === "manhwa") return "#34D399";
  if (t === "manhua") return "#22D3EE";
  return ACCENT;
}

type TypeFilter = "all" | "manga" | "manhwa" | "manhua";

const TYPE_FILTERS: { id: TypeFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "manga", label: "Manga" },
  { id: "manhwa", label: "Manhwa" },
  { id: "manhua", label: "Manhua" },
];

export default function MangaPage() {
  const navigate = useAppStore(s => s.navigate);

  const [sections, setSections] = useState<MangaSection[]>([]);
  const [loading, setLoading] = useState(true);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<MangaEntry[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchMode, setSearchMode] = useState(false);

  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");

  // ── Load home sections (real atsumaru trending/popular/latest) ──
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/manga/home");
        if (res.ok && !cancelled) {
          const data = await res.json();
          setSections(data.sections || []);
        }
      } catch { /* ignore */ }
      if (!cancelled) setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, []);

  // ── Debounced search ──
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const runSearch = useCallback(async (query: string) => {
    try {
      const res = await fetch(`/api/manga/search?q=${encodeURIComponent(query)}`);
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
    if (value.trim().length < 2) {
      searchTimer.current = setTimeout(() => {
        setSearchMode(false);
        setSearchResults([]);
        setSearching(false);
      }, 0);
      return;
    }
    setSearchMode(true);
    searchTimer.current = setTimeout(() => {
      setSearching(true);
      runSearch(value.trim());
    }, 450);
  };

  // ── Derived ──
  const allItems = sections.flatMap(s => s.items);
  const spotlight = allItems.filter(m => m.poster || m.cover).slice(0, 6);

  const filterByType = (items: MangaEntry[]) =>
    typeFilter === "all"
      ? items
      : items.filter(m => (m.type || "manga").toLowerCase() === typeFilter);

  const filteredSections = sections
    .map(s => ({ ...s, items: filterByType(s.items) }))
    .filter(s => s.items.length > 0);

  const filteredSearch = filterByType(searchResults);

  const surpriseMe = () => {
    if (allItems.length === 0) return;
    const pick = allItems[Math.floor(Math.random() * allItems.length)];
    navigate({ page: "manga-detail", id: pick.id });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center -mx-4 lg:-mx-8">
        <div className="w-10 h-10 border-2 border-white/10 rounded-full animate-spin" style={{ borderTopColor: ACCENT }} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white pb-16 -mx-4 lg:-mx-8">
      {/* ═══ SPOTLIGHT ═══ */}
      {!searchMode && spotlight.length > 0 && (
        <Spotlight items={spotlight} navigate={navigate} />
      )}

      <div className="max-w-[1400px] mx-auto px-4 md:px-8">
        {/* ═══ SECTION HEADER + CONTROLS (non-sticky, scrolls with page) ═══ */}
        <div className="pt-6 pb-2">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-extrabold tracking-tight">
              The <span style={{ color: ACCENT }}>Archive</span>
            </h1>
            <span className="text-xs text-white/40">Manga · Manhwa · Manhua</span>
            <button
              onClick={surpriseMe}
              className="ml-auto px-4 py-1.5 rounded-full text-xs font-bold text-black transition-transform hover:scale-105"
              style={{ background: ACCENT }}
            >
              Surprise me
            </button>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[220px] max-w-md">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                placeholder="Search the archive..."
                value={searchQuery}
                onChange={e => onSearchChange(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-white/[0.04] border border-white/10 text-white placeholder-white/30 text-sm rounded-full focus:outline-none transition-colors"
                style={{ borderColor: searchQuery ? ACCENT + "80" : undefined }}
              />
              {searching && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-white/10 rounded-full animate-spin" style={{ borderTopColor: ACCENT }} />
              )}
            </div>

            <div className="flex items-center gap-1.5">
              {TYPE_FILTERS.map(f => {
                const active = typeFilter === f.id;
                const color = f.id === "all" ? ACCENT : typeColor(f.id);
                return (
                  <button
                    key={f.id}
                    onClick={() => setTypeFilter(f.id)}
                    className="px-3 py-1.5 rounded-full text-xs font-bold transition-colors border"
                    style={active
                      ? { background: color, color: "#000", borderColor: color }
                      : { background: "transparent", color: "rgba(255,255,255,0.5)", borderColor: "rgba(255,255,255,0.1)" }}
                  >
                    {f.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* ═══ SEARCH RESULTS ═══ */}
        {searchMode ? (
          <section className="py-6">
            <div className="flex items-center gap-3 mb-4">
              <span className="w-1 h-5 rounded-full" style={{ background: ACCENT }} />
              <h2 className="text-lg font-bold">Results for &quot;{searchQuery}&quot;</h2>
              {filteredSearch.length > 0 && <span className="text-xs text-white/30">{filteredSearch.length}</span>}
            </div>
            {filteredSearch.length > 0 ? (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-3">
                {filteredSearch.map(m => <MangaCard key={m.id} manga={m} navigate={navigate} />)}
              </div>
            ) : !searching ? (
              <div className="text-center py-20 text-white/40 text-sm">No manga found.</div>
            ) : null}
          </section>
        ) : (
          <>
            {filteredSections.length === 0 && (
              <div className="text-center py-20 text-white/40 text-sm">Nothing matches this filter yet.</div>
            )}
            {filteredSections.map((section, si) => (
              <SectionGrid key={si} section={section} navigate={navigate} />
            ))}
          </>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SPOTLIGHT — auto-sliding hero from real covers
   ═══════════════════════════════════════════════════════════════ */

function Spotlight({ items, navigate }: { items: MangaEntry[]; navigate: (r: any) => void }) {
  const [current, setCurrent] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused || items.length <= 1) return;
    const t = setTimeout(() => setCurrent(prev => (prev + 1) % items.length), 6000);
    return () => clearTimeout(t);
  }, [current, paused, items.length]);

  const manga = items[current];
  const title = getTitle(manga);
  const cover = getCover(manga);
  const color = typeColor(manga.type);

  return (
    <div
      className="relative w-full h-[58vh] min-h-[420px] max-h-[600px] overflow-hidden"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {cover && (
        <img
          src={cover}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
          style={{ filter: "blur(26px) brightness(0.4) saturate(1.2)", scale: "1.12" }}
          key={`bg-${current}`}
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/55 to-black/25" />
      <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/25 to-transparent" />
      <div className="absolute inset-0 pointer-events-none" style={{ background: `radial-gradient(ellipse at 15% 100%, ${color}18, transparent 55%)` }} />

      <div className="relative h-full max-w-[1400px] mx-auto px-4 md:px-8 flex items-end pb-12 pt-24">
        <div className="flex gap-6 md:gap-8 items-end w-full" key={`c-${current}`} style={{ animation: "ltv-hero-content-slide 0.7s ease-out" }}>
          {cover && (
            <div className="hidden sm:block shrink-0 w-[150px] md:w-[180px]">
              <div className="aspect-[2/3] rounded-lg overflow-hidden border-2" style={{ borderColor: color + "55", boxShadow: `0 25px 60px rgba(0,0,0,0.6), 0 0 30px ${color}22` }}>
                <img src={cover} alt={title} className="w-full h-full object-cover" />
              </div>
            </div>
          )}
          <div className="flex-1 min-w-0 space-y-3">
            <span className="inline-block px-2.5 py-1 rounded text-[10px] font-black uppercase tracking-wider" style={{ background: color, color: "#000" }}>
              {manga.type || "Manga"}
            </span>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-extrabold leading-[1.05] tracking-tight">{title}</h2>
            <div className="flex items-center gap-3 text-sm text-white/60 flex-wrap">
              {manga.status && <span>{manga.status}</span>}
              {manga.year && <span>· {manga.year}</span>}
              {manga.isAdult && <span className="px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 text-[10px] font-bold">18+</span>}
            </div>
            <button
              onClick={() => navigate({ page: "manga-detail", id: manga.id })}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full font-bold text-sm text-black transition-transform hover:scale-105"
              style={{ background: color }}
            >
              Start Reading
            </button>
          </div>
        </div>
      </div>

      <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex items-center gap-1.5">
        {items.map((_, i) => (
          <button
            key={i}
            onClick={() => setCurrent(i)}
            className="h-1.5 rounded-full transition-all"
            style={{ width: i === current ? "24px" : "6px", background: i === current ? color : "rgba(255,255,255,0.25)" }}
          />
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MANGA CARD
   ═══════════════════════════════════════════════════════════════ */

function MangaCard({ manga, navigate }: { manga: MangaEntry; navigate: (r: any) => void }) {
  const title = getTitle(manga);
  const cover = getCover(manga);
  const color = typeColor(manga.type);
  const [hover, setHover] = useState(false);

  return (
    <button
      onClick={() => navigate({ page: "manga-detail", id: manga.id })}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="group text-left"
    >
      <div
        className="relative w-full aspect-[2/3] bg-white/[0.04] overflow-hidden rounded-md border transition-colors"
        style={{ borderColor: hover ? color : "rgba(255,255,255,0.06)" }}
      >
        {cover ? (
          <img src={cover} alt={title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-white/10 font-bold text-2xl">{title.charAt(0)}</div>
        )}

        <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider" style={{ background: color, color: "#000" }}>
          {manga.type || "Manga"}
        </span>
        {manga.isAdult && (
          <span className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded bg-red-500/90 text-white text-[8px] font-bold">18+</span>
        )}

        {hover && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <span className="px-3 py-1.5 rounded-full text-xs font-bold text-black" style={{ background: color }}>Read Now</span>
          </div>
        )}
      </div>
      <div className="mt-1.5">
        <p className="text-xs md:text-sm font-semibold text-white truncate group-hover:text-white/80 transition-colors">{title}</p>
        <p className="text-[10px] text-white/40 mt-0.5">
          {manga.status || ""}{manga.status && manga.year ? " · " : ""}{manga.year || ""}
        </p>
      </div>
    </button>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SECTION GRID
   ═══════════════════════════════════════════════════════════════ */

function SectionGrid({ section, navigate }: { section: MangaSection; navigate: (r: any) => void }) {
  return (
    <section className="py-6">
      <div className="flex items-center gap-3 mb-4">
        <span className="w-1 h-5 rounded-full" style={{ background: ACCENT }} />
        <h2 className="text-lg font-bold text-white">{section.title}</h2>
        <span className="text-xs text-white/30">{section.items.length} titles</span>
      </div>
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-3">
        {section.items.map(m => <MangaCard key={m.id} manga={m} navigate={navigate} />)}
      </div>
    </section>
  );
}
