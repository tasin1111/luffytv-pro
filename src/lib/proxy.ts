/**
 * Proxy helper for LuffyTV.
 *
 * Uses pro.aniwatchtv.site as the universal proxy for ALL anime streams.
 * This proxy handles Referer spoofing, CORS, and m3u8 segment rewriting.
 *
 * Encoding: XOR(url + "\0" + referer, key) → base64url → /uwu/{token}
 * Key: "10b06cdc1ca48c9fb0b94af97cc040cf" (32 ASCII bytes)
 *
 * The proxy returns m3u8 with segment URLs rewritten to /uwu/{token}
 * (relative paths) — so segments go through the same proxy automatically.
 */

// ─────────────────────────────────────────────────────────────────────
// PROXY CONFIG — pro.aniwatchtv.site
// ─────────────────────────────────────────────────────────────────────
const ANIWATCHTV_PROXY = "https://pro.aniwatchtv.site/uwu";
const XOR_KEY = "10b06cdc1ca48c9fb0b94af97cc040cf"; // 32 ASCII bytes

// Worker proxy (v3 with browser impersonation headers)
const WORKER_PROXY = process.env.NEXT_PUBLIC_PROXY_BASE || "";

// CDNs that work better through our worker (aniwatchtv returns 403 for these)
const WORKER_PREFERRED_HOSTS = new Set([
  "hls.anidb.app",      // Miruro Pewe — worker 200, aniwatchtv 403
]);

// CDNs that aniwatchtv can't handle → use animanga.fun fallback
const ANIMANGA_FALLBACK_HOSTS = new Set([
  "mt.nekostream.site",          // Miruro Bee — both 403, but animanga 200
  "vibeplayer.site",             // Miruro Bonk — both 403
  "vivibebe.site",               // mimi provider
  "nanobyte.bigdreamsmalldih.site", // AniLight
  "vault-16.owocdn.top",         // Miruro Kiwi
  "vault-01.uwucdn.top",         // uwu provider
  "cdn.mewstream.buzz",          // yuki provider
  "playeng.animeapps.top",       // beep provider
  "185.237.107.144",             // Miruro Ally (raw IP) — try animanga
  "185.237.106.76",              // Miruro Ally alt (raw IP)
]);

// Referer map — encoded into the token so the proxy sends the correct Referer.
const CDN_REFERERS: Record<string, string> = {
  // 24stream.xyz — animex.one referer
  "bd.24stream.xyz":       "https://animex.one/",
  "hawk.24stream.xyz":     "https://animex.one/",
  "mp4.24stream.xyz":      "https://animex.one/",
  "ply.24stream.xyz":      "https://allanime.uns.bio/",
  // Miruro CDNs
  "hls.anidb.app":         "https://www.miruro.tv/",
  "mt.nekostream.site":    "https://www.miruro.tv/",
  "vault-16.owocdn.top":   "https://kwik.cx/",
  "vault-01.uwucdn.top":   "https://kwik.cx/",
  "hls.krussdomi.com":     "https://krussdomi.com/",
  "s1.streamzone1.site":   "https://megaplay.buzz/",
  "cdn.mewstream.buzz":    "https://megaplay.buzz/",
  // vibeplayer / vivibebe — same-origin referer
  "vibeplayer.site":       "https://vibeplayer.site/",
  "vivibebe.site":         "https://vivibebe.site/",
  // playeng — same-origin referer (CRITICAL: 403 without it)
  "playeng.animeapps.top": "https://playeng.animeapps.top/",
  // MegaPlay
  "megaplay.buzz":         "https://megaplay.buzz/",
  // AniLight quality variants
  "nanobyte.bigdreamsmalldih.site": "https://kwik.cx/",
  // Kwik — same-origin
  "kwik.cx":               "https://kwik.cx/",
  // AniKage
  "prox.anikage.cc":       "https://anikage.cc/",
  // allanime — same-origin
  "allanime.uns.bio":      "https://allanime.uns.bio/",
  // harmonix (miku) — allanime referer
  "soq6.harmonixwellnessgroup.store": "https://allanime.uns.bio/",
};

// Worker proxy (kept for API calls that need CF challenge bypass, NOT for streams)
const WORKER_PROXY = process.env.NEXT_PUBLIC_PROXY_BASE || "";

function getRefererFor(url: string): string {
  try {
    const parsed = new URL(url);
    if (CDN_REFERERS[parsed.hostname]) return CDN_REFERERS[parsed.hostname];
    for (const h of Object.keys(CDN_REFERERS)) {
      if (parsed.hostname.endsWith("." + h)) return CDN_REFERERS[h];
    }
  } catch {}
  return "https://www.miruro.tv/"; // default
}

/**
 * XOR encode + base64url encode for aniwatchtv proxy token.
 * Format: XOR(url + "\0" + referer, key) → base64url
 */
