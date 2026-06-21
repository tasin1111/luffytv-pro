/**
 * Universal HLS Stream Proxy — GET /api/anime/scraper/stream
 *
 * Based on research from warren-bank/node-HLS-Proxy and MHSanaei/HLS-Proxy-Worker.
 *
 * What this does:
 *   1. Fetches the upstream m3u8 manifest / segment / AES key with the correct
 *      Referer + Origin + User-Agent headers (Cloudflare-protected CDNs need all 3)
 *   2. For m3u8 manifests: rewrites ALL internal URLs to route through this proxy:
 *      - #EXT-X-KEY:URI="..." (AES-128 key) ← THE critical one, browser can't fetch with headers
 *      - #EXT-X-MAP:URI="..." (init segment for fMP4)
 *      - #EXT-X-STREAM-INF (sub-playlists)
 *      - #EXT-X-MEDIA (audio/subtitle tracks)
 *      - Bare URI lines (TS segments)
 *   3. For segments/keys: streams raw bytes with correct Content-Type
 *      (forces video/MP2T for TS segments even if upstream returns image/jpeg
 *       — uwucdn disguises TS as .jpg to evade naive filters)
 *   4. Adds permissive CORS headers to every response
 *
 * Query params:
 *   url:        The upstream URL (encoded)
 *   provider:   Site name (miruro, animex, lunar)
 *   subProvider: Inner provider (kiwi, miku, lulu, etc.)
 *   referer:   Per-stream referer override (e.g., https://kwik.cx/ for uwucdn)
 *   type:       "manifest" (default) for m3u8, "segment" for ts/key/mp4
 *
 * Uses Node.js runtime (Edge runtime's fetch adds headers Cloudflare rejects).
 */
import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const DEFAULT_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36";

// Per-provider default headers (when no ?referer= override is given)
const PROVIDER_HEADERS: Record<string, Record<string, string>> = {
  miruro: {
    Referer: "https://www.miruro.tv/",
    Origin: "https://www.miruro.tv",
    "User-Agent": DEFAULT_UA,
  },
  lunar: {
    Referer: "https://lunaranime.ru/",
    Origin: "https://lunaranime.ru",
    "User-Agent": DEFAULT_UA,
  },
  animex: {
    Referer: "https://animex.one/",
    Origin: "https://animex.one",
    "User-Agent": DEFAULT_UA,
  },
  // Animex inner providers
  beep: { "User-Agent": DEFAULT_UA },
  mimi: { Origin: "https://animex.one", Referer: "https://animex.one/", "User-Agent": DEFAULT_UA },
  vee: { Referer: "https://www.animeonsen.xyz/", "User-Agent": DEFAULT_UA },
  yuki: { Referer: "https://megaplay.buzz/", "User-Agent": DEFAULT_UA },
  miku: { Referer: "https://allanime.uns.bio", "User-Agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36" },
  neko: { Referer: "https://animeverse.to/", "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0" },
  huzz: { Origin: "https://kem.clvd.xyz", Referer: "https://kem.clvd.xyz/", "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0" },
  mochi: { Referer: "https://animex.one", "User-Agent": DEFAULT_UA },
  uwu: { Referer: "https://allanime.uns.bio", "User-Agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36" },
  koto: { Referer: "https://allanime.uns.bio", "User-Agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36" },
  kiwi: { Origin: "https://anidb.app", Referer: "https://anidb.app/", "User-Agent": DEFAULT_UA },
  kami: { Origin: "https://animex.one", Referer: "https://animex.one/", "User-Agent": DEFAULT_UA },
};

function buildHeaders(provider: string, subProvider: string | undefined, refererOverride: string | undefined): Record<string, string> {
  if (refererOverride) {
    // Per-stream referer override (e.g., https://kwik.cx/ for uwucdn.top)
    let origin = refererOverride;
    try {
      const u = new URL(refererOverride);
      origin = `${u.protocol}//${u.host}`;
    } catch {}
    return {
      "User-Agent": DEFAULT_UA,
      Referer: refererOverride,
      Origin: origin,
      Accept: "*/*",
      "Accept-Language": "en-US,en;q=0.9",
    };
  }
  // Fallback to per-provider defaults
  if (subProvider && PROVIDER_HEADERS[subProvider]) {
    return { Accept: "*/*", "Accept-Language": "en-US,en;q=0.9", ...PROVIDER_HEADERS[subProvider] };
  }
  if (PROVIDER_HEADERS[provider]) {
    return { Accept: "*/*", "Accept-Language": "en-US,en;q=0.9", ...PROVIDER_HEADERS[provider] };
  }
  return { "User-Agent": DEFAULT_UA, Accept: "*/*", "Accept-Language": "en-US,en;q=0.9" };
}

/** Resolve a (possibly relative) URI against the manifest URL */
function absolutize(uri: string, baseUrl: string): string {
  try {
    if (uri.startsWith("http://") || uri.startsWith("https://")) return uri;
    if (uri.startsWith("//")) return "https:" + uri;
    return new URL(uri, baseUrl).href;
  } catch {
    return uri;
  }
}

