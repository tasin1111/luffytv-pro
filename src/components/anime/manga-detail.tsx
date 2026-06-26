"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useAppStore } from "./store";

/* ═══════════════════════════════════════════════════════════════
   MANGA DETAIL PAGE — Full Structural Redesign v3
   Inspired by: MangaFire (banner + poster layout), Comix.to
   (rating stars + expandable details + chapter list), Atsu.moe
   (reading status + clean layout), Onisaga (chapter grouping)

   STRUCTURAL CHANGES from v2 → v3 (DRAMATICALLY different layout):
   1. IMMERSIVE HERO BANNER — Full-width with heavy blur + dark gradient,
      glassmorphic poster border, reading status overlay on poster
   2. STATS DASHBOARD — 4 glassmorphic stat cards with icons in a row
   3. TWO-COLUMN LAYOUT — Left 65% tabs, Right 35% sidebar with
      expandable details (Comix.to) + similar manga recommendations
   4. ENHANCED CHAPTER LIST — Search, Sort, View toggle, grouped list/grid
   5. READING STATUS DROPDOWN — Color-coded, checkmark, "Remove from List"
   6. MOBILE FLOATING ACTION BAR — Sticky bottom with Read + Latest
   ═══════════════════════════════════════════════════════════════ */

interface MangaChapter {
  id: string;
  title: string;
  number: number;
  date?: string;
  scanGroup?: string;
  pageCount?: number;
  pages?: number;
}

interface MangaDetailData {
  id: string;
  title: string;
  englishTitle?: string;
  altTitles?: string[];
  poster?: string;
  cover?: string;
  banner?: string;
  description?: string;
  type?: string;
  status?: string;
  year?: number;
  authors?: string | string[];
  artists?: string[];
  genres?: string[];
  isAdult?: boolean;
  anilistId?: number;
  malId?: number;
  totalChapters?: number;
  rating?: number;
  views?: number | string;
  chapters?: MangaChapter[];
  source?: string;
  slug?: string;
}

interface MangaDetailProps {
  mangaId: string;
}

type DetailTab = "overview" | "chapters";
type ReadingStatus = "none" | "reading" | "plan" | "completed" | "dropped" | "onhold";

const STATUS_CONFIG: Record<ReadingStatus, { label: string; color: string; bg: string; icon: string }> = {
  none: { label: "Add to List", color: "#A1A1AA", bg: "rgba(255,255,255,0.06)", icon: "plus" },
  reading: { label: "Reading", color: "#10B981", bg: "rgba(16,185,129,0.12)", icon: "book-open" },
  plan: { label: "Plan to Read", color: "#8B5CF6", bg: "rgba(139,92,246,0.12)", icon: "clock" },
  completed: { label: "Completed", color: "#3B82F6", bg: "rgba(59,130,246,0.12)", icon: "check" },
  dropped: { label: "Dropped", color: "#EF4444", bg: "rgba(239,68,68,0.12)", icon: "x" },
  onhold: { label: "On Hold", color: "#F59E0B", bg: "rgba(245,158,11,0.12)", icon: "pause" },
};

function formatTimeAgo(dateStr?: string): string {
  if (!dateStr) return "";
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
    if (diff < 60) return "just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
    return date.toLocaleDateString();
  } catch {
    return "";
  }
}

/* ── SVG Icon Helpers ── */
function IconBook({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
    </svg>
  );
}

function IconClock({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </svg>
  );
}

function IconBookOpen({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
    </svg>
  );
}

