"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useAppStore } from "./store";

/* ═══════════════════════════════════════════════════════════════
   MANGA DETAIL PAGE — v4 (site-blue, mirrors anime-detail layout)
   ─────────────────────────────────────────────────────────────────
   STRUCTURE — mirrors anime-section-page detail:
   1. Full-screen hero (blurred banner + poster + title + info + buttons)
   2. Synopsis section
   3. Chapter list (searchable, sortable, grouped)

   DATA
   • /api/manga/detail?id={id} — atsumaru info + chapters
   • /api/manga/banners?ids={anilistId} — AniList banner image enrichment

   ACCENT — site blue #1e88ff (matches the manga home page)
   ═══════════════════════════════════════════════════════════════ */

const ACCENT = "#1e88ff";

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

export default function MangaDetailPage({ mangaId }: MangaDetailProps) {
  const navigate = useAppStore(s => s.navigate);
  const [manga, setManga] = useState<MangaDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [banner, setBanner] = useState<string>("");
  const [chapterSearch, setChapterSearch] = useState("");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [showFullDesc, setShowFullDesc] = useState(false);

  // ── Load manga detail ──
  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/manga/detail?id=${encodeURIComponent(mangaId)}`);
        if (res.ok) {
          const data = await res.json();
          setManga(data);
          // Fetch AniList banner if we have an anilistId
          const alId = data.anilistId ? parseInt(String(data.anilistId), 10) : null;
          if (alId && !isNaN(alId)) {
            try {
              const bRes = await fetch(`/api/manga/banners?ids=${alId}`);
              if (bRes.ok) {
                const bData = await bRes.json();
                const b = bData.banners?.[alId]?.banner;
                if (b) setBanner(b);
              }
            } catch { /* ignore */ }
          }
        }
      } catch { /* ignore */ }
      setLoading(false);
    }
    load();
  }, [mangaId]);

  // ── Derived ──
  const displayTitle = manga?.englishTitle || manga?.title || "";
  const poster = manga?.poster || manga?.cover || "";
  const heroBanner = banner || manga?.banner || poster;
  const authors = manga
    ? (Array.isArray(manga.authors) ? manga.authors.join(", ") : (manga.authors || "Unknown"))
    : "";
  const cleanDesc = manga?.description ? manga.description.replace(/<[^>]*>/g, "") : "";
  const descTruncated = cleanDesc.length > 400 && !showFullDesc;
  const descDisplay = descTruncated ? cleanDesc.slice(0, 400) + "..." : cleanDesc;

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

  const navigateToChapter = useCallback((ch: MangaChapter) => {
    navigate({ page: "manga-read", id: mangaId, chapterId: String(ch.number) });
  }, [navigate, mangaId]);

  // ── Loading ──
  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-white/10 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  if (!manga) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center text-white/40">
        Manga not found.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* ═══ HERO — full-screen banner + poster + info ═══ */}
      <div className="relative w-full h-[70vh] min-h-[500px] overflow-hidden bg-black">
        {/* Blurred banner background */}
        {heroBanner && (
          <img
            src={heroBanner}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
            style={{ filter: "blur(12px) brightness(0.4)", transform: "scale(1.1)" }}
          />
        )}
        {/* Gradient overlays */}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-transparent to-transparent" />

        {/* Content — poster + info */}
        <div className="absolute bottom-0 left-0 right-0 p-6 md:p-12 lg:p-16">
          <div className="flex items-end gap-6 md:gap-8 max-w-7xl mx-auto">
            {/* Poster */}
            <div className="shrink-0 w-[120px] h-[170px] md:w-[180px] md:h-[260px] overflow-hidden rounded-xl shadow-2xl border border-white/10">
              {poster && <img src={poster} alt={displayTitle} className="w-full h-full object-cover" />}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0 space-y-3 pb-2">
              {/* Type + status badges */}
              <div className="flex items-center gap-2 flex-wrap">
                {manga.type && (
                  <span className="px-2.5 py-1 text-xs font-bold uppercase tracking-wider rounded" style={{ background: `${ACCENT}20`, color: ACCENT, border: `1px solid ${ACCENT}40` }}>
                    {manga.type}
                  </span>
                )}
                {manga.status && (
                  <span className="px-2.5 py-1 text-xs font-bold uppercase tracking-wider rounded bg-white/10 text-white/60 border border-white/10">
                    {manga.status}
                  </span>
                )}
                {manga.rating ? (
                  <span className="flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded bg-white/10 text-white/80 border border-white/10">
                    <svg className="w-3 h-3" fill="currentColor" style={{ color: ACCENT }} viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                    {manga.rating.toFixed(1)}
                  </span>
                ) : null}
              </div>

              {/* Title */}
              <h1 className="text-2xl md:text-4xl lg:text-5xl font-extrabold text-white leading-[1.05] tracking-tight">
                {displayTitle}
              </h1>

              {/* Meta row */}
              <div className="flex items-center gap-3 flex-wrap text-sm text-white/60">
                {authors && authors !== "Unknown" && <span>by {authors}</span>}
                {manga.totalChapters ? <span>• {manga.totalChapters} chapters</span> : null}
              </div>

              {/* Genres */}
              {manga.genres && manga.genres.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap">
                  {manga.genres.slice(0, 5).map(g => (
                    <span key={g} className="px-3 py-1 text-xs font-medium text-white/60 border border-white/15 rounded-full">
                      {g}
                    </span>
                  ))}
                </div>
              )}

              {/* Action buttons */}
              <div className="flex items-center gap-3 flex-wrap pt-2">
                {manga.chapters && manga.chapters.length > 0 && (
                  <button
                    onClick={() => navigateToChapter(
                      [...manga.chapters!].sort((a, b) => a.number - b.number)[0]
                    )}
                    className="inline-flex items-center gap-2 px-8 py-3 bg-white text-black font-bold text-sm hover:bg-white/90 transition-colors"
                    style={{ borderRadius: "4px" }}
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                      <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
                      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
                    </svg>
                    Read Ch. 1
                  </button>
                )}
                {manga.chapters && manga.chapters.length > 1 && (
                  <button
                    onClick={() => navigateToChapter(
                      [...manga.chapters!].sort((a, b) => b.number - a.number)[0]
                    )}
                    className="inline-flex items-center gap-2 px-6 py-3 bg-white/15 text-white font-bold text-sm hover:bg-white/25 backdrop-blur-sm transition-colors border border-white/20"
                    style={{ borderRadius: "4px" }}
                  >
                    Latest Chapter
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ SYNOPSIS ═══ */}
      {cleanDesc && (
        <section className="px-4 md:px-8 lg:px-8 py-8 max-w-4xl">
          <h2 className="text-lg font-bold text-white mb-3">Synopsis</h2>
          <p className="text-sm md:text-base text-white/60 leading-relaxed">
            {descDisplay}
          </p>
          {cleanDesc.length > 400 && (
            <button
              onClick={() => setShowFullDesc(!showFullDesc)}
              className="mt-2 text-xs font-bold text-white/40 hover:text-white transition-colors"
            >
              {showFullDesc ? "Show Less" : "Read More"}
            </button>
          )}
        </section>
      )}

      {/* ═══ CHAPTERS ═══ */}
      {manga.chapters && manga.chapters.length > 0 && (
        <section className="px-4 md:px-8 lg:px-8 py-8">
          <div className="max-w-5xl mx-auto">
            {/* Chapter header + controls */}
            <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
              <h2 className="text-lg font-bold text-white">
                Chapters <span className="text-white/40">({filteredChapters.length})</span>
              </h2>
              <div className="flex items-center gap-2">
                {/* Search */}
                <div className="relative">
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                  <input
                    type="text"
                    placeholder="Search chapters..."
                    value={chapterSearch}
                    onChange={e => setChapterSearch(e.target.value)}
                    className="pl-9 pr-3 py-1.5 text-xs bg-white/5 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:border-white/30 w-40"
                    style={{ borderRadius: "4px" }}
                  />
                </div>
                {/* Sort */}
                <button
                  onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
                  className="px-3 py-1.5 text-xs font-semibold bg-white/5 border border-white/10 text-white/60 hover:text-white transition-colors"
                  style={{ borderRadius: "4px" }}
                >
                  {sortOrder === "asc" ? "↑ Asc" : "↓ Desc"}
                </button>
              </div>
            </div>

            {/* Chapter grid — 4 columns */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
              {filteredChapters.slice(0, 80).map(ch => (
                <button
                  key={ch.id}
                  onClick={() => navigateToChapter(ch)}
                  className="group flex items-center gap-3 p-3 bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.08] hover:border-white/20 transition-all text-left"
                  style={{ borderRadius: "8px" }}
                >
                  {/* Chapter number badge */}
                  <div className="shrink-0 w-10 h-10 flex items-center justify-center font-extrabold text-sm" style={{ background: `${ACCENT}15`, color: ACCENT, borderRadius: "6px" }}>
                    {ch.number}
                  </div>
                  {/* Chapter info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white/80 truncate group-hover:text-white transition-colors">
                      {ch.title || `Chapter ${ch.number}`}
                    </p>
                    {ch.pages ? (
                      <p className="text-[10px] text-white/30 mt-0.5">{ch.pages} pages</p>
                    ) : null}
                  </div>
                  {/* Play icon on hover */}
                  <svg className="w-4 h-4 text-white/0 group-hover:text-white/60 transition-colors shrink-0" fill="currentColor" viewBox="0 0 24 24">
                    <polygon points="5 3 19 12 5 21 5 3" />
                  </svg>
                </button>
              ))}
            </div>

            {filteredChapters.length > 80 && (
              <p className="text-center text-xs text-white/30 mt-6">
                Showing first 80 chapters. Use search to find specific chapters.
              </p>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
