import { NextRequest, NextResponse } from "next/server";
import { resolveAniDbEmbeds } from "@/lib/anidb-direct";
import { resolveAniNekoM3u8 } from "@/lib/anineko-direct";
import { resolveAnimexMimiBoth } from "@/lib/animex-fast";
import { resolveAniDapId, getAniDapSources } from "@/lib/anidap-api";
import { resolveAniKageBoth } from "@/lib/anikage-fast";
import { resolveSenshi } from "@/lib/senshi-direct";
import { resolveAllManga } from "@/lib/allmanga-direct";
import { resolveAniZone } from "@/lib/anizone-direct";
import { resolveAniWaves } from "@/lib/aniwaves-direct";
import { wrapM3u8Url, wrapM3u8UrlWithReferer } from "@/lib/proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 25; // increased from 15 — AniDB + AllManga need Worker proxy calls

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
    // Each provider gets a 10s timeout — if it doesn't resolve in time,
    // we skip it and return whatever we have. This prevents a single slow
    // provider from blocking the entire response.
    function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
      return Promise.race([
        promise,
        new Promise<T>(r => setTimeout(() => r(fallback), ms)),
      ]);
    }

    const anidapId = await resolveAniDapId(id).catch(() => null);
    const [animexMimi, anidbResult, aninekoM3u8s, anidapSub, anikageResult, senshiResult, allmangaResult, anizoneResult, aniwavesResult] = await Promise.all([
      withTimeout(resolveAnimexMimiBoth(id, epNum), 8000, { sub: null, dub: null }),
      withTimeout(resolveAniDbEmbeds(id, epNum, title), 10000, { sub: null, dub: null }),
      withTimeout(resolveAniNekoM3u8(id, epNum, title).catch(() => []), 8000, []),
      withTimeout(
        anidapId ? getAniDapSources(anidapId, epNum, "sub", "beep").catch(() => null) : Promise.resolve(null),
        8000, null,
      ),
      withTimeout(resolveAniKageBoth(id, epNum, title).catch(() => ({ sub: null, dub: null, intro: null, outro: null })), 8000, { sub: null, dub: null, intro: null, outro: null }),
      withTimeout(resolveSenshi(id, epNum, title).catch(() => null), 8000, null),
      withTimeout(resolveAllManga(id, epNum, "sub").catch(() => null), 10000, null),
      withTimeout(resolveAniZone(id, epNum, title).catch(() => null), 8000, null),
      withTimeout(resolveAniWaves(id, epNum, title).catch(() => null), 8000, null),
    ]);

    const servers: Array<{
      id: string;
      name: string;
      source: "animex" | "anidb" | "anineko" | "anidap" | "anikage" | "senshi" | "allmanga" | "anizone" | "aniwaves";
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

    // ── PRIORITY 4: AniNeko — DIRECT m3u8 from vivibebe.site ──
    // AniNeko now extracts m3u8 URLs from vivibebe.site embed pages.
    // Same CDN as AnimeX mimi but different content (anineko has its own library).
    for (let i = 0; i < Math.min(aninekoM3u8s.length, 3); i++) {
      const srv = aninekoM3u8s[i];
      servers.push({
        id: `anineko:${i}`,
        name: srv.serverName,
        source: "anineko",
        provider: "anineko",
        type: "sub",
        quality: "1080p",
        streamUrl: wrapM3u8Url(srv.m3u8Url),
        isM3U8: true,
        isMP4: false,
        isEmbed: false,
        hardsub: false,
        priority: 4 + i,
        subtitleTracks: srv.subtitleUrl ? [{ url: srv.subtitleUrl, lang: "en", label: "English" }] : undefined,
      });
    }

    // ── PRIORITY 7: Senshi (sub) — m3u8 from ninstream.com via /api/stream ──
    // ninstream.com m3u8 works from Vercel server but NOT from Worker proxy
    // (Cloudflare-to-Cloudflare block). We route through /api/stream (Vercel
    // server-side proxy) which sends the correct Referer: https://senshi.live/.
    if (senshiResult?.m3u8Url) {
      const streamUrl = `/api/stream?url=${encodeURIComponent(senshiResult.m3u8Url)}&referer=${encodeURIComponent("https://senshi.live/")}`;
      servers.push({
        id: "senshi:sub",
        name: "Senshi",
        source: "senshi",
        provider: "senshi",
        type: "sub",
        quality: "1080p",
        streamUrl,
        isM3U8: true,
        isMP4: false,
        isEmbed: false,
        hardsub: senshiResult.status === "HardSub",
        priority: 7,
        intro: senshiResult.intro,
        outro: senshiResult.outro,
      });
    }

    // ── PRIORITY 7.5: AllManga (sub) — OUR OWN scraper (no third-party API) ──
    // Uses the direct AllAnime API at api.allanime.day with GraphQL + AES decryption.
    // Extracts direct m3u8/mp4 URLs from embed providers (mp4upload, uns.bio, etc.)
    if (allmangaResult?.sources?.length) {
      for (let i = 0; i < Math.min(allmangaResult.sources.length, 5); i++) {
        const src = allmangaResult.sources[i];
        const isM3U8 = src.type === "hls" || src.url.includes(".m3u8");
        const isMP4 = src.type === "mp4" || src.url.includes(".mp4");
        servers.push({
          id: `allmanga:${i}`,
          name: `AllManga ${src.name}`.trim(),
          source: "allmanga",
          provider: "allmanga",
          type: "sub",
          quality: src.quality || "1080p",
          streamUrl: isM3U8 ? wrapM3u8Url(src.url) : src.url,
          isM3U8,
          isMP4,
          isEmbed: false,
          hardsub: false,
          priority: 9 + i,
          intro: allmangaResult.intro,
          outro: allmangaResult.outro,
        });
      }
    }

    // ── PRIORITY 13: AniZone — high-quality HLS with soft subtitles ──
    // AniZone provides HLS from suzaku.xin-cdn.xyz with 10+ subtitle languages (ASS format).
    // Route through /api/stream with Referer: https://anizone.to/.
    if (anizoneResult?.m3u8Url) {
      const streamUrl = `/api/stream?url=${encodeURIComponent(anizoneResult.m3u8Url)}&referer=${encodeURIComponent("https://anizone.to/")}`;
      servers.push({
        id: "anizone:sub",
        name: "AniZone",
        source: "anizone",
        provider: "anizone",
        type: "sub",
        quality: "1080p",
        streamUrl,
        isM3U8: true,
        isMP4: false,
        isEmbed: false,
        hardsub: false,
        priority: 13,
        subtitleTracks: anizoneResult.subtitleTracks,
      });
    }

    // ── PRIORITY 13.5: AniWaves — big library, multiple servers ──
    // AniWaves returns embed URLs (echovideo.ru, gn1r5n.org, myvidplay.com) — use as iframe embeds.
    // Also returns intro/outro skip data from their database.
    if (aniwavesResult?.servers?.length) {
      let awPriority = 14;
      for (const srv of aniwavesResult.servers) {
        servers.push({
          id: `aniwaves:${srv.svId}:${srv.type}`,
          name: srv.name,
          source: "aniwaves",
          provider: String(srv.svId),
          type: srv.type,
          quality: "1080p",
          streamUrl: srv.embedUrl,
          isM3U8: false,
          isMP4: false,
          isEmbed: true, // AniWaves returns embed URLs — use iframe
          hardsub: false,
          priority: awPriority++,
          intro: aniwavesResult.intro,
          outro: aniwavesResult.outro,
        });
      }
    }

    // ── PRIORITY 14+: AniKage — embed servers + intro/outro ──
    // AniKage's source URLs are encrypted tokens (prox.anicore.tv) that
    // need client-side JS decryption. BUT the embed URLs (ninstream.com m3u8
    // + playeng.animeapps.top) work! We add them as playable servers.
    // ninstream.com m3u8 needs Referer: https://senshi.live/ (handled by proxy).
    let anikagePriority = 14;
    const anikageServers = [...(anikageResult.sub?.servers || []), ...(anikageResult.dub?.servers || [])];
    for (const srv of anikageServers) {
      // ninstream.com m3u8 gets 403 from Worker proxy (CF-to-CF block).
      // Route through /api/stream (Vercel server proxy) with the correct referer.
      const isNinstream = srv.m3u8Url.includes("ninstream.com");
      const streamUrl = isNinstream
        ? `/api/stream?url=${encodeURIComponent(srv.m3u8Url)}&referer=${encodeURIComponent("https://senshi.live/")}`
        : wrapM3u8Url(srv.m3u8Url);
      servers.push({
        id: `anikage:${srv.provider}:${anikagePriority}`,
        name: srv.name,
        source: "anikage",
        provider: srv.provider,
        type: srv.type,
        quality: srv.quality,
        streamUrl,
        isM3U8: true,
        isMP4: false,
        isEmbed: false,
        hardsub: false,
        priority: anikagePriority++,
        intro: anikageResult.intro,
        outro: anikageResult.outro,
      });
    }

    // ── AniKage intro/outro is PERMANENT — apply to ALL servers ──
    // The skip times from AniKage work for every provider (mimi, anidb, etc.)
    // because they're timestamps, not stream-dependent.
    if (anikageResult.intro || anikageResult.outro) {
      for (const s of servers) {
        if (!s.intro && anikageResult.intro) s.intro = anikageResult.intro;
        if (!s.outro && anikageResult.outro) s.outro = anikageResult.outro;
      }
      console.log(`[instant-servers] AniKage skip times applied to ALL servers: intro=${JSON.stringify(anikageResult.intro)} outro=${JSON.stringify(anikageResult.outro)}`);
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
      `[instant-servers] AniList ${id} ep ${epNum}: ${servers.length} instant servers (mimi:${animexMimi.sub || animexMimi.dub ? "✓" : "✗"} anidb:${anidbResult.sub || anidbResult.dub ? "✓" : "✗"} anineko:${aninekoM3u8s.length > 0 ? "✓" : "✗"} senshi:${senshiResult ? "✓" : "✗"} allmanga:${allmangaResult?.sources?.length ? "✓" : "✗"} anikage:${anikageResult.intro || anikageResult.outro ? "✓" : "✗"} anidap:${servers.some(s => s.source === "anidap") ? "✓" : "✗"})`,
    );

    return NextResponse.json({ servers });
  } catch (err) {
    console.error("[instant-servers] error:", err);
    return NextResponse.json({ servers: [] });
  }
}
