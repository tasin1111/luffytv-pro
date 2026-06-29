/**
 * AnimePahe API Client (LuffyTV-owned scraper)
 * =============================================
 *
 * Uses OUR OWN scraper at https://luffytv-animepahe-scraper.onrender.com
 * (deployed from /home/z/my-project/animepahe-scraper/). The scraper has
 * 3-tier Cloudflare bypass:
 *
 *   Tier 1: cloudscraper (programmatic JS challenge solve)
 *   Tier 2: manual cf_clearance cookie (env var on scraper side)
 *   Tier 3: external fallback proxy (keeps core working when CF blocks us)
 *
 * Our scraper exposes 10 endpoints (the Railway app only had 3):
 *
 *   GET /search?q=&page=                    → search anime by title
 *   GET /airing?page=N                      → recent airing episodes
 *   GET /popular?page=N                     → popular anime
 *   GET /seasonal                           → this season's anime
 *   GET /anime/{session}/info               → anime metadata (cover, synopsis)
 *   GET /anime/{session}/episodes?page=N    → episode list
 *   GET /play/{session}/{ep_session}        → qualities + kwik + m3u8
 *   GET /kwik?url=                          → resolve kwik.si → direct mp4
 *   GET /health                             → status check
 *   POST /refresh-cookie                    → refresh cf_clearance (admin)
 *
 * AniList ID → anime_session resolution:
 *   1. Try /search?q={title} — fast, accurate, works for any anime
 *   2. Fallback: paginate /airing (first 8 pages, ~95 unique anime),
 *      build {normalized_title → session} cache, refresh every 30 min
 *
 * Stream proxying:
 *   The m3u8 URL is on vault-XX.owocdn.top / vault-XX.uwucdn.top —
 *   require Referer: https://kwik.cx/ (or 403). wrapM3u8Url() encodes
 *   that Referer into the aniwatchtv XOR token.
 */

import { wrapStreamUrl, wrapM3u8Url } from "./proxy";

// ─── Config ──────────────────────────────────────────────────────────────────

/**
 * Default scraper URL — our own deployment on Render.
 *
 * If you haven't deployed the scraper yet, this falls back to the public
 * Railway scraper (which only supports /airing, /episodes, /play — no /search).
 *
 * To deploy your own:
 *   1. Push /home/z/my-project/animepahe-scraper/ to GitHub
 *   2. Deploy to Render/Railway/Fly.io (see README in that folder)
 *   3. Set ANIMEPAHE_SCRAPER_URL env var on Vercel to your deployment URL
 */
const DEFAULT_SCRAPER_URL = "https://pahe-api-lol-vibecoded-ez.up.railway.app";

const SCRAPER_URL = (
  process.env.ANIMEPAHE_SCRAPER_URL ||
  DEFAULT_SCRAPER_URL
).replace(/\/$/, "");

const SCRAPER_TIMEOUT_MS = 8000;

// ─── Types ───────────────────────────────────────────────────────────────────

export interface AnimePaheSearchResult {
  id: number;
  title: string;
  type?: string;
  episodes?: number;
  status?: string;
  season?: string;
  score?: number;
  session?: string;  // anime_session UUID (only from /search on our scraper)
  poster?: string;
}

export interface AnimePaheEpisode {
  episode: number;
  session: string;        // hex episode session
  audio?: string;
  title?: string;
  snapshot?: string;
  duration?: string;
}

export interface AnimePahePlayResponse {
  anime_session: string;
  ep_session: string;
  play_url: string;
  qualities: Record<string, { kwik: string; fansub?: string; audio?: string }>;
  chosen: string;
  kwik: string;
  m3u8: string;
}

export interface AnimePaheVerifiedResult {
  provider: "animepahe";
  type: "sub" | "dub";
  quality: string;
  streamUrl: string;     // ready-to-play (proxied)
  isMP4: boolean;
  isM3U8: boolean;
  isEmbed?: boolean;     // true for raw kwik.cx embed URLs (iframe)
  kwikUrl?: string;
}

// ─── AniList ID → anime_session cache (24h TTL) ──────────────────────────────

const sessionCache = new Map<number, { session: string; title: string; expires: number }>();
const SESSION_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

