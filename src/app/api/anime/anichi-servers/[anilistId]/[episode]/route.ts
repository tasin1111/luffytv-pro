import { NextRequest, NextResponse } from "next/server";
import { resolveAnichiStreams } from "@/lib/anichi-direct";
import { wrapM3u8Url } from "@/lib/proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * GET /api/anime/anichi-servers/[anilistId]/[episode]?title={title}
 *
 * Dedicated endpoint for Anichi.to servers ONLY.
 * Separate from instant-servers so it doesn't block or get blocked by
 * other providers. The frontend calls this when the anime title is
 * available (Anichi needs the title to search for the anime).
 *
 * Returns direct m3u8 URLs (extracted from embed pages via getSourcesNew API)
 * + subtitle tracks + intro/outro skip times.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ anilistId: string; episode: string }> }
) {
  const { anilistId, episode } = await params;
  const id = parseInt(anilistId, 10);
  const epNum = parseInt(episode, 10);
  const title = _req.nextUrl.searchParams.get("title") || "";

  if (isNaN(id) || id <= 0) {
    return NextResponse.json({ error: "Invalid anilistId" }, { status: 400 });
  }

  try {
    const results = await resolveAnichiStreams(id, epNum, title);

    const servers = results.map((r) => {
      let urlKey = "unknown";
      try {
        const u = new URL(r.streamUrl);
        urlKey = (u.hostname.split(".")[0] + u.pathname + u.search).slice(0, 60);
      } catch {}
      return {
        id: `anichi:${urlKey}:${r.type}${r.hardsub ? ":hsub" : ""}`,
        name: `Anichi ${r.serverName}${r.type === "dub" ? " (Dub)" : r.hardsub ? " (HS)" : ""}`,
        source: "anichi" as const,
        provider: r.serverName.toLowerCase().replace(/\s/g, ""),
        type: r.type,
        quality: r.quality || "1080p",
        streamUrl: wrapM3u8Url(r.streamUrl),
        isM3U8: true,
        isMP4: false,
        isEmbed: false,
        hardsub: r.hardsub,
        priority: 0.5,
        subtitleTracks: [], // subs are wrapped by instant-servers' wrapSubs — but this is a separate route, so we wrap here
        intro: r.intro || null,
        outro: r.outro || null,
      };
    });

    // Wrap subtitle URLs through the subtitle worker
    const SUBS_WORKER = process.env.NEXT_PUBLIC_SUBS_PROXY_BASE || "";
    const wrappedServers = servers.map((s) => {
      const tracks = results.find((r) => r.serverName === s.provider)?.subtitleTracks || [];
      const wrappedTracks = tracks.length > 0
        ? tracks
            .filter((t) => {
              const u = (t.url || "").toLowerCase().split("?")[0];
              if (u.endsWith(".ass")) return false;
              return true;
            })
            .map((t) => {
              const url = (t.url || "").replace(/^https?:\/\/\/+/i, "https://");
              const ref = getRefererForSubtitle(url);
              if (SUBS_WORKER) {
                return {
                  url: `${SUBS_WORKER}/sub?url=${encodeURIComponent(url)}&ref=${encodeURIComponent(ref)}`,
                  lang: t.lang || "en",
                  label: t.label || "English",
                };
              }
              return {
                url: `/api/stream?url=${encodeURIComponent(url)}&referer=${encodeURIComponent(ref)}`,
                lang: t.lang || "en",
                label: t.label || "English",
              };
            })
        : [];
      return { ...s, subtitleTracks: wrappedTracks };
    });

    console.log(`[Anichi-Servers] ${anilistId} ep${epNum}: ${wrappedServers.length} servers`);

    return NextResponse.json({
      anilistId: id,
      episode: epNum,
      servers: wrappedServers,
      total: wrappedServers.length,
    }, {
      headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" },
    });
  } catch (e: any) {
    console.error(`[Anichi-Servers] failed for ${anilistId} ep${epNum}:`, e?.message || e);
    return NextResponse.json({
      servers: [],
      total: 0,
      error: e?.message || "Failed",
    });
  }
}

function getRefererForSubtitle(url: string): string {
  try {
    const hostname = new URL(url).hostname;
    if (hostname.includes("nekostream")) return "https://vidtube.site/";
    if (hostname.includes("anizara")) return "https://anineko.to/";
    if (hostname.includes("vivibebe")) return "https://vivibebe.site/";
    return "https://vidtube.site/";
  } catch {
    return "https://vidtube.site/";
  }
}
