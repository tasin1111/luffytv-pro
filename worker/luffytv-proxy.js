/**
 * ═══════════════════════════════════════════════════════════════════════
 *  LuffyTV Universal Proxy — Cloudflare Worker
 *  Single file. Replaces /api/hls-proxy + /api/image-proxy + adds API proxy.
 * ═══════════════════════════════════════════════════════════════════════
 *
 *  ENDPOINTS (all GET, all take ?url=<encoded upstream url>):
 *
 *    /proxy?url=...          → auto-detect (m3u8 / image / json / binary)
 *    /proxy/m3u8?url=...     → force m3u8 (rewrite URLs, no cache)
 *    /proxy/image?url=...    → force image (cache 1h at edge)
 *    /proxy/raw?url=...      → pass-through (no rewriting, no cache)
 *    /proxy/health           → health check
 *
 *  KEY BEHAVIORS:
 *    • m3u8 manifests: URLs inside are rewritten to route sub-playlists and
 *      segments back through THIS worker (so the browser never hits CORS).
 *    • Images: cached at Cloudflare edge for 1 hour (Cache API).
 *    • Live m3u8: NEVER cached (always fresh).
 *    • Referer/Origin auto-set based on upstream host (see REFERER_MAP).
 *    • Full CORS: GET + OPTIONS, all origins, all headers.
 *
 *  DEPLOY:
 *    1. Cloudflare dashboard → Workers & Pages → Create Worker
 *    2. Paste this file → Save & Deploy
 *    3. (optional) Bind a custom domain via Workers → Triggers → Custom Domains
 *
 *  USAGE FROM FRONTEND:
 *    const PROXY = "https://luffytv-proxy.<your-subdomain>.workers.dev";
 *    fetch(`${PROXY}/proxy?url=${encodeURIComponent(upstreamUrl)}`);
 * ═══════════════════════════════════════════════════════════════════════
 */

// ─────────────────────────────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────────────────────────────

/**
 * Map upstream hostname → the Referer/Origin the upstream expects.
 * Streams from these hosts usually 403 without the right Referer.
 * Add new hosts here as you discover them.
 */
const REFERER_MAP = {
  // Anime streaming CDNs
  "www.miruro.tv":         "https://www.miruro.tv/",
  "miruro.tv":             "https://www.miruro.tv/",
  "allanime.uns.bio":      "https://allanime.uns.bio/",
  "allmanga.to":           "https://allmanga.to/",
  "animex.one":            "https://animex.one/",
  "animeverse.to":         "https://animeverse.to/",
  "www.animeonsen.xyz":    "https://www.animeonsen.xyz/",
  "animeonsen.xyz":        "https://www.animeonsen.xyz/",
  "kem.clvd.xyz":          "https://kem.clvd.xyz/",
  "anidb.app":             "https://anidb.app/",
  "megaplay.buzz":         "https://megaplay.buzz/",
  "vibeplayer.site":       "https://vibeplayer.site/",
  "kwik.cx":               "https://kwik.cx/",
  // AniLight API (Cloudflare-protected — needs Referer: https://anilight.live/)
  "api.anilight.live":     "https://anilight.live/",
  // 24stream.xyz CDN subdomains — need Referer from their parent site
  "bd.24stream.xyz":       "https://animex.one/",
  "hawk.24stream.xyz":     "https://animex.one/",
  "mp4.24stream.xyz":      "https://animex.one/",
  "ply.24stream.xyz":      "https://allanime.uns.bio/",
  // nanobyte CDN — AniLight quality variants
  "nanobyte.bigdreamsmalldih.site": "https://kwik.cx/",
  // AniKage proxy — Cloudflare-protected, needs Origin: https://anikage.cc
  "prox.anikage.cc":         "https://anikage.cc/",
  "anikage.cc":              "https://anikage.cc/",
  // Miruro CDN hosts — need Referer: https://www.miruro.tv/
  "hls.anidb.app":           "https://www.miruro.tv/",
  "mt.nekostream.site":      "https://www.miruro.tv/",
  "vault-16.owocdn.top":     "https://www.miruro.tv/",
  "hls.krussdomi.com":       "https://www.miruro.tv/",
  "s1.streamzone1.site":     "https://www.miruro.tv/",
  "cdn.mewstream.buzz":      "https://www.miruro.tv/",
  // MegaPlay (Hindi dub embeds) — needs Referer from anikototv
  "megaplay.buzz":           "https://anikototv.to/",
  "www.animegg.org":       "https://www.animegg.org/",
  "youtu-chan.com":        "https://youtu-chan.com/",
  "gogoanime3.co":         "https://gogoanime3.co/",
  "gogocdn.net":           "https://gogoanime3.co/",
  // Live sports/TV
  "dami-tv.pro":           "https://dami-tv.pro/",
  "dlhd.pk":               "https://dlhd.pk/",
  "daddylive.mp":          "https://daddylive.mp/",
  "thedaddy.to":           "https://thedaddy.to/",
  "api.watchfooty.st":     "https://api.watchfooty.st/",
  "streamed.pk":           "https://streamed.pk/",
  "sportsembed.su":        "https://sportsembed.su/",
  "api.vipstreamed.live":  "https://api.vipstreamed.live/",
  "api.ppv.to":            "https://api.ppv.to/",
  "api.cdnlivetv.tv":      "https://api.cdnlivetv.tv/",
  "cdnlivetv.tv":          "https://cdnlivetv.tv/",
  "pro.24stream.xyz":      "https://pro.24stream.xyz/",
  "cdn.animex.su":         "https://cdn.animex.su/",
  // Default fallback UA
};

