/**
 * AniDap API Client
 * -----------------
 * AniDap (https://anidap.se) is a public anime streaming aggregator.
 * It exposes a REST API at `chad.anidap.se/rest/api/...` that returns
 * HLS m3u8 streams + WebVTT subtitles + intro/outro chapters for every
 * anime, in sub and dub, across 11 providers.
 *
 * API shape (all require Origin: https://anidap.se + Referer: https://anidap.se/):
 *
 *   1. AniList → AniDap ID mapping
 *      GET https://anidap.se/api/anime/{anilistId}
 *      → { data: { id: "one-piece-p8k27", anilistId: 21, malId: 21, ... } }
 *
 *   2. Sources for a specific episode + type + provider
 *      GET https://chad.anidap.se/rest/api/sources?id={anidapId}&epNum={n}&type={sub|dub}&providerId={provider}
 *      → {
 *          sources: [{ url, quality, type }],
 *          tracks:  [{ id, url, lang, label, kind, default }],
 *          audio:   null,
 *          chapters:[{ title: "Intro"|"Outro", start, end }],
 *          headers: { Origin: "https://animex.one" }
 *        }
 *
 * Providers (per the user's spec):
 *   sub:    vee, yuki, miku, neko, beep, meme, uwu, kuro, sax, yume
 *   dub:    mimi, yuki, miku, uwu, kuro, sax, yume
 *
 *   (beep, meme, uwu, kuro, sax, yume serve hardsub content under type=sub
 *    — they will return null `tracks` because subtitles are burned in.)
 */

const ANIDAP_FRONT = "https://anidap.se";
const ANIDAP_API = "https://chad.anidap.se/rest/api";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

const ANIDAP_HEADERS: Record<string, string> = {
  "User-Agent": UA,
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.9",
  Origin: ANIDAP_FRONT,
  Referer: ANIDAP_FRONT + "/",
  "Sec-Fetch-Dest": "empty",
  "Sec-Fetch-Mode": "cors",
  "Sec-Fetch-Site": "same-site",
};

// ─── Provider catalog (user's spec) ────────────────────────────────────────────

export type AniDapProvider =
  // sub-only providers (softsub — VTT tracks included)
  | "vee" | "yuki" | "miku" | "neko"
  // hardsub providers (also served under type=sub, but no VTT tracks)
  | "beep" | "meme" | "uwu" | "kuro" | "sax" | "yume"
  // dub-only provider
  | "mimi";

export const ANIDAP_SUB_PROVIDERS: AniDapProvider[] = [
  "vee", "yuki", "miku", "neko",         // softsub
  "beep", "meme", "uwu", "kuro", "sax", "yume",  // hardsub
];

export const ANIDAP_DUB_PROVIDERS: AniDapProvider[] = [
  "mimi", "yuki", "miku", "uwu", "kuro", "sax", "yume",
];

// Provider metadata for nice display names + flags
export const ANIDAP_PROVIDER_META: Record<AniDapProvider, { name: string; hardsub: boolean; dub: boolean; sub: boolean }> = {
  vee:  { name: "Vee",   hardsub: false, sub: true,  dub: false },
  yuki: { name: "Yuki",  hardsub: false, sub: true,  dub: true  },
  miku: { name: "Miku",  hardsub: false, sub: true,  dub: true  },
  neko: { name: "Neko",  hardsub: false, sub: true,  dub: false },
  beep: { name: "Beep",  hardsub: true,  sub: true,  dub: false },
  meme: { name: "Meme",  hardsub: true,  sub: true,  dub: false },
  uwu:  { name: "Uwu",   hardsub: true,  sub: true,  dub: true  },
  kuro: { name: "Kuro",  hardsub: true,  sub: true,  dub: true  },
  sax:  { name: "Sax",   hardsub: true,  sub: true,  dub: true  },
  yume: { name: "Yume",  hardsub: true,  sub: true,  dub: true  },
  mimi: { name: "Mimi",  hardsub: false, sub: false, dub: true  },
};

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AniDapSource {
  url: string;
  quality: string;       // "1080p", "720p", "auto", etc.
  type: string;          // "video/mpegurl" | "video/mp4" | ...
}

