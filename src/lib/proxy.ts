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
// PROXY CONFIG — Hybrid: our Worker (v3) + animanga.fun fallback
// ─────────────────────────────────────────────────────────────────────
// Our Cloudflare Worker (v3) with browser impersonation headers works for
// MOST CDNs. But a few CDNs (mt.nekostream.site, vibeplayer.site) detect
// Cloudflare Worker TLS fingerprints and block them (403).
//
// For those blocked CDNs, we fall back to upcloud.animanga.fun (which runs
// on a regular server with a different TLS fingerprint).
//
// Worker API: /proxy?url={url}&ref={referer}
// animanga.fun API: /proxy?url={url}&headers={"Referer":"..."}
// ─────────────────────────────────────────────────────────────────────

const WORKER_PROXY = process.env.NEXT_PUBLIC_PROXY_BASE || "";
const ANIMANGA_PROXY = "https://upcloud.animanga.fun/proxy";

// CDNs that block Cloudflare Worker TLS fingerprints — use animanga.fun.
// These CDNs return 403 when fetched from a CF Worker, but 200 from animanga.fun.
const ANIMANGA_ONLY_HOSTS = new Set([
  "mt.nekostream.site",
  "vibeplayer.site",
  "vivibebe.site",
  "nanobyte.bigdreamsmalldih.site",
]);

// Referer map — passed to the worker as the `ref` param.
const CDN_REFERERS: Record<string, string> = {
  // 24stream.xyz
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
  // vibeplayer / vivibebe
  "vibeplayer.site":       "https://vibeplayer.site/",
  "vivibebe.site":         "https://vibeplayer.site/",
  // playeng
  "playeng.animeapps.top": "https://animex.one/",
  // MegaPlay
  "megaplay.buzz":         "https://megaplay.buzz/",
  // AniLight quality variants
  "nanobyte.bigdreamsmalldih.site": "https://kwik.cx/",
  // Kwik
  "kwik.cx":               "https://kwik.cx/",
  // AniKage
  "prox.anikage.cc":       "https://anikage.cc/",
  // allanime
  "allanime.uns.bio":      "https://allanime.uns.bio/",
  // harmonix (miku)
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
 * Build a proxy URL.
 * - For CDNs in ANIMANGA_ONLY_HOSTS: use animanga.fun (different TLS fingerprint)
 * - For everything else: use our Cloudflare Worker (v3 with browser headers)
 */
function buildProxyUrl(url: string): string {
  const referer = getRefererFor(url);
  const encodedUrl = encodeURIComponent(url);

  // Check if this CDN blocks Cloudflare Worker → use animanga.fun
  let hostname = "";
  try { hostname = new URL(url).hostname; } catch {}
  const useAnimanga = ANIMANGA_ONLY_HOSTS.has(hostname);

  if (useAnimanga) {
    const headers = JSON.stringify({ Referer: referer });
    return `${ANIMANGA_PROXY}?url=${encodedUrl}&headers=${encodeURIComponent(headers)}`;
  }

  // Use our worker (v3 with browser impersonation headers)
  if (!WORKER_PROXY) {
    return `/api/hls-proxy?url=${encodedUrl}`;
  }
  return `${WORKER_PROXY}/proxy?url=${encodedUrl}&ref=${encodeURIComponent(referer)}`;
}

/**
 * SERVER-SIDE helper: wrap any URL through our Cloudflare Worker.
 */
export function wrapStreamUrl(url: string | null | undefined): string {
  if (!url) return "";
  if (typeof url !== "string") return "";
  if (url.startsWith("/api/") || url.startsWith("/")) return url;
  if (url.startsWith("data:") || url.startsWith("blob:")) return url;
  if (url.startsWith(WORKER_PROXY)) return url;
  if (url.startsWith("https://upcloud.animanga.fun")) return url;  // don't double-wrap
  return buildProxyUrl(url);
}

/**
 * SERVER-SIDE helper: wrap an m3u8 URL through our Cloudflare Worker.
 * The worker rewrites segment URLs to /p/{base64url} so they also get proxied.
 */
export function wrapM3u8Url(url: string | null | undefined): string {
  if (!url) return "";
  if (typeof url !== "string") return "";
  if (url.startsWith("/api/") || url.startsWith("/")) return url;
  if (url.startsWith("data:") || url.startsWith("blob:")) return url;
  if (url.startsWith(WORKER_PROXY)) return url;
  if (url.startsWith("https://upcloud.animanga.fun")) return url;  // don't double-wrap
  return buildProxyUrl(url);
}

// ─────────────────────────────────────────────────────────────────────
// CLIENT-SIDE helpers (used by React components like HLSPlayer)
// These are re-exports for backward compatibility — they use the same
// animanga.fun proxy as the server-side helpers above.
// ─────────────────────────────────────────────────────────────────────

export const PROXY_BASE = WORKER_PROXY;  // client-side: our worker

export type ProxyMode = "auto" | "m3u8" | "image" | "raw";

export function proxify(url: string | null | undefined, mode: ProxyMode = "auto"): string {
  return wrapStreamUrl(url);
}

// Remove unused isDirectOk (no hosts are direct-OK anymore)
function isDirectOk(url: string): boolean { return false; }

export const proxifyM3u8  = (url: string) => wrapM3u8Url(url);
export const proxifyImage = (url: string) => wrapStreamUrl(url);
export const proxifyRaw   = (url: string) => wrapStreamUrl(url);