function encodeAniwatchtvToken(url: string, referer: string): string {
  const combined = url + "\0" + referer;
  const keyBytes = new TextEncoder().encode(XOR_KEY);
  const dataBytes = new TextEncoder().encode(combined);
  const xored = new Uint8Array(dataBytes.length);
  for (let i = 0; i < dataBytes.length; i++) {
    xored[i] = dataBytes[i] ^ keyBytes[i % keyBytes.length];
  }
  // Convert to base64url
  let binary = "";
  for (let i = 0; i < xored.length; i++) binary += String.fromCharCode(xored[i]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Build a proxy URL using the best proxy for the CDN:
 * 1. Worker-preferred CDNs → our Cloudflare Worker (v3 with browser headers)
 * 2. Animanga-fallback CDNs → upcloud.animanga.fun (different TLS fingerprint)
 * 3. Everything else → aniwatchtv proxy (pro.aniwatchtv.site)
 */
function buildProxyUrl(url: string): string {
  const referer = getRefererFor(url);

  let hostname = "";
  try { hostname = new URL(url).hostname; } catch {}

  // 1. Worker-preferred CDNs (hls.anidb.app etc.)
  if (WORKER_PROXY && WORKER_PREFERRED_HOSTS.has(hostname)) {
    return `${WORKER_PROXY}/proxy?url=${encodeURIComponent(url)}&ref=${encodeURIComponent(referer)}`;
  }

  // 2. Animanga-fallback CDNs (vibeplayer, mt.nekostream, raw IPs, etc.)
  if (ANIMANGA_FALLBACK_HOSTS.has(hostname)) {
    const headers = JSON.stringify({ Referer: referer });
    return `https://upcloud.animanga.fun/proxy?url=${encodeURIComponent(url)}&headers=${encodeURIComponent(headers)}`;
  }

  // 3. Default: aniwatchtv proxy
  const token = encodeAniwatchtvToken(url, referer);
  return `${ANIWATCHTV_PROXY}/${token}`;
}

/**
 * SERVER-SIDE helper: wrap any URL through aniwatchtv proxy.
 */
export function wrapStreamUrl(url: string | null | undefined): string {
  if (!url) return "";
  if (typeof url !== "string") return "";
  if (url.startsWith("/api/") || url.startsWith("/")) return url;
  if (url.startsWith("data:") || url.startsWith("blob:")) return url;
  if (url.startsWith(ANIWATCHTV_PROXY)) return url; // already wrapped
  return buildProxyUrl(url);
}

/**
 * SERVER-SIDE helper: wrap an m3u8 URL through aniwatchtv proxy.
 * The proxy rewrites segment URLs to /uwu/{token} (relative) automatically.
 */
export function wrapM3u8Url(url: string | null | undefined): string {
  if (!url) return "";
  if (typeof url !== "string") return "";
  if (url.startsWith("/api/") || url.startsWith("/")) return url;
  if (url.startsWith("data:") || url.startsWith("blob:")) return url;
  if (url.startsWith(ANIWATCHTV_PROXY)) return url; // already wrapped
  return buildProxyUrl(url);
}

// ─────────────────────────────────────────────────────────────────────
// CLIENT-SIDE helpers (used by React components like HLSPlayer)
// ─────────────────────────────────────────────────────────────────────

export const PROXY_BASE = ANIWATCHTV_PROXY;

export type ProxyMode = "auto" | "m3u8" | "image" | "raw";

export function proxify(url: string | null | undefined, mode: ProxyMode = "auto"): string {
  return wrapStreamUrl(url);
}

export const proxifyM3u8  = (url: string) => wrapM3u8Url(url);
export const proxifyImage = (url: string) => wrapStreamUrl(url);
export const proxifyRaw   = (url: string) => wrapStreamUrl(url);

/**
 * Wrap a URL through our Cloudflare Worker (for API calls, NOT streams).
 * Used by anixtv-api.ts, anilight-api.ts, anistream-api.ts to bypass
 * Cloudflare bot detection on API endpoints.
 */
export function workerWrap(url: string): string {
  if (!WORKER_PROXY) return url;
  return `${WORKER_PROXY}/proxy?url=${encodeURIComponent(url)}`;
}

/**
 * Wrap an m3u8 URL through the proxy WITH a custom referer.
 * Use this when the source API (e.g., Miruro) provides the correct Referer.
 * Falls back to getRefererFor() if no custom referer provided.
 */
export function wrapM3u8UrlWithReferer(url: string | null | undefined, customReferer?: string): string {
  if (!url) return "";
  if (typeof url !== "string") return "";
  if (url.startsWith("/api/") || url.startsWith("/")) return url;
  if (url.startsWith("data:") || url.startsWith("blob:")) return url;
  if (url.startsWith(ANIWATCHTV_PROXY)) return url;

  const referer = customReferer || getRefererFor(url);
  let hostname = "";
  try { hostname = new URL(url).hostname; } catch {}

  // 1. Worker-preferred CDNs
  if (WORKER_PROXY && WORKER_PREFERRED_HOSTS.has(hostname)) {
    return `${WORKER_PROXY}/proxy?url=${encodeURIComponent(url)}&ref=${encodeURIComponent(referer)}`;
  }

  // 2. Animanga-fallback CDNs
  if (ANIMANGA_FALLBACK_HOSTS.has(hostname)) {
    const headers = JSON.stringify({ Referer: referer });
    return `https://upcloud.animanga.fun/proxy?url=${encodeURIComponent(url)}&headers=${encodeURIComponent(headers)}`;
  }

  // 3. Default: aniwatchtv proxy with the CUSTOM referer
  const token = encodeAniwatchtvToken(url, referer);
  return `${ANIWATCHTV_PROXY}/${token}`;
}