export interface AniDapTrack {
  id: string;
  url: string;
  lang: string;
  label: string;
  kind: string;          // "captions" | "subtitles"
  default?: boolean;
}

export interface AniDapChapter {
  title: string;         // "Intro" | "Outro"
  start: number;         // seconds
  end: number;           // seconds
}

export interface AniDapSourcesResponse {
  sources: AniDapSource[];
  tracks: AniDapTrack[] | null;
  audio: any;
  chapters: AniDapChapter[] | null;
  headers: { Origin?: string; Referer?: string; [k: string]: string | undefined } | null;
}

export interface AniDapDetailResponse {
  success: boolean;
  data?: {
    id: string;          // AniDap ID like "one-piece-p8k27"
    anilistId?: number;
    malId?: number;
    titleRomaji?: string;
    titleEnglish?: string;
    titles?: Record<string, string>;
    [k: string]: any;
  };
  error?: string;
}

// ─── AniList ID → AniDap ID resolver (with in-memory cache) ────────────────────

const anidapIdCache = new Map<number, string | null>();

export async function resolveAniDapId(anilistId: number): Promise<string | null> {
  if (anidapIdCache.has(anilistId)) return anidapIdCache.get(anilistId)!;

  try {
    const res = await fetch(`${ANIDAP_FRONT}/api/anime/${anilistId}`, {
      headers: ANIDAP_HEADERS,
      cache: "no-store",
    });
    if (!res.ok) {
      console.error(`[AniDap] resolveAniDapId HTTP ${res.status} for anilistId=${anilistId}`);
      anidapIdCache.set(anilistId, null);
      return null;
    }
    const data: AniDapDetailResponse = await res.json();
    if (!data?.success || !data.data?.id) {
      console.error(`[AniDap] resolveAniDapId no data for anilistId=${anilistId}`);
      anidapIdCache.set(anilistId, null);
      return null;
    }
    const id = data.data.id;
    console.log(`[AniDap] anilistId=${anilistId} → anidapId=${id}`);
    anidapIdCache.set(anilistId, id);
    return id;
  } catch (e: any) {
    console.error(`[AniDap] resolveAniDapId failed:`, e?.message || e);
    anidapIdCache.set(anilistId, null);
    return null;
  }
}

// ─── Fetch sources for a specific provider ────────────────────────────────────

export async function getAniDapSources(
  anidapId: string,
  epNum: number,
  type: "sub" | "dub",
  provider: AniDapProvider,
  timeoutMs = 8000
): Promise<AniDapSourcesResponse | null> {
  const url = `${ANIDAP_API}/sources?id=${encodeURIComponent(anidapId)}&epNum=${epNum}&type=${type}&providerId=${provider}`;

  try {
    const res = await Promise.race([
      fetch(url, { headers: ANIDAP_HEADERS, cache: "no-store" }),
      new Promise<Response | null>(r => setTimeout(() => r(null), timeoutMs)),
    ]);
    if (!res || !res.ok) {
      // Quietly skip — provider may not have this episode
      return null;
    }
    const data: AniDapSourcesResponse = await res.json();
    if (!data?.sources?.length) return null;
    return data;
  } catch {
    return null;
  }
}

// ─── Build a playable, CORS-friendly URL for an AniDap stream ─────────────────
//
// AniDap's streams sit behind Cloudflare and require Origin: https://animex.one.
// We can't set Origin from a browser (it's a forbidden header), so we route
// the stream through AniDap's own Cloudflare-Worker proxy `prox.animex.one`,
// which:
//   • Fetches the upstream m3u8 from within Cloudflare's network (passes CF)
//   • Rewrites all segment + AES-key URLs in the manifest to also go through
//     prox.animex.one/fetch?url=...
//   • Adds permissive CORS headers so the browser can play it cross-origin
//
// Endpoint shape:  https://prox.animex.one/fetch?url={encodeURIComponent(url)}
//
export function buildAniDapProxyUrl(streamUrl: string): string {
  return `https://prox.animex.one/fetch?url=${encodeURIComponent(streamUrl)}`;
}