const DEFAULT_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";

// Hosts we ALWAYS proxy (segments + sub-playlists) — they have CORS issues.
// Hosts NOT in this list (e.g. rotrimpalkis.shop) are left direct in m3u8.
const ALWAYS_PROXY_HOSTS = new Set([
  "dami-tv.pro",
  "dlhd.pk",
  "daddylive.mp",
  "thedaddy.to",
  "api.watchfooty.st",
  "streamed.pk",
  "sportsembed.su",
  "api.vipstreamed.live",
  "api.ppv.to",
  "api.cdnlivetv.tv",
  "cdnlivetv.tv",
  "allanime.uns.bio",
  "animex.one",
  "animeverse.to",
  "kem.clvd.xyz",
  "anidb.app",
  "megaplay.buzz",
  "vibeplayer.site",
  "kwik.cx",
  "www.animegg.org",
  "youtu-chan.com",
  // AniLight API — Cloudflare-protected, must be proxied through the worker
  // (the worker runs on Cloudflare's network → bypasses the CF challenge)
  "api.anilight.live",
  "anilight.live",
  // 24stream.xyz CDN subdomains — need Referer spoofing (403 without it).
  // These serve the actual video segments for animex/anidap/anilight streams.
  // NOTE: cdn.animex.su + pro.24stream.xyz + wave.24stream.xyz + wv.24stream.xyz
  // are DEAD (DNS NXDOMAIN as of 2026-06-25). Do NOT add them.
  "bd.24stream.xyz",
  "hawk.24stream.xyz",
  "mp4.24stream.xyz",
  "ply.24stream.xyz",
  // nanobyte CDN — AniLight quality variants (1080p/720p/360p)
  "nanobyte.bigdreamsmalldih.site",
  // AniKage proxy — Cloudflare-protected, must route through worker
  "prox.anikage.cc",
  "anikage.cc",
  // Miruro CDN hosts — need Referer spoofing
  "hls.anidb.app",
  "mt.nekostream.site",
  "vault-16.owocdn.top",
  "hls.krussdomi.com",
  "s1.streamzone1.site",
  "cdn.mewstream.buzz",
  "nekostream.site",
  "owocdn.top",
  "streamzone1.site",
  "mewstream.buzz",
  "krussdomi.com",
  // MegaPlay (Hindi dub embeds)
  "megaplay.buzz",
]);

