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
import { fetchAniLightSources } from "@/lib/anilight-api";
import { fetchAllKyrenSources } from "@/lib/kyren-api";
import { wrapM3u8Url, wrapM3u8UrlWithReferer } from "@/lib/proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60; // Vercel Pro max — give all providers enough time to load

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
 *   4. AniNeko (sub) — direct m3u8 from vivibebe.site
 *   5. AniLight (sub) — HLS from nanobyte CDN
 *   6. AniLight (dub)
 *   7. Senshi, AllManga, AniZone, AniWaves, AniKage, AniDap (lower priority)
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
    function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
      return Promise.race([
        promise,
        new Promise<T>(r => setTimeout(() => r(fallback), ms)),
      ]);
    }

    const servers: Array<{
      id: string;
      name: string;
      source: "animex" | "anidb" | "anineko" | "anidap" | "anikage" | "senshi" | "allmanga" | "anizone" | "aniwaves" | "anilight" | "kyren";
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

    // SEPARATE SCRAPING: each provider runs independently in its own async block.
    // Previously ALL providers were in one Promise.all — if AniKage took 25s,
    // the entire response waited 25s even if AnimeX mimi finished in 2s.
    // Now: each provider scrapes independently, adds servers to the array,
    // and we wait for ALL to finish (with their own timeouts).
    const anidapId = await resolveAniDapId(id).catch(() => null);
    let anikageIntro: { start: number; end: number } | null = null;
    let anikageOutro: { start: number; end: number } | null = null;

    const providerPromises: Promise<void>[] = [
      // AnimeX (priority 0-3)
      (async () => {
        try {
          const m = await withTimeout(resolveAnimexMimiBoth(id, epNum), 25000, { sub: null, dub: null });
          if (m.sub?.m3u8Url) servers.push({ id: "animex:mimi:sub", name: "AnimeX Mimi", source: "animex", provider: "mimi", type: "sub", quality: m.sub.quality || "1080p", streamUrl: m.sub.m3u8Url, isM3U8: true, isMP4: false, isEmbed: false, hardsub: false, priority: 0, subtitleTracks: m.sub.tracks, intro: m.sub.intro || null, outro: m.sub.outro || null });
          if (m.dub?.m3u8Url) servers.push({ id: "animex:mimi:dub", name: "AnimeX Mimi (Dub)", source: "animex", provider: "mimi", type: "dub", quality: m.dub.quality || "1080p", streamUrl: m.dub.m3u8Url, isM3U8: true, isMP4: false, isEmbed: false, hardsub: false, priority: 2, subtitleTracks: m.dub.tracks, intro: m.dub.intro || null, outro: m.dub.outro || null });
        } catch {}
      })(),
      // AniDB (priority 1, 3)
      (async () => {
        try {
          const r = await withTimeout(resolveAniDbEmbeds(id, epNum, title), 30000, { sub: null, dub: null });
          if (r.sub?.m3u8Url) servers.push({ id: "anidb:sub", name: "AniDB", source: "anidb", provider: "anidb", type: "sub", quality: "1080p", streamUrl: wrapM3u8Url(r.sub.m3u8Url), isM3U8: true, isMP4: false, isEmbed: false, hardsub: false, priority: 1 });
          else if (r.sub?.embedUrl) servers.push({ id: "anidb:sub", name: "AniDB", source: "anidb", provider: "anidb", type: "sub", quality: "1080p", streamUrl: r.sub.embedUrl, isM3U8: false, isMP4: false, isEmbed: true, hardsub: false, priority: 1 });
          if (r.dub?.m3u8Url) servers.push({ id: "anidb:dub", name: "AniDB (Dub)", source: "anidb", provider: "anidb", type: "dub", quality: "1080p", streamUrl: wrapM3u8Url(r.dub.m3u8Url), isM3U8: true, isMP4: false, isEmbed: false, hardsub: false, priority: 3 });
          else if (r.dub?.embedUrl) servers.push({ id: "anidb:dub", name: "AniDB (Dub)", source: "anidb", provider: "anidb", type: "dub", quality: "1080p", streamUrl: r.dub.embedUrl, isM3U8: false, isMP4: false, isEmbed: true, hardsub: false, priority: 3 });
        } catch {}
      })(),
      // AniNeko (priority 4)
      (async () => {
        try {
          const ns = await withTimeout(resolveAniNekoM3u8(id, epNum, title).catch(() => []), 25000, []);
          for (let i = 0; i < Math.min(ns.length, 3); i++) {
            const s = ns[i];
            servers.push({ id: `anineko:${i}`, name: s.serverName, source: "anineko", provider: "anineko", type: "sub", quality: "1080p", streamUrl: wrapM3u8Url(s.m3u8Url), isM3U8: true, isMP4: false, isEmbed: false, hardsub: false, priority: 4 + i, subtitleTracks: s.subtitleUrl ? [{ url: s.subtitleUrl, lang: "en", label: "English" }] : undefined });
          }
        } catch {}
      })(),
      // AniLight (priority 5-6)
      (async () => {
        try {
          const al = await withTimeout(fetchAniLightSources(id, epNum, { sub: true, dub: true, timeoutMs: 25000 }).catch(() => []), 25000, []);
          al.filter((r: any) => r.type === "sub").slice(0, 3).forEach((r: any, i: number) => servers.push({ id: `anilight:sub:${i}`, name: `AniLight ${r.quality}`.trim(), source: "anilight", provider: "anilight", type: "sub", quality: r.quality || "1080p", streamUrl: r.streamUrl, isM3U8: r.isM3U8, isMP4: r.isMP4, isEmbed: false, hardsub: false, priority: 5 + i, subtitleTracks: (r.tracks || []).map((t: any) => ({ url: t.url, lang: t.lang || "en", label: t.label || "English" })) }));
          al.filter((r: any) => r.type === "dub").slice(0, 3).forEach((r: any, i: number) => servers.push({ id: `anilight:dub:${i}`, name: `AniLight ${r.quality} (Dub)`.trim(), source: "anilight", provider: "anilight", type: "dub", quality: r.quality || "1080p", streamUrl: r.streamUrl, isM3U8: r.isM3U8, isMP4: r.isMP4, isEmbed: false, hardsub: false, priority: 6 + i, subtitleTracks: (r.tracks || []).map((t: any) => ({ url: t.url, lang: t.lang || "en", label: t.label || "English" })) }));
        } catch {}
      })(),
      // Kyren (priority 7)
      (async () => {
        try {
          const kr = await withTimeout(fetchAllKyrenSources(id, epNum, { sub: true, dub: true, timeoutMs: 25000 }).catch(() => []), 25000, []);
          if (kr?.length) { let p = 7; for (const r of kr) servers.push({ id: `kyren:${r.server}:${r.type}`, name: `Kyren ${r.server.charAt(0).toUpperCase() + r.server.slice(1)}${r.type === "dub" ? " (Dub)" : ""}`, source: "kyren", provider: r.server, type: r.type, quality: r.quality || "1080p", streamUrl: r.streamUrl, isM3U8: r.isM3U8, isMP4: r.isMP4, isEmbed: false, hardsub: false, priority: p++, subtitleTracks: (r.tracks || []).map((t: any) => ({ url: t.url, lang: t.lang || "en", label: t.label || "English" })) }); }
        } catch {}
      })(),
      // Senshi (priority 8)
      (async () => {
        try {
          const s = await withTimeout(resolveSenshi(id, epNum, title).catch(() => null), 25000, null);
          if (s?.m3u8Url) servers.push({ id: "senshi:sub", name: "Senshi", source: "senshi", provider: "senshi", type: "sub", quality: "1080p", streamUrl: wrapM3u8UrlWithReferer(s.m3u8Url, "https://senshi.live/"), isM3U8: true, isMP4: false, isEmbed: false, hardsub: s.status === "HardSub", priority: 8, intro: s.intro, outro: s.outro });
        } catch {}
      })(),
      // AllManga (priority 9)
      (async () => {
        try {
          const am = await withTimeout(resolveAllManga(id, epNum, "sub").catch(() => null), 30000, null);
          if (am?.sources?.length) { for (let i = 0; i < Math.min(am.sources.length, 5); i++) { const src = am.sources[i]; const isM3U8 = src.type === "hls" || src.url.includes(".m3u8"); const isMP4 = src.type === "mp4" || src.url.includes(".mp4"); servers.push({ id: `allmanga:${i}`, name: `AllManga ${src.name}`.trim(), source: "allmanga", provider: "allmanga", type: "sub", quality: src.quality || "1080p", streamUrl: wrapM3u8Url(src.url), isM3U8, isMP4, isEmbed: false, hardsub: false, priority: 9 + i, intro: am.intro, outro: am.outro }); } }
        } catch {}
      })(),
      // AniZone (priority 13)
      (async () => {
        try {
          const az = await withTimeout(resolveAniZone(id, epNum, title).catch(() => null), 25000, null);
          if (az?.m3u8Url) servers.push({ id: "anizone:sub", name: "AniZone", source: "anizone", provider: "anizone", type: "sub", quality: "1080p", streamUrl: wrapM3u8UrlWithReferer(az.m3u8Url, "https://anizone.to/"), isM3U8: true, isMP4: false, isEmbed: false, hardsub: false, priority: 13, subtitleTracks: az.subtitleTracks });
        } catch {}
      })(),
      // AniWaves (priority 14)
      (async () => {
        try {
          const aw = await withTimeout(resolveAniWaves(id, epNum, title).catch(() => null), 25000, null);
          if (aw?.servers?.length) { let p = 14; for (const srv of aw.servers) servers.push({ id: `aniwaves:${srv.svId}:${srv.type}`, name: srv.name, source: "aniwaves", provider: String(srv.svId), type: srv.type, quality: "1080p", streamUrl: srv.embedUrl, isM3U8: false, isMP4: false, isEmbed: true, hardsub: false, priority: p++, intro: aw.intro, outro: aw.outro }); }
        } catch {}
      })(),
      // AniKage (skip times only, priority 15) — runs independently, doesn't block
      (async () => {
        try {
          const ak = await withTimeout(resolveAniKageBoth(id, epNum, title).catch(() => ({ sub: null, dub: null, intro: null, outro: null })), 25000, { sub: null, dub: null, intro: null, outro: null });
          if (ak.intro) anikageIntro = ak.intro;
          if (ak.outro) anikageOutro = ak.outro;
          const akServers = [...(ak.sub?.servers || []), ...(ak.dub?.servers || [])];
          let p = 15;
          for (const srv of akServers) {
            const isNin = srv.m3u8Url.includes("ninstream.com");
            servers.push({ id: `anikage:${srv.provider}:${p}`, name: srv.name, source: "anikage", provider: srv.provider, type: srv.type, quality: srv.quality, streamUrl: isNin ? wrapM3u8UrlWithReferer(srv.m3u8Url, "https://senshi.live/") : wrapM3u8Url(srv.m3u8Url), isM3U8: true, isMP4: false, isEmbed: false, hardsub: false, priority: p++, intro: ak.intro, outro: ak.outro });
          }
        } catch {}
      })(),
      // AniDap (priority 10)
      (async () => {
        try {
          if (!anidapId) return;
          const ad = await withTimeout(getAniDapSources(anidapId, epNum, "sub", "beep").catch(() => null), 25000, null);
          if (ad?.sources?.length) {
            const src = ad.sources.find((s: any) => s.url?.includes(".m3u8") || s.type?.includes("mpegurl"));
            if (src?.url) servers.push({ id: "anidap:beep:sub", name: "AniDap Beep", source: "anidap", provider: "beep", type: "sub", quality: src.quality || "1080p", streamUrl: wrapM3u8Url(src.url), isM3U8: true, isMP4: false, isEmbed: false, hardsub: true, priority: 10, subtitleTracks: (ad.tracks || []).map((t: any) => ({ url: t.url, lang: t.lang, label: t.label })), intro: ad.intro || null, outro: ad.outro || null });
          }
        } catch {}
      })(),
    ];

    // Wait for ALL providers to finish (each has its own timeout)
    await Promise.allSettled(providerPromises);

    // Apply AniKage skip times to ALL servers
    if (anikageIntro || anikageOutro) {
      for (const s of servers) {
        if (!s.intro && anikageIntro) s.intro = anikageIntro;
        if (!s.outro && anikageOutro) s.outro = anikageOutro;
      }
      console.log(`[instant-servers] AniKage skip times applied to ALL servers: intro=${JSON.stringify(anikageIntro)} outro=${JSON.stringify(anikageOutro)}`);
    }

    // Sort by priority
    servers.sort((a, b) => a.priority - b.priority);

    console.log(
      `[instant-servers] AniList ${id} ep ${epNum}: ${servers.length} instant servers (animex:${servers.some(s => s.source === "animex") ? "✓" : "✗"} anidb:${servers.some(s => s.source === "anidb") ? "✓" : "✗"} anineko:${servers.some(s => s.source === "anineko") ? "✓" : "✗"} anilight:${servers.some(s => s.source === "anilight") ? "✓" : "✗"} kyren:${servers.some(s => s.source === "kyren") ? "✓" : "✗"} senshi:${servers.some(s => s.source === "senshi") ? "✓" : "✗"} allmanga:${servers.some(s => s.source === "allmanga") ? "✓" : "✗"} anikage:${anikageIntro || anikageOutro ? "✓" : "✗"} anidap:${servers.some(s => s.source === "anidap") ? "✓" : "✗"})`,
    );

    return NextResponse.json({ servers });
  } catch (err) {
    console.error("[instant-servers] error:", err);
    return NextResponse.json({ servers: [] });
  }
}