// ─── Convenience: fetch from many providers in parallel ───────────────────────

export interface AniDapVerifiedResult {
  provider: AniDapProvider;
  type: "sub" | "dub";
  sources: AniDapSource[];
  tracks: AniDapTrack[];
  chapters: AniDapChapter[];
  intro: { start: number; end: number } | null;
  outro: { start: number; end: number } | null;
  /** Best playable stream URL (already proxied through prox.animex.one) */
  streamUrl: string;
  /** Highest quality label, e.g. "1080p" */
  quality: string;
  /** Whether the stream is HLS (m3u8) or MP4 */
  isM3U8: boolean;
  isMP4: boolean;
}

/**
 * Discover which providers actually have this episode (sub + dub).
 * ONE call to `/servers` — no per-provider hammering.
 * Skips embed-type providers (ok.ru, mp4upload, streamtape, etc.)
 * since those return iframe embeds, not m3u8/mp4 streams.
 */
interface AniDapServerEntry {
  id: string;
  default?: boolean;
  tip?: string;
  type?: string;    // "embed" for iframe embeds — we skip these
  url?: string;     // only present for embeds
}

interface AniDapServersResponse {
  subProviders: AniDapServerEntry[];
  dubProviders: AniDapServerEntry[];
  error?: string;
}

export async function discoverAniDapServers(
  anidapId: string,
  epNum: number,
  timeoutMs = 8000
): Promise<{ sub: AniDapProvider[]; dub: AniDapProvider[] }> {
  const url = `${ANIDAP_API}/servers?id=${encodeURIComponent(anidapId)}&epNum=${epNum}`;
  try {
    const res = await Promise.race([
      fetch(url, { headers: ANIDAP_HEADERS, cache: "no-store" }),
      new Promise<Response | null>(r => setTimeout(() => r(null), timeoutMs)),
    ]);
    if (!res || !res.ok) return { sub: [], dub: [] };
    const data: AniDapServersResponse = await res.json();
    if (data?.error) {
      console.log(`[AniDap] servers endpoint: ${data.error}`);
      return { sub: [], dub: [] };
    }

    const filterProviders = (list: AniDapServerEntry[] | undefined): AniDapProvider[] => {
      if (!Array.isArray(list)) return [];
      return list
        .filter(s => s?.id && s.type !== "embed")  // skip iframe embeds (ok.ru, mp4upload, etc.)
        .map(s => s.id as AniDapProvider);
    };

    return {
      sub: filterProviders(data.subProviders),
      dub: filterProviders(data.dubProviders),
    };
  } catch {
    return { sub: [], dub: [] };
  }
}

/**
 * Fetch sources from EVERY provider that actually has this episode.
 *
 * Strategy:
 *   1. ONE call to `/servers` discovers which providers exist for this episode
 *      (sub + dub). Skips embed-only providers (ok.ru, mp4upload).
 *   2. For each discovered provider, fire a `/sources` call (batched 3-at-a-time
 *      to dodge AniDap's per-IP rate limiter).
 *
 * Returns only providers that actually have a playable stream.
 */
