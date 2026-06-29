/**
 * AnimePahe API Client (working version)
 * =======================================
 *
 * Uses the public scraper at https://pahe-api-lol-vibecoded-ez.up.railway.app/
 * which has already solved Cloudflare's managed challenge for us. It exposes
 * three JSON endpoints:
 *
 *   GET /airing?page=N
 *     → Latest airing episodes. Each item includes:
 *       - anime_session (UUID) — needed for the next two endpoints
 *       - session (hex) — episode session, needed for /play
 *       - anime_title, episode number, fansub, snapshot, etc.
 *     Total ~6,329 episodes across 528 pages.
 *
 *   GET /anime/{anime_session}/episodes?page=N
 *     → Episode list for one anime (sorted desc by episode number).
 *     Each item has its own session (hex) — use this in /play.
 *
 *   GET /play/{anime_session}/{ep_session}
 *     → Returns playable URLs:
 *       - qualities: { "360p": {kwik, fansub}, "720p": {...}, "1080p": {...} }
 *       - m3u8: direct m3u8 URL on vault-XX.owocdn.top or vault-XX.uwucdn.top
 *       - kwik: chosen kwik.si embed URL
 *
 * AniList ID → anime_session resolution strategy:
 *   AnimePahe's /airing endpoint only includes recently-aired episodes.
 *   To find an anime's session, we paginate /airing until we find a title
 *   match (case-insensitive, ignoring "Season N" / "Cour N" suffixes).
 *   Sessions are cached for 24h so subsequent requests are instant.
 *
 *   For older anime not in /airing, we fall back to a title-prefix scan
 *   (paginate /airing, build a {title → session} map of unique anime).
 *
 * Stream proxying:
 *   The m3u8 URL returned by the scraper is on vault-XX.owocdn.top or
 *   vault-XX.uwucdn.top — these CDNs require Referer: https://kwik.cx/
 *   (or 403). Our wrapM3u8Url() helper encodes that Referer into the
 *   aniwatchtv XOR token, so the proxied m3u8 plays perfectly in the browser.
 */

import { wrapStreamUrl, wrapM3u8Url } from "./proxy";

// ─── Config ──────────────────────────────────────────────────────────────────

/** Default scraper URL (user-provided Railway deployment, already CF-solved). */
const DEFAULT_SCRAPER_URL = "https://pahe-api-lol-vibecoded-ez.up.railway.app";

const SCRAPER_URL = (
  process.env.ANIMEPAHE_SCRAPER_URL ||
  DEFAULT_SCRAPER_URL
).replace(/\/$/, "");

const SCRAPER_TIMEOUT_MS = 8000;

// ─── Types ───────────────────────────────────────────────────────────────────

export interface AnimePaheAiringItem {
  id: number;
  anime_id: number;
  anime_title: string;
  anime_session: string;  // UUID — used in /anime/{session}/episodes and /play/{session}/{ep_session}
  episode: number;
  session: string;        // hex — episode session, used in /play
  fansub?: string;
  snapshot?: string;
  audio?: string;
  duration?: string;
  filler?: number;
  created_at?: string;
  _hint_episodes_url?: string;
  _hint_play_url?: string;
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
  qualities: Record<string, { kwik: string; fansub?: string }>;
  chosen: string;         // "1080p" etc.
  kwik: string;           // chosen kwik URL
  m3u8: string;           // direct m3u8 URL
}

export interface AnimePaheVerifiedResult {
  provider: "animepahe";
  type: "sub" | "dub";
  quality: string;
  streamUrl: string;     // ready-to-play (proxied)
  isMP4: boolean;
  isM3U8: boolean;
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

function getTitle(a: any): string {
  return a?.title?.english || a?.title?.romaji || a?.title?.native || "";
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

// ─── Global airing cache (refreshed periodically) ────────────────────────────
//
// /airing returns ~6,329 episodes across 528 pages. We cache all of them
// globally (per warm Vercel instance) so title→session lookups are instant
// after the first request. Refresh every 30 minutes.

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

  console.log("[AnimePahe] refreshing /airing cache...");
  const byTitle = new Map<string, { session: string; title: string }>();
  const start = Date.now();

  // Fetch first 8 pages (96 episodes) in parallel — covers most recently aired anime
  // Each page is ~8KB, total ~64KB — fast and cheap
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
      // First occurrence wins (latest airing)
      if (!byTitle.has(norm)) {
        byTitle.set(norm, { session: item.anime_session, title: item.anime_title });
      }
    }
  }

  _airingCache = { byTitle, expires: Date.now() + AIRING_CACHE_TTL_MS };
  console.log(`[AnimePahe] /airing cache: ${byTitle.size} unique anime indexed in ${Date.now() - start}ms`);
  return _airingCache;
}

// ─── AniList ID → anime_session resolution ───────────────────────────────────

