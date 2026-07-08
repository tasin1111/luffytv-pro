// =====================================================================
//  LuffyTV Manga API — MangaVault / atsumaru (atsu.moe)
// ---------------------------------------------------------------------
//  Provider: atsumaru (atsu.moe) via the MangaVault REST API hosted at
//  https://manga-scrape-api.vercel.app
//
//  Authoritative endpoints (from walterwhite-69/MangaVault, api.py):
//    GET /atsu/home
//        → data = { <sectionKey>: { title, items: [ item ] } }
//    GET /atsu/search?keyword={q}&limit={n}
//        → data = { found, items: [ item ] }
//    GET /atsu/manga/{id}/details
//        → data = { id, title, type, views, released, url, cover,
//                   scanlators, chapters: [ chapter ], chapter_count }
//    GET /atsu/manga/{id}/chapter/{chapterId}/images
//        → data = [ "https://atsu.moe/…", … ]   (plain URL strings)
//
//  Every response is wrapped as { success, took, data }.
//
//  item     = { id, title, slug, cover, type, isAdult, url,
//               status?, year? }
//  chapter  = { id, number, title, scanId, pageCount, url }
//
//  IMPORTANT — the chapter IMAGES endpoint keys off the chapter `id`
//  (NOT the chapter number). Callers must navigate with `chapter.id`.
//  Cover/page URLs are already absolute (https://atsu.moe/…).
// =====================================================================

const SCRAPE_BASE =
  process.env.MANGA_SCRAPE_API_BASE || "https://manga-scrape-api.vercel.app";

const SCRAPE_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.5",
};

/**
 * Fetch a MangaVault endpoint and unwrap the { success, took, data }
 * envelope. Returns the inner `data`, or null on any failure.
 */
async function scrapeFetch<T = any>(path: string, timeoutMs = 20000): Promise<T | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const url = path.startsWith("http") ? path : `${SCRAPE_BASE}${path}`;
    const res = await fetch(url, { headers: SCRAPE_HEADERS, signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const body = await res.json();
    // Unwrap { success, took, data }; tolerate a bare payload too.
    return (body?.data ?? body) as T;
  } catch (err) {
    clearTimeout(timeout);
    console.error("[manga-api] scrapeFetch error:", path, err);
    return null;
  }
}

// ============================================================
// Public types (kept stable for the API routes + components)
// ============================================================

export interface AtsuMangaEntry {
  id: string;
  title: string;
  englishTitle?: string;
  poster?: string;
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
  scanlators?: string[];
  genres?: string[];
  tags?: string[];
  isAdult?: boolean;
  anilistId?: number;
  malId?: number;
  chapters?: AtsuMangaChapter[];
  totalChapters?: number;
  rating?: number;
  views?: number | string;
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
// Raw shapes (from MangaVault)
// ============================================================

interface AtsuItem {
  id: string;
  title: string;
  slug?: string;
  cover?: string;
  type?: string;
  isAdult?: boolean;
  status?: string;
  year?: number;
  url?: string;
}

interface AtsuHomeData {
  [sectionKey: string]: { title?: string; items?: AtsuItem[] };
}

interface AtsuSearchData {
  found?: number;
  items?: AtsuItem[];
}

interface AtsuChapterRaw {
  id: string;
  number: number;
  title?: string;
  scanId?: string;
  pageCount?: number;
  url?: string;
}

interface AtsuDetailData {
  id?: string;
  title?: string;
  type?: string;
  views?: number | string;
  released?: number | string;
  url?: string;
  cover?: string;
  scanlators?: string[];
  chapters?: AtsuChapterRaw[];
  chapter_count?: number;
}

// ============================================================
// Mappers
// ============================================================

function mapItem(it: AtsuItem): AtsuMangaEntry {
  return {
    id: it.id || it.slug || "",
    title: it.title || "Unknown",
    poster: it.cover || "",
    cover: it.cover || "",
    type: (it.type || "manga").toLowerCase(),
    isAdult: !!it.isAdult,
    status: it.status,
    year: it.year,
    source: "atsumaru",
    slug: it.slug || it.id,
  };
}

/** Pull a 4-digit year out of the `released` field (year or date string). */
function parseYear(released?: number | string): number | undefined {
  if (typeof released === "number" && released > 1000) return released;
  if (typeof released === "string") {
    const m = released.match(/\b(19|20)\d{2}\b/);
    if (m) return parseInt(m[0], 10);
  }
  return undefined;
}

// ============================================================
// Public API
// ============================================================

/** Home page: real trending / latest sections from atsumaru. */
export async function getMangaHome(): Promise<AtsuHomeSection[]> {
  const data = await scrapeFetch<AtsuHomeData>("/atsu/home");
  if (!data || typeof data !== "object") return [];

  const sections: AtsuHomeSection[] = [];
  for (const [key, section] of Object.entries(data)) {
    if (!section || !Array.isArray(section.items)) continue;
    const items = section.items.map(mapItem).filter(m => m.id);
    if (items.length === 0) continue;
    sections.push({
      title: section.title || key.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()),
      type: key,
      items,
    });
  }
  return sections;
}