function IconCalendar({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function IconUser({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  );
}

function IconSearch({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function IconChevronDown({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path d="M19 9l-7 7-7-7" />
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

function IconHeart({ filled = false, className = "w-4 h-4" }: { filled?: boolean; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth={2}>
      <path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
    </svg>
  );
}

function IconEye({ className = "w-3.5 h-3.5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  );
}

/* ── Star Rating Display ── */
function StarRating({ rating }: { rating: number }) {
  const ratingValue = rating || 0;
  const fullStars = Math.floor(ratingValue / 2);
  const halfStar = (ratingValue / 2) - fullStars >= 0.5;

  return (
    <div className="md-rating-stars">
      {[1, 2, 3, 4, 5].map(star => (
        <svg key={star} className="md-star" viewBox="0 0 24 24"
          fill={star <= fullStars ? "#FBBF24" : star === fullStars + 1 && halfStar ? "url(#mdHalfStar)" : "none"}
          stroke="#FBBF24" strokeWidth={1.5}
        >
          <defs>
            <linearGradient id="mdHalfStar">
              <stop offset="50%" stopColor="#FBBF24" />
              <stop offset="50%" stopColor="transparent" />
            </linearGradient>
          </defs>
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
      ))}
      <span className="md-rating-value">{ratingValue.toFixed(1)}</span>
    </div>
  );
}

/* ── Main Component ── */
export default function MangaDetailPage({ mangaId }: MangaDetailProps) {
  const navigate = useAppStore(s => s.navigate);
  const [manga, setManga] = useState<MangaDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [chapterSearch, setChapterSearch] = useState("");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [showFullDesc, setShowFullDesc] = useState(false);
  const [activeTab, setActiveTab] = useState<DetailTab>("chapters");
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [readingStatus, setReadingStatus] = useState<ReadingStatus>("none");
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [chapterView, setChapterView] = useState<"list" | "grid">("list");
  const [expandedGroup, setExpandedGroup] = useState<string | null>("1-50");
  const [showDetails, setShowDetails] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/manga/detail?id=${encodeURIComponent(mangaId)}`);
        if (res.ok) {
          const data = await res.json();
          setManga(data);
        }
      } catch { /* ignore */ }
      setLoading(false);
    }
    load();
  }, [mangaId]);

  // Close status dropdown when clicking outside
  useEffect(() => {
    if (!showStatusDropdown) return;
    function handleClick() { setShowStatusDropdown(false); }
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [showStatusDropdown]);

  const navigateToChapter = useCallback((ch: MangaChapter) => {
    navigate({ page: "manga-read", id: mangaId, chapterId: ch.id });
  }, [navigate, mangaId]);

  // Computed values that depend on manga — must be before early returns (rules of hooks)
  const displayTitle = manga?.englishTitle || manga?.title || "";
  const poster = manga?.poster || manga?.cover || "";
  const bannerImg = manga?.banner || poster;

  const authorsText = manga
    ? (Array.isArray(manga.authors) ? manga.authors.join(", ") : (manga.authors || "Unknown"))
    : "";

  const filteredChapters = useMemo(() => {
    if (!manga?.chapters) return [];
    return manga.chapters
      .filter(ch => {
        if (!chapterSearch) return true;
        const q = chapterSearch.toLowerCase();
        return ch.title.toLowerCase().includes(q) || String(ch.number).includes(q);
      })
      .sort((a, b) => sortOrder === "asc" ? a.number - b.number : b.number - a.number);
  }, [manga, chapterSearch, sortOrder]);

  const cleanDesc = manga?.description ? manga.description.replace(/<[^>]*>/g, "") : "";
  const descTruncated = cleanDesc.length > 350 && !showFullDesc;
  const descDisplay = descTruncated ? cleanDesc.slice(0, 350) + "..." : cleanDesc;

  const chapterGroups = useMemo(() => {
    if (filteredChapters.length === 0) return [];
    const sorted = [...filteredChapters].sort((a, b) => a.number - b.number);
    const groups: { label: string; range: string; chapters: MangaChapter[] }[] = [];
    for (let i = 0; i < sorted.length; i += 50) {
      const batch = sorted.slice(i, i + 50);
      const startNum = batch[0].number;
      const endNum = batch[batch.length - 1].number;
      const range = `${startNum}-${endNum}`;
      groups.push({
        label: `Ch. ${startNum} - ${endNum}`,
        range,
        chapters: sortOrder === "asc" ? batch : [...batch].reverse(),
      });
    }
    return groups;
  }, [filteredChapters, sortOrder]);

  const firstChapter = useMemo(() => {
    if (filteredChapters.length === 0) return null;
    const sorted = [...filteredChapters].sort((a, b) => a.number - b.number);
    return sorted[0];
  }, [filteredChapters]);

  const latestChapter = useMemo(() => {
    if (filteredChapters.length === 0) return null;
    const sorted = [...filteredChapters].sort((a, b) => a.number - b.number);
    return sorted[sorted.length - 1];
  }, [filteredChapters]);

  const statusConf = STATUS_CONFIG[readingStatus];

  /* ── Loading State ── */
  if (loading) {
    return (
      <div className="fade-in -mx-4 lg:-mx-8">
        {/* Hero skeleton */}
        <div className="md-hero-skeleton" style={{ minHeight: "55vh" }}>
          <div className="max-w-[1280px] mx-auto px-4 lg:px-8 h-full flex items-end pb-10 pt-20">
            <div className="flex gap-6 lg:gap-8 w-full items-end">
              <div className="hidden sm:block w-[180px] lg:w-[220px] shrink-0">
                <div className="aspect-[3/4] rounded-2xl skeleton" style={{ border: "2px solid rgba(255,255,255,0.05)" }} />
              </div>
              <div className="flex-1 space-y-4">
                <div className="h-4 w-32 skeleton rounded" />
                <div className="flex gap-2">
                  <div className="h-6 w-20 skeleton rounded-full" />
                  <div className="h-6 w-16 skeleton rounded-full" />
                </div>
                <div className="h-10 w-3/4 skeleton rounded-lg" />
                <div className="h-4 w-1/2 skeleton rounded" />
                <div className="flex gap-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="h-6 w-20 skeleton rounded-full" />
                  ))}
                </div>
                <div className="flex gap-3 pt-2">
                  <div className="h-11 w-36 skeleton rounded-xl" />
                  <div className="h-11 w-28 skeleton rounded-xl" />
                  <div className="h-11 w-24 skeleton rounded-xl" />
                </div>
              </div>
            </div>
          </div>
        </div>
        {/* Stats skeleton */}
        <div className="max-w-[1280px] mx-auto px-4 lg:px-8 -mt-6 relative z-10">
          <div className="grid grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-20 skeleton rounded-2xl" />
            ))}
          </div>
        </div>
        {/* Content skeleton */}
        <div className="max-w-[1280px] mx-auto px-4 lg:px-8 mt-8 space-y-6">
          <div className="h-10 w-48 skeleton rounded-lg" />
          <div className="h-96 skeleton rounded-2xl" />
        </div>
      </div>
    );
  }

  /* ── Not Found State ── */
  if (!manga) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] fade-in">
        <div className="text-center space-y-4">
          <div className="w-20 h-20 rounded-2xl bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.06)] flex items-center justify-center mx-auto">
            <IconBook className="w-10 h-10 text-zinc-600" />
          </div>
          <p className="text-zinc-400 text-lg font-medium">Manga not found</p>
          <button
            onClick={() => navigate({ page: "manga" })}
            className="pill-btn pill-btn-ghost"
          >
            Back to Manga
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fade-in -mx-4 lg:-mx-8">

      {/* ═══════════════════════════════════════════════════════════
          SECTION 1: IMMERSIVE HERO BANNER
          Full-width banner with heavy blur + dark gradient overlay
          Left: Poster with glassmorphic border + reading status
          Right: Breadcrumb, badges, title, rating, author, genres, actions
          ═══════════════════════════════════════════════════════════ */}
      <section className="md-hero-banner">
        {/* Background image with heavy blur */}
        {bannerImg && (
          <img
            src={bannerImg}
            alt=""
            className="md-hero-bg"
            key={`bg-${mangaId}`}
          />
        )}
        {/* Multi-layer gradient overlay */}
        <div className="md-hero-overlay" />

        {/* Content */}
        <div className="md-hero-content">
          <div className="md-hero-layout">
            {/* ── LEFT: Poster Card ── */}
            {poster && (
              <div className="md-hero-poster-col">
                <div className="md-poster-card">
                  <img
                    src={poster}
                    alt={displayTitle}
                    className="md-poster-img"
                  />
                  {/* Glassmorphic border glow effect */}
                  <div className="md-poster-glow" />
                </div>

                {/* Reading Status Button Overlay on Poster */}
                <div className="md-poster-status-wrap">
                  <button
                    onClick={(e) => { e.stopPropagation(); setShowStatusDropdown(!showStatusDropdown); }}
                    className="md-reading-status-btn"
                    style={{
                      background: statusConf.bg,
                      color: statusConf.color,
                      borderColor: `${statusConf.color}30`,
                    }}
                  >
                    {readingStatus !== "none" && (
                      <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
                      </svg>
                    )}
                    {statusConf.label}
                  </button>

                  {/* Status Dropdown */}
                  {showStatusDropdown && (
                    <div className="md-reading-status-dropdown" onClick={e => e.stopPropagation()}>
                      {Object.entries(STATUS_CONFIG).filter(([k]) => k !== "none").map(([key, conf]) => (
                        <button
                          key={key}
                          onClick={() => { setReadingStatus(key as ReadingStatus); setShowStatusDropdown(false); }}
                          className="md-reading-status-option"
                          style={readingStatus === key ? { background: conf.bg, color: conf.color } : {}}
                        >
                          <span className="md-status-dot" style={{ background: conf.color }} />
                          {conf.label}
                          {readingStatus === key && (
                            <svg className="w-3.5 h-3.5 ml-auto" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
                            </svg>
                          )}
                        </button>
                      ))}
                      {readingStatus !== "none" && (
                        <div className="md-status-divider" />
                      )}
                      {readingStatus !== "none" && (
                        <button
                          onClick={() => { setReadingStatus("none"); setShowStatusDropdown(false); }}
                          className="md-reading-status-option"
                          style={{ color: "#EF4444" }}
                        >
                          <span className="md-status-dot" style={{ background: "#EF4444" }} />
                          Remove from List
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── RIGHT: Info Column ── */}
            <div className="md-hero-info-col">
              {/* Breadcrumb */}
              <nav className="md-breadcrumb" aria-label="Breadcrumb">
                <button
                  onClick={() => navigate({ page: "manga" })}
                  className="md-breadcrumb-link"
                >
                  <svg className="w-3 h-3 mr-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path d="M15 19l-7-7 7-7" />
                  </svg>
                  Manga
                </button>
                <IconChevronRight className="w-3 h-3 text-zinc-600" />
                <span className="md-breadcrumb-current">{displayTitle}</span>
              </nav>

              {/* Badges Row */}
              <div className="md-badges-row">
                <span className="md-badge md-badge-type">MANGA</span>
                {manga.type && manga.type.toLowerCase() !== "manga" && (
                  <span className="md-badge md-badge-neutral">{manga.type}</span>
                )}
                {manga.status && (
                  <span className={`md-badge md-badge-status ${manga.status.toLowerCase() === "ongoing" ? "ongoing" : manga.status.toLowerCase() === "completed" ? "completed" : ""}`}>
                    {manga.status}
                  </span>
                )}
                {manga.isAdult && (
                  <span className="md-badge md-badge-adult">18+</span>
                )}
              </div>

              {/* Title */}
              <h1 className="md-hero-title">{displayTitle}</h1>

              {/* Alt Title */}
              {manga.altTitles && manga.altTitles.length > 0 && (
                <p className="md-hero-alt-title">{manga.altTitles[0]}</p>
              )}

              {/* Rating Stars */}
              {manga.rating ? (
                <div className="md-rating-row">
                  <StarRating rating={manga.rating} />
                  {manga.views && (
                    <span className="md-views-item">
                      <IconEye className="w-3.5 h-3.5" />
                      {typeof manga.views === "number" ? manga.views.toLocaleString() : manga.views}
                    </span>
                  )}
                </div>
              ) : manga.views ? (
                <div className="md-rating-row">
                  <span className="md-views-item">
                    <IconEye className="w-3.5 h-3.5" />
                    {typeof manga.views === "number" ? manga.views.toLocaleString() : manga.views} views
                  </span>
                </div>
              ) : null}

              {/* Author/Artist Row */}
              <div className="md-author-row">
                {authorsText && authorsText !== "Unknown" && (
                  <span className="md-author-item">
                    <IconUser className="w-3.5 h-3.5" />
                    <span className="md-author-label">Author:</span>
                    {authorsText}
                  </span>
                )}
                {manga.artists && manga.artists.length > 0 && (
                  <span className="md-author-item">
                    <IconUser className="w-3.5 h-3.5" />
                    <span className="md-author-label">Artist:</span>
                    {manga.artists.join(", ")}
                  </span>
                )}
              </div>

              {/* Genre Pills - Horizontal scrollable */}
              {manga.genres && manga.genres.length > 0 && (
                <div className="md-genres-scroll">
                  {manga.genres.slice(0, 10).map(g => (
                    <span key={g} className="md-genre-pill">{g}</span>
                  ))}
                </div>
              )}

              {/* Action Buttons */}
              <div className="md-action-buttons">
                {firstChapter && (
                  <button
                    onClick={() => navigateToChapter(firstChapter)}
                    className="md-btn md-btn-primary"
                  >
                    <IconBook className="w-4 h-4" />
                    Read Ch. 1
                  </button>
                )}
                {latestChapter && latestChapter.id !== firstChapter?.id && (
                  <button
                    onClick={() => navigateToChapter(latestChapter)}
                    className="md-btn md-btn-secondary"
                  >
                    <IconClock className="w-4 h-4" />
                    Latest Ch. {latestChapter.number}
                  </button>
                )}
                <button
                  onClick={() => setIsBookmarked(!isBookmarked)}
                  className={`md-btn md-btn-outline ${isBookmarked ? "active" : ""}`}
                >
                  <IconHeart filled={isBookmarked} className="w-4 h-4" />
                  {isBookmarked ? "Saved" : "Bookmark"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════
          SECTION 2: STATS DASHBOARD
          4 glassmorphic stat cards in a horizontal row
          ═══════════════════════════════════════════════════════════ */}
      <section className="md-stats-section">
        <div className="md-stats-grid">
          <div className="md-stat-card">
            <div className="md-stat-icon-wrap md-stat-icon-red">
              <IconBook className="w-4 h-4" />
            </div>
            <div className="md-stat-text">
              <span className="md-stat-value">{manga.totalChapters || manga.chapters?.length || "—"}</span>
              <span className="md-stat-label">Chapters</span>
            </div>
          </div>
          <div className="md-stat-card">
            <div className="md-stat-icon-wrap md-stat-icon-green">
              <IconClock className="w-4 h-4" />
            </div>
            <div className="md-stat-text">
              <span className="md-stat-value">{manga.status || "Unknown"}</span>
              <span className="md-stat-label">Status</span>
            </div>
          </div>
          <div className="md-stat-card">
            <div className="md-stat-icon-wrap md-stat-icon-blue">
              <IconBookOpen className="w-4 h-4" />
            </div>
            <div className="md-stat-text">
              <span className="md-stat-value">{manga.type || "Manga"}</span>
              <span className="md-stat-label">Type</span>
            </div>
          </div>
          <div className="md-stat-card">
            <div className="md-stat-icon-wrap md-stat-icon-amber">
              <IconCalendar className="w-4 h-4" />
            </div>
            <div className="md-stat-text">
              <span className="md-stat-value">{manga.year || "—"}</span>
              <span className="md-stat-label">Year</span>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════
          SECTION 3: TWO-COLUMN LAYOUT
          Left (65%): Tabbed content (Overview | Chapters)
          Right (35%): Sidebar with expandable details + similar manga
          ═══════════════════════════════════════════════════════════ */}
      <section className="md-main-section">
        <div className="md-two-col">
          {/* ── LEFT COLUMN: Tabbed Content ── */}
          <div className="md-col-left">
            {/* Tab Bar */}
            <div className="md-tabs-bar">
              <button
                onClick={() => setActiveTab("overview")}
                className={`md-tab ${activeTab === "overview" ? "active" : ""}`}
              >
                Overview
              </button>
              <button
                onClick={() => setActiveTab("chapters")}
                className={`md-tab ${activeTab === "chapters" ? "active" : ""}`}
              >
                Chapters
                <span className="md-tab-count">{filteredChapters.length}</span>
              </button>
            </div>

            {/* ── OVERVIEW TAB ── */}
            {activeTab === "overview" && (
              <div className="md-tab-panel fade-in">
                {/* Synopsis */}
                {cleanDesc && (
                  <div className="md-section-block">
                    <h3 className="md-section-heading">Synopsis</h3>
                    <p className="md-synopsis-text">{descDisplay}</p>
                    {cleanDesc.length > 350 && (
                      <button
                        onClick={() => setShowFullDesc(!showFullDesc)}
                        className="md-read-more-btn"
                      >
                        {showFullDesc ? "Show less" : "Read more"}
                        <IconChevronDown className={`w-3.5 h-3.5 transition-transform ${showFullDesc ? "rotate-180" : ""}`} />
                      </button>
                    )}
                  </div>
                )}

                {/* Alternative Titles */}
                {manga.altTitles && manga.altTitles.length > 1 && (
                  <div className="md-section-block">
                    <h3 className="md-section-heading">Alternative Titles</h3>
                    <div className="md-alt-titles-grid">
                      {manga.altTitles.map((title, i) => (
                        <span key={i} className="md-alt-title-item">{title}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── CHAPTERS TAB ── */}
            {activeTab === "chapters" && (
              <div className="md-tab-panel fade-in">
                {/* Chapter Controls */}
                <div className="md-chapter-controls">
                  {/* Search */}
                  <div className="md-chapter-search">
                    <IconSearch className="md-chapter-search-icon" />
                    <input
                      type="text"
                      placeholder="Search chapters..."
                      value={chapterSearch}
                      onChange={e => setChapterSearch(e.target.value)}
                      className="md-chapter-search-input"
                    />
                  </div>

                  {/* View Toggle */}
                  <div className="md-chapter-view-toggle">
                    <button
                      onClick={() => setChapterView("list")}
                      className={`md-chapter-view-btn ${chapterView === "list" ? "active" : ""}`}
                      title="List view"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path d="M3 6h18M3 12h18M3 18h18" />
                      </svg>
                    </button>
                    <button
                      onClick={() => setChapterView("grid")}
                      className={`md-chapter-view-btn ${chapterView === "grid" ? "active" : ""}`}
                      title="Grid view"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
                        <rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" />
                      </svg>
                    </button>
                  </div>

                  {/* Sort Toggle */}
                  <button
                    onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
                    className="md-chapter-sort-btn"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path d="M3 4h13M3 8h9M3 12h5" />
                      <path d="M17 9l4 4-4 4" />
                    </svg>
                    {sortOrder === "asc" ? "Oldest" : "Newest"}
                  </button>
                </div>

                {/* Chapter List/Grid */}
                {filteredChapters.length > 0 ? (
                  chapterView === "grid" ? (
                    /* Grid View: Number buttons */
                    <div className="md-chapter-grid">
                      {filteredChapters.map(ch => (
                        <button
                          key={ch.id}
                          onClick={() => navigateToChapter(ch)}
                          className="md-chapter-grid-item"
                        >
                          <span className="md-chapter-grid-num">{ch.number}</span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    /* List View: Grouped chapters */
                    <div className="md-chapter-groups">
                      {chapterGroups.map(group => (
                        <div key={group.range} className="md-chapter-group">
                          <button
                            onClick={() => setExpandedGroup(expandedGroup === group.range ? null : group.range)}
                            className="md-chapter-group-header"
                          >
                            <div className="flex items-center gap-2">
                              <IconChevronRight className={`w-3.5 h-3.5 text-zinc-500 transition-transform duration-200 ${expandedGroup === group.range ? "rotate-90" : ""}`} />
                              <span className="text-xs font-bold text-white">{group.label}</span>
                            </div>
                            <span className="text-[10px] text-zinc-500">{group.chapters.length} chapters</span>
                          </button>
                          {expandedGroup === group.range && (
                            <div className="md-chapter-list slide-down">
                              {group.chapters.map(ch => (
                                <button
                                  key={ch.id}
                                  onClick={() => navigateToChapter(ch)}
                                  className="md-chapter-item"
                                >
                                  {/* Chapter number in styled circle */}
                                  <div className="md-chapter-num-circle">
                                    <span>{ch.number}</span>
                                  </div>
                                  {/* Chapter info */}
                                  <div className="md-chapter-item-info">
                                    <p className="md-chapter-item-title">{ch.title}</p>
                                    <div className="md-chapter-item-meta">
                                      {ch.scanGroup && <span className="md-scan-group-tag">{ch.scanGroup}</span>}
                                      {ch.date && <span>{formatTimeAgo(ch.date)}</span>}
                                      {(ch.pageCount ?? ch.pages) != null && <span>{ch.pageCount ?? ch.pages}p</span>}
                                    </div>
                                  </div>
                                  {/* Right arrow */}
                                  <IconChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-[#ffffff] shrink-0" />
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )
                ) : (
                  <div className="md-chapter-empty">
                    <div className="md-empty-icon">
                      <IconBook className="w-8 h-8 text-zinc-700" />
                    </div>
                    <p className="text-zinc-500 text-sm">
                      {chapterSearch ? "No matching chapters" : "No chapters available yet"}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── RIGHT COLUMN: Sidebar ── */}
          <aside className="md-col-right">
            {/* Expandable Details (Comix.to style) */}
            <div className="md-sidebar-card">
              <button
                onClick={() => setShowDetails(!showDetails)}
                className="md-details-toggle"
              >
                <span className="md-details-toggle-text">
                  <svg className="w-4 h-4 text-zinc-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Details
                </span>
                <IconChevronDown className={`w-4 h-4 transition-transform duration-200 ${showDetails ? "rotate-180" : ""}`} />
              </button>
              {showDetails && (
                <div className="md-details-content slide-down">
                  <div className="md-info-grid">
                    {authorsText && authorsText !== "Unknown" && (
                      <div className="md-info-item">
                        <span className="md-info-label">Author</span>
                        <span className="md-info-value">{authorsText}</span>
                      </div>
                    )}
                    {manga.artists && manga.artists.length > 0 && (
                      <div className="md-info-item">
                        <span className="md-info-label">Artist</span>
                        <span className="md-info-value">{manga.artists.join(", ")}</span>
                      </div>
                    )}
                    {manga.status && (
                      <div className="md-info-item">
                        <span className="md-info-label">Status</span>
                        <span className="md-info-value">{manga.status}</span>
                      </div>
                    )}
                    {manga.year && (
                      <div className="md-info-item">
                        <span className="md-info-label">Year</span>
                        <span className="md-info-value">{manga.year}</span>
                      </div>
                    )}
                    {manga.type && (
                      <div className="md-info-item">
                        <span className="md-info-label">Type</span>
                        <span className="md-info-value">{manga.type}</span>
                      </div>
                    )}
                    {manga.anilistId && (
                      <div className="md-info-item">
                        <span className="md-info-label">AniList ID</span>
                        <span className="md-info-value md-info-link">{manga.anilistId}</span>
                      </div>
                    )}
                    {manga.malId && (
                      <div className="md-info-item">
                        <span className="md-info-label">MAL ID</span>
                        <span className="md-info-value md-info-link">{manga.malId}</span>
                      </div>
                    )}
                    {manga.source && (
                      <div className="md-info-item">
                        <span className="md-info-label">Source</span>
                        <span className="md-info-value capitalize">{manga.source}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Similar Manga Recommendations */}
            <div className="md-sidebar-card md-similar-section">
              <h3 className="md-similar-heading">
                <svg className="w-4 h-4 text-zinc-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                Similar Manga
              </h3>
              <div className="md-similar-scroll">
                {/* Placeholder similar cards — would be populated from API */}
                <div className="md-similar-card">
                  <div className="md-similar-poster skeleton" />
                  <div className="md-similar-info">
                    <p className="md-similar-title">Loading...</p>
                    <p className="md-similar-meta">—</p>
                  </div>
                </div>
                <div className="md-similar-card">
                  <div className="md-similar-poster skeleton" />
                  <div className="md-similar-info">
                    <p className="md-similar-title">Loading...</p>
                    <p className="md-similar-meta">—</p>
                  </div>
                </div>
                <div className="md-similar-card">
                  <div className="md-similar-poster skeleton" />
                  <div className="md-similar-info">
                    <p className="md-similar-title">Loading...</p>
                    <p className="md-similar-meta">—</p>
                  </div>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════
          SECTION 4: MOBILE FLOATING ACTION BAR
          Sticky bottom bar on mobile with Read + Latest
          ═══════════════════════════════════════════════════════════ */}
      <div className="md-mobile-bar lg:hidden">
        {firstChapter && (
          <>
            <button
              onClick={() => navigateToChapter(firstChapter)}
              className="md-mobile-btn-read"
            >
              <IconBook className="w-4 h-4" />
              Read Ch. 1
            </button>
            {latestChapter && latestChapter.id !== firstChapter.id && (
              <button
                onClick={() => navigateToChapter(latestChapter)}
                className="md-mobile-btn-latest"
              >
                Latest
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