// ─── Title normalization for matching ────────────────────────────────────────

function normalizeTitle(t: string): string {
  return (t || "")
    .toLowerCase()
    .replace(/\s*(season|cour|part)\s*\d+/gi, "")
    .replace(/:\s*.+$/g, "")
    .replace(/[^a-z0-9]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ─── Scraper fetch helper ───────────────────────────────────────────────────

async function scraperFetch(path: string, timeoutMs = SCRAPER_TIMEOUT_MS): Promise<any | null> {
  const url = `${SCRAPER_URL}${path}`;
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

// ─── AniList ID → anime_session resolution (primary: /search) ───────────────

/**
 * Resolve an AniList anime ID → animepahe anime_session.
 *
 * Strategy (in order):
 *   1. Check in-memory cache (24h TTL)
 *   2. Try our scraper's /search endpoint (fast + accurate for any anime)
 *   3. Fallback: paginate /airing (first 8 pages, ~95 unique anime), build
 *      a {normalized_title → session} cache, refresh every 30 min
 */
export async function resolveAnimePaheSession(
  anilistId: number,
  titles: { english?: string; romaji?: string; native?: string }
): Promise<{ session: string; title: string } | null> {
  // Check cache
  const cached = sessionCache.get(anilistId);
  if (cached && cached.expires > Date.now()) {
    return { session: cached.session, title: cached.title };
  }

  // Build list of search queries (longest = most specific, first)
  const queries = [
    titles.english,
    titles.romaji,
    titles.native,
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

  // Strategy 1: Try /search endpoint (only our scraper supports this)
  for (const q of uniqueQueries) {
    const data = await scraperFetch(`/search?q=${encodeURIComponent(q)}`);
    if (data?.data && Array.isArray(data.data) && data.data.length > 0) {
      // Find best match: prefer exact title match, otherwise take first result
      const lowerQuery = q.toLowerCase();
      const exact = data.data.find((a: any) =>
        (a.title || "").toLowerCase() === lowerQuery
      );
      const best = exact || data.data[0];

      // Our scraper returns `session` directly; the Railway fallback doesn't.
      // If session is missing, we can't use this result — try next strategy.
      if (best.session) {
        const result = { session: String(best.session), title: best.title };
        sessionCache.set(anilistId, {
          session: result.session,
          title: result.title,
          expires: Date.now() + SESSION_CACHE_TTL_MS,
        });
        console.log(`[AnimePahe] anilistId=${anilistId} → session=${result.session.slice(0, 13)}... (via /search, query: "${q}", title: "${result.title}")`);
        return result;
      }
    }
  }

  // Strategy 2: Fallback to /airing pagination (works with Railway scraper)
  return resolveViaAiring(anilistId, uniqueQueries);
}

// ─── Fallback: paginate /airing to find session ─────────────────────────────

interface AiringCache {
  byTitle: Map<string, { session: string; title: string }>;
  expires: number;
}

let _airingCache: AiringCache | null = null;
const AIRING_CACHE_TTL_MS = 30 * 60 * 1000;

async function getAiringCache(): Promise<AiringCache> {
  if (_airingCache && Date.now() < _airingCache.expires) {
    return _airingCache;
  }

  console.log("[AnimePahe] refreshing /airing cache (fallback strategy)...");
  const byTitle = new Map<string, { session: string; title: string }>();
  const start = Date.now();

  const pages = await Promise.all(
    [1, 2, 3, 4, 5, 6, 7, 8].map((p) =>
      scraperFetch(`/airing?page=${p}`, 6000).then((d) => d?.data || []).catch(() => [])
    )
  );

  for (const items of pages) {
    for (const item of items) {
      if (!item?.anime_session || !item?.anime_title) continue;
      const norm = normalizeTitle(item.anime_title);
      if (!norm) continue;
      if (!byTitle.has(norm)) {
        byTitle.set(norm, { session: item.anime_session, title: item.anime_title });
      }
    }
  }

  _airingCache = { byTitle, expires: Date.now() + AIRING_CACHE_TTL_MS };
  console.log(`[AnimePahe] /airing cache: ${byTitle.size} unique anime indexed in ${Date.now() - start}ms`);
  return _airingCache;
}

async function resolveViaAiring(
  anilistId: number,
  queries: string[]
): Promise<{ session: string; title: string } | null> {
  if (queries.length === 0) return null;

  const cache = await getAiringCache();
  for (const q of queries) {
    const norm = normalizeTitle(q);
    if (!norm) continue;

    // Exact normalized match
    if (cache.byTitle.has(norm)) {
      const result = cache.byTitle.get(norm)!;
      sessionCache.set(anilistId, {
        session: result.session,
        title: result.title,
        expires: Date.now() + SESSION_CACHE_TTL_MS,
      });
      console.log(`[AnimePahe] anilistId=${anilistId} → session=${result.session.slice(0, 13)}... (via /airing, title: "${result.title}", query: "${q}")`);
      return result;
    }

    // Fuzzy match: title contains or is contained
    for (const [key, value] of cache.byTitle) {
      if (key.includes(norm) || norm.includes(key)) {
        sessionCache.set(anilistId, {
          session: value.session,
          title: value.title,
          expires: Date.now() + SESSION_CACHE_TTL_MS,
        });
        console.log(`[AnimePahe] anilistId=${anilistId} → session=${value.session.slice(0, 13)}... (fuzzy: "${value.title}" ~ "${q}")`);
        return value;
      }
    }
  }

  console.log(`[AnimePahe] no match for anilistId=${anilistId} (tried: ${queries.join(", ")})`);
  return null;
}

// ─── Episode list ────────────────────────────────────────────────────────────

export async function getAnimePaheEpisodes(
  animeSession: string,
  timeoutMs = SCRAPER_TIMEOUT_MS
): Promise<AnimePaheEpisode[]> {
  const all: AnimePaheEpisode[] = [];

  // Fetch first page to get total + last_page
  const first = await scraperFetch(
    `/anime/${encodeURIComponent(animeSession)}/episodes?page=1`,
    timeoutMs
  );
  if (!first?.data) return all;

  for (const ep of first.data) {
    all.push({
      episode: ep.episode,
      session: ep.session,
      audio: ep.audio,
      title: ep.title,
      snapshot: ep.snapshot,
      duration: ep.duration,
    });
  }

  // If there are more pages, fetch them too (limit to 5)
  const lastPage = Math.min(first.last_page || 1, 5);
  if (lastPage > 1) {
    const pages = await Promise.all(
      Array.from({ length: lastPage - 1 }, (_, i) => i + 2).map((p) =>
        scraperFetch(`/anime/${encodeURIComponent(animeSession)}/episodes?page=${p}`, timeoutMs)
          .then((d) => d?.data || [])
          .catch(() => [])
      )
    );
    for (const items of pages) {
      for (const ep of items) {
        all.push({
          episode: ep.episode,
          session: ep.session,
          audio: ep.audio,
          title: ep.title,
          snapshot: ep.snapshot,
          duration: ep.duration,
        });
      }
    }
  }

  return all.sort((a, b) => a.episode - b.episode);
}

// ─── Play (get stream URLs for an episode) ──────────────────────────────────

export async function getAnimePahePlay(
  animeSession: string,
  epSession: string,
  timeoutMs = SCRAPER_TIMEOUT_MS
): Promise<AnimePahePlayResponse | null> {
  return scraperFetch(
    `/play/${encodeURIComponent(animeSession)}/${encodeURIComponent(epSession)}`,
    timeoutMs
  );
}

// ─── Convenience: fetch all sources for an episode ──────────────────────────

export async function fetchAllAnimePaheSources(
  anilistId: number,
  episodeNum: number,
  titles: { english?: string; romaji?: string; native?: string },
  options?: { sub?: boolean; dub?: boolean; timeoutMs?: number }
): Promise<AnimePaheVerifiedResult[]> {
  const wantSub = options?.sub ?? true;
  const wantDub = options?.dub ?? true;
  const timeoutMs = options?.timeoutMs ?? 8000;

  try {
    // Step 1: Resolve AniList ID → anime_session
    const resolved = await resolveAnimePaheSession(anilistId, titles);
    if (!resolved) return [];

    // Step 2: Get episode list, find the one matching episodeNum
    const episodes = await getAnimePaheEpisodes(resolved.session, timeoutMs);
    const ep = episodes.find((e) => e.episode === episodeNum);
    if (!ep) {
      console.log(`[AnimePahe] episode ${episodeNum} not found for "${resolved.title}" (have ${episodes.length} episodes)`);
      return [];
    }

    // Step 3: Get play URLs
    const play = await getAnimePahePlay(resolved.session, ep.session, timeoutMs);
    if (!play?.m3u8 && !play?.qualities) {
      console.log(`[AnimePahe] no play URLs for ${resolved.title} ep${episodeNum}`);
      return [];
    }

    const results: AnimePaheVerifiedResult[] = [];

    // Type detection from episode audio field
    const audioType = (ep.audio || "").toLowerCase();
    const isDub = audioType === "eng" || audioType === "english" || audioType === "dub";
    if (isDub && !wantDub) return [];
    if (!isDub && !wantSub) return [];
    const type: "sub" | "dub" = isDub ? "dub" : "sub";

    // Add the m3u8 stream (preferred — HLS with quality switching)
    // This is the primary playable stream. It works through aniwatchtv proxy
    // with the correct kwik.cx referer (now handled by CDN_REFERER_PATTERNS
    // in proxy.ts for vault-XX.{owocdn,uwucdn}.top hostnames).
    if (play.m3u8) {
      const qualityKeys = Object.keys(play.qualities || {});
      const bestQuality = qualityKeys.includes("1080p")
        ? "1080p"
        : qualityKeys.includes("720p")
        ? "720p"
        : qualityKeys[0] || "auto";

      results.push({
        provider: "animepahe",
        type,
        quality: bestQuality,
        streamUrl: wrapM3u8Url(play.m3u8),  // wrap through aniwatchtv proxy (Referer: kwik.cx)
        isMP4: false,
        isM3U8: true,
        kwikUrl: play.kwik,
      });
    }

    // Also add per-quality MP4 streams via kwik resolution.
    // Strategy: try our scraper's /kwik endpoint first; if it fails (kwik.cx
    // blocks server-side fetches without cf_clearance), skip silently — the
    // m3u8 stream above is already playable and contains the same content.
    // Limit to top 2 qualities to avoid clutter.
    if (play.qualities) {
      const sorted = Object.entries(play.qualities)
        .sort(([a], [b]) => {
          const rank = (q: string) => parseInt(q) || 0;
          return rank(b) - rank(a);
        })
        .slice(0, 2);

      // Run kwik resolution in parallel for speed
      const mp4Results = await Promise.allSettled(
        sorted.map(async ([quality, info]) => {
          if (!info?.kwik) return null;
          // Try our scraper's /kwik resolver (only works when scraper has cf_clearance)
          const kwikRes = await scraperFetch(`/kwik?url=${encodeURIComponent(info.kwik)}`, 4000);
          if (!kwikRes?.mp4) return null;
          return { quality, kwik: info.kwik, mp4: kwikRes.mp4 };
        })
      );

      for (const r of mp4Results) {
        if (r.status !== "fulfilled" || !r.value) continue;
        const { quality, kwik, mp4 } = r.value;
        results.push({
          provider: "animepahe",
          type,
          quality,
          streamUrl: wrapStreamUrl(mp4),  // wrap mp4 through proxy for CORS
          isMP4: true,
          isM3U8: false,
          kwikUrl: kwik,
        });
      }
    }

    // If we have NO playable streams at all (no m3u8 + no MP4), return empty.
    // DO NOT fall back to the raw kwik.cx embed URL — it shows the animepahe
    // watermark (kwik.si player overlay) which the user doesn't want.
    // Better to show no animepahe server than a watermarked one.

    console.log(`[AnimePahe] ${anilistId} ep${episodeNum}: ${results.length} playable streams (m3u8=${!!play.m3u8}, mp4_resolved=${results.length - (play.m3u8 ? 1 : 0)})`);
    return results;
  } catch (e: any) {
    console.error(`[AnimePahe] fetchAllSources failed for ${anilistId} ep${episodeNum}:`, e?.message || e);
    return [];
  }
}

// Always enabled — scraper URL is hardcoded with env var override
export const ANIMEPAHE_ENABLED = true;
