/**
 * Proxy helper for LuffyTV.
 *
 * Routes external URLs through the Cloudflare Worker at PROXY_BASE.
 * Replaces the old /api/hls-proxy and /api/image-proxy routes.
 *
 * Usage:
 *   import { proxify } from "@/lib/proxy";
 *
 *   fetch(proxify(streamUrl, "m3u8"))   // HLS manifest
 *   <img src={proxify(imgUrl, "image")} />  // image
 *   fetch(proxify(apiUrl, "raw"), { method: "POST", body: ... })  // API
 *
 * If PROXY_BASE is not set, falls back to the legacy /api/* routes
 * (so you can deploy this code before the worker is live).
 */

// ─────────────────────────────────────────────────────────────────────
// PROXY CONFIG
// ─────────────────────────────────────────────────────────────────────
// Primary proxy: upcloud.animanga.fun (third-party, handles Referer + CORS)
//   Format: https://upcloud.animanga.fun/proxy?url={url}&headers={json_headers}
//   The headers JSON specifies Referer/Origin per CDN.
//   Verified working: bd.24stream.xyz, hawk.24stream.xyz, megaplay.buzz
//
// Fallback proxy: our Cloudflare Worker (NEXT_PUBLIC_PROXY_BASE)
//   Used when animanga.fun is down or for hosts it doesn't handle.
//
// Reference: https://github.com/walterwhite-69/Proxify-Streams
// ─────────────────────────────────────────────────────────────────────

const ANIMANGA_PROXY = "https://upcloud.animanga.fun/proxy";
const WORKER_PROXY = process.env.NEXT_PUBLIC_PROXY_BASE || "";

// Hosts that already serve permissive CORS headers — load direct, skip the proxy.
const DIRECT_OK_HOSTS: string[] = [
  // (empty — all anime proxy CDNs need Referer spoofing)
];

// Referer map for CDNs that need specific Referer headers.
// Used when building animanga.fun proxy URLs.
const CDN_REFERERS: Record<string, string> = {
  // 24stream.xyz CDN subdomains
  "bd.24stream.xyz":       "https://animex.one/",
  "hawk.24stream.xyz":     "https://animex.one/",
  "mp4.24stream.xyz":      "https://animex.one/",
  "ply.24stream.xyz":      "https://allanime.uns.bio/",
  // Miruro CDNs
  "hls.anidb.app":         "https://www.miruro.tv/",
  "mt.nekostream.site":    "https://www.miruro.tv/",
  "vault-16.owocdn.top":   "https://www.miruro.tv/",
  "hls.krussdomi.com":     "https://www.miruro.tv/",
  "s1.streamzone1.site":   "https://www.miruro.tv/",
  "cdn.mewstream.buzz":    "https://www.miruro.tv/",
  // MegaPlay (Hindi dub embeds)
  "megaplay.buzz":         "https://anikototv.to/",
  // AniLight quality variants
  "nanobyte.bigdreamsmalldih.site": "https://kwik.cx/",
  // Kwik
  "kwik.cx":               "https://kwik.cx/",
  // AniKage
  "prox.anikage.cc":       "https://anikage.cc/",
  // vibeplayer
  "vibeplayer.site":       "https://megaplay.buzz/",
  // playeng
  "playeng.animeapps.top": "https://animex.one/",
};

function isDirectOk(url: string): boolean {
  try {
    const parsed = new URL(url);
    return DIRECT_OK_HOSTS.some(h => parsed.hostname === h || parsed.hostname.endsWith("." + h));
  } catch { return false; }
}

function getRefererFor(url: string): string {
  try {
    const parsed = new URL(url);
    // Check exact match first, then suffix match
    if (CDN_REFERERS[parsed.hostname]) return CDN_REFERERS[parsed.hostname];
    for (const h of Object.keys(CDN_REFERERS)) {
      if (parsed.hostname.endsWith("." + h)) return CDN_REFERERS[h];
    }
  } catch {}
  return "https://www.miruro.tv/";  // default
}

/**
 * Build an animanga.fun proxy URL with the correct Referer header.
 * Format: https://upcloud.animanga.fun/proxy?url={url}&headers={"Referer":"..."}
 */
function buildAnimangaUrl(url: string): string {
  const referer = getRefererFor(url);
  const headers = JSON.stringify({ Referer: referer });
  return `${ANIMANGA_PROXY}?url=${encodeURIComponent(url)}&headers=${encodeURIComponent(headers)}`;
}

/**
 * SERVER-SIDE helper: wrap any URL through the best available proxy.
 * Prefers animanga.fun (handles Referer + CORS). Falls back to worker.
 */
export function wrapStreamUrl(url: string | null | undefined): string {
  if (!url) return "";
  if (typeof url !== "string") return "";
  if (url.startsWith("/api/") || url.startsWith("/")) return url;
  if (url.startsWith("data:") || url.startsWith("blob:")) return url;
  if (isDirectOk(url)) return url;
  if (url.startsWith(ANIMANGA_PROXY) || url.startsWith(WORKER_PROXY)) return url;
  // Use animanga.fun as primary proxy (handles Referer + CORS)
  return buildAnimangaUrl(url);
}

/**
 * SERVER-SIDE helper: wrap an m3u8 URL through the proxy.
 * Uses animanga.fun (handles m3u8 + segment rewriting).
 */
export function wrapM3u8Url(url: string | null | undefined): string {
  if (!url) return "";
  if (typeof url !== "string") return "";
  if (url.startsWith("/api/") || url.startsWith("/")) return url;
  if (url.startsWith("data:") || url.startsWith("blob:")) return url;
  if (isDirectOk(url)) return url;
  if (url.startsWith(ANIMANGA_PROXY) || url.startsWith(WORKER_PROXY)) return url;
  // Use animanga.fun as primary proxy
  return buildAnimangaUrl(url);
}

// ─────────────────────────────────────────────────────────────────────
// CLIENT-SIDE helpers (used by React components like HLSPlayer)
// These are re-exports for backward compatibility — they use the same
// animanga.fun proxy as the server-side helpers above.
// ─────────────────────────────────────────────────────────────────────

export const PROXY_BASE = ANIMANGA_PROXY;

export type ProxyMode = "auto" | "m3u8" | "image" | "raw";

export function proxify(url: string | null | undefined, mode: ProxyMode = "auto"): string {
  return wrapStreamUrl(url);
}

export const proxifyM3u8  = (url: string) => wrapM3u8Url(url);
export const proxifyImage = (url: string) => wrapStreamUrl(url);
export const proxifyRaw   = (url: string) => wrapStreamUrl(url);
