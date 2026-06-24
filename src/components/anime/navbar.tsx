"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useAppStore } from "./store";
import { Search, Menu, X } from "lucide-react";

interface QuickResult {
  id: number;
  title: string;
  image: string;
  format?: string;
  episodes?: number;
  seasonYear?: number;
  averageScore?: number;
}

export default function Navbar() {
  const { route, navigate } = useAppStore();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<QuickResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSearchResults(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Real-time search with debounce
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    const q = searchQuery.trim();
    if (q.length < 2) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }
    setSearchLoading(true);
    setShowSearchResults(true);
    searchTimerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/anime/search?q=${encodeURIComponent(q)}&page=1`);
        if (res.ok) {
          const data = await res.json();
          const results = (data?.results || data?.media || []).slice(0, 6).map((item: any) => ({
            id: item.id,
            title: item.title?.english || item.title?.romaji || "Unknown",
            image: item.coverImage?.medium || item.coverImage?.large || "",
            format: item.format,
            episodes: item.episodes,
            seasonYear: item.seasonYear,
            averageScore: item.averageScore,
          }));
          setSearchResults(results);
        }
      } catch {
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 400);
    return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current); };
  }, [searchQuery]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = searchQuery.trim();
    if (trimmed) {
      navigate({ page: "search", query: trimmed });
      setSearchQuery("");
      setShowSearchResults(false);
      setMobileOpen(false);
    }
  };

  const handleResultClick = (id: number) => {
    navigate({ page: "anime", id: String(id) });
    setSearchQuery("");
    setShowSearchResults(false);
    setMobileOpen(false);
  };

  useEffect(() => {
    const handleResize = () => { if (window.innerWidth > 768) setMobileOpen(false); };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Keyboard shortcut: Ctrl+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "s")) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const page = route.page;
  const isWatchPage = ["watch", "movie-watch", "tv-watch", "live-watch", "live-tv-watch"].includes(page);
  const isMangaReader = page === "manga-read" || page === "novel-read";
  if (isWatchPage || isMangaReader || page === "signin" || page === "signup") return null;

  const navItems = [
    { label: "Home", page: "home" as const, active: page === "home" },
    { label: "Browse", page: "dub" as const, active: page === "dub" || page === "anime" || page === "browse" || page === "genre" || page === "bookmarks" || page === "history" },
    { label: "Schedule", page: "dub" as const, active: false },
    { label: "Movies", page: "movies" as const, active: page === "movies" || page === "movie-detail" || page === "movie-watch" },
    { label: "TV", page: "tv" as const, active: page === "tv" || page === "tv-detail" || page === "tv-watch" },
    { label: "Live", page: "live" as const, active: page === "live" || page === "live-watch" },
    { label: "Manga", page: "manga" as const, active: page === "manga" || page === "manga-detail" || page === "manga-read" },
  ];

  const handleNavClick = (item: typeof navItems[0]) => {
    if (item.label === "Schedule") {
      navigate({ page: "dub" });
    } else {
      navigate({ page: item.page });
    }
    setMobileOpen(false);
  };

  return (
    <>
      <header className={`nav-header-container${scrolled ? " scrolled" : ""}`}>
        {/* Left: Logo + Nav Links */}
        <nav className="navbar-capsule">
          <button className="nav-logo" onClick={() => navigate({ page: "home" })}>
            <span className="nav-logo-text">LuffyTV</span>
          </button>

          <div className="nav-links">
            {navItems.map((item) => (
              <button
                key={item.label}
                className={`nav-link${item.active ? " active" : ""}`}
                onClick={() => handleNavClick(item)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </nav>

        {/* Right: Search + Mobile Toggle */}
        <div className="nav-header-actions">
          {/* Inline Search Bar */}
          <div className="nav-search-wrapper" ref={searchRef}>
            <form className="nav-search" onSubmit={handleSearchSubmit}>
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search anime..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => { if (searchQuery.trim().length >= 2) setShowSearchResults(true); }}
              />
              <Search size={16} className="nav-search-icon" />
            </form>

            {/* Search Dropdown */}
            {showSearchResults && (
              <div className="nav-search-dropdown">
                {searchLoading ? (
                  <div className="nav-search-loading">
                    <div className="w-5 h-5 border-2 border-white/10 border-t-[#E4A85D] rounded-full animate-spin" />
                    <span>Searching...</span>
                  </div>
                ) : searchResults.length > 0 ? (
                  <>
                    {searchResults.map((item) => (
                      <button
                        key={item.id}
                        className="nav-search-result"
                        onClick={() => handleResultClick(item.id)}
                      >
                        <img
                          src={item.image || ""}
                          alt={item.title}
                          className="nav-search-result-img"
                          loading="lazy"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                        />
                        <div className="nav-search-result-info">
                          <span className="nav-search-result-title">{item.title}</span>
                          <span className="nav-search-result-meta">
                            {item.format && item.format !== "TV_SHORT" ? item.format : "TV"}
                            {item.episodes ? ` • ${item.episodes} eps` : ""}
                            {item.seasonYear ? ` • ${item.seasonYear}` : ""}
                            {item.averageScore ? ` • ★ ${item.averageScore}%` : ""}
                          </span>
                        </div>
                      </button>
                    ))}
                    <button
                      type="button"
                      className="nav-search-view-all"
                      onClick={handleSearchSubmit}
                    >
                      View all results for &ldquo;{searchQuery}&rdquo;
                    </button>
                  </>
                ) : (
                  <div className="nav-search-no-results">No results found</div>
                )}
              </div>
            )}
          </div>

          {/* Mobile Toggle */}
          <button
            className="nav-mobile-toggle"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </header>

      {/* Mobile Menu */}
      <div className={`nav-menu-mobile${mobileOpen ? " open" : ""}`}>
        {navItems.map((item) => (
          <button
            key={item.label}
            className={`nav-link${item.active ? " active" : ""}`}
            onClick={() => handleNavClick(item)}
          >
            {item.label}
          </button>
        ))}
        <form className="nav-search" onSubmit={handleSearchSubmit} style={{ marginTop: 8 }}>
          <input
            type="text"
            placeholder="Search anime..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <Search size={16} className="nav-search-icon" />
        </form>
      </div>
    </>
  );
}
