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

// ── Provider prefix helpers ──
// IDs are prefixed with the provider name so we know which API to call:
//   "mb:685158ff..." → mangaball
//   "at:oZOG5"       → atsumaru
//   "oZOG5" (no prefix) → atsumaru (backwards compat)

const MANGABALL_PREFIX = "mb:";
const ATSUMARU_PREFIX = "at:";

function parseProviderFromId(id: string): { provider: string; rawId: string } {
  if (id.startsWith(MANGABALL_PREFIX)) {
    return { provider: "mangaball", rawId: id.slice(MANGABALL_PREFIX.length) };
  }
  if (id.startsWith(ATSUMARU_PREFIX)) {
    return { provider: "atsumaru", rawId: id.slice(ATSUMARU_PREFIX.length) };
  }
  // No prefix = atsumaru (backwards compat with existing bookmarks/URLs)
  return { provider: "atsumaru", rawId: id };
}

function prefixId(provider: string, id: string): string {
  if (provider === "mangaball") return MANGABALL_PREFIX + id;
  if (provider === "atsumaru") return ATSUMARU_PREFIX + id;
  return id;
}

/** Map a mangaball search result to our AtsuMangaEntry (with prefixed id) */
function mapMangaballSearchResult(r: ScrapeSearchResponse["results"][number]): AtsuMangaEntry {
  return {
    id: prefixId("mangaball", r.id),
    title: r.title || "",
    poster: r.image || "",
    cover: r.image || "",
    type: r.subtype || "manga",
    status: r.status,
    rating: typeof r.rating === "number" ? r.rating : undefined,
    source: "mangaball",
    slug: r.id,
  };
}

/**
 * Search manga on atsumaru via the manga-scrape-api.
 */
export async function searchManga(query: string, _limit = 20): Promise<AtsuMangaEntry[]> {
  if (!query.trim()) return [];
  const data = await scrapeFetch<ScrapeSearchResponse>(
    `/api/scrape/search?query=${encodeURIComponent(query.trim())}&provider=${PROVIDER}`,
  );
  if (!data?.results) return [];
  return data.results.map(r => {
    const mapped = mapSearchResult(r);
    // Prefix the id so we know to use atsumaru provider for detail/chapters
    mapped.id = prefixId("atsumaru", mapped.id);
    return mapped;
  });
}

/**
 * Search manga on mangaball via the manga-scrape-api.
 */
export async function searchMangaMangaball(query: string): Promise<AtsuMangaEntry[]> {
  if (!query.trim()) return [];
  const data = await scrapeFetch<ScrapeSearchResponse>(
    `/api/scrape/search?query=${encodeURIComponent(query.trim())}&provider=mangaball`,
  );
  if (!data?.results) return [];
  return data.results.map(mapMangaballSearchResult);
}

/**
 * Search BOTH providers in parallel and merge results.
 * Mangaball results come first (primary — larger library, multi-language),
 * then atsumaru results (backup). Dedupes by normalized title.
 */
export async function searchMangaBoth(query: string): Promise<AtsuMangaEntry[]> {
  if (!query.trim()) return [];
  const [mangaballResults, atsumaruResults] = await Promise.allSettled([
    searchMangaMangaball(query),
    searchManga(query),
  ]);

  const mb = mangaballResults.status === "fulfilled" ? mangaballResults.value : [];
  const at = atsumaruResults.status === "fulfilled" ? atsumaruResults.value : [];

  // Merge: mangaball first, then atsumaru, dedupe by normalized title
  const seen = new Set<string>();
  const merged: AtsuMangaEntry[] = [];
  for (const m of [...mb, ...at]) {
    const key = (m.englishTitle || m.title || "").toLowerCase().trim();
    if (key && !seen.has(key)) {
      seen.add(key);
      merged.push(m);
    }
  }
  return merged;
}

/**
 * Get manga detail (info + chapters in parallel).
 * Parses the provider from the ID prefix to know which API to call.
 *
 * FALLBACK: If the primary provider's info endpoint fails (mangaball's
 * info endpoint is known to be intermittent), but chapters work, we
 * construct a minimal detail from chapters data alone. This ensures
 * the detail page still renders even when info is unavailable.
 */
