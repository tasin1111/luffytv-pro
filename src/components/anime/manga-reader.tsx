"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useAppStore } from "./store";

/* ═══════════════════════════════════════════════════════════════════════
   MANGA READER v3 — LuffyTV Full Structural Redesign
   Inspired by: Atsu.moe (snap scroll, progress bar, immersive),
   Comix.to (clean layout, page counter), MangaFire (toolbar, sidebar)

   ARCHITECTURE:
   ┌─────────────────────────────────────────────────┐
   │  TOP TOOLBAR (floating, glassmorphic, auto-hide) │
   │  [← Back] [Title]  [V|S|D]  [Ch][⚙][⛶]       │
   │  ═══════════ progress bar ═══════════════════    │
   ├─────────────────────────────────────────────────┤
   │                                                   │
   │           READER AREA (black bg)                  │
   │     Vertical / Single (snap) / Double             │
   │                                                   │
   ├─────────────────────────────────────────────────┤
   │  BOTTOM NAV (floating, glassmorphic, auto-hide)  │
   │  [← Prev]  ──●──── 12 / 58  [Next →]           │
   └─────────────────────────────────────────────────┘

   + Settings Panel (slide-down from toolbar)
   + Chapter Sidebar (slide-in from right)
   ═══════════════════════════════════════════════════════════════════════ */

interface ChapterPage {
  index: number;
  url: string;
  proxiedUrl?: string;
  width?: number;
  height?: number;
}

interface MangaReaderProps {
  mangaId: string;
  chapterId: string;
}

type ReadingMode = "vertical" | "single" | "double";
type ImageFit = "width" | "height" | "original";
type ReadingDirection = "ltr" | "rtl";