// Cache instance (only available in Worker runtime, not in tests)
const CACHE = (typeof caches !== "undefined") ? caches.default : null;

// ─────────────────────────────────────────────────────────────────────
// MAIN ENTRY
// ─────────────────────────────────────────────────────────────────────

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // ── CORS preflight ──
    if (request.method === "OPTIONS") {
      return corsResponse(null, 204);
    }

    // ── Health check ──
    if (url.pathname === "/proxy/health" || url.pathname === "/") {
      return jsonResponse({ ok: true, time: Date.now(), worker: "luffytv-proxy v1" });
    }

    // ── Route by path ──
    let mode = "auto";     // auto | m3u8 | image | raw
    if (url.pathname === "/proxy/m3u8")  mode = "m3u8";
    else if (url.pathname === "/proxy/image") mode = "image";
    else if (url.pathname === "/proxy/raw")   mode = "raw";
    else if (url.pathname === "/proxy" || url.pathname === "/proxy/auto") mode = "auto";
    else {
      return jsonResponse({ error: "Not found", path: url.pathname }, 404);
    }

    const upstream = url.searchParams.get("url");
    if (!upstream) {
      return jsonResponse({ error: "Missing ?url= param" }, 400);
    }

    let parsed;
    try {
      parsed = new URL(upstream);
    } catch {
      return jsonResponse({ error: "Invalid url param" }, 400);
    }
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return jsonResponse({ error: "Blocked scheme" }, 403);
    }

    try {
      // ── IMAGE mode (cached) ──
      if (mode === "image") {
        return await handleImage(request, parsed, ctx);
      }

      // ── RAW mode (no rewrite, no cache) ──
      if (mode === "raw") {
        return await handleRaw(parsed);
      }

      // ── AUTO mode: fetch, then decide based on content ──
      // We do NOT cache in auto mode because we don't know if it's m3u8 yet.
      const upstreamResp = await fetchUpstream(parsed, request);
      const ct = (upstreamResp.headers.get("content-type") || "").toLowerCase();

      // Detect m3u8 by content-type OR by URL extension
      const isM3u8ByType = ct.includes("mpegurl") || ct.includes("m3u8") || ct.includes("x-mpegurl");
      const isM3u8ByUrl  = /\.m3u8(\?|$)/i.test(parsed.pathname);

      if (mode === "m3u8" || isM3u8ByType || isM3u8ByUrl) {
        return await handleM3u8(upstreamResp, parsed);
      }

      // If it's an image, route to image handler (so we can cache)
      if (ct.startsWith("image/")) {
        // We already consumed the fetch — re-wrap it
        return await handleImageFromResponse(upstreamResp, parsed, ctx);
      }

      // Otherwise: pass through as raw with CORS
      return await passThrough(upstreamResp);
    } catch (err) {
      return jsonResponse({
        error: "proxy_failed",
        message: err?.message || String(err),
        upstream: parsed.href,
      }, 502);
    }
  },
};

// ─────────────────────────────────────────────────────────────────────
// HANDLERS
// ─────────────────────────────────────────────────────────────────────

/**
 * Fetch upstream with the right Referer/Origin/User-Agent.
 * Always no-store on the Worker→origin hop (we manage caching ourselves).
 */
async function fetchUpstream(parsed, request) {
  const headers = buildUpstreamHeaders(parsed, request);
  return fetch(parsed.href, {
    method: "GET",
    headers,
    cf: { cacheTtl: 0, cacheEverything: false },
  });
}

