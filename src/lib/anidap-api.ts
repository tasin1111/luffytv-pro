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

import { wrapStreamUrl } from "./proxy";

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

// ─── Provider catalog ────────────────────────────────────────────────────────
//
// AniDap providers — ONLY the real AniDap provider names. Death Note character
// names (LIGHT, NEAR, RYU, etc.) belong to ANILIGHT, not AniDap.
//

export type AniDapProvider =
  // softsub providers (VTT tracks included)
  | "vee" | "yuki" | "miku" | "neko" | "beep"
  // hardsub providers (no VTT tracks — subs burned into video)
  | "meme" | "uwu" | "kuro" | "sax" | "yume" | "mochi" | "koto" | "kami"
  // dub-only provider
  | "mimi";

// Full provider catalog — covers ALL providers that AniDap's /servers endpoint
// can return. We try every one in parallel (batched) so we don't miss any.
export const ANIDAP_SUB_PROVIDERS: AniDapProvider[] = [
  "vee", "yuki", "miku", "neko", "beep",        // softsub
  "meme", "uwu", "kuro", "sax", "yume", "mochi", "koto", "kami",  // hardsub
];

export const ANIDAP_DUB_PROVIDERS: AniDapProvider[] = [
  "mimi", "yuki", "miku", "uwu", "kuro", "sax", "yume", "mochi",
];

