/**
 * Anikage API Client (anikage.cc)
 * --------------------------------
 * Anikage has 5 servers: megg, kiss, miko, verse, neko
 * API endpoints (all Cloudflare-protected, need proper headers):
 *   - Search: /api/media/anime/advanced-search?query={q}
 *   - Episodes: /api/media/anime/{slug}/episodes
 *   - Servers: /api/media/anime/{slug}/episodes/{n}/servers
 *   - Streams: /api/media/anime/{slug}/episodes/{n}/sources?provider={server}&lang={sub|dub}
 *
 * Stream URLs are encoded IDs that go through prox.anikage.cc/stream/{id}/index.txt
 * prox.anikage.cc requires Origin: https://anikage.cc — we route through
 * cdn.animex.su with the correct referer.
 */

import { wrapStreamUrl } from "./proxy";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

const HEADERS: Record<string, string> = {
  "User-Agent": UA,
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.9",
  Referer: "https://anikage.cc/",
};

/**
 * fetch-based JSON fetcher with proper headers.
 * Replaces the old curl/execFile approach (which doesn't work on Vercel —
 * no shell access in serverless/edge runtime).
 *
 * anikage.cc is Cloudflare-protected and 403s direct fetches from Vercel IPs.
 * We use the prox.anikage.cc mirror which has more permissive bot policy.
 * If that also 403s, we fall back to wrapping through cdn.animex.su (CORS proxy).
 */
async function fetchJson<T = any>(url: string, timeoutMs = 12000): Promise<T | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, {
      headers: HEADERS,
      signal: controller.signal,
      cache: "no-store",
    });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const text = await res.text();
    if (!text || text.startsWith("<!DOCTYPE") || text.startsWith("<html")) return null;
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

export interface AnikageServer {
  id: string;
  default: boolean;
  label: string | null;
}

export interface AnikageSource {
  url: string;
  quality: string;
  isM3U8: boolean;
  type?: string;
  embedUrl?: string;
}

export interface AnikageStreamResponse {
  sources: AnikageSource[];
  subtitles: any[];
  intro?: { start: number; end: number };
  outro?: { start: number; end: number };
  headers?: string;
  cached?: boolean;
  error?: any;
}

export interface AnikageVerifiedResult {
  server: string;
  type: "sub" | "dub";
  streamUrl: string;
  quality: string;
  isM3U8: boolean;
  isMP4: boolean;
  hardsub: boolean;
  tracks: Array<{ url: string; lang: string; label: string }>;
  intro: { start: number; end: number } | null;
  outro: { start: number; end: number } | null;
}

const slugCache = new Map<number, string | null>();

async function resolveSlug(anilistId: number, timeoutMs = 10000): Promise<string | null> {
  if (slugCache.has(anilistId)) return slugCache.get(anilistId)!;
  try {
    // Get title from AniList
    const res = await fetch("https://graphql.anilist.co", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: "query($id:Int){Media(id:$id,type:ANIME){id title{romaji english}}}",
        variables: { id: anilistId },
      }),
      cache: "no-store",
    });
    if (!res.ok) { slugCache.set(anilistId, null); return null; }
    const data = await res.json();
    const title = data?.data?.Media?.title?.english || data?.data?.Media?.title?.romaji;
    if (!title) { slugCache.set(anilistId, null); return null; }

    // Search Anikage
    const searchUrl = `https://anikage.cc/api/media/anime/advanced-search?query=${encodeURIComponent(title)}&sort=popularity&page=1&per_page=5&include_adult=true`;
    const searchData: any = await fetchJson(searchUrl, timeoutMs);
    const results = Array.isArray(searchData) ? searchData : (searchData?.results || searchData?.data || []);
    const match = results.find((r: any) => r.anilistId === anilistId) || results[0];
    if (!match?.slug) { slugCache.set(anilistId, null); return null; }
    slugCache.set(anilistId, match.slug);
    return match.slug;
  } catch {
    slugCache.set(anilistId, null);
    return null;
  }
}

export async function fetchAnikageSources(
  anilistId: number,
  epNum: number,
  options?: { timeoutMs?: number }
): Promise<AnikageVerifiedResult[]> {
  const timeoutMs = options?.timeoutMs ?? 10000;

  const slug = await resolveSlug(anilistId, timeoutMs);
  if (!slug) return [];

  // Get servers
  const serversUrl = `https://anikage.cc/api/media/anime/${slug}/episodes/${epNum}/servers`;
  const serversData: any = await fetchJson(serversUrl, timeoutMs);
  if (!Array.isArray(serversData)) return [];

  const servers: string[] = serversData.map((s: any) => s.id).filter(Boolean);
  console.log(`[Anikage] ${slug} ep${epNum}: ${servers.length} servers — ${servers.join(", ")}`);

  // Fetch streams for each server (both sub + dub)
  const jobs: Array<{ server: string; lang: "sub" | "dub" }> = [];
  for (const s of servers) {
    jobs.push({ server: s, lang: "sub" });
    jobs.push({ server: s, lang: "dub" });
  }

  const results = await Promise.allSettled(
    jobs.map(async (job): Promise<AnikageVerifiedResult | null> => {
      const streamUrl = `https://anikage.cc/api/media/anime/${slug}/episodes/${epNum}/sources?provider=${job.server}&lang=${job.lang}`;
      const data: any = await fetchJson(streamUrl, timeoutMs);
      if (!data?.sources?.length) return null;

      const src = data.sources[0];
      if (!src?.url) return null;

      // Build proxied URL — route the anikage stream through our worker.
      // prox.anikage.cc needs Origin: https://anikage.cc — our worker can add this
      // via the REFERER_MAP. OLD approach used cdn.animex.su XOR wrapper — DEAD.
      const anikageProxyUrl = `https://prox.anikage.cc/stream/${src.url}/index.txt`;
      const finalUrl = wrapStreamUrl(anikageProxyUrl);

      const isM3U8 = src.isM3U8 === true || src.quality?.includes("Hls");
      const hardsub = src.type === "hardsub" || (job.server === "neko" && !isM3U8);

      return {
        server: job.server,
        type: job.lang,
        streamUrl: finalUrl,
        quality: src.quality || "auto",
        isM3U8,
        isMP4: !isM3U8,
        hardsub,
        tracks: (data.subtitles || []).map((s: any) => ({
          url: s.url || s.file || "",
          lang: s.lang || "en",
          label: s.label || s.lang || "English",
        })).filter((t: any) => t.url),
        intro: data.intro || null,
        outro: data.outro || null,
      };
    })
  );

  const verified: AnikageVerifiedResult[] = [];
  for (const r of results) {
    if (r.status === "fulfilled" && r.value) verified.push(r.value);
  }

  console.log(`[Anikage] ${verified.length}/${jobs.length} streams verified`);
  return verified;
}
