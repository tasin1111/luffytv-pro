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

// Language badge colors — includes regional variants (es-419, pt-br, etc.)
// English is white (neutral) so it blends in; only non-English gets colored.
const LANG_COLORS: Record<string, string> = {
  en: "#ffffff",                  // English = white (neutral, no special color)
  es: "#EF4444", "es-419": "#EF4444", "es-es": "#EF4444",
  fr: "#6366F1", "fr-ca": "#6366F1",
  id: "#10B981", it: "#22C55E",
  "pt-br": "#F59E0B", "pt-pt": "#F59E0B", pt: "#F59E0B",
  vi: "#EC4899", zh: "#F43F5E", "zh-hans": "#F43F5E", "zh-hant": "#F43F5E",
  th: "#8B5CF6", pl: "#EAB308", ja: "#06B6D4", ko: "#3B82F6",
  de: "#F97316", ru: "#A855F7", ka: "#14B8A6", ms: "#06B6D4",
  he: "#84CC16",
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
  /** atsu.moe scanlation group ID (links to scanlators[].id on detail). */
  scanId?: string;
  /** Chapter index inside its scanlation (atsu.moe specific). */
  chapterIndex?: number;
}

interface MangaScanlator {
  id: string;
  name: string;
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
  /** Scanlation groups / "sources" for this manga (from atsu.moe). */
  scanlators?: MangaScanlator[];
}

interface MangaDetailProps {
  mangaId: string;
}