function buildUpstreamHeaders(parsed, request) {
  const origin = REFERER_MAP[parsed.hostname] ||
                 Object.keys(REFERER_MAP).find(h => parsed.hostname.endsWith("." + h)) &&
                 REFERER_MAP[Object.keys(REFERER_MAP).find(h => parsed.hostname.endsWith("." + h))] ||
                 parsed.origin + "/";

  const h = {
    "User-Agent": DEFAULT_UA,
    "Accept": "*/*",
    "Accept-Language": "en-US,en;q=0.9",
    "Referer": origin,
    "Origin": origin.replace(/\/$/, ""),
  };

  // Forward Range header for video segments (allows seeking)
  const range = request?.headers?.get("Range");
  if (range) h["Range"] = range;

  return h;
}

/**
 * Handle m3u8 manifest: rewrite all URLs to route through this worker.
 * NEVER cache.
 */
async function handleM3u8(upstreamResp, parsedUrl) {
  const text = await upstreamResp.text();

  // Sanity: confirm it's actually m3u8
  if (!text.trimStart().startsWith("#EXTM3U")) {
    // Not actually m3u8 — pass through
    return new Response(text, {
      status: upstreamResp.status,
      headers: corsHeaders({
        "Content-Type": upstreamResp.headers.get("content-type") || "text/plain",
        "Cache-Control": "no-store",
      }),
    });
  }

  const workerOrigin = parsedUrl.protocol + "//" + parsedUrl.host;  // this is actually the worker's own origin
  // NOTE: parsedUrl here is the WORKER url, not the upstream — but we need the WORKER origin.
  // We get that from the request, which we passed in. Let's reconstruct below.
  // Actually parsedUrl here is the upstream URL passed in. We need to use the worker's own origin.
  // We'll resolve this by using a relative path "/proxy?url=..." which the browser resolves correctly.

  const rewritten = rewriteM3U8(text, parsedUrl.href);

  return new Response(rewritten, {
    status: 200,
    headers: corsHeaders({
      "Content-Type": "application/vnd.apple.mpegurl",
      // ABSOLUTELY NO CACHING — live playlists must be fresh
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      "Pragma": "no-cache",
      "Expires": "0",
    }),
  });
}

/**
 * Rewrite m3u8 content: every URL line + every URI="..." attribute
 * becomes /proxy?url=<encoded>. Direct-CORS hosts stay direct.
 */
function rewriteM3U8(content, baseUrl) {
  const lines = content.split("\n");
  const out = [];

  let parsedBase;
  try { parsedBase = new URL(baseUrl); } catch { return content; }
  const baseDir = parsedBase.href.substring(0, parsedBase.href.lastIndexOf("/") + 1);
  const baseOrigin = parsedBase.origin;

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed) { out.push(line); continue; }

    // Comment line — may contain URI="..."
    if (trimmed.startsWith("#")) {
      out.push(rewriteUriAttrs(trimmed, baseDir, baseOrigin));
      continue;
    }

    // URL line
    const abs = resolveUrl(trimmed, baseDir, baseOrigin);
    if (!abs) { out.push(line); continue; }

    if (shouldProxyHost(new URL(abs).hostname)) {
      out.push(`/proxy?url=${encodeURIComponent(abs)}`);
    } else {
      out.push(abs);  // direct — this host has CORS
    }
  }

  return out.join("\n");
}

function rewriteUriAttrs(line, baseDir, baseOrigin) {
  return line.replace(/URI="([^"]+)"/g, (match, uri) => {
    const abs = resolveUrl(uri, baseDir, baseOrigin);
    if (!abs) return match;
    if (shouldProxyHost(new URL(abs).hostname)) {
      return `URI="/proxy?url=${encodeURIComponent(abs)}"`;
    }
    return `URI="${abs}"`;
  });
}

function resolveUrl(input, baseDir, baseOrigin) {
  try {
    if (input.startsWith("http://") || input.startsWith("https://")) return input;
    if (input.startsWith("/")) return baseOrigin + input;
    return baseDir + input;
  } catch { return null; }
}

