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
// CONFIG — set this after you deploy the worker
// ─────────────────────────────────────────────────────────────────────
// Get this from: Cloudflare dashboard → Workers → your worker → "Preview" or "Triggers" tab
// Format: https://luffytv-proxy.<your-subdomain>.workers.dev
//
// You can also set it via env var (recommended for production):
//   NEXT_PUBLIC_PROXY_BASE=https://luffytv-proxy.abc123.workers.dev
export const PROXY_BASE =
  process.env.NEXT_PUBLIC_PROXY_BASE || "";

export type ProxyMode = "auto" | "m3u8" | "image" | "raw";

/**
 * Wrap an external URL so it goes through the Cloudflare Worker proxy.
 *
 * @param url     upstream URL (https://...)
 * @param mode    "auto" (default) | "m3u8" | "image" | "raw"
 * @returns       proxied URL, or the original URL if it's already internal
 */
export function proxify(url: string | null | undefined, mode: ProxyMode = "auto"): string {
  if (!url) return "";
  if (typeof url !== "string") return "";

  // Already internal — leave alone
  if (url.startsWith("/api/") || url.startsWith("/") || url.startsWith("#")) return url;
  // Already proxied — leave alone
  if (url.startsWith(PROXY_BASE)) return url;
  // Data URI — leave alone
  if (url.startsWith("data:")) return url;
  // Blob URL — leave alone
  if (url.startsWith("blob:")) return url;

  // If PROXY_BASE not configured, fall back to legacy Next.js routes
  if (!PROXY_BASE) {
    if (mode === "m3u8") return `/api/hls-resolve?url=${encodeURIComponent(url)}`;
    if (mode === "image") return `/api/image-proxy?url=${encodeURIComponent(url)}`;
    // auto / raw → use hls-proxy as a generic passthrough (it already does CORS)
    return `/api/hls-proxy?url=${encodeURIComponent(url)}`;
  }

  const path = mode === "auto" ? "/proxy" : `/proxy/${mode}`;
  return `${PROXY_BASE}${path}?url=${encodeURIComponent(url)}`;
}

/**
 * Convenience helpers
 */
export const proxifyM3u8  = (url: string) => proxify(url, "m3u8");
export const proxifyImage = (url: string) => proxify(url, "image");
export const proxifyRaw   = (url: string) => proxify(url, "raw");

/**
 * Strip the proxy wrapper from a URL (useful when storing in DB).
 * Returns the original upstream URL.
 */
export function unproxify(url: string): string {
  if (!url) return "";
  // Match either worker URL or legacy /api/* routes
  const match = url.match(/[?&]url=([^&]+)/);
  if (match) {
    try { return decodeURIComponent(match[1]); } catch { return url; }
  }
  return url;
}

/**
 * SERVER-SIDE helper: wrap any URL through the Cloudflare Worker when
 * NEXT_PUBLIC_PROXY_BASE is set. Returns the URL unchanged if not configured,
 * OR if the URL is already on a CORS-friendly host (cdn.animex.su has CORS *).
 *
 * Use this in API routes / lib files before returning stream URLs to the client.
 *
 * @example
 *   const streamUrl = buildPro24StreamUrl(b64);
 *   return wrapStreamUrl(streamUrl);  // → https://luffytv-proxy.../proxy/raw?url=...
 */
// Hosts that already serve permissive CORS headers — load direct, skip the worker.
// (Wrapping these through the worker just adds ~100ms latency for zero benefit.)
//
// NOTE: cdn.animex.su and pro.24stream.xyz are DEAD (DNS NXDOMAIN as of 2026-06-25).
// Do NOT add them here — they will cause 530 errors in the worker.
const DIRECT_OK_HOSTS: string[] = [
  // (empty — all anime proxy CDNs are either dead or need Referer spoofing)
];

function isDirectOk(url: string): boolean {
  try {
    const parsed = new URL(url);
    return DIRECT_OK_HOSTS.some(h => parsed.hostname === h || parsed.hostname.endsWith("." + h));
  } catch { return false; }
}

export function wrapStreamUrl(url: string | null | undefined): string {
  if (!url) return "";
  if (typeof url !== "string") return "";
  // Already internal or already proxied
  if (url.startsWith("/api/") || url.startsWith("/")) return url;
  if (url.startsWith("data:") || url.startsWith("blob:")) return url;
  // Skip wrapping for CORS-friendly hosts — they work direct in the browser
  if (isDirectOk(url)) return url;
  const base = process.env.NEXT_PUBLIC_PROXY_BASE || "";
  if (!base) return url;
  if (url.startsWith(base)) return url;
  return `${base}/proxy/raw?url=${encodeURIComponent(url)}`;
}

/**
 * SERVER-SIDE helper: wrap an m3u8 URL through the Cloudflare Worker.
 * Use this for HLS manifest URLs so they get URL-rewritten.
 */
export function wrapM3u8Url(url: string | null | undefined): string {
  if (!url) return "";
  if (typeof url !== "string") return "";
  if (url.startsWith("/api/") || url.startsWith("/")) return url;
  if (url.startsWith("data:") || url.startsWith("blob:")) return url;
  // Skip wrapping for CORS-friendly hosts — they handle m3u8 rewriting themselves
  if (isDirectOk(url)) return url;
  const base = process.env.NEXT_PUBLIC_PROXY_BASE || "";
  if (!base) return url;
  if (url.startsWith(base)) return url;
  return `${base}/proxy/m3u8?url=${encodeURIComponent(url)}`;
}
