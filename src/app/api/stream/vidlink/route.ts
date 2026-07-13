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

    // Wrap each video URL through /api/stream so the browser can play it
    // without CORS issues. Subtitle URLs get the same treatment; the
    // stream proxy auto-converts .srt → .vtt.
    const wrap = (url: string) =>
      `/api/stream?url=${encodeURIComponent(url)}&referer=${encodeURIComponent("https://vidlink.pro/")}`;

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
      { headers: { "Access-Control-Allow-Origin": "*", "Cache-Control": "no-store" } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Vidlink fetch failed";
    return NextResponse.json(
      { error: message },
      { status: 502, headers: { "Access-Control-Allow-Origin": "*" } }
    );
  }
}
