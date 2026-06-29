/**
 * AnimePahe API Client
 * ====================
 *
 * AnimePahe (https://animepahe.pw) sits behind Cloudflare's managed
 * challenge — the hardest tier of CF protection. It cannot be bypassed
 * by cloudscraper, @sparticuz/chromium (Puppeteer or Playwright),
 * puppeteer-extra-stealth, real Chrome, curl_cffi TLS impersonation,
 * or our aniwatchtv XOR proxy. ALL of them return 403 with the
 * "Just a moment..." challenge page.
 *
 * Working approaches (in order of reliability):
 *
 *   1. **External scraper service** (recommended)
 *      Deploy sofyan-rs/animepahe-api on Render or Railway (both support
 *      headed browsers + persistent cookies). Set:
 *        ANIMEPAHE_SCRAPER_URL=https://your-render-app.onrender.com
 *      This lib calls that scraper's REST endpoints.
 *
 *   2. **Manual cf_clearance cookie** (last resort)
 *      Open animepahe.pw in a real browser, solve the challenge manually,
 *      copy the `cf_clearance` cookie from DevTools → Application → Cookies,
 *      and set it as env var:
 *        ANIMEPAHE_CF_CLEARANCE=eyJhbGciOiJIUzI1...
 *      Cookies expire after 30 minutes — must be refreshed manually.
 *      This is too tedious for production but works for testing.
 *
 * If neither is configured, animepahe servers simply don't appear in the
 * server list — the other 14 sources still work.
 *
 * Scraper API contract (any compatible scraper must implement these):
 *   GET /api/scrape?type=search&q=wistoria
 *     → { total, data: [{ id, title, type, episodes, status, season, score, ... }] }
 *
 *   GET /api/scrape?type=episodes&animeId={animeId}&page=1
 *     → { total, per_page, current_page, last_page,
 *         data: [{ id, episode, session, audio, ... }] }
 *
 *   GET /api/scrape?type=links&episodeSessionId={session}
 *     → { data: { audio: { sub: [...], dub: [...] } }, match: {...} }
 *
 *   GET /api/scrape?type=kwik&kwik=https://kwik.si/e/xxx
 *     → { kwikUrl, mp4Url }
 */

import { wrapStreamUrl } from "./proxy";

// ─── Config ──────────────────────────────────────────────────────────────────

const SCRAPER_URL = process.env.ANIMEPAHE_SCRAPER_URL || "";
const CF_CLEARANCE = process.env.ANIMEPAHE_CF_CLEARANCE || "";
const SCRAPER_TIMEOUT_MS = 8000;

const ANIMEPAHE_BASE = "https://animepahe.pw";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

export const ANIMEPAHE_ENABLED = !!(SCRAPER_URL || CF_CLEARANCE);

// ─── Types ───────────────────────────────────────────────────────────────────

export interface AnimePaheSearchResult {
  id: string;          // anime session ID (used as animeId in subsequent calls)
  title: string;
  type: string;        // "TV", "Movie", etc.
  episodes: number;
  status: string;
  season: string;
  score: number;
  poster?: string;
}

export interface AnimePaheEpisode {
  id: number;          // episode number (1, 2, 3...)
  session: string;     // session ID used to fetch links
  audio?: string;      // "sub" | "dub"
  title?: string;
  thumbnail?: string;
}

export interface AnimePaheStreamLink {
  url: string;         // kwik.si embed URL or direct mp4 URL
  quality: string;     // "1080p", "720p", "360p"
  audio: "sub" | "dub";
  type: "mp4" | "embed";
}

export interface AnimePaheVerifiedResult {
  provider: "animepahe";
  type: "sub" | "dub";
  quality: string;
  streamUrl: string;   // ready-to-play, wrapped through aniwatchtv proxy
  isMP4: boolean;
  isM3U8: boolean;
  kwikUrl?: string;
}

// ─── In-memory cache for AniList ID → animepahe ID mapping ──────────────────

const anilistToPaheCache = new Map<number, { paheId: string; title: string; expires: number }>();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

// ─── Scraper fetch helper ───────────────────────────────────────────────────

async function scraperFetch(path: string, timeoutMs = SCRAPER_TIMEOUT_MS): Promise<any | null> {
  if (!SCRAPER_URL) return null;
  const url = `${SCRAPER_URL.replace(/\/$/, "")}${path}`;
  try {
    const res = await Promise.race([
      fetch(url, { cache: "no-store" }),
      new Promise<Response | null>((r) => setTimeout(() => r(null), timeoutMs)),
    ]);
    if (!res || !res.ok) {
      console.error(`[AnimePahe] scraperFetch ${path} → HTTP ${res?.status || "timeout"}`);
      return null;
    }
    return await res.json();
  } catch (e: any) {
    console.error(`[AnimePahe] scraperFetch ${path} failed:`, e?.message || e);
    return null;
  }
}