export async function fetchAllAniDapSources(
  anilistId: number,
  epNum: number,
  options?: { sub?: boolean; dub?: boolean; timeoutMs?: number }
): Promise<AniDapVerifiedResult[]> {
  const anidapId = await resolveAniDapId(anilistId);
  if (!anidapId) {
    console.log(`[AniDap] no anidapId for anilistId=${anilistId} — skipping`);
    return [];
  }

  const wantSub = options?.sub ?? true;
  const wantDub = options?.dub ?? true;
  const timeoutMs = options?.timeoutMs ?? 8000;

  // Step 1: discover available providers via a single /servers call
  const discovered = await discoverAniDapServers(anidapId, epNum, timeoutMs);

  // Step 2: intersect with our wanted providers + types
  const jobs: Array<{ provider: AniDapProvider; type: "sub" | "dub" }> = [];
  if (wantSub) {
    for (const p of discovered.sub) {
      // Only include providers that are in our catalog (ANIDAP_SUB_PROVIDERS)
      if (ANIDAP_SUB_PROVIDERS.includes(p)) {
        jobs.push({ provider: p, type: "sub" });
      }
    }
  }
  if (wantDub) {
    for (const p of discovered.dub) {
      if (ANIDAP_DUB_PROVIDERS.includes(p)) {
        jobs.push({ provider: p, type: "dub" });
      }
    }
  }

  console.log(`[AniDap] ${anidapId} ep${epNum}: ${discovered.sub.length} sub providers, ${discovered.dub.length} dub providers discovered. Fetching ${jobs.length} sources (batched 3-at-a-time).`);

  // Step 3: fetch sources in batches of 3 (with 700ms gap to dodge rate limiter)
  const BATCH_SIZE = 3;
  const BATCH_GAP_MS = 700;
  const verified: AniDapVerifiedResult[] = [];

  for (let i = 0; i < jobs.length; i += BATCH_SIZE) {
    const batch = jobs.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.allSettled(
      batch.map(async (job): Promise<AniDapVerifiedResult | null> => {
        const data = await getAniDapSources(anidapId, epNum, job.type, job.provider, timeoutMs);
        if (!data?.sources?.length) return null;

        // Pick the best playable source (prefer HLS m3u8, then MP4)
        const isHls = (s: AniDapSource) =>
          s.type?.includes("mpegurl") || s.url.includes(".m3u8") || s.url.endsWith(".txt");
        const isMp4 = (s: AniDapSource) =>
          s.type?.includes("mp4") || s.url.includes(".mp4");

        // Quality ranking — 1080p > 720p > 480p > 360p > auto
        const qRank = (q: string): number => {
          const m = (q || "").match(/(\d{3,4})p?/i);
          if (m) return parseInt(m[1], 10);
          if (/auto/i.test(q)) return 1;
          return 0;
        };

        const playable =
          data.sources.filter(isHls).sort((a, b) => qRank(b.quality) - qRank(a.quality))[0] ||
          data.sources.filter(isMp4).sort((a, b) => qRank(b.quality) - qRank(a.quality))[0] ||
          data.sources[0];

        if (!playable?.url) return null;

        const m3u8 = isHls(playable);
        const mp4 = isMp4(playable);

        // Parse intro/outro from chapters
        const chapters = data.chapters || [];
        const intro = chapters.find(c => /intro/i.test(c.title)) || null;
        const outro = chapters.find(c => /outro|ending|ed/i.test(c.title)) || null;

        const tracks = (data.tracks || []).filter(t => t?.url);

        return {
          provider: job.provider,
          type: job.type,
          sources: data.sources,
          tracks,
          chapters,
          intro: intro ? { start: intro.start, end: intro.end } : null,
          outro: outro ? { start: outro.start, end: outro.end } : null,
          streamUrl: buildAniDapProxyUrl(playable.url),
          quality: playable.quality || "auto",
          isM3U8: m3u8,
          isMP4: mp4,
        };
      })
    );

    for (const r of batchResults) {
      if (r.status === "fulfilled" && r.value) verified.push(r.value);
    }

    // Small gap between batches to avoid hammering AniDap's rate limiter
    if (i + BATCH_SIZE < jobs.length) {
      await new Promise(r => setTimeout(r, BATCH_GAP_MS));
    }
  }

  console.log(`[AniDap] ${verified.length}/${jobs.length} providers yielded playable streams`);
  return verified;
}