// Provider metadata for nice display names + flags
export const ANIDAP_PROVIDER_META: Record<AniDapProvider, { name: string; hardsub: boolean; dub: boolean; sub: boolean }> = {
  // Soft sub providers
  vee:   { name: "Vee",   hardsub: false, sub: true,  dub: false },
  yuki:  { name: "Yuki",  hardsub: false, sub: true,  dub: true  },
  miku:  { name: "Miku",  hardsub: false, sub: true,  dub: true  },
  neko:  { name: "Neko",  hardsub: false, sub: true,  dub: false },
  beep:  { name: "Beep",  hardsub: false, sub: true,  dub: false },
  // Hard sub providers
  meme:  { name: "Meme",  hardsub: true,  sub: true,  dub: false },
  uwu:   { name: "Uwu",   hardsub: true,  sub: true,  dub: true  },
  kuro:  { name: "Kuro",  hardsub: true,  sub: true,  dub: true  },
  sax:   { name: "Sax",   hardsub: true,  sub: true,  dub: true  },
  yume:  { name: "Yume",  hardsub: true,  sub: true,  dub: true  },
  mochi: { name: "Mochi", hardsub: true,  sub: true,  dub: true  },
  koto:  { name: "Koto",  hardsub: true,  sub: true,  dub: false },
  kami:  { name: "Kami",  hardsub: true,  sub: true,  dub: false },
  // Dub-only
  mimi:  { name: "Mimi",  hardsub: true,  sub: false, dub: true  },
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
// Strategy copied from Anistream.one's player (node 16 chunk):
//
//   1. Apply provider-specific CDN swap (no proxy needed — these are the same
//      files served from a non-Cloudflare-protected mirror):
//        beep:  playeng.animeapps.top/r2/      → bd.24stream.xyz/media/
//        mochi: tools.fast4speed.rsvp          → mp4.24stream.xyz/storage
//               vibeplayer.site/public/stream/ → hawk.24stream.xyz/media/
//        mimi:  vibeplayer.site/public/stream/ → hawk.24stream.xyz/media/
//        kiwi:  hls.anidb.app/stream/          → wave.24stream.xyz/stream/
//        wave:  (any hostname)                 → wv.24stream.xyz/media/
//
//   2. If no swap applies (or after the swap), wrap through proxy.anikuro.to
//      with the correct referer:
//        vee:   https://www.animeonsen.xyz/
//        yuki:  https://megaplay.buzz
//        miku:  https://ply.24stream.xyz/media/
//        neko:  https://animeverse.to/
//        uwu:   https://kwik.cx/
//        beep:  https://animex.one/  (already swapped to bd.24stream.xyz — direct, no proxy)
//        ...
//
// The CDN swap is HUGE — bd.24stream.xyz serves the exact same files as
// playeng.animeapps.top but without Cloudflare's bot protection. So Animex
// "beep" streams (which return Google Cloud HTML from the original URL) play
// perfectly from bd.24stream.xyz directly.
//
const ANIDAP_STREAM_REFERER = "https://animex.one/";

/** Provider-specific referer for the rare case we need to proxy. */
const ANIDAP_PROVIDER_REFERER: Record<AniDapProvider, string> = {
  vee:   "https://www.animeonsen.xyz/",
  yuki:  "https://megaplay.buzz/",
  miku:  "https://ply.24stream.xyz/media/",
  neko:  "https://animeverse.to/",
  beep:  "https://animex.one/",
  meme:  "https://animex.one/",
  uwu:   "https://kwik.cx/",
  kuro:  "https://animex.one/",
  sax:   "https://animex.one/",
  yume:  "https://animex.one/",
  mochi: "https://animex.one/",
  koto:  "https://animex.one/",
  kami:  "https://animex.one/",
  mimi:  "https://animex.one/",
  // Death Note character names — all use the same CDN as beep (playeng.animeapps.top)
  LIGHT: "https://animex.one/", NEAR: "https://animex.one/", RYU: "https://animex.one/",
  MISA: "https://animex.one/", KIWI: "https://animex.one/", MEG: "https://animex.one/",
  MISORA: "https://animex.one/", RAYE: "https://animex.one/", REM: "https://animex.one/",
  L: "https://animex.one/", WATARI: "https://animex.one/", TAKADA: "https://animex.one/",
  AIZAWA: "https://animex.one/", SOICHIRO: "https://animex.one/",
};

/**
 * Apply provider-specific CDN swap (Anistream's oi() function).
 * Returns the swapped URL (still on a 24stream.xyz subdomain, no proxy needed),
 * or the original URL if no swap applies.
 */
function applyCdnSwap(url: string, provider: AniDapProvider): string {
  const u = url.trim();
  if (!u.startsWith("http")) return u;

  // beep + Death Note character names + koto + kami all use playeng.animeapps.top
  // → swap to bd.24stream.xyz/media/ (non-CF-protected mirror)
  const BEEP_LIKE = new Set<AniDapProvider>([
    "beep", "koto", "kami",
    "LIGHT", "NEAR", "RYU", "MISA", "KIWI", "MEG",
    "MISORA", "RAYE", "REM", "L", "WATARI", "TAKADA", "AIZAWA", "SOICHIRO",
  ]);
  if (BEEP_LIKE.has(provider)) {
    return u.replace("https://playeng.animeapps.top/r2/", "https://bd.24stream.xyz/media/");
  }
  // mimi/meme/mochi use vibeplayer.site → hawk.24stream.xyz
  if (provider === "mimi" || provider === "meme" || provider === "mochi") {
    return u.replace("https://vibeplayer.site/public/stream/", "https://hawk.24stream.xyz/media/");
  }
  return u;
}

export function buildAniDapProxyUrl(streamUrl: string, isMP4 = false, provider?: AniDapProvider): string {
  // Step 1: Apply provider-specific CDN swap (direct mirror, no proxy needed)
  const swapped = provider ? applyCdnSwap(streamUrl, provider) : streamUrl;

  // Step 2: If the swap produced a 24stream.xyz URL, return it directly —
  // these subdomains (bd, hawk, wave, wv, ply, mp4) serve files without
  // Cloudflare bot protection and have permissive CORS.
  if (/^https?:\/\/[^/]*\.24stream\.xyz\//.test(swapped)) {
    return swapped;
  }

  // Step 3: Otherwise, wrap through cdn.animex.su (Anistream's proxy)
  // Encoding: XOR(url + \0 + referer, "aproxy2026") → base64url → /stream/{b64}/index.txt
  const referer = provider
    ? (ANIDAP_PROVIDER_REFERER[provider] || ANIDAP_STREAM_REFERER)
    : ANIDAP_STREAM_REFERER;
  const key = "aproxy2026";
  const keyBytes = Buffer.from(key);
  const combined = Buffer.from(swapped + "\0" + referer);
  const xored = Buffer.alloc(combined.length);
  for (let i = 0; i < combined.length; i++) {
    xored[i] = combined[i] ^ keyBytes[i % keyBytes.length];
  }
  const b64 = xored.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return wrapStreamUrl(`https://cdn.animex.su/stream/${b64}/index.txt`);
}

/**
 * Build a proxy URL for an AniDap WebVTT subtitle track.
 * Subtitle files on `1oe.lostproject.club` are Cloudflare-protected, and
 * proxy.anikuro.to returns 500 for them. So we route subtitle URLs through
 * our OWN /api/anime/scraper/stream proxy which uses axios (different TLS
 * fingerprint than fetch — bypasses some CF challenges).
 */
export function buildAniDapSubtitleProxyUrl(subtitleUrl: string): string {
  // Route subtitles through cdn.animex.su too
  const key = "aproxy2026";
  const keyBytes = Buffer.from(key);
  const combined = Buffer.from(subtitleUrl + "\0" + ANIDAP_STREAM_REFERER);
  const xored = Buffer.alloc(combined.length);
  for (let i = 0; i < combined.length; i++) {
    xored[i] = combined[i] ^ keyBytes[i % keyBytes.length];
  }
  const b64 = xored.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return wrapStreamUrl(`https://cdn.animex.su/stream/${b64}/index.txt`);
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
 * Fetch sources from EVERY provider in our catalog (10 sub + 7 dub).
 *
 * Strategy:
 *   - Try ALL providers in our catalog (vee, yuki, miku, neko, beep, meme,
 *     uwu, kuro, sax, yume for sub; mimi, yuki, miku, uwu, kuro, sax, yume
 *     for dub) — NOT just the ones /servers returns.
 *   - Reason: /servers doesn't always list every provider that has the
 *     episode. e.g. for One Piece ep 1, "sax" has the episode but isn't in
 *     the /servers response.
 *   - Batched 3-at-a-time with 700ms gap to dodge AniDap's per-IP rate
 *     limiter.
 *   - Providers that return "bot_detected" or "too_many_requests" are
 *     silently skipped (they're rate-limited, not absent).
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
  const timeoutMs = options?.timeoutMs ?? 5000;

  // Build the full job list from our catalog — try EVERY provider, not just
  // the ones /servers reports. /servers is unreliable and often omits
  // providers that actually have the episode (e.g. sax for One Piece ep 1).
  const jobs: Array<{ provider: AniDapProvider; type: "sub" | "dub" }> = [];
  if (wantSub) {
    for (const p of ANIDAP_SUB_PROVIDERS) jobs.push({ provider: p, type: "sub" });
  }
  if (wantDub) {
    for (const p of ANIDAP_DUB_PROVIDERS) jobs.push({ provider: p, type: "dub" });
  }

  console.log(`[AniDap] ${anidapId} ep${epNum}: trying ALL ${jobs.length} providers from catalog (batched ${4}-at-a-time, 500ms gap)`);

  // Fetch sources in batches of 4 (with 500ms gap to dodge rate limiter).
  // Timing: 17 providers / 4 per batch = 5 batches × (5s + 0.5s) = ~27s
  // — fits within Vercel's 30s function timeout.
  const BATCH_SIZE = 4;
  const BATCH_GAP_MS = 500;
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
          streamUrl: buildAniDapProxyUrl(playable.url, mp4, job.provider),
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

  console.log(`[AniDap] ${verified.length}/${jobs.length} API providers yielded playable streams`);
  return verified;
}
