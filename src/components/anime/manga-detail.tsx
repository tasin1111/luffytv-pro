"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useAppStore } from "./store";
import AnimeComments from "./anime-comments";

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

// Language badge colors
const LANG_COLORS: Record<string, string> = {
  en: "#3B82F6", es: "#EF4444", fr: "#6366F1", id: "#10B981",
  it: "#22C55E", "pt-br": "#F59E0B", vi: "#EC4899", zh: "#F43F5E",
  th: "#8B5CF6", pl: "#EAB308", ja: "#06B6D4", ko: "#3B82F6",
};

interface MangaChapter {
  id: string;
  title: string;
  number: number;
  date?: string;
  scanGroup?: string;
  pageCount?: number;
  pages?: number;
  lang?: string;
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
  tags?: string[];
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
  const [selectedLang, setSelectedLang] = useState<string>("all");

  // ── Load manga detail ──
  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        // Get fallback title from sessionStorage (for cross-provider metadata merge)
        let fbTitle = "";
        let fbPoster = "";
        try {
          fbTitle = sessionStorage.getItem(`manga-title-${mangaId}`) || "";
          fbPoster = sessionStorage.getItem(`manga-poster-${mangaId}`) || "";
        } catch { /* ignore */ }

        // Pass title to the API for cross-provider fallback
        const titleParam = fbTitle ? `&title=${encodeURIComponent(fbTitle)}` : "";
        const res = await fetch(`/api/manga/detail?id=${encodeURIComponent(mangaId)}${titleParam}`);
        if (res.ok) {
          const data = await res.json();

          // Fallback poster/title from sessionStorage (for mangaball manga
          // where the info endpoint fails and returns empty poster)
          if (!data.poster || data.poster === "") {
            if (fbPoster) {
              data.poster = fbPoster;
              data.cover = fbPoster;
              data.banner = fbPoster;
            }
            if (fbTitle && (!data.title || data.title === "Unknown Title")) {
              data.title = fbTitle;
              data.englishTitle = fbTitle;
            }
          }

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

          // CLIENT-SIDE comix.to merge:
          // If this is a mangaball manga, search comix.to for the same title
          // and replace English chapters with comix.to's English chapters.
          // English = comix.to ONLY, other languages = mangaball ONLY.
          if (mangaId.startsWith("mb:") && data.chapters?.length) {
            // Use fbTitle FIRST (from sessionStorage, set when user clicked the manga card)
            // because mangaball's info endpoint often fails and returns "Unknown Title"
            const titleForSearch = fbTitle || data.englishTitle || data.title || "";
            if (titleForSearch && titleForSearch !== "Unknown Title") {
              try {
                // Step 1: Search comix.to for the title
                const searchRes = await fetch(
                  `/api/manga/comix-search?q=${encodeURIComponent(titleForSearch)}`
                );
                if (searchRes.ok) {
                  const searchData = await searchRes.json();
                  if (searchData.hid) {
                    // Step 2: Fetch comix.to detail
                    const comixRes = await fetch(
                      `/api/manga/detail?id=cx:${searchData.hid}`
                    );
                    if (comixRes.ok) {
                      const comixData = await comixRes.json();
                      if (comixData.chapters?.length) {
                        // Step 3: Remove mangaball English chapters
                        // English = comix.to ONLY
                        const nonEnChapters = data.chapters.filter(
                          (ch: any) => ch.lang !== "en"
                        );
                        // Step 4: Add comix.to English chapters
                        const comixEnChapters = comixData.chapters.map((ch: any) => ({
                          ...ch,
                          id: `cx:${searchData.hid}:${ch.id}`,
                          lang: "en",
                          scanGroup: ch.scanGroup || "Comix",
                        }));
                        // Step 5: Merge — comix English + mangaball non-English
                        data.chapters = [...comixEnChapters, ...nonEnChapters];
                        data.totalChapters = data.chapters.length;
                        // Merge metadata if missing
                        if (!data.description && comixData.description) {
                          data.description = comixData.description;
                        }
                        if (!data.genres?.length && comixData.genres?.length) {
                          data.genres = comixData.genres;
                          data.tags = comixData.tags;
                        }
                        setManga({ ...data });
                      }
                    }
                  }
                }
              } catch { /* ignore comix merge errors */ }
            }
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

  // Extract available languages from chapters (mangaball has en/fr/id)
  const availableLangs = useMemo(() => {
    if (!manga?.chapters) return [];
    const langs = new Set<string>();
    for (const ch of manga.chapters) {
      if (ch.lang) langs.add(ch.lang);
    }
    return Array.from(langs).sort();
  }, [manga]);

  // Language display names — full names, not short codes
  const LANG_NAMES: Record<string, string> = {
    en: "English", fr: "French", id: "Indonesian",
    ja: "Japanese", ko: "Korean", zh: "Chinese",
    es: "Spanish", "pt-br": "Portuguese (Brazil)", "pt-pt": "Portuguese (Portugal)",
    pt: "Portuguese", de: "German", ru: "Russian",
    vi: "Vietnamese", it: "Italian", th: "Thai", pl: "Polish",
    ar: "Arabic", bg: "Bulgarian", bn: "Bengali", ca: "Catalan",
    cs: "Czech", da: "Danish", el: "Greek", he: "Hebrew",
    hi: "Hindi", hu: "Hungarian", ms: "Malay", nl: "Dutch",
    no: "Norwegian", ro: "Romanian", sk: "Slovak", sl: "Slovenian",
    sr: "Serbian", sv: "Swedish", tr: "Turkish", uk: "Ukrainian",
  };

  const filteredChapters = useMemo(() => {
    if (!manga?.chapters) return [];
    return manga.chapters
      .filter(ch => {
        // Language filter
        if (selectedLang !== "all" && ch.lang !== selectedLang) return false;
        // Search filter
        if (!chapterSearch) return true;
        const q = chapterSearch.toLowerCase();
        return ch.title.toLowerCase().includes(q) || String(ch.number).includes(q);
      })
      .sort((a, b) => sortOrder === "asc" ? a.number - b.number : b.number - a.number);
  }, [manga, chapterSearch, sortOrder, selectedLang]);

  // Group chapters by number — each group contains all scan/language variants
  const chapterGroups = useMemo(() => {
    const groups: { number: number; scans: MangaChapter[] }[] = [];
    const byNumber = new Map<number, MangaChapter[]>();
    for (const ch of filteredChapters) {
      const arr = byNumber.get(ch.number) || [];
      arr.push(ch);
      byNumber.set(ch.number, arr);
    }
    for (const [number, scans] of byNumber) {
      groups.push({ number, scans });
    }
    groups.sort((a, b) => sortOrder === "asc" ? a.number - b.number : b.number - a.number);
    return groups;
  }, [filteredChapters, sortOrder]);

  const navigateToChapter = useCallback((ch: MangaChapter) => {
    // For mangaball chapters, pass the translation ID (ch.id) as chapterId
    // so the reader fetches the correct language's images.
    // For atsumaru chapters, pass the chapter number (ch.number) as before.
    // The chapterId field is 24 hex chars for mangaball translations,
    // or a number string for atsumaru.
    const chapterId = ch.id && ch.id.length === 24 ? ch.id : String(ch.number);
    navigate({
      page: "manga-read",
      id: mangaId,
      chapterId,
    } as any);
    // Store selected lang in sessionStorage for the reader to use
    try {
      sessionStorage.setItem(`manga-lang-${mangaId}`, selectedLang);
    } catch { /* ignore */ }
  }, [navigate, mangaId, selectedLang]);

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

      {/* ═══ DETAILS / TAGS ═══ */}
      <section className="px-4 md:px-8 lg:px-8 py-4 max-w-5xl">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Author */}
          {authors && authors !== "Unknown" && (
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-bold text-white/40 uppercase tracking-wider">Author</span>
              <span className="text-sm text-white/80">{authors}</span>
            </div>
          )}
          {/* Status */}
          {manga.status && (
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-bold text-white/40 uppercase tracking-wider">Status</span>
              <span className="text-sm text-white/80">{manga.status}</span>
            </div>
          )}
          {/* Type */}
          {manga.type && (
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-bold text-white/40 uppercase tracking-wider">Type</span>
              <span className="text-sm text-white/80 uppercase">{manga.type}</span>
            </div>
          )}
          {/* Year */}
          {manga.year && (
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-bold text-white/40 uppercase tracking-wider">Year</span>
              <span className="text-sm text-white/80">{manga.year}</span>
            </div>
          )}
        </div>

        {/* Tags */}
        {manga.tags && manga.tags.length > 0 && (
          <div className="mt-4">
            <span className="text-[10px] font-bold text-white/40 uppercase tracking-wider mb-2 block">Tags</span>
            <div className="flex flex-wrap gap-1.5">
              {manga.tags.slice(0, 20).map(tag => (
                <span key={tag} className="px-2 py-1 text-[10px] font-medium text-white/50 bg-white/[0.04] border border-white/[0.08] rounded">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Genres */}
        {manga.genres && manga.genres.length > 0 && (
          <div className="mt-4">
            <span className="text-[10px] font-bold text-white/40 uppercase tracking-wider mb-2 block">Genres</span>
            <div className="flex flex-wrap gap-1.5">
              {manga.genres.map(g => (
                <span key={g} className="px-2.5 py-1 text-xs font-medium text-white/60 bg-white/[0.04] border border-white/[0.08] rounded-full">
                  {g}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Available languages */}
        {availableLangs.length > 0 && (
          <div className="mt-4">
            <span className="text-[10px] font-bold text-white/40 uppercase tracking-wider mb-2 block">Available Languages</span>
            <div className="flex flex-wrap gap-1.5">
              {availableLangs.map(lang => (
                <span key={lang} className="px-2.5 py-1 text-xs font-bold rounded" style={{ background: `${ACCENT}15`, color: ACCENT, border: `1px solid ${ACCENT}30` }}>
                  {LANG_NAMES[lang] || lang.toUpperCase()}
                </span>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* ═══ CHAPTERS ═══ */}
      {manga.chapters && manga.chapters.length > 0 && (
        <section className="px-4 md:px-8 lg:px-8 py-8">
          <div className="max-w-5xl">
            {/* Chapter header + controls */}
            <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
              <h2 className="text-lg font-bold text-white">
                Chapters <span className="text-white/40">({chapterGroups.length})</span>
              </h2>
              <div className="flex items-center gap-2">
                {/* Language selector */}
                {availableLangs.length > 1 && (
                  <select
                    value={selectedLang}
                    onChange={e => setSelectedLang(e.target.value)}
                    className="px-3 py-1.5 text-xs font-semibold bg-white/5 border border-white/10 text-white/60 focus:outline-none focus:border-white/30 cursor-pointer"
                    style={{ borderRadius: "4px" }}
                  >
                    <option value="all">All Languages</option>
                    {availableLangs.map(lang => (
                      <option key={lang} value={lang}>
                        {LANG_NAMES[lang] || lang.toUpperCase()}
                      </option>
                    ))}
                  </select>
                )}
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

            {/* Chapter list — grouped by chapter number, each scan shown inline */}
            <div className="flex flex-col gap-2">
              {chapterGroups.slice(0, 100).map(group => (
                <div
                  key={group.number}
                  className="bg-white/[0.03] border border-white/[0.06] overflow-hidden"
                  style={{ borderRadius: "8px" }}
                >
                  {/* Chapter number header */}
                  <div className="flex items-center gap-3 px-4 py-2.5 border-b border-white/[0.04]">
                    <span className="text-sm font-extrabold" style={{ color: ACCENT }}>
                      Ch. {group.number}
                    </span>
                    <span className="text-xs text-white/30">
                      {group.scans.length} scan{group.scans.length > 1 ? "s" : ""}
                    </span>
                  </div>
                  {/* Scan rows */}
                  <div className="flex flex-col">
                    {group.scans.map((scan, si) => (
                      <button
                        key={scan.id}
                        onClick={() => navigateToChapter(scan)}
                        className="group flex items-center gap-3 px-4 py-2 hover:bg-white/[0.06] transition-colors text-left w-full"
                        style={si > 0 ? { borderTop: "1px solid rgba(255,255,255,0.03)" } : {}}
                      >
                        {/* Language badge — show full name */}
                        <span
                          className="shrink-0 px-1.5 py-0.5 text-[8px] font-bold rounded uppercase tracking-wider"
                          style={{
                            background: `${LANG_COLORS[scan.lang || "en"] || "#666"}20`,
                            color: LANG_COLORS[scan.lang || "en"] || "#999",
                            border: `1px solid ${LANG_COLORS[scan.lang || "en"] || "#666"}40`,
                          }}
                        >
                          {LANG_NAMES[scan.lang || "en"] || scan.lang || "Unknown"}
                        </span>
                        {/* Scan group name */}
                        <span className="text-xs font-medium text-white/60 group-hover:text-white/90 transition-colors shrink-0">
                          {scan.scanGroup || "Unknown"}
                        </span>
                        {/* Chapter title */}
                        <span className="flex-1 min-w-0 text-xs text-white/40 truncate">
                          {scan.title || `Chapter ${scan.number}`}
                        </span>
                        {/* Page count */}
                        {scan.pages ? (
                          <span className="text-[10px] text-white/30 shrink-0 hidden sm:inline">
                            {scan.pages}p
                          </span>
                        ) : null}
                        {/* Play icon on hover */}
                        <svg className="w-3.5 h-3.5 text-white/0 group-hover:text-white/60 transition-colors shrink-0" fill="currentColor" viewBox="0 0 24 24">
                          <polygon points="5 3 19 12 5 21 5 3" />
                        </svg>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {chapterGroups.length > 100 && (
              <p className="text-center text-xs text-white/30 mt-6">
                Showing first 100 chapters. Use search to find specific chapters.
              </p>
            )}
          </div>
        </section>
      )}

      {/* ═══ COMMENTS ═══ */}
      <section className="px-4 md:px-8 lg:px-8 py-8">
        <div className="max-w-5xl">
          <h2 className="text-lg font-bold text-white mb-4">Comments</h2>
          <AnimeComments animeId={mangaId} animeTitle={displayTitle} />
        </div>
      </section>
    </div>
  );
}
