/**
 * AniKage Fast — resolves sources + intro/outro from anikage.cc
 *
 * AniKage provides:
 *   - HLS sources (via prox.anikage.cc tokens)
 *   - Embed URLs (ninstream.com, etc.) — directly playable through our proxy
 *   - Intro/outro skip times — works for NEW and OLD anime!
 *
 * The sources API (anikage.cc/api/media/anime/{id}/episodes/{ep}/sources)
 * is NOT Cloudflare-protected — it returns JSON directly.
 *
 * The challenge is resolving AniList ID → AniKage ID. We do this by:
 *   1. Scraping the AniKage homepage through the Worker proxy
 *   2. Extracting anime IDs + titles
 *   3. Matching by title
 *
 * All ID mappings are cached for 1 hour.
 */

const ANIKAGE_BASE = "https://anikage.cc";
const WORKER_BASE =
  process.env.NEXT_PUBLIC_PROXY_BASE ||
  "https://luffytv-proxy.ggy892767.workers.dev";

const HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.5",
  Referer: "https://anikage.cc/",
};

// ── Caches ──
const anikageIdCache = new Map<number, string | null>(); // anilistId → anikageId
const homepageCache = new Map<string, { title: string; anilistId?: number }>(); // anikageId → metadata
const sourceCache = new Map<string, any>(); // "anikageId:ep:lang" → sources data
const CACHE_TTL = 60 * 60 * 1000; // 1 hour
const cacheTimestamps = new Map<string, number>();

function isCacheFresh(key: string): boolean {
  const ts = cacheTimestamps.get(key);
  if (!ts) return false;
  return Date.now() - ts < CACHE_TTL;
}

// ── Types ──
export interface AniKageResult {
  m3u8Url: string;
  anikageId: string;
  intro: { start: number; end: number } | null;
  outro: { start: number; end: number } | null;
  provider: string;
  type: "sub" | "dub";
}

