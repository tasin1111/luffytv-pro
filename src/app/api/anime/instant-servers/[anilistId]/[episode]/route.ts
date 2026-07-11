import { NextRequest, NextResponse } from "next/server";
import { resolveAniDbEmbeds } from "@/lib/anidb-direct";
import { resolveAniNekoServers } from "@/lib/anineko-direct";
import { resolveAnimexMimiBoth } from "@/lib/animex-fast";
import { resolveAniDapId, getAniDapSources } from "@/lib/anidap-api";
import { resolveAniKageBoth } from "@/lib/anikage-fast";
import { wrapM3u8Url } from "@/lib/proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 15;

/**
 * GET /api/anime/instant-servers/[anilistId]/[episode]?title={title}
 *
 * Returns INSTANT servers with DIRECT m3u8 URLs (no embeds/iframes for top priority).
 *
 * PRIORITY ORDER (user-specified):
 *   0. AnimeX mimi (sub) — FASTEST: GraphQL + REST → direct m3u8 from vivibebe.site
 *   1. AniDB (sub) — scraped m3u8 from hls.anidb.app
 *   2. AnimeX mimi (dub)
 *   3. AniDB (dub)
 *   4. AniNeko (sub) — embed fallbacks (vivibebe, otakuhg, etc.)
 *   5. AniDap beep (sub) — direct m3u8 from playeng.animeapps.top
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
    // Resolve all providers in parallel — INCLUDING AniDap sources
    // (the old code had a sequential AniDap fetch AFTER Promise.all which
    // blocked the entire response by 2-3 seconds)
    const anidapId = await resolveAniDapId(id).catch(() => null);
    const [animexMimi, anidbResult, aninekoServers, anidapSub, anikageResult] = await Promise.all([
      resolveAnimexMimiBoth(id, epNum),
      resolveAniDbEmbeds(id, epNum, title),
      resolveAniNekoServers(id, epNum, title),
      // Fetch AniDap beep sources IN PARALLEL (not sequentially after)
      anidapId
        ? getAniDapSources(anidapId, epNum, "sub", "beep").catch(() => null)
        : Promise.resolve(null),
      // AniKage — provides sources + intro/outro for NEW and OLD anime
      resolveAniKageBoth(id, epNum, title).catch(() => ({ sub: null, dub: null, intro: null, outro: null })),
    ]);

    const servers: Array<{
      id: string;
      name: string;
      source: "animex" | "anidb" | "anineko" | "anidap" | "anikage";
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

    // ── PRIORITY 4: AniNeko (embed fallbacks) ──
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

    // ── AniKage: intro/outro ONLY (no playable servers) ──
    // AniKage's source URLs are ENCRYPTED tokens that need client-side
    // JavaScript decryption (prox.anicore.tv/m3u8/{token} returns 403
    // without the decryption). The embeds (ninstream.com) also return 403
    // from server-side. So we can't add AniKage as playable servers.
    //
    // BUT — AniKage provides intro/outro skip times for ALL anime (new and old).
    // We apply these PERMANENTLY to every other server in the list.
    // The skip times are timestamps, not stream-dependent — they work
    // no matter which provider the user selects.
    if (anikageResult.intro || anikageResult.outro) {
      for (const s of servers) {
        if (!s.intro && anikageResult.intro) s.intro = anikageResult.intro;
        if (!s.outro && anikageResult.outro) s.outro = anikageResult.outro;
      }
      console.log(`[instant-servers] AniKage skip times applied: intro=${JSON.stringify(anikageResult.intro)} outro=${JSON.stringify(anikageResult.outro)}`);
    }

    // ── PRIORITY 10+: AniDap beep (direct m3u8) ──
    // Already fetched in parallel above — just extract the m3u8 URL
    if (anidapSub?.sources?.length) {
      const src = anidapSub.sources.find((s: any) =>
        s.url?.includes(".m3u8") || s.type?.includes("mpegurl")
      );
      if (src?.url) {
        const proxiedUrl = wrapM3u8Url(src.url);
        servers.push({
          id: "anidap:beep:sub",
          name: "AniDap Beep",
          source: "anidap",
          provider: "beep",
          type: "sub",
          quality: src.quality || "1080p",
          streamUrl: proxiedUrl,
          isM3U8: true,
          isMP4: false,
          isEmbed: false,
          hardsub: true,
          priority: 10,
          subtitleTracks: (anidapSub.tracks || []).map((t: any) => ({
            url: t.url, lang: t.lang, label: t.label,
          })),
          intro: anidapSub.intro || null,
          outro: anidapSub.outro || null,
        });
      }
    }

    console.log(
      `[instant-servers] AniList ${id} ep ${epNum}: ${servers.length} instant servers (mimi:${animexMimi.sub || animexMimi.dub ? "✓" : "✗"} anidb:${anidbResult.sub || anidbResult.dub ? "✓" : "✗"} anineko:${aninekoServers.length > 0 ? "✓" : "✗"} anikage:${anikageResult.sub || anikageResult.dub ? "✓" : "✗"} anidap:${servers.some(s => s.source === "anidap") ? "✓" : "✗"})`,
    );

    return NextResponse.json({ servers });
  } catch (err) {
    console.error("[instant-servers] error:", err);
    return NextResponse.json({ servers: [] });
  }
}
