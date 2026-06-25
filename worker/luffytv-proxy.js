/**
 * ═══════════════════════════════════════════════════════════════════════
 *  LuffyTV Universal Proxy — Cloudflare Worker v2
 *  Self-hosted replacement for upcloud.animanga.fun
 * ═══════════════════════════════════════════════════════════════════════
 *
 *  HOW IT WORKS (same as animanga.fun):
 *
 *  Client sends: GET /proxy?url={stream_url}&headers={"Referer":"https://animex.one/"}
 *  Worker:
 *    1. Parses `url` and `headers` from query params
 *    2. Fetches the upstream URL with those headers
 *    3. If response is m3u8: rewrites segment URLs to /ts-proxy?url=...&headers=...
 *    4. Returns with CORS: * headers
 *
 *  For segments: GET /ts-proxy?url={segment_url}&headers={json}
 *  Worker: fetches segment with headers, returns with CORS
 *
 *  ENDPOINTS:
 *    /proxy?url=...&headers=...    → m3u8 manifests + general fetch (rewrites segments)
 *    /ts-proxy?url=...&headers=... → individual segments (pass-through)
 *    /health                       → health check
 *
 *  USAGE:
 *    const proxyUrl = `https://your-worker.workers.dev/proxy?url=${encodeURIComponent(streamUrl)}&headers=${encodeURIComponent(JSON.stringify({Referer: "https://animex.one/"}))}`;
 *
 *  DEPLOY:
 *    1. Cloudflare dashboard → Workers → Create Worker
 *    2. Paste this code → Save & Deploy
 *    3. Set NEXT_PUBLIC_PROXY_BASE to your worker URL in Vercel env vars
 * ═══════════════════════════════════════════════════════════════════════
 */

const DEFAULT_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";

// ─── MAIN ENTRY ─────────────────────────────────────────────────────────────

export default {
  async fetch(request) {
    const url = new URL(request.url);

    // CORS preflight
    if (request.method === "OPTIONS") {
      return corsResponse(null, 204);
    }

    // Health check
    if (url.pathname === "/health" || url.pathname === "/") {
      return jsonResponse({ ok: true, time: Date.now(), worker: "luffytv-proxy v2" });
    }

    // Route by path
    if (url.pathname === "/proxy" || url.pathname === "/ts-proxy") {
      return handleProxy(request, url);
    }

    return jsonResponse({ error: "Not found", path: url.pathname }, 404);
  },
};

// ─── PROXY HANDLER ──────────────────────────────────────────────────────────

async function handleProxy(request, url) {
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

  // Parse headers from query param (JSON string)
  // Expected: {"Referer":"https://animex.one/","Origin":"https://animex.one"}
  let clientHeaders = {};
  const headersParam = url.searchParams.get("headers");
  if (headersParam) {
    try {
      clientHeaders = JSON.parse(headersParam);
    } catch {
      return jsonResponse({ error: "Invalid headers JSON" }, 400);
    }
  }

  // Build fetch headers — start with defaults, override with client headers
  const fetchHeaders = {
    "User-Agent": DEFAULT_UA,
    "Accept": "*/*",
    "Accept-Language": "en-US,en;q=0.9",
    ...clientHeaders,
  };

  // Forward Range header for video segments (allows seeking)
  const range = request.headers.get("Range");
  if (range) fetchHeaders["Range"] = range;

  try {
    const upstreamResp = await fetch(parsed.href, {
      method: "GET",
      headers: fetchHeaders,
      cf: { cacheTtl: 0, cacheEverything: false },
    });

    // Check if this is an m3u8 playlist
    const contentType = (upstreamResp.headers.get("content-type") || "").toLowerCase();
    const isM3u8 = contentType.includes("mpegurl") ||
                   contentType.includes("m3u8") ||
                   contentType.includes("x-mpegurl") ||
                   /\.m3u8(\?|$)/i.test(parsed.pathname) ||
                   parsed.pathname.endsWith("/master") ||
                   parsed.pathname.endsWith("/index.m3u8") ||
                   parsed.pathname.endsWith("/playlist");

    // Only rewrite if it's /proxy (not /ts-proxy) AND it's actually m3u8
    if (url.pathname === "/proxy" && isM3u8) {
      const text = await upstreamResp.text();
      if (text.trimStart().startsWith("#EXTM3U")) {
        const rewritten = rewriteM3U8(text, parsed.href, headersParam);
        return new Response(rewritten, {
          status: 200,
          headers: corsHeaders({
            "Content-Type": "application/vnd.apple.mpegurl",
            "Cache-Control": "no-store, no-cache, must-revalidate",
          }),
        });
      }
      // Not actually m3u8 — pass through
      return passThrough(text, upstreamResp);
    }

    // Non-m3u8 response — pass through with CORS
    return passThroughBinary(upstreamResp);
  } catch (err) {
    return jsonResponse({
      error: "proxy_failed",
      message: err?.message || String(err),
      upstream: parsed.href,
    }, 502);
  }
}