/** Build the proxy URL for an internal m3u8 URI (preserves referer across rewrites) */
function buildProxyUrl(
  proxyBase: string,
  upstreamUrl: string,
  type: "manifest" | "segment"
): string {
  return `${proxyBase}&mode=${type}&url=${encodeURIComponent(upstreamUrl)}`;
}

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Credentials": "true",
  "Access-Control-Max-Age": "86400",
};

/**
 * Rewrite all internal URLs in an m3u8 manifest to route through this proxy.
 * Handles: #EXT-X-KEY:URI, #EXT-X-MAP:URI, #EXT-X-STREAM-INF, #EXT-X-MEDIA,
 *          #EXT-X-I-FRAME-STREAM-INF, #EXT-X-PART, #EXT-X-PRELOAD-HINT, and bare URIs.
 */
function rewriteManifest(
  manifestText: string,
  manifestUrl: string,
  proxyBase: string
): string {
  const lines = manifestText.split("\n");
  return lines.map((rawLine) => {
    const line = rawLine.replace(/\s+$/, ""); // trim trailing whitespace

    // Empty line — pass through
    if (!line) return rawLine;

    // Tag line (starts with #)
    if (line.startsWith("#")) {
      // Tags that contain URI="..." attributes — surgically replace just the URI value
      const tagMatch = line.match(/^(#EXT-X-(?:KEY|MAP|SESSION-DATA|PART|PRELOAD-HINT|MEDIA|STREAM-INF|I-FRAME-STREAM-INF)):/i);
      if (tagMatch) {
        // Rewrite URI="..." attribute
        let result = line;
        result = result.replace(/URI="([^"]+)"/g, (_m, uri) => {
          const abs = absolutize(uri, manifestUrl);
          // #EXT-X-KEY and #EXT-X-MAP are segments (binary), sub-playlists are manifests
          const isKeyOrMap = /^#EXT-X-(KEY|MAP)/i.test(line);
          const type = isKeyOrMap ? "segment" : "manifest";
          return `URI="${buildProxyUrl(proxyBase, abs, type)}"`;
        });
        return result;
      }
      return rawLine;
    }

    // Bare URI line (segment after #EXTINF, or sub-playlist after #EXT-X-STREAM-INF)
    // Determine type by URL extension
    const abs = absolutize(line, manifestUrl);
    const isManifest = abs.toLowerCase().endsWith(".m3u8") || abs.toLowerCase().endsWith(".txt");
    const type = isManifest ? "manifest" : "segment";
    return buildProxyUrl(proxyBase, abs, type);
  }).join("\n");
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const targetUrl = url.searchParams.get("url");
  const provider = url.searchParams.get("provider") || "";
  const subProvider = url.searchParams.get("subProvider") || undefined;
  const mode = url.searchParams.get("mode") || "manifest";
  const refererOverride = url.searchParams.get("referer") || undefined;

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (!targetUrl) {
    return new Response(JSON.stringify({ error: "Missing 'url' parameter" }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  }

  const headers = buildHeaders(provider, subProvider, refererOverride);

  // Debug log (server-side only, visible in Vercel function logs)
  console.log(`[StreamProxy] ${mode} provider=${provider} subProvider=${subProvider} referer=${refererOverride || "(default)"} url=${targetUrl.slice(0, 100)}`);
  console.log(`[StreamProxy] headers:`, Object.keys(headers).join(", "));

  // Build the proxy base URL for rewriting (preserves provider + subProvider + referer)
  const proxyBase = `/api/anime/scraper/stream?provider=${encodeURIComponent(provider)}${
    subProvider ? `&subProvider=${encodeURIComponent(subProvider)}` : ""
  }${refererOverride ? `&referer=${encodeURIComponent(refererOverride)}` : ""}`;

  try {
    // Cloudflare blocks Node's fetch/https with TLS fingerprinting (JA3).
    // curl works because it uses OpenSSL's TLS which CF whitelists.
    // Solution: shell out to curl for the upstream fetch.
    const { execFile } = await import("node:child_process");
    const { promisify } = await import("node:util");
    const execFileAsync = promisify(execFile);

    const allHeaders = {
      ...headers,
      "Accept-Encoding": "identity",  // critical — gzip would corrupt TS segments
    };

    // Build curl args
    const curlArgs: string[] = [
      "-s",                   // silent
      "-L",                   // follow redirects
      "--max-time", "30",     // 30s timeout
      "-o", "-",              // output to stdout
      "-w", "\n---HTTP_CODE:%{http_code}\n---CONTENT_TYPE:%{content_type}",  // append status
      "-X", "GET",
    ];
    for (const [k, v] of Object.entries(allHeaders)) {
      curlArgs.push("-H", `${k}: ${v}`);
    }
    curlArgs.push(targetUrl);

    console.log(`[StreamProxy] fetching with curl, headers:`, Object.keys(allHeaders).join(", "));

    let curlResult: Buffer;
    try {
      // Use encoding: 'buffer' to get raw bytes — critical for binary segments/keys
      // (default UTF-8 string conversion corrupts bytes like 0x0A, 0x0D, 0x89, etc.)
      const { stdout } = await execFileAsync("curl", curlArgs, {
        maxBuffer: 100 * 1024 * 1024,  // 100MB max for large segments
        timeout: 35000,
        encoding: "buffer",
      });
      curlResult = stdout as unknown as Buffer;
    } catch (e: any) {
      console.error(`[StreamProxy] curl failed:`, e?.message);
      return new Response(
        JSON.stringify({ error: "Upstream fetch failed", message: e?.message }),
        { status: 502, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
      );
    }

    // Parse curl output: body (binary) + \n---HTTP_CODE:NNN\n---CONTENT_TYPE:xxx
    // The marker is a literal ASCII string, so we can search for it in the buffer
    const marker = Buffer.from("\n---HTTP_CODE:");
    const markerIdx = curlResult.lastIndexOf(marker);
    let bodyBuffer: Buffer;
    let httpCode = 200;
    let upstreamContentType = "";

    if (markerIdx >= 0) {
      // Body is everything before the marker (excluding the leading \n)
      bodyBuffer = curlResult.subarray(0, markerIdx);
      const meta = curlResult.subarray(markerIdx + marker.length).toString("utf-8");
      const codeMatch = meta.match(/^(\d+)/);
      const ctMatch = meta.match(/\n---CONTENT_TYPE:([^\n]*)/);
      if (codeMatch) httpCode = parseInt(codeMatch[1], 10);
      if (ctMatch) upstreamContentType = ctMatch[1].trim();
    } else {
      // Fallback: no marker found, treat entire output as body
      bodyBuffer = curlResult;
    }

    console.log(`[StreamProxy] curl status: ${httpCode}, body size: ${bodyBuffer.length}, content-type: ${upstreamContentType}`);

    if (httpCode !== 200) {
      console.error(`[StreamProxy] upstream ${httpCode} for ${targetUrl.slice(0, 80)}`);
      return new Response(`Upstream ${httpCode}`, {
        status: httpCode,
        headers: { "Content-Type": "text/plain", ...CORS_HEADERS },
      });
    }

    // ─── Determine if this is a manifest ──────────────────────────────────
    // Check: explicit mode=manifest, OR content-type says mpegurl, OR URL ends with .m3u8/.txt
    const isManifest =
      mode === "manifest" &&
      (upstreamContentType.includes("mpegurl") ||
        upstreamContentType.includes("mpeg-url") ||
        targetUrl.toLowerCase().endsWith(".m3u8") ||
        targetUrl.toLowerCase().endsWith(".txt") ||
        upstreamContentType.includes("text/plain"));

    if (isManifest) {
      const manifestText = bodyBuffer.toString("utf-8");
      const rewritten = rewriteManifest(manifestText, targetUrl, proxyBase);
      return new Response(rewritten, {
        status: 200,
        headers: {
          "Content-Type": "application/vnd.apple.mpegurl",
          "Cache-Control": "no-store, no-cache, must-revalidate",
          ...CORS_HEADERS,
        },
      });
    }

    // ─── Segment / Key / MP4 passthrough ──────────────────────────────────
    // Force the correct content-type based on what we're proxying, NOT the
    // upstream content-type. uwucdn returns image/jpeg for TS segments
    // (disguise) — must override to video/MP2T or some players reject.
    let responseContentType = upstreamContentType;
    const lowerUrl = targetUrl.toLowerCase();
    if (lowerUrl.includes(".key") || (mode === "segment" && lowerUrl.includes("/mon.key"))) {
      // AES-128 key — must be application/octet-stream
      responseContentType = "application/octet-stream";
    } else if (lowerUrl.includes(".mp4") || lowerUrl.includes("video.mp4")) {
      // MP4 (animegg returns video.mp4?for=...) — must be video/mp4
      responseContentType = "video/mp4";
    } else if (lowerUrl.includes(".ts") || lowerUrl.includes(".jpg") || lowerUrl.includes(".png")) {
      // TS segments (uwucdn disguises as .jpg/.png) — must be video/MP2T
      responseContentType = "video/MP2T";
    } else if (lowerUrl.includes(".m4s")) {
      responseContentType = "video/mp4";
    } else if (mode === "segment") {
      // Default for unknown segment types — check upstream content-type
      if (upstreamContentType.includes("mp4") || upstreamContentType.includes("video")) {
        responseContentType = "video/mp4";
      } else {
        responseContentType = "video/MP2T";
      }
    }

    // Return raw bytes (segment / key / mp4)
    return new Response(new Uint8Array(bodyBuffer), {
      status: 200,
      headers: {
        "Content-Type": responseContentType,
        "Cache-Control": "public, max-age=3600",
        "Content-Length": String(bodyBuffer.length),
        ...CORS_HEADERS,
      },
    });
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: "Stream proxy error", message: err?.message || String(err) }),
      {
        status: 502,
        headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      }
    );
  }
}