export default function MangaReader({ mangaId, chapterId }: MangaReaderProps) {
  const navigate = useAppStore(s => s.navigate);

  // ── Data State ──
  const [pages, setPages] = useState<ChapterPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mangaTitle, setMangaTitle] = useState("");
  const [chapterTitle, setChapterTitle] = useState("");
  const [allChapters, setAllChapters] = useState<any[]>([]);

  // ── UI State ──
  const [showControls, setShowControls] = useState(true);
  const [currentPage, setCurrentPage] = useState(0);
  const [readingMode, setReadingMode] = useState<ReadingMode>("vertical");
  const [imageFit, setImageFit] = useState<ImageFit>("width");
  const [showSettings, setShowSettings] = useState(false);
  const [showChapterSidebar, setShowChapterSidebar] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [readingDir, setReadingDir] = useState<ReadingDirection>("ltr");
  const [hoveredPageIndex, setHoveredPageIndex] = useState<number | null>(null);

  // ── Refs ──
  const containerRef = useRef<HTMLDivElement>(null);
  const snapContainerRef = useRef<HTMLDivElement>(null);
  const hideTimerRef = useRef<NodeJS.Timeout | null>(null);
  const readerRootRef = useRef<HTMLDivElement>(null);

  // ── Load chapter pages ──
  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      setCurrentPage(0);
      try {
        const [pagesRes, detailRes] = await Promise.all([
          fetch(`/api/manga/read?mangaId=${encodeURIComponent(mangaId)}&chapterId=${encodeURIComponent(chapterId)}`),
          fetch(`/api/manga/detail?id=${encodeURIComponent(mangaId)}`),
        ]);
        if (pagesRes.ok) {
          const data = await pagesRes.json();
          if (data.pages?.length > 0) {
            setPages(data.pages);
          } else {
            setError("No pages available for this chapter.");
          }
        } else {
          setError("Failed to load chapter pages.");
        }
        if (detailRes.ok) {
          const detail = await detailRes.json();
          setMangaTitle(detail.englishTitle || detail.title || "");
          const chs = detail.chapters || [];
          setAllChapters(chs);
          // The store now passes the chapter NUMBER as chapterId (string),
          // because the new atsumaru scraper API uses chapterNumber.
          const ch = chs.find((c: any) => String(c.number) === String(chapterId));
          setChapterTitle(ch?.title || `Chapter ${ch?.number || chapterId}`);
        }
      } catch {
        setError("Failed to load chapter.");
      }
      setLoading(false);
    }
    load();
  }, [mangaId, chapterId]);

  // ── Find prev/next chapters ──
  // Compare by chapter number (as string) since the store route now passes
  // the chapter number as chapterId (string).
  // Also filter by language (stored in sessionStorage by the detail page)
  // so prev/next navigation stays within the same language.
  const readerLang = useMemo(() => {
    try {
      return sessionStorage.getItem(`manga-lang-${mangaId}`) || "all";
    } catch { return "all"; }
  }, [mangaId]);

  // Filter chapters by language for navigation
  const langFilteredChapters = useMemo(() => {
    if (readerLang === "all") return allChapters;
    // When a specific language is selected, only show chapters in that
    // language. Chapters without a lang field (atsumaru) are always included.
    return allChapters.filter((c: any) => c.lang === readerLang || !c.lang);
  }, [allChapters, readerLang]);

  // Find the current chapter in the FILTERED list.
  // This ensures prev/next stays within the same language.
  const currentChapterIdx = langFilteredChapters.findIndex((c: any) => String(c.number) === String(chapterId));
  const prevChapter = currentChapterIdx > 0 ? langFilteredChapters[currentChapterIdx - 1] : null;
  const nextChapter = currentChapterIdx < langFilteredChapters.length - 1 ? langFilteredChapters[currentChapterIdx + 1] : null;

  // ── Auto-hide controls after 3s of inactivity ──
  const resetHideTimer = useCallback(() => {
    setShowControls(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => {
      setShowControls(false);
    }, 3000);
  }, []);

  useEffect(() => {
    const show = () => {
      setShowControls(true);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      hideTimerRef.current = setTimeout(() => {
        setShowControls(false);
      }, 3000);
    };
    window.addEventListener("mousemove", show);
    window.addEventListener("touchstart", show);
    // Start the initial timer
    hideTimerRef.current = setTimeout(() => {
      setShowControls(false);
    }, 5000);
    return () => {
      window.removeEventListener("mousemove", show);
      window.removeEventListener("touchstart", show);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, []);

  // ── Toggle controls on click/tap in reader area ──
  const handleReaderClick = useCallback(() => {
    setShowControls(prev => {
      if (!prev) {
        resetHideTimer();
        return true;
      }
      return prev;
    });
    resetHideTimer();
  }, [resetHideTimer]);

  // ── Track scroll position for page counter (vertical mode) ──
  const handleScroll = useCallback(() => {
    if (!containerRef.current || readingMode !== "vertical") return;
    const container = containerRef.current;
    const scrollPos = container.scrollTop + container.clientHeight / 2;
    const images = container.querySelectorAll(".mr-page-img");
    for (let i = 0; i < images.length; i++) {
      const img = images[i] as HTMLElement;
      if (img.offsetTop <= scrollPos && img.offsetTop + img.clientHeight > scrollPos) {
        setCurrentPage(i);
        break;
      }
    }
  }, [readingMode]);

  // ── Track snap scroll position for single/double mode ──
  const handleSnapScroll = useCallback(() => {
    if (!snapContainerRef.current) return;
    const container = snapContainerRef.current;
    const scrollLeft = container.scrollLeft;
    const pageWidth = container.clientWidth;
    const page = Math.round(scrollLeft / pageWidth);
    setCurrentPage(readingDir === "rtl" ? pages.length - 1 - page : page);
  }, [readingDir, pages.length]);

  // ── Page navigation functions ──
  const goToNextPage = useCallback(() => {
    if (readingMode === "double") {
      setCurrentPage(prev => Math.min(prev + 2, pages.length - 1));
    } else {
      setCurrentPage(prev => Math.min(prev + 1, pages.length - 1));
    }
  }, [readingMode, pages.length]);

  const goToPrevPage = useCallback(() => {
    if (readingMode === "double") {
      setCurrentPage(prev => Math.max(prev - 2, 0));
    } else {
      setCurrentPage(prev => Math.max(prev - 1, 0));
    }
  }, [readingMode]);

  const goToPage = useCallback((page: number) => {
    setCurrentPage(Math.max(0, Math.min(page, pages.length - 1)));
  }, [pages.length]);

  // ── Sync currentPage to snap scroll position (single/double) ──
  useEffect(() => {
    if (readingMode === "vertical" || !snapContainerRef.current) return;
    const container = snapContainerRef.current;
    const targetPage = readingDir === "rtl" ? pages.length - 1 - currentPage : currentPage;
    container.scrollTo({
      left: targetPage * container.clientWidth,
      behavior: "smooth",
    });
  }, [currentPage, readingMode, readingDir, pages.length]);

  // ── Fullscreen toggle ──
  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  }, []);

  // ── Keyboard shortcuts ──
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      // Don't capture if typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (readingMode === "vertical") {
        if (e.key === "ArrowDown" || e.key === "ArrowRight") {
          e.preventDefault();
          containerRef.current?.scrollBy({ top: 300, behavior: "smooth" });
        } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
          e.preventDefault();
          containerRef.current?.scrollBy({ top: -300, behavior: "smooth" });
        }
      } else {
        const forward = readingDir === "ltr"
          ? (e.key === "ArrowRight" || e.key === "ArrowDown" || e.key === " ")
          : (e.key === "ArrowLeft" || e.key === "ArrowDown" || e.key === " ");
        const backward = readingDir === "ltr"
          ? (e.key === "ArrowLeft" || e.key === "ArrowUp")
          : (e.key === "ArrowRight" || e.key === "ArrowUp");

        if (forward) {
          e.preventDefault();
          goToNextPage();
        } else if (backward) {
          e.preventDefault();
          goToPrevPage();
        }
      }
      if (e.key === "Escape") {
        navigate({ page: "manga-detail", id: mangaId });
      }
      if (e.key === "c" || e.key === "C") {
        setShowChapterSidebar(prev => !prev);
      }
      if (e.key === "s" || e.key === "S") {
        setShowSettings(prev => !prev);
      }
      if (e.key === "f" || e.key === "F") {
        toggleFullscreen();
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [readingMode, currentPage, pages.length, mangaId, readingDir, goToNextPage, goToPrevPage, toggleFullscreen]);

  // ── Listen for fullscreen change events ──
  useEffect(() => {
    function onFsChange() {
      setIsFullscreen(!!document.fullscreenElement);
    }
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  // ── Progress ──
  const progress = pages.length > 0 ? ((currentPage + 1) / pages.length) * 100 : 0;

  // ── Double page display logic ──
  const doublePages = readingDir === "rtl"
    ? [pages[currentPage + 1], pages[currentPage]].filter(Boolean)
    : [pages[currentPage], pages[currentPage + 1]].filter(Boolean);

  // ═══════════════════════════════════════════
  //  LOADING STATE
  // ═══════════════════════════════════════════
  if (loading) {
    return (
      <div className="mr-loading-screen">
        <div className="mr-loader-ring">
          <div /><div />
        </div>
        <p className="mr-loader-text">Loading chapter...</p>
      </div>
    );
  }

  // ═══════════════════════════════════════════
  //  ERROR STATE
  // ═══════════════════════════════════════════
  if (error) {
    return (
      <div className="mr-loading-screen">
        <svg className="mr-error-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <p className="mr-error-text">{error}</p>
        <button
          onClick={() => navigate({ page: "manga-detail", id: mangaId })}
          className="mr-error-btn"
        >
          Back to Manga
        </button>
      </div>
    );
  }

  // ═══════════════════════════════════════════
  //  MAIN READER
  // ═══════════════════════════════════════════
  return (
    <div ref={readerRootRef} className="mr-reader-root">
      {/* ══════════════════════════════════════════
          TOP TOOLBAR (floating, glassmorphic)
          ══════════════════════════════════════════ */}
      <div className={`mr-toolbar ${showControls || showSettings ? "mr-visible" : "mr-hidden"}`}>
        <div className="mr-toolbar-glass">
          <div className="mr-toolbar-row">
            {/* Left: Back + Title */}
            <div className="mr-toolbar-left">
              <button
                onClick={() => navigate({ page: "manga-detail", id: mangaId })}
                className="mr-toolbar-btn"
                title="Back to manga (Esc)"
                aria-label="Back to manga detail"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div className="mr-toolbar-title">
                <p className="mr-toolbar-manga">{mangaTitle}</p>
                <p className="mr-toolbar-chapter">{chapterTitle}</p>
              </div>
            </div>

            {/* Center: Mode switcher */}
            <div className="mr-mode-switcher">
              {([
                { mode: "vertical" as ReadingMode, label: "Vertical", icon: (
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path d="M12 4v16M8 4v16M16 4v16" />
                  </svg>
                )},
                { mode: "single" as ReadingMode, label: "Single", icon: (
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <rect x="5" y="2" width="14" height="20" rx="2" />
                  </svg>
                )},
                { mode: "double" as ReadingMode, label: "Double", icon: (
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <rect x="2" y="3" width="9" height="18" rx="1" />
                    <rect x="13" y="3" width="9" height="18" rx="1" />
                  </svg>
                )},
              ]).map(({ mode, label, icon }) => (
                <button
                  key={mode}
                  onClick={() => { setReadingMode(mode); setCurrentPage(0); }}
                  className={`mr-mode-btn ${readingMode === mode ? "active" : ""}`}
                  title={`${label} mode`}
                  aria-label={`${label} reading mode`}
                >
                  {icon}
                  <span className="mr-mode-label">{label}</span>
                </button>
              ))}
            </div>

            {/* Right: Controls */}
            <div className="mr-toolbar-right">
              <button
                onClick={() => { setShowChapterSidebar(!showChapterSidebar); setShowSettings(false); }}
                className={`mr-toolbar-btn ${showChapterSidebar ? "active" : ""}`}
                title="Chapters (C)"
                aria-label="Toggle chapter sidebar"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
                  <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
                </svg>
              </button>
              <button
                onClick={() => { setShowSettings(!showSettings); setShowChapterSidebar(false); }}
                className={`mr-toolbar-btn ${showSettings ? "active" : ""}`}
                title="Settings (S)"
                aria-label="Toggle settings"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path d="M12 15a3 3 0 100-6 3 3 0 000 6z" />
                  <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
                </svg>
              </button>
              <button
                onClick={toggleFullscreen}
                className={`mr-toolbar-btn ${isFullscreen ? "active" : ""}`}
                title="Fullscreen (F)"
                aria-label="Toggle fullscreen"
              >
                {isFullscreen ? (
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path d="M9 9L4 4m0 0v4m0-4h4m7 5l5-5m0 0v4m0-4h-4M9 15l-5 5m0 0v-4m0 4h4m7-5l5 5m0 0v-4m0 4h-4" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path d="M4 8V4h4M20 8V4h-4M4 16v4h4M20 16v4h-4" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mr-progress-bar">
            <div className="mr-progress-fill" style={{ width: `${progress}%` }} />
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════
          SETTINGS PANEL (slide-down from toolbar)
          ══════════════════════════════════════════ */}
      <div className={`mr-settings-panel ${showSettings ? "mr-settings-open" : ""}`}>
        <div className="mr-settings-glass">
          <div className="mr-settings-inner">
            {/* Image Fit */}
            <div className="mr-settings-row">
              <span className="mr-settings-label">Image Fit</span>
              <div className="mr-settings-options">
                {([
                  { id: "width" as ImageFit, label: "Fit Width" },
                  { id: "height" as ImageFit, label: "Fit Height" },
                  { id: "original" as ImageFit, label: "Original" },
                ]).map(opt => (
                  <button
                    key={opt.id}
                    onClick={() => setImageFit(opt.id)}
                    className={`mr-settings-opt ${imageFit === opt.id ? "active" : ""}`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Reading Direction */}
            <div className="mr-settings-row">
              <span className="mr-settings-label">Direction</span>
              <div className="mr-settings-options">
                {([
                  { id: "ltr" as ReadingDirection, label: "← LTR" },
                  { id: "rtl" as ReadingDirection, label: "RTL →" },
                ]).map(opt => (
                  <button
                    key={opt.id}
                    onClick={() => setReadingDir(opt.id)}
                    className={`mr-settings-opt ${readingDir === opt.id ? "active" : ""}`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Keyboard Shortcuts */}
            <div className="mr-settings-row">
              <span className="mr-settings-label">Shortcuts</span>
              <div className="mr-shortcuts-grid">
                <div className="mr-shortcut-item"><kbd>←</kbd><kbd>→</kbd> <span>Navigate</span></div>
                <div className="mr-shortcut-item"><kbd>C</kbd> <span>Chapters</span></div>
                <div className="mr-shortcut-item"><kbd>S</kbd> <span>Settings</span></div>
                <div className="mr-shortcut-item"><kbd>F</kbd> <span>Fullscreen</span></div>
                <div className="mr-shortcut-item"><kbd>Esc</kbd> <span>Back</span></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════
          CHAPTER SIDEBAR (slide-in from right)
          ══════════════════════════════════════════ */}
      {/* Backdrop overlay */}
      <div
        className={`mr-sidebar-backdrop ${showChapterSidebar ? "mr-sidebar-backdrop-visible" : ""}`}
        onClick={() => setShowChapterSidebar(false)}
      />
      <div className={`mr-chapter-sidebar ${showChapterSidebar ? "mr-sidebar-open" : ""}`}>
        <div className="mr-sidebar-glass">
          <div className="mr-sidebar-header">
            <h3 className="mr-sidebar-title">Chapters</h3>
            <button
              onClick={() => setShowChapterSidebar(false)}
              className="mr-sidebar-close"
              aria-label="Close chapter list"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="mr-sidebar-list">
            {langFilteredChapters.sort((a: any, b: any) => a.number - b.number).map((ch: any) => (
              <button
                key={ch.id}
                onClick={() => {
                  navigate({ page: "manga-read", id: mangaId, chapterId: String(ch.number) });
                  setShowChapterSidebar(false);
                }}
                className={`mr-sidebar-item ${String(ch.number) === String(chapterId) ? "active" : ""}`}
              >
                <span className="mr-sidebar-num">Ch. {ch.number}</span>
                <span className="mr-sidebar-name">{ch.title || `Chapter ${ch.number}`}</span>
                {String(ch.number) === String(chapterId) && (
                  <span className="mr-sidebar-current">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════
          READER AREA
          ══════════════════════════════════════════ */}
      {readingMode === "vertical" ? (
        /* ── VERTICAL SCROLL MODE ── */
        <div
          ref={containerRef}
          onScroll={handleScroll}
          onClick={handleReaderClick}
          className="mr-vertical-container"
        >
          <div className={`mr-vertical-inner mr-fit-${imageFit}`}>
            {pages.map((page, i) => (
              <div
                key={i}
                className="mr-page-wrap"
                onMouseEnter={() => setHoveredPageIndex(i)}
                onMouseLeave={() => setHoveredPageIndex(null)}
              >
                <div className={`mr-page-marker ${hoveredPageIndex === i ? "mr-page-marker-visible" : ""}`}>
                  {i + 1}
                </div>
                <img
                  src={page.proxiedUrl || page.url}
                  alt={`Page ${i + 1}`}
                  className="mr-page-img"
                  loading={i < 3 ? "eager" : "lazy"}
                  style={{ minHeight: "200px" }}
                />
              </div>
            ))}

            {/* End of chapter navigation */}
            {pages.length > 0 && (
              <div className="mr-end-nav">
                <div className="mr-end-nav-divider" />
                <p className="mr-end-nav-title">End of {chapterTitle}</p>
                <div className="mr-end-nav-buttons">
                  {prevChapter && (
                    <button
                      onClick={() => navigate({ page: "manga-read", id: mangaId, chapterId: String(prevChapter.number) })}
                      className="mr-end-btn mr-end-btn-prev"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path d="M15 19l-7-7 7-7" />
                      </svg>
                      <span>Prev Chapter</span>
                    </button>
                  )}
                  <button
                    onClick={() => navigate({ page: "manga-detail", id: mangaId })}
                    className="mr-end-btn mr-end-btn-all"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
                      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
                    </svg>
                    <span>All Chapters</span>
                  </button>
                  {nextChapter && (
                    <button
                      onClick={() => navigate({ page: "manga-read", id: mangaId, chapterId: String(nextChapter.number) })}
                      className="mr-end-btn mr-end-btn-next"
                    >
                      <span>Next Chapter</span>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : readingMode === "single" ? (
        /* ── SINGLE PAGE — HORIZONTAL SNAP SCROLL ── */
        <div
          ref={snapContainerRef}
          onScroll={handleSnapScroll}
          onClick={handleReaderClick}
          className="mr-snap-container"
          style={{ direction: readingDir }}
        >
          {pages.map((page, i) => (
            <div key={i} className="mr-snap-page">
              <img
                src={page.proxiedUrl || page.url}
                alt={`Page ${i + 1}`}
                className={`mr-snap-img mr-fit-${imageFit}`}
                loading={i < 3 ? "eager" : "lazy"}
              />
              <div className="mr-snap-page-num">{i + 1}</div>
            </div>
          ))}
        </div>
      ) : (
        /* ── DOUBLE PAGE MODE ── */
        <div className="mr-double-container" onClick={handleReaderClick}>
          {/* Click zones for navigation */}
          <div className="mr-click-zone mr-click-left" onClick={goToPrevPage} title="Previous page" />
          <div className="mr-click-zone mr-click-right" onClick={goToNextPage} title="Next page" />

          <div className="mr-double-display">
            {doublePages.map((page, i) => (
              <img
                key={currentPage + i}
                src={page.proxiedUrl || page.url}
                alt={`Page ${currentPage + i + 1}`}
                className={`mr-double-img mr-fit-${imageFit}`}
                loading="eager"
              />
            ))}
          </div>

          {/* Page counter overlay */}
          <div className="mr-double-counter">
            {currentPage + 1}{pages[currentPage + 1] ? `-${Math.min(currentPage + 2, pages.length)}` : ""} / {pages.length}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════
          BOTTOM NAVIGATION (floating, glassmorphic)
          ══════════════════════════════════════════ */}
      <div className={`mr-bottom-nav ${showControls ? "mr-visible" : "mr-hidden"}`}>
        <div className="mr-bottom-glass">
          {/* Prev chapter */}
          {prevChapter ? (
            <button
              onClick={() => navigate({ page: "manga-read", id: mangaId, chapterId: String(prevChapter.number) })}
              className="mr-bottom-chapter-btn"
              title="Previous chapter"
              aria-label="Previous chapter"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path d="M15 19l-7-7 7-7" />
              </svg>
              <span className="mr-bottom-chapter-label">Prev</span>
            </button>
          ) : (
            <div className="mr-bottom-spacer" />
          )}

          {/* Page slider */}
          <div className="mr-slider-area">
            <span className="mr-slider-current">{currentPage + 1}</span>
            <div className="mr-slider-track-wrap">
              <div className="mr-slider-track-bg">
                <div className="mr-slider-track-fill" style={{ width: `${progress}%` }} />
              </div>
              <input
                type="range"
                min={0}
                max={Math.max(pages.length - 1, 0)}
                value={currentPage}
                onChange={e => goToPage(parseInt(e.target.value))}
                className="mr-slider-input"
                aria-label={`Page ${currentPage + 1} of ${pages.length}`}
              />
            </div>
            <span className="mr-slider-total">{pages.length}</span>
          </div>

          {/* Next chapter */}
          {nextChapter ? (
            <button
              onClick={() => navigate({ page: "manga-read", id: mangaId, chapterId: String(nextChapter.number) })}
              className="mr-bottom-chapter-btn"
              title="Next chapter"
              aria-label="Next chapter"
            >
              <span className="mr-bottom-chapter-label">Next</span>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path d="M9 5l7 7-7 7" />
              </svg>
            </button>
          ) : (
            <div className="mr-bottom-spacer" />
          )}
        </div>
      </div>
    </div>
  );
}
