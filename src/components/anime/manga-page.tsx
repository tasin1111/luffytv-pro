"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useAppStore } from "./store";

/* ═══════════════════════════════════════════════════════════════
   LUFFYTV MANGA HOME — Full Structural Redesign v3
   ─────────────────────────────────────────────────────────────
   INSPIRED BY:
   • MangaFire.to  → Trending carousel, sidebar filters
   • Comix.to      → Advanced filters, ranked sections
   • Atsu.moe      → Bento-style layout, type badges
   • Onisaga.com   → Clean card design, genre tags
   • LunarAnime.ru → Discovery-focused, advanced search

   STRUCTURAL CHANGES from v2:
   1. Full-width parallax TRENDING SPOTLIGHT with poster + glassmorphic border
   2. PERSISTENT LEFT SIDEBAR (desktop) — MangaFire-style filter panel
   3. BENTO GRID instead of simple horizontal rows (featured = 2× tall)
   4. ALL-NEW CARD DESIGN — full poster, type badge, rank badge, status dot
   5. TABS with animated red underline + glow
   6. Full-width search bar with debounced input
   7. Grid/List view toggle
   8. Section rows with horizontal snap-scroll on Home tab
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

type ViewMode = "grid" | "list";
type TabType = "home" | "trending" | "popular" | "latest" | "completed";
type FilterType = "all" | "Manga" | "Manhwa" | "Manhua" | "Novel" | "One Shot";
type SortType = "latest" | "popular" | "trending" | "rating" | "az";

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
  "one shot": "#EC4899",
};

const STATUS_DOT: Record<string, string> = {
  ongoing: "#10B981",
  completed: "#3B82F6",
  hiatus: "#F59E0B",
};

export default function MangaPage() {
  const navigate = useAppStore(s => s.navigate);
  const [sections, setSections] = useState<MangaSection[]>([]);
  const [searchResults, setSearchResults] = useState<MangaEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [searchMode, setSearchMode] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [activeTab, setActiveTab] = useState<TabType>("home");
  const [typeFilter, setTypeFilter] = useState<FilterType>("all");
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [spotlightIdx, setSpotlightIdx] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sortBy, setSortBy] = useState<SortType>("latest");
  const [statusFilter, setStatusFilter] = useState<"all" | "ongoing" | "completed" | "hiatus">("all");

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
  useEffect(() => {
    if (sections.length === 0) return;
    const allItems = sections.flatMap(s => s.items).filter(m => m.poster);
    if (allItems.length <= 1) return;
    const timer = setInterval(() => {
      setSpotlightIdx(prev => (prev + 1) % Math.min(allItems.length, 8));
    }, 7000);
    return () => clearInterval(timer);
  }, [sections]);

  // ── Search ──
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
    searchTimer.current = setTimeout(() => handleSearch(value), 500);
  };

  const toggleGenre = (genre: string) => {
    setSelectedGenres(prev =>
      prev.includes(genre) ? prev.filter(g => g !== genre) : [...prev, genre]
    );
  };

  // ── Random manga ──
  const handleRandom = useCallback(() => {
    const allItems = sections.flatMap(s => s.items);
    if (allItems.length === 0) return;
    const randomItem = allItems[Math.floor(Math.random() * allItems.length)];
    navigate({ page: "manga-detail", id: randomItem.id });
  }, [sections, navigate]);

  // ── Clear all filters ──
  const clearFilters = () => {
    setTypeFilter("all");
    setSelectedGenres([]);
    setStatusFilter("all");
    setSortBy("latest");
  };

  const hasActiveFilters = typeFilter !== "all" || selectedGenres.length > 0 || statusFilter !== "all";

  // ── Get all items for current tab ──
  const getAllItems = useCallback((): MangaEntry[] => {
    if (searchMode) return searchResults;
    let items: MangaEntry[] = [];
    switch (activeTab) {
      case "trending":
        items = sections.find(s => s.type.includes("trend") || s.title.toLowerCase().includes("trend"))?.items || [];
        break;
      case "popular":
        items = sections.find(s => s.type.includes("popular") || s.title.toLowerCase().includes("popular"))?.items || [];
        break;
      case "latest":
        items = sections.find(s => s.type.includes("recent") || s.type.includes("latest") || s.title.toLowerCase().includes("update") || s.title.toLowerCase().includes("latest"))?.items || [];
        break;
      case "completed":
        items = sections.flatMap(s => s.items).filter(m => m.status?.toLowerCase() === "completed");
        break;
      default:
        items = sections.flatMap(s => s.items);
    }
    if (typeFilter !== "all") {
      items = items.filter(m => m.type?.toLowerCase() === typeFilter.toLowerCase());
    }
    if (selectedGenres.length > 0) {
      items = items.filter(m =>
        m.genres?.some(g => selectedGenres.some(sg => g.toLowerCase().includes(sg.toLowerCase())))
      );
    }
    if (statusFilter !== "all") {
      items = items.filter(m => m.status?.toLowerCase() === statusFilter);
    }
    const seen = new Set<string>();
    return items.filter(m => {
      if (seen.has(m.id)) return false;
      seen.add(m.id);
      return true;
    });
  }, [searchMode, searchResults, sections, activeTab, typeFilter, selectedGenres, statusFilter]);

  const spotlightItems = sections.flatMap(s => s.items).filter(m => m.poster).slice(0, 8);
  const displayItems = getAllItems();

  // ── Close sidebar on mobile when navigating ──
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) return;
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // ── LOADING STATE ──
  if (loading) {
    return (
      <div className="fade-in -mx-4 lg:-mx-8">
        {/* Spotlight skeleton */}
        <div className="skeleton" style={{ minHeight: "50vh", borderRadius: 0 }} />
        <div className="flex gap-6 px-4 lg:px-8 py-6">
          {/* Sidebar skeleton */}
          <div className="hidden lg:block w-56 shrink-0 space-y-4">
            <div className="h-8 w-full skeleton rounded-lg" />
            <div className="h-8 w-full skeleton rounded-lg" />
            <div className="h-8 w-full skeleton rounded-lg" />
            <div className="h-6 w-32 skeleton rounded-lg" />
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="h-7 w-16 skeleton rounded-full" />
              ))}
            </div>
          </div>
          {/* Content skeleton */}
          <div className="flex-1 space-y-8">
            <div className="h-10 w-full skeleton rounded-xl" />
            <div className="flex gap-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-9 w-20 skeleton rounded-lg" />
              ))}
            </div>
            <div className="mg-bento-skeleton">
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className={`skeleton rounded-xl ${i === 0 ? "row-span-2" : ""}`} style={{ aspectRatio: i === 0 ? "auto" : "2/3" }} />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fade-in -mx-4 lg:-mx-8 min-h-screen bg-[#05050a]">
      {/* ══════════════════════════════════════════
          SECTION 1: TRENDING SPOTLIGHT
          Full-width parallax hero with animated gradient
          ══════════════════════════════════════════ */}
      {spotlightItems.length > 0 && !searchMode && (
        <div className="mg-spotlight">
          {spotlightItems.map((manga, idx) => (
            <div
              key={manga.id}
              className={`mg-spotlight-slide ${idx === spotlightIdx ? "active" : ""}`}
            >
              {/* Blur background */}
              {manga.poster && (
                <img src={manga.poster} alt="" className="mg-spotlight-bg" />
              )}
              <div className="mg-spotlight-overlay" />
              {/* Animated gradient accent */}
              <div className="mg-spotlight-gradient" />
              {/* Content: Info left, Poster right */}
              <div className="mg-spotlight-content">
                <div className="mg-spotlight-info">
                  {/* Badges row */}
                  <div className="mg-spotlight-badges">
                    <span
                      className="mg-type-badge"
                      style={{
                        background: `${TYPE_COLORS[manga.type?.toLowerCase() || "manga"] || "#8E7CE6"}20`,
                        color: TYPE_COLORS[manga.type?.toLowerCase() || "manga"] || "#8E7CE6",
                        borderColor: `${TYPE_COLORS[manga.type?.toLowerCase() || "manga"] || "#8E7CE6"}40`,
                      }}
                    >
                      {manga.type || "MANGA"}
                    </span>
                    {manga.status && (
                      <span className="mg-status-badge" style={{
                        background: manga.status.toLowerCase() === "ongoing" ? "rgba(16,185,129,0.15)" : "rgba(59,130,246,0.15)",
                        color: manga.status.toLowerCase() === "ongoing" ? "#10B981" : "#3B82F6",
                        borderColor: manga.status.toLowerCase() === "ongoing" ? "rgba(16,185,129,0.3)" : "rgba(59,130,246,0.3)",
                      }}>
                        <span className="inline-block w-1.5 h-1.5 rounded-full mr-1.5" style={{
                          background: manga.status.toLowerCase() === "ongoing" ? "#10B981" : "#3B82F6",
                          boxShadow: `0 0 6px ${manga.status.toLowerCase() === "ongoing" ? "#10B981" : "#3B82F6"}`,
                        }} />
                        {manga.status}
                      </span>
                    )}
                    {manga.rating && (
                      <span className="mg-rating-badge">
                        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
                        {manga.rating.toFixed(1)}
                      </span>
                    )}
                  </div>
                  {/* Title */}
                  <h2 className="mg-spotlight-title">{manga.englishTitle || manga.title}</h2>
                  {/* Synopsis */}
                  {manga.description && (
                    <p className="mg-spotlight-synopsis">{manga.description.slice(0, 200)}...</p>
                  )}
                  {/* Latest chapter */}
                  {manga.latestChapter && (
                    <div className="mg-spotlight-latest">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {manga.latestChapter}
                    </div>
                  )}
                  {/* Genre pills */}
                  {manga.genres && manga.genres.length > 0 && (
                    <div className="mg-spotlight-genres">
                      {manga.genres.slice(0, 5).map(g => (
                        <span key={g} className="mg-genre-chip">{g}</span>
                      ))}
                    </div>
                  )}
                  {/* CTA Buttons */}
                  <div className="mg-spotlight-actions">
                    <button className="mg-btn-read" onClick={(e) => { e.stopPropagation(); navigate({ page: "manga-detail", id: manga.id }); }}>
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                        <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
                        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
                      </svg>
                      Read Now
                    </button>
                    <button className="mg-btn-details" onClick={(e) => { e.stopPropagation(); navigate({ page: "manga-detail", id: manga.id }); }}>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <circle cx="12" cy="12" r="10" />
                        <path d="M12 16v-4M12 8h.01" />
                      </svg>
                      Details
                    </button>
                  </div>
                </div>
                {/* Poster on right (desktop) with glassmorphic border */}
                <div className="mg-spotlight-poster-wrap hidden lg:flex" onClick={() => navigate({ page: "manga-detail", id: manga.id })}>
                  <div className="mg-spotlight-poster-glass">
                    {manga.poster && (
                      <img src={manga.poster} alt={manga.englishTitle || manga.title} className="mg-spotlight-poster" />
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
          {/* Navigation dots */}
          <div className="mg-spotlight-dots">
            {spotlightItems.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setSpotlightIdx(idx)}
                className={`mg-spotlight-dot ${idx === spotlightIdx ? "active" : ""}`}
              />
            ))}
          </div>
          {/* Prev/Next arrows */}
          <button
            className="mg-spotlight-arrow mg-spotlight-arrow-left"
            onClick={() => setSpotlightIdx(prev => (prev - 1 + Math.min(spotlightItems.length, 8)) % Math.min(spotlightItems.length, 8))}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M15 19l-7-7 7-7" /></svg>
          </button>
          <button
            className="mg-spotlight-arrow mg-spotlight-arrow-right"
            onClick={() => setSpotlightIdx(prev => (prev + 1) % Math.min(spotlightItems.length, 8))}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M9 5l7 7-7 7" /></svg>
          </button>
        </div>
      )}

      {/* ══════════════════════════════════════════
          SECTION 2: MAIN LAYOUT — Sidebar + Content
          ══════════════════════════════════════════ */}
      <div className="mg-main-layout">
        {/* ── LEFT SIDEBAR (desktop) ── */}
        <aside className="mg-sidebar">
          {/* Type Filter */}
          <div className="mg-sidebar-section">
            <h4 className="mg-sidebar-heading">Type</h4>
            <div className="mg-sidebar-type-pills">
              {(["all", "Manga", "Manhwa", "Manhua", "Novel", "One Shot"] as FilterType[]).map(type => {
                const isActive = typeFilter === type;
                const color = TYPE_COLORS[type.toLowerCase()] || "#8E7CE6";
                return (
                  <button
                    key={type}
                    onClick={() => setTypeFilter(type)}
                    className={`mg-sidebar-type-pill ${isActive ? "active" : ""}`}
                    style={isActive && type !== "all" ? {
                      background: `${color}20`,
                      color: color,
                      borderColor: `${color}50`,
                      boxShadow: `0 0 12px ${color}15`,
                    } : {}}
                  >
                    {type === "all" ? "All" : type}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Genre Filter */}
          <div className="mg-sidebar-section">
            <h4 className="mg-sidebar-heading">Genre</h4>
            <div className="mg-sidebar-genre-chips">
              {GENRE_LIST.map(genre => (
                <button
                  key={genre}
                  onClick={() => toggleGenre(genre)}
                  className={`mg-sidebar-genre-chip ${selectedGenres.includes(genre) ? "active" : ""}`}
                >
                  {genre}
                </button>
              ))}
            </div>
          </div>

          {/* Status Filter */}
          <div className="mg-sidebar-section">
            <h4 className="mg-sidebar-heading">Status</h4>
            <div className="mg-sidebar-status-pills">
              {(["all", "ongoing", "completed", "hiatus"] as const).map(status => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`mg-sidebar-status-pill ${statusFilter === status ? "active" : ""}`}
                >
                  {status !== "all" && (
                    <span className="inline-block w-1.5 h-1.5 rounded-full mr-1.5" style={{
                      background: STATUS_DOT[status] || "#71717A",
                      boxShadow: statusFilter === status ? `0 0 6px ${STATUS_DOT[status]}` : "none",
                    }} />
                  )}
                  {status === "all" ? "All" : status.charAt(0).toUpperCase() + status.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Sort */}
          <div className="mg-sidebar-section">
            <h4 className="mg-sidebar-heading">Sort By</h4>
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as SortType)}
              className="mg-sidebar-sort"
            >
              <option value="latest">Latest</option>
              <option value="popular">Popular</option>
              <option value="trending">Trending</option>
              <option value="rating">Top Rated</option>
              <option value="az">A-Z</option>
            </select>
          </div>

          {/* Action Buttons */}
          <div className="mg-sidebar-actions">
            <button onClick={handleRandom} className="mg-sidebar-surprise">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5" />
              </svg>
              Surprise Me
            </button>
            {hasActiveFilters && (
              <button onClick={clearFilters} className="mg-sidebar-clear">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path d="M6 18L18 6M6 6l12 12" />
                </svg>
                Clear All
              </button>
            )}
          </div>
        </aside>

        {/* ── MOBILE SIDEBAR OVERLAY ── */}
        {sidebarOpen && (
          <div className="mg-sidebar-overlay" onClick={() => setSidebarOpen(false)}>
            <aside className="mg-sidebar-mobile slide-up" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white font-bold text-lg">Filters</h3>
                <button onClick={() => setSidebarOpen(false)} className="text-zinc-400 hover:text-white transition-colors p-1">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              {/* Type Filter */}
              <div className="mg-sidebar-section">
                <h4 className="mg-sidebar-heading">Type</h4>
                <div className="mg-sidebar-type-pills">
                  {(["all", "Manga", "Manhwa", "Manhua", "Novel", "One Shot"] as FilterType[]).map(type => {
                    const isActive = typeFilter === type;
                    const color = TYPE_COLORS[type.toLowerCase()] || "#8E7CE6";
                    return (
                      <button
                        key={type}
                        onClick={() => setTypeFilter(type)}
                        className={`mg-sidebar-type-pill ${isActive ? "active" : ""}`}
                        style={isActive && type !== "all" ? {
                          background: `${color}20`,
                          color: color,
                          borderColor: `${color}50`,
                        } : {}}
                      >
                        {type === "all" ? "All" : type}
                      </button>
                    );
                  })}
                </div>
              </div>
              {/* Genre */}
              <div className="mg-sidebar-section">
                <h4 className="mg-sidebar-heading">Genre</h4>
                <div className="mg-sidebar-genre-chips">
                  {GENRE_LIST.map(genre => (
                    <button
                      key={genre}
                      onClick={() => toggleGenre(genre)}
                      className={`mg-sidebar-genre-chip ${selectedGenres.includes(genre) ? "active" : ""}`}
                    >
                      {genre}
                    </button>
                  ))}
                </div>
              </div>
              {/* Status */}
              <div className="mg-sidebar-section">
                <h4 className="mg-sidebar-heading">Status</h4>
                <div className="mg-sidebar-status-pills">
                  {(["all", "ongoing", "completed", "hiatus"] as const).map(status => (
                    <button
                      key={status}
                      onClick={() => setStatusFilter(status)}
                      className={`mg-sidebar-status-pill ${statusFilter === status ? "active" : ""}`}
                    >
                      {status === "all" ? "All" : status.charAt(0).toUpperCase() + status.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
              {/* Sort */}
              <div className="mg-sidebar-section">
                <h4 className="mg-sidebar-heading">Sort By</h4>
                <select
                  value={sortBy}
                  onChange={e => setSortBy(e.target.value as SortType)}
                  className="mg-sidebar-sort"
                >
                  <option value="latest">Latest</option>
                  <option value="popular">Popular</option>
                  <option value="trending">Trending</option>
                  <option value="rating">Top Rated</option>
                  <option value="az">A-Z</option>
                </select>
              </div>
              {/* Actions */}
              <div className="mg-sidebar-actions">
                <button onClick={handleRandom} className="mg-sidebar-surprise">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5" />
                  </svg>
                  Surprise Me
                </button>
                {hasActiveFilters && (
                  <button onClick={clearFilters} className="mg-sidebar-clear">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    Clear All
                  </button>
                )}
              </div>
            </aside>
          </div>
        )}

        {/* ══════════════════════════════════════════
            CONTENT AREA
            ══════════════════════════════════════════ */}
        <div className="mg-content-area">
          {/* ── SEARCH BAR ── */}
          <div className="mg-search">
            <svg className="mg-search-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              placeholder="Search manga by title, author, genre..."
              value={searchQuery}
              onChange={e => onSearchChange(e.target.value)}
              className="mg-search-input"
            />
            {searching && (
              <div className="mg-search-spinner">
                <div className="w-4 h-4 border-2 border-red-500/20 border-t-red-500 rounded-full animate-spin" />
              </div>
            )}
          </div>

          {/* ── TOOLBAR: Tabs + Controls ── */}
          {!searchMode && (
            <div className="mg-toolbar">
              {/* Tabs */}
              <div className="mg-tabs">
                {([
                  { id: "home" as TabType, label: "Home" },
                  { id: "trending" as TabType, label: "Trending" },
                  { id: "popular" as TabType, label: "Popular" },
                  { id: "latest" as TabType, label: "Latest" },
                  { id: "completed" as TabType, label: "Completed" },
                ]).map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`mg-tab ${activeTab === tab.id ? "active" : ""}`}
                  >
                    {tab.label}
                  </button>
                ))}
                {/* Animated underline indicator */}
                <div className="mg-tab-indicator" style={{
                  left: `${["home", "trending", "popular", "latest", "completed"].indexOf(activeTab) * 20}%`,
                  width: "20%",
                }} />
              </div>

              {/* Right controls */}
              <div className="mg-toolbar-controls">
                {/* Mobile filter toggle */}
                <button
                  onClick={() => setSidebarOpen(!sidebarOpen)}
                  className="mg-toolbar-btn lg:hidden"
                  title="Filters"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path d="M3 4h18M3 12h12M3 20h6" />
                  </svg>
                  {hasActiveFilters && (
                    <span className="mg-toolbar-badge">
                      {(typeFilter !== "all" ? 1 : 0) + selectedGenres.length + (statusFilter !== "all" ? 1 : 0)}
                    </span>
                  )}
                </button>
                {/* View toggle */}
                <div className="mg-view-toggle">
                  <button
                    onClick={() => setViewMode("grid")}
                    className={`mg-view-btn ${viewMode === "grid" ? "active" : ""}`}
                    title="Grid view"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
                      <rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" />
                    </svg>
                  </button>
                  <button
                    onClick={() => setViewMode("list")}
                    className={`mg-view-btn ${viewMode === "list" ? "active" : ""}`}
                    title="List view"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path d="M3 6h18M3 12h18M3 18h18" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── CONTENT ── */}
          {searchMode ? (
            /* Search Results */
            <div className="space-y-4">
              <div className="mg-section-header">
                <h2 className="mg-section-title">Search Results</h2>
                <span className="mg-section-count">({searchResults.length} found)</span>
              </div>
              {searchResults.length > 0 ? (
                viewMode === "grid" ? (
                  <div className="mg-bento">
                    {searchResults.map((manga, idx) => (
                      <MangaGridCard key={manga.id} manga={manga} rank={idx < 3 ? idx + 1 : undefined} isFeatured={idx === 0} onClick={() => navigate({ page: "manga-detail", id: manga.id })} />
                    ))}
                  </div>
                ) : (
                  <div className="mg-list">
                    {searchResults.map((manga, idx) => (
                      <MangaListCard key={manga.id} manga={manga} rank={idx + 1} onClick={() => navigate({ page: "manga-detail", id: manga.id })} />
                    ))}
                  </div>
                )
              ) : !searching ? (
                <div className="mg-empty">
                  <svg className="w-12 h-12 text-zinc-600 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                  <p className="text-zinc-400 text-sm">No manga found for &quot;{searchQuery}&quot;</p>
                  <p className="text-zinc-600 text-xs mt-1">Try a different search term</p>
                </div>
              ) : null}
            </div>
          ) : activeTab === "home" ? (
            /* Home: Section Rows with horizontal snap scroll */
            sections.map((section, si) => (
              <div key={si} className="mg-section">
                <div className="mg-section-header">
                  <div className="flex items-center gap-2.5">
                    <div className="w-1 h-5 bg-[#ffffff] rounded-full" />
                    <h2 className="mg-section-title">{section.title}</h2>
                    <span className="mg-section-count">({section.items.length})</span>
                  </div>
                  <button
                    onClick={() => setActiveTab(si === 0 ? "trending" : si === 1 ? "popular" : "latest")}
                    className="mg-see-all"
                  >
                    See All
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
                {section.items.length > 0 ? (
                  <div className="mg-scroll-row scroll-container">
                    {section.items.map((manga, mi) => (
                      <div key={manga.id} className="mg-scroll-item">
                        <MangaGridCard manga={manga} rank={mi < 3 ? mi + 1 : undefined} onClick={() => navigate({ page: "manga-detail", id: manga.id })} />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mg-empty-sm">
                    <p className="text-zinc-500 text-xs">No manga in this section</p>
                  </div>
                )}
              </div>
            ))
          ) : (
            /* Tab view: Bento Grid or List */
            <div className="space-y-4">
              <div className="mg-section-header">
                <h2 className="mg-section-title">
                  {activeTab === "trending" ? "Trending" : activeTab === "popular" ? "Popular" : activeTab === "latest" ? "Latest Updates" : "Completed"}
                </h2>
                <span className="mg-section-count">({displayItems.length})</span>
              </div>
              {displayItems.length > 0 ? (
                viewMode === "grid" ? (
                  <div className="mg-bento">
                    {displayItems.map((manga, idx) => (
                      <MangaGridCard key={manga.id} manga={manga} rank={idx < 3 ? idx + 1 : undefined} isFeatured={idx === 0} onClick={() => navigate({ page: "manga-detail", id: manga.id })} />
                    ))}
                  </div>
                ) : (
                  <div className="mg-list">
                    {displayItems.map((manga, idx) => (
                      <MangaListCard key={manga.id} manga={manga} rank={idx + 1} onClick={() => navigate({ page: "manga-detail", id: manga.id })} />
                    ))}
                  </div>
                )
              ) : (
                <div className="mg-empty">
                  <svg className="w-12 h-12 text-zinc-600 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
                    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
                  </svg>
                  <p className="text-zinc-400 text-sm">No manga found with current filters</p>
                  <button onClick={clearFilters} className="mt-3 text-xs text-[#ffffff] hover:underline">Clear filters</button>
                </div>
              )}
            </div>
          )}

          {/* Empty state — no sections at all */}
          {!searchMode && sections.length === 0 && (
            <div className="mg-empty">
              <svg className="w-14 h-14 text-zinc-600 mx-auto mb-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
              </svg>
              <p className="text-zinc-400 text-sm">No manga available right now</p>
              <p className="text-zinc-600 text-xs mt-1">Try searching for a title!</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MANGA GRID CARD v3 — Bento-style with full poster overlay
   ═══════════════════════════════════════════════════════════════ */
function MangaGridCard({ manga, rank, isFeatured, onClick }: { manga: MangaEntry; rank?: number; isFeatured?: boolean; onClick: () => void }) {
  const [imgLoaded, setImgLoaded] = useState(false);
  const displayTitle = manga.englishTitle || manga.title;
  const poster = manga.poster || manga.cover || "";
  const typeColor = TYPE_COLORS[manga.type?.toLowerCase() || "manga"] || "#8E7CE6";

  return (
    <div
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } }}
      role="button"
      tabIndex={0}
      className={`mg-card group focus-ring ${isFeatured ? "mg-card-featured" : ""}`}
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

        {/* Bottom gradient for title (always visible) */}
        <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-[#05050a] via-[#05050a]/70 to-transparent" />

        {/* Title (always visible) */}
        <div className="absolute inset-x-0 bottom-0 p-2.5">
          <h3 className="text-[11px] font-semibold text-white line-clamp-2 leading-tight drop-shadow-lg">{displayTitle}</h3>
        </div>

        {/* TYPE BADGE — top-right, color coded */}
        <div
          className="absolute top-2 right-2 text-[8px] font-bold px-1.5 py-0.5 rounded-md backdrop-blur-sm z-10"
          style={{ background: `${typeColor}30`, color: typeColor, border: `1px solid ${typeColor}40` }}
        >
          {manga.type || "MANGA"}
        </div>

        {/* RANK BADGE — top-left for first 3 */}
        {rank && rank <= 3 && (
          <div className="absolute top-2 left-2 z-10 flex items-center justify-center w-7 h-7 rounded-lg"
            style={{
              background: rank === 1 ? "linear-gradient(135deg, #ffffff, #FF6B6B)" :
                          rank === 2 ? "linear-gradient(135deg, #6366F1, #818CF8)" :
                          "linear-gradient(135deg, #F59E0B, #FBBF24)",
              boxShadow: rank === 1 ? "0 0 12px rgba(230,57,70,0.4)" :
                         rank === 2 ? "0 0 12px rgba(99,102,241,0.3)" :
                         "0 0 12px rgba(245,158,11,0.3)",
            }}
          >
            <span className="text-[10px] font-black text-white">{rank}</span>
          </div>
        )}

        {/* STATUS DOT — bottom-left */}
        {manga.status && (
          <div className="absolute bottom-2 left-2.5 z-10 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{
              background: STATUS_DOT[manga.status.toLowerCase()] || "#71717A",
              boxShadow: `0 0 6px ${STATUS_DOT[manga.status.toLowerCase()] || "#71717A"}60`,
            }} />
          </div>
        )}

        {/* HOVER OVERLAY — expand with info */}
        <div className="mg-card-hover-overlay">
          <h3 className="text-sm font-bold text-white line-clamp-2 leading-tight mb-1.5">{displayTitle}</h3>
          <div className="flex items-center gap-2 flex-wrap">
            {manga.rating && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-amber-500/15 text-amber-300 flex items-center gap-0.5">
                <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
                {manga.rating.toFixed(1)}
              </span>
            )}
            {manga.chapterCount && <span className="text-[9px] text-zinc-400">{manga.chapterCount} ch</span>}
            {manga.year && <span className="text-[9px] text-zinc-500">{manga.year}</span>}
          </div>
          {manga.genres && manga.genres.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {manga.genres.slice(0, 3).map(g => (
                <span key={g} className="text-[8px] px-1.5 py-0.5 rounded bg-white/[0.08] text-zinc-400">{g}</span>
              ))}
            </div>
          )}
          <span className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#ffffff] hover:bg-red-700 text-white text-[11px] font-semibold rounded-full transition-all shadow-lg shadow-red-600/25">
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
            </svg>
            Read
          </span>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MANGA LIST CARD v3 — Horizontal card with poster thumbnail
   ═══════════════════════════════════════════════════════════════ */
function MangaListCard({ manga, rank, onClick }: { manga: MangaEntry; rank?: number; onClick: () => void }) {
  const [imgLoaded, setImgLoaded] = useState(false);
  const displayTitle = manga.englishTitle || manga.title;
  const poster = manga.poster || manga.cover || "";
  const typeColor = TYPE_COLORS[manga.type?.toLowerCase() || "manga"] || "#8E7CE6";

  return (
    <button
      onClick={onClick}
      className="mg-card-list group w-full"
    >
      {/* Rank number */}
      {rank && (
        <span className="text-sm font-black text-zinc-600 min-w-[28px] text-center shrink-0">{rank}</span>
      )}
      {/* Poster thumbnail */}
      <div className="relative w-16 h-24 sm:w-20 sm:h-28 shrink-0 rounded-lg overflow-hidden bg-[#0a0a14]">
        {poster && (
          <img
            src={poster}
            alt={displayTitle}
            className={`w-full h-full object-cover transition-all duration-300 group-hover:scale-105 ${imgLoaded ? "opacity-100" : "opacity-0"}`}
            onLoad={() => setImgLoaded(true)}
            loading="lazy"
          />
        )}
        {/* Type badge */}
        <div
          className="absolute top-1 left-1 text-[6px] font-bold px-1 py-0.5 rounded backdrop-blur-sm"
          style={{ background: `${typeColor}50`, color: typeColor }}
        >
          {(manga.type || "MANGA").slice(0, 4)}
        </div>
      </div>
      {/* Info */}
      <div className="flex-1 min-w-0 text-left">
        <h3 className="text-sm font-bold text-white line-clamp-1 group-hover:text-[#FF6B6B] transition-colors">{displayTitle}</h3>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          {manga.year && <span className="text-[10px] text-zinc-500">{manga.year}</span>}
          {manga.rating && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400">
              {manga.rating.toFixed(1)}
            </span>
          )}
          {manga.chapterCount && <span className="text-[9px] text-zinc-600">{manga.chapterCount} ch</span>}
          {manga.status && (
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
              manga.status.toLowerCase() === "ongoing" ? "bg-emerald-500/15 text-emerald-400" : "bg-blue-500/15 text-blue-400"
            }`}>{manga.status}</span>
          )}
        </div>
        {manga.genres && manga.genres.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {manga.genres.slice(0, 4).map(g => (
              <span key={g} className="text-[9px] px-1.5 py-0.5 rounded-full bg-white/[0.05] text-zinc-400 border border-white/[0.06]">{g}</span>
            ))}
          </div>
        )}
      </div>
      {/* Arrow */}
      <svg className="w-4 h-4 text-zinc-600 group-hover:text-[#ffffff] shrink-0 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path d="M9 5l7 7-7 7" />
      </svg>
    </button>
  );
}
