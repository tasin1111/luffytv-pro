/**
 * GET /api/anime/scraper/miruro-direct/[anilistId]/[episode]
 *
 * One-shot endpoint: scrapes www.miruro.tv/api/secure/pipe DIRECTLY (no
 * dependency on the user's deployed miruro-api.vercel.app), finds the first
 * playable m3u8 across all 12 providers, returns it ready to feed into the
 * HLS player.
 *
 * Query params:
 *   type: "sub" | "dub" (default: sub)
 *
 * Returns:
 *   {
 *     url: "/api/anime/scraper/stream?provider=miruro&subProvider=kiwi&mode=manifest&url=...",
 *     quality: "1080p",
 *     isM3U8: true,
 *     provider: "kiwi",
 *     subtitles: [...],
 *     intro: {...}, outro: {...},
 *     triedProviders: ["kiwi", "bee", ...]
 *   }
 *
 * The URL is already wrapped to go through the universal stream proxy
 * (needed because Miruro's CDN sets CORS to https://www.miruro.tv only).
 */
import { NextRequest, NextResponse } from "next/server";
import { getPlayableSource } from "@/lib/miruro-direct";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ anilistId: string; episode: string }> }
) {
  const { anilistId, episode } = await params;
  const id = parseInt(anilistId, 10);
  const epNum = parseInt(episode, 10);
  if (isNaN(id) || id <= 0) {
    return NextResponse.json({ error: "Invalid anilistId" }, { status: 400 });
  }
  if (isNaN(epNum) || epNum <= 0) {
    return NextResponse.json({ error: "Invalid episode" }, { status: 400 });
  }

  const url = new URL(req.url);
  const category = (url.searchParams.get("type") || "sub") as "sub" | "dub";

  try {
    const result = await getPlayableSource(id, epNum, category);
    if (!result) {
      return NextResponse.json(
        {
          error: "No playable source found",
          triedProviders: [],
          anilistId: id,
          episode: epNum,
          category,
        },
        { status: 404 }
      );
    }

    // Wrap the URL through the universal stream proxy so the browser
    // can play it (Miruro's CDN has CORS restricted + requires per-stream Referer)
    // We pass the streamReferer as a query param — the proxy uses it instead of
    // the default miruro.tv referer.
    const streamReferer = result.streamReferer || "";
    const proxyUrl = `/api/anime/scraper/stream?provider=miruro&subProvider=${encodeURIComponent(result.provider)}&mode=manifest&url=${encodeURIComponent(result.url)}${streamReferer ? `&referer=${encodeURIComponent(streamReferer)}` : ""}`;

    return NextResponse.json({
      url: proxyUrl,
      directUrl: result.url,    // unwrapped, for debugging
      quality: result.quality,
      isM3U8: result.isM3U8,
      provider: result.provider,
      subtitles: result.subtitles,
      intro: result.intro,
      outro: result.outro,
      triedProviders: result.triedProviders,
      sourceType: result.isM3U8 ? "hls" : "mp4",
      streamReferer,            // exposed for debugging
    }, {
      headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Miruro direct scrape failed", message: err?.message || String(err) },
      { status: 500 }
    );
  }
}
