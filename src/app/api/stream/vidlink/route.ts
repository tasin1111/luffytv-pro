import { NextRequest, NextResponse } from "next/server";
import { getVidlinkStreams } from "@/lib/vidlink-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/stream/vidlink?tmdbId=X&type=movie|tv&season=Y&episode=Z
//
// Returns Vidlink direct streams for the given TMDB ID.
// The video URLs returned here should be routed through /api/stream?url=...
// for CORS-free playback in the browser (and to set the correct Referer).
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tmdbIdRaw = searchParams.get("tmdbId");
    const type = (searchParams.get("type") || "movie") as "movie" | "tv";
    const season = searchParams.get("season");
    const episode = searchParams.get("episode");

    if (!tmdbIdRaw) {
      return NextResponse.json(
        { error: "tmdbId parameter required" },
        { status: 400, headers: { "Access-Control-Allow-Origin": "*" } }
      );
    }

    const tmdbId = parseInt(tmdbIdRaw, 10);
    if (Number.isNaN(tmdbId)) {
      return NextResponse.json(
        { error: "tmdbId must be a number" },
        { status: 400, headers: { "Access-Control-Allow-Origin": "*" } }
      );
    }

    if (type !== "movie" && type !== "tv") {
      return NextResponse.json(
        { error: "type must be 'movie' or 'tv'" },
        { status: 400, headers: { "Access-Control-Allow-Origin": "*" } }
      );
    }

    const se = season ? parseInt(season, 10) : undefined;
    const ep = episode ? parseInt(episode, 10) : undefined;

    const streams = await getVidlinkStreams(tmdbId, type, se, ep);

    // Vidlink stream URLs require Referer: https://vidlink.pro/ — the CDN
    // (stormvv.vodvidl.site) returns 403 without it. The browser can't set
    // a custom Referer, so we MUST proxy.
    //
    // We use the Cloudflare Worker proxy (/p/{token}) which XOR-encodes the
    // URL + referer into a base64 token — avoids query param encoding issues
    // that break with Vercel's edge network (the MP4 URLs contain ? and &
    // which get mangled by Vercel's query param parsing).
    const WORKER_BASE = process.env.NEXT_PUBLIC_PROXY_BASE || "https://luffytv-proxy.ggy892767.workers.dev";
    const XOR_KEY = "10b06cdc1ca48c9fb0b94af97cc040cf";

    function encodeWorkerToken(url: string, referer: string): string {
      // XOR encode: url + "\0" + referer
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
      const b64 = Buffer.from(binary, "binary").toString("base64");
      return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    }

    const wrap = (url: string) =>
      `${WORKER_BASE}/p/${encodeWorkerToken(url, "https://vidlink.pro/")}`;

    return NextResponse.json(
      {
        source: "vidlink",
        sources: streams.sources.map((s) => ({
          ...s,
          proxyUrl: wrap(s.url),
        })),
        subtitles: streams.subtitles.map((sub) => ({
          ...sub,
          proxyUrl: wrap(sub.url),
        })),
      },
      { headers: { "Access-Control-Allow-Origin": "*", "Cache-Control": "no-store, no-cache, must-revalidate" } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Vidlink fetch failed";
    return NextResponse.json(
      { error: message },
      { status: 502, headers: { "Access-Control-Allow-Origin": "*" } }
    );
  }
}
