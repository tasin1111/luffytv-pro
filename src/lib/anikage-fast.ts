/**
 * AniKage Fast — resolves ALL sources + intro/outro from anikage.cc
 *
 * AniKage provides skip times for BOTH new AND old anime — this is the
 * PRIMARY source for intro/outro skip times. AniSkip is only a backup.
 *
 * Working providers (tested):
 *   - miko    (1 source, 1 embed, intro/outro)
 *   - senshi  (1 source, 1 embed, intro/outro)
 *   - koto    (2 sources, 2 embeds, intro/outro)
 *
 * The intro/outro comes from AniKage's database (same across all providers)
 * — so we only need to fetch ONE provider to get skip times.
 *
 * The sources API is NOT Cloudflare-protected — returns JSON directly.
 * The homepage IS CF-protected — scraped through Worker proxy for ID resolution.
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
  Origin: "https://anikage.cc",
  "Sec-Fetch-Dest": "empty",
  "Sec-Fetch-Mode": "cors",
  "Sec-Fetch-Site": "same-origin",
};

// All working AniKage providers (tested live)
// miko:   1 source, 1 embed
// senshi: 1 source, 1 embed
// koto:   2 sources, 2 embeds
// neko:   4 sources (hardsub+softsub), 9 embeds
// dib:    1 source, 2 embeds (1 ok, 1 blocked)
const ANIKAGE_PROVIDERS = ["miko", "senshi", "koto", "neko", "dib"];

// ── Caches ──
const anikageIdCache = new Map<number, string | null>();
const sourceCache = new Map<string, any>();
const CACHE_TTL = 60 * 60 * 1000;
const cacheTimestamps = new Map<string, number>();

function isCacheFresh(key: string): boolean {
  const ts = cacheTimestamps.get(key);
  if (!ts) return false;
  return Date.now() - ts < CACHE_TTL;
}

// ── Types ──
export interface AniKageServer {
  name: string;
  provider: string;
  m3u8Url: string;
  type: "sub" | "dub";
  quality: string;
}

export interface AniKageResult {
  servers: AniKageServer[];
  anikageId: string;
  intro: { start: number; end: number } | null;
  outro: { start: number; end: number } | null;
}

// ── Step 1: Resolve AniList ID → AniKage ID ──
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
      anikageIdCache.set(anilistId, null);
      cacheTimestamps.set(cacheKey, Date.now());
      return null;
    }

    // Check each ID's info page for the matching AniList ID
    // Batch fetch in parallel (limit to first 20)
    let bestId: string | null = null;
    const titleSlug = title.toLowerCase().replace(/[^a-z0-9]+/g, "");

    const checkPromises = ids.slice(0, 20).map(async (id) => {
      try {
        const infoUrl = encodeURIComponent(`${ANIKAGE_BASE}/anime/info/${id}`);
        const infoProxy = `${WORKER_BASE}/proxy?url=${infoUrl}&ref=${ref}`;
        const infoRes = await fetch(infoProxy, {
          headers: { "User-Agent": HEADERS["User-Agent"] },
          signal: AbortSignal.timeout(5000),
        });
        if (!infoRes.ok) return null;
        const infoHtml = await infoRes.text();

        // Extract AniList ID from the info page
        const anilistMatch = infoHtml.match(/anilist\.co\/anime\/(\d+)/);
        if (anilistMatch) {
          const pageAnilistId = parseInt(anilistMatch[1], 10);
          if (pageAnilistId === anilistId) return { id, match: "anilist" };
        }

        // Also match by title
        const pageTitleMatch = infoHtml.match(/<title>([^<]+)<\/title>/);
        if (pageTitleMatch) {
          const pageTitle = pageTitleMatch[1].toLowerCase().replace(/[^a-z0-9]+/g, "");
          if (pageTitle.includes(titleSlug.slice(0, 15))) return { id, match: "title" };
        }
        return null;
      } catch { return null; }
    });

    const results = await Promise.all(checkPromises);
    // Prefer AniList ID match, then title match
    const anilistMatch = results.find((r) => r?.match === "anilist");
    const titleMatch = results.find((r) => r?.match === "title");
    bestId = anilistMatch?.id || titleMatch?.id || null;

    if (bestId) {
      console.log(`[anikage-fast] AniList ${anilistId} → AniKage ${bestId}`);
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

// ── Step 2: Fetch sources from ALL providers in parallel ──
// Uses the Worker proxy because anikage.cc is Cloudflare-protected for
// server-side fetch (returns CF challenge page from Vercel IPs).
async function getSourcesFromAllProviders(
  anikageId: string,
  epNum: number,
  type: "sub" | "dub",
): Promise<AniKageResult | null> {
  try {
    // Fetch ALL providers in parallel via Worker proxy
    const providerResults = await Promise.all(
      ANIKAGE_PROVIDERS.map(async (provider) => {
        const cacheKey = `anikage-src:${anikageId}:${epNum}:${type}:${provider}`;
        if (sourceCache.has(cacheKey) && isCacheFresh(cacheKey)) {
          return { provider, data: sourceCache.get(cacheKey)! };
        }

        try {
          const apiUrl = encodeURIComponent(
            `${ANIKAGE_BASE}/api/media/anime/${anikageId}/episodes/${epNum}/sources?provider=${provider}&lang=${type}`,
          );
          const ref = encodeURIComponent(`${ANIKAGE_BASE}/`);
          const proxyUrl = `${WORKER_BASE}/proxy?url=${apiUrl}&ref=${ref}`;

          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 8000);
          const res = await fetch(proxyUrl, {
            headers: { "User-Agent": HEADERS["User-Agent"] },
            signal: controller.signal,
          });
          clearTimeout(timeout);

          if (!res.ok) return { provider, data: null };

          const data = await res.json();
          sourceCache.set(cacheKey, data);
          cacheTimestamps.set(cacheKey, Date.now());
          return { provider, data };
        } catch {
          return { provider, data: null };
        }
      }),
    );

    const servers: AniKageServer[] = [];
    let intro: { start: number; end: number } | null = null;
    let outro: { start: number; end: number } | null = null;

    for (const { provider, data } of providerResults) {
      if (!data) continue;

      // Extract intro/outro (same across all providers — from AniKage's DB)
      if (!intro && data.intro && data.intro.start > 0) {
        intro = { start: data.intro.start, end: data.intro.end };
      }
      if (!outro && data.outro && data.outro.start > 0) {
        outro = { start: data.outro.start, end: data.outro.end };
      }

      // Extract ONLY sources (prox.anikage.cc tokens — the REAL m3u8 streams)
      // NO embeds — user only wants m3u8 sources, wrapped through our proxy.
      // Each source is a different quality/variant (hardsub, softsub, etc.)
      const sources = (data.sources || []).filter((s: any) => s.url && s.isM3U8);
      for (const src of sources) {
        // The source URL is a token for prox.anikage.cc/m3u8/{token}
        const streamUrl = `https://prox.anikage.cc/m3u8/${src.url}`;
        // Dedupe by URL
        if (servers.some((s) => s.m3u8Url === streamUrl)) continue;
        const qualityLabel = src.quality || "auto";
        const providerName = provider.charAt(0).toUpperCase() + provider.slice(1);
        servers.push({
          name: `AniKage ${providerName} (${qualityLabel})`,
          provider,
          m3u8Url: streamUrl,
          type,
          quality: qualityLabel,
        });
      }
    }

    if (servers.length === 0 && !intro && !outro) return null;

    return { servers, anikageId, intro, outro };
  } catch (err) {
    console.error(`[anikage-fast] getSourcesFromAllProviders error:`, err);
    return null;
  }
}

// ── Main: resolve ALL servers + intro/outro ──
export async function resolveAniKage(
  anilistId: number,
  epNum: number,
  type: "sub" | "dub",
  title: string,
): Promise<AniKageResult | null> {
  try {
    const anikageId = await resolveAniKageId(anilistId, title);
    if (!anikageId) return null;

    return await getSourcesFromAllProviders(anikageId, epNum, type);
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
): Promise<{
  sub: AniKageResult | null;
  dub: AniKageResult | null;
  intro: { start: number; end: number } | null;
  outro: { start: number; end: number } | null;
}> {
  const [sub, dub] = await Promise.all([
    resolveAniKage(anilistId, epNum, "sub", title),
    resolveAniKage(anilistId, epNum, "dub", title),
  ]);

  // Intro/outro is the same for sub and dub — use whichever is available
  const intro = sub?.intro || dub?.intro || null;
  const outro = sub?.outro || dub?.outro || null;

  return { sub, dub, intro, outro };
}
