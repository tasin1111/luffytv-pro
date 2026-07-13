/**
 * AniKoto Direct — scraper for anikototv.to via anikotoapi.site API
 *
 * Pipeline:
 *   1. Search anikotoapi.site/recent-anime?q={title} → find anime by AniList ID
 *   2. Get series data: anikotoapi.site/series/{anikoto_id} → episodes with embed URLs
 *   3. Return embed URLs (megaplay.buzz/stream/s-2/{embed_id}/{sub|dub})
 *
 * The embed URLs are iframe-able — the MegaCloud/MegaPlay player loads inside an iframe.
 * The player uses heavily obfuscated JS to generate the m3u8 client-side, so we can't
 * extract the m3u8 server-side. But the iframe embed works perfectly.
 */

const ANIKOTO_API = "https://anikotoapi.site";

// Rate limiter (anikotoapi.site: 60 requests per 120 seconds)
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 2100;

async function rateLimitedFetch(url: string): Promise<Response> {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < MIN_REQUEST_INTERVAL) {
    await new Promise(r => setTimeout(r, MIN_REQUEST_INTERVAL - elapsed));
  }
  lastRequestTime = Date.now();
  return fetch(url, { headers: { "User-Agent": "Mozilla/5.0", "Accept": "application/json" } });
}

// ── Cache ──
const anilistToAnikotoCache = new Map<number, number | null>();
const CACHE_TTL = 60 * 60 * 1000;
const cacheTimestamps = new Map<string, number>();

function isCacheFresh(key: string): boolean {
  const ts = cacheTimestamps.get(key);
  if (!ts) return false;
  return Date.now() - ts < CACHE_TTL;
}

// ── Types ──
export interface AniKotoServer {
  name: string;
  embedUrl: string;
  type: "sub" | "dub";
  quality: string;
}

export interface AniKotoResult {
  servers: AniKotoServer[];
  intro: { start: number; end: number } | null;
  outro: { start: number; end: number } | null;
}

// ── Step 1: Search for anime by title → get AniKoto internal ID ──
async function resolveAniKotoId(
  anilistId: number,
  title: string,
): Promise<number | null> {
  const cacheKey = `anikoto:${anilistId}`;
  if (anilistToAnikotoCache.has(anilistId) && isCacheFresh(cacheKey)) {
    return anilistToAnikotoCache.get(anilistId)!;
  }

  try {
    const res = await rateLimitedFetch(
      `${ANIKOTO_API}/recent-anime?q=${encodeURIComponent(title)}`,
    );
    if (!res.ok) return null;
    const data = await res.json();
    const list: any[] = data?.data || [];

    // Find by AniList ID (ani_id field)
    let match = list.find((a: any) => String(a.ani_id) === String(anilistId));
    // Fallback: match by title
    if (!match) {
      const titleLower = title.toLowerCase();
      match = list.find((a: any) =>
        (a.title || "").toLowerCase() === titleLower ||
        (a.alternative || "").toLowerCase() === titleLower
      ) || list[0];
    }

    const id = match?.id || null;
    anilistToAnikotoCache.set(anilistId, id);
    cacheTimestamps.set(cacheKey, Date.now());

    if (id) {
      console.log(`[anikoto-direct] AniList ${anilistId} → AniKoto ${id} ("${match.title}")`);
    }

    return id;
  } catch (err) {
    console.error(`[anikoto-direct] resolveAniKotoId error:`, err);
    return null;
  }
}

// ── Step 2: Get series data → episodes with embed URLs ──
async function getSeriesData(anikotoId: number): Promise<any | null> {
  try {
    const res = await rateLimitedFetch(`${ANIKOTO_API}/series/${anikotoId}`);
    if (!res.ok) return null;
    const data = await res.json();
    if (!data?.ok) return null;
    return data;
  } catch {
    return null;
  }
}

// ── Main: resolve embed URLs for AniList ID + episode ──
export async function resolveAniKoto(
  anilistId: number,
  episodeNum: number,
  title: string,
): Promise<AniKotoResult | null> {
  try {
    // Step 1: Find AniKoto internal ID
    const anikotoId = await resolveAniKotoId(anilistId, title);
    if (!anikotoId) return null;

    // Step 2: Get series data with episodes
    const seriesData = await getSeriesData(anikotoId);
    if (!seriesData?.data?.episodes?.length) return null;

    // Step 3: Find the episode by number
    const episodes: any[] = seriesData.data.episodes;
    const ep = episodes.find((e: any) => Number(e.number) === episodeNum);
    if (!ep) {
      console.log(`[anikoto-direct] episode ${episodeNum} not found (have ${episodes.length} episodes)`);
      return null;
    }

    // Step 4: Build server list from embed URLs
    const servers: AniKotoServer[] = [];
    const embedUrls = ep.embed_url || {};

    if (embedUrls.sub) {
      servers.push({
        name: "AniKoto Sub",
        embedUrl: embedUrls.sub,
        type: "sub",
        quality: "1080p",
      });
    }
    if (embedUrls.dub) {
      servers.push({
        name: "AniKoto Dub",
        embedUrl: embedUrls.dub,
        type: "dub",
        quality: "1080p",
      });
    }

    if (servers.length === 0) return null;

    console.log(`[anikoto-direct] resolved ${servers.length} servers for AniList ${anilistId} ep${episodeNum}`);

    return {
      servers,
      intro: null,
      outro: null,
    };
  } catch (err) {
    console.error(`[anikoto-direct] resolveAniKoto error:`, err);
    return null;
  }
}
