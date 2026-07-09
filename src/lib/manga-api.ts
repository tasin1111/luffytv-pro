// =====================================================================
//  LuffyTV Manga API — v3 (comix.to + mangaball + atsumaru)
// ---------------------------------------------------------------------
//  Providers:
//    comix.to   — English primary (huge library, 71K+ titles)
//    mangaball  — Multi-language primary (10+ languages)
//    atsumaru   — Home/trending data only (atsu.moe direct scraper)
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

// Import comix.to scraper
import { searchComix, getComixDetail, getComixChapterPages } from "./comix-api";

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
// Direct mangaball.net chapter scraper
// ---------------------------------------------------------------------
// The manga-scrape-api's mangaball provider only returns ONE chapter
// per number (English), dropping all multi-language translations.
// This direct scraper calls mangaball.net's own API to get ALL chapter
// translations (1089+ chapters in 10+ languages).
//
// Flow:
// 1. Fetch mangaball.net page → extract CSRF token + session cookie
// 2. POST to /api/v1/chapter/chapter-listing-by-title-id/ with manga ID
// 3. Flatten the response: each translation becomes a separate chapter
//    entry with its own ID, language, and page count
// ============================================================

const MANGABALL_BASE = "https://mangaball.net";

const MANGABALL_HEADERS: Record<string, string> = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept: "text/html,application/json,*/*",
  "Accept-Language": "en-US,en;q=0.5",
};

