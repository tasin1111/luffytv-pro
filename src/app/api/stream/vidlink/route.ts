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

    // Vidlink streams have time-limited tokens that expire after ~1 hour.
    // Do NOT cache the response — always fetch fresh URLs.
    // Vidlink flags include "cors-allowed" — the MP4 URLs can be played
    // directly by the browser without a proxy. We still provide proxyUrl
    // as a fallback in case CORS fails for some users.

    return NextResponse.json(
      {
        source: "vidlink",
        sources: streams.sources.map((s) => ({
          ...s,
          // Use the direct URL — Vidlink streams are CORS-allowed
          // (no proxyUrl needed, but we include it as fallback)
          proxyUrl: s.url,
        })),
        subtitles: streams.subtitles.map((sub) => ({
          ...sub,
          // Subtitle URLs need proxying (CORS + SRT→VTT conversion)
          proxyUrl: `/api/stream?url=${encodeURIComponent(sub.url)}&referer=${encodeURIComponent("https://vidlink.pro/")}`,
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
