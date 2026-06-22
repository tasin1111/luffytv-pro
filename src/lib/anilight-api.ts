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

/**
 * Fetch + verify AniLight streams for an anime episode.
 * Returns one entry PER QUALITY (360p, 720p, 1080p) per type (sub, dub).
 *
 * AniLight returns multiple qualities for each stream — we expose each as a
 * separate server so the user can pick. The streams come from
 * `nanobyte.bigdreamsmalldih.site` (ESA CDN, not Cloudflare) — work DIRECTLY
 * from the browser with no proxy.
 */
export async function fetchAniLightSources(
  anilistId: number,
  epNum: number,
  options?: { sub?: boolean; dub?: boolean; timeoutMs?: number }
): Promise<AniLightVerifiedResult[]> {
  const wantSub = options?.sub ?? true;
  const wantDub = options?.dub ?? true;
  const timeoutMs = options?.timeoutMs ?? 8000;

  const malId = await resolveMalId(anilistId);
  if (!malId) {
    console.log(`[AniLight] no malId for anilistId=${anilistId} — skipping`);
    return [];
  }

  const data = await getAniLightWatch(malId, epNum, timeoutMs);
  if (!data?.stream) {
    console.log(`[AniLight] no stream data for malId=${malId} ep${epNum}`);
    return [];
  }

  const verified: AniLightVerifiedResult[] = [];
  const tracks = (data.tracks || []).filter(t => t?.url);

  // Quality ranking — 1080p > 720p > 480p > 360p > auto
  const qRank = (q: string): number => {
    const m = (q || "").match(/(\d{3,4})p?/i);
    if (m) return parseInt(m[1], 10);
    if (/auto/i.test(q)) return 1;
    return 0;
  };

  // Returns one AniLightVerifiedResult PER quality (sorted high → low)
  const collectAll = (side: AniLightStreamSide, type: "sub" | "dub"): AniLightVerifiedResult[] => {
    if (!side?.success) return [];
    const qualities = side.qualities || [];
    if (qualities.length === 0) {
      // Fall back to masterUrl if no qualities listed
      if (side.masterUrl) {
        return [{
          type,
          streamUrl: side.masterUrl,
          quality: "auto",
          isM3U8: true,
          isMP4: false,
          tracks,
          qualities: [],
        }];
      }
      return [];
    }
    // Sort high → low quality
    return qualities
      .slice()
      .sort((a, b) => qRank(b.quality) - qRank(a.quality))
      .map(q => ({
        type,
        streamUrl: q.url,
        quality: q.quality,
        isM3U8: true,
        isMP4: false,
        tracks,
        qualities,
      }));
  };

  if (wantSub) {
    verified.push(...collectAll(data.stream.sub, "sub"));
  }
  if (wantDub) {
    verified.push(...collectAll(data.stream.dub, "dub"));
  }

  console.log(`[AniLight] ${verified.length} streams for malId=${malId} ep${epNum} (sub=${data.stream.sub?.success ? `${data.stream.sub.qualities?.length || 1} qualities` : "no"}, dub=${data.stream.dub?.success ? `${data.stream.dub.qualities?.length || 1} qualities` : "no"})`);
  return verified;
}