function shouldProxyHost(hostname) {
  if (ALWAYS_PROXY_HOSTS.has(hostname)) return true;
  for (const h of ALWAYS_PROXY_HOSTS) {
    if (hostname.endsWith("." + h)) return true;
  }
  return false;
}

/**
 * Handle image: cache at Cloudflare edge for 1 hour.
 */
async function handleImage(request, parsed, ctx) {
  // Check edge cache first
  const cacheKey = new Request(new URL("/img:" + btoa(parsed.href), request.url).href, { method: "GET" });
  if (CACHE) {
    const cached = await CACHE.match(cacheKey);
    if (cached) return cached;
  }

  const upstreamResp = await fetchUpstream(parsed, request);
  return handleImageFromResponse(upstreamResp, parsed, ctx, cacheKey);
}

async function handleImageFromResponse(upstreamResp, parsed, ctx, cacheKey) {
  // 404 → return 1x1 transparent PNG (prevents broken image icon)
  if (upstreamResp.status === 404) {
    return transparentPngResponse();
  }
  if (!upstreamResp.ok) {
    return new Response("Upstream error " + upstreamResp.status, {
      status: upstreamResp.status,
      headers: corsHeaders({ "Content-Type": "text/plain" }),
    });
  }

  const contentType = upstreamResp.headers.get("content-type") || "image/webp";
  const body = await upstreamResp.arrayBuffer();

  const resp = new Response(body, {
    status: 200,
    headers: corsHeaders({
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=3600, s-maxage=86400, immutable",
      "X-Content-Type-Options": "nosniff",
      "X-Proxy-Source": parsed.hostname,
    }),
  });

  // Store in edge cache (1h)
  if (CACHE && cacheKey) {
    try {
      ctx.waitUntil(CACHE.put(cacheKey, resp.clone()));
    } catch {}
  }

  return resp;
}

/**
 * Raw pass-through (no rewriting, no cache, just CORS).
 * Used for arbitrary JSON APIs (AniList GraphQL, consumet, etc.)
 */
async function handleRaw(parsed) {
  const upstreamResp = await fetchUpstream(parsed);
  return passThrough(upstreamResp);
}

async function passThrough(upstreamResp) {
  const body = await upstreamResp.arrayBuffer();
  return new Response(body, {
    status: upstreamResp.status,
    headers: corsHeaders({
      "Content-Type": upstreamResp.headers.get("content-type") || "application/octet-stream",
      "Cache-Control": upstreamResp.headers.get("cache-control") || "no-store",
    }),
  });
}

// ─────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────

function corsHeaders(extra = {}) {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "*",
    "Access-Control-Max-Age": "86400",
    ...extra,
  };
}

function corsResponse(body, status = 200) {
  return new Response(body, { status, headers: corsHeaders() });
}

function jsonResponse(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: corsHeaders({ "Content-Type": "application/json" }),
  });
}

function transparentPngResponse() {
  // 1x1 transparent PNG — smallest valid PNG
  const bytes = new Uint8Array([
    0x89,0x50,0x4E,0x47,0x0D,0x0A,0x1A,0x0A,0x00,0x00,0x00,0x0D,0x49,0x48,0x44,0x52,
    0x00,0x00,0x00,0x01,0x00,0x00,0x00,0x01,0x08,0x06,0x00,0x00,0x00,0x1F,0x15,0xC4,
    0x89,0x00,0x00,0x00,0x0D,0x49,0x44,0x41,0x54,0x78,0x9C,0x63,0x00,0x01,0x00,0x00,
    0x05,0x00,0x01,0x0D,0x0A,0x2D,0xB4,0x00,0x00,0x00,0x00,0x49,0x45,0x4E,0x44,0xAE,
    0x42,0x60,0x82,
  ]);
  return new Response(bytes, {
    status: 200,
    headers: corsHeaders({
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=300",
      "X-Content-Type-Options": "nosniff",
    }),
  });
}
