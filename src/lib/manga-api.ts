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
  /** atsu.moe scanlation group ID (links to scanlators[].id on detail). */
  scanId?: string;
  /** Chapter index inside its scanlation (atsu.moe specific). */
  chapterIndex?: number;
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
  /**
   * Scanlation groups / "sources" for this manga, as exposed by atsu.moe.
   * Each chapter's `scanGroup` will match one of these names so the UI
   * can cross-reference chapters ↔ scanlation groups.
   */
  scanlators?: { id: string; name: string }[];
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
 * PROVIDER ROUTING:
 *   comix    → getComixDetail (comix.to scraper)
 *   atsumaru → getAtsumaruDetailDirect (atsu.moe /api/manga/page — RICH data
 *              with poster, banner, synopsis, scanlators, proper chapters)
 *              with manga-scrape-api /api/scrape/info as a fallback
 *   mangaball → manga-scrape-api /api/scrape/info + getMangaballChaptersDirect
 *               (mangaball.net direct API returns ALL language translations)
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

  // Atsumaru — try direct atsu.moe /api/manga/page FIRST (rich data:
  // poster, banner, synopsis, scanlators, proper chapter IDs).
  // Fall back to manga-scrape-api /api/scrape/info if direct fails.
  if (provider === "atsumaru") {
    const directDetail = await getAtsumaruDetailDirect(rawId);
    if (directDetail) return directDetail;
    // Direct failed → fall through to scrape-api path below
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

  // Atsumaru — go DIRECT to atsu.moe's static page URL pattern.
  // We build the page URLs ourselves from the chapter ID + page count,
  // skipping the manga-scrape-api's pages endpoint entirely.
  //
  // Why: the scrape-api's atsumaru pages endpoint only takes
  // chapterNumber (not chapterId), so it always returns the SAME
  // scanlation's pages regardless of which scanlation the user picked.
  // Going direct via /static/pages/{chapterId}/{i}.webp fixes that —
  // each chapter ID is unique per scanlation, so we get the correct
  // scanlation's pages.
  //
  // Handles three chapterId formats:
  //   1. "LMHqVf"          — short atsu.moe chapter ID (direct from detail)
  //   2. "at:{mangaId}:{n}" — cross-provider merge format (client-side merge)
  //   3. "176"             — chapter number only (legacy fallback)
  if (provider === "atsumaru") {
    // Format 1 or 2: starts with "at:" or looks like a short atsu ID
    // (alnum, 4-12 chars, not all digits)
    const looksLikeAtsuId = !chapterId.startsWith("at:") &&
      /^[A-Za-z0-9_-]{3,20}$/.test(chapterId) &&
      !/^\d+$/.test(chapterId);

    if (chapterId.startsWith("at:") || looksLikeAtsuId) {
      const directPages = await getAtsumaruChapterPagesDirect(mangaId, chapterId);
      if (directPages.length > 0) return directPages;
      // Fall through to scrape-api if direct fails
    }

    // Format 3: chapter number — use scrape-api as fallback
    const chapterNumber = encodeURIComponent(String(chapterId));
    const data = await scrapeFetch<ScrapePagesResponse>(
      `/api/scrape/pages?id=${encodeURIComponent(rawId)}&chapterNumber=${chapterNumber}&provider=atsumaru`,
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

  // Mangaball — check for cross-provider merge format first
  // Format: "at:{atsuMangaId}:{chapterNumber}:{atsuChapterId}"
  // Use getAtsumaruChapterPagesDirect (NOT the scrape-api, which returns
  // the WRONG scanlation's pages).
  if (chapterId.startsWith("at:")) {
    const parts = chapterId.split(":");
    if (parts.length >= 3) {
      // Try the direct atsu.moe page URL builder first
      const directPages = await getAtsumaruChapterPagesDirect(mangaId, chapterId);
      if (directPages.length > 0) return directPages;
      // Fallback: extract manga ID + chapter number and use scrape-api
      // (last resort — may return wrong scanlation but better than nothing)
      const atsuMangaId = parts[1];
      const chapterNumber = parts[2]; // just the number, not the chapterId
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
  // mangaball.net scraper — it's the ONLY way to get the correct
  // language-specific images.
  //
  // CRITICAL: Do NOT fall back to the scrape-api for non-English
  // translation IDs. The scrape-api always returns ENGLISH pages
  // regardless of which translation ID you pass — so a Spanish chapter
  // would show English pages. If the direct scraper fails, return empty
  // (the reader will show "No pages available" which is better than
  // showing the wrong language).
  const isTranslationId = provider === "mangaball" && /^[0-9a-f]{24}$/i.test(chapterId);

  if (isTranslationId) {
    // Try direct mangaball.net scraper — returns the correct language's images
    const directPages = await getMangaballChapterPagesDirect(chapterId);
    if (directPages.length > 0) {
      return directPages;
    }
    // Direct scraper failed. DO NOT fall back to scrape-api — it would
    // return English pages for this non-English chapter. Return empty.
    console.error("[manga-api] getMangaballChapterPagesDirect failed for translation ID:", chapterId,
      "— NOT falling back to scrape-api (would return English pages)");
    return [];
  }

  // Use chapter number (only works for English chapters on mangaball,
  // or as a last-resort fallback)
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

// ============================================================
// Atsumaru direct DETAIL scraper (primary for at: manga detail)
// ---------------------------------------------------------------------
// atsu.moe's /api/manga/page?id={mangaId} returns rich metadata that
// the manga-scrape-api's /api/scrape/info endpoint DOES NOT expose:
//
//   • poster.{small,medium,large}Image  (proper sized poster URLs)
//   • banner.{url, aspectRatio}         (real hero banner image)
//   • synopsis                          (full synopsis — not truncated)
//   • scanlators: [{id, name}]          (scanlation groups = "sources")
//   • authors: [{id, name, slug, type}] (type = "Author" | "Artist")
//   • genres: [{id, name, weight}]
//   • tags: [{id, name, namePath, weight}]
//   • status, type, released, views, avgRating, isAdult
//   • anilistId, malId, apId, kitsuId, annId, mangaBakaId, mangaUpdatesId
//   • chapters: [{id, scanlationMangaId, title, number, createdAt, pageCount, index}]
//     — each chapter ID is the SHORT atsu.moe chapter ID (e.g. "LMHqVf")
//       used for fetching pages directly via the
//       https://atsu.moe/static/pages/{chapterId}/{i}.webp URL pattern.
//
// IMPORTANT — image URL format:
//   The manga-scrape-api returns image URLs WITHOUT the /static/ prefix
//   (e.g. "https://atsu.moe/posters/xxx.webp") which 404s. atsu.moe
//   serves images from /static/{path}. This function uses the existing
//   atsuImageUrl() helper to ALWAYS emit /static/-prefixed URLs.
//
// IMPORTANT — chapter pages URL pattern:
//   Chapter images live at https://atsu.moe/static/pages/{chapterId}/{i}.webp
//   where {chapterId} is the SHORT atsu.moe chapter ID (e.g. "LMHqVf")
//   and {i} is the 0-indexed page number. Each chapter knows its own
//   pageCount so we can build the URLs without any API call.
// ============================================================

interface AtsuDirectMangaPageResponse {
  mangaPage: {
    id: string;
    title: string;
    englishTitle?: string | null;
    otherNames?: string[];
    type?: string;
    status?: string;
    released?: number;           // ms epoch
    views?: string;
    avgRating?: number;
    isAdult?: boolean;
    synopsis?: string;
    poster?: {
      id?: string;
      image?: string;
      smallImage?: string;
      mediumImage?: string;
      largeImage?: string;
    } | null;
    banner?: { url?: string; aspectRatio?: number } | null;
    authors?: Array<{ id?: string; name?: string; slug?: string; type?: string }> | null;
    genres?: Array<{ id?: string; name?: string; weight?: string }> | null;
    tags?: Array<{ id?: string; name?: string; namePath?: string; weight?: string }> | null;
    scanlators?: Array<{ id?: string; name?: string }> | null;
    anilistId?: string | null;
    malId?: string | null;
    apId?: string | null;
    kitsuId?: string | null;
    annId?: string | null;
    mangaBakaId?: string | null;
    mangaUpdatesId?: string | null;
    totalChapterCount?: number | null;
    hasMoreChapters?: boolean | null;
    chapters?: Array<{
      id: string;
      scanlationMangaId?: string;
      title?: string;
      number?: number;
      createdAt?: number;
      index?: number;
      pageCount?: number;
    }> | null;
  } | null;
}

interface AtsuDirectChaptersPageResponse {
  chapters?: Array<{
    id: string;
    scanlationMangaId?: string;
    title?: string;
    number?: number;
    createdAt?: number;
    index?: number;
    pageCount?: number;
  }> | null;
  hasMore?: boolean | null;
}

/**
 * Fetch ALL chapters for an atsu.moe manga via paginated
 * /api/manga/chapters?id={mangaId}&page={n} endpoint.
 *
 * Each page returns 50 chapters (newest first). We fan out up to 30 pages
 * in parallel (covers up to 1500 chapters). The first page that returns
 * an empty array signals the end of the chapter list.
 *
 * NOTE: paginated chapters do NOT include `scanlationMangaId` — only
 * the manga/page endpoint (initial 80 chapters) does. We merge both
 * sources and rely on chapter IDs to dedupe.
 */
async function fetchAllAtsuChapters(rawId: string): Promise<NonNullable<AtsuDirectChaptersPageResponse["chapters"]>> {
  const MAX_PAGES = 30;
  const all: NonNullable<AtsuDirectChaptersPageResponse["chapters"]> = [];
  const seen = new Set<string>();

  const pagePromises = Array.from({ length: MAX_PAGES }, (_, i) => i + 1).map(async (page) => {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12000);
      const res = await fetch(
        `${ATSU_DIRECT_BASE}/api/manga/chapters?id=${encodeURIComponent(rawId)}&page=${page}`,
        { headers: ATSU_DIRECT_HEADERS, signal: controller.signal },
      );
      clearTimeout(timeout);
      if (!res.ok) return [];
      const data = (await res.json()) as AtsuDirectChaptersPageResponse;
      return data?.chapters || [];
    } catch {
      return [];
    }
  });

  const results = await Promise.all(pagePromises);
  for (const chs of results) {
    if (!chs || chs.length === 0) continue;
    for (const ch of chs) {
      if (ch.id && !seen.has(ch.id)) {
        seen.add(ch.id);
        all.push(ch);
      }
    }
  }
  return all;
}

/**
 * Fetch rich manga detail directly from atsu.moe.
 * Returns null if the manga isn't found or the request fails.
 *
 * The returned AtsuMangaDetail includes:
 *   • Properly-sized poster URL (medium preferred, /static/-prefixed)
 *   • Banner URL (/static/-prefixed) — may be empty if manga has no banner
 *   • Full synopsis (NOT truncated)
 *   • scanlators: [{id, name}] — the scanlation groups ("sources") for this manga
 *   • Chapters with their short atsu.moe IDs + scanlationMangaId (linked to scanlators)
 *   • Properly-typed authors/artists arrays (filtered by type=Author/Artist)
 *
 * CHAPTER PAGINATION:
 *   /api/manga/page?id=X returns only the first ~80 chapters (latest +
 *   startReading). We ALSO call /api/manga/chapters?id=X&page=N (50 per
 *   page, newest first) in parallel to fetch ALL chapters — this is
 *   essential for manga with hundreds of chapters.
 */
async function getAtsumaruDetailDirect(rawId: string): Promise<AtsuMangaDetail | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    const [pageRes, allPaginatedChapters] = await Promise.all([
      fetch(
        `${ATSU_DIRECT_BASE}/api/manga/page?id=${encodeURIComponent(rawId)}`,
        { headers: ATSU_DIRECT_HEADERS, signal: controller.signal },
      ),
      fetchAllAtsuChapters(rawId),
    ]);
    clearTimeout(timeout);
    if (!pageRes.ok) return null;
    const data = (await pageRes.json()) as AtsuDirectMangaPageResponse;
    const mp = data?.mangaPage;
    if (!mp || !mp.id) return null;

    // ── Poster ──
    const posterPath =
      mp.poster?.mediumImage ||
      mp.poster?.largeImage ||
      mp.poster?.smallImage ||
      mp.poster?.image ||
      "";
    const posterUrl = atsuImageUrl(posterPath);

    // ── Banner ──
    const bannerPath = mp.banner?.url || "";
    const bannerUrl = bannerPath ? atsuImageUrl(bannerPath) : "";

    // ── Authors / Artists (split by type) ──
    const rawAuthors = mp.authors || [];
    const authors = rawAuthors
      .filter(a => (a.type || "").toLowerCase() === "author" && a.name)
      .map(a => a.name!.trim());
    const artists = rawAuthors
      .filter(a => (a.type || "").toLowerCase() === "artist" && a.name)
      .map(a => a.name!.trim());

    // ── Genres / Tags ──
    const genres = (mp.genres || []).map(g => g.name).filter(Boolean) as string[];
    const tags = (mp.tags || []).map(t => t.name).filter(Boolean) as string[];

    // ── Scanlators (the "sources" for this manga) ──
    const scanlators = (mp.scanlators || [])
      .filter(s => s.id && s.name)
      .map(s => ({ id: String(s.id), name: String(s.name) }));

    // Build a lookup from scanlationMangaId → scanlator name
    const scanlatorNameById = new Map<string, string>();
    for (const s of scanlators) scanlatorNameById.set(s.id, s.name);

    // ── Merge chapters from both sources (dedupe by chapter ID) ──
    type AtsuChapter = NonNullable<NonNullable<AtsuDirectMangaPageResponse["mangaPage"]>["chapters"]>[number];
    const chapterMap = new Map<string, AtsuChapter>();
    for (const ch of mp.chapters || []) {
      if (ch.id) chapterMap.set(ch.id, ch);
    }
    for (const ch of allPaginatedChapters || []) {
      if (ch.id && !chapterMap.has(ch.id)) chapterMap.set(ch.id, ch);
    }

    const chapters: AtsuMangaChapter[] = Array.from(chapterMap.values()).map(ch => {
      const scanId = ch.scanlationMangaId || "";
      const scanName = scanlatorNameById.get(scanId);
      return {
        id: ch.id,
        title: ch.title || `Chapter ${ch.number ?? "?"}`,
        number: typeof ch.number === "number" ? ch.number : parseFloat(String(ch.number)) || 0,
        date: ch.createdAt ? new Date(ch.createdAt).toISOString() : undefined,
        scanGroup: scanName,
        scanId,
        chapterIndex: ch.index,
        pages: ch.pageCount || 0,
        pageCount: ch.pageCount || 0,
        lang: "en", // atsumaru is English-only
      };
    });

    // Dedupe by chapter ID (atsu.moe IDs are unique per chapter+scanlation).
    const seenChId = new Set<string>();
    const dedupedChapters = chapters.filter(ch => {
      if (ch.id && seenChId.has(ch.id)) return false;
      if (ch.id) seenChId.add(ch.id);
      return true;
    }).sort((a, b) => {
      if (a.number !== b.number) return a.number - b.number;
      const aWeight = a.scanGroup ? 0 : 1;
      const bWeight = b.scanGroup ? 0 : 1;
      if (aWeight !== bWeight) return aWeight - bWeight;
      return (a.scanGroup || "").localeCompare(b.scanGroup || "");
    });

    const year = mp.released ? new Date(mp.released).getUTCFullYear() : undefined;

    const anilistId = mp.anilistId ? parseInt(String(mp.anilistId), 10) : undefined;
    const malId = mp.malId ? parseInt(String(mp.malId), 10) : undefined;

    return {
      id: prefixId("atsumaru", mp.id),
      title: mp.title || "Unknown Title",
      englishTitle: mp.englishTitle || undefined,
      altTitles: mp.otherNames || [],
      poster: posterUrl,
      banner: bannerUrl,
      cover: posterUrl,
      description: mp.synopsis || "",
      type: mp.type || "manga",
      status: mp.status,
      year,
      authors: authors.length ? authors : "Unknown",
      artists,
      genres,
      tags,
      isAdult: mp.isAdult || false,
      anilistId: anilistId && !isNaN(anilistId) ? anilistId : undefined,
      malId: malId && !isNaN(malId) ? malId : undefined,
      chapters: dedupedChapters,
      totalChapters: dedupedChapters.length,
      rating: typeof mp.avgRating === "number" ? mp.avgRating : undefined,
      views: mp.views,
      source: "atsumaru",
      slug: mp.id,
      scanlators,
    };
  } catch (err) {
    console.error("[manga-api] getAtsumaruDetailDirect error:", err);
    return null;
  }
}

/**
 * Build chapter page URLs directly from the atsu.moe URL pattern.
 *
 * URL pattern: https://atsu.moe/static/pages/{chapterId}/{i}.webp
 *   where {chapterId} is the short atsu.moe chapter ID (e.g. "LMHqVf")
 *   and {i} is the 0-indexed page number.
 *
 * This skips the manga-scrape-api's atsumaru pages endpoint entirely
 * — the scrape-api always returns the SAME chapter's pages regardless
 * of which scanlation the user picked (because it only takes
 * chapterNumber, not chapterId). Going direct fixes that bug and is
 * also faster (one less API hop).
 *
 * pageCount comes from the chapter object stored in AtsuMangaDetail.
 * If we don't have it, we try a few pages and stop at the first 404.
 */
async function getAtsumaruChapterPagesDirect(
  mangaId: string,
  chapterId: string,
): Promise<AtsuChapterPage[]> {
  // chapterId for atsumaru is the short atsu.moe ID (e.g. "LMHqVf").
  // It may also arrive as "at:{mangaId}:{number}" from the cross-provider
  // merge path — in that case we need to look up the real chapter ID.
  let realChapterId = chapterId;
  let pageCount: number | undefined;

  if (chapterId.startsWith("at:")) {
    // Cross-provider merge format: at:{mangaId}:{chapterNumber}
    const parts = chapterId.split(":");
    if (parts.length >= 3) {
      const atsuMangaId = parts[1];
      const chapterNumber = parseFloat(parts.slice(2).join(":"));
      // Look up the real chapter ID + pageCount from atsu.moe
      try {
        const detail = await getAtsumaruDetailDirect(atsuMangaId);
        if (detail?.chapters) {
          // Pick the first scanlation's chapter for this number
          const ch = detail.chapters.find(c => c.number === chapterNumber);
          if (ch) {
            realChapterId = ch.id;
            pageCount = ch.pageCount;
          }
        }
      } catch { /* fall through to direct URL probe */ }
    }
  } else {
    // chapterId IS the short atsu.moe chapter ID — try to get pageCount
    // from cache. We don't have a global cache here, so we'll just probe.
  }

  if (!realChapterId || realChapterId.startsWith("at:")) {
    return []; // couldn't resolve the real chapter ID
  }

  // If we know the page count, build URLs directly (fast path)
  if (pageCount && pageCount > 0) {
    return Array.from({ length: pageCount }, (_, i) => ({
      index: i,
      url: `${ATSU_DIRECT_BASE}/static/pages/${realChapterId}/${i}.webp`,
    }));
  }

  // Otherwise probe for pages until we hit a 404 (slow path, but rare)
  // Probe in small batches to find the page count quickly
  const pages: AtsuChapterPage[] = [];
  let i = 0;
  const BATCH = 5;
  while (true) {
    const batch = Array.from({ length: BATCH }, (_, j) => i + j);
    const results = await Promise.all(
      batch.map(async (idx) => {
        try {
          const url = `${ATSU_DIRECT_BASE}/static/pages/${realChapterId}/${idx}.webp`;
          const res = await fetch(url, {
            method: "HEAD",
            headers: { "User-Agent": ATSU_DIRECT_HEADERS["User-Agent"] },
            signal: AbortSignal.timeout(8000),
          });
          return { idx, ok: res.ok };
        } catch {
          return { idx, ok: false };
        }
      })
    );
    // Stop at the first failure in the batch
    let anyFailed = false;
    for (const r of results) {
      if (r.ok) {
        pages.push({
          index: r.idx,
          url: `${ATSU_DIRECT_BASE}/static/pages/${realChapterId}/${r.idx}.webp`,
        });
      } else {
        anyFailed = true;
        break;
      }
    }
    if (anyFailed) break;
    i += BATCH;
    if (i > 200) break; // safety cap
  }
  return pages;
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
