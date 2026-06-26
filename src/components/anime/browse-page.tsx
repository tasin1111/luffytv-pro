"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useAppStore } from "./store";
import ContentCard from "./anime-card";
import type { MiruroAnimeResult } from "@/lib/miruro-api";

/* ═══════════════════════════════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════════════════════════════ */

const SORT_OPTIONS = [
  { id: "most-popular", label: "Most Popular" },
  { id: "high-rated", label: "High Rated" },
  { id: "trending", label: "Trending" },
  { id: "new", label: "New" },
];

const FORMAT_OPTIONS = [
  { id: "TV", label: "TV" },
  { id: "MOVIE", label: "Movie" },
  { id: "TV_SHORT", label: "TV Short" },
  { id: "SPECIAL", label: "Special" },
  { id: "OVA", label: "OVA" },
  { id: "ONA", label: "ONA" },
];

const STATUS_OPTIONS = [
  { id: "RELEASING", label: "Airing" },
  { id: "FINISHED", label: "Finished" },
  { id: "NOT_YET_RELEASED", label: "Not Yet Released" },
  { id: "CANCELLED", label: "Cancelled" },
];

const SEASON_OPTIONS = [
  { id: "WINTER", label: "Winter" },
  { id: "SPRING", label: "Spring" },
  { id: "SUMMER", label: "Summer" },
  { id: "FALL", label: "Fall" },
];

const GENRE_OPTIONS = [
  "Action", "Adventure", "Comedy", "Drama", "Fantasy", "Horror",
  "Mystery", "Psychological", "Romance", "Sci-Fi", "Slice of Life",
  "Sports", "Supernatural", "Thriller", "Isekai", "Mecha",
  "Music", "Ecchi", "Mahou Shoujo", "Historical",
  "Shounen", "Seinen", "Shoujo", "Josei",
];

const YEAR_OPTIONS = (() => {
  const currentYear = new Date().getFullYear();
  const years: { id: string; label: string }[] = [];
  for (let y = currentYear + 1; y >= 1970; y--) {
    years.push({ id: String(y), label: String(y) });
  }
  return years;
})();

const GENRE_COLORS: Record<string, string> = {
  Action: "#ef4444", Adventure: "#f59e0b", Comedy: "#eab308",
  Drama: "#6366f1", Fantasy: "#ffffff", Horror: "#dc2626",
  Mystery: "#0ea5e9", Romance: "#ec4899", "Sci-Fi": "#06b6d4",
  "Slice of Life": "#10b981", Sports: "#22c55e", Supernatural: "#a855f7",
  Thriller: "#f97316", Ecchi: "#f43f5e", Mecha: "#64748b",
  Psychological: "#ffffff", Shounen: "#ef4444", Seinen: "#6366f1",
  Shoujo: "#ec4899", Josei: "#f472b6", Isekai: "#ffffff",
  Music: "#14b8a6", "Mahou Shoujo": "#f9a8d4", Historical: "#92400e",
};

const grok = "var(--font-space-grotesk), 'Space Grotesk', sans-serif";

/* ═══════════════════════════════════════════════════════════════
   NORMALIZE FUNCTION
   ═══════════════════════════════════════════════════════════════ */

