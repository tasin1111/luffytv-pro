"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useAppStore } from "./store";
import { proxifyMangaImage } from "@/lib/proxy";

/* ═══════════════════════════════════════════════════════════════
   MANGA DETAIL — "The Archive" (part of the manga section identity)
   Pink accent (#F472B6), solid surfaces (no glassmorphism), built
   with the same Tailwind-first approach as manga-page.tsx so the
   whole manga section reads as one system.
   ═══════════════════════════════════════════════════════════════ */

const ACCENT = "#F472B6";

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
}

function typeColor(type?: string): string {
  const t = (type || "").toLowerCase();
  if (t === "manhwa") return "#34D399";
  if (t === "manhua") return "#22D3EE";
  return ACCENT;
}

export default function MangaDetailPage({ mangaId }: { mangaId: string }) {
  const navigate = useAppStore(s => s.navigate);
  const [manga, setManga] = useState<MangaDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [chapterSearch, setChapterSearch] = useState("");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [showFullDesc, setShowFullDesc] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/manga/detail?id=${encodeURIComponent(mangaId)}`);
        if (res.ok && !cancelled) setManga(await res.json());
      } catch { /* ignore */ }
      if (!cancelled) setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [mangaId]);

  const navigateToChapter = useCallback((ch: MangaChapter) => {
    navigate({ page: "manga-read", id: mangaId, chapterId: String(ch.number) });
  }, [navigate, mangaId]);

  const displayTitle = manga?.englishTitle || manga?.title || "";
  const poster = proxifyMangaImage(manga?.poster || manga?.cover || "");
  const color = typeColor(manga?.type);

  const authorsText = manga
    ? (Array.isArray(manga.authors) ? manga.authors.join(", ") : (manga.authors || ""))
    : "";

  const sortedChapters = useMemo(() => {
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
  const descTruncated = cleanDesc.length > 320 && !showFullDesc;
  const descDisplay = descTruncated ? cleanDesc.slice(0, 320) + "..." : cleanDesc;

  const firstChapter = useMemo(() => {
    if (!manga?.chapters?.length) return null;
    return [...manga.chapters].sort((a, b) => a.number - b.number)[0];
  }, [manga]);

  const latestChapter = useMemo(() => {
    if (!manga?.chapters?.length) return null;
    return [...manga.chapters].sort((a, b) => a.number - b.number).at(-1)!;
  }, [manga]);

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center -mx-4 lg:-mx-8">
        <div className="w-10 h-10 border-2 border-white/10 rounded-full animate-spin" style={{ borderTopColor: ACCENT }} />
      </div>
    );
  }

  if (!manga) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center -mx-4 lg:-mx-8">
        <div className="text-center space-y-4">
          <p className="text-white/50 text-lg">Manga not found</p>
          <button
            onClick={() => navigate({ page: "manga" })}
            className="px-5 py-2 rounded-full text-sm font-bold text-black"
            style={{ background: ACCENT }}
          >
            Back to the Archive
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white pb-24 lg:pb-16 -mx-4 lg:-mx-8">
      {/* ═══ HERO ═══ */}
      <div className="relative w-full overflow-hidden" style={{ minHeight: "48vh" }}>
        {poster && (
          <img
            src={poster}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
            style={{ filter: "blur(28px) brightness(0.35) saturate(1.2)", scale: "1.15" }}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/70 to-black/30" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/30 to-transparent" />

        <div className="relative max-w-[1280px] mx-auto px-4 lg:px-8 pt-24 pb-8 flex gap-6 md:gap-8 items-end" style={{ minHeight: "48vh" }}>
          {poster && (
            <div className="hidden sm:block shrink-0 w-[150px] md:w-[180px]">
              <div className="aspect-[2/3] rounded-lg overflow-hidden border-2" style={{ borderColor: color + "66", boxShadow: `0 25px 60px rgba(0,0,0,0.6), 0 0 30px ${color}22` }}>
                <img src={poster} alt={displayTitle} className="w-full h-full object-cover" />
              </div>
            </div>
          )}

          <div className="flex-1 min-w-0 space-y-3">
            <nav className="flex items-center gap-1.5 text-xs text-white/40">
              <button onClick={() => navigate({ page: "manga" })} className="hover:text-white transition-colors">Archive</button>
              <span>/</span>
              <span className="text-white/60 truncate">{displayTitle}</span>
            </nav>

            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-1 rounded text-[10px] font-black uppercase tracking-wider" style={{ background: color, color: "#000" }}>
                {manga.type || "Manga"}
              </span>
              {manga.status && (
                <span className="px-2.5 py-1 rounded-full text-[10px] font-bold border border-white/15 text-white/70">
                  {manga.status}
                </span>
              )}
              {manga.isAdult && (
                <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-red-500/20 text-red-400 border border-red-500/30">18+</span>
              )}
            </div>

            <h1 className="text-3xl md:text-4xl lg:text-5xl font-extrabold leading-[1.05] tracking-tight">{displayTitle}</h1>

            {(authorsText || (manga.artists && manga.artists.length > 0)) && (
              <div className="flex items-center gap-4 text-sm text-white/50 flex-wrap">
                {authorsText && <span><span className="text-white/30">Author</span> {authorsText}</span>}
                {manga.artists && manga.artists.length > 0 && <span><span className="text-white/30">Artist</span> {manga.artists.join(", ")}</span>}
              </div>
            )}

            {manga.genres && manga.genres.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                {manga.genres.slice(0, 8).map(g => (
                  <span key={g} className="px-2.5 py-1 rounded-full text-xs text-white/60 border border-white/10">{g}</span>
                ))}
              </div>
            )}

            <div className="flex items-center gap-3 flex-wrap pt-1">
              {firstChapter && (
                <button
                  onClick={() => navigateToChapter(firstChapter)}
                  className="px-6 py-2.5 rounded-full font-bold text-sm text-black transition-transform hover:scale-105"
                  style={{ background: color }}
                >
                  Read Ch. {firstChapter.number}
                </button>
              )}
              {latestChapter && latestChapter.id !== firstChapter?.id && (
                <button
                  onClick={() => navigateToChapter(latestChapter)}
                  className="px-5 py-2.5 rounded-full font-bold text-sm border border-white/15 text-white/80 hover:text-white hover:border-white/30 transition-colors"
                >
                  Latest Ch. {latestChapter.number}
                </button>
              )}
              <button
                onClick={() => setIsBookmarked(!isBookmarked)}
                className="px-5 py-2.5 rounded-full font-bold text-sm border transition-colors"
                style={isBookmarked ? { background: color + "22", borderColor: color, color } : { borderColor: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.7)" }}
              >
                {isBookmarked ? "★ Saved" : "☆ Bookmark"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ STAT STRIP ═══ */}
      <div className="max-w-[1280px] mx-auto px-4 lg:px-8 -mt-3 relative z-10">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Chapters", value: manga.totalChapters || manga.chapters?.length || "—" },
            { label: "Status", value: manga.status || "Unknown" },
            { label: "Type", value: manga.type || "Manga" },
            { label: "Year", value: manga.year || "—" },
          ].map(stat => (
            <div key={stat.label} className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-4 py-3">
              <p className="text-lg font-extrabold text-white">{stat.value}</p>
              <p className="text-[10px] uppercase tracking-wider text-white/40 mt-0.5">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ═══ MAIN CONTENT ═══ */}
      <div className="max-w-[1280px] mx-auto px-4 lg:px-8 mt-8 grid lg:grid-cols-[1fr_320px] gap-8">
        {/* ── LEFT: Synopsis + Chapters ── */}
        <div className="min-w-0 space-y-8">
          {cleanDesc && (
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-white/50 mb-2">Synopsis</h2>
              <p className="text-sm text-white/70 leading-relaxed">{descDisplay}</p>
              {cleanDesc.length > 320 && (
                <button onClick={() => setShowFullDesc(!showFullDesc)} className="text-xs font-bold mt-1" style={{ color }}>
                  {showFullDesc ? "Show less" : "Read more"}
                </button>
              )}
            </div>
          )}

          <div>
            <div className="flex items-center gap-3 mb-4">
              <span className="w-1 h-5 rounded-full" style={{ background: color }} />
              <h2 className="text-lg font-bold text-white">Chapters</h2>
              <span className="text-xs text-white/30">{sortedChapters.length}</span>
              <div className="ml-auto flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Search..."
                  value={chapterSearch}
                  onChange={e => setChapterSearch(e.target.value)}
                  className="w-32 sm:w-44 px-3 py-1.5 rounded-full text-xs bg-white/[0.04] border border-white/10 text-white placeholder-white/30 focus:outline-none"
                />
                <button
                  onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
                  className="px-3 py-1.5 rounded-full text-xs font-bold border border-white/10 text-white/60 hover:text-white transition-colors whitespace-nowrap"
                >
                  {sortOrder === "asc" ? "Oldest first" : "Newest first"}
                </button>
              </div>
            </div>

            {sortedChapters.length > 0 ? (
              <div className="space-y-1.5">
                {sortedChapters.map(ch => (
                  <button
                    key={ch.id}
                    onClick={() => navigateToChapter(ch)}
                    className="group w-full flex items-center gap-3 rounded-lg border border-white/[0.05] bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/10 px-3 py-2.5 text-left transition-colors"
                  >
                    <span
                      className="shrink-0 w-9 h-9 rounded-md flex items-center justify-center text-xs font-black text-black"
                      style={{ background: color }}
                    >
                      {ch.number}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-white truncate">{ch.title}</p>
                      <div className="flex items-center gap-2 text-[11px] text-white/40">
                        {ch.scanGroup && <span>{ch.scanGroup}</span>}
                        {(ch.pageCount ?? ch.pages) != null && <span>{ch.pageCount ?? ch.pages}p</span>}
                      </div>
                    </div>
                    <svg className="w-4 h-4 text-white/20 group-hover:text-white/50 shrink-0 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                ))}
              </div>
            ) : (
              <div className="text-center py-16 text-white/40 text-sm">
                {chapterSearch ? "No matching chapters" : "No chapters available yet"}
              </div>
            )}
          </div>
        </div>

        {/* ── RIGHT: Details sidebar ── */}
        <aside className="space-y-4">
          <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-4 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-white/50">Details</h3>
            {[
              authorsText && ["Author", authorsText],
              manga.artists?.length && ["Artist", manga.artists.join(", ")],
              manga.status && ["Status", manga.status],
              manga.year && ["Year", String(manga.year)],
              manga.type && ["Type", manga.type],
              manga.anilistId && ["AniList ID", String(manga.anilistId)],
              manga.source && ["Source", manga.source],
            ].filter(Boolean).map((row: any) => (
              <div key={row[0]} className="flex items-center justify-between text-xs border-b border-white/[0.04] pb-2 last:border-0 last:pb-0">
                <span className="text-white/40">{row[0]}</span>
                <span className="text-white/80 font-medium text-right">{row[1]}</span>
              </div>
            ))}
          </div>
        </aside>
      </div>

      {/* ═══ MOBILE ACTION BAR ═══ */}
      <div className="fixed bottom-0 left-0 right-0 z-40 flex gap-2 p-3 bg-black/95 border-t border-white/[0.06] lg:hidden">
        {firstChapter && (
          <button
            onClick={() => navigateToChapter(firstChapter)}
            className="flex-1 py-2.5 rounded-full font-bold text-sm text-black"
            style={{ background: color }}
          >
            Read Ch. {firstChapter.number}
          </button>
        )}
        {latestChapter && latestChapter.id !== firstChapter?.id && (
          <button
            onClick={() => navigateToChapter(latestChapter)}
            className="px-5 py-2.5 rounded-full font-bold text-sm border border-white/15 text-white/80"
          >
            Latest
          </button>
        )}
      </div>
    </div>
  );
}
