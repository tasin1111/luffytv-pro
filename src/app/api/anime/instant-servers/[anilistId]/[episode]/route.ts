import { NextRequest, NextResponse } from "next/server";
import { resolveAniDbEmbeds } from "@/lib/anidb-direct";
import { resolveAniKotoEmbeds } from "@/lib/anikoto-direct";
import { resolveAniNekoServers } from "@/lib/anineko-direct";
import { resolveAnimexMimiBoth, resolveAnimexProvider } from "@/lib/animex-fast";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 15;

/**
 * GET /api/anime/instant-servers/[anilistId]/[episode]?title={title}
 *
 * Returns INSTANT servers with DIRECT m3u8 URLs (no embeds/iframes).
 * These are scraped m3u8 streams played with hls.js through our worker proxy.
 *
 * PRIORITY ORDER (fastest first):
 *   0. AnimeX mimi (sub) — FASTEST: GraphQL + REST → direct m3u8 from vivibebe.site
 *   1. AniDB (sub) — search + episodes + embed page scrape → m3u8 from hls.anidb.app
 *   2. AnimeX mimi (dub)
 *   3. AniDB (dub)
 *   4+. AniKoto, AniNeko (embed fallbacks)
 *
 * All m3u8 URLs are returned as isM3U8=true for hls.js playback.
 * Embed URLs (AniKoto/AniNeko) are returned as isEmbed=true for iframe playback.
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
    // Resolve all providers in parallel
    const [animexMimi, anidbResult, anikotoResult, aninekoServers] = await Promise.all([
      resolveAnimexMimiBoth(id, epNum),
      resolveAniDbEmbeds(id, epNum, title),
      resolveAniKotoEmbeds(id, epNum, title),
      resolveAniNekoServers(id, epNum, title),
    ]);

    const servers: Array<{
      id: string;
      name: string;
      source: "animex" | "anidb" | "anikoto" | "anineko";
      provider: string;
      type: "sub" | "dub";
      quality: string;
      streamUrl: string;
      isM3U8: boolean;
      isMP4: boolean;
      isEmbed: boolean;
      hardsub: boolean;
      priority: number;
      subtitleTracks?: Array<{ url: string; lang: string; label: string }>;
      intro?: { start: number; end: number } | null;
      outro?: { start: number; end: number } | null;
    }> = [];

    // ── PRIORITY 0: AnimeX mimi (sub) — FASTEST, DEFAULT ──
    // mimi returns m3u8 from vivibebe.site — fast CDN, reliable
    if (animexMimi.sub?.m3u8Url) {
      servers.push({
        id: "animex:mimi:sub",
        name: "AnimeX Mimi",
        source: "animex",
        provider: "mimi",
        type: "sub",
        quality: animexMimi.sub.quality || "1080p",
        streamUrl: animexMimi.sub.m3u8Url,
        isM3U8: true,
        isMP4: false,
        isEmbed: false,
        hardsub: false,
        priority: 0,
        subtitleTracks: animexMimi.sub.tracks,
        intro: animexMimi.sub.intro || null,
        outro: animexMimi.sub.outro || null,
      });
    }

    // ── PRIORITY 1: AniDB (sub) — direct m3u8 from hls.anidb.app ──
    if (anidbResult.sub?.m3u8Url) {
      servers.push({
        id: "anidb:sub",
        name: "AniDB",
        source: "anidb",
        provider: "anidb",
        type: "sub",
        quality: "1080p",
        streamUrl: anidbResult.sub.m3u8Url,
        isM3U8: true,
        isMP4: false,
        isEmbed: false,
        hardsub: false,
        priority: 1,
      });
    }

    // ── PRIORITY 2: AnimeX mimi (dub) ──
    if (animexMimi.dub?.m3u8Url) {
      servers.push({
        id: "animex:mimi:dub",
        name: "AnimeX Mimi (Dub)",
        source: "animex",
        provider: "mimi",
        type: "dub",
        quality: animexMimi.dub.quality || "1080p",
        streamUrl: animexMimi.dub.m3u8Url,
        isM3U8: true,
        isMP4: false,
        isEmbed: false,
        hardsub: false,
        priority: 2,
        subtitleTracks: animexMimi.dub.tracks,
        intro: animexMimi.dub.intro || null,
        outro: animexMimi.dub.outro || null,
      });
    }

    // ── PRIORITY 3: AniDB (dub) ──
    if (anidbResult.dub?.m3u8Url) {
      servers.push({
        id: "anidb:dub",
        name: "AniDB (Dub)",
        source: "anidb",
        provider: "anidb",
        type: "dub",
        quality: "1080p",
        streamUrl: anidbResult.dub.m3u8Url,
        isM3U8: true,
        isMP4: false,
        isEmbed: false,
        hardsub: false,
        priority: 3,
      });
    }

    // ── PRIORITY 4-5: AniKoto (embed fallback) ──
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
        priority: 4,
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
        priority: 5,
      });
    }

    // ── PRIORITY 6+: AniNeko (embed fallbacks) ──
    for (let i = 0; i < Math.min(aninekoServers.length, 3); i++) {
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
        priority: 6 + i,
      });
    }

    console.log(
      `[instant-servers] AniList ${id} ep ${epNum}: ${servers.length} instant servers (mimi:${animexMimi.sub || animexMimi.dub ? "✓" : "✗"} anidb:${anidbResult.sub || anidbResult.dub ? "✓" : "✗"} anikoto:${anikotoResult.sub || anikotoResult.dub ? "✓" : "✗"} anineko:${aninekoServers.length > 0 ? "✓" : "✗"})`,
    );

    return NextResponse.json({ servers });
  } catch (err) {
    console.error("[instant-servers] error:", err);
    return NextResponse.json({ servers: [] });
  }
}
