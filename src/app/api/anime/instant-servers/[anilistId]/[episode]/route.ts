import { NextRequest, NextResponse } from "next/server";
import { resolveAniDbEmbeds } from "@/lib/anidb-direct";
import { resolveAniKotoEmbeds } from "@/lib/anikoto-direct";
import { resolveAniNekoServers } from "@/lib/anineko-direct";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 15;

/**
 * GET /api/anime/instant-servers/[anilistId]/[episode]?title={title}
 *
 * Returns INSTANT servers from AniDB, AniKoto, and AniNeko — the 3
 * reliable providers that don't dead-link. These are resolved in parallel
 * and returned as pre-verified embed URLs for immediate iframe playback.
 *
 * AniDB is the DEFAULT (priority 0) — it's the fastest and most reliable.
 * AniKoto and AniNeko are fallbacks.
 *
 * All 3 are cached server-side for 1 hour per anime.
 */
export async function GET(
  _req: NextRequest,
  {
    params,
  }: { params: Promise<{ anilistId: string; episode: string }> },
) {
  const { anilistId, episode } = await params;
  const id = parseInt(anilistId, 10);
  const epNum = parseInt(episode, 10);
  const title = _req.nextUrl.searchParams.get("title") || "";

  if (isNaN(id) || id <= 0) {
    return NextResponse.json({ error: "Invalid anilistId" }, { status: 400 });
  }

  try {
    // Resolve all 3 providers in parallel
    const [anidbResult, anikotoResult, aninekoServers] = await Promise.all([
      resolveAniDbEmbeds(id, epNum, title),
      resolveAniKotoEmbeds(id, epNum, title),
      resolveAniNekoServers(id, epNum, title),
    ]);

    const servers: Array<{
      id: string;
      name: string;
      source: "anidb" | "anikoto" | "anineko";
      provider: string;
      type: "sub" | "dub";
      quality: string;
      streamUrl: string;
      isM3U8: boolean;
      isMP4: boolean;
      isEmbed: boolean;
      hardsub: boolean;
      priority: number;
    }> = [];

    // ── AniDB (PRIORITY 0 — default) ──
    // AniDB embeds contain a JW Player with direct HLS from hls.anidb.app.
    // These are the most reliable — no dead links, fast CDN.
    if (anidbResult.sub?.embedUrl) {
      servers.push({
        id: "anidb:sub",
        name: "AniDB",
        source: "anidb",
        provider: "anidb",
        type: "sub",
        quality: "1080p",
        streamUrl: anidbResult.sub.embedUrl,
        isM3U8: false,
        isMP4: false,
        isEmbed: true,
        hardsub: false,
        priority: 0,
      });
    }
    if (anidbResult.dub?.embedUrl) {
      servers.push({
        id: "anidb:dub",
        name: "AniDB (Dub)",
        source: "anidb",
        provider: "anidb",
        type: "dub",
        quality: "1080p",
        streamUrl: anidbResult.dub.embedUrl,
        isM3U8: false,
        isMP4: false,
        isEmbed: true,
        hardsub: false,
        priority: 1,
      });
    }

    // ── AniKoto (PRIORITY 2-3) ──
    // AniKoto uses megaplay.buzz embeds — reliable, multi-server.
    if (anikotoResult.sub?.embedUrl) {
      servers.push({
        id: "anikoto:sub",
        name: "AniKoto",
        source: "anikoto",
        provider: "anikoto",
        type: "sub",
        quality: "1080p",
        streamUrl: anikotoResult.sub.embedUrl,
        isM3U8: false,
        isMP4: false,
        isEmbed: true,
        hardsub: false,
        priority: 2,
      });
    }
    if (anikotoResult.dub?.embedUrl) {
      servers.push({
        id: "anikoto:dub",
        name: "AniKoto (Dub)",
        source: "anikoto",
        provider: "anikoto",
        type: "dub",
        quality: "1080p",
        streamUrl: anikotoResult.dub.embedUrl,
        isM3U8: false,
        isMP4: false,
        isEmbed: true,
        hardsub: false,
        priority: 3,
      });
    }

    // ── AniNeko (PRIORITY 4+) ──
    // AniNeko has multiple servers (vivibebe, otakuhg, otakuvid, playmogo).
    // Add the default server first, then alternatives.
    for (let i = 0; i < Math.min(aninekoServers.length, 4); i++) {
      const srv = aninekoServers[i];
      servers.push({
        id: `anineko:${i}`,
        name: srv.name,
        source: "anineko",
        provider: "anineko",
        type: "sub",
        quality: "1080p",
        streamUrl: srv.url,
        isM3U8: false,
        isMP4: false,
        isEmbed: true,
        hardsub: false,
        priority: 4 + i,
      });
    }

    console.log(
      `[instant-servers] AniList ${id} ep ${epNum}: ${servers.length} instant servers (AniDB:${anidbResult.sub || anidbResult.dub ? "✓" : "✗"} AniKoto:${anikotoResult.sub || anikotoResult.dub ? "✓" : "✗"} AniNeko:${aninekoServers.length > 0 ? "✓" : "✗"})`,
    );

    return NextResponse.json({ servers });
  } catch (err) {
    console.error("[instant-servers] error:", err);
    return NextResponse.json({ servers: [] });
  }
}