export default function MangaDetailPage({ mangaId }: MangaDetailProps) {
  const navigate = useAppStore(s => s.navigate);
  const user = useAppStore(s => s.user);
  const [manga, setManga] = useState<MangaDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [banner, setBanner] = useState<string>("");
  const [chapterSearch, setChapterSearch] = useState("");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [showFullDesc, setShowFullDesc] = useState(false);
  const [selectedLang, setSelectedLang] = useState<string>("all");

  // ── New UI-only state for atsu.moe-style redesign ──
  // (does NOT touch any existing data-fetching / chapter-filter logic)
  const [showAllTags, setShowAllTags] = useState(false);
  const [showAllAltTitles, setShowAllAltTitles] = useState(false);
  const [selectedScanlator, setSelectedScanlator] = useState<string>("all");

  // ── Chapter list pagination ──
  // Replaces the old hard cap of 100. Shows 50 groups at a time with a
  // "Load more" button. Resets to page 1 whenever filters/search/sort change.
  const CHAPTERS_PER_PAGE = 50;
  const [chapterPage, setChapterPage] = useState(1);

  // ── Our own view + rating stats (layered on atsu.moe's base) ──
  const [ourViews, setOurViews] = useState(0);
  const [ourRating, setOurRating] = useState(0);
  const [ourRatingCount, setOurRatingCount] = useState(0);
  const [userRating, setUserRating] = useState<number | null>(null);
  const [ratingInput, setRatingInput] = useState<number>(0);
  const [submittingRating, setSubmittingRating] = useState(false);

  // ── Follow state ──
  const [followCount, setFollowCount] = useState(0);
  const [isFollowing, setIsFollowing] = useState(false);

  // ── Vibe review state (MockTailBar) ──
  const [vibeCounts, setVibeCounts] = useState({ drop: 0, bold: 0, great: 0, recommended: 0 });
  const [vibeTotal, setVibeTotal] = useState(0);
  const [userVibe, setUserVibe] = useState<string | null>(null);

  // ── Increment our view counter + fetch our ratings ──
  // Fires on mount AND when `user.username` changes (so a late-arriving
  // session still picks up the user's existing rating without a remount).
  // The view-counter POST also re-fires on login, but /api/manga/view is
  // idempotent enough (just increments) that the small over-count is
  // acceptable in exchange for correct rating display.
  useEffect(() => {
    if (!mangaId) return;

    // Increment view count (fire-and-forget)
    fetch(`/api/manga/view?mangaId=${encodeURIComponent(mangaId)}`, { method: "POST" })
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data?.ourViews != null) setOurViews(data.ourViews);
      })
      .catch(() => {});

    // Fetch our own ratings (and the user's rating if logged in)
    const username = user?.username || "";
    const ratingsUrl = `/api/manga/ratings?mangaId=${encodeURIComponent(mangaId)}${username ? `&username=${encodeURIComponent(username)}` : ""}`;
    fetch(ratingsUrl)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (!data) return;
        setOurViews(data.ourViews || 0);
        setOurRating(data.ourRating || 0);
        setOurRatingCount(data.ourRatingCount || 0);
        if (data.userRating != null) {
          setUserRating(data.userRating);
          setRatingInput(data.userRating);
        }
      })
      .catch(() => {});

    // Fetch follow count + isFollowing
    const followUrl = `/api/manga/follow?mangaId=${encodeURIComponent(mangaId)}${username ? `&username=${encodeURIComponent(username)}` : ""}`;
    fetch(followUrl)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (!data) return;
        setFollowCount(data.follows || 0);
        setIsFollowing(data.isFollowing || false);
      })
      .catch(() => {});

    // Fetch vibe reviews (MockTailBar)
    const vibeUrl = `/api/manga/vibe-review?mangaId=${encodeURIComponent(mangaId)}${username ? `&username=${encodeURIComponent(username)}` : ""}`;
    fetch(vibeUrl)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (!data) return;
        setVibeCounts(data.counts || { drop: 0, bold: 0, great: 0, recommended: 0 });
        setVibeTotal(data.total || 0);
        setUserVibe(data.userVibe || null);
      })
      .catch(() => {});
  }, [mangaId, user?.username]);

  // ── Toggle follow ──
  const toggleFollow = async () => {
    const username = user?.username;
    if (!username) { alert("Please sign in to follow manga."); return; }
    try {
      const res = await fetch("/api/manga/follow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mangaId, username }),
      });
      if (res.ok) {
        const data = await res.json();
        setFollowCount(data.follows);
        setIsFollowing(data.isFollowing);
      }
    } catch { /* ignore */ }
  };

  // ── Submit vibe review ──
  const submitVibe = async (vibe: string) => {
    const username = user?.username;
    if (!username) { alert("Please sign in to review."); return; }
    try {
      const res = await fetch("/api/manga/vibe-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mangaId, username, vibe }),
      });
      if (res.ok) {
        const data = await res.json();
        setVibeCounts(data.counts);
        setVibeTotal(data.total);
        setUserVibe(data.userVibe);
      }
    } catch { /* ignore */ }
  };

  // ── Submit a rating ──
  const submitRating = async (rating: number) => {
    if (!user || submittingRating) return;
    setSubmittingRating(true);
    try {
      const res = await fetch("/api/manga/rate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mangaId,
          username: user.username,
          rating,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setUserRating(data.rating);
        setOurRating(data.ourRating);
        setOurRatingCount(data.ourRatingCount);
        setRatingInput(data.rating);
      }
    } catch { /* ignore */ }
    setSubmittingRating(false);
  };

  // ── Combined stats (atsu.moe base + our own) ──
  // Only use OUR OWN views/ratings (not atsu.moe's).
  // Starts at 0, goes up as people view/rate on our site.
  const combinedViews = ourViews;
  const combinedRating = ourRating;

  // ── Load manga detail ──
  useEffect(() => {
    let fbTitle = "";
    let fbPoster = "";
    let data: MangaDetailData | null = null;

    async function load() {
      setLoading(true);
      try {
        // Get fallback title from sessionStorage (for cross-provider metadata merge)
        try {
          fbTitle = sessionStorage.getItem(`manga-title-${mangaId}`) || "";
          fbPoster = sessionStorage.getItem(`manga-poster-${mangaId}`) || "";
        } catch { /* ignore */ }

        // Pass title to the API for cross-provider fallback
        const titleParam = fbTitle ? `&title=${encodeURIComponent(fbTitle)}` : "";
        const res = await fetch(`/api/manga/detail?id=${encodeURIComponent(mangaId)}${titleParam}`);
        if (res.ok) {
          data = await res.json() as MangaDetailData;

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
        }
      } catch { /* ignore */ }

      // Set loading=false — page renders immediately with mangaball data
      setLoading(false);

      // CLIENT-SIDE cross-provider merge (runs AFTER page renders):
      // - If atsumaru manga (at:): search mangaball, merge its chapters (all languages)
      // - If mangaball manga (mb:): search atsumaru, prepend its English chapters
      // - If comix manga (cx:): search atsumaru, merge atsumaru + mangaball chapters
      // Result for at:/mb:: ALL English scans from atsumaru + ALL mangaball chapters
      // Result for cx:: comix chapters + atsumaru English + mangaball multi-lang
      // CLIENT-SIDE cross-provider merge (FALLBACK only):
      // The server-side detail route now does the cross-provider merge
      // in parallel (atsumaru + mangaball). This client-side merge only
      // runs as a fallback if the server merge didn't produce multi-language
      // chapters (e.g., if the server-side mangaball fetch timed out).
      if (data?.chapters?.length) {
        // Check if the server already merged multi-language chapters
        const serverLangs = new Set(data.chapters.map((ch: any) => ch.lang || "en").filter(Boolean));
        const titleForSearch = fbTitle || data.englishTitle || data.title || "";
        if (titleForSearch && titleForSearch !== "Unknown Title" && serverLangs.size <= 1) {
          (async () => {
            try {
              if (mangaId.startsWith("mb:")) {
                // Mangaball manga → search atsumaru for English chapters
                const searchRes = await fetch(
                  `/api/manga/search?q=${encodeURIComponent(titleForSearch)}`
                );
                if (searchRes.ok) {
                  const searchData = await searchRes.json();
                  const results = searchData.results || [];
                  const match = results.find((r: any) => {
                    const rTitle = (r.englishTitle || r.title || "").toLowerCase();
                    const sTitle = titleForSearch.toLowerCase();
                    return rTitle.includes(sTitle) || sTitle.includes(rTitle) ||
                           rTitle.slice(0, 20) === sTitle.slice(0, 20);
                  }) || results[0];

                  if (match) {
                    const atsuMangaId = match.id.replace(/^at:/, "");
                    const atsuRes = await fetch(`/api/manga/detail?id=at:${atsuMangaId}`);
                    if (atsuRes.ok) {
                      const atsuData = await atsuRes.json();
                      if (atsuData.chapters?.length) {
                        // Preserve the real scanlator name from atsu.moe
                        // (e.g. "Gamma", "Alpha") so we can derive the
                        // "English 1/English 2" label from scanId.
                        const atsuEnChapters = atsuData.chapters.map((ch: any) => ({
                          ...ch,
                          id: `at:${atsuMangaId}:${ch.number}:${ch.id}`,
                          lang: "en",
                          scanGroup: ch.scanGroup,
                          scanId: ch.scanId,
                        }));
                        setManga(prev => prev ? {
                          ...prev,
                          chapters: [...atsuEnChapters, ...(prev.chapters || [])],
                          totalChapters: (prev.chapters?.length || 0) + atsuEnChapters.length,
                          scanlators: prev.scanlators?.length
                            ? prev.scanlators
                            : (atsuData.scanlators || []),
                        } : prev);
                      }
                    }
                  }
                }
              } else if (mangaId.startsWith("at:")) {
                // Atsumaru manga → search mangaball for ALL chapters (English + non-English)
                // Note: mangaball's English chapters are also appended (not just
                // non-English) so users get a wider selection of English scans.
                const searchRes = await fetch(
                  `/api/manga/search?q=${encodeURIComponent(titleForSearch)}`
                );
                if (searchRes.ok) {
                  const searchData = await searchRes.json();
                  const results = searchData.results || [];
                  // Find mangaball result (mb: prefix)
                  const mbMatch = results.find((r: any) => r.id?.startsWith("mb:"));

                  if (mbMatch) {
                    const mbRes = await fetch(`/api/manga/detail?id=${encodeURIComponent(mbMatch.id)}`);
                    if (mbRes.ok) {
                      const mbData = await mbRes.json();
                      if (mbData.chapters?.length) {
                        // Add ALL mangaball chapters (English + non-English)
                        setManga(prev => prev ? {
                          ...prev,
                          chapters: [...(prev.chapters || []), ...mbData.chapters],
                          totalChapters: (prev.chapters?.length || 0) + mbData.chapters.length,
                        } : prev);
                      }
                    }
                  }
                }
              } else if (mangaId.startsWith("cx:")) {
                // Comix manga → search BOTH atsumaru (English) + mangaball (multi-lang)
                // and append their chapters. Comix is English-only, so this gives
                // users access to other languages via the other providers.
                const searchRes = await fetch(
                  `/api/manga/search?q=${encodeURIComponent(titleForSearch)}`
                );
                if (searchRes.ok) {
                  const searchData = await searchRes.json();
                  const results = searchData.results || [];
                  const atMatch = results.find((r: any) => r.id?.startsWith("at:"));
                  const mbMatch = results.find((r: any) => r.id?.startsWith("mb:"));

                  const merges: any[] = [];
                  // Atsumaru English chapters
                  if (atMatch) {
                    try {
                      const atsuRes = await fetch(`/api/manga/detail?id=${encodeURIComponent(atMatch.id)}`);
                      if (atsuRes.ok) {
                        const atsuData = await atsuRes.json();
                        const atsuMangaId = atMatch.id.replace(/^at:/, "");
                        for (const ch of (atsuData.chapters || [])) {
                          merges.push({
                            ...ch,
                            id: `at:${atsuMangaId}:${ch.number}:${ch.id}`,
                            lang: "en",
                          });
                        }
                      }
                    } catch { /* ignore */ }
                  }
                  // Mangaball multi-language chapters
                  if (mbMatch) {
                    try {
                      const mbRes = await fetch(`/api/manga/detail?id=${encodeURIComponent(mbMatch.id)}`);
                      if (mbRes.ok) {
                        const mbData = await mbRes.json();
                        merges.push(...(mbData.chapters || []));
                      }
                    } catch { /* ignore */ }
                  }
                  if (merges.length > 0) {
                    setManga(prev => prev ? {
                      ...prev,
                      chapters: [...(prev.chapters || []), ...merges],
                      totalChapters: (prev.chapters?.length || 0) + merges.length,
                    } : prev);
                  }
                }
              }
            } catch { /* ignore merge errors */ }
          })();
        }
      }
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

  // Language display names — full names, includes regional variants
  // (es-419 = Latin American Spanish, zh-hans = Simplified Chinese, etc.)
  const LANG_NAMES: Record<string, string> = {
    en: "English", fr: "French", "fr-ca": "French (Canada)", id: "Indonesian",
    ja: "Japanese", ko: "Korean",
    zh: "Chinese", "zh-hans": "Chinese (Simplified)", "zh-hant": "Chinese (Traditional)",
    es: "Spanish", "es-419": "Spanish", "es-es": "Spanish (Spain)",
    "pt-br": "Portuguese (Brazil)", "pt-pt": "Portuguese (Portugal)", pt: "Portuguese",
    de: "German", ru: "Russian",
    vi: "Vietnamese", it: "Italian", th: "Thai", pl: "Polish",
    ar: "Arabic", bg: "Bulgarian", bn: "Bengali", ca: "Catalan",
    cs: "Czech", da: "Danish", el: "Greek", he: "Hebrew",
    hi: "Hindi", hu: "Hungarian", ms: "Malay", nl: "Dutch",
    no: "Norwegian", ro: "Romanian", sk: "Slovak", sl: "Slovenian",
    sr: "Serbian", sv: "Swedish", tr: "Turkish", uk: "Ukrainian",
    ka: "Georgian",
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

  // ── Normalize a language code to its base language ──
  // e.g. "es-419" → "es", "pt-br" → "pt", "zh-hans" → "zh"
  // This is used for grouping chapters by language so that
  // "es-419" and "es" are treated as the same language.
  const normalizeLang = (lang: string): string => {
    if (!lang) return "en";
    // Keep pt-br as-is (it's a common distinct code), but strip other regional variants
    if (lang === "pt-br" || lang === "pt-pt") return lang;
    return lang.split("-")[0];
  };

  // ── Build a stable language-based label for each chapter row ──
  // Shows "English 1", "English 2", "Indonesian 1", etc. with the
  // scanlator name appended so users can identify which scanlation
  // each row is (e.g. "English 1 (Gamma)").
  //
  // We compute the index PER (chapter number, language) group, stable-sorted
  // by scanId so the same scanlation always gets the same number across
  // different chapter numbers.
  const chapterLabel = useCallback((ch: MangaChapter): string => {
    const lang = ch.lang || "en";
    const langName = LANG_NAMES[lang] || LANG_NAMES[normalizeLang(lang)] || lang.toUpperCase();
    const baseLang = normalizeLang(lang);
    // Find all scans of the SAME chapter number AND same base language
    const sameLangScans = (manga?.chapters || [])
      .filter(c => c.number === ch.number && normalizeLang(c.lang || "en") === baseLang)
      .sort((a, b) => (a.scanId || a.id || "").localeCompare(b.scanId || b.id || ""));
    // If only one scan for this language, no suffix needed
    if (sameLangScans.length <= 1) return langName;
    const idx = sameLangScans.findIndex(c => c.id === ch.id);
    return `${langName} ${idx + 1}`;
  }, [manga]);

  const navigateToChapter = useCallback((ch: MangaChapter) => {
    // Build the chapterId to pass to the reader. Three cases:
    //   1. Mangaball translation ID (24 hex chars) → pass as-is
    //   2. Atsumaru short chapter ID (e.g. "LMHqVf") → pass as-is
    //      (the reader's /api/manga/read route will detect it and build
    //       /static/pages/{chapterId}/{i}.webp URLs directly)
    //   3. Atsumaru cross-provider merge ID
    //      "at:{mangaId}:{number}:{chapterId}" → pass as-is
    //      (the reader will extract the real chapter ID from the last segment)
    //   4. Atsumaru chapter number only (legacy) → pass as string number
    let chapterId: string;
    if (ch.id && ch.id.length === 24) {
      // Mangaball translation ID
      chapterId = ch.id;
    } else if (ch.id && ch.id.startsWith("at:")) {
      // Cross-provider merge format — pass as-is
      chapterId = ch.id;
    } else if (ch.id && /^[A-Za-z0-9_-]{3,20}$/.test(ch.id) && !/^\d+$/.test(ch.id)) {
      // Short atsu.moe chapter ID
      chapterId = ch.id;
    } else {
      // Fallback: chapter number
      chapterId = String(ch.number);
    }
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

  // ── UI helpers for atsu.moe-style redesign (pure functions, no data logic) ──
  const formatViews = (views: number | string | undefined | null): string => {
    if (views == null) return "0";
    const n = typeof views === "number"
      ? views
      : parseInt(String(views).replace(/[^0-9]/g, ""), 10) || 0;
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
    if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
    return String(n);
  };

  const formatRelativeDate = (dateStr?: string): string => {
    if (!dateStr) return "";
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return "";
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      if (diffMs < 0) return "just now";
      const seconds = Math.floor(diffMs / 1000);
      const minutes = Math.floor(seconds / 60);
      const hours = Math.floor(minutes / 60);
      const days = Math.floor(hours / 24);
      const weeks = Math.floor(days / 7);
      const months = Math.floor(days / 30);
      const years = Math.floor(days / 365);
      if (years > 0) return years === 1 ? "last year" : `${years} years ago`;
      if (months > 0) return months === 1 ? "last month" : `${months} months ago`;
      if (weeks > 0) return weeks === 1 ? "last week" : `${weeks} weeks ago`;
      if (days > 0) return days === 1 ? "yesterday" : `${days} days ago`;
      if (hours > 0) return hours === 1 ? "1 hour ago" : `${hours} hours ago`;
      if (minutes > 0) return minutes === 1 ? "1 minute ago" : `${minutes} minutes ago`;
      return "just now";
    } catch { return ""; }
  };

  // Reset chapter pagination to page 1 whenever filters/search/sort change.
  useEffect(() => {
    setChapterPage(1);
  }, [chapterSearch, sortOrder, selectedLang, selectedScanlator]);

  // Scanlation-group filter — applied on top of existing chapterGroups.
  // Does NOT modify any existing useMemo / filter logic.
  const visibleChapterGroups = useMemo(() => {
    if (selectedScanlator === "all") return chapterGroups;
    return chapterGroups
      .map(g => ({ ...g, scans: g.scans.filter(s => s.scanId === selectedScanlator) }))
      .filter(g => g.scans.length > 0);
  }, [chapterGroups, selectedScanlator]);

  // ── atsu.moe design tokens ──
  // ── Color tokens — pure black base, blue accent for chapters/scanlators ──
  const COLOR_BG = "#000000";              // pure black background
  const COLOR_TEXT = "#b0b0b0";            // medium gray body text
  const COLOR_HEADING = "#ffffff";         // pure white headings
  const COLOR_ACCENT = "#1e88ff";          // blue — used for chapter names, scanlator names, rating star
  const COLOR_SLATE3 = "#1a1a1a";          // darkest panel (genre pills)
  const COLOR_SLATE2 = "#141414";          // darker panel (tag pills, hover bg)
  const COLOR_MUTED = "#666666";           // muted gray for labels
  const COLOR_BORDER = "#222222";          // subtle border
  const FONT_STACK = "Geist, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

  const genrePillStyle = {
    background: COLOR_SLATE3,
    color: COLOR_HEADING,
    padding: "4px 8px",
    borderRadius: "6px",
    fontSize: "12px",
    display: "inline-block",
  } as const;

  const tagPillStyle = {
    background: COLOR_SLATE2,
    color: "rgba(249,248,246,0.8)",
    padding: "4px 8px",
    borderRadius: "6px",
    fontSize: "12px",
    display: "inline-block",
  } as const;

  const metaLabelStyle = {
    color: COLOR_MUTED,
    fontSize: "11px",
    fontWeight: 600,
    letterSpacing: "0.05em",
    textTransform: "uppercase",
    marginBottom: "4px",
  } as const;

  const metaValueStyle = {
    color: COLOR_HEADING,
    fontSize: "14px",
  } as const;

  const controlStyle = {
    background: COLOR_SLATE2,
    color: COLOR_HEADING,
    border: "1px solid #424144",
    borderRadius: "6px",
    padding: "6px 10px",
    fontSize: "13px",
    outline: "none",
    cursor: "pointer",
    fontFamily: FONT_STACK,
  } as const;

  const linkButtonStyle = {
    background: "transparent",
    border: "none",
    color: COLOR_ACCENT,
    cursor: "pointer",
    padding: "4px 8px",
    fontSize: "12px",
    fontFamily: FONT_STACK,
  } as const;

  // ── Loading ──
  if (loading) {
    return (
      <div style={{
        minHeight: "100vh",
        background: COLOR_BG,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}>
        <style>{`@keyframes atsu-spin { to { transform: rotate(360deg); } }`}</style>
        <div style={{
          width: "40px",
          height: "40px",
          border: "3px solid rgba(142,124,230,0.2)",
          borderTopColor: COLOR_ACCENT,
          borderRadius: "50%",
          animation: "atsu-spin 0.8s linear infinite",
        }} />
      </div>
    );
  }

  if (!manga) {
    return (
      <div style={{
        minHeight: "100vh",
        background: COLOR_BG,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: COLOR_MUTED,
        fontFamily: FONT_STACK,
        fontSize: "16px",
      }}>
        Manga not found.
      </div>
    );
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: COLOR_BG,
      color: COLOR_TEXT,
      fontFamily: FONT_STACK,
    }}>
      <div style={{ maxWidth: "900px", margin: "0 auto", padding: "24px" }}>
        <div className="grid grid-cols-1 md:grid-cols-[210px_1fr]" style={{ gap: "32px" }}>
          {/* ═══ LEFT COLUMN — poster + actions + side meta ═══ */}
          <aside
            className="md:sticky md:top-6 md:self-start"
            style={{ display: "flex", flexDirection: "column", gap: "12px" }}
          >
            {/* Poster (2:3 aspect ratio) */}
            {poster && (
              <div style={{
                width: "100%",
                aspectRatio: "2 / 3",
                borderRadius: "8px",
                overflow: "hidden",
                background: COLOR_SLATE2,
              }}>
                <img
                  src={poster}
                  alt={displayTitle}
                  style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                />
              </div>
            )}

            {/* Read First Chapter — primary purple button */}
            {manga.chapters && manga.chapters.length > 0 && (
              <button
                onClick={() => navigateToChapter(
                  [...manga.chapters!].sort((a, b) => a.number - b.number)[0]
                )}
                style={{
                  width: "100%",
                  padding: "12px",
                  borderRadius: "8px",
                  background: COLOR_ACCENT,
                  color: "#ffffff",
                  fontWeight: 600,
                  fontSize: "14px",
                  border: "none",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                  fontFamily: FONT_STACK,
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
                  <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
                </svg>
                Read First Chapter
              </button>
            )}

            {/* Latest Chapter — secondary slate button */}
            {manga.chapters && manga.chapters.length > 1 && (
              <button
                onClick={() => navigateToChapter(
                  [...manga.chapters!].sort((a, b) => b.number - a.number)[0]
                )}
                style={{
                  width: "100%",
                  padding: "12px",
                  borderRadius: "8px",
                  background: COLOR_SLATE3,
                  color: COLOR_HEADING,
                  fontWeight: 500,
                  fontSize: "14px",
                  border: "1px solid #424144",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                  fontFamily: FONT_STACK,
                }}
              >
                Latest Chapter
              </button>
            )}

            {/* Rating (with purple star) */}
            {manga.rating ? (
              <div style={{ display: "flex", alignItems: "center", gap: "6px", padding: "8px 0 4px" }}>
                <svg width="16" height="16" viewBox="0 0 20 20" fill={COLOR_ACCENT}>
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
                <span style={{ color: COLOR_HEADING, fontWeight: 600, fontSize: "14px" }}>
                  {combinedRating > 0 ? combinedRating.toFixed(1) : "0.0"}/10
                </span>
                <span style={{ color: COLOR_MUTED, fontSize: "12px" }}>average</span>
              </div>
            ) : null}

            {/* Views — our own (starts at 0, goes up as people view) */}
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={COLOR_TEXT} strokeWidth={2}>
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
              <span style={{ color: COLOR_HEADING, fontSize: "14px" }}>
                {formatViews(combinedViews)} views
              </span>
            </div>

            {/* Scanlation groups */}
            {manga.scanlators && manga.scanlators.length > 0 && (
              <div style={{ marginTop: "8px" }}>
                <div style={{
                  color: COLOR_MUTED,
                  fontSize: "11px",
                  fontWeight: 600,
                  letterSpacing: "0.05em",
                  textTransform: "uppercase",
                  marginBottom: "8px",
                }}>
                  Groups
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                  {manga.scanlators.map(s => (
                    <span key={s.id} style={genrePillStyle}>{s.name}</span>
                  ))}
                </div>
              </div>
            )}

            {/* External links */}
            {(manga.anilistId || manga.malId) && (
              <div style={{ marginTop: "8px" }}>
                <div style={{
                  color: COLOR_MUTED,
                  fontSize: "11px",
                  fontWeight: 600,
                  letterSpacing: "0.05em",
                  textTransform: "uppercase",
                  marginBottom: "8px",
                }}>
                  Links
                </div>
                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                  {manga.anilistId && (
                    <a
                      href={`https://anilist.co/manga/${manga.anilistId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        background: COLOR_SLATE3,
                        color: COLOR_HEADING,
                        padding: "6px 10px",
                        borderRadius: "6px",
                        fontSize: "12px",
                        textDecoration: "none",
                        fontFamily: FONT_STACK,
                      }}
                    >
                      AniList
                    </a>
                  )}
                  {manga.malId && (
                    <a
                      href={`https://myanimelist.net/manga/${manga.malId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        background: COLOR_SLATE3,
                        color: COLOR_HEADING,
                        padding: "6px 10px",
                        borderRadius: "6px",
                        fontSize: "12px",
                        textDecoration: "none",
                        fontFamily: FONT_STACK,
                      }}
                    >
                      MAL
                    </a>
                  )}
                </div>
              </div>
            )}
            {/* Rating widget — let logged-in users rate this manga (0-10)
                Uses our own MangaRating table. Each user can rate once.
                The rating is blended with atsu.moe's base rating for display. */}
            {user ? (
              <div style={{
                marginBottom: "28px",
                padding: "16px",
                background: COLOR_SLATE2,
                borderRadius: "8px",
                border: `1px solid ${COLOR_BORDER}`,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
                  <span style={{ fontSize: "13px", fontWeight: 600, color: COLOR_HEADING }}>
                    {userRating != null ? "Your rating:" : "Rate this manga:"}
                  </span>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <input
                      type="range"
                      min={0}
                      max={10}
                      step={0.5}
                      value={ratingInput}
                      onChange={(e) => setRatingInput(parseFloat(e.target.value))}
                      style={{
                        width: "200px",
                        accentColor: COLOR_ACCENT,
                        cursor: "pointer",
                      }}
                    />
                    <span style={{
                      fontSize: "18px",
                      fontWeight: 700,
                      color: COLOR_ACCENT,
                      minWidth: "48px",
                      textAlign: "center",
                    }}>
                      {ratingInput.toFixed(1)}
                    </span>
                  </div>
                  <button
                    onClick={() => submitRating(ratingInput)}
                    disabled={submittingRating || (userRating === ratingInput && userRating != null)}
                    style={{
                      padding: "6px 16px",
                      background: submittingRating ? "#555" : COLOR_ACCENT,
                      color: "#fff",
                      border: "none",
                      borderRadius: "6px",
                      fontSize: "12px",
                      fontWeight: 700,
                      cursor: submittingRating ? "not-allowed" : "pointer",
                      opacity: submittingRating ? 0.6 : 1,
                    }}
                  >
                    {submittingRating ? "Saving..." : userRating != null ? "Update" : "Submit"}
                  </button>
                  {userRating != null && (
                    <span style={{ fontSize: "11px", color: COLOR_MUTED }}>
                      You rated this {userRating.toFixed(1)}/10
                    </span>
                  )}
                </div>
                {ourRatingCount > 0 && (
                  <p style={{ fontSize: "11px", color: COLOR_MUTED, margin: "8px 0 0" }}>
                    {ourRatingCount} {ourRatingCount === 1 ? "user has" : "users have"} rated this manga — our average: {ourRating.toFixed(1)}/10
                  </p>
                )}
              </div>
            ) : (
              <div style={{
                marginBottom: "28px",
                padding: "12px 16px",
                background: COLOR_SLATE2,
                borderRadius: "8px",
                border: `1px solid ${COLOR_BORDER}`,
                fontSize: "12px",
                color: COLOR_MUTED,
              }}>
                <button
                  onClick={() => navigate({ page: "signin" } as any)}
                  style={{
                    background: "none",
                    border: "none",
                    color: COLOR_ACCENT,
                    fontSize: "12px",
                    fontWeight: 600,
                    cursor: "pointer",
                    padding: 0,
                    textDecoration: "underline",
                  }}
                >
                  Sign in
                </button>
                {" "}to rate this manga
              </div>
            )}

          </aside>

          {/* ═══ RIGHT COLUMN — title + meta + synopsis + chapters ═══ */}
          <div style={{ minWidth: 0 }}>
            {/* Title */}
            <h1 style={{
              color: COLOR_HEADING,
              fontSize: "30px",
              fontWeight: 700,
              lineHeight: 1.2,
              marginTop: 0,
              marginBottom: "16px",
            }}>
              {displayTitle}
            </h1>

            {/* Type / Status / Year badges */}
            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "16px" }}>
              {manga.type && <span style={genrePillStyle}>{manga.type}</span>}
              {manga.status && <span style={genrePillStyle}>{manga.status}</span>}
              {manga.year ? <span style={genrePillStyle}>{manga.year}</span> : null}
            </div>

            {/* Genres */}
            {manga.genres && manga.genres.length > 0 && (
              <div style={{ marginBottom: "12px" }}>
                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                  {manga.genres.map(g => (
                    <span key={g} style={genrePillStyle}>{g}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Tags (first 15, with Show more) */}
            {manga.tags && manga.tags.length > 0 && (
              <div style={{ marginBottom: "20px" }}>
                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", alignItems: "center" }}>
                  {(showAllTags ? manga.tags : manga.tags.slice(0, 15)).map(tag => (
                    <span key={tag} style={tagPillStyle}>{tag}</span>
                  ))}
                  {manga.tags.length > 15 && (
                    <button
                      onClick={() => setShowAllTags(!showAllTags)}
                      style={linkButtonStyle}
                    >
                      {showAllTags ? "Show less" : `+${manga.tags.length - 15} more`}
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Stats line — our own rating • our own views • chapters
                Stats start at 0 and go up as people view/rate on our site. */}
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              flexWrap: "wrap",
              color: COLOR_TEXT,
              fontSize: "14px",
              marginBottom: "16px",
            }}>
              <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                <svg width="14" height="14" viewBox="0 0 20 20" fill={COLOR_ACCENT}>
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
                <span style={{ color: COLOR_HEADING, fontWeight: 600 }}>
                  {combinedRating > 0 ? combinedRating.toFixed(1) : "0.0"}/10
                </span>
                <span style={{ color: COLOR_MUTED }}>
                  average rating
                  {ourRatingCount > 0 && (
                    <span style={{ color: COLOR_MUTED, fontSize: "11px" }}>
                      {" "}({ourRatingCount} {ourRatingCount === 1 ? "rating" : "ratings"})
                    </span>
                  )}
                </span>
              </span>
              <span style={{ color: COLOR_MUTED }}>•</span>
              <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={COLOR_TEXT} strokeWidth={2}>
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
                <span style={{ color: COLOR_HEADING, fontWeight: 600 }}>{formatViews(combinedViews)}</span>
                <span style={{ color: COLOR_MUTED }}>views</span>
              </span>
              {manga.totalChapters != null && (
                <>
                  <span style={{ color: COLOR_MUTED }}>•</span>
                  <span>
                    <span style={{ color: COLOR_HEADING, fontWeight: 600 }}>{manga.totalChapters}</span>
                    <span style={{ color: COLOR_MUTED }}> chapters</span>
                  </span>
                </>
              )}
            </div>

            {/* ── Follow button + Follow count ── */}
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
              <button
                onClick={toggleFollow}
                style={{
                  padding: "8px 20px", borderRadius: "8px", border: "none", cursor: "pointer",
                  background: isFollowing ? "rgba(255,255,255,0.1)" : "#1e88ff",
                  color: "#fff", fontSize: "14px", fontWeight: 700,
                  display: "flex", alignItems: "center", gap: "6px",
                  transition: "all 0.15s",
                }}
              >
                {isFollowing ? (
                  <>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" /></svg>
                    Following
                  </>
                ) : (
                  <>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" /></svg>
                    Follow
                  </>
                )}
              </button>
              <span style={{ color: COLOR_MUTED, fontSize: "13px" }}>
                <span style={{ color: COLOR_HEADING, fontWeight: 600 }}>{followCount}</span> following
              </span>
            </div>

            {/* ══ CHARTS ROW: Luffi Chart (left/middle) + VibeChart (right) ══ */}
            <div style={{ display: "flex", gap: "24px", marginBottom: "20px", flexWrap: "wrap", alignItems: "flex-start" }}>

              {/* ── Luffi Chart (semicircular gauge) — 4-option review ── */}
              <div style={{ flex: "1", minWidth: "300px" }}>
                <div style={{ color: COLOR_MUTED, fontSize: "14px", fontWeight: 600, marginBottom: "10px" }}>
                  Luffi Meter {vibeTotal > 0 && `(${vibeTotal} votes)`}
                </div>
                <LuffiChart
                  counts={vibeCounts}
                  total={vibeTotal}
                  userVibe={userVibe}
                  onVote={submitVibe}
                />
              </div>

              {/* ── VibeChart (donut) — genre mix ── */}
              {manga.genres && manga.genres!.length > 0 && (
                <div style={{ width: "300px", flexShrink: 0 }}>
                  <div style={{ color: COLOR_MUTED, fontSize: "14px", fontWeight: 600, marginBottom: "10px" }}>
                    Vibe Chart
                  </div>
                  <VibeDonutChart genres={manga.genres!} />
                </div>
              )}
            </div>

            {/* Meta grid — TYPE / STATUS / YEAR / AUTHORS / ARTIST / OTHER NAMES */}
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
              gap: "16px",
              marginBottom: "28px",
            }}>
              {manga.type && (
                <div>
                  <div style={metaLabelStyle}>Type</div>
                  <div style={metaValueStyle}>{manga.type}</div>
                </div>
              )}
              {manga.status && (
                <div>
                  <div style={metaLabelStyle}>Status</div>
                  <div style={metaValueStyle}>{manga.status}</div>
                </div>
              )}
              {manga.year ? (
                <div>
                  <div style={metaLabelStyle}>Year</div>
                  <div style={metaValueStyle}>{manga.year}</div>
                </div>
              ) : null}
              {authors && authors !== "Unknown" && (
                <div>
                  <div style={metaLabelStyle}>Authors</div>
                  <div style={metaValueStyle}>{authors}</div>
                </div>
              )}
              {manga.artists && manga.artists.length > 0 && (
                <div>
                  <div style={metaLabelStyle}>Artist</div>
                  <div style={metaValueStyle}>{manga.artists.join(", ")}</div>
                </div>
              )}
              {manga.altTitles && manga.altTitles.length > 0 && (
                <div>
                  <div style={metaLabelStyle}>Other Names</div>
                  <div style={{ ...metaValueStyle, display: "flex", flexDirection: "column", gap: "2px" }}>
                    {(showAllAltTitles ? manga.altTitles : manga.altTitles.slice(0, 3)).map((alt, i) => (
                      <span key={i}>{alt}</span>
                    ))}
                    {manga.altTitles.length > 3 && (
                      <button
                        onClick={() => setShowAllAltTitles(!showAllAltTitles)}
                        style={{ ...linkButtonStyle, padding: "2px 0", textAlign: "left" }}
                      >
                        {showAllAltTitles ? "Show less" : `+${manga.altTitles.length - 3} more`}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Synopsis */}
            {cleanDesc && (
              <section style={{ marginBottom: "32px" }}>
                <h2 style={{
                  color: COLOR_HEADING,
                  fontSize: "20px",
                  fontWeight: 600,
                  marginTop: 0,
                  marginBottom: "8px",
                }}>Synopsis</h2>
                <p style={{
                  color: COLOR_TEXT,
                  fontSize: "14px",
                  lineHeight: 1.6,
                  margin: 0,
                }}>
                  {descDisplay}
                </p>
                {cleanDesc.length > 400 && (
                  <button
                    onClick={() => setShowFullDesc(!showFullDesc)}
                    style={{ ...linkButtonStyle, padding: "4px 0", fontSize: "13px", marginTop: "4px" }}
                  >
                    {showFullDesc ? "Read less" : "Read more"}
                  </button>
                )}
              </section>
            )}

            {/* Chapters */}
            {manga.chapters && manga.chapters.length > 0 && (
              <section style={{ marginBottom: "40px" }}>
                <h2 style={{
                  color: COLOR_HEADING,
                  fontSize: "24px",
                  fontWeight: 400,
                  marginTop: 0,
                  marginBottom: "16px",
                }}>
                  Chapters{" "}
                  <span style={{ color: COLOR_MUTED, fontSize: "16px" }}>
                    ({visibleChapterGroups.length})
                  </span>
                </h2>

                {/* Controls row */}
                <div style={{
                  display: "flex",
                  gap: "8px",
                  flexWrap: "wrap",
                  marginBottom: "16px",
                  alignItems: "center",
                }}>
                  {availableLangs.length > 0 && (
                    <select
                      value={selectedLang}
                      onChange={e => setSelectedLang(e.target.value)}
                      style={controlStyle}
                    >
                      <option value="all">All Languages</option>
                      {availableLangs.map(lang => (
                        <option key={lang} value={lang}>
                          {LANG_NAMES[lang] || lang.toUpperCase()}
                        </option>
                      ))}
                    </select>
                  )}
                  {manga.scanlators && manga.scanlators.length > 0 && (
                    <select
                      value={selectedScanlator}
                      onChange={e => setSelectedScanlator(e.target.value)}
                      style={controlStyle}
                    >
                      <option value="all">All Groups</option>
                      {manga.scanlators.map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  )}
                  <input
                    type="text"
                    placeholder="Search chapters..."
                    value={chapterSearch}
                    onChange={e => setChapterSearch(e.target.value)}
                    style={{
                      ...controlStyle,
                      flex: "1 1 200px",
                      minWidth: "150px",
                    }}
                  />
                  <button
                    onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
                    style={controlStyle}
                  >
                    {sortOrder === "asc" ? "↑ Asc" : "↓ Desc"}
                  </button>
                </div>

                {/* Chapter list — grouped by number, paginated */}
                <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                  {visibleChapterGroups.slice(0, chapterPage * CHAPTERS_PER_PAGE).map(group => (
                    <div key={group.number}>
                      {/* Chapter number header — neutral white since the
                          group may contain scans in multiple languages */}
                      <div style={{
                        color: COLOR_HEADING,
                        fontSize: "12px",
                        fontWeight: 700,
                        letterSpacing: "0.05em",
                        textTransform: "uppercase",
                        padding: "8px 0 4px",
                      }}>
                        CH. {group.number}
                      </div>
                      {/* Scan rows */}
                      {group.scans.map(scan => (
                        <button
                          key={scan.id}
                          onClick={() => navigateToChapter(scan)}
                          style={{
                            width: "100%",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: "12px",
                            padding: "6px 12px",
                            borderRadius: "8px",
                            border: "1px solid transparent",
                            background: "transparent",
                            color: COLOR_HEADING,
                            cursor: "pointer",
                            textAlign: "left",
                            marginBottom: "2px",
                            fontFamily: FONT_STACK,
                            transition: "background 0.15s, border-color 0.15s",
                          }}
                          onMouseEnter={e => {
                            e.currentTarget.style.background = COLOR_SLATE2;
                            e.currentTarget.style.borderColor = COLOR_ACCENT;
                          }}
                          onMouseLeave={e => {
                            e.currentTarget.style.background = "transparent";
                            e.currentTarget.style.borderColor = "transparent";
                          }}
                        >
                          {/* Left: title + scanlation label
                              Color depends on the chapter's LANGUAGE:
                              English = blue, Spanish = red, Indonesian = green,
                              Italian = green, Portuguese = amber, French = indigo, etc.
                              Falls back to white if language is unknown. */}
                          {(() => {
                            const langColor = LANG_COLORS[scan.lang || "en"] || LANG_COLORS[normalizeLang(scan.lang || "en")] || COLOR_HEADING;
                            return (
                              <div style={{ display: "flex", flexDirection: "column", gap: "2px", minWidth: 0, flex: 1 }}>
                                <span style={{
                                  color: langColor,              // language-colored chapter name
                                  fontSize: "16px",
                                  fontWeight: 500,
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                }}>
                                  {scan.title || `Chapter ${scan.number}`}
                                </span>
                                <span style={{ color: langColor, fontSize: "12px", fontWeight: 600, opacity: 0.75 }}>
                                  {chapterLabel(scan)}
                                  {scan.scanGroup && ` · ${scan.scanGroup}`}
                                </span>
                              </div>
                            );
                          })()}
                          {/* Right: page count + relative date */}
                          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
                            {scan.pages ? (
                              <span style={{ color: COLOR_MUTED, fontSize: "12px" }}>{scan.pages}p</span>
                            ) : null}
                            {scan.date && (
                              <span style={{ color: COLOR_MUTED, fontSize: "12px" }}>
                                {formatRelativeDate(scan.date)}
                              </span>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  ))}
                </div>

                {visibleChapterGroups.length > chapterPage * CHAPTERS_PER_PAGE && (
                  <button
                    onClick={() => setChapterPage(p => p + 1)}
                    style={{
                      ...controlStyle,
                      margin: "16px auto 0",
                      display: "block",
                      padding: "8px 24px",
                    }}
                  >
                    Load more ({visibleChapterGroups.length - chapterPage * CHAPTERS_PER_PAGE} more)
                  </button>
                )}
                {visibleChapterGroups.length === 0 && (
                  <p style={{ color: COLOR_MUTED, fontSize: "13px", textAlign: "center", padding: "24px 0" }}>
                    No chapters match the current filters.
                  </p>
                )}
              {/* Read Latest Chapter button at bottom of chapter list */}
              {manga.chapters && manga.chapters.length > 0 && (
                <button
                  onClick={() => navigateToChapter(
                    [...manga.chapters!].sort((a, b) => b.number - a.number)[0]
                  )}
                  style={{
                    width: "100%",
                    padding: "12px",
                    marginTop: "12px",
                    borderRadius: "8px",
                    background: COLOR_ACCENT,
                    color: "#ffffff",
                    fontWeight: 600,
                    fontSize: "14px",
                    border: "none",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px",
                    fontFamily: FONT_STACK,
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
                    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
                  </svg>
                  Read Latest Chapter
                </button>
              )}
              </section>
            )}

            {/* Comments */}
            <section style={{ marginTop: "16px" }}>
              <h2 style={{
                color: COLOR_HEADING,
                fontSize: "20px",
                fontWeight: 600,
                marginTop: 0,
                marginBottom: "16px",
              }}>Comments</h2>
              <AnimeComments animeId={mangaId} animeTitle={displayTitle} />
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
//  LUFFI CHART — Semicircular gauge (4-option review)
//  Based on the reference HTML "Moctale Meter" design.
//  Options: Drop (skip), Bold (timepass), Great (go for it), Recommended (perfection)
// ═══════════════════════════════════════════════════════════════════════

function LuffiChart({ counts, total, userVibe, onVote }: {
  counts: { drop: number; bold: number; great: number; recommended: number };
  total: number;
  userVibe: string | null;
  onVote: (vibe: string) => void;
}) {
  const VIBES = [
    { id: "drop", label: "Drop", color: "#f0407e" },
    { id: "bold", label: "Bold", color: "#f2a71b" },
    { id: "great", label: "Great", color: "#16d6a5" },
    { id: "recommended", label: "Recommended", color: "#8b5cf6" },
  ];

  // Calculate percentages
  const data = VIBES.map(v => ({
    ...v,
    count: counts[v.id as keyof typeof counts] || 0,
    pct: total > 0 ? Math.round(((counts[v.id as keyof typeof counts] || 0) / total) * 100) : 0,
  }));

  // The "center percentage" = the percentage of positive votes (great + recommended)
  const positivePct = total > 0
    ? Math.round(((counts.great + counts.recommended) / total) * 100)
    : 0;
  const dominantVibe = data.reduce((a, b) => a.pct >= b.pct ? a : b, data[0]);
  const centerColor = dominantVibe.pct > 0 ? dominantVibe.color : "#9a9a9a";

  // SVG gauge parameters (matching the reference HTML)
  const cx = 210, cy = 200, r = 150, strokeW = 26;
  const svgW = 420, svgH = 230;

  function pointAt(pct: number) {
    const angleDeg = 180 - (pct / 100) * 180;
    const angleRad = angleDeg * Math.PI / 180;
    return { x: cx + r * Math.cos(angleRad), y: cy - r * Math.sin(angleRad) };
  }
  function arcPath(p1: number, p2: number) {
    const start = pointAt(p1);
    const end = pointAt(p2);
    const largeArc = (p2 - p1) > 50 ? 1 : 0;
    return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y}`;
  }

  let cursor = 0;
  const segments = data.map(d => {
    if (d.pct <= 0) return null;
    const seg = { path: arcPath(cursor, cursor + d.pct), color: d.color };
    cursor += d.pct;
    return seg;
  }).filter(Boolean);

  return (
    <div style={{ background: "#17181c", borderRadius: "16px", padding: "20px" }}>
      {/* SVG gauge */}
      <div style={{ display: "flex", justifyContent: "center" }}>
        <svg width="100%" height={svgH} viewBox={`0 0 ${svgW} ${svgH}`} style={{ maxWidth: svgW }}>
          {/* Background arc (full semicircle, dim) */}
          <path d={arcPath(0, 100)} fill="none" stroke="#27272a" strokeWidth={strokeW} strokeLinecap="round" />
          {/* Colored segments */}
          {segments.map((seg, i) => (
            <path key={i} d={seg!.path} fill="none" stroke={seg!.color} strokeWidth={strokeW} strokeLinecap="round" />
          ))}
          {/* Center text: percentage */}
          <text x={cx} y={cy - 40} textAnchor="middle" style={{ fontSize: "34px", fontWeight: 700, fill: centerColor }}>
            {positivePct}%
          </text>
          {/* Center subtext: vote count */}
          <text x={cx} y={cy - 18} textAnchor="middle" style={{ fontSize: "13px", fill: "#9a9a9a" }}>
            {total} {total === 1 ? "vote" : "votes"}
          </text>
        </svg>
      </div>

      {/* Legend + vote buttons */}
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: "6px", padding: "0 10px" }}>
        {data.map(v => (
          <button
            key={v.id}
            onClick={() => onVote(v.id)}
            style={{
              display: "flex", alignItems: "center", gap: "8px",
              color: userVibe === v.id ? v.color : "#f2f2f2",
              fontSize: "14px", cursor: "pointer",
              background: "transparent", border: "none",
              fontWeight: userVibe === v.id ? 700 : 400,
            }}
          >
            <span style={{ width: "10px", height: "10px", borderRadius: "50%", background: v.color, display: "inline-block" }} />
            {v.label} <b>{v.pct}%</b>
          </button>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
//  VIBE DONUT CHART — Genre mix donut
//  Based on the reference HTML "Vibe Chart" design.
// ═══════════════════════════════════════════════════════════════════════

function VibeDonutChart({ genres }: { genres: string[] }) {
  const COLORS = ["#2f6feb", "#7c3aed", "#45464d", "#a9714f", "#16d6a5", "#f0407e", "#f2a71b", "#8b5cf6"];
  const topGenres = genres.slice(0, 8);
  const pct = Math.round(100 / topGenres.length);

  const data = topGenres.map((g, i) => ({
    label: g,
    pct,
    color: COLORS[i % COLORS.length],
  }));

  // Donut SVG parameters (matching the reference HTML)
  const cx = 110, cy = 95, rOuter = 78, rInner = 54;
  const svgW = 220, svgH = 190;

  function pointAt(pct: number, radius: number) {
    const angleDeg = pct * 3.6 - 90;
    const angleRad = angleDeg * Math.PI / 180;
    return { x: cx + radius * Math.cos(angleRad), y: cy + radius * Math.sin(angleRad) };
  }
  function donutSegment(p1: number, p2: number) {
    const largeArc = (p2 - p1) > 50 ? 1 : 0;
    const oStart = pointAt(p1, rOuter);
    const oEnd = pointAt(p2, rOuter);
    const iEnd = pointAt(p2, rInner);
    const iStart = pointAt(p1, rInner);
    return `M ${oStart.x} ${oStart.y} A ${rOuter} ${rOuter} 0 ${largeArc} 1 ${oEnd.x} ${oEnd.y} L ${iEnd.x} ${iEnd.y} A ${rInner} ${rInner} 0 ${largeArc} 0 ${iStart.x} ${iStart.y} Z`;
  }

  let cursor = 0;
  const segments = data.map(d => {
    const seg = { path: donutSegment(cursor, cursor + d.pct), color: d.color, label: d.label, pct: d.pct };
    cursor += d.pct;
    return seg;
  });

  // Center: show the first/largest genre
  const centerLabel = data[0]?.label || "";
  const centerPct = data[0]?.pct || 0;

  return (
    <div style={{ background: "#17181c", borderRadius: "16px", padding: "22px 26px 26px", boxShadow: "0 8px 24px rgba(0,0,0,0.5)" }}>
      {/* SVG donut */}
      <div style={{ display: "flex", justifyContent: "center" }}>
        <svg width="100%" height={svgH} viewBox={`0 0 ${svgW} ${svgH}`} style={{ maxWidth: svgW }}>
          {segments.map((seg, i) => (
            <path key={i} d={seg.path} fill={seg.color} />
          ))}
          {/* Center label */}
          <text x={cx} y={cy - 4} textAnchor="middle" style={{ fontSize: "15px", fill: "#f2f2f2", fontWeight: 500 }}>
            {centerLabel}
          </text>
          <text x={cx} y={cy + 20} textAnchor="middle" style={{ fontSize: "22px", fill: "#f2f2f2", fontWeight: 700 }}>
            {centerPct}%
          </text>
        </svg>
      </div>

      {/* Legend */}
      <div style={{ marginTop: "16px", display: "flex", flexDirection: "column", gap: "10px" }}>
        {data.map(d => (
          <div key={d.label} style={{ display: "flex", alignItems: "center", fontSize: "14px", color: "#f2f2f2" }}>
            <span style={{ width: "10px", height: "10px", borderRadius: "50%", background: d.color, marginRight: "10px" }} />
            <span style={{ flex: 1, color: "#cfcfcf" }}>{d.label}</span>
            <span style={{ fontWeight: 600 }}>{d.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