// ── Step 1: Resolve AniList ID → AniKage ID ──
// Scrapes the AniKage homepage through the Worker proxy to build a cache
// of anime IDs + titles, then matches by title.
async function resolveAniKageId(
  anilistId: number,
  title: string,
): Promise<string | null> {
  const cacheKey = `anikage-id:${anilistId}`;
  if (anikageIdCache.has(anilistId) && isCacheFresh(cacheKey)) {
    return anikageIdCache.get(anilistId)!;
  }

  try {
    // Scrape the AniKage homepage through the Worker proxy
    const homeUrl = encodeURIComponent(`${ANIKAGE_BASE}/`);
    const ref = encodeURIComponent(`${ANIKAGE_BASE}/`);
    const proxyUrl = `${WORKER_BASE}/proxy?url=${homeUrl}&ref=${ref}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(proxyUrl, {
      headers: { "User-Agent": HEADERS["User-Agent"] },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      console.error(`[anikage-fast] homepage HTTP ${res.status}`);
      anikageIdCache.set(anilistId, null);
      cacheTimestamps.set(cacheKey, Date.now());
      return null;
    }

    const html = await res.text();

    // Extract anime IDs from links: /anime/info/{id} or /anime/watch/{id}
    const idPattern = /href="\/anime\/(?:info|watch)\/([^"]+)"/g;
    const matches = [...html.matchAll(idPattern)];
    const ids = [...new Set(matches.map((m) => m[1]))];

    if (ids.length === 0) {
      console.error(`[anikage-fast] no anime IDs found on homepage`);
      anikageIdCache.set(anilistId, null);
      cacheTimestamps.set(cacheKey, Date.now());
      return null;
    }

    // For each ID, check the info page for the AniList ID
    // (batch fetch in parallel, but limit to first 20 to avoid overload)
    const titleLower = title.toLowerCase();
    const titleSlug = titleLower.replace(/[^a-z0-9]+/g, "");

    // First, try to match by title from the page text
    // The homepage HTML might have titles near the anime links
    const pageText = html.toLowerCase();
    let bestId: string | null = null;

    // Check if the title appears near any anime ID
    for (const id of ids.slice(0, 20)) {
      // Fetch the info page for this ID to get the title + AniList ID
      try {
        const infoUrl = encodeURIComponent(`${ANIKAGE_BASE}/anime/info/${id}`);
        const infoProxy = `${WORKER_BASE}/proxy?url=${infoUrl}&ref=${ref}`;
        const infoRes = await fetch(infoProxy, {
          headers: { "User-Agent": HEADERS["User-Agent"] },
          signal: AbortSignal.timeout(5000),
        });
        if (!infoRes.ok) continue;
        const infoHtml = await infoRes.text();

        // Extract AniList ID from the info page
        const anilistMatch = infoHtml.match(/anilist\.co\/anime\/(\d+)/);
        const pageTitleMatch = infoHtml.match(/<title>([^<]+)<\/title>/);

        if (anilistMatch) {
          const pageAnilistId = parseInt(anilistMatch[1], 10);
          if (pageAnilistId === anilistId) {
            bestId = id;
            console.log(`[anikage-fast] matched by AniList ID: ${id} → AniList ${anilistId}`);
            break;
          }
        }

        // Also match by title
        if (pageTitleMatch) {
          const pageTitle = pageTitleMatch[1].toLowerCase().replace(/[^a-z0-9]+/g, "");
          if (pageTitle.includes(titleSlug.slice(0, 15))) {
            bestId = id;
            console.log(`[anikage-fast] matched by title: ${id} → "${title}"`);
            break;
          }
        }
      } catch { /* skip this ID */ }
    }

    anikageIdCache.set(anilistId, bestId);
    cacheTimestamps.set(cacheKey, Date.now());
    return bestId;
  } catch (err) {
    console.error(`[anikage-fast] resolveAniKageId error:`, err);
    anikageIdCache.set(anilistId, null);
    cacheTimestamps.set(cacheKey, Date.now());
    return null;
  }
}

// ── Step 2: Fetch sources + intro/outro from AniKage API ──
async function getSources(
  anikageId: string,
  epNum: number,
  type: "sub" | "dub",
  provider: string = "miko",
): Promise<any | null> {
  const cacheKey = `anikage-src:${anikageId}:${epNum}:${type}:${provider}`;
  if (sourceCache.has(cacheKey) && isCacheFresh(cacheKey)) {
    return sourceCache.get(cacheKey)!;
  }

  try {
    // This endpoint is NOT Cloudflare-protected — fetch directly
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(
      `${ANIKAGE_BASE}/api/media/anime/${anikageId}/episodes/${epNum}/sources?provider=${provider}&lang=${type}`,
      { headers: HEADERS, signal: controller.signal },
    );
    clearTimeout(timeout);

    if (!res.ok) {
      console.error(`[anikage-fast] sources HTTP ${res.status} for ${anikageId} ep${epNum}`);
      return null;
    }

    const data = await res.json();
    sourceCache.set(cacheKey, data);
    cacheTimestamps.set(cacheKey, Date.now());
    return data;
  } catch (err) {
    console.error(`[anikage-fast] getSources error:`, err);
    return null;
  }
}

// ── Main: resolve m3u8 + intro/outro for AniList ID + episode ──
export async function resolveAniKage(
  anilistId: number,
  epNum: number,
  type: "sub" | "dub",
  title: string,
): Promise<AniKageResult | null> {
  try {
    const anikageId = await resolveAniKageId(anilistId, title);
    if (!anikageId) return null;

    // Try miko provider first (most reliable), then others
    const providers = ["miko", "kiwi", "senshi"];
    for (const provider of providers) {
      const sourceData = await getSources(anikageId, epNum, type, provider);
      if (!sourceData) continue;

      // Get the embed URL (directly playable m3u8)
      const embeds = sourceData.embeds || [];
      const workingEmbed = embeds.find((e: any) => e.status === "ok" && e.url);
      if (workingEmbed?.url) {
        return {
          m3u8Url: workingEmbed.url,
          anikageId,
          intro: sourceData.intro || null,
          outro: sourceData.outro || null,
          provider,
          type,
        };
      }

      // If no embed, try the source URL (needs prox.anikage.cc)
      // The source URL is a token — proxy through prox.anikage.cc/m3u8/{token}
      const sources = sourceData.sources || [];
      const m3u8Source = sources.find((s: any) => s.isM3U8);
      if (m3u8Source?.url) {
        // The URL is a token for prox.anikage.cc
        const streamUrl = `https://prox.anikage.cc/m3u8/${m3u8Source.url}`;
        return {
          m3u8Url: streamUrl,
          anikageId,
          intro: sourceData.intro || null,
          outro: sourceData.outro || null,
          provider,
          type,
        };
      }
    }

    return null;
  } catch (err) {
    console.error(`[anikage-fast] resolveAniKage error:`, err);
    return null;
  }
}

// ── Batch: resolve sub + dub in parallel ──
export async function resolveAniKageBoth(
  anilistId: number,
  epNum: number,
  title: string,
): Promise<{ sub: AniKageResult | null; dub: AniKageResult | null; intro: any; outro: any }> {
  const [sub, dub] = await Promise.all([
    resolveAniKage(anilistId, epNum, "sub", title),
    resolveAniKage(anilistId, epNum, "dub", title),
  ]);

  // AniKage provides intro/outro for BOTH sub and dub — use whichever is available
  const intro = sub?.intro || dub?.intro || null;
  const outro = sub?.outro || dub?.outro || null;

  return { sub, dub, intro, outro };
}