function normalizeAnimeItem(item: any): MiruroAnimeResult {
  if (!item) return { id: 0, title: { romaji: "Unknown" } };

  let title: { romaji?: string; english?: string; native?: string };
  if (item.title && typeof item.title === "object") {
    title = {
      romaji: typeof item.title.romaji === "string" ? item.title.romaji : undefined,
      english: typeof item.title.english === "string" ? item.title.english : undefined,
      native: typeof item.title.native === "string" ? item.title.native : undefined,
    };
  } else if (typeof item.title === "string") {
    title = { romaji: item.title, english: item.title };
  } else {
    title = { romaji: "Unknown" };
  }

  let coverImage: { extraLarge?: string; large?: string; medium?: string; color?: string } | undefined;
  if (item.coverImage && typeof item.coverImage === "object") {
    coverImage = {
      extraLarge: typeof item.coverImage.extraLarge === "string" ? item.coverImage.extraLarge : undefined,
      large: typeof item.coverImage.large === "string" ? item.coverImage.large : undefined,
      medium: typeof item.coverImage.medium === "string" ? item.coverImage.medium : undefined,
      color: typeof item.coverImage.color === "string" ? item.coverImage.color : undefined,
    };
  }

  return {
    id: item.id || 0,
    title,
    coverImage,
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
}

/* ═══════════════════════════════════════════════════════════════
   FILTER SECTION COMPONENT — Accordion with smooth animation
   ═══════════════════════════════════════════════════════════════ */

function FilterSection({ title, children, defaultOpen = true }: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const contentRef = useRef<HTMLDivElement>(null);
  const [contentHeight, setContentHeight] = useState<number | undefined>(undefined);

  useEffect(() => {
    if (contentRef.current) {
      setContentHeight(contentRef.current.scrollHeight);
    }
  }, [children, isOpen]);

  return (
    <div className="border-b border-white/[0.06] last:border-b-0">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between w-full py-3 group"
      >
        <span
          className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#AAAAAA] group-hover:text-white transition-colors"
          style={{ fontFamily: grok }}
        >
          {title}
        </span>
        <svg
          className={`w-3 h-3 text-[#666666] transition-transform duration-300 ease-out ${isOpen ? "rotate-180" : ""}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
        >
          <path d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      <div
        className="overflow-hidden transition-all duration-300 ease-out"
        style={{
          maxHeight: isOpen ? (contentHeight !== undefined ? `${contentHeight}px` : "1000px") : "0px",
          opacity: isOpen ? 1 : 0,
        }}
      >
        <div ref={contentRef} className="pb-4">
          {children}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   ACTIVE FILTER PILL COMPONENT
   ═══════════════════════════════════════════════════════════════ */

function FilterPill({ label, onRemove, color }: {
  label: string;
  onRemove: () => void;
  color?: string;
}) {
  return (
    <button
      onClick={onRemove}
      className="group flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-all hover:brightness-125 cursor-pointer"
      style={{
        fontFamily: grok,
        ...(color
          ? { color, borderColor: `${color}25`, backgroundColor: `${color}15` }
          : { color: "#ffffff", borderColor: "rgba(230,57,70,0.25)", backgroundColor: "rgba(230,57,70,0.12)" }
        ),
      }}
    >
      {label}
      <svg
        className="w-2.5 h-2.5 opacity-50 group-hover:opacity-100 transition-opacity"
        fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}
      >
        <path d="M18 6L6 18M6 6l12 12" />
      </svg>
    </button>
  );
}

/* ═══════════════════════════════════════════════════════════════
   BROWSE PAGE — Anikage.cc Sidebar Filter Design
   ═══════════════════════════════════════════════════════════════ */

export default function BrowsePage() {
  const navigate = useAppStore(s => s.navigate);

  // Filter state
  const [sortBy, setSortBy] = useState("most-popular");
  const [selectedYear, setSelectedYear] = useState("");
  const [selectedFormat, setSelectedFormat] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [selectedSeason, setSelectedSeason] = useState("");
  const [selectedGenre, setSelectedGenre] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // Applied filters (only update on "Apply Filter" click)
  const [appliedFilters, setAppliedFilters] = useState({
    sort: "most-popular",
    year: "",
    format: "",
    status: "",
    season: "",
    genre: "",
    search: "",
  });

  // Results state
  const [results, setResults] = useState<MiruroAnimeResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const resultsRef = useRef<HTMLDivElement>(null);

  // Fetch results with applied filters
  const fetchResults = useCallback(async (page: number = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("sort", appliedFilters.sort);
      if (appliedFilters.year) params.set("year", appliedFilters.year);
      if (appliedFilters.format) params.set("format", appliedFilters.format);
      if (appliedFilters.status) params.set("status", appliedFilters.status);
      if (appliedFilters.season) params.set("season", appliedFilters.season);
      if (appliedFilters.genre) params.set("genre", appliedFilters.genre);
      if (appliedFilters.search) params.set("search", appliedFilters.search);
      params.set("page", String(page));
      params.set("perPage", "30");

      const res = await fetch(`/api/anime/browse?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        const newResults = (data.results || []).map(normalizeAnimeItem);

        if (page === 1) {
          setResults(newResults);
        } else {
          setResults(prev => [...prev, ...newResults]);
        }
        setHasNextPage(data.hasNextPage || false);
        setTotalCount(data.total || 0);
        setCurrentPage(page);
      }
    } catch (err) {
      console.error("[BrowsePage] Fetch error:", err);
    }
    setLoading(false);
  }, [appliedFilters]);

  // Load results when applied filters change
  useEffect(() => {
    fetchResults(1);
  }, [appliedFilters, fetchResults]);

  // Apply filters button handler
  const handleApplyFilter = () => {
    setAppliedFilters({
      sort: sortBy,
      year: selectedYear,
      format: selectedFormat,
      status: selectedStatus,
      season: selectedSeason,
      genre: selectedGenre,
      search: searchQuery,
    });
    setSidebarOpen(false);
  };

  // Clear all filters
  const handleClearFilters = () => {
    setSortBy("most-popular");
    setSelectedYear("");
    setSelectedFormat("");
    setSelectedStatus("");
    setSelectedSeason("");
    setSelectedGenre("");
    setSearchQuery("");
    setAppliedFilters({
      sort: "most-popular",
      year: "",
      format: "",
      status: "",
      season: "",
      genre: "",
      search: "",
    });
  };

  // Remove individual applied filter
  const removeAppliedFilter = (key: keyof typeof appliedFilters) => {
    const resetValue = key === "sort" ? "most-popular" : "";
    setAppliedFilters(prev => ({ ...prev, [key]: resetValue }));
    // Also reset the pending filter state
    if (key === "sort") setSortBy("most-popular");
    else if (key === "year") setSelectedYear("");
    else if (key === "format") setSelectedFormat("");
    else if (key === "status") setSelectedStatus("");
    else if (key === "season") setSelectedSeason("");
    else if (key === "genre") setSelectedGenre("");
    else if (key === "search") setSearchQuery("");
  };

  // Load more (pagination)
  const handleLoadMore = () => {
    if (!loading && hasNextPage) {
      fetchResults(currentPage + 1);
    }
  };

  // Count active filters for badge
  const activeFilterCount = [
    appliedFilters.year,
    appliedFilters.format,
    appliedFilters.status,
    appliedFilters.season,
    appliedFilters.genre,
  ].filter(Boolean).length;

  // Active sort label
  const activeSortLabel = SORT_OPTIONS.find(o => o.id === appliedFilters.sort)?.label || "Most Popular";

  /* ─── SIDEBAR CONTENT (shared between desktop & mobile) ─── */
  const sidebarContent = (
    <div className="space-y-0">
      {/* Sort By */}
      <FilterSection title="Sort By">
        <div className="space-y-1">
          {SORT_OPTIONS.map(opt => (
            <button
              key={opt.id}
              onClick={() => setSortBy(opt.id)}
              className={`w-full text-left px-3 py-2 rounded-lg text-[11px] font-bold transition-all ${
                sortBy === opt.id
                  ? "bg-[#ffffff]/15 text-[#ffffff] border border-[#ffffff]/20"
                  : "text-[#AAAAAA] hover:text-white hover:bg-white/[0.04] border border-transparent"
              }`}
              style={{ fontFamily: grok }}
            >
              <span className="flex items-center gap-2.5">
                <span className={`w-3 h-3 rounded-full border-2 flex items-center justify-center transition-all ${
                  sortBy === opt.id ? "border-[#ffffff]" : "border-[#666666]"
                }`}>
                  {sortBy === opt.id && <span className="w-1.5 h-1.5 rounded-full bg-[#ffffff]" />}
                </span>
                {opt.label}
              </span>
            </button>
          ))}
        </div>
      </FilterSection>

      {/* Format */}
      <FilterSection title="Format">
        <div className="grid grid-cols-3 gap-1.5">
          {FORMAT_OPTIONS.map(opt => (
            <button
              key={opt.id}
              onClick={() => setSelectedFormat(selectedFormat === opt.id ? "" : opt.id)}
              className={`px-2 py-2 rounded-lg text-[10px] font-bold transition-all border text-center ${
                selectedFormat === opt.id
                  ? "bg-[#ffffff]/15 text-[#ffffff] border-[#ffffff]/25"
                  : "bg-[#1A1A1A] text-[#AAAAAA] border-white/[0.06] hover:text-white hover:border-white/[0.12]"
              }`}
              style={{ fontFamily: grok }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </FilterSection>

      {/* Status */}
      <FilterSection title="Status">
        <div className="space-y-1">
          {STATUS_OPTIONS.map(opt => (
            <button
              key={opt.id}
              onClick={() => setSelectedStatus(selectedStatus === opt.id ? "" : opt.id)}
              className={`w-full text-left px-3 py-2 rounded-lg text-[11px] font-bold transition-all ${
                selectedStatus === opt.id
                  ? "bg-[#ffffff]/15 text-[#ffffff] border border-[#ffffff]/20"
                  : "text-[#AAAAAA] hover:text-white hover:bg-white/[0.04] border border-transparent"
              }`}
              style={{ fontFamily: grok }}
            >
              <span className="flex items-center gap-2.5">
                <span className={`w-3 h-3 rounded-full border-2 flex items-center justify-center transition-all ${
                  selectedStatus === opt.id ? "border-[#ffffff]" : "border-[#666666]"
                }`}>
                  {selectedStatus === opt.id && <span className="w-1.5 h-1.5 rounded-full bg-[#ffffff]" />}
                </span>
                {opt.label}
              </span>
            </button>
          ))}
        </div>
      </FilterSection>

      {/* Season */}
      <FilterSection title="Season" defaultOpen={false}>
        <div className="grid grid-cols-2 gap-1.5">
          {SEASON_OPTIONS.map(opt => (
            <button
              key={opt.id}
              onClick={() => setSelectedSeason(selectedSeason === opt.id ? "" : opt.id)}
              className={`px-3 py-2 rounded-lg text-[10px] font-bold transition-all border text-center ${
                selectedSeason === opt.id
                  ? "bg-[#ffffff]/15 text-[#ffffff] border-[#ffffff]/25"
                  : "bg-[#1A1A1A] text-[#AAAAAA] border-white/[0.06] hover:text-white hover:border-white/[0.12]"
              }`}
              style={{ fontFamily: grok }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </FilterSection>

      {/* Year */}
      <FilterSection title="Year" defaultOpen={false}>
        <div className="max-h-44 overflow-y-auto scroll-container pr-1 space-y-0.5">
          <button
            onClick={() => setSelectedYear("")}
            className={`w-full text-left px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all ${
              !selectedYear
                ? "bg-[#ffffff]/15 text-[#ffffff] border border-[#ffffff]/20"
                : "text-[#666666] hover:text-[#AAAAAA] hover:bg-white/[0.03] border border-transparent"
            }`}
            style={{ fontFamily: grok }}
          >
            All Years
          </button>
          {YEAR_OPTIONS.slice(0, 30).map(opt => (
            <button
              key={opt.id}
              onClick={() => setSelectedYear(selectedYear === opt.id ? "" : opt.id)}
              className={`w-full text-left px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all ${
                selectedYear === opt.id
                  ? "bg-[#ffffff]/15 text-[#ffffff] border border-[#ffffff]/20"
                  : "text-[#666666] hover:text-[#AAAAAA] hover:bg-white/[0.03] border border-transparent"
              }`}
              style={{ fontFamily: grok }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </FilterSection>

      {/* Genre */}
      <FilterSection title="Genre">
        <div className="flex flex-wrap gap-1.5">
          {GENRE_OPTIONS.map(genre => {
            const color = GENRE_COLORS[genre] || "#ffffff";
            const isSelected = selectedGenre === genre;
            return (
              <button
                key={genre}
                onClick={() => setSelectedGenre(isSelected ? "" : genre)}
                className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition-all border ${
                  isSelected
                    ? ""
                    : "bg-[#1A1A1A] text-[#AAAAAA] border-white/[0.06] hover:text-white hover:border-white/[0.12]"
                }`}
                style={{
                  fontFamily: grok,
                  ...(isSelected
                    ? {
                        color,
                        borderColor: `${color}25`,
                        backgroundColor: `${color}15`,
                      }
                    : {}),
                }}
              >
                {genre}
              </button>
            );
          })}
        </div>
      </FilterSection>

      {/* Apply Filter Button */}
      <div className="pt-5 space-y-2">
        <button
          onClick={handleApplyFilter}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-wider bg-[#ffffff] hover:bg-[#D32F3F] text-white shadow-lg shadow-[#ffffff]/20 hover:shadow-[#ffffff]/40 transition-all active:scale-[0.98]"
          style={{ fontFamily: grok }}
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
          </svg>
          Apply Filter
        </button>

        <button
          onClick={handleClearFilters}
          className="w-full px-4 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-wider text-[#666666] hover:text-[#AAAAAA] hover:bg-white/[0.04] transition-all border border-transparent hover:border-white/[0.06]"
          style={{ fontFamily: grok }}
        >
          Clear All Filters
        </button>
      </div>
    </div>
  );

  /* ─── Build active filter pills list ─── */
  const activePills: { key: keyof typeof appliedFilters; label: string; color?: string }[] = [];
  if (appliedFilters.genre) {
    activePills.push({ key: "genre", label: appliedFilters.genre, color: GENRE_COLORS[appliedFilters.genre] });
  }
  if (appliedFilters.format) {
    activePills.push({ key: "format", label: FORMAT_OPTIONS.find(f => f.id === appliedFilters.format)?.label || appliedFilters.format });
  }
  if (appliedFilters.status) {
    activePills.push({ key: "status", label: STATUS_OPTIONS.find(s => s.id === appliedFilters.status)?.label || appliedFilters.status });
  }
  if (appliedFilters.season) {
    activePills.push({ key: "season", label: SEASON_OPTIONS.find(s => s.id === appliedFilters.season)?.label || appliedFilters.season });
  }
  if (appliedFilters.year) {
    activePills.push({ key: "year", label: appliedFilters.year });
  }

  return (
    <div className="min-h-screen">
      {/* ═══ HEADER AREA ═══ */}
      <div className="mb-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-[#ffffff]/10 border border-[#ffffff]/20 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 text-[#ffffff]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold text-white tracking-tight" style={{ fontFamily: grok }}>
                Browse Anime
              </h2>
              <p className="text-[11px] text-[#666666] mt-0.5" style={{ fontFamily: grok }}>
                Discover and filter anime by your preferences
              </p>
            </div>
          </div>

          {/* Mobile filter toggle */}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="lg:hidden flex items-center gap-2 px-3 py-2 rounded-xl bg-[#1A1A1A] border border-white/[0.06] text-[#AAAAAA] text-[10px] font-bold uppercase tracking-wider transition-all hover:text-white hover:border-[#ffffff]/30 shrink-0"
            style={{ fontFamily: grok }}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            Filters
            {activeFilterCount > 0 && (
              <span className="min-w-[18px] h-[18px] rounded-full bg-[#ffffff] text-white text-[9px] flex items-center justify-center font-bold px-1">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>

        {/* Search input — integrated into header */}
        <div className="mt-4">
          <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-[#1A1A1A] border border-white/[0.06] focus-within:border-[#ffffff]/30 transition-all">
            <svg className="w-4 h-4 text-[#666666] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
            </svg>
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") handleApplyFilter(); }}
              placeholder="Search anime..."
              className="flex-1 bg-transparent text-white placeholder-[#666666] text-sm outline-none"
              style={{ fontFamily: grok }}
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")} className="text-[#666666] hover:text-[#AAAAAA] transition-colors">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M18 6L6 18M6 6l12 12" /></svg>
              </button>
            )}
            <button
              onClick={handleApplyFilter}
              className="px-3 py-1 rounded-lg bg-[#ffffff]/15 text-[#ffffff] text-[10px] font-bold uppercase tracking-wider hover:bg-[#ffffff]/25 transition-all border border-[#ffffff]/20"
              style={{ fontFamily: grok }}
            >
              Go
            </button>
          </div>
        </div>
      </div>

      {/* ═══ LAYOUT: Sidebar + Results ═══ */}
      <div className="flex gap-6">
        {/* ─── LEFT SIDEBAR (Desktop) ─── */}
        <aside className="hidden lg:block w-[280px] shrink-0">
          <div className="sticky top-[100px] max-h-[calc(100vh-120px)] overflow-y-auto scroll-container bg-[#0D0D0D] border-r border-white/[0.06] rounded-2xl p-5">
            {sidebarContent}
          </div>
        </aside>

        {/* ─── MOBILE SIDEBAR (Drawer) ─── */}
        {sidebarOpen && (
          <div className="lg:hidden fixed inset-0 z-[80] flex">
            {/* Backdrop */}
            <div
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
              onClick={() => setSidebarOpen(false)}
            />
            {/* Drawer */}
            <div className="relative w-[85vw] max-w-[340px] h-full bg-[#0D0D0D] border-r border-white/[0.06] overflow-y-auto scroll-container p-5">
              {/* Drawer header */}
              <div className="flex items-center justify-between mb-5 pb-4 border-b border-white/[0.06]">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-[#ffffff]/10 flex items-center justify-center">
                    <svg className="w-3.5 h-3.5 text-[#ffffff]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                    </svg>
                  </div>
                  <span className="text-xs font-bold text-white uppercase tracking-wider" style={{ fontFamily: grok }}>
                    Filters
                  </span>
                </div>
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="p-2 rounded-lg text-[#666666] hover:text-white hover:bg-white/[0.06] transition-all"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              {sidebarContent}
            </div>
          </div>
        )}

        {/* ─── RIGHT: RESULTS ─── */}
        <div ref={resultsRef} className="flex-1 min-w-0">
          {/* Results header bar */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#ffffff]" style={{ fontFamily: grok }}>
                {activeSortLabel}
              </span>
              {totalCount > 0 && (
                <>
                  <span className="text-white/[0.08]">|</span>
                  <span className="text-[10px] font-bold text-[#666666]" style={{ fontFamily: grok }}>
                    {totalCount.toLocaleString()} results
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Active filter pills */}
          {activePills.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 mb-4">
              {activePills.map(pill => (
                <FilterPill
                  key={pill.key}
                  label={pill.label}
                  color={pill.color}
                  onRemove={() => removeAppliedFilter(pill.key)}
                />
              ))}
              <button
                onClick={handleClearFilters}
                className="text-[9px] font-bold text-[#666666] hover:text-[#AAAAAA] uppercase tracking-wider transition-colors px-2 py-1"
                style={{ fontFamily: grok }}
              >
                Clear All
              </button>
            </div>
          )}

          {/* Loading skeleton */}
          {loading && results.length === 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3">
              {Array.from({ length: 15 }).map((_, i) => (
                <div key={i} className="aspect-[2/3] skeleton rounded-xl" />
              ))}
            </div>
          ) : results.length > 0 ? (
            <>
              {/* Results grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3">
                {results.map((anime, i) => (
                  <ContentCard key={`${anime.id}-${i}`} anime={anime} index={i} />
                ))}
              </div>

              {/* Load More */}
              {hasNextPage && (
                <div className="flex justify-center mt-8">
                  <button
                    onClick={handleLoadMore}
                    disabled={loading}
                    className="flex items-center gap-2 px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all border border-[#ffffff]/20 hover:border-[#ffffff]/40 hover:bg-[#ffffff]/10 text-[#ffffff]/80 hover:text-[#ffffff] disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
                    style={{ fontFamily: grok }}
                  >
                    {loading ? (
                      <>
                        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Loading...
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path d="M19 9l-7 7-7-7" />
                        </svg>
                        Load More
                      </>
                    )}
                  </button>
                </div>
              )}
            </>
          ) : (
            /* Empty state */
            <div className="text-center py-20 bg-[#0D0D0D] rounded-2xl border border-white/[0.06]">
              <div className="space-y-4">
                <div className="w-16 h-16 mx-auto rounded-full bg-[#ffffff]/10 flex items-center justify-center">
                  <svg className="w-8 h-8 text-[#ffffff]/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <circle cx="12" cy="12" r="10" />
                    <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
                  </svg>
                </div>
                <p className="text-[#AAAAAA] text-sm" style={{ fontFamily: grok }}>No anime found with current filters</p>
                <p className="text-[#666666] text-xs" style={{ fontFamily: grok }}>Try adjusting your filters or search terms</p>
                <button
                  onClick={handleClearFilters}
                  className="px-4 py-2 text-xs font-bold bg-[#ffffff]/15 text-[#ffffff] rounded-full hover:bg-[#ffffff]/25 transition-all border border-[#ffffff]/20"
                  style={{ fontFamily: grok }}
                >
                  Clear All Filters
                </button>
              </div>
            </div>
          )}

          {/* Loading more indicator */}
          {loading && results.length > 0 && (
            <div className="flex justify-center mt-6">
              <div className="flex items-center gap-2 text-[10px] text-[#666666]" style={{ fontFamily: grok }}>
                <svg className="w-4 h-4 animate-spin text-[#ffffff]" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Loading more...
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
