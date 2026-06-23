/**
 * AniLight API Client
 * -------------------
 * AniLight (https://anilight.live) is a public anime streaming aggregator.
 * Its API at api.anilight.live is FULLY OPEN (no auth, no rate limit) and
 * returns direct m3u8 stream URLs that work without proxying.
 *
 * API shape:
 *   1. Search (by query, returns AniList + MAL IDs):
 *      GET https://api.anilight.live/api/search?q={query}
 *      → [{ id, slug, anilistId, idMal, title{romaji,english,native}, coverImage, ... }]
 *
 *   2. Watch (by MAL ID — AniLight does NOT accept AniList IDs):
 *      GET https://api.anilight.live/api/watch/mal?id={malId}&epNum={n}
 *      → {
 *          hostBase: "https://nekostream.site",
 *          stream: {
 *            sub: {
 *              success: true,
 *              playerUrl: "https://mewcdn.online/player/plyr.php#...",
 *              originalMasterUrl: "https://vibeplayer.site/public/stream/{hash}/master.m3u8",
 *              masterUrl: "https://nanobyte.bigdreamsmalldih.site/public/stream/{hash}/master.m3u8",
 *              qualities: [
 *                { quality: "360p",  url: "https://nanobyte.bigdreamsmalldih.site/.../360.m3u8" },
 *                { quality: "720p",  url: "https://nanobyte.bigdreamsmalldih.site/.../720.m3u8" },
 *                { quality: "1080p", url: "https://nanobyte.bigdreamsmalldih.site/.../1080.m3u8" }
 *              ],
 *              headers: { Referer: "https://kwik.cx/" }
 *            },
 *            dub: { ... same shape, or { success: false } if no dub }
 *          },
 *          tracks: [
 *            { id, url, kind, lang, label, default }
 *          ]
 *        }
 *
 * Stream CDNs (vibeplayer.site, nanobyte.bigdreamsmalldih.site) are served by
 * ESA (not Cloudflare) and return valid m3u8 with no bot protection — verified
 * to work DIRECTLY from Vercel and from the browser with no proxy.
 *
 * Note: AniLight uses MAL IDs for the watch endpoint. We resolve
 * AniList → MAL via the AniList GraphQL API.
 */

const ANILIGHT_API = "https://api.anilight.live/api";
const ANILIST_GRAPHQL = "https://graphql.anilist.co";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

const HEADERS: Record<string, string> = {
  "User-Agent": UA,
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.9",
};

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AniLightSearchResult {
  id: number;
  slug: string;
  anilistId: number;
  idMal: number | null;
  title: { romaji?: string; english?: string; native?: string };
  coverImage?: { large?: string; medium?: string; color?: string };
  coverImageAnilist?: string;
  bannerImage?: string;
  isAdult?: boolean;
  genres?: string[];
  synopsis?: string;
  [k: string]: any;
}

export interface AniLightQuality {
  quality: string; // "360p", "720p", "1080p"
  url: string;
}

export interface AniLightStreamSide {
  success: boolean;
  playerUrl?: string;
  originalMasterUrl?: string;
  masterUrl?: string;
  qualities?: AniLightQuality[];
  headers?: Record<string, string>;
}

export interface AniLightTrack {
  id: string;
  url: string;
  kind: string;
  lang: string;
  label: string;
  default?: boolean;
}

export interface AniLightWatchResponse {
  hostBase: string;
  download: { sub: any; dub: any };
  stream: {
    sub: AniLightStreamSide;
    dub: AniLightStreamSide;
  };
  tracks: AniLightTrack[] | null;
}

// ─── AniList ID → MAL ID resolver (with cache) ────────────────────────────────

const anilistToMalCache = new Map<number, number | null>();

export async function resolveMalId(anilistId: number): Promise<number | null> {
  if (anilistToMalCache.has(anilistId)) return anilistToMalCache.get(anilistId)!;

  try {
    const res = await fetch(ANILIST_GRAPHQL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "User-Agent": UA },
      body: JSON.stringify({
        query: "query($id:Int){Media(id:$id,type:ANIME){id idMal}}",
        variables: { id: anilistId },
      }),
      cache: "no-store",
    });
    if (!res.ok) {
      anilistToMalCache.set(anilistId, null);
      return null;
    }
    const data = await res.json();
    const malId = data?.data?.Media?.idMal;
    if (!malId) {
      console.log(`[AniLight] anilistId=${anilistId} has no MAL ID`);
      anilistToMalCache.set(anilistId, null);
      return null;
    }
    console.log(`[AniLight] anilistId=${anilistId} → malId=${malId}`);
    anilistToMalCache.set(anilistId, malId);
    return malId;
  } catch (e: any) {
    console.error(`[AniLight] resolveMalId failed:`, e?.message || e);
    anilistToMalCache.set(anilistId, null);
    return null;
  }
}