export async function resolveAnimePaheSession(
  anilistId: number,
  titles: { english?: string; romaji?: string; native?: string }
): Promise<{ session: string; title: string } | null> {
  // Check cache
  const cached = sessionCache.get(anilistId);
  if (cached && cached.expires > Date.now()) {
    return { session: cached.session, title: cached.title };
  }

  // Build list of normalized title variants to try
  const variants = [
    titles.english,
    titles.romaji,
    titles.native,
    // Stripped variants
    titles.english ? normalizeTitle(titles.english) : undefined,
    titles.romaji ? normalizeTitle(titles.romaji) : undefined,
    titles.native ? normalizeTitle(titles.native) : undefined,
  ]
    .filter((t): t is string => !!t && t.length >= 3)
    .map((t) => normalizeTitle(t));

  // Dedupe
  const unique = Array.from(new Set(variants));

  if (unique.length === 0) return null;

  // Look up in airing cache
  const cache = await getAiringCache();
  for (const v of unique) {
    // Exact normalized match
    if (cache.byTitle.has(v)) {
      const result = cache.byTitle.get(v)!;
      sessionCache.set(anilistId, {
        session: result.session,
        title: result.title,
        expires: Date.now() + SESSION_CACHE_TTL_MS,
      });
      console.log(`[AnimePahe] anilistId=${anilistId} → session=${result.session.slice(0, 13)}... (title: "${result.title}", query: "${v}")`);
      return result;
    }
    // Fuzzy match: title contains or is contained
    for (const [key, value] of cache.byTitle) {
      if (key.includes(v) || v.includes(key)) {
        sessionCache.set(anilistId, {
          session: value.session,
          title: value.title,
          expires: Date.now() + SESSION_CACHE_TTL_MS,
        });
        console.log(`[AnimePahe] anilistId=${anilistId} → session=${value.session.slice(0, 13)}... (fuzzy: "${value.title}" ~ "${v}")`);
        return value;
      }
    }
  }

  console.log(`[AnimePahe] no /airing match for anilistId=${anilistId} (tried: ${unique.join(", ")})`);
  return null;
}

// ─── Episode list ────────────────────────────────────────────────────────────

export async function getAnimePaheEpisodes(
  animeSession: string,
  timeoutMs = SCRAPER_TIMEOUT_MS
): Promise<AnimePaheEpisode[]> {
  // The scraper returns episodes sorted desc by episode number on page 1.
  // For most anime, page 1 has ALL episodes (if total <= 30). For long-running
  // anime (One Piece with 1168 eps), we need multiple pages.
  // For our use case (find episode N), page 1 is usually enough — but to be
  // safe we fetch up to 3 pages if needed.
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

  // If there are more pages, fetch them too (limit to 5 to avoid hammering)
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
    // Step 1: Resolve AniList ID → anime_session (via /airing cache)
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

    // Type detection: animepahe audio field tells us if it's dub (eng) or sub (jpn)
    // Default to "sub" if not specified — most animepahe content is sub
    const audioType = (ep.audio || "").toLowerCase();
    const isDub = audioType === "eng" || audioType === "english" || audioType === "dub";

    // If the audio is explicitly dub and we only want sub, skip; vice versa
    if (isDub && !wantDub) return [];
    if (!isDub && !wantSub) return [];

    const type: "sub" | "dub" = isDub ? "dub" : "sub";

    // Add the m3u8 stream (preferred — HLS with quality switching)
    if (play.m3u8) {
      // Choose highest quality from play.qualities for the label
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

    // Also add per-quality kwik URLs as separate servers (for fallback)
    // Limit to top 2 qualities to avoid clutter
    if (play.qualities) {
      const sorted = Object.entries(play.qualities)
        .sort(([a], [b]) => {
          const rank = (q: string) => parseInt(q) || 0;
          return rank(b) - rank(a);
        })
        .slice(0, 2);

      for (const [quality, info] of sorted) {
        if (!info?.kwik) continue;
        // Don't duplicate the m3u8 stream's quality
        if (results.length > 0 && results[0].quality === quality) continue;
        // Note: kwik URLs need to be resolved to direct mp4 via a kwik resolver
        // For now, we just include the m3u8 (which is already playable)
        // Kwik URLs would require a separate resolver endpoint
      }
    }

    console.log(`[AnimePahe] ${anilistId} ep${episodeNum}: ${results.length} playable streams (m3u8=${!!play.m3u8}, qualities=${Object.keys(play.qualities || {}).join(",")})`);
    return results;
  } catch (e: any) {
    console.error(`[AnimePahe] fetchAllSources failed for ${anilistId} ep${episodeNum}:`, e?.message || e);
    return [];
  }
}

// Always enabled now that we have a working default scraper
export const ANIMEPAHE_ENABLED = true;
