/**
 * GET /api/anime/anivexa-direct/[anilistId]/[episode]
 *
 * Fetches stream from AniVexa API for animegg, allmanga, or anikoto.
 *
 * Query params:
 *   provider: "animegg" | "allmanga" | "anikoto" (required)
 *   type:     "sub" | "dub" (default: sub)
 *
 * AniVexa API: https://anivexa-api-tawny.vercel.app
 * Routes:
 *   /watch/animegg/{id}/sub|dub/animegg-{ep}   → streams[] with mp4 + referer
 *   /watch/allmanga/{id}/sub|dub/allmanga-{ep}  → sources[] with clock.json URLs (resolve to m3u8)
 *   /watch/anikoto/{id}/sub|dub/anikoto-{ep}    → ssub.streams[] or sdub.streams[] with hls + referer
 */
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const ANIVEXA_API = "https://anivexa-api-tawny.vercel.app";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ anilistId: string; episode: string }> }
) {
  const { anilistId, episode } = await params;
  const id = parseInt(anilistId, 10);
  const epNum = parseInt(episode, 10);
  if (isNaN(id) || id <= 0 || isNaN(epNum) || epNum <= 0) {
    return NextResponse.json({ error: "Invalid params" }, { status: 400 });
  }

  const url = new URL(req.url);
  const provider = url.searchParams.get("provider") || "";
  const type = (url.searchParams.get("type") || "sub") as "sub" | "dub";

  if (!["animegg", "allmanga", "anikoto"].includes(provider)) {
    return NextResponse.json({ error: "Invalid provider. Use: animegg, allmanga, or anikoto" }, { status: 400 });
  }

  try {
    const watchUrl = `${ANIVEXA_API}/watch/${provider}/${id}/${type}/${provider}-${epNum}`;
    console.log(`[AniVexa] fetching: ${watchUrl}`);

    const res = await fetch(watchUrl, { cache: "no-store" });
    if (!res.ok) {
      return NextResponse.json({ error: `AniVexa returned ${res.status}` }, { status: res.status });
    }

    const data = await res.json();

    // ─── Extract stream based on provider ───────────────────────────

    let streamUrl: string | null = null;
    let streamReferer: string = "https://allmanga.to/";
    let quality: string = "auto";
    let isM3U8: boolean = true;
    let isMP4: boolean = false;

    if (provider === "animegg") {
      // Response: { streams: [{ url, type, quality, referer, server, isActive }] }
      const streams = data.streams || [];
      // Find first mp4 or hls stream
      const playable = streams.find((s: any) => s.isActive && s.url && (s.type === "mp4" || s.type === "hls"))
                    || streams.find((s: any) => s.url && (s.type === "mp4" || s.type === "hls"));
      if (playable) {
        streamUrl = playable.url;
        streamReferer = playable.referer || "https://www.animegg.org/";
        quality = playable.quality || "auto";
        isMP4 = playable.type === "mp4";
        isM3U8 = playable.type === "hls" || playable.url.includes(".m3u8");
      }
    }

    else if (provider === "allmanga") {
      // Response: { sources: [{ name, url, type, headers: { Referer, "User-Agent" } }] }
      // URL is a clock.json resolver — need to fetch it to get the actual m3u8
      const sources = data.sources || [];
      // Find first source that's a clock.json (resolvable to HLS)
      const clockSource = sources.find((s: any) => s.url && s.url.includes("clock.json") && s.type === "iframe");
      if (clockSource) {
        const referer = clockSource.headers?.Referer || "https://allmanga.to";
        const ua = clockSource.headers?.["User-Agent"] || "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0";

        // Fetch the clock.json to resolve the actual m3u8 URL
        console.log(`[AniVexa] resolving clock.json: ${clockSource.url.slice(0, 80)}...`);
        const clockRes = await fetch(clockSource.url, {
          headers: { Referer: referer, "User-Agent": ua },
          cache: "no-store",
        });
        if (clockRes.ok) {
          const clockData = await clockRes.json();
          const links = clockData.links || [];
          const hlsLink = links.find((l: any) => l.hls) || links[0];
          if (hlsLink?.link) {
            streamUrl = hlsLink.link;
            streamReferer = referer;
            quality = hlsLink.resolutionStr || "auto";
            isM3U8 = true;
            isMP4 = false;
          }
        }
      }
      // Fallback: try direct sources that aren't clock.json (streamsb, mp4upload, etc.)
      if (!streamUrl) {
        const directSource = sources.find((s: any) => s.url && !s.url.includes("clock.json") && s.type !== "iframe");
        if (directSource) {
          streamUrl = directSource.url;
          streamReferer = directSource.headers?.Referer || "https://allmanga.to";
          isM3U8 = false;
          isMP4 = true;
        }
      }
    }

    else if (provider === "anikoto") {
      // Response: { ssub: { streams: [{ url, type, referer, server, default }] } }
      // For dub: key is sdub
      const key = type === "dub" ? "sdub" : "ssub";
      const streams = data[key]?.streams || [];
      // Find first HLS stream
      const hlsStream = streams.find((s: any) => s.type === "hls" && s.url)
                     || streams.find((s: any) => s.url && !s.type?.includes("embed"));
      if (hlsStream) {
        streamUrl = hlsStream.url;
        streamReferer = hlsStream.referer || "https://megaplay.buzz/";
        quality = "auto";
        isM3U8 = true;
        isMP4 = false;
      }
    }

    if (!streamUrl) {
      return NextResponse.json(
        { error: `No playable stream from ${provider}`, provider, type },
        { status: 404 }
      );
    }

    // ─── Build proxy URL with correct referer ────────────────────────
    const proxyUrl = `/api/anime/scraper/stream?provider=${encodeURIComponent(provider)}&subProvider=${encodeURIComponent(provider)}&referer=${encodeURIComponent(streamReferer)}&mode=manifest&url=${encodeURIComponent(streamUrl)}`;

    return NextResponse.json({
      url: proxyUrl,
      directUrl: streamUrl,
      quality,
      isM3U8,
      isMP4,
      provider: `anivexa:${provider}`,
      sourceType: isMP4 ? "mp4" : "hls",
      streamReferer,
      intro: data.intro || null,
      outro: data.outro || null,
    }, {
      headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "AniVexa fetch failed", message: err?.message || String(err) },
      { status: 500 }
    );
  }
}