// ─── Search ───────────────────────────────────────────────────────────────────

export async function searchAniLight(query: string): Promise<AniLightSearchResult[]> {
  try {
    const res = await fetch(
      `${ANILIGHT_API}/search?q=${encodeURIComponent(query)}`,
      { headers: HEADERS, cache: "no-store" }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

// ─── Watch (returns streams + tracks for a specific episode) ──────────────────

export async function getAniLightWatch(
  malId: number,
  epNum: number,
  timeoutMs = 8000
): Promise<AniLightWatchResponse | null> {
  const url = `${ANILIGHT_API}/watch/mal?id=${malId}&epNum=${epNum}`;
  try {
    const res = await Promise.race([
      fetch(url, { headers: HEADERS, cache: "no-store" }),
      new Promise<Response | null>(r => setTimeout(() => r(null), timeoutMs)),
    ]);
    if (!res || !res.ok) return null;
    return await res.json() as AniLightWatchResponse;
  } catch {
    return null;
  }
}

// ─── Verified result (pre-checked, ready to play) ─────────────────────────────

export interface AniLightVerifiedResult {
  type: "sub" | "dub";
  /** Best playable stream URL — uses nanobyte.bigdreamsmalldih.site (ESA CDN, no proxy needed) */
  streamUrl: string;
  /** Highest quality label, e.g. "1080p" */
  quality: string;
  /** Whether the stream is HLS (m3u8) — always true for AniLight */
  isM3U8: boolean;
  isMP4: boolean;
  /** WebVTT subtitle tracks (softsub) */
  tracks: AniLightTrack[];
  /** All available qualities (360p, 720p, 1080p) */
  qualities: AniLightQuality[];
}

// ─── Death Note server names (AniLight's server IDs) ─────────────────────────
//
// AniLight has hidden server providers using Death Note character names.
// Each returns a DIFFERENT stream URL (different CDN, different quality).
// Discovered via the /api/sources endpoint:
//   GET /api/sources?id={anilistId}&epNum={n}&type={sub|dub}&providerId={name}
//
// Servers and their characteristics (from testing):
//   light  → vibeplayer.site (HLS, hard sub)
//   near   → hls.anidb.app (HLS, hard sub)
//   ryu    → tools.fast4speed.rsvp (HLS, hard sub)
//   misa   → s1.streamzone1.site (HLS, soft sub + VTT tracks)
//   kiwi   → kwik.cx (HLS, hard sub)
//   meg    → embed (iframe, skip)
//   misora → cdn.mewstream.buzz (HLS, hard sub)
//   raye   → pro.24stream.xyz (HLS, hard sub)
//   rem    → vibeplayer.site (HLS, soft sub + VTT tracks)
//
export const ANILIGHT_SERVERS = [
  "light", "near", "ryu", "misa", "kiwi", "misora", "raye", "rem",
] as const;

export type AniLightServer = typeof ANILIGHT_SERVERS[number];

export const ANILIGHT_SERVER_NAMES: Record<string, string> = {
  light: "Light", near: "Near", ryu: "Ryu", misa: "Misa",
  kiwi: "Kiwi", misora: "Misora", raye: "Raye", rem: "Rem",
};

// ─── Per-server source fetch (via /api/sources) ──────────────────────────────

export interface AniLightServerSource {
  url: string;
  quality: string;
  type: string;
  server?: string;
}

export interface AniLightServerResponse {
  sources: AniLightServerSource[];
  tracks?: AniLightTrack[] | null;
  audio?: any;
  chapters?: Array<{ title: string; start: number; end: number }> | null;
  error?: string;
}

/**
 * Fetch sources from a specific AniLight server (Death Note name).
 * Uses the /api/sources endpoint (different from /api/watch/mal).
 */
export async function getAniLightServerSources(
  anilistId: number,
  epNum: number,
  type: "sub" | "dub",
  server: string,
  timeoutMs = 8000
): Promise<AniLightServerResponse | null> {
  const url = `${ANILIGHT_API}/sources?id=${anilistId}&epNum=${epNum}&type=${type}&providerId=${server}`;
  try {
    const res = await Promise.race([
      fetch(url, { headers: HEADERS, cache: "no-store" }),
      new Promise<Response | null>(r => setTimeout(() => r(null), timeoutMs)),
    ]);
    if (!res || !res.ok) return null;
    const data = await res.json() as AniLightServerResponse;
    if (data?.error || !data?.sources?.length) return null;
    return data;
  } catch {
    return null;
  }
}

// ─── Main: fetch ALL AniLight servers (Death Note names + quality variants) ──

export interface AniLightVerifiedResult {
  /** Server name — either a Death Note name (light, near, ryu, etc.) or "1080p"/"720p"/"360p" */
  server: string;
  type: "sub" | "dub";
  /** Stream URL — may need proxy depending on CDN */
  streamUrl: string;
  /** Quality label */
  quality: string;
  isM3U8: boolean;
  isMP4: boolean;
  /** Whether this is hard sub (subs burned in) or soft sub (VTT tracks) */
  hardsub: boolean;
  /** WebVTT subtitle tracks (only for soft sub servers like misa/rem) */
  tracks: AniLightTrack[];
}

/**
 * Fetch ALL AniLight servers for an anime episode.
 *
 * Returns TWO types of servers:
 *   1. Quality variants from /api/watch/mal: AniLight 1080p, AniLight 720p, AniLight 360p
 *      (these come from nanobyte.bigdreamsmalldih.site — ESA CDN, plays directly)
 *   2. Death Note servers from /api/sources: AniLight Light, Near, Ryu, Misa, Kiwi,
 *      Misora, Raye, Rem (each returns a DIFFERENT stream URL)
 *
 * Both types show with "AniLight" prefix in the watch page.
 */
export async function fetchAniLightSources(
  anilistId: number,
  epNum: number,
  options?: { sub?: boolean; dub?: boolean; timeoutMs?: number }
): Promise<AniLightVerifiedResult[]> {
  const wantSub = options?.sub ?? true;
  const wantDub = options?.dub ?? true;
  const timeoutMs = options?.timeoutMs ?? 8000;

  const verified: AniLightVerifiedResult[] = [];

  // ─── Step 1: Fetch quality variants (1080p/720p/360p) via /api/watch/mal ──
  // These come from nanobyte.bigdreamsmalldih.site (ESA CDN) — play DIRECTLY.
  const malId = await resolveMalId(anilistId);
  if (malId) {
    const watchData = await getAniLightWatch(malId, epNum, timeoutMs);
    if (watchData?.stream) {
      const tracks = (watchData.tracks || []).filter(t => t?.url);

      const collectQualities = (side: AniLightStreamSide, type: "sub" | "dub") => {
        if (!side?.success || !side.qualities?.length) return;
        for (const q of side.qualities) {
          if (!q.url) continue;
          verified.push({
            server: q.quality,  // "1080p", "720p", "360p"
            type,
            streamUrl: q.url,   // direct ESA CDN URL — no proxy needed
            quality: q.quality,
            isM3U8: true,
            isMP4: false,
            hardsub: false,     // quality variants are soft sub (have VTT tracks)
            tracks,
          });
        }
      };

      if (wantSub) collectQualities(watchData.stream.sub, "sub");
      if (wantDub) collectQualities(watchData.stream.dub, "dub");
      console.log(`[AniLight] quality variants: ${verified.length} servers from /api/watch/mal`);
    }
  }

  // ─── Step 2: Fetch Death Note servers via /api/sources ─────────────────────
  const jobs: Array<{ server: string; type: "sub" | "dub" }> = [];
  if (wantSub) {
    for (const s of ANILIGHT_SERVERS) jobs.push({ server: s, type: "sub" });
  }
  if (wantDub) {
    for (const s of ANILIGHT_SERVERS) jobs.push({ server: s, type: "dub" });
  }

  console.log(`[AniLight] trying ${jobs.length} Death Note server×type combos`);

  const results = await Promise.allSettled(
    jobs.map(async (job): Promise<AniLightVerifiedResult | null> => {
      const data = await getAniLightServerSources(anilistId, epNum, job.type, job.server, timeoutMs);
      if (!data?.sources?.length) return null;

      const source = data.sources[0];
      if (!source?.url) return null;

      const isHls = source.type?.includes("mpegurl") || source.url.includes(".m3u8");
      const isMp4 = source.type?.includes("mp4") || source.url.includes(".mp4");

      // Determine hardsub: servers with VTT tracks are soft sub
      const hasTracks = (data.tracks || []).length > 0;
      const hardsub = !hasTracks;

      // Build proxy URL — route through proxy.anikuro.to for CORS
      const b64 = Buffer.from(`${source.url}|https://kwik.cx/`).toString("base64");
      const ext = isMp4 ? ".mp4" : ".m3u8";
      const streamUrl = `https://proxy.anikuro.to/${b64}${ext}`;

      const tracks = (data.tracks || []).filter(t => t?.url);

      return {
        server: job.server,
        type: job.type,
        streamUrl,
        quality: source.quality || "auto",
        isM3U8: isHls,
        isMP4: isMp4,
        hardsub,
        tracks,
      };
    })
  );

  let deathNoteCount = 0;
  for (const r of results) {
    if (r.status === "fulfilled" && r.value) {
      verified.push(r.value);
      deathNoteCount++;
    }
  }

  console.log(`[AniLight] ${verified.length} total servers (${verified.length - deathNoteCount} quality variants + ${deathNoteCount} Death Note servers)`);
  return verified;
}