export async function getMangaDetail(mangaId: string): Promise<AtsuMangaDetail | null> {
  if (!mangaId) return null;
  const { provider, rawId } = parseProviderFromId(mangaId);
  const [info, chaptersData] = await Promise.all([
    scrapeFetch<ScrapeInfoResponse>(
      `/api/scrape/info?id=${encodeURIComponent(rawId)}&provider=${provider}`,
    ),
    scrapeFetch<ScrapeChaptersResponse>(
      `/api/scrape/chapters?id=${encodeURIComponent(rawId)}&provider=${provider}`,
    ),
  ]);

  // If both info and chapters failed, return null
  if (!info && !chaptersData?.chapters?.length) return null;

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

  // If info endpoint failed but chapters work, build minimal detail
  if (!info) {
    return {
      id: prefixId(provider, rawId),
      title: "Unknown Title",
      poster: "",
      banner: "",
      cover: "",
      description: "",
      type: "manga",
      status: "",
      authors: "Unknown",
      artists: [],
      genres: [],
      tags: [],
      chapters: dedupedChapters,
      totalChapters: dedupedChapters.length,
      source: provider,
      slug: rawId,
    };
  }

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

  // Clean up mangaball title (has "{{chapter_name}} Online Free - Multiple Languages")
  let cleanTitle = info.title || "";
  if (provider === "mangaball") {
    cleanTitle = cleanTitle
      .replace(/\{\{chapter_name\}\}/gi, "")
      .replace(/\s*Online Free.*$/i, "")
      .replace(/\s*-\s*Multiple Languages.*$/i, "")
      .trim();
  }

  return {
    id: prefixId(provider, info.id),
    title: cleanTitle,
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
    source: provider,
    slug: info.id,
  };
}

/**
 * Get chapter pages.
 *
 * IMPORTANT: The manga-scrape-api providers accept `chapterNumber`
 * (NOT `chapterId`). The existing route contract passes `chapterId`.
 * To stay backwards-compatible with the store route
 * `{ page: "manga-read"; id: string; chapterId: string }`,
 * we treat the value passed as `chapterId` as the chapter NUMBER
 * (the detail page passes `String(chapter.number)` when navigating
 * to the reader).
 *
 * Also parses the provider from the mangaId prefix so it works with
 * both atsumaru (at:) and mangaball (mb:) IDs.
 */
export async function getChapterImages(
  mangaId: string,
  chapterId: string,
): Promise<AtsuChapterPage[]> {
  if (!mangaId || !chapterId) return [];
  const { provider, rawId } = parseProviderFromId(mangaId);
  const chapterNumber = encodeURIComponent(String(chapterId));
  const data = await scrapeFetch<ScrapePagesResponse>(
    `/api/scrape/pages?id=${encodeURIComponent(rawId)}&chapterNumber=${chapterNumber}&provider=${provider}`,
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
// MANGABALL — primary source (larger library, multi-language)
// ---------------------------------------------------------------------
// Mangaball has no home/trending endpoint, so we build home sections
// from curated search queries. Mangaball is the PRIMARY provider;
// atsumaru's atsu.moe direct scraper is the FALLBACK for home sections
// (it has real trending/popular data that mangaball can't provide).
// ============================================================

// Curated queries for building mangaball home sections
const MANGABALL_HOME_QUERIES: { section: string; type: string; queries: string[] }[] = [
  {
    section: "Trending Now",
    type: "trending",
    queries: ["solo leveling", "one piece", "jujutsu kaisen", "chainsaw man", "tower of god"],
  },
  {
    section: "Popular Manhwa",
    type: "popular_manhwa",
    queries: ["noblesse", "the beginning after the end", "omniscient reader", "nano machine", "return of the mount hua sect"],
  },
  {
    section: "Action Hits",
    type: "action",
    queries: ["naruto", "bleach", "my hero academia", "demon slayer", "dragon ball super"],
  },
  {
    section: "Dark Fantasy",
    type: "dark_fantasy",
    queries: ["berserk", "tokyo ghoul", "vinland saga", "vagabond", "claymore"],
  },
  {
    section: "Romance Picks",
    type: "romance",
    queries: ["horimiya", "kaguya sama", "fruits basket", "toradora", "my dress up darling"],
  },
  {
    section: "Isekai Worlds",
    type: "isekai",
    queries: ["re:zero", "mushoku tensei", "overlord", "sword art online", "that time i got reincarnated"],
  },
];

/** Build a home section from mangaball search queries */
async function buildMangaballSection(
  section: { section: string; type: string; queries: string[] },
): Promise<AtsuHomeSection> {
  const allResults = await Promise.all(section.queries.map(q => searchMangaMangaball(q)));
  const flat = allResults.flat();
  const seen = new Set<string>();
  const items = flat.filter(m => {
    if (seen.has(m.id)) return false;
    seen.add(m.id);
    return true;
  });
  return {
    title: section.section,
    type: section.type,
    items: items.slice(0, 20),
  };
}

/** Build home sections from mangaball curated searches (primary) */
async function getMangaballHome(): Promise<AtsuHomeSection[]> {
  try {
    const sections = await Promise.all(MANGABALL_HOME_QUERIES.map(buildMangaballSection));
    return sections.filter(s => s.items.length > 0);
  } catch {
    return [];
  }
}

// ============================================================
// Atsumaru direct scraper (FALLBACK for home sections)
// ---------------------------------------------------------------------
// atsu.moe's /api/home/page returns real trending/popular data with
// views and ratings. Used as fallback when mangaball doesn't have
// enough results, and for the Popular/Top Rated/Recently Added
// sub-pages (which need real curated data, not search results).
// ============================================================

const ATSU_DIRECT_BASE = "https://atsu.moe";

const ATSU_DIRECT_HEADERS: Record<string, string> = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.5",
  Referer: `${ATSU_DIRECT_BASE}/`,
};

/** Build a full image URL from an atsu.moe relative path. */
function atsuImageUrl(path: string | undefined | null): string {
  if (!path) return "";
  if (path.startsWith("http")) return path;
  const cleaned = path.replace(/^\/+/, "");
  if (cleaned.startsWith("static/")) {
    return `${ATSU_DIRECT_BASE}/${cleaned}`;
  }
  return `${ATSU_DIRECT_BASE}/static/${cleaned}`;
}

/** Map an atsu.moe home section item to our AtsuMangaEntry (with prefixed id) */
function mapAtsuHomeItem(item: any): AtsuMangaEntry {
  const poster = atsuImageUrl(item.mediumImage || item.largeImage || item.smallImage || item.image);
  const rawId = String(item.id || "");
  return {
    id: prefixId("atsumaru", rawId),
    title: item.title || "",
    poster,
    cover: poster,
    type: (item.type || "manga").toLowerCase(),
    isAdult: item.isAdult || false,
    rating: typeof item.mbRating === "number" ? item.mbRating : undefined,
    source: "atsumaru",
    slug: rawId,
  };
}

/** Fetch atsu.moe home page directly and return curated sections */
async function getAtsumaruHomeDirect(): Promise<AtsuHomeSection[]> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    const res = await fetch(`${ATSU_DIRECT_BASE}/api/home/page`, {
      headers: ATSU_DIRECT_HEADERS,
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) return [];
    const data = await res.json();
    const rawSections: any[] = data?.homePage?.sections || [];
    const sections: AtsuHomeSection[] = [];
    for (const s of rawSections) {
      if (s.layout === "static") continue;
      if (!Array.isArray(s.items) || s.items.length === 0) continue;
      const items = s.items.map(mapAtsuHomeItem).filter((m: AtsuMangaEntry) => m.id);
      if (items.length === 0) continue;
      sections.push({
        title: s.title || s.key || "Section",
        type: s.key?.replace(/-/g, "_") || "section",
        items,
      });
    }
    return sections;
  } catch (err) {
    console.error("[manga-api] getAtsumaruHomeDirect error:", err);
    return [];
  }
}

