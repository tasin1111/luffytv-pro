/**
 * AniKoto Direct — fast server-side resolver for anikototv.to embed URLs.
 *
 * AniKoto uses an API at anikotoapi.site that returns episode data with
 * embed URLs for sub and dub. The embed URLs are megaplay.buzz iframe
 * embeds that are directly playable.
 *
 * Pipeline:
 *   1. Resolve AniList ID → AniKoto anime ID (via AniList title → search)
 *   2. Fetch series: GET /series/{anikotoId}
 *   3. Find episode by number → extract embed_url.sub or embed_url.dub
 *
 * The embed URLs are directly iframeable.
 *
 * ID mappings are cached in-memory for 1 hour.
 */

const ANIKOTO_API = "https://anikotoapi.site";
const WORKER_BASE =
  process.env.NEXT_PUBLIC_PROXY_BASE ||
  "https://luffytv-proxy.ggy892767.workers.dev";

const HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0",
  Accept: "application/json",
  "Accept-Language": "en-US,en;q=0.5",
};

// ── Caches ──
const anikotoIdCache = new Map<number, number | null>(); // anilistId → anikotoId
const seriesCache = new Map<number, any>(); // anikotoId → series data
const CACHE_TTL = 60 * 60 * 1000; // 1 hour
const cacheTimestamps = new Map<string, number>();

function isCacheFresh(key: string): boolean {
  const ts = cacheTimestamps.get(key);
  if (!ts) return false;
  return Date.now() - ts < CACHE_TTL;
}

// ── Types ──
export interface AniKotoEmbedResult {
  embedUrl: string;
  anikotoId: number;
  episodeId: number;
  type: "sub" | "dub";
}

// ── Step 1: Resolve AniList ID → AniKoto ID ──
// The AniKoto API doesn't have a search endpoint, so we search the
// anikototv.to website via the Worker proxy.
async function resolveAniKotoId(
  anilistId: number,
  title: string,
): Promise<number | null> {
  const cacheKey = `anikoto:${anilistId}`;
  if (anikotoIdCache.has(anilistId) && isCacheFresh(cacheKey)) {
    return anikotoIdCache.get(anilistId)!;
  }

  try {
    // Search anikototv.to via Worker proxy
    const searchUrl = encodeURIComponent(
      `https://anikototv.to/search?q=${encodeURIComponent(title)}`,
    );
    const ref = encodeURIComponent(`https://anikototv.to/`);
    const proxyUrl = `${WORKER_BASE}/proxy?url=${searchUrl}&ref=${ref}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(proxyUrl, {
      headers: { "User-Agent": HEADERS["User-Agent"] },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    let anikotoId: number | null = null;

    if (res.ok) {
      const html = await res.text();

      // Extract anime links with IDs: /anime/{slug}-{id} or data-id="{id}"
      const linkPattern = /href="\/anime\/[^"]*?-(\d+)"/g;
      const matches = [...html.matchAll(linkPattern)];

      if (matches.length > 0) {
        // Try to find the best match by title
        const titleLower = title.toLowerCase();
        const items = html.split(/<a[^>]*href="\/anime\//);

        for (let i = 1; i < items.length; i++) {
          const item = items[i];
          const idMatch = item.match(/^.*?-(\d+)"/);
          if (!idMatch) continue;
          const id = parseInt(idMatch[1], 10);

          // Check if title appears in this item
          if (
            item.toLowerCase().includes(titleLower) ||
            titleLower.includes(
              item
                .replace(/<[^>]*>/g, " ")
                .trim()
                .toLowerCase()
                .slice(0, 20),
            )
          ) {
            anikotoId = id;
            break;
          }
        }

        // Fallback: take first result
        if (!anikotoId) {
          anikotoId = parseInt(matches[0][1], 10);
        }
      }
    }

    // Fallback: try the anikotoapi.site recent-anime endpoint and search by title
    if (!anikotoId) {
      try {
        const recentRes = await fetch(
          `${ANIKOTO_API}/recent-anime?page=1&per_page=50`,
          { headers: HEADERS },
        );
        if (recentRes.ok) {
          const recentData = await recentRes.json();
          const animes: any[] = recentData.data || [];
          const titleLower = title.toLowerCase();
          const match = animes.find(
            (a) =>
              (a.title || "").toLowerCase().includes(titleLower) ||
              titleLower.includes((a.title || "").toLowerCase().slice(0, 15)),
          );
          if (match) {
            anikotoId = match.id;
          }
        }
      } catch {
        /* ignore fallback error */
      }
    }

    if (anikotoId) {
      console.log(
        `[anikoto-direct] resolved AniList ${anilistId} → AniKoto ${anikotoId} ("${title}")`,
      );
    }

    anikotoIdCache.set(anilistId, anikotoId);
    cacheTimestamps.set(cacheKey, Date.now());
    return anikotoId;
  } catch (err) {
    console.error(`[anikoto-direct] resolveAniKotoId error:`, err);
    anikotoIdCache.set(anilistId, null);
    cacheTimestamps.set(cacheKey, Date.now());
    return null;
  }
}

// ── Step 2: Fetch series data (episodes with embed URLs) ──
async function getSeries(anikotoId: number): Promise<any | null> {
  const cacheKey = `anikoto-series:${anikotoId}`;
  if (seriesCache.has(anikotoId) && isCacheFresh(cacheKey)) {
    return seriesCache.get(anikotoId)!;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(`${ANIKOTO_API}/series/${anikotoId}`, {
      headers: HEADERS,
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      console.error(
        `[anikoto-direct] series HTTP ${res.status} for AniKoto ${anikotoId}`,
      );
      return null;
    }

    const data = await res.json();
    if (!data?.ok) return null;

    seriesCache.set(anikotoId, data);
    cacheTimestamps.set(cacheKey, Date.now());
    return data;
  } catch (err) {
    console.error(`[anikoto-direct] getSeries error:`, err);
    return null;
  }
}

// ── Main: resolve embed URL for AniList ID + episode ──
export async function resolveAniKotoEmbed(
  anilistId: number,
  episodeNum: number,
  type: "sub" | "dub",
  title: string,
): Promise<AniKotoEmbedResult | null> {
  try {
    const anikotoId = await resolveAniKotoId(anilistId, title);
    if (!anikotoId) return null;

    const series = await getSeries(anikotoId);
    if (!series?.data?.episodes) return null;

    // Find the episode by number
    const episodes: any[] = series.data.episodes;
    const ep = episodes.find((e) => e.number === episodeNum);
    if (!ep) return null;

    // Get embed URL for sub or dub
    const embedUrl = type === "dub" ? ep.embed_url?.dub : ep.embed_url?.sub;
    if (!embedUrl) return null;

    return {
      embedUrl,
      anikotoId,
      episodeId: ep.id,
      type,
    };
  } catch (err) {
    console.error(`[anikoto-direct] resolveAniKotoEmbed error:`, err);
    return null;
  }
}

// ── Batch: resolve both sub and dub in parallel ──
export async function resolveAniKotoEmbeds(
  anilistId: number,
  episodeNum: number,
  title: string,
): Promise<{ sub: AniKotoEmbedResult | null; dub: AniKotoEmbedResult | null }> {
  const [sub, dub] = await Promise.all([
    resolveAniKotoEmbed(anilistId, episodeNum, "sub", title),
    resolveAniKotoEmbed(anilistId, episodeNum, "dub", title),
  ]);
  return { sub, dub };
}