// ─── M3U8 REWRITER ──────────────────────────────────────────────────────────

/**
 * Rewrite all URLs in an m3u8 playlist to go through /ts-proxy.
 * Each segment URL becomes: /ts-proxy?url={segment_url}&headers={same_headers}
 *
 * The headers are passed through from the parent request so segments
 * get the same Referer/Origin as the manifest.
 */
function rewriteM3U8(content, baseUrl, headersParam) {
  const lines = content.split("\n");
  const out = [];

  let parsedBase;
  try { parsedBase = new URL(baseUrl); } catch { return content; }
  const baseDir = parsedBase.href.substring(0, parsedBase.href.lastIndexOf("/") + 1);
  const baseOrigin = parsedBase.origin;

  // The worker's own origin (for building /ts-proxy URLs)
  // We use relative paths so it works on any domain
  const tsProxyPrefix = "/ts-proxy?url=";

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) { out.push(line); continue; }

    // Comment line — may contain URI="..."
    if (trimmed.startsWith("#")) {
      out.push(rewriteUriAttrs(trimmed, baseDir, baseOrigin, headersParam, tsProxyPrefix));
      continue;
    }

    // URL line — resolve to absolute, then wrap through /ts-proxy
    const abs = resolveUrl(trimmed, baseDir, baseOrigin);
    if (abs) {
      const tsUrl = headersParam
        ? `${tsProxyPrefix}${encodeURIComponent(abs)}&headers=${encodeURIComponent(headersParam)}`
        : `${tsProxyPrefix}${encodeURIComponent(abs)}`;
      out.push(tsUrl);
    } else {
      out.push(line);
    }
  }

  return out.join("\n");
}

function rewriteUriAttrs(line, baseDir, baseOrigin, headersParam, tsProxyPrefix) {
  return line.replace(/URI="([^"]+)"/g, (match, uri) => {
    const abs = resolveUrl(uri, baseDir, baseOrigin);
    if (!abs) return match;
    const tsUrl = headersParam
      ? `${tsProxyPrefix}${encodeURIComponent(abs)}&headers=${encodeURIComponent(headersParam)}`
      : `${tsProxyPrefix}${encodeURIComponent(abs)}`;
    return `URI="${tsUrl}"`;
  });
}

function resolveUrl(input, baseDir, baseOrigin) {
  try {
    if (input.startsWith("http://") || input.startsWith("https://")) return input;
    if (input.startsWith("/")) return baseOrigin + input;
    return baseDir + input;
  } catch { return null; }
}

// ─── RESPONSE HELPERS ───────────────────────────────────────────────────────

async function passThrough(text, upstreamResp) {
  return new Response(text, {
    status: upstreamResp.status,
    headers: corsHeaders({
      "Content-Type": upstreamResp.headers.get("content-type") || "text/plain",
      "Cache-Control": upstreamResp.headers.get("cache-control") || "no-store",
    }),
  });
}

async function passThroughBinary(upstreamResp) {
  const body = await upstreamResp.arrayBuffer();
  return new Response(body, {
    status: upstreamResp.status,
    headers: corsHeaders({
      "Content-Type": upstreamResp.headers.get("content-type") || "application/octet-stream",
      "Cache-Control": upstreamResp.headers.get("cache-control") || "no-store",
      "Accept-Ranges": "bytes",
    }),
  });
}

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
