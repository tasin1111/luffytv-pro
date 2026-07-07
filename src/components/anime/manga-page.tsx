"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useAppStore } from "./store";

/* ═══════════════════════════════════════════════════════════════════════
   LUFFYTV MANGA — v4 (comix.to-inspired redesign)
   ─────────────────────────────────────────────────────────────────────────
   DATA SOURCE
   • Provider: atsumaru (atsu.moe)
   • API:      https://manga-scrape-api.vercel.app/api/scrape/*
   • Routes:   /api/manga/home | /api/manga/search | /api/manga/detail
               /api/manga/read | /api/manga/image

   DESIGN INSPIRATION
   • comix.to  → ranked list view, advanced filter sidebar, type/year/
                 status/chapter/rating badges inline, dense info per row,
                 "I'm Feeling Lucky" button, "Most Recent" / "Popular" tabs
   • MangaFire → trending spotlight hero, glassmorphic poster
   • Atsu.moe  → clean type badges (manga/manhwa/manhua color-coded)

   LAYOUT
   1. Spotlight hero (full-width, blurred poster + auto-rotate)
   2. Sticky header (logo + tabs + search + view toggle + filter toggle)
   3. Two-column body:
      • Left sidebar (sticky, comix.to-style advanced filters)
      • Right content area (ranked list view default, grid view alt)
   4. Mobile: filter sidebar slides in as overlay
   ═══════════════════════════════════════════════════════════════════════ */

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

type ViewMode = "list" | "grid";
type TabType = "recent" | "popular" | "top_rated" | "genre";
type SortType = "latest" | "popular" | "rating" | "az";
type TypeFilter = "all" | "manga" | "manhwa" | "manhua" | "one_shot" | "novel";
type StatusFilter = "all" | "ongoing" | "completed" | "hiatus";

// ────────────────────────────────────────────────────────────────────────
// Constants
// ────────────────────────────────────────────────────────────────────────

const GENRE_LIST = [
  "Action", "Adventure", "Comedy", "Drama", "Fantasy", "Horror",
  "Mystery", "Romance", "Sci-Fi", "Slice of Life", "Sports", "Thriller",
  "Supernatural", "Psychological", "Isekai", "Mecha",
];

const TYPE_COLORS: Record<string, string> = {
  manga: "#8E7CE6",
  manhwa: "#3B82F6",
  manhua: "#F59E0B",
  novel: "#10B981",
  one_shot: "#EC4899",
  "one shot": "#EC4899",
};

const STATUS_COLORS: Record<string, string> = {
  ongoing: "#10B981",
  releasing: "#10B981",
  completed: "#3B82F6",
  finished: "#3B82F6",
  hiatus: "#F59E0B",
  cancelled: "#EF4444",
};

function statusColor(status?: string): string {
  if (!status) return "#71717A";
  return STATUS_COLORS[status.toLowerCase()] || "#71717A";
}

function typeColor(type?: string): string {
  if (!type) return TYPE_COLORS.manga;
  return TYPE_COLORS[type.toLowerCase()] || TYPE_COLORS.manga;
}

// atsumaru provider doesn't expose release dates on home/search results,
// so this is mostly cosmetic — returns "Recently" for everything.
function formatTimeAgo(_dateStr?: string): string {
  return "Recently";
}

// ═══════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════

