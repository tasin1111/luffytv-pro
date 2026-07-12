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

// ═══════════════════════════════════════════════════════════════════════
//  CHAPTER ID HELPERS
//  ---------------------------------------------------------------------
//  A chapter ID can be one of four shapes (depending on provider):
//    1. Mangaball translation ID — 24-char hex (e.g. "6a27a45c48701b8c5c57de1a")
//    2. Cross-provider merge ID — starts with "at:" (e.g. "at:3xHoW:1:LMHqVf")
//    3. Short atsu.moe chapter ID — alnum 3–20 chars, not all digits (e.g. "LMHqVf")
//    4. Plain chapter number — string (e.g. "68")
//  These helpers centralize the detection so it isn't duplicated 6 times.
// ═══════════════════════════════════════════════════════════════════════

/** True if `id` looks like a mangaball translation ID (24-char hex). */
function isMangaballTranslationId(id: string | undefined | null): id is string {
  return !!id && /^[0-9a-f]{24}$/i.test(id);
}

/** True if `id` is a cross-provider merge ID (starts with "at:"). */
function isCrossProviderMergeId(id: string | undefined | null): id is string {
  return !!id && id.startsWith("at:");
}

/** True if `id` is a short atsu.moe chapter ID (alnum 3–20 chars, not all digits). */
function isAtsuShortId(id: string | undefined | null): id is string {
  return !!id &&
    !isMangaballTranslationId(id) &&
    !isCrossProviderMergeId(id) &&
    /^[A-Za-z0-9_-]{3,20}$/.test(id) &&
    !/^\d+$/.test(id);
}

/**
 * Build the chapterId to pass to `navigate({ page: "manga-read", chapterId })`.
 * Returns the raw `ch.id` when it's a recognizable provider ID, otherwise
 * falls back to the chapter number as a string.
 */
function buildNavChapterId(ch: { id?: string; number?: number | string }): string {
  if (ch.id && (
    isMangaballTranslationId(ch.id) ||
    isCrossProviderMergeId(ch.id) ||
    isAtsuShortId(ch.id)
  )) {
    return ch.id;
  }
  return String(ch.number ?? "");
}

/**
 * True if the given chapter matches the currently-loaded `chapterId`.
 * Handles all four ID shapes including cross-provider merge IDs whose
 * final segment is the real atsu chapter ID.
 */
function chapterMatches(
  ch: { id?: string; number?: number | string },
  chapterId: string,
): boolean {
  if (ch.id === chapterId) return true;
  if (String(ch.number) === String(chapterId)) return true;
  // Cross-provider merge IDs: compare the last segment (the real chapter ID)
  if (isCrossProviderMergeId(ch.id) && isCrossProviderMergeId(chapterId)) {
    const cParts = ch.id!.split(":");
    const jParts = chapterId.split(":");
    if (cParts.length >= 4 && jParts.length >= 4 &&
        cParts[cParts.length - 1] === jParts[jParts.length - 1]) {
      return true;
    }
  }
  return false;
}

// ═══════════════════════════════════════════════════════════════════════
//  LOCAL STORAGE KEYS — for persisting reader settings per browser.
// ═══════════════════════════════════════════════════════════════════════
const LS_KEY_READING_MODE = "manga-reader-mode";
const LS_KEY_IMAGE_FIT = "manga-reader-fit";
const LS_KEY_READING_DIR = "manga-reader-dir";

/** Safe localStorage read with fallback. */
function lsGet<T extends string>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return (v as T) || fallback;
  } catch { return fallback; }
}