// ─── Direct animepahe API call with manual cf_clearance cookie ───────────────
//
// Last-resort fallback when no external scraper is configured. Uses the
// manually-injected cf_clearance cookie. Limited because the cookie expires
// after 30 min — the user must refresh it manually.

async function directApiCall(path: string, timeoutMs = SCRAPER_TIMEOUT_MS): Promise<any | null> {
  if (!CF_CLEARANCE) return null;
  const url = `${ANIMEPAHE_BASE}${path}`;
  const headers: Record<string, string> = {
    "User-Agent": UA,
    Accept: "application/json, text/javascript, */*; q=0.01",
    "Accept-Language": "en-US,en;q=0.9",
    "X-Requested-With": "XMLHttpRequest",
    Referer: ANIMEPAHE_BASE + "/",
    Cookie: `cf_clearance=${CF_CLEARANCE}`,
  };
  try {
    const res = await Promise.race([
      fetch(url, { headers, cache: "no-store" }),
      new Promise<Response | null>((r) => setTimeout(() => r(null), timeoutMs)),
    ]);
    if (!res || !res.ok) return null;
    const text = await res.text();
    if (text.startsWith("<")) return null; // got HTML (challenge page)
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function apiFetch(path: string, timeoutMs = SCRAPER_TIMEOUT_MS): Promise<any | null> {
  // Prefer external scraper; fall back to direct API call with cf_clearance cookie
  if (SCRAPER_URL) {
    return scraperFetch(`/api/scrape${path}`, timeoutMs);
  }
  return directApiCall(path, timeoutMs);
}

// ─── Search + AniList ID resolution ─────────────────────────────────────────

/**
 * Resolve an AniList anime ID → animepahe anime session ID.
 * Strategy: fetch the anime's English + romaji titles from AniList, then
 * search animepahe. Try several title variants in order.
 */
export async function resolveAnimePaheId(
  anilistId: number,
  titles: { english?: string; romaji?: string; native?: string }
): Promise<{ paheId: string; title: string } | null> {
  // Check cache
  const cached = anilistToPaheCache.get(anilistId);
  if (cached && cached.expires > Date.now()) {
    return { paheId: cached.paheId, title: cached.title };
  }

  // Build list of search queries (longest = most specific, first)
  const queries = [
    titles.english,
    titles.romaji,
    titles.native,
    // Strip "Season N" / "Part N" / ": Subtitle" for fuzzy match
    titles.english?.replace(/\s*(season|cour|part)\s*\d+/i, "").replace(/:\s*.+$/, "").trim(),
    titles.romaji?.replace(/\s*(season|cour|part)\s*\d+/i, "").replace(/:\s*.+$/, "").trim(),
  ].filter((q): q is string => !!q && q.length >= 3);

  // Dedupe
  const seen = new Set<string>();
  const uniqueQueries = queries.filter((q) => {
    const k = q.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  for (const q of uniqueQueries) {
    const data = await apiFetch(`?type=search&q=${encodeURIComponent(q)}`);
    if (data?.data && Array.isArray(data.data) && data.data.length > 0) {
      // Find best match: prefer exact title match, otherwise take first result
      const lowerQuery = q.toLowerCase();
      const exact = data.data.find((a: any) =>
        (a.title || "").toLowerCase() === lowerQuery
      );
      const best = exact || data.data[0];
      const result = { paheId: String(best.id), title: best.title };
      anilistToPaheCache.set(anilistId, {
        paheId: result.paheId,
        title: result.title,
        expires: Date.now() + CACHE_TTL_MS,
      });
      console.log(`[AnimePahe] anilistId=${anilistId} → paheId=${result.paheId} (query: "${q}", title: "${result.title}")`);
      return result;
    }
  }

  console.log(`[AnimePahe] no match for anilistId=${anilistId} (tried ${uniqueQueries.length} queries)`);
  return null;
}

// ─── Episode list ────────────────────────────────────────────────────────────

export async function getAnimePaheEpisodes(
  paheId: string,
  timeoutMs = SCRAPER_TIMEOUT_MS
): Promise<AnimePaheEpisode[]> {
  const all: AnimePaheEpisode[] = [];
  let page = 1;
  let lastPage = 1;

  while (page <= lastPage && all.length < 200) {
    const data = await apiFetch(
      `?type=episodes&animeId=${encodeURIComponent(paheId)}&page=${page}`,
      timeoutMs
    );
    if (!data?.data) break;
    for (const ep of data.data) {
      all.push({
        id: ep.episode,
        session: ep.session,
        audio: ep.audio,
        title: ep.title,
        thumbnail: ep.thumbnail,
      });
    }
    lastPage = data.last_page || 1;
    page++;
  }

  return all.sort((a, b) => a.id - b.id);
}

// ─── Episode links ───────────────────────────────────────────────────────────

export async function getAnimePaheLinks(
  episodeSession: string,
  timeoutMs = SCRAPER_TIMEOUT_MS
): Promise<{ sub: AnimePaheStreamLink[]; dub: AnimePaheStreamLink[] }> {
  const data = await apiFetch(
    `?type=links&episodeSessionId=${encodeURIComponent(episodeSession)}`,
    timeoutMs
  );
  if (!data?.data?.audio) return { sub: [], dub: [] };

  const toLinks = (arr: any[] | undefined, audio: "sub" | "dub"): AnimePaheStreamLink[] => {
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((l) => l?.kwik || l?.url)
      .map((l) => ({
        url: l.kwik || l.url,
        quality: l.quality || l.fansub || "unknown",
        audio,
        type: "embed" as const,
      }));
  };

  return {
    sub: toLinks(data.data.audio.sub, "sub"),
    dub: toLinks(data.data.audio.dub, "dub"),
  };
}

// ─── Resolve kwik.si → direct mp4 URL ──────────────────────────────────────

export async function resolveKwikMp4(
  kwikUrl: string,
  timeoutMs = SCRAPER_TIMEOUT_MS
): Promise<string | null> {
  if (!SCRAPER_URL) return null;
  const data = await scraperFetch(
    `/api/scrape?type=kwik&kwik=${encodeURIComponent(kwikUrl)}`,
    timeoutMs
  );
  return data?.mp4Url || null;
}

// ─── Convenience: fetch all sources for an episode ──────────────────────────

export async function fetchAllAnimePaheSources(
  anilistId: number,
  episodeNum: number,
  titles: { english?: string; romaji?: string; native?: string },
  options?: { sub?: boolean; dub?: boolean; timeoutMs?: number }
): Promise<AnimePaheVerifiedResult[]> {
  if (!ANIMEPAHE_ENABLED) return [];

  const wantSub = options?.sub ?? true;
  const wantDub = options?.dub ?? true;
  const timeoutMs = options?.timeoutMs ?? 8000;

  try {
    // Step 1: Resolve AniList ID → animepahe anime ID
    const pahe = await resolveAnimePaheId(anilistId, titles);
    if (!pahe) return [];

    // Step 2: Get episode list, find the one matching episodeNum
    const episodes = await getAnimePaheEpisodes(pahe.paheId, timeoutMs);
    const ep = episodes.find((e) => e.id === episodeNum) || episodes[episodeNum - 1];
    if (!ep) {
      console.log(`[AnimePahe] episode ${episodeNum} not found for "${pahe.title}"`);
      return [];
    }

    // Step 3: Get links for this episode
    const links = await getAnimePaheLinks(ep.session, timeoutMs);

    // Step 4: Resolve kwik URLs → direct mp4 URLs (limit to top 3 per type to avoid hammering)
    const results: AnimePaheVerifiedResult[] = [];

    const processLinks = async (arr: AnimePaheStreamLink[], type: "sub" | "dub") => {
      const top = arr.slice(0, 3);
      for (const link of top) {
        const mp4Url = await resolveKwikMp4(link.url, timeoutMs);
        if (!mp4Url) continue;
        results.push({
          provider: "animepahe",
          type,
          quality: link.quality,
          streamUrl: wrapStreamUrl(mp4Url),  // wrap through aniwatchtv proxy for CORS
          isMP4: true,
          isM3U8: false,
          kwikUrl: link.url,
        });
      }
    };

    const tasks: Promise<void>[] = [];
    if (wantSub && links.sub.length > 0) tasks.push(processLinks(links.sub, "sub"));
    if (wantDub && links.dub.length > 0) tasks.push(processLinks(links.dub, "dub"));
    await Promise.allSettled(tasks);

    console.log(`[AnimePahe] ${anilistId} ep${episodeNum}: ${results.length} playable streams (sub=${links.sub.length} dub=${links.dub.length} fetched)`);
    return results;
  } catch (e: any) {
    console.error(`[AnimePahe] fetchAllSources failed for ${anilistId} ep${episodeNum}:`, e?.message || e);
    return [];
  }
}