export default function MangaPage() {
  const navigate = useAppStore(s => s.navigate);

  // ── Data state ──
  const [sections, setSections] = useState<MangaSection[]>([]);
  const [searchResults, setSearchResults] = useState<MangaEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [searchMode, setSearchMode] = useState(false);

  // ── UI state ──
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [activeTab, setActiveTab] = useState<TabType>("recent");
  const [sortBy, setSortBy] = useState<SortType>("latest");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [minChapters, setMinChapters] = useState<number>(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [spotlightIdx, setSpotlightIdx] = useState(0);

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

  // ── Spotlight auto-rotate ──
  const spotlightItems = useMemo(
    () => sections.flatMap(s => s.items).filter(m => m.poster).slice(0, 6),
    [sections],
  );

  useEffect(() => {
    if (spotlightItems.length <= 1) return;
    const timer = setInterval(() => {
      setSpotlightIdx(prev => (prev + 1) % spotlightItems.length);
    }, 8000);
    return () => clearInterval(timer);
  }, [spotlightItems.length]);

  // ── Search (debounced) ──
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

  const searchTimer = useRef<NodeJS.Timeout | null>(null);
  const onSearchChange = (value: string) => {
    setSearchQuery(value);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => handleSearch(value), 450);
  };

  // ── Filter helpers ──
  const toggleGenre = (genre: string) => {
    setSelectedGenres(prev =>
      prev.includes(genre) ? prev.filter(g => g !== genre) : [...prev, genre],
    );
  };

  const clearFilters = () => {
    setTypeFilter("all");
    setSelectedGenres([]);
    setStatusFilter("all");
    setSortBy("latest");
    setMinChapters(0);
  };

  const hasActiveFilters =
    typeFilter !== "all" ||
    selectedGenres.length > 0 ||
    statusFilter !== "all" ||
    sortBy !== "latest" ||
    minChapters > 0;

  // ── Build the display list based on active tab + filters ──
  const allItems = useMemo(() => {
    const seen = new Set<string>();
    return sections.flatMap(s => s.items).filter(m => {
      if (seen.has(m.id)) return false;
      seen.add(m.id);
      return true;
    });
  }, [sections]);

  const tabItems = useMemo(() => {
    let items: MangaEntry[] = [];
    if (searchMode) {
      items = searchResults;
    } else {
      switch (activeTab) {
        case "recent":
          items = allItems;
          break;
        case "popular":
          items = [...allItems].sort((a, b) => (b.rating || 0) - (a.rating || 0));
          break;
        case "top_rated":
          items = [...allItems]
            .filter(m => (m.rating || 0) >= 7)
            .sort((a, b) => (b.rating || 0) - (a.rating || 0));
          break;
        case "genre":
          items = allItems;
          break;
      }
    }

    // Apply filters
    if (typeFilter !== "all") {
      items = items.filter(m =>
        (m.type || "manga").toLowerCase().replace(" ", "_") === typeFilter,
      );
    }
    if (statusFilter !== "all") {
      items = items.filter(m =>
        (m.status || "").toLowerCase() === statusFilter,
      );
    }
    if (selectedGenres.length > 0) {
      items = items.filter(m =>
        m.genres?.some(g =>
          selectedGenres.some(sg => g.toLowerCase().includes(sg.toLowerCase())),
        ),
      );
    }
    if (minChapters > 0) {
      items = items.filter(m => (m.chapterCount || 0) >= minChapters);
    }

    // Apply sort
    if (sortBy === "rating") {
      items = [...items].sort((a, b) => (b.rating || 0) - (a.rating || 0));
    } else if (sortBy === "az") {
      items = [...items].sort((a, b) =>
        (a.englishTitle || a.title).localeCompare(b.englishTitle || b.title),
      );
    } else if (sortBy === "popular") {
      items = [...items].sort((a, b) => (b.rating || 0) - (a.rating || 0));
    }
    // "latest" — keep original order

    return items;
  }, [searchMode, searchResults, allItems, activeTab, typeFilter, statusFilter, selectedGenres, minChapters, sortBy]);

  // ── Surprise Me ──
  const handleSurprise = useCallback(() => {
    if (allItems.length === 0) return;
    const random = allItems[Math.floor(Math.random() * allItems.length)];
    navigate({ page: "manga-detail", id: random.id });
  }, [allItems, navigate]);

  // ═══════════════════════════════════════════════════════════════════════
  // LOADING STATE
  // ═══════════════════════════════════════════════════════════════════════
  if (loading) {
    return (
      <div className="fade-in -mx-4 lg:-mx-8">
        <div className="skeleton" style={{ minHeight: "52vh", borderRadius: 0 }} />
        <div className="mx-shell">
          <div className="mx-header-skeleton">
            <div className="h-7 w-32 skeleton rounded-lg" />
            <div className="flex gap-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-9 w-24 skeleton rounded-lg" />
              ))}
            </div>
            <div className="h-10 w-72 skeleton rounded-lg" />
          </div>
          <div className="mx-body">
            <div className="mx-sidebar hidden lg:block">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="space-y-2 mb-6">
                  <div className="h-4 w-24 skeleton rounded" />
                  <div className="space-y-1.5">
                    {Array.from({ length: 4 }).map((_, j) => (
                      <div key={j} className="h-7 w-full skeleton rounded" />
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="mx-content flex-1 space-y-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="mx-list-card-skeleton" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════
  // MAIN RENDER
  // ═══════════════════════════════════════════════════════════════════════
  return (
    <div className="fade-in -mx-4 lg:-mx-8 min-h-screen bg-[#05050a] text-zinc-100">
      {/* ═════════════════════════════════════════════════════════════════
          SECTION 1: SPOTLIGHT HERO
          ═════════════════════════════════════════════════════════════════ */}
      {spotlightItems.length > 0 && !searchMode && (
        <div className="mx-spotlight">
          {spotlightItems.map((manga, idx) => {
            const isActive = idx === spotlightIdx;
            return (
              <div
                key={manga.id}
                className={`mx-spotlight-slide ${isActive ? "active" : ""}`}
                aria-hidden={!isActive}
              >
                {manga.poster && (
                  <img
                    src={manga.poster}
                    alt=""
                    className="mx-spotlight-bg"
                    loading={idx === 0 ? "eager" : "lazy"}
                  />
                )}
                <div className="mx-spotlight-overlay" />
                <div className="mx-spotlight-content">
                  <div className="mx-spotlight-info">
                    <div className="mx-spotlight-badges">
                      <span
                        className="mx-type-pill"
                        style={{
                          background: `${typeColor(manga.type)}25`,
                          color: typeColor(manga.type),
                          borderColor: `${typeColor(manga.type)}50`,
                        }}
                      >
                        {(manga.type || "MANGA").toUpperCase()}
                      </span>
                      {manga.status && (
                        <span
                          className="mx-status-pill"
                          style={{
                            background: `${statusColor(manga.status)}20`,
                            color: statusColor(manga.status),
                            borderColor: `${statusColor(manga.status)}40`,
                          }}
                        >
                          <span
                            className="mx-status-dot"
                            style={{
                              background: statusColor(manga.status),
                              boxShadow: `0 0 6px ${statusColor(manga.status)}`,
                            }}
                          />
                          {manga.status}
                        </span>
                      )}
                      {manga.rating ? (
                        <span className="mx-rating-pill">
                          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                          </svg>
                          {manga.rating.toFixed(2)}
                        </span>
                      ) : null}
                    </div>

                    <h2 className="mx-spotlight-title">
                      {manga.englishTitle || manga.title}
                    </h2>

                    {manga.description && (
                      <p className="mx-spotlight-synopsis">
                        {manga.description.slice(0, 240)}
                        {manga.description.length > 240 ? "…" : ""}
                      </p>
                    )}

                    {manga.genres && manga.genres.length > 0 && (
                      <div className="mx-spotlight-genres">
                        {manga.genres.slice(0, 5).map(g => (
                          <span key={g} className="mx-genre-chip">{g}</span>
                        ))}
                      </div>
                    )}

                    <div className="mx-spotlight-actions">
                      <button
                        className="mx-btn-primary"
                        onClick={() => navigate({ page: "manga-detail", id: manga.id })}
                      >
                        <IconBook className="w-4 h-4" />
                        Read Now
                      </button>
                      <button
                        className="mx-btn-ghost"
                        onClick={() => navigate({ page: "manga-detail", id: manga.id })}
                      >
                        <IconInfo className="w-4 h-4" />
                        Details
                      </button>
                    </div>
                  </div>

                  <div
                    className="mx-spotlight-poster-wrap hidden lg:flex"
                    onClick={() => navigate({ page: "manga-detail", id: manga.id })}
                  >
                    <div className="mx-spotlight-poster-glass">
                      {manga.poster && (
                        <img
                          src={manga.poster}
                          alt={manga.englishTitle || manga.title}
                          className="mx-spotlight-poster"
                        />
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Dots */}
          {spotlightItems.length > 1 && (
            <div className="mx-spotlight-dots">
              {spotlightItems.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setSpotlightIdx(idx)}
                  className={`mx-spotlight-dot ${idx === spotlightIdx ? "active" : ""}`}
                  aria-label={`Slide ${idx + 1}`}
                />
              ))}
            </div>
          )}

          {/* Arrows */}
          {spotlightItems.length > 1 && (
            <>
              <button
                className="mx-spotlight-arrow mx-spotlight-arrow-left"
                onClick={() =>
                  setSpotlightIdx(p => (p - 1 + spotlightItems.length) % spotlightItems.length)
                }
                aria-label="Previous"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <button
                className="mx-spotlight-arrow mx-spotlight-arrow-right"
                onClick={() => setSpotlightIdx(p => (p + 1) % spotlightItems.length)}
                aria-label="Next"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </>
          )}
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════════
          SECTION 2: STICKY HEADER
          ═════════════════════════════════════════════════════════════════ */}
      <div className="mx-header">
        <div className="mx-header-inner">
          {/* Logo + Tabs */}
          <div className="mx-header-left">
            <div className="mx-logo">
              <span className="mx-logo-mark">M</span>
              <span className="mx-logo-text">MANGA</span>
            </div>
            {!searchMode && (
              <nav className="mx-tabs">
                {([
                  { id: "recent" as TabType, label: "Most Recent" },
                  { id: "popular" as TabType, label: "Popular" },
                  { id: "top_rated" as TabType, label: "Top Rated" },
                  { id: "genre" as TabType, label: "Genres" },
                ]).map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`mx-tab ${activeTab === tab.id ? "active" : ""}`}
                  >
                    {tab.label}
                  </button>
                ))}
              </nav>
            )}
          </div>

          {/* Right side controls */}
          <div className="mx-header-right">
            <div className="mx-search">
              <IconSearch className="mx-search-icon" />
              <input
                type="text"
                placeholder="Search manga…"
                value={searchQuery}
                onChange={e => onSearchChange(e.target.value)}
                className="mx-search-input"
              />
              {searching && (
                <div className="mx-search-spinner">
                  <div className="w-3.5 h-3.5 border-2 border-zinc-700 border-t-[#FF6B6B] rounded-full animate-spin" />
                </div>
              )}
              {searchQuery && !searching && (
                <button
                  className="mx-search-clear"
                  onClick={() => {
                    setSearchQuery("");
                    setSearchMode(false);
                    setSearchResults([]);
                  }}
                  aria-label="Clear search"
                >
                  <IconX className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="mx-view-toggle">
              <button
                onClick={() => setViewMode("list")}
                className={`mx-view-btn ${viewMode === "list" ? "active" : ""}`}
                title="List view (comix.to style)"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path d="M3 6h18M3 12h18M3 18h18" />
                </svg>
              </button>
              <button
                onClick={() => setViewMode("grid")}
                className={`mx-view-btn ${viewMode === "grid" ? "active" : ""}`}
                title="Grid view"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <rect x="3" y="3" width="7" height="7" />
                  <rect x="14" y="3" width="7" height="7" />
                  <rect x="3" y="14" width="7" height="7" />
                  <rect x="14" y="14" width="7" height="7" />
                </svg>
              </button>
            </div>

            <button
              onClick={() => setSidebarOpen(true)}
              className="mx-filter-toggle lg:hidden"
              title="Filters"
            >
              <IconFilter className="w-4 h-4" />
              {hasActiveFilters && (
                <span className="mx-filter-badge">
                  {(typeFilter !== "all" ? 1 : 0) +
                    selectedGenres.length +
                    (statusFilter !== "all" ? 1 : 0) +
                    (minChapters > 0 ? 1 : 0) +
                    (sortBy !== "latest" ? 1 : 0)}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ═════════════════════════════════════════════════════════════════
          SECTION 3: BODY — Sidebar + Content
          ═════════════════════════════════════════════════════════════════ */}
      <div className="mx-shell">
        <div className="mx-body">
          {/* ── LEFT SIDEBAR ── */}
          <aside className="mx-sidebar hidden lg:block">
            <FilterPanel
              sortBy={sortBy}
              setSortBy={setSortBy}
              typeFilter={typeFilter}
              setTypeFilter={setTypeFilter}
              statusFilter={statusFilter}
              setStatusFilter={setStatusFilter}
              selectedGenres={selectedGenres}
              toggleGenre={toggleGenre}
              minChapters={minChapters}
              setMinChapters={setMinChapters}
              hasActiveFilters={hasActiveFilters}
              clearFilters={clearFilters}
              onSurprise={handleSurprise}
            />
          </aside>

          {/* ── MOBILE SIDEBAR OVERLAY ── */}
          {sidebarOpen && (
            <div className="mx-sidebar-overlay" onClick={() => setSidebarOpen(false)}>
              <aside
                className="mx-sidebar-mobile slide-up"
                onClick={e => e.stopPropagation()}
              >
                <div className="mx-sidebar-mobile-header">
                  <h3>Advanced Filters</h3>
                  <button onClick={() => setSidebarOpen(false)} aria-label="Close">
                    <IconX className="w-5 h-5" />
                  </button>
                </div>
                <FilterPanel
                  sortBy={sortBy}
                  setSortBy={setSortBy}
                  typeFilter={typeFilter}
                  setTypeFilter={setTypeFilter}
                  statusFilter={statusFilter}
                  setStatusFilter={setStatusFilter}
                  selectedGenres={selectedGenres}
                  toggleGenre={toggleGenre}
                  minChapters={minChapters}
                  setMinChapters={setMinChapters}
                  hasActiveFilters={hasActiveFilters}
                  clearFilters={clearFilters}
                  onSurprise={handleSurprise}
                />
              </aside>
            </div>
          )}

          {/* ── CONTENT AREA ── */}
          <div className="mx-content">
            {/* Content header */}
            <div className="mx-content-header">
              <div className="mx-content-header-left">
                <h2 className="mx-content-title">
                  {searchMode
                    ? `Search: "${searchQuery}"`
                    : activeTab === "recent"
                      ? "Most Recent"
                      : activeTab === "popular"
                        ? "Popular Manga"
                        : activeTab === "top_rated"
                          ? "Top Rated"
                          : "Browse by Genre"}
                </h2>
                <span className="mx-content-count">{tabItems.length} items</span>
              </div>
              {hasActiveFilters && (
                <button onClick={clearFilters} className="mx-clear-btn">
                  <IconX className="w-3 h-3" />
                  Clear filters
                </button>
              )}
            </div>

            {/* Content body */}
            {tabItems.length === 0 ? (
              <div className="mx-empty">
                <IconBook className="w-14 h-14 mx-empty-icon" />
                <p className="mx-empty-title">
                  {searchMode
                    ? `No manga found for "${searchQuery}"`
                    : "No manga matches your filters"}
                </p>
                <p className="mx-empty-sub">
                  {searchMode
                    ? "Try a different search term."
                    : "Try clearing some filters or switching tabs."}
                </p>
                {(hasActiveFilters || searchMode) && (
                  <button
                    onClick={() => {
                      clearFilters();
                      setSearchQuery("");
                      setSearchMode(false);
                      setSearchResults([]);
                    }}
                    className="mx-btn-ghost mt-4"
                  >
                    Reset
                  </button>
                )}
              </div>
            ) : viewMode === "list" ? (
              <div className="mx-list">
                {tabItems.map((manga, idx) => (
                  <MangaListCard
                    key={manga.id}
                    manga={manga}
                    rank={idx + 1}
                    onClick={() => navigate({ page: "manga-detail", id: manga.id })}
                  />
                ))}
              </div>
            ) : (
              <div className="mx-grid">
                {tabItems.map((manga, idx) => (
                  <MangaGridCard
                    key={manga.id}
                    manga={manga}
                    rank={idx < 3 ? idx + 1 : undefined}
                    onClick={() => navigate({ page: "manga-detail", id: manga.id })}
                  />
                ))}
              </div>
            )}

            {/* Section rows on Home tab when not searching */}
            {!searchMode && activeTab === "recent" && sections.length > 0 && (
              <div className="mx-sections">
                {sections.map((section, si) => (
                  <div key={si} className="mx-section">
                    <div className="mx-section-header">
                      <div className="mx-section-title-wrap">
                        <span className="mx-section-bar" />
                        <h3 className="mx-section-title">{section.title}</h3>
                        <span className="mx-section-count">{section.items.length}</span>
                      </div>
                    </div>
                    {section.items.length > 0 ? (
                      <div className="mx-scroll-row">
                        {section.items.slice(0, 12).map((manga, mi) => (
                          <div key={manga.id} className="mx-scroll-item">
                            <MangaGridCard
                              manga={manga}
                              rank={mi < 3 ? mi + 1 : undefined}
                              onClick={() => navigate({ page: "manga-detail", id: manga.id })}
                            />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-zinc-600 text-xs">No items in this section.</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// FILTER PANEL (comix.to-style advanced filters)
// ═══════════════════════════════════════════════════════════════════════

interface FilterPanelProps {
  sortBy: SortType;
  setSortBy: (s: SortType) => void;
  typeFilter: TypeFilter;
  setTypeFilter: (t: TypeFilter) => void;
  statusFilter: StatusFilter;
  setStatusFilter: (s: StatusFilter) => void;
  selectedGenres: string[];
  toggleGenre: (g: string) => void;
  minChapters: number;
  setMinChapters: (n: number) => void;
  hasActiveFilters: boolean;
  clearFilters: () => void;
  onSurprise: () => void;
}

function FilterPanel({
  sortBy,
  setSortBy,
  typeFilter,
  setTypeFilter,
  statusFilter,
  setStatusFilter,
  selectedGenres,
  toggleGenre,
  minChapters,
  setMinChapters,
  hasActiveFilters,
  clearFilters,
  onSurprise,
}: FilterPanelProps) {
  return (
    <div className="mx-filter-panel">
      <div className="mx-filter-heading">
        <IconFilter className="w-3.5 h-3.5" />
        Advanced Filters
      </div>

      {/* SORT BY */}
      <div className="mx-filter-section">
        <h4 className="mx-filter-label">Sort By</h4>
        <div className="mx-filter-radio-group">
          {([
            { id: "latest" as SortType, label: "Latest" },
            { id: "popular" as SortType, label: "Popular" },
            { id: "rating" as SortType, label: "Rating" },
            { id: "az" as SortType, label: "A → Z" },
          ]).map(opt => (
            <button
              key={opt.id}
              onClick={() => setSortBy(opt.id)}
              className={`mx-filter-radio ${sortBy === opt.id ? "active" : ""}`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* TYPE */}
      <div className="mx-filter-section">
        <h4 className="mx-filter-label">Type</h4>
        <div className="mx-filter-radio-group">
          {([
            { id: "all" as TypeFilter, label: "Any" },
            { id: "manga" as TypeFilter, label: "Manga" },
            { id: "manhwa" as TypeFilter, label: "Manhwa" },
            { id: "manhua" as TypeFilter, label: "Manhua" },
            { id: "one_shot" as TypeFilter, label: "One Shot" },
          ]).map(opt => {
            const isActive = typeFilter === opt.id;
            const c = opt.id !== "all" ? typeColor(opt.id) : "#A1A1AA";
            return (
              <button
                key={opt.id}
                onClick={() => setTypeFilter(opt.id)}
                className={`mx-filter-radio ${isActive ? "active" : ""}`}
                style={isActive && opt.id !== "all" ? {
                  background: `${c}20`,
                  color: c,
                  borderColor: `${c}50`,
                } : {}}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* STATUS */}
      <div className="mx-filter-section">
        <h4 className="mx-filter-label">Release Status</h4>
        <div className="mx-filter-radio-group">
          {([
            { id: "all" as StatusFilter, label: "Any" },
            { id: "ongoing" as StatusFilter, label: "Ongoing" },
            { id: "completed" as StatusFilter, label: "Completed" },
            { id: "hiatus" as StatusFilter, label: "Hiatus" },
          ]).map(opt => {
            const isActive = statusFilter === opt.id;
            const c = opt.id !== "all" ? statusColor(opt.id) : "#A1A1AA";
            return (
              <button
                key={opt.id}
                onClick={() => setStatusFilter(opt.id)}
                className={`mx-filter-radio ${isActive ? "active" : ""}`}
                style={isActive && opt.id !== "all" ? {
                  background: `${c}20`,
                  color: c,
                  borderColor: `${c}50`,
                } : {}}
              >
                {opt.id !== "all" && (
                  <span
                    className="inline-block w-1.5 h-1.5 rounded-full mr-1.5"
                    style={{
                      background: c,
                      boxShadow: isActive ? `0 0 4px ${c}` : "none",
                    }}
                  />
                )}
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* MIN CHAPTERS */}
      <div className="mx-filter-section">
        <h4 className="mx-filter-label">
          Minimum Chapters
          <span className="mx-filter-value">{minChapters}</span>
        </h4>
        <input
          type="range"
          min={0}
          max={200}
          step={10}
          value={minChapters}
          onChange={e => setMinChapters(Number(e.target.value))}
          className="mx-filter-range"
        />
      </div>

      {/* GENRES */}
      <div className="mx-filter-section">
        <h4 className="mx-filter-label">Genres</h4>
        <div className="mx-filter-genres">
          {GENRE_LIST.map(genre => (
            <button
              key={genre}
              onClick={() => toggleGenre(genre)}
              className={`mx-filter-genre ${selectedGenres.includes(genre) ? "active" : ""}`}
            >
              {genre}
            </button>
          ))}
        </div>
      </div>

      {/* ACTIONS */}
      <div className="mx-filter-actions">
        <button
          onClick={onSurprise}
          className="mx-filter-lucky"
          title="Open a random manga"
        >
          <IconSparkles className="w-4 h-4" />
          I&apos;m Feeling Lucky
        </button>
        {hasActiveFilters && (
          <button onClick={clearFilters} className="mx-filter-reset">
            <IconRefresh className="w-3.5 h-3.5" />
            Reset Filters
          </button>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// LIST CARD (comix.to-style ranked detailed row)
// ═══════════════════════════════════════════════════════════════════════

function MangaListCard({
  manga,
  rank,
  onClick,
}: {
  manga: MangaEntry;
  rank: number;
  onClick: () => void;
}) {
  const [imgLoaded, setImgLoaded] = useState(false);
  const displayTitle = manga.englishTitle || manga.title;
  const poster = manga.poster || manga.cover || "";
  const tColor = typeColor(manga.type);
  const sColor = statusColor(manga.status);

  return (
    <button
      onClick={onClick}
      className="mx-list-card group"
    >
      {/* Rank number (comix.to-style large number on left) */}
      <span className="mx-list-rank">#{rank}</span>

      {/* Poster thumbnail */}
      <div className="mx-list-poster-wrap">
        <div className="mx-list-poster">
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
      </div>

      {/* Info */}
      <div className="mx-list-info">
        <div className="mx-list-info-top">
          <h3 className="mx-list-title">{displayTitle}</h3>
          {manga.rating ? (
            <span className="mx-list-rating">
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
              {manga.rating.toFixed(2)}
            </span>
          ) : null}
        </div>

        <div className="mx-list-meta">
          <span
            className="mx-list-type"
            style={{
              background: `${tColor}20`,
              color: tColor,
              borderColor: `${tColor}40`,
            }}
          >
            {(manga.type || "MANGA").toUpperCase()}
          </span>
          {manga.status && (
            <span
              className="mx-list-status"
              style={{ color: sColor }}
            >
              <span
                className="inline-block w-1.5 h-1.5 rounded-full mr-1"
                style={{ background: sColor, boxShadow: `0 0 4px ${sColor}` }}
              />
              {manga.status.toUpperCase()}
            </span>
          )}
          {manga.chapterCount ? (
            <span className="mx-list-chapters">CH.{manga.chapterCount}</span>
          ) : null}
          <span className="mx-list-time">{formatTimeAgo()}</span>
        </div>

        {manga.description && (
          <p className="mx-list-desc">{manga.description.slice(0, 240)}</p>
        )}

        {manga.genres && manga.genres.length > 0 && (
          <div className="mx-list-genres">
            {manga.genres.slice(0, 5).map(g => (
              <span key={g} className="mx-list-genre">{g}</span>
            ))}
          </div>
        )}
      </div>

      {/* Hover CTA */}
      <div className="mx-list-cta">
        <IconChevronRight className="w-5 h-5" />
      </div>
    </button>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// GRID CARD (compact poster card)
// ═══════════════════════════════════════════════════════════════════════

function MangaGridCard({
  manga,
  rank,
  onClick,
}: {
  manga: MangaEntry;
  rank?: number;
  onClick: () => void;
}) {
  const [imgLoaded, setImgLoaded] = useState(false);
  const displayTitle = manga.englishTitle || manga.title;
  const poster = manga.poster || manga.cover || "";
  const tColor = typeColor(manga.type);

  return (
    <div
      onClick={onClick}
      onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } }}
      role="button"
      tabIndex={0}
      className="mx-card group focus-ring"
    >
      <div className="relative w-full h-full overflow-hidden bg-[#0a0a14] rounded-xl">
        {!imgLoaded && <div className="absolute inset-0 skeleton" />}
        {poster && (
          <img
            src={poster}
            alt={displayTitle}
            className={`absolute inset-0 w-full h-full object-cover transition-all duration-500 group-hover:scale-110 ${imgLoaded ? "opacity-100" : "opacity-0"}`}
            onLoad={() => setImgLoaded(true)}
            loading="lazy"
          />
        )}

        <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-[#05050a] via-[#05050a]/70 to-transparent" />

        <div className="absolute inset-x-0 bottom-0 p-2.5">
          <h3 className="text-[11px] font-semibold text-white line-clamp-2 leading-tight drop-shadow-lg">
            {displayTitle}
          </h3>
        </div>

        {/* Type badge */}
        <div
          className="absolute top-2 right-2 text-[8px] font-bold px-1.5 py-0.5 rounded-md backdrop-blur-sm z-10"
          style={{
            background: `${tColor}30`,
            color: tColor,
            border: `1px solid ${tColor}40`,
          }}
        >
          {(manga.type || "MANGA").toUpperCase()}
        </div>

        {/* Rank badge */}
        {rank && rank <= 3 && (
          <div
            className="absolute top-2 left-2 z-10 flex items-center justify-center w-7 h-7 rounded-lg"
            style={{
              background:
                rank === 1
                  ? "linear-gradient(135deg, #FF6B6B, #FF8E53)"
                  : rank === 2
                    ? "linear-gradient(135deg, #6366F1, #818CF8)"
                    : "linear-gradient(135deg, #F59E0B, #FBBF24)",
              boxShadow:
                rank === 1
                  ? "0 0 12px rgba(255,107,107,0.4)"
                  : rank === 2
                    ? "0 0 12px rgba(99,102,241,0.3)"
                    : "0 0 12px rgba(245,158,11,0.3)",
            }}
          >
            <span className="text-[10px] font-black text-white">{rank}</span>
          </div>
        )}

        {/* Status dot */}
        {manga.status && (
          <div className="absolute bottom-2 left-2.5 z-10 flex items-center gap-1.5">
            <span
              className="w-2 h-2 rounded-full"
              style={{
                background: statusColor(manga.status),
                boxShadow: `0 0 6px ${statusColor(manga.status)}60`,
              }}
            />
          </div>
        )}

        {/* Hover overlay */}
        <div className="mx-card-hover-overlay">
          <h3 className="text-sm font-bold text-white line-clamp-2 leading-tight mb-1.5">
            {displayTitle}
          </h3>
          <div className="flex items-center gap-2 flex-wrap">
            {manga.rating ? (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-amber-500/15 text-amber-300 flex items-center gap-0.5">
                <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                </svg>
                {manga.rating.toFixed(1)}
              </span>
            ) : null}
            {manga.chapterCount ? (
              <span className="text-[9px] text-zinc-400">{manga.chapterCount} ch</span>
            ) : null}
            {manga.year ? (
              <span className="text-[9px] text-zinc-500">{manga.year}</span>
            ) : null}
          </div>
          {manga.genres && manga.genres.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {manga.genres.slice(0, 3).map(g => (
                <span key={g} className="text-[8px] px-1.5 py-0.5 rounded bg-white/[0.08] text-zinc-400">
                  {g}
                </span>
              ))}
            </div>
          )}
          <span className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#FF6B6B] hover:bg-red-600 text-white text-[11px] font-semibold rounded-full transition-all shadow-lg shadow-red-600/25">
            <IconBook className="w-3 h-3" />
            Read
          </span>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// ICONS (inline SVGs — no extra dependency)
// ═══════════════════════════════════════════════════════════════════════

function IconBook({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
    </svg>
  );
}

function IconInfo({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4M12 8h.01" />
    </svg>
  );
}

function IconSearch({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function IconX({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function IconFilter({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path d="M3 4h18M3 12h12M3 20h6" />
    </svg>
  );
}

function IconSparkles({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M5 3l1.5 3L9 7.5 6.5 9 5 12 3.5 9 1 7.5 3.5 6z" />
      <path d="M19 13l1 2 2 1-2 1-1 2-1-2-2-1 2-1z" />
      <path d="M14 4l1 2 2 1-2 1-1 2-1-2-2-1 2-1z" />
    </svg>
  );
}

function IconRefresh({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path d="M3 12a9 9 0 0115-6.7L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 01-15 6.7L3 16" />
      <path d="M3 21v-5h5" />
    </svg>
  );
}

function IconChevronRight({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path d="M9 5l7 7-7 7" />
    </svg>
  );
}