/**
 * Get manga home sections — MANGABALL PRIMARY, atsumaru fallback.
 *
 * Tries mangaball curated searches first. If mangaball returns enough
 * sections (>=3), uses those. Otherwise falls back to atsumaru's
 * atsu.moe direct scraper which has real trending/popular data.
 */
export async function getMangaHome(): Promise<AtsuHomeSection[]> {
  // Try mangaball first (primary)
  const mangaballSections = await getMangaballHome();
  if (mangaballSections.length >= 3) {
    return mangaballSections;
  }
  // Fallback to atsumaru's atsu.moe direct scraper
  const atsumaruSections = await getAtsumaruHomeDirect();
  if (atsumaruSections.length > 0) {
    return atsumaruSections;
  }
  // Last resort: return whatever mangaball gave us (even if < 3)
  return mangaballSections;
}

/**
 * Get a single section by type from atsu.moe's home page.
 * Used by the manga navbar sub-pages (Popular, Top Rated, Recently Added).
 */
export async function getMangaSection(sectionType: string): Promise<AtsuMangaEntry[]> {
  try {
    const sections = await getAtsumaruHomeDirect();
    const section = sections.find(s => s.type === sectionType);
    return section?.items || [];
  } catch {
    return [];
  }
}

/** Popular manga — atsumaru's atsu.moe (has real popular data) */
export async function getPopularManga(): Promise<AtsuMangaEntry[]> {
  return getMangaSection("popular");
}

/** Top rated manga — atsumaru's atsu.moe (has real rating data) */
export async function getTopRatedManga(): Promise<AtsuMangaEntry[]> {
  return getMangaSection("top_rated");
}

/** Recently added manga — atsumaru's atsu.moe */
export async function getRecentlyAddedManga(): Promise<AtsuMangaEntry[]> {
  return getMangaSection("recently_added");
}

/** Recently updated manga — atsumaru's atsu.moe */
export async function getRecentlyUpdatedManga(): Promise<AtsuMangaEntry[]> {
  return getMangaSection("recently_updated");
}

/** Trending manga — atsumaru's atsu.moe */
export async function getTrendingManga(): Promise<AtsuMangaEntry[]> {
  return getMangaSection("trending_carousel");
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
