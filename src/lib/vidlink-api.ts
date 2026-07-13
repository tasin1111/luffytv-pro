// ============================================================
// VIDLINK API — Direct stream scraper for Movies/TV
//
// Flow:
//   1. Encrypt TMDB ID: GET https://enc-dec.app/api/enc-vidlink?text={tmdbId}
//      → returns the encrypted ID string used by vidlink.pro
//   2. Fetch streams:
//      Movie: GET https://vidlink.pro/api/b/movie/{encrypted}?multiLang=1
//      TV:    GET https://vidlink.pro/api/b/tv/{encrypted}?multiLang=1&se={season}&ep={episode}
//   3. Response contains direct MP4 URLs at 360p/480p/720p/1080p + SRT subtitles
//
// All requests are made server-side from /api/stream/vidlink route.
// The video URLs returned may need a Referer header — they should be
// routed through /api/stream?url=...&referer=https://vidlink.pro/ for
// CORS-free playback in the browser.
// ============================================================

export interface VidlinkSource {
  url: string;
  quality: string;
  format: string;
}

export interface VidlinkSubtitle {
  url: string;
  lang: string;
  label: string;
}

export interface VidlinkStreams {
  sources: VidlinkSource[];
  subtitles: VidlinkSubtitle[];
}

const ENC_DEC_API = "https://enc-dec.app/api/enc-vidlink";
const VIDLINK_API = "https://vidlink.pro/api/b";

const DEFAULT_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36",
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.9",
  Referer: "https://vidlink.pro/",
  Origin: "https://vidlink.pro",
};

/**
 * Encrypt the TMDB ID using the enc-dec.app service.
 * Returns the encrypted string used by vidlink.pro.
 */
export async function encryptTmdbId(tmdbId: number): Promise<string> {
  const url = `${ENC_DEC_API}?text=${encodeURIComponent(String(tmdbId))}`;
  const res = await fetch(url, {
    headers: DEFAULT_HEADERS,
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) {
    throw new Error(`enc-dec failed: ${res.status}`);
  }
  const data = await res.json();
  // The API can return either { result: "..." } or { encrypted: "..." } or a plain string
  const encrypted =
    (data && (data.result || data.encrypted || data.data || data.token)) ||
    (typeof data === "string" ? data : "");
  if (!encrypted || typeof encrypted !== "string") {
    throw new Error("enc-dec returned no encrypted payload");
  }
  return encrypted.trim();
}

/**
 * Normalise the stream payload returned by vidlink.pro.
 *
 * The exact shape varies — this helper inspects several common fields and
 * returns a clean { sources, subtitles } object.
 */
function normaliseStreams(raw: unknown): VidlinkStreams {
  const out: VidlinkStreams = { sources: [], subtitles: [] };
  if (!raw || typeof raw !== "object") return out;

  const root = raw as Record<string, unknown>;

  // Sources — try several known keys
  const rawSources =
    (root.sources as unknown) ||
    (root.streams as unknown) ||
    (root.videos as unknown) ||
    (root.data as unknown) ||
    [];

  const sourceList: unknown[] = Array.isArray(rawSources)
    ? rawSources
    : typeof rawSources === "object" && rawSources !== null
      ? Object.values(rawSources as Record<string, unknown>)
      : [];

  for (const s of sourceList) {
    if (!s || typeof s !== "object") continue;
    const obj = s as Record<string, unknown>;
    const url =
      (obj.url as string) ||
      (obj.link as string) ||
      (obj.src as string) ||
      (obj.file as string) ||
      "";
    if (!url || typeof url !== "string") continue;
    const quality = String(
      obj.quality || obj.resolution || obj.height || obj.label || "unknown"
    );
    const format = String(obj.format || obj.type || (url.includes(".m3u8") ? "hls" : "mp4")).toLowerCase();
    out.sources.push({ url, quality, format });
  }

  // Subtitles — try several known keys
  const rawSubs =
    (root.subtitles as unknown) ||
    (root.captions as unknown) ||
    (root.tracks as unknown) ||
    (root.subs as unknown) ||
    [];

  const subList: unknown[] = Array.isArray(rawSubs)
    ? rawSubs
    : typeof rawSubs === "object" && rawSubs !== null
      ? Object.values(rawSubs as Record<string, unknown>)
      : [];

  for (const sub of subList) {
    if (!sub || typeof sub !== "object") continue;
    const obj = sub as Record<string, unknown>;
    const url =
      (obj.url as string) ||
      (obj.link as string) ||
      (obj.file as string) ||
      (obj.src as string) ||
      "";
    if (!url || typeof url !== "string") continue;
    const lang = String(obj.lang || obj.language || obj.code || "und");
    const label = String(obj.label || obj.name || obj.title || lang);
    out.subtitles.push({ url, lang, label });
  }

  return out;
}

/**
 * Fetch streams from Vidlink for a movie or TV episode.
 *
 * For TV, season and episode are required.
 */
export async function getVidlinkStreams(
  tmdbId: number,
  type: "movie" | "tv",
  season?: number,
  episode?: number
): Promise<VidlinkStreams> {
  const encrypted = await encryptTmdbId(tmdbId);

  let url: string;
  if (type === "tv") {
    const se = season && season > 0 ? season : 1;
    const ep = episode && episode > 0 ? episode : 1;
    url = `${VIDLINK_API}/tv/${encrypted}?multiLang=1&se=${se}&ep=${ep}`;
  } else {
    url = `${VIDLINK_API}/movie/${encrypted}?multiLang=1`;
  }

  const res = await fetch(url, {
    headers: DEFAULT_HEADERS,
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) {
    throw new Error(`vidlink.pro API failed: ${res.status}`);
  }
  const data = await res.json();
  const streams = normaliseStreams(data);
  if (streams.sources.length === 0) {
    throw new Error("vidlink.pro returned no playable sources");
  }
  return streams;
}
