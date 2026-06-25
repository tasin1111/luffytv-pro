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
// PROXY CONFIG — SELF-HOSTED Cloudflare Worker
// ─────────────────────────────────────────────────────────────────────
// Our own worker at NEXT_PUBLIC_PROXY_BASE replaces upcloud.animanga.fun.
// Same API format: /proxy?url={url}&headers={json}
//
// The worker:
//   1. Fetches upstream URL with the headers we specify (Referer, Origin)
//   2. For m3u8: rewrites segment URLs to /ts-proxy?url=...&headers=...
//   3. Returns with CORS: * headers
//
// No third-party dependency — we control it 100%.
// ─────────────────────────────────────────────────────────────────────

const WORKER_PROXY = process.env.NEXT_PUBLIC_PROXY_BASE || "";

// Referer map for CDNs that need specific Referer headers.
const CDN_REFERERS: Record<string, string> = {
  // 24stream.xyz CDN subdomains
  "bd.24stream.xyz":       "https://animex.one/",
  "hawk.24stream.xyz":     "https://animex.one/",
  "mp4.24stream.xyz":      "https://animex.one/",
  "ply.24stream.xyz":      "https://allanime.uns.bio/",
  // Miruro CDNs — need megaplay.buzz Referer (NOT miruro.tv!)
  "hls.anidb.app":         "https://www.miruro.tv/",
  "mt.nekostream.site":    "https://www.miruro.tv/",
  "vault-16.owocdn.top":   "https://megaplay.buzz/",
  "vault-01.uwucdn.top":   "https://megaplay.buzz/",
  "hls.krussdomi.com":     "https://www.miruro.tv/",
  "s1.streamzone1.site":   "https://megaplay.buzz/",
  "cdn.mewstream.buzz":    "https://www.miruro.tv/",
  // vibeplayer / vivibebe (same site, different domain)
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

// CDNs that our worker CAN'T fetch (return 403) — use animanga.fun instead.
// These CDNs block Cloudflare Worker IPs or need special TLS fingerprint.
const ANIMANGA_ONLY_HOSTS = new Set([
  "vault-16.owocdn.top",
  "vault-01.uwucdn.top",
  "mt.nekostream.site",
  "vibeplayer.site",
  "vivibebe.site",
  "nanobyte.bigdreamsmalldih.site",
  "cdn.mewstream.buzz",
  "s1.streamzone1.site",
]);

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
 * Build a proxy URL for OUR Cloudflare Worker with the correct Referer header.
 * For CDNs that block our worker (ANIMANGA_ONLY_HOSTS), use animanga.fun instead.
 */
function buildProxyUrl(url: string): string {
  const referer = getRefererFor(url);
  const headers = JSON.stringify({ Referer: referer });
  const encodedUrl = encodeURIComponent(url);
  const encodedHeaders = encodeURIComponent(headers);

  // Check if this CDN is blocked on our worker — use animanga.fun
  let hostname = "";
  try { hostname = new URL(url).hostname; } catch {}

  const useAnimanga = ANIMANGA_ONLY_HOSTS.has(hostname) ||
                      ANIMANGA_ONLY_HOSTS.has(hostname.replace(/^[^.]+\./, ""));

  if (useAnimanga) {
    return `https://upcloud.animanga.fun/proxy?url=${encodedUrl}&headers=${encodedHeaders}`;
  }

  // Use our worker for everything else
  if (!WORKER_PROXY) {
    return `/api/hls-proxy?url=${encodedUrl}`;
  }
  return `${WORKER_PROXY}/proxy?url=${encodedUrl}&headers=${encodedHeaders}`;
}

/**
 * SERVER-SIDE helper: wrap any URL through our Cloudflare Worker.
 * The worker adds the correct Referer (from CDN_REFERERS map) + CORS headers.
 */
export function wrapStreamUrl(url: string | null | undefined): string {
  if (!url) return "";
  if (typeof url !== "string") return "";
  if (url.startsWith("/api/") || url.startsWith("/")) return url;
  if (url.startsWith("data:") || url.startsWith("blob:")) return url;
  if (url.startsWith(WORKER_PROXY)) return url;
  return buildProxyUrl(url);
}

/**
 * SERVER-SIDE helper: wrap an m3u8 URL through our Cloudflare Worker.
 * The worker rewrites segment URLs to /ts-proxy so they also get proxied.
 */
export function wrapM3u8Url(url: string | null | undefined): string {
  if (!url) return "";
  if (typeof url !== "string") return "";
  if (url.startsWith("/api/") || url.startsWith("/")) return url;
  if (url.startsWith("data:") || url.startsWith("blob:")) return url;
  if (url.startsWith(WORKER_PROXY)) return url;
  return buildProxyUrl(url);
}

// ─────────────────────────────────────────────────────────────────────
// CLIENT-SIDE helpers (used by React components like HLSPlayer)
// These are re-exports for backward compatibility — they use the same
// animanga.fun proxy as the server-side helpers above.
// ─────────────────────────────────────────────────────────────────────

export const PROXY_BASE = WORKER_PROXY;

export type ProxyMode = "auto" | "m3u8" | "image" | "raw";

export function proxify(url: string | null | undefined, mode: ProxyMode = "auto"): string {
  return wrapStreamUrl(url);
}

// Remove unused isDirectOk (no hosts are direct-OK anymore)
function isDirectOk(url: string): boolean { return false; }

export const proxifyM3u8  = (url: string) => wrapM3u8Url(url);
export const proxifyImage = (url: string) => wrapStreamUrl(url);
export const proxifyRaw   = (url: string) => wrapStreamUrl(url);
