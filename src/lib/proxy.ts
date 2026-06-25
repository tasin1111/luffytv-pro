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
// PROXY CONFIG — upcloud.animanga.fun (third-party, handles everything)
// ─────────────────────────────────────────────────────────────────────
// ALL anime stream URLs go through upcloud.animanga.fun.
// Our Cloudflare Worker is NOT used for anime streams anymore — it was
// returning 403/522 on many CDNs (vault-16.owocdn.top, mt.nekostream.site,
// vibeplayer.site, cdn.mewstream.buzz, s1.streamzone1.site, etc.)
//
// animanga.fun handles:
//   - Referer spoofing (we pass the correct Referer per CDN)
//   - CORS headers
//   - m3u8 rewriting (segments → /ts-proxy)
//   - Works for ALL CDNs (no 403 issues)
// ─────────────────────────────────────────────────────────────────────

const ANIMANGA_PROXY = "https://upcloud.animanga.fun/proxy";
const WORKER_PROXY = process.env.NEXT_PUBLIC_PROXY_BASE || "";  // kept for non-anime use (live sports)

// Referer map for CDNs that need specific Referer headers.
const CDN_REFERERS: Record<string, string> = {
  // 24stream.xyz CDN subdomains
  "bd.24stream.xyz":       "https://animex.one/",
  "hawk.24stream.xyz":     "https://animex.one/",
  "mp4.24stream.xyz":      "https://animex.one/",
  "ply.24stream.xyz":      "https://allanime.uns.bio/",
  // Miruro CDNs
  "hls.anidb.app":         "https://www.miruro.tv/",
  "mt.nekostream.site":    "https://www.miruro.tv/",
  "vault-16.owocdn.top":   "https://megaplay.buzz/",
  "vault-01.uwucdn.top":   "https://megaplay.buzz/",
  "hls.krussdomi.com":     "https://www.miruro.tv/",
  "s1.streamzone1.site":   "https://megaplay.buzz/",
  "cdn.mewstream.buzz":    "https://www.miruro.tv/",
  // vibeplayer / vivibebe
  "vibeplayer.site":       "https://megaplay.buzz/",
  "vivibebe.site":         "https://megaplay.buzz/",
  // playeng
  "playeng.animeapps.top": "https://animex.one/",
  // MegaPlay
  "megaplay.buzz":         "https://anikototv.to/",
  // AniLight quality variants
  "nanobyte.bigdreamsmalldih.site": "https://kwik.cx/",
  // Kwik
  "kwik.cx":               "https://kwik.cx/",
  // AniKage
  "prox.anikage.cc":       "https://anikage.cc/",
  // allanime
  "allanime.uns.bio":      "https://allanime.uns.bio/",
  // harmonix (miku provider)
  "soq6.harmonixwellnessgroup.store": "https://allanime.uns.bio/",
};

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
 * ALL anime streams go through this — no worker, no double-proxy.
 */
function buildProxyUrl(url: string): string {
  const referer = getRefererFor(url);
  const headers = JSON.stringify({ Referer: referer });
  return `${ANIMANGA_PROXY}?url=${encodeURIComponent(url)}&headers=${encodeURIComponent(headers)}`;
}

/**
 * SERVER-SIDE helper: wrap any URL through animanga.fun proxy.
 */
export function wrapStreamUrl(url: string | null | undefined): string {
  if (!url) return "";
  if (typeof url !== "string") return "";
  if (url.startsWith("/api/") || url.startsWith("/")) return url;
  if (url.startsWith("data:") || url.startsWith("blob:")) return url;
  // Already proxied? Don't double-wrap
  if (url.startsWith(ANIMANGA_PROXY)) return url;
  if (url.startsWith(WORKER_PROXY)) return url;
  return buildProxyUrl(url);
}

/**
 * SERVER-SIDE helper: wrap an m3u8 URL through animanga.fun proxy.
 */
export function wrapM3u8Url(url: string | null | undefined): string {
  if (!url) return "";
  if (typeof url !== "string") return "";
  if (url.startsWith("/api/") || url.startsWith("/")) return url;
  if (url.startsWith("data:") || url.startsWith("blob:")) return url;
  // Already proxied? Don't double-wrap
  if (url.startsWith(ANIMANGA_PROXY)) return url;
  if (url.startsWith(WORKER_PROXY)) return url;
  return buildProxyUrl(url);
}

// ─────────────────────────────────────────────────────────────────────
// CLIENT-SIDE helpers (used by React components like HLSPlayer)
// These are re-exports for backward compatibility — they use the same
// animanga.fun proxy as the server-side helpers above.
// ─────────────────────────────────────────────────────────────────────

export const PROXY_BASE = ANIMANGA_PROXY;  // client-side: animanga.fun

export type ProxyMode = "auto" | "m3u8" | "image" | "raw";

export function proxify(url: string | null | undefined, mode: ProxyMode = "auto"): string {
  return wrapStreamUrl(url);
}

// Remove unused isDirectOk (no hosts are direct-OK anymore)
function isDirectOk(url: string): boolean { return false; }

export const proxifyM3u8  = (url: string) => wrapM3u8Url(url);
export const proxifyImage = (url: string) => wrapStreamUrl(url);
export const proxifyRaw   = (url: string) => wrapStreamUrl(url);
