"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useAppStore, getSectionNavLinks } from "./store";
import type { SectionSubPage } from "./store";
import {
  Home,
  Search,
  X,
  Play,
  Film,
  Monitor,
  Menu,
  Sparkles,
  Phone,
  BookOpen,
  Tv,
} from "lucide-react";

// ── Quick search result type for modal ──
interface QuickResult {
  id: number;
  title: string;
  image: string;
  format?: string;
  episodes?: number;
  seasonYear?: number;
  averageScore?: number;
  status?: string;
}

// ── Floating nav link type ──
interface FloatingNavLink {
  id: string;
  label: string;
  onClick: () => void;
  active: boolean;
}

export default function Navbar() {
  const { route, navigate, sectionSubPage, setSectionSubPage } = useAppStore();
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [quickResults, setQuickResults] = useState<QuickResult[]>([]);
  const [quickLoading, setQuickLoading] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // ── Scroll detection ──
  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // ── Live search (debounced) ──
  const fetchQuickResults = useCallback(async (q: string) => {
    if (!q.trim() || q.trim().length < 2) { setQuickResults([]); return; }
    setQuickLoading(true);
    try {
      const res = await fetch(`/api/anime/search?q=${encodeURIComponent(q)}&page=1`);
      if (res.ok) {
        const data = await res.json();
        if (data?.results) {
          setQuickResults(
            data.results.slice(0, 6).map((item: any) => ({
              id: item.id,
              title: item.title?.english || item.title?.romaji || "Unknown",
              image: item.coverImage?.medium || item.coverImage?.large || "",
              format: item.format,
              episodes: item.episodes,
              seasonYear: item.seasonYear,
              averageScore: item.averageScore,
              status: item.status,
            }))
          );
        }
      }
    } catch {}
    setQuickLoading(false);
  }, []);

  const handleSearchInputChange = (value: string) => {
    setSearchQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchQuickResults(value), 300);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate({ page: "search", query: searchQuery.trim() });
      setSearchOpen(false);
      setSearchQuery("");
      setQuickResults([]);
    }
  };

  const handleQuickResultClick = (result: QuickResult) => {
    navigate({ page: "anime", id: String(result.id) });
    setSearchOpen(false);
    setSearchQuery("");
    setQuickResults([]);
  };

  const openSearch = useCallback(() => {
    setSearchOpen(true);
    setTimeout(() => searchInputRef.current?.focus(), 100);
  }, []);

  // ── Keyboard shortcuts: Ctrl+K ──
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "s")) {
        e.preventDefault();
        e.stopPropagation();
        openSearch();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [openSearch]);

  const page = route.page;

  // ═══════════════════════════════════════════════════════════════
  // PER-PAGE FLOATING NAV LINKS
  // Each page gets its own set of nav items in the floating pill
  // ═══════════════════════════════════════════════════════════════

  const isAnimePage = ["dub", "anime", "watch", "genre", "bookmarks", "history", "manga", "manga-detail", "manga-read"].includes(page);
  const isMoviePage = ["movies", "movie-detail", "movie-watch"].includes(page);
  const isTVPage = ["tv", "tv-detail", "tv-watch"].includes(page);
  const isLivePage = ["live", "live-watch", "live-tv-watch"].includes(page);
  const isMangaPage = ["manga", "manga-detail", "manga-read"].includes(page);

  // ── Main/Home page nav links ──
  const homeNavLinks: FloatingNavLink[] = [
    { id: "home", label: "Home", onClick: () => navigate({ page: "home" }), active: page === "home" },
    { id: "scraper", label: "Unified Scraper", onClick: () => navigate({ page: "scraper" }), active: page === "scraper" || page === "scraper-anime" || page === "scraper-watch" },
    { id: "features", label: "Features", onClick: () => navigate({ page: "features" }), active: page === "features" },
    { id: "contact", label: "Contact", onClick: () => navigate({ page: "contact" }), active: page === "contact" },
    { id: "watchnow", label: "Watch Now", onClick: () => navigate({ page: "watchnow" }), active: page === "watchnow" },
  ];

  // ── Anime page nav links (SUB/DUB removed from navbar — accessible in-page instead) ──
  const animeNavLinks: FloatingNavLink[] = [
    { id: "home", label: "Home", onClick: () => { navigate({ page: "dub" }); setSectionSubPage("home"); }, active: isAnimePage && sectionSubPage === "home" },
    { id: "browse", label: "Browse", onClick: () => { navigate({ page: "dub" }); setSectionSubPage("browse"); }, active: isAnimePage && sectionSubPage === "browse" },
    { id: "schedule", label: "Schedule", onClick: () => { navigate({ page: "dub" }); setSectionSubPage("schedule"); }, active: isAnimePage && sectionSubPage === "schedule" },
    { id: "genres", label: "Genres", onClick: () => { navigate({ page: "dub" }); setSectionSubPage("genres"); }, active: isAnimePage && (sectionSubPage === "genres" || page === "genre") },
  ];

  // ── Movies page nav links ──
  const movieNavLinks: FloatingNavLink[] = [
    { id: "home", label: "Home", onClick: () => navigate({ page: "movies" }), active: page === "movies" },
    { id: "trending", label: "Trending", onClick: () => { navigate({ page: "movies" }); setSectionSubPage("trending"); }, active: isMoviePage && sectionSubPage === "trending" },
    { id: "top-rated", label: "Top Rated", onClick: () => { navigate({ page: "movies" }); setSectionSubPage("top-rated"); }, active: isMoviePage && sectionSubPage === "top-rated" },
  ];

  // ── TV Shows page nav links ──
  const tvNavLinks: FloatingNavLink[] = [
    { id: "home", label: "Home", onClick: () => navigate({ page: "tv" }), active: page === "tv" },
    { id: "trending", label: "Trending", onClick: () => { navigate({ page: "tv" }); setSectionSubPage("trending"); }, active: isTVPage && sectionSubPage === "trending" },
    { id: "top-rated", label: "Top Rated", onClick: () => { navigate({ page: "tv" }); setSectionSubPage("top-rated"); }, active: isTVPage && sectionSubPage === "top-rated" },
  ];

  // ── Live page nav links ──
  const liveNavLinks: FloatingNavLink[] = [
    { id: "sports", label: "Live Sports", onClick: () => { navigate({ page: "live" }); setSectionSubPage("sports"); }, active: isLivePage && sectionSubPage === "sports" },
    { id: "tv-channels", label: "Live TV", onClick: () => { navigate({ page: "live" }); setSectionSubPage("tv-channels"); }, active: isLivePage && sectionSubPage === "tv-channels" },
    { id: "schedule", label: "Schedule", onClick: () => { navigate({ page: "live" }); setSectionSubPage("schedule"); }, active: isLivePage && sectionSubPage === "schedule" },
  ];

  // ── Manga page nav links ──
  const mangaNavLinks: FloatingNavLink[] = [
    { id: "home", label: "Home", onClick: () => navigate({ page: "manga" }), active: page === "manga" },
    { id: "browse", label: "Browse", onClick: () => { navigate({ page: "manga" }); setSectionSubPage("browse"); }, active: isMangaPage && sectionSubPage === "browse" },
  ];

  // ── Determine which nav set to show ──
  const getActiveNavLinks = (): FloatingNavLink[] => {
    if (isAnimePage) return animeNavLinks;
    if (isMoviePage) return movieNavLinks;
    if (isTVPage) return tvNavLinks;
    if (isLivePage) return liveNavLinks;
    if (isMangaPage) return mangaNavLinks;
    // Default: home nav
    return homeNavLinks;
  };

  // ── Section label shown as red brand text on left ──
  const getSectionLabel = (): string | null => {
    if (isAnimePage) return "ANIME";
    if (isMoviePage) return "MOVIES";
    if (isTVPage) return "TV SHOWS";
    if (isLivePage) return "LIVE";
    if (isMangaPage) return "MANGA";
    return null;
  };

  const activeNavLinks = getActiveNavLinks();
  const sectionLabel = getSectionLabel();

  // ── Pages where floating navbar should NOT appear ──
  const isWatchPage = page === "watch" || page === "movie-watch" || page === "tv-watch" || page === "live-watch" || page === "live-tv-watch";
  const isMangaReader = page === "manga-read" || page === "novel-read";
  const hideNavbar = isWatchPage || isMangaReader || page === "signin" || page === "signup";

  if (hideNavbar) return null;

  return (
    <>
      {/* ═══════════════════════════════════════════════════════════
          DESKTOP FLOATING NAVBAR — Screenshot Style (LunarAnime)
          Wide glassmorphism pill, floating over content
          Left: Logo → Section label → Nav links → Right: Search
          Long gaps between items, medium width
          ═══════════════════════════════════════════════════════════ */}
      <header className="hidden md:block fixed top-4 left-1/2 -translate-x-1/2 z-[100] w-auto" style={{ maxWidth: 'calc(100vw - 48px)' }}>
        <nav className={`per-page-floating-nav ${scrolled ? "scrolled" : ""}`}>
            {/* ── Left: Logo icon ── */}
            <button
              onClick={() => navigate({ page: "home" })}
              className="per-page-logo-btn"
            >
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#E63946] to-[#FF6B6B] flex items-center justify-center shadow-lg shadow-[#E63946]/20">
                <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="currentColor">
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
              </div>
            </button>

            {/* ── Section brand label (like "ANIME" in red) ── */}
            {sectionLabel && (
              <span className="per-page-nav-label">{sectionLabel}</span>
            )}

            {/* ── Nav links with long gaps ── */}
            {activeNavLinks.map(link => (
              <button
                key={link.id}
                onClick={link.onClick}
                className={`per-page-nav-link ${link.active ? "active" : ""}`}
              >
                {link.label}
              </button>
            ))}

            {/* ── Right: Search button ── */}
            <div className="flex items-center gap-2 ml-auto shrink-0">
              <button onClick={openSearch} className="per-page-search-btn" title="Search (⌘K)">
                <Search className="w-4 h-4" />
              </button>
            </div>
          </nav>
      </header>

      {/* ═══════════════════════════════════════════════════════════
          MOBILE TOP BAR + BOTTOM NAV
          ═══════════════════════════════════════════════════════════ */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-[100]">
        <div className="mobile-top-bar">
          {/* Section label or logo */}
          {sectionLabel ? (
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black text-[#E63946] tracking-widest uppercase">{sectionLabel}</span>
              <span className="text-xs font-bold text-white/50">/</span>
              {activeNavLinks.filter(l => l.active).map(l => (
                <span key={l.id} className="text-xs font-bold text-white">{l.label}</span>
              ))}
            </div>
          ) : (
            <button onClick={() => navigate({ page: "home" })} className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-md bg-gradient-to-br from-[#E63946] to-[#FF6B6B] flex items-center justify-center">
                <svg className="w-3.5 h-3.5 text-white" viewBox="0 0 24 24" fill="currentColor">
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
              </div>
              <span className="text-sm font-extrabold text-white tracking-tight">
                Luffy<span className="text-[#E63946]">TV</span>
              </span>
            </button>
          )}
          <div className="flex items-center gap-2">
            <button onClick={openSearch} className="p-2 text-white/40 hover:text-white transition-colors">
              <Search className="w-5 h-5" />
            </button>
            <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="p-2 text-white/40 hover:text-white transition-colors">
              <Menu className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Mobile bottom nav */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-[100]">
        <div className="mobile-bottom-nav">
          {[
            { id: "home", label: "Home", icon: Home },
            { id: "anime", label: "Anime", icon: Play },
            { id: "movies", label: "Movies", icon: Film },
            { id: "live", label: "Live", icon: Monitor },
            { id: "search", label: "Search", icon: Search },
          ].map(item => {
            const Icon = item.icon;
            const active = item.id === "home" && page === "home"
              || item.id === "anime" && isAnimePage
              || item.id === "movies" && isMoviePage
              || item.id === "live" && isLivePage
              || item.id === "search" && page === "search";
            return (
              <button
                key={item.id}
                onClick={() => {
                  if (item.id === "search") openSearch();
                  else if (item.id === "home") navigate({ page: "home" });
                  else if (item.id === "anime") { navigate({ page: "dub" }); setSectionSubPage("home"); }
                  else if (item.id === "movies") navigate({ page: "movies" });
                  else if (item.id === "live") navigate({ page: "live" });
                }}
                className="mobile-bottom-nav-item"
              >
                <Icon className={`w-5 h-5 ${active ? "text-[#E63946]" : "text-white/30"}`} />
                <span className={`text-[9px] font-bold ${active ? "text-[#E63946]" : "text-white/30"}`}>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════
          MOBILE MENU OVERLAY
          ═══════════════════════════════════════════════════════════ */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-[200] bg-[#000000]/98 backdrop-blur-2xl fade-in">
          <div className="flex items-center justify-between p-4 border-b border-white/[0.06]">
            <span className="text-sm font-extrabold text-white">Luffy<span className="text-[#E63946]">TV</span></span>
            <button onClick={() => setMobileMenuOpen(false)} className="p-2 text-white/40 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="p-4 space-y-1">
            {/* Section-specific links */}
            {activeNavLinks.map(link => (
              <button
                key={link.id}
                onClick={() => { link.onClick(); setMobileMenuOpen(false); }}
                className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-xl text-sm font-bold transition-all ${
                  link.active ? "text-white bg-[#E63946]/10 border border-[#E63946]/15" : "text-white/50 hover:text-white hover:bg-white/[0.04]"
                }`}
              >
                {link.label}
              </button>
            ))}
            <div className="h-px bg-white/[0.06] my-2" />
            {/* Global links */}
            {[
              { id: "home", label: "Home", icon: Home, page: "home" as const },
              { id: "anime", label: "Anime", icon: Play, page: "dub" as const },
              { id: "movies", label: "Movies", icon: Film, page: "movies" as const },
              { id: "tv", label: "TV Shows", icon: Tv, page: "tv" as const },
              { id: "live", label: "Live", icon: Monitor, page: "live" as const },
              { id: "manga", label: "Manga", icon: BookOpen, page: "manga" as const },
              { id: "contact", label: "Contact", icon: Phone, page: "contact" as const },
            ].map(link => {
              const Icon = link.icon;
              return (
                <button
                  key={link.id}
                  onClick={() => { navigate({ page: link.page }); setMobileMenuOpen(false); }}
                  className="w-full flex items-center gap-4 px-4 py-3.5 rounded-xl text-sm font-bold text-white/50 hover:text-white hover:bg-white/[0.04] transition-all"
                >
                  <Icon className="w-4 h-4" />
                  {link.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════
          SEARCH MODAL
          ═══════════════════════════════════════════════════════════ */}
      {searchOpen && (
        <div className="fixed inset-0 z-[300] flex items-start justify-center pt-[12vh]" onClick={() => { setSearchOpen(false); setQuickResults([]); }}>
          <div className="absolute inset-0 bg-[#000000]/80 backdrop-blur-sm" />
          <div
            className="relative w-full max-w-lg mx-4 bg-[#0D0D0D]/98 rounded-2xl overflow-hidden shadow-2xl shadow-black/60 border border-[#E63946]/10"
            onClick={e => e.stopPropagation()}
          >
            {/* Search input */}
            <form onSubmit={handleSearch} className="flex items-center gap-3 p-4 border-b border-white/[0.04]">
              <Search className="w-5 h-5 text-[#E63946] shrink-0" />
              <input
                ref={searchInputRef}
                autoFocus
                value={searchQuery}
                onChange={e => handleSearchInputChange(e.target.value)}
                placeholder="Search anime, movies, TV shows..."
                className="flex-1 bg-transparent text-white placeholder-white/20 text-sm outline-none"
              />
              {quickLoading && (
                <svg className="w-4 h-4 text-[#E63946] animate-spin shrink-0" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              )}
              {searchQuery && !quickLoading && (
                <button type="button" onClick={() => { setSearchQuery(""); setQuickResults([]); searchInputRef.current?.focus(); }} className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-white/25 hover:text-white/60 hover:bg-white/[0.08] transition-colors">
                  <X className="w-3 h-3" />
                </button>
              )}
              <button type="button" onClick={() => { setSearchOpen(false); setQuickResults([]); }} className="text-[9px] text-white/20 bg-white/[0.06] px-2 py-1 rounded-md border border-white/[0.06] hover:bg-white/[0.1] transition-colors">ESC</button>
            </form>

            {/* Live results */}
            {quickResults.length > 0 && (
              <div className="max-h-[380px] overflow-y-auto">
                {quickResults.map(result => (
                  <button
                    key={result.id}
                    onClick={() => handleQuickResultClick(result)}
                    className="w-full flex items-center gap-3 p-3 hover:bg-white/[0.04] transition-colors text-left border-b border-white/[0.02] last:border-b-0"
                  >
                    <div className="w-10 h-14 rounded-md overflow-hidden bg-[#0a0a0a] shrink-0 border border-white/[0.06]">
                      {result.image ? (
                        <img src={result.image} alt={result.title} className="w-full h-full object-cover" loading="lazy" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <svg className="w-4 h-4 text-white/10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
                          </svg>
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-xs font-semibold text-white line-clamp-1">{result.title}</h4>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {result.format && (
                          <span className="text-[9px] font-bold text-white/40 bg-white/[0.05] px-1.5 py-0.5 rounded-full">
                            {result.format === "TV_SHORT" ? "TV Short" : result.format}
                          </span>
                        )}
                        {result.seasonYear && <span className="text-[9px] text-white/30">{result.seasonYear}</span>}
                        {result.episodes != null && result.episodes > 0 && <span className="text-[9px] text-white/30">{result.episodes} eps</span>}
                        {result.averageScore != null && result.averageScore > 0 && <span className="text-[9px] text-[#FFD700] font-bold">{result.averageScore}%</span>}
                      </div>
                    </div>
                    <svg className="w-4 h-4 text-white/15 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                ))}
                <button
                  onClick={handleSearch}
                  className="w-full flex items-center justify-center gap-2 p-3 hover:bg-white/[0.04] transition-colors border-t border-white/[0.04]"
                >
                  <Search className="w-3.5 h-3.5 text-[#E63946]" />
                  <span className="text-xs text-[#E63946] font-medium">View all results for &quot;{searchQuery}&quot;</span>
                </button>
              </div>
            )}

            {searchQuery && quickResults.length === 0 && !quickLoading && searchQuery.length >= 2 && (
              <div className="p-6 text-center">
                <p className="text-xs text-white/25">No quick results. Press Enter for full search.</p>
              </div>
            )}

            {!searchQuery && (
              <div className="p-5 space-y-3">
                <div className="flex items-center gap-2 text-white/15">
                  <kbd className="text-[9px] bg-white/[0.04] px-1.5 py-0.5 rounded border border-white/[0.06]">⌘K</kbd>
                  <span className="text-[10px]">Quick search</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