/** Search atsumaru. */
export async function searchManga(query: string, limit = 20): Promise<AtsuMangaEntry[]> {
  if (!query.trim()) return [];
  const data = await scrapeFetch<AtsuSearchData>(
    `/atsu/search?keyword=${encodeURIComponent(query.trim())}&limit=${limit}`,
  );
  const items = data?.items || [];
  return items.map(mapItem).filter(m => m.id).slice(0, limit);
}

/** Manga detail (metadata + chapter list). */
export async function getMangaDetail(mangaId: string): Promise<AtsuMangaDetail | null> {
  if (!mangaId) return null;
  const data = await scrapeFetch<AtsuDetailData>(
    `/atsu/manga/${encodeURIComponent(mangaId)}/details`,
  );
  if (!data || (!data.title && !(data.chapters && data.chapters.length))) return null;

  const rawChapters = data.chapters || [];
  const seen = new Set<string>();
  const chapters: AtsuMangaChapter[] = rawChapters
    .filter(c => {
      if (!c?.id || seen.has(c.id)) return false;
      seen.add(c.id);
      return true;
    })
    .map(c => ({
      id: c.id,
      title: c.title && c.title.trim() ? c.title : `Chapter ${c.number}`,
      number: c.number,
      scanGroup: c.scanId,
      pageCount: c.pageCount || 0,
      pages: c.pageCount || 0,
    }))
    .sort((a, b) => a.number - b.number);

  return {
    id: data.id || mangaId,
    title: data.title || "",
    poster: data.cover || "",
    banner: data.cover || "",
    cover: data.cover || "",
    type: (data.type || "manga").toLowerCase(),
    views: data.views,
    year: parseYear(data.released),
    scanlators: data.scanlators || [],
    chapters,
    totalChapters: data.chapter_count ?? chapters.length,
    source: "atsumaru",
    slug: mangaId,
  };
}

/**
 * Chapter pages. NOTE: `chapterId` here is the atsumaru chapter `id`
 * (not the number) — that's what the images endpoint keys off.
 */
export async function getChapterImages(
  mangaId: string,
  chapterId: string,
): Promise<AtsuChapterPage[]> {
  if (!mangaId || !chapterId) return [];
  const data = await scrapeFetch<any>(
    `/atsu/manga/${encodeURIComponent(mangaId)}/chapter/${encodeURIComponent(chapterId)}/images`,
  );
  // data is normally a plain array of URL strings; tolerate object shapes.
  const arr: any[] = Array.isArray(data) ? data : (data?.images || data?.pages || []);
  return arr
    .map((entry, i): AtsuChapterPage => {
      const url = typeof entry === "string" ? entry : (entry?.url || entry?.image || "");
      return { index: i, url };
    })
    .filter(p => p.url);
}

// ============================================================
// Backwards-compat aliases (kept so existing imports resolve)
// ============================================================

export const searchAtsu = searchManga;
export const getAtsuDetail = getMangaDetail;
export const getAtsuChapterImages = getChapterImages;
export const getAtsuHome = getMangaHome;

/** No longer used (MangaDex fallback retired) — kept as a safe stub. */
export async function getMangaDexChapterPages(_chapterId: string): Promise<AtsuChapterPage[]> {
  return [];
}

/** Legacy stub. */
export function mapMangaDexEntry(_m: any): AtsuMangaEntry {
  return { id: "", title: "", source: "mangadex" };
}
