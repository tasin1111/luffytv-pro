/**
 * Universal stream proxy — GET /api/anime/scraper/stream
 *
 * Query params:
 *   url:        The upstream stream URL (encoded)
 *   provider:   Site name (miruro, animex, lunar)
 *   subProvider: Inner provider (kiwi, miku, lulu, etc.) — used to pick headers
 *   mode:       "manifest" (default) for m3u8/mpd, "segment" for ts/mp4
 *
 * What it does:
 *   1. Looks up required headers for the (provider, subProvider) combo
 *   2. Fetches the upstream URL with those headers server-side
 *   3. For m3u8 manifests: rewrites internal URLs to also route through this proxy
 *   4. For segments/MP4: passes through with the right content type
 *
 * Usage from frontend HLS player:
 *   const streamUrl = `/api/anime/scraper/stream?url=${encodeURIComponent(source.url)}&provider=${source.provider}&subProvider=${source.subProvider}`;
 *   hls.loadSource(streamUrl);
 */
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const DEFAULT_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36";

const MOBILE_UA =
  "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Mobile Safari/537.36";

const FIREFOX_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0";

// Per-provider required headers — mirrors PROVIDER_HEADERS in unified-scraper.ts
const PROVIDER_HEADERS: Record<string, Record<string, string>> = {
  // Miruro (all 12 inner providers use same headers)
  miruro: {
    Referer: "https://www.miruro.tv/",
    Origin: "https://www.miruro.tv",
    "User-Agent": DEFAULT_UA,
  },
  // Lunar (all inner providers use same headers)
  lunar: {
    Referer: "https://lunaranime.ru/",
    Origin: "https://lunaranime.ru",
    "User-Agent": DEFAULT_UA,
  },
  // Animex inner providers — each has different headers
  beep: { "User-Agent": DEFAULT_UA },
  mimi: { Origin: "https://animex.one", Referer: "https://animex.one/", "User-Agent": DEFAULT_UA },
  vee: { Referer: "https://www.animeonsen.xyz/", "User-Agent": DEFAULT_UA },
  yuki: { Referer: "https://megaplay.buzz/", "User-Agent": DEFAULT_UA },
  miku: { Referer: "https://allanime.uns.bio", "User-Agent": MOBILE_UA },
  neko: { Referer: "https://animeverse.to/", "User-Agent": FIREFOX_UA },
  huzz: { Origin: "https://kem.clvd.xyz", Referer: "https://kem.clvd.xyz/", "User-Agent": FIREFOX_UA },
  mochi: { Referer: "https://animex.one", "User-Agent": DEFAULT_UA },
  uwu: { Referer: "https://allanime.uns.bio", "User-Agent": MOBILE_UA },
  koto: { Referer: "https://allanime.uns.bio", "User-Agent": MOBILE_UA },
  kiwi: { Origin: "https://anidb.app", Referer: "https://anidb.app/", "User-Agent": DEFAULT_UA },
  kami: { Origin: "https://animex.one", Referer: "https://animex.one/", "User-Agent": DEFAULT_UA },
};

function getHeaders(provider: string, subProvider?: string): Record<string, string> {
  // Inner provider takes precedence over site-level
  if (subProvider && PROVIDER_HEADERS[subProvider]) {
    return { ...PROVIDER_HEADERS[subProvider] };
  }
  if (PROVIDER_HEADERS[provider]) {
    return { ...PROVIDER_HEADERS[provider] };
  }
  return { "User-Agent": DEFAULT_UA };
}

function absolutize(url: string, baseUrl: string): string {
  try {
    if (url.startsWith("http://") || url.startsWith("https://")) return url;
    if (url.startsWith("//")) return "https:" + url;
    const u = new URL(baseUrl);
    if (url.startsWith("/")) return `${u.origin}${url}`;
    return `${u.origin}${u.pathname.replace(/[^/]*$/, "")}${url}`;
  } catch {
    return url;
  }
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const targetUrl = url.searchParams.get("url");
  const provider = url.searchParams.get("provider") || "";
  const subProvider = url.searchParams.get("subProvider") || undefined;
  const mode = url.searchParams.get("mode") || "manifest";
  // Allow caller to override the Referer header (some Miruro CDNs need kwik.cx referer)
  const refererOverride = url.searchParams.get("referer") || undefined;

  if (!targetUrl) {
    return NextResponse.json({ error: "Missing 'url' parameter" }, { status: 400 });
  }

  // Build headers — per-stream referer override takes priority, then per-provider defaults
  let headers: Record<string, string>;
  if (refererOverride) {
    // Use the caller-provided referer (e.g., https://kwik.cx/ for uwucdn.top)
    headers = { "User-Agent": DEFAULT_UA, Referer: refererOverride };
    try {
      headers["Origin"] = new URL(refererOverride).origin;
    } catch {}
  } else {
    headers = getHeaders(provider, subProvider);
  }

  try {
    const upstream = await fetch(targetUrl, {
      headers,
      cache: "no-store",
      redirect: "follow",
    });

    if (!upstream.ok && upstream.status !== 200) {
      return new NextResponse(`Upstream ${upstream.status}`, {
        status: upstream.status,
        headers: { "Content-Type": "text/plain" },
      });
    }

    const contentType = upstream.headers.get("content-type") || "";
    const isM3U8 =
      mode === "manifest" &&
      (contentType.includes("mpegurl") ||
        targetUrl.includes(".m3u8") ||
        targetUrl.includes(".txt"));

    // ─── HLS Manifest: rewrite URLs to route through proxy ───────────────
    if (isM3U8) {
      const text = await upstream.text();
      const proxyBase = `/api/anime/scraper/stream?provider=${encodeURIComponent(provider)}${
        subProvider ? `&subProvider=${encodeURIComponent(subProvider)}` : ""
      }${refererOverride ? `&referer=${encodeURIComponent(refererOverride)}` : ""}&mode=segment&url=`;

      const rewritten = text
        .split("\n")
        .map((line) => {
          const trimmed = line.replace(/\s+$/, "");
          // Pass through comments and empty lines
          if (!trimmed || trimmed.startsWith("#")) {
            // Rewrite URI= inside #EXT-X-KEY / #EXT-X-MAP tags
            if (trimmed.startsWith("#") && trimmed.includes("URI=\"")) {
              return trimmed.replace(/URI="([^"]+)"/g, (_m, uri) => {
                const abs = absolutize(uri, targetUrl);
                return `URI="${proxyBase}${encodeURIComponent(abs)}"`;
              });
            }
            return line;
          }
          // Rewrite segment URLs
          const abs = absolutize(trimmed, targetUrl);
          return `${proxyBase}${encodeURIComponent(abs)}`;
        })
        .join("\n");

      return new NextResponse(rewritten, {
        status: 200,
        headers: {
          "Content-Type": "application/vnd.apple.mpegurl",
          "Cache-Control": "no-cache, no-store, must-revalidate",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    // ─── Segments / MP4: pass through ─────────────────────────────────────
    const buf = Buffer.from(await upstream.arrayBuffer());
    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type": contentType || "application/octet-stream",
        "Cache-Control": "public, max-age=3600",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Stream proxy error", message: err?.message || String(err) },
      { status: 502 }
    );
  }
}