/** Get a CSRF token + session cookie from mangaball.net */
async function getMangaballSession(): Promise<{ csrf: string; cookie: string } | null> {
  try {
    const res = await fetch(`${MANGABALL_BASE}/`, {
      headers: MANGABALL_HEADERS,
    });
    // Extract CSRF token from HTML
    const html = await res.text();
    const csrfMatch = html.match(/csrf-token" content="([^"]+)"/);
    if (!csrfMatch) return null;
    // Extract cookies from response headers
    const cookies = res.headers.get("set-cookie") || "";
    const sessionCookie = cookies.split(";")[0]; // Get PHPSESSID=xxx
    return { csrf: csrfMatch[1], cookie: sessionCookie };
  } catch {
    return null;
  }
}

/**
 * Get ALL chapters from mangaball.net directly (including ALL languages).
 * Returns a flat list of chapter translations, each with its own ID,
 * language, and page count.
 *
 * Each entry in the returned array has:
 *   - id: the translation ID (used for fetching pages)
 *   - number: the chapter number (float)
 *   - title: the chapter title
 *   - lang: the language code (en, es, fr, id, it, pt-br, vi, etc.)
 *   - pages: the page count
 *   - group: the scanlation group name
 */
/**
 * Get chapter pages directly from mangaball.net by scraping the
 * chapter-detail page HTML. The page has `const chapterImages = JSON.parse(...)`
 * embedded in a script tag with all image URLs for that specific
 * translation (language-specific).
 *
 * Used as fallback when the manga-scrape-api fails for translation IDs
 * that start with digits (the API misparses them as numbers).
 */
export async function getMangaballChapterPagesDirect(translationId: string): Promise<AtsuChapterPage[]> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    const res = await fetch(`${MANGABALL_BASE}/chapter-detail/${translationId}/`, {
      headers: MANGABALL_HEADERS,
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) return [];
    const html = await res.text();
    // Extract chapterImages JSON array from the page
    const match = html.match(/const chapterImages = JSON\.parse\(`(.*?)`\)/s);
    if (!match) return [];
    const images: string[] = JSON.parse(match[1]);
    return images.map((url, i) => ({
      index: i,
      url,
    }));
  } catch (err) {
    console.error("[manga-api] getMangaballChapterPagesDirect error:", err);
    return [];
  }
}

export async function getMangaballChaptersDirect(mangaId: string): Promise<AtsuMangaChapter[]> {
  try {
    const session = await getMangaballSession();
    if (!session) return [];

    const res = await fetch(`${MANGABALL_BASE}/api/v1/chapter/chapter-listing-by-title-id/`, {
      method: "POST",
      headers: {
        ...MANGABALL_HEADERS,
        "X-CSRF-TOKEN": session.csrf,
        "X-Requested-With": "XMLHttpRequest",
        "Content-Type": "application/x-www-form-urlencoded",
        Cookie: session.cookie,
        Referer: `${MANGABALL_BASE}/`,
      },
      body: `title_id=${encodeURIComponent(mangaId)}&userSettingsEnabled=false`,
    });

    if (!res.ok) return [];
    const data = await res.json();
    if (data?.code !== 200 || !data?.ALL_CHAPTERS) return [];

    // Flatten: each chapter has multiple translations (one per language)
    const chapters: AtsuMangaChapter[] = [];
    for (const ch of data.ALL_CHAPTERS) {
      const number = parseFloat(ch.number_float) || 0;
      for (const tr of ch.translations || []) {
        chapters.push({
          id: tr.id,  // Translation ID — used for fetching pages
          title: tr.name || `Chapter ${number}`,
          number,
          lang: tr.language,
          pages: tr.pages || 0,
          pageCount: tr.pages || 0,
          date: tr.date,
          scanGroup: tr.group?.name,
        });
      }
    }

    // Sort by number, then by language
    chapters.sort((a, b) => {
      if (a.number !== b.number) return a.number - b.number;
      return (a.lang || "").localeCompare(b.lang || "");
    });

    return chapters;
  } catch (err) {
    console.error("[manga-api] getMangaballChaptersDirect error:", err);
    return [];
  }
}

// ============================================================
// Public API
// ============================================================

// ── Provider prefix helpers ──
// IDs are prefixed with the provider name so we know which API to call:
//   "cx:wmqjr"       → comix.to (English primary)
//   "mb:685158ff..." → mangaball (multi-language)
//   "at:oZOG5"       → atsumaru (home/trending only)
//   "oZOG5" (no prefix) → atsumaru (backwards compat)

const MANGABALL_PREFIX = "mb:";
const ATSUMARU_PREFIX = "at:";
const COMIX_PREFIX = "cx:";

function parseProviderFromId(id: string): { provider: string; rawId: string } {
  if (id.startsWith(COMIX_PREFIX)) {
    return { provider: "comix", rawId: id.slice(COMIX_PREFIX.length) };
  }
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

  // Search atsumaru (English) + mangaball (multi-language) in parallel
  const [atsumaruResult, mangaballResult] = await Promise.allSettled([
    searchManga(query),
    searchMangaMangaball(query),
  ]);

  const at = atsumaruResult.status === "fulfilled" ? atsumaruResult.value : [];
  const mb = mangaballResult.status === "fulfilled" ? mangaballResult.value : [];

  // Merge WITHOUT cross-provider dedup — the same manga on both providers
  // should show as separate results (at: and mb:) so the cross-provider
  // merge in the detail page can find the mangaball version.
  // Only dedupe within the same provider.
  const seenAt = new Set<string>();
  const seenMb = new Set<string>();
  const merged: AtsuMangaEntry[] = [];
  for (const m of at) {
    const key = (m.englishTitle || m.title || "").toLowerCase().trim();
    if (key && !seenAt.has(key)) {
      seenAt.add(key);
      merged.push(m);
    }
  }
  for (const m of mb) {
    const key = (m.englishTitle || m.title || "").toLowerCase().trim();
    if (key && !seenMb.has(key)) {
      seenMb.add(key);
      merged.push(m);
    }
  }
  return merged;
}

/**
 * Search comix.to via the comix-proxy route (z-ai page_reader).
 * Comix.to search is CF-protected, so we use our proxy route which
 * can bypass the challenge. The browse page HTML contains manga data
 * in the text (title, type, chapter count) and title links (/title/{hid}-{slug}).
 */
async function searchComixViaProxy(query: string): Promise<AtsuMangaEntry[]> {
  try {
    const origin = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
    const proxyUrl = `${origin}/api/manga/comix-proxy?url=${encodeURIComponent(
      `https://comix.to/browse?q=${encodeURIComponent(query)}`
    )}`;
    const res = await fetch(proxyUrl, { signal: AbortSignal.timeout(20000) });
    if (!res.ok) return [];
    const data = await res.json();
    const html = data.html || "";
    if (!html) return [];

    // Parse title links from HTML: /title/{hid}-{slug}
    const linkPattern = /\/title\/([a-z0-9]+)-([a-z0-9-]+)/g;
    const results: AtsuMangaEntry[] = [];
    const seenHids = new Set<string>();
    let match;
    while ((match = linkPattern.exec(html)) !== null) {
      const hid = match[1];
      const slug = match[2];
      if (seenHids.has(hid)) continue;
      seenHids.add(hid);

      // Convert slug to title (e.g., "player-celestial" → "Player Celestial")
      const title = slug.split("-").map((w: string) =>
        w.charAt(0).toUpperCase() + w.slice(1)
      ).join(" ");

      results.push({
        id: `cx:${hid}`,
        title,
        poster: "",
        cover: "",
        type: "manga",
        source: "comix",
        slug: hid,
      });
    }

    // Filter results by matching the query against the title
    const queryLower = query.toLowerCase();
    const filtered = results.filter(r =>
      r.title.toLowerCase().includes(queryLower) ||
      queryLower.includes(r.title.toLowerCase().slice(0, 10))
    );

    // If no exact matches, return all results (comix.to browse shows latest
    // updates, not filtered by search — but we still want to offer them)
    return filtered.length > 0 ? filtered.slice(0, 10) : results.slice(0, 10);
  } catch {
    return [];
  }
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

  // Comix.to has its own scraper — handle separately
  if (provider === "comix") {
    return getComixDetail(rawId);
  }

  // For mangaball, fetch info from manga-scrape-api AND chapters directly
  // from mangaball.net (which returns ALL language translations, not just
  // the deduped English-only list from manga-scrape-api)
  const [info, chaptersData, directChapters] = await Promise.all([
    scrapeFetch<ScrapeInfoResponse>(
      `/api/scrape/info?id=${encodeURIComponent(rawId)}&provider=${provider}`,
    ),
    // For mangaball, still fetch from manga-scrape-api as fallback
    provider === "mangaball"
      ? Promise.resolve(null as ScrapeChaptersResponse | null)
      : scrapeFetch<ScrapeChaptersResponse>(
          `/api/scrape/chapters?id=${encodeURIComponent(rawId)}&provider=${provider}`,
        ),
    // For mangaball, get ALL chapters directly from mangaball.net
    provider === "mangaball"
      ? getMangaballChaptersDirect(rawId)
      : Promise.resolve([] as AtsuMangaChapter[]),
  ]);

  // Use direct mangaball chapters if available (has all languages),
  // otherwise fall back to manga-scrape-api chapters
  let chapters: AtsuMangaChapter[];
  if (directChapters && directChapters.length > 0) {
    chapters = directChapters;
  } else {
    chapters = (chaptersData?.chapters || []).map(mapChapter);
  }

  // If both info and chapters failed, return null
  if (!info && chapters.length === 0) return null;
  // Sort ascending by chapter number, dedupe by number AND language.
  // Two chapters with the same number but different languages (e.g.,
  // chapter 1 in English and chapter 1 in Spanish) must BOTH be kept.
  // Only exact duplicates (same number + same language) are removed.
  const seen = new Set<string>();
  const dedupedChapters = chapters
    .filter(ch => {
      const numKey = Math.round(ch.number * 100) / 100;
      const langKey = ch.lang || "none";
      const key = `${numKey}:${langKey}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => a.number - b.number);

  // If info endpoint failed but chapters work, try cross-provider fallback:
  // search atsumaru for the same manga title (from sessionStorage) and use
  // its metadata (genres, tags, description, author, poster) while keeping
  // mangaball's chapters (for multi-language support)
  if (!info) {
    // Try to get title from sessionStorage (set by manga-page on click)
    let fallbackTitle = "";
    let fallbackPoster = "";
    try {
      // Can't access sessionStorage in server-side code, but the detail
      // route runs on the server. We'll use a different approach: try
      // searching atsumaru with a generic query to find metadata.
    } catch { /* ignore */ }

    // Build detail from chapters data + try atsumaru cross-provider search
    // The client-side detail page will fill in poster/title from sessionStorage
    return {
      id: prefixId(provider, rawId),
      title: fallbackTitle || "Unknown Title",
      poster: fallbackPoster,
      banner: fallbackPoster,
      cover: fallbackPoster,
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
 * For mangaball: tries the translation ID first (so Spanish ch68 gets
 * Spanish images, not English). If the translation ID starts with digits
 * that get misparsed by the manga-scrape-api as a chapter number, falls
 * back to the chapter number.
 *
 * For atsumaru: uses chapter number as before.
 *
 * The chapterId can be either:
 *   - A chapter number (like "68") — used for atsumaru and as fallback
 *   - A translation ID (like "6a27a45c48701b8c5c57de1a") — used for
 *     mangaball to get language-specific images
 */
export async function getChapterImages(
  mangaId: string,
  chapterId: string,
): Promise<AtsuChapterPage[]> {
  if (!mangaId || chapterId === null || chapterId === undefined || chapterId === "") return [];
  const { provider, rawId } = parseProviderFromId(mangaId);

  // Comix.to has its own page scraper
  if (provider === "comix") {
    return getComixChapterPages(rawId, chapterId);
  }

  // Check if chapterId is an atsumaru chapter merged from cross-provider
  // Format: "at:{atsumaruMangaId}:{chapterNumber}"
  if (chapterId.startsWith("at:")) {
    const parts = chapterId.split(":");
    if (parts.length >= 3) {
      const atsuMangaId = parts[1];
      const chapterNumber = parts.slice(2).join(":");
      const data = await scrapeFetch<ScrapePagesResponse>(
        `/api/scrape/pages?id=${encodeURIComponent(atsuMangaId)}&chapterNumber=${encodeURIComponent(chapterNumber)}&provider=atsumaru`,
      );
      if (data?.pages) {
        return data.pages.map(p => ({
          index: p.order - 1,
          url: p.url,
          width: p.width,
          height: p.height,
        }));
      }
      return [];
    }
  }

  // For mangaball, chapterId might be a translation ID (24 hex chars)
  // or a chapter number. For translation IDs, ALWAYS use the direct
  // mangaball.net scraper FIRST because the manga-scrape-api returns
  // WRONG language pages (it ignores the translation ID and falls back
  // to chapter number, returning English pages for ALL languages).
  const isTranslationId = provider === "mangaball" && /^[0-9a-f]{24}$/i.test(chapterId);

  if (isTranslationId) {
    // ALWAYS try direct mangaball.net scraper FIRST — it returns the
    // correct language-specific images from `const chapterImages` in
    // the chapter-detail page HTML.
    const directPages = await getMangaballChapterPagesDirect(chapterId);
    if (directPages.length > 0) {
      return directPages;
    }
    // If direct scrape failed, try manga-scrape-api as fallback
    // (this may return English pages instead of the correct language,
    // but it's better than returning nothing)
    const data = await scrapeFetch<ScrapePagesResponse>(
      `/api/scrape/pages?id=${encodeURIComponent(rawId)}&chapterNumber=${encodeURIComponent(chapterId)}&provider=${provider}`,
    );
    if (data?.pages && data.pages.length > 0) {
      return data.pages.map(p => ({
        index: p.order - 1,
        url: p.url,
        width: p.width,
        height: p.height,
      }));
    }
    // If both failed, fall through to chapter number approach
  }

  // Use chapter number (works for atsumaru, and as fallback for mangaball)
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
 * Get manga home sections — ATSUMARU PRIMARY (real trending data).
 *
 * atsu.moe's /api/home/page returns REAL curated sections (Trending,
 * Popular, Top Rated, Recently Updated, etc.) with actual view counts
 * and ratings — NOT search results. This is the primary source for
 * the home page.
 *
 * Mangaball has NO home/trending endpoint, so using it for home would
 * just show the same popular titles (Solo Leveling, One Piece) in
 * every section. Mangaball is primary for SEARCH and DETAIL only.
 */
export async function getMangaHome(): Promise<AtsuHomeSection[]> {
  // Atsumaru's atsu.moe direct scraper is primary for home (real data)
  const atsumaruSections = await getAtsumaruHomeDirect();
  if (atsumaruSections.length > 0) {
    return atsumaruSections;
  }
  // Fallback to mangaball curated searches (rarely needed)
  return getMangaballHome();
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