/** Safe localStorage write. */
function lsSet(key: string, value: string): void {
  try { localStorage.setItem(key, value); } catch { /* ignore quota/SSR */ }
}

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
  // Reading settings are initialized from localStorage so the user's
  // last choice persists across chapter navigation and page reloads.
  const [showControls, setShowControls] = useState(true);
  const [currentPage, setCurrentPage] = useState(0);
  const [readingMode, setReadingMode] = useState<ReadingMode>(() => lsGet(LS_KEY_READING_MODE, "vertical"));
  const [imageFit, setImageFit] = useState<ImageFit>(() => lsGet(LS_KEY_IMAGE_FIT, "width"));
  const [showSettings, setShowSettings] = useState(false);
  const [showChapterSidebar, setShowChapterSidebar] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [readingDir, setReadingDir] = useState<ReadingDirection>(() => lsGet(LS_KEY_READING_DIR, "ltr"));
  const [hoveredPageIndex, setHoveredPageIndex] = useState<number | null>(null);

  // ── Persist reading settings whenever they change ──
  useEffect(() => { lsSet(LS_KEY_READING_MODE, readingMode); }, [readingMode]);
  useEffect(() => { lsSet(LS_KEY_IMAGE_FIT, imageFit); }, [imageFit]);
  useEffect(() => { lsSet(LS_KEY_READING_DIR, readingDir); }, [readingDir]);

  // ── Refs ──
  const containerRef = useRef<HTMLDivElement>(null);
  const snapContainerRef = useRef<HTMLDivElement>(null);
  const hideTimerRef = useRef<NodeJS.Timeout | null>(null);
  const readerRootRef = useRef<HTMLDivElement>(null);

  // ── Load chapter pages ──
  // Loads pages + manga detail in parallel, then pushes a reading-history
  // entry to /api/history so the user can resume from the home page.
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      setCurrentPage(0);
      try {
        const [pagesRes, detailRes] = await Promise.all([
          fetch(`/api/manga/read?mangaId=${encodeURIComponent(mangaId)}&chapterId=${encodeURIComponent(chapterId)}`),
          fetch(`/api/manga/detail?id=${encodeURIComponent(mangaId)}`),
        ]);
        if (cancelled) return;
        let loadedPages: ChapterPage[] = [];
        if (pagesRes.ok) {
          const data = await pagesRes.json();
          if (data.pages?.length > 0) {
            loadedPages = data.pages;
            setPages(data.pages);
          } else {
            setError("No pages available for this chapter.");
          }
        } else {
          setError("Failed to load chapter pages.");
        }
        if (detailRes.ok) {
          const detail = await detailRes.json();
          if (cancelled) return;
          setMangaTitle(detail.englishTitle || detail.title || "");
          const chs = detail.chapters || [];
          setAllChapters(chs);
          // Match the current chapter using the centralized helper.
          const ch = chs.find((c: any) => chapterMatches(c, chapterId));
          setChapterTitle(ch?.title || `Chapter ${ch?.number || chapterId}`);

          // ── Save to reading history (best-effort, non-blocking) ──
          // Reuses WatchHistory with episodeNum = chapter number.
          try {
            await fetch("/api/history", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                animeId: mangaId,
                animeName: detail.englishTitle || detail.title || "Unknown Manga",
                thumbnail: detail.poster || detail.cover || "",
                episodeNum: typeof ch?.number === "number" ? ch.number : parseFloat(String(ch?.number ?? chapterId)) || 0,
                episodeTitle: ch?.title || `Chapter ${ch?.number || chapterId}`,
                progress: 0,
                duration: loadedPages.length,
              }),
            });
          } catch { /* history is best-effort */ }
        }
      } catch (err) {
        console.error("[manga-reader] load error:", err);
        setError("Failed to load chapter.");
      }
      if (!cancelled) setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [mangaId, chapterId]);

  // ── Find prev/next chapters ──
  // Match the current chapter by ID or by number.
  // chapterId can be one of:
  //   - A mangaball translation ID (24 hex chars)
  //   - A short atsu.moe chapter ID (e.g. "LMHqVf")
  //   - A cross-provider merge ID "at:{mangaId}:{number}:{chapterId}"
  //   - A plain chapter number (string)
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

  // Find the current chapter in the FILTERED list using the centralized helper.
  const currentChapterIdx = langFilteredChapters.findIndex((c: any) => chapterMatches(c, chapterId));
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
  }, [readingMode, pages.length, mangaId, readingDir, goToNextPage, goToPrevPage, toggleFullscreen]);

  // ── Preload next chapter's pages when user is near the end of current chapter ──
  // Fetches the next chapter's /api/manga/read response and caches it so
  // navigation is instant when the user clicks "Next Chapter".
  const [nextChapterPages, setNextChapterPages] = useState<any[] | null>(null);
  useEffect(() => {
    if (!nextChapter || pages.length === 0) {
      setNextChapterPages(null);
      return;
    }
    // Only preload when user is on the last 3 pages
    if (currentPage < pages.length - 3) return;
    if (nextChapterPages) return; // already preloaded

    let cancelled = false;
    const nextChId = buildNavChapterId(nextChapter);
    fetch(`/api/manga/read?mangaId=${encodeURIComponent(mangaId)}&chapterId=${encodeURIComponent(nextChId)}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!cancelled && data?.pages) {
          setNextChapterPages(data.pages);
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [currentPage, pages.length, nextChapter, mangaId, nextChapterPages]);

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
            {/* Copy before sorting to avoid mutating the memo's array. */}
            {[...langFilteredChapters].sort((a: any, b: any) => a.number - b.number).map((ch: any) => {
              // Build the chapterId for navigation using the centralized helper.
              const navChapterId = buildNavChapterId(ch);
              // Check if this is the active chapter
              const isActive = chapterMatches(ch, chapterId);
              return (
                <button
                  key={ch.id}
                  onClick={() => {
                    navigate({ page: "manga-read", id: mangaId, chapterId: navChapterId });
                    setShowChapterSidebar(false);
                  }}
                  className={`mr-sidebar-item ${isActive ? "active" : ""}`}
                >
                  <span className="mr-sidebar-num">Ch. {ch.number}</span>
                  <span className="mr-sidebar-name">
                    {ch.title || `Chapter ${ch.number}`}
                    {ch.scanGroup && (
                      <span className="text-white/35 ml-1 text-[10px]">({ch.scanGroup})</span>
                    )}
                  </span>
                  {isActive && (
                    <span className="mr-sidebar-current">
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    </span>
                  )}
                </button>
              );
            })}
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
                  style={{ minHeight: "200px", aspectRatio: page.width && page.height ? `${page.width} / ${page.height}` : undefined }}
                  onError={(e) => {
                    // If the proxied URL 404s, fall back to the raw URL.
                    const img = e.currentTarget;
                    if (page.proxiedUrl && img.src === page.proxiedUrl && page.url && page.url !== page.proxiedUrl) {
                      img.src = page.url;
                    }
                  }}
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
                      onClick={() => navigate({ page: "manga-read", id: mangaId, chapterId: buildNavChapterId(prevChapter) })}
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
                      onClick={() => navigate({ page: "manga-read", id: mangaId, chapterId: buildNavChapterId(nextChapter) })}
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
                onError={(e) => {
                  const img = e.currentTarget;
                  if (page.proxiedUrl && img.src === page.proxiedUrl && page.url && page.url !== page.proxiedUrl) {
                    img.src = page.url;
                  }
                }}
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
                onError={(e) => {
                  const img = e.currentTarget;
                  if (page.proxiedUrl && img.src === page.proxiedUrl && page.url && page.url !== page.proxiedUrl) {
                    img.src = page.url;
                  }
                }}
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
              onClick={() => navigate({ page: "manga-read", id: mangaId, chapterId: buildNavChapterId(prevChapter) })}
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
              onClick={() => navigate({ page: "manga-read", id: mangaId, chapterId: buildNavChapterId(nextChapter) })}
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
