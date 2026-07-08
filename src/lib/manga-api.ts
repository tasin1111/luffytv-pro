// =====================================================================
//  LuffyTV Manga API — v2 (manga-scrape-api.vercel.app + atsumaru)
// ---------------------------------------------------------------------
//  Provider: atsumaru (atsu.moe) — accessed via the unified
//  manga-scrape-api hosted at https://manga-scrape-api.vercel.app
//
//  Available endpoints (atsumaru provider):
//    GET /api/scrape/search?query={q}&provider=atsumaru
//    GET /api/scrape/info?id={mangaId}&provider=atsumaru
//    GET /api/scrape/chapters?id={mangaId}&provider=atsumaru
//    GET /api/scrape/pages?id={mangaId}&chapterNumber={n}&provider=atsumaru
//    GET /api/proxy/image?url={imageUrl}             → image proxy (CORS)
//
//  IMPORTANT — chapter contract change:
//  The atsumaru scraper API uses chapterNumber (NOT chapter id) for the
//  pages endpoint. Callers must pass String(chapter.number) as chapterId
//  when navigating to the reader. The manga-detail and manga-reader
//  components have been patched accordingly.
//
//  NOTE: atsumaru does NOT expose a "home" endpoint through this scraper
//  API. To populate the home page we fan out a curated set of search
//  queries in parallel and assemble themed sections.
//
//  Backwards compatibility:
//  All exported types (AtsuMangaEntry, AtsuMangaChapter, AtsuMangaDetail,
//  AtsuChapterPage, AtsuHomeSection) and function names (getMangaHome,
//  searchManga, getMangaDetail, getChapterImages, getMangaDexChapterPages,
//  searchAtsu, getAtsuDetail, getAtsuChapterImages, getAtsuHome,
//  mapMangaDexEntry) are preserved so existing API routes and components
//  keep working unchanged.
// =====================================================================

const SCRAPE_API_BASE = "https://manga-scrape-api.vercel.app";
const PROVIDER = "atsumaru";

const SCRAPE_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.5",
};

// ============================================================
// Fetch helper
// ============================================================

