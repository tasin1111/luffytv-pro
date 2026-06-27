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
  const { route, navigate, sectionSubPage, setSectionSubPage } = useAppStore();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<QuickResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
  const doSearch = useCallback(async (q: string) => {
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
  }, []);

  const queryRef = useRef("");
  useEffect(() => {
    queryRef.current = searchQuery;
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    const q = searchQuery.trim();
    if (q.length < 2) {
      setSearchResults([]);
      setShowSearchResults(false);
      setSearchLoading(false);
      return;
    }
    setSearchLoading(true);
    setShowSearchResults(true);
    searchTimerRef.current = setTimeout(() => doSearch(q), 500);
    return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current); };
  }, [searchQuery, doSearch]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = searchQuery.trim();
    if (trimmed) {
      navigate({ page: "search", query: trimmed });
      setSearchQuery("");
      setShowSearchResults(false);
      setShowSearchModal(false);
      setMobileOpen(false);
    }
  };

  const handleResultClick = (id: number) => {
    navigate({ page: "anime", id: String(id) });
    setSearchQuery("");
    setShowSearchResults(false);
    setShowSearchModal(false);
    setMobileOpen(false);
  };

  // Keyboard shortcut: Ctrl+K or /
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "s")) {
        e.preventDefault();
        setShowSearchModal(true);
        setTimeout(() => searchInputRef.current?.focus(), 100);
      }
      // Slash key (when not typing in an input)
      if (e.key === "/" && !showSearchModal) {
        const target = e.target as HTMLElement;
        if (target.tagName !== "INPUT" && target.tagName !== "TEXTAREA") {
          e.preventDefault();
          setShowSearchModal(true);
          setTimeout(() => searchInputRef.current?.focus(), 100);
        }
      }
      if (e.key === "Escape") {
        setShowSearchModal(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [showSearchModal]);

  useEffect(() => {
    const handleResize = () => { if (window.innerWidth > 768) setMobileOpen(false); };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const page = route.page;
  const isWatchPage = ["watch", "movie-watch", "tv-watch", "live-watch", "live-tv-watch"].includes(page);
  const isMangaReader = page === "manga-read" || page === "novel-read";
  if (isWatchPage || isMangaReader || page === "signin" || page === "signup") return null;

  // Only nav items: Home, Browse, Schedule, Music, Torrent
  const isAnimePage = ["dub", "anime", "watch", "genre", "bookmarks", "history"].includes(page);
  const navItems = [
    { label: "Home", active: isAnimePage && sectionSubPage === "home" },
    { label: "Browse", active: isAnimePage && (sectionSubPage === "browse" || sectionSubPage === "genres") },
    { label: "Schedule", active: isAnimePage && sectionSubPage === "schedule" },
    { label: "Music", active: page === "music" },
    { label: "Torrent", active: page === "torrent" },
  ];

  const handleNavClick = (label: string) => {
    if (label === "Home") {
      navigate({ page: "dub" });
      setSectionSubPage("home");
    } else if (label === "Browse") {
      navigate({ page: "dub" });
      setSectionSubPage("browse");
    } else if (label === "Schedule") {
      navigate({ page: "dub" });
      setSectionSubPage("schedule");
    } else if (label === "Music") {
      navigate({ page: "music" });
    } else if (label === "Torrent") {
      navigate({ page: "torrent" });
    }
    setMobileOpen(false);
  };

  return (
    <>
      {/* ═══ LOGO — standalone, far left, italic white text ═══ */}
      <button
        className="ltv-nav-logo"
        onClick={() => { navigate({ page: "dub" }); setSectionSubPage("home"); }}
        aria-label="LuffyTV Home"
      >
        LuffyTV
      </button>

      {/* ═══ NAVBAR PILL — center, glassmorphism, contains links + divider + search ═══ */}
      <nav className={`ltv-nav-pill${scrolled ? " scrolled" : ""}`}>
        {/* Nav Links */}
        <div className="ltv-nav-links">
          {navItems.map((item) => (
            <button
              key={item.label}
              className={`ltv-nav-link${item.active ? " active" : ""}`}
              onClick={() => handleNavClick(item.label)}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Divider */}
        <span className="ltv-nav-divider" />

        {/* Search Button (opens modal) */}
        <button
          className="ltv-nav-search-btn"
          onClick={() => { setShowSearchModal(true); setTimeout(() => searchInputRef.current?.focus(), 100); }}
        >
          <Search size={15} strokeWidth={2} />
          <span>Search</span>
          <kbd className="ltv-slash-badge">/</kbd>
        </button>
      </nav>

      {/* ═══ RIGHT ICONS — separate pill, far right ═══ */}
      <div className={`ltv-nav-right-icons${scrolled ? " scrolled" : ""}`}>
        {/* Discord */}
        <a
          href="https://discord.gg/Svc9yFjQBq"
          target="_blank"
          rel="noopener noreferrer"
          className="ltv-nav-icon-btn ltv-nav-discord"
          title="Discord"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
            <path d="M20.317 4.37a19.791 19.791 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 00.031.057 19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 00-.041-.106 13.107 13.107 0 01-1.872-.892.077.077 0 01-.008-.128 10.2 10.2 0 00.372-.292.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127 12.299 12.299 0 01-1.873.892.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.839 19.839 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.03z"/>
          </svg>
        </a>

        {/* Bookmarks */}
        <button
          className="ltv-nav-icon-btn"
          title="Bookmarks"
          onClick={() => navigate({ page: "bookmarks" })}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
            <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" />
          </svg>
        </button>

        {/* History */}
        <button
          className="ltv-nav-icon-btn"
          title="History"
          onClick={() => navigate({ page: "history" })}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
        </button>

        {/* Mobile Toggle */}
        <button
          className="ltv-nav-icon-btn ltv-nav-mobile-toggle"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X size={18} /> : <Menu size={18} />}
        </button>
      </div>

      {/* ═══ SEARCH MODAL — opens on / or Ctrl+K ═══ */}
      {showSearchModal && (
        <div
          className="ltv-search-modal-overlay"
          onClick={() => setShowSearchModal(false)}
        >
          <div
            className="ltv-search-modal"
            onClick={(e) => e.stopPropagation()}
            ref={searchRef}
          >
            <form onSubmit={handleSearchSubmit} className="ltv-search-modal-input-row">
              <Search size={20} className="ltv-search-modal-icon" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search anime..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => { if (searchQuery.trim().length >= 2) setShowSearchResults(true); }}
                className="ltv-search-modal-input"
                autoFocus
              />
              <kbd className="ltv-slash-badge">ESC</kbd>
            </form>

            {/* Search Dropdown */}
            {showSearchResults && (
              <div className="ltv-search-modal-results">
                {searchLoading ? (
                  <div className="ltv-search-modal-loading">
                    <div className="w-5 h-5 border-2 border-white/10 border-t-white rounded-full animate-spin" />
                    <span>Searching...</span>
                  </div>
                ) : searchResults.length > 0 ? (
                  <>
                    {searchResults.map((item) => (
                      <button
                        key={item.id}
                        className="ltv-search-modal-result"
                        onClick={() => handleResultClick(item.id)}
                      >
                        <img
                          src={item.image || ""}
                          alt={item.title}
                          className="ltv-search-modal-result-img"
                          loading="lazy"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                        />
                        <div className="ltv-search-modal-result-info">
                          <span className="ltv-search-modal-result-title">{item.title}</span>
                          <span className="ltv-search-modal-result-meta">
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
                      className="ltv-search-modal-view-all"
                      onClick={handleSearchSubmit as any}
                    >
                      View all results for &ldquo;{searchQuery}&rdquo;
                    </button>
                  </>
                ) : (
                  <div className="ltv-search-modal-no-results">No results found</div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══ MOBILE MENU ═══ */}
      {mobileOpen && (
        <div className="ltv-nav-menu-mobile">
          {navItems.map((item) => (
            <button
              key={item.label}
              className={`ltv-nav-link${item.active ? " active" : ""}`}
              onClick={() => handleNavClick(item.label)}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </>
  );
}