async function scrapeFetch<T = any>(path: string, timeoutMs = 20000): Promise<T | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const url = path.startsWith("http") ? path : `${SCRAPE_API_BASE}${path}`;
    const res = await fetch(url, { headers: SCRAPE_HEADERS, signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch (err) {
    clearTimeout(timeout);
    console.error("[manga-api] scrapeFetch error:", path, err);
    return null;
  }
}

// ============================================================
// Types (kept backwards-compatible with the previous version
// so the existing detail/reader pages and API routes continue
// to render without any code changes there)
// ============================================================

export interface AtsuMangaEntry {
  id: string;
  title: string;
  englishTitle?: string;
  poster?: string;
  posterSmall?: string;
  posterMedium?: string;
  type?: string;
  isAdult?: boolean;
  status?: string;
  year?: number;
  authors?: string[];
  genres?: string[];
  description?: string;
  anilistId?: number;
  malId?: number;
  banner?: string;
  totalChapters?: number;
  mangadexId?: string;
  source?: string;
  cover?: string;
  slug?: string;
  rating?: number;
  chapterCount?: number;
  latestChapter?: string;
}

export interface AtsuMangaChapter {
  id: string;
  title: string;
  number: number;
  date?: string;
  scanGroup?: string;
  mangadexChapterId?: string;
  pages?: number;
  pageCount?: number;
  lang?: string;
}

export interface AtsuMangaDetail {
  id: string;
  title: string;
  englishTitle?: string;
  altTitles?: string[];
  poster?: string;
  banner?: string;
  description?: string;
  type?: string;
  status?: string;
  year?: number;
  authors?: string | string[];
  artists?: string[];
  genres?: string[];
  tags?: string[];
  isAdult?: boolean;
  anilistId?: number;
  malId?: number;
  chapters?: AtsuMangaChapter[];
  totalChapters?: number;
  rating?: number;
  views?: number | string;
  mangadexId?: string;
  source?: string;
  cover?: string;
  slug?: string;
}

export interface AtsuChapterPage {
  index: number;
  url: string;
  proxiedUrl?: string;
  width?: number;
  height?: number;
}

export interface AtsuHomeSection {
  title: string;
  type: string;
  items: AtsuMangaEntry[];
}

// ============================================================
// Internal response shapes (from manga-scrape-api)
// ============================================================

interface ScrapeSearchResponse {
  results: Array<{
    id: string;
    title: string;
    altTitles?: string[];
    image?: string;
    provider?: string;
    subtype?: string;
    rating?: number;
    status?: string;
  }>;
}

interface ScrapeInfoResponse {
  id: string;
  title: string;
  altTitles?: string[];
  image?: string;
  description?: string;
  status?: string;
  subtype?: string;
  author?: string | string[];
  artist?: string | string[];
  genres?: string[];
  tags?: string[];
  year?: number;
  isAdult?: boolean;
  anilistId?: number;
  malId?: number;
}

interface ScrapeChaptersResponse {
  chapters: Array<{
    id: string;
    number: number;
    title?: string;
    pages?: number;
    lang?: string;
    date?: string;
    scanGroup?: string;
  }>;
}

interface ScrapePagesResponse {
  pages: Array<{
    order: number;
    url: string;
    originalUrl?: string;
    width?: number;
    height?: number;
  }>;
}

// ============================================================
// Mappers
// ============================================================

function mapSearchResult(r: ScrapeSearchResponse["results"][number]): AtsuMangaEntry {
  const englishTitle = r.altTitles?.[0];
  return {
    id: r.id,
    title: r.title,
    englishTitle,
    poster: r.image || "",
    cover: r.image || "",
    type: r.subtype || "manga",
    status: r.status,
    rating: typeof r.rating === "number" ? r.rating : undefined,
    source: "atsumaru",
    slug: r.id,
  };
}

function mapChapter(c: ScrapeChaptersResponse["chapters"][number]): AtsuMangaChapter {
  return {
    id: c.id,
    title: c.title || `Chapter ${c.number}`,
    number: c.number,
    pageCount: c.pages || 0,
    pages: c.pages || 0,
    lang: c.lang,
    date: c.date,
    scanGroup: c.scanGroup,
  };
}

// ============================================================
// Public API
// ============================================================

/**
 * Search manga on atsumaru via the manga-scrape-api.
 */
export async function searchManga(query: string, _limit = 20): Promise<AtsuMangaEntry[]> {
  if (!query.trim()) return [];
  const data = await scrapeFetch<ScrapeSearchResponse>(
    `/api/scrape/search?query=${encodeURIComponent(query.trim())}&provider=${PROVIDER}`,
  );
  if (!data?.results) return [];
  return data.results.map(mapSearchResult);
}

/**
 * Get manga detail (info + chapters in parallel).
 */
export async function getMangaDetail(mangaId: string): Promise<AtsuMangaDetail | null> {
  if (!mangaId) return null;
  const [info, chaptersData] = await Promise.all([
    scrapeFetch<ScrapeInfoResponse>(
      `/api/scrape/info?id=${encodeURIComponent(mangaId)}&provider=${PROVIDER}`,
    ),
    scrapeFetch<ScrapeChaptersResponse>(
      `/api/scrape/chapters?id=${encodeURIComponent(mangaId)}&provider=${PROVIDER}`,
    ),
  ]);

  if (!info) return null;

  const chapters = (chaptersData?.chapters || []).map(mapChapter);
  // Sort ascending by chapter number, dedupe by number
  const seen = new Set<number>();
  const dedupedChapters = chapters
    .filter(ch => {
      const key = Math.round(ch.number * 100) / 100;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => a.number - b.number);

  const authors = info.author
    ? Array.isArray(info.author)
      ? info.author
      : [info.author]
    : [];
  const artists = info.artist
    ? Array.isArray(info.artist)
      ? info.artist
      : [info.artist]
    : [];

  return {
    id: info.id,
    title: info.title,
    englishTitle: info.altTitles?.[0],
    altTitles: info.altTitles || [],
    poster: info.image || "",
    banner: info.image || "",
    cover: info.image || "",
    description: info.description || "",
    type: info.subtype || "manga",
    status: info.status,
    year: info.year,
    authors: authors.length ? authors : "Unknown",
    artists,
    genres: info.genres || [],
    tags: info.tags || [],
    isAdult: info.isAdult,
    anilistId: info.anilistId,
    malId: info.malId,
    chapters: dedupedChapters,
    totalChapters: dedupedChapters.length,
    source: "atsumaru",
    slug: info.id,
  };
}

/**
 * Get chapter pages.
 *
 * IMPORTANT: The manga-scrape-api atsumaru provider accepts
 * `chapterNumber` (NOT `chapterId`). The existing route contract
 * passes `chapterId`. To stay backwards-compatible with the store
 * route `{ page: "manga-read"; id: string; chapterId: string }`,
 * we treat the value passed as `chapterId` as the chapter NUMBER
 * (the detail page now passes `String(chapter.number)` when
 * navigating to the reader).
 */
export async function getChapterImages(
  mangaId: string,
  chapterId: string,
): Promise<AtsuChapterPage[]> {
  if (!mangaId || !chapterId) return [];
  const chapterNumber = encodeURIComponent(String(chapterId));
  const data = await scrapeFetch<ScrapePagesResponse>(
    `/api/scrape/pages?id=${encodeURIComponent(mangaId)}&chapterNumber=${chapterNumber}&provider=${PROVIDER}`,
  );
  if (!data?.pages) return [];
  return data.pages.map(p => ({
    index: p.order - 1, // 0-indexed for the reader
    url: p.url,
    width: p.width,
    height: p.height,
  }));
}

// ============================================================
// Home page builder
// ---------------------------------------------------------------------
// atsumaru has no home endpoint through the scraper API, so we
// fan out a curated set of search queries in parallel and assemble
// themed sections. Each query returns ~5-20 relevant titles.
// ============================================================

const HOME_QUERIES: { section: string; type: string; queries: string[] }[] = [
  {
    section: "Trending Now",
    type: "trending",
    queries: ["solo leveling", "demon slayer", "jujutsu kaisen", "chainsaw man", "frieren"],
  },
  {
    section: "Action Hits",
    type: "action",
    queries: ["one piece", "naruto", "bleach", "dragon ball", "my hero academia"],
  },
  {
    section: "Dark Fantasy",
    type: "dark_fantasy",
    queries: ["berserk", "tokyo ghoul", "vinland saga", "vagabond", "claymore"],
  },
  {
    section: "Romance Picks",
    type: "romance",
    queries: ["horimiya", "kaguya", "fruits basket", "your name", "toradora"],
  },
  {
    section: "Isekai Worlds",
    type: "isekai",
    queries: ["re:zero", "mushoku tensei", "overlord", "sword art online", "that time i got reincarnated"],
  },
  {
    section: "Top Rated",
    type: "top_rated",
    queries: ["fullmetal alchemist", "monster", "vagabond", "berserk", "slam dunk"],
  },
];

async function runSection(
  section: { section: string; type: string; queries: string[] },
): Promise<AtsuHomeSection> {
  const allResults = await Promise.all(section.queries.map(q => searchManga(q, 5)));
  const flat = allResults.flat();
  // Dedupe by id
  const seen = new Set<string>();
  const items = flat.filter(m => {
    if (seen.has(m.id)) return false;
    seen.add(m.id);
    return true;
  });
  // For top_rated, sort by rating descending
  if (section.type === "top_rated") {
    items.sort((a, b) => (b.rating || 0) - (a.rating || 0));
  }
  return {
    title: section.section,
    type: section.type,
    items: items.slice(0, 20),
  };
}

/**
 * Build the home page sections by running multiple curated searches
 * in parallel on the atsumaru provider.
 */
export async function getMangaHome(): Promise<AtsuHomeSection[]> {
  try {
    const sections = await Promise.all(HOME_QUERIES.map(runSection));
    // Filter out empty sections
    return sections.filter(s => s.items.length > 0);
  } catch (err) {
    console.error("[manga-api] getMangaHome error:", err);
    return [];
  }
}

// ============================================================
// Backwards-compat: keep the old export names as aliases
// ============================================================

/** Alias for searchManga (kept for any callers that import searchAtsu). */
export const searchAtsu = searchManga;

/** Alias for getMangaDetail (kept for any callers that import getAtsuDetail). */
export const getAtsuDetail = getMangaDetail;

/** Alias for getChapterImages (kept for any callers that import getAtsuChapterImages). */
export const getAtsuChapterImages = getChapterImages;

/** Atsumaru home alias. */
export const getAtsuHome = getMangaHome;

/**
 * MangaDex direct chapter pages — kept as a stub for backwards
 * compatibility with /api/manga/read/route.ts which falls back to
 * this if the primary fetch fails. With the new manga-scrape-api,
 * MangaDex fallback is not needed (the scraper API already handles
 * provider routing), so this always returns an empty array.
 */
export async function getMangaDexChapterPages(_chapterId: string): Promise<AtsuChapterPage[]> {
  return [];
}

/**
 * mapMangaDexEntry — kept as a stub for backwards compatibility.
 */
export function mapMangaDexEntry(_m: any): AtsuMangaEntry {
  return { id: "", title: "", source: "mangadex" };
}
