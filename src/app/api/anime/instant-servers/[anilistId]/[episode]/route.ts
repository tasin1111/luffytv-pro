import { NextRequest, NextResponse } from "next/server";
import { resolveAniDbEmbeds } from "@/lib/anidb-direct";
import { resolveAniNekoM3u8 } from "@/lib/anineko-direct";
import { resolveAnimexMimiBoth, resolveAnimexProvider } from "@/lib/animex-fast";
import { fetchAllAniDapSources, ANIDAP_PROVIDER_META } from "@/lib/anidap-api";
import { resolveAniKageBoth } from "@/lib/anikage-fast";
import { resolveSenshi } from "@/lib/senshi-direct";
import { resolveAllManga } from "@/lib/allmanga-direct";
import { resolveAniZone } from "@/lib/anizone-direct";
import { resolveAniWaves } from "@/lib/aniwaves-direct";
import { fetchAniLightSources } from "@/lib/anilight-api";
import { fetchAllKyrenSources } from "@/lib/kyren-api";
import { resolveAniKoto } from "@/lib/anikoto-direct";
import { fetchAllReAnimeSources } from "@/lib/reanime-api";
import { fetchAllLunaSources, LUNA_PROVIDER_META } from "@/lib/luna-api";
import { fetchAniPmSources } from "@/lib/anipm-api";
import { wrapM3u8Url, wrapM3u8UrlWithReferer, wrapStreamUrl } from "@/lib/proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60; // Vercel Pro max — give all providers enough time to load

/**
 * GET /api/anime/instant-servers/[anilistId]/[episode]?title={title}
 *
 * Returns INSTANT servers with DIRECT m3u8 URLs (no embeds/iframes for top priority).
 *
 * PRIORITY ORDER (user-specified 2026-07-13):
 *   0.  AnimeX mimi (sub/dub) — FASTEST
 *   1.  AnimeX yuki (sub/dub)
 *   2.  AniDB (sub/dub)
 *   3.  Kyren (sub/dub)
 *   4.  AniDap (all providers: beep, mimi, yuki, loli, vee, kiwi, sora)
 *   5.  AniPm (sub/dub)
 *   6.  Senshi (sub)
 *   7.  AllAnime/AllManga (sub)
 *   8+. AniNeko, AniLight, AniZone, AniWaves, AniKoto, ReAnime, AniKage, Luna
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

    // Wrap subtitle URLs through the Worker proxy so they work cross-origin
    function wrapSubs(tracks?: Array<{ url: string; lang: string; label: string }>): Array<{ url: string; lang: string; label: string }> | undefined {
      if (!tracks || tracks.length === 0) return undefined;
      return tracks.map(t => ({
        url: t.url.startsWith("http") ? wrapStreamUrl(t.url) : t.url,
        lang: t.lang || "en",
        label: t.label || "English",
      }));
    }

    const servers: Array<{
      id: string;
      name: string;
      source: "animex" | "anidb" | "anineko" | "anidap" | "anikage" | "senshi" | "allmanga" | "anizone" | "aniwaves" | "anilight" | "kyren" | "anikoto" | "reanime" | "luna" | "anipm";
      provider: string;
      type: "sub" | "dub";
      quality: string;
      streamUrl: string;
      isM3U8: boolean;
      isMP4: boolean;
      isDASH?: boolean;
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
    let anikageIntro: { start: number; end: number } | null = null;
    let anikageOutro: { start: number; end: number } | null = null;

    const providerPromises: Promise<void>[] = [
      // AnimeX mimi (priority 0 sub, 0.5 dub) — FASTEST
      (async () => {
        try {
          const m = await withTimeout(resolveAnimexMimiBoth(id, epNum), 7000, { sub: null, dub: null });
          if (m.sub?.m3u8Url) servers.push({ id: "animex:mimi:sub", name: "AnimeX Mimi", source: "animex", provider: "mimi", type: "sub", quality: m.sub.quality || "1080p", streamUrl: m.sub.m3u8Url, isM3U8: true, isMP4: false, isEmbed: false, hardsub: false, priority: 0, subtitleTracks: wrapSubs(m.sub.tracks), intro: m.sub.intro || null, outro: m.sub.outro || null });
          if (m.dub?.m3u8Url) servers.push({ id: "animex:mimi:dub", name: "AnimeX Mimi (Dub)", source: "animex", provider: "mimi", type: "dub", quality: m.dub.quality || "1080p", streamUrl: m.dub.m3u8Url, isM3U8: true, isMP4: false, isEmbed: false, hardsub: false, priority: 0.5, subtitleTracks: wrapSubs(m.dub.tracks), intro: m.dub.intro || null, outro: m.dub.outro || null });
        } catch {}
      })(),
      // AnimeX yuki (priority 1) — second fastest, multi-quality
      (async () => {
        try {
          const [ySub, yDub] = await Promise.all([
            resolveAnimexProvider(id, epNum, "sub", "yuki").catch(() => null),
            resolveAnimexProvider(id, epNum, "dub", "yuki").catch(() => null),
          ]);
          if (ySub?.m3u8Url) servers.push({ id: "animex:yuki:sub", name: "AnimeX Yuki", source: "animex", provider: "yuki", type: "sub", quality: ySub.quality || "1080p", streamUrl: ySub.m3u8Url, isM3U8: true, isMP4: false, isEmbed: false, hardsub: false, priority: 1, subtitleTracks: wrapSubs(ySub.tracks), intro: ySub.intro || null, outro: ySub.outro || null });
          if (yDub?.m3u8Url) servers.push({ id: "animex:yuki:dub", name: "AnimeX Yuki (Dub)", source: "animex", provider: "yuki", type: "dub", quality: yDub.quality || "1080p", streamUrl: yDub.m3u8Url, isM3U8: true, isMP4: false, isEmbed: false, hardsub: false, priority: 1.5, subtitleTracks: wrapSubs(yDub.tracks), intro: yDub.intro || null, outro: yDub.outro || null });
        } catch {}
      })(),
      // AniDB (priority 2)
      (async () => {
        try {
          const r = await withTimeout(resolveAniDbEmbeds(id, epNum, title), 7000, { sub: null, dub: null });
          if (r.sub?.m3u8Url) servers.push({ id: "anidb:sub", name: "AniDB", source: "anidb", provider: "anidb", type: "sub", quality: "1080p", streamUrl: wrapM3u8Url(r.sub.m3u8Url), isM3U8: true, isMP4: false, isEmbed: false, hardsub: false, priority: 2 });
          else if (r.sub?.embedUrl) servers.push({ id: "anidb:sub", name: "AniDB", source: "anidb", provider: "anidb", type: "sub", quality: "1080p", streamUrl: r.sub.embedUrl, isM3U8: false, isMP4: false, isEmbed: true, hardsub: false, priority: 2 });
          if (r.dub?.m3u8Url) servers.push({ id: "anidb:dub", name: "AniDB (Dub)", source: "anidb", provider: "anidb", type: "dub", quality: "1080p", streamUrl: wrapM3u8Url(r.dub.m3u8Url), isM3U8: true, isMP4: false, isEmbed: false, hardsub: false, priority: 2.5 });
          else if (r.dub?.embedUrl) servers.push({ id: "anidb:dub", name: "AniDB (Dub)", source: "anidb", provider: "anidb", type: "dub", quality: "1080p", streamUrl: r.dub.embedUrl, isM3U8: false, isMP4: false, isEmbed: true, hardsub: false, priority: 2.5 });
        } catch {}
      })(),
      // Kyren (priority 3) — only senshi + megaplay-direct work now
      (async () => {
        try {
          const kr = await withTimeout(fetchAllKyrenSources(id, epNum, { sub: true, dub: true, timeoutMs: 7000 }).catch(() => []), 7000, []);
          if (kr?.length) { let p = 3; for (const r of kr) servers.push({ id: `kyren:${r.server}:${r.type}`, name: `Kyren ${r.server.charAt(0).toUpperCase() + r.server.slice(1)}${r.type === "dub" ? " (Dub)" : ""}`, source: "kyren", provider: r.server, type: r.type, quality: r.quality || "1080p", streamUrl: r.streamUrl, isM3U8: r.isM3U8, isMP4: r.isMP4, isEmbed: false, hardsub: false, priority: p++, subtitleTracks: (r.tracks || []).map((t: any) => ({ url: wrapStreamUrl(t.url), lang: t.lang || "en", label: t.label || "English" })) }); }
        } catch {}
      })(),
      // AniDap (priority 4) — fetch ALL providers in parallel
      (async () => {
        try {
          const adResults = await withTimeout(
            fetchAllAniDapSources(id, epNum, { sub: true, dub: true, timeoutMs: 7000 }).catch(() => []),
            7000,
            [],
          );
          if (adResults?.length) {
            let p = 4;
            for (const r of adResults) {
              const meta = ANIDAP_PROVIDER_META[r.provider as keyof typeof ANIDAP_PROVIDER_META];
              const provName = meta?.name || (r.provider.charAt(0).toUpperCase() + r.provider.slice(1));
              const typeTag = r.type === "dub" ? " (Dub)" : (r.hardsub ? " (HS)" : "");
              servers.push({
                id: `anidap:${r.provider}:${r.type}`,
                name: `AniDap ${provName}${typeTag}`,
                source: "anidap",
                provider: r.provider,
                type: r.type,
                quality: r.quality || "auto",
                streamUrl: r.streamUrl,
                isM3U8: r.isM3U8,
                isMP4: r.isMP4,
                isDASH: r.isDASH === true,
                isEmbed: false,
                hardsub: r.hardsub,
                priority: p++,
                subtitleTracks: (r.tracks || []).map(t => ({ url: wrapStreamUrl(t.url), lang: t.lang || "en", label: t.label || "English" })),
                intro: r.intro || null,
                outro: r.outro || null,
              });
            }
          }
        } catch {}
      })(),
      // AniPm (priority 5)
      (async () => {
        try {
          const pm = await withTimeout(fetchAniPmSources(id, epNum, { sub: true, dub: true, timeoutMs: 7000 }).catch(() => []), 7000, []);
          if (pm?.length) { let p = 5; for (const r of pm) { if (!r.streamUrl) continue; servers.push({ id: `anipm:${r.provider}:${r.type}`, name: `AniPm ${r.provider}${r.type === "dub" ? " (Dub)" : ""}`, source: "anipm" as any, provider: r.provider, type: r.type, quality: r.quality || "1080p", streamUrl: r.streamUrl, isM3U8: r.isM3U8, isMP4: r.isMP4, isEmbed: r.isEmbed, hardsub: r.hardsub, priority: p++, subtitleTracks: (r.tracks || []).map((t: any) => ({ url: wrapStreamUrl(t.url), lang: t.lang || "en", label: t.label || "English" })) }); } }
        } catch {}
      })(),
      // Senshi (priority 6)
      (async () => {
        try {
          const s = await withTimeout(resolveSenshi(id, epNum, title).catch(() => null), 7000, null);
          if (s?.m3u8Url) servers.push({ id: "senshi:sub", name: "Senshi", source: "senshi", provider: "senshi", type: "sub", quality: "1080p", streamUrl: wrapM3u8UrlWithReferer(s.m3u8Url, "https://senshi.live/"), isM3U8: true, isMP4: false, isEmbed: false, hardsub: s.status === "HardSub", priority: 6, intro: s.intro, outro: s.outro });
        } catch {}
      })(),
      // AllManga (priority 7)
      (async () => {
        try {
          const am = await withTimeout(resolveAllManga(id, epNum, "sub").catch(() => null), 7000, null);
          if (am?.sources?.length) { for (let i = 0; i < Math.min(am.sources.length, 5); i++) { const src = am.sources[i]; const isM3U8 = src.type === "hls" || src.url.includes(".m3u8"); const isMP4 = src.type === "mp4" || src.url.includes(".mp4"); servers.push({ id: `allmanga:${i}`, name: `AllManga ${src.name}`.trim(), source: "allmanga", provider: "allmanga", type: "sub", quality: src.quality || "1080p", streamUrl: wrapM3u8Url(src.url), isM3U8, isMP4, isEmbed: false, hardsub: false, priority: 7 + i * 0.1, intro: am.intro, outro: am.outro }); } }
        } catch {}
      })(),
      // AniNeko (priority 8+)
      (async () => {
        try {
          const ns = await withTimeout(resolveAniNekoM3u8(id, epNum, title).catch(() => []), 7000, []);
          for (let i = 0; i < Math.min(ns.length, 3); i++) {
            const s = ns[i];
            servers.push({ id: `anineko:${i}`, name: s.serverName, source: "anineko", provider: "anineko", type: "sub", quality: "1080p", streamUrl: wrapM3u8Url(s.m3u8Url), isM3U8: true, isMP4: false, isEmbed: false, hardsub: false, priority: 8 + i * 0.1, subtitleTracks: wrapSubs(s.subtitleUrl ? [{ url: s.subtitleUrl, lang: "en", label: "English" }] : undefined) });
          }
        } catch {}
      })(),
      // AniLight (priority 9+)
      (async () => {
        try {
          const al = await withTimeout(fetchAniLightSources(id, epNum, { sub: true, dub: true, timeoutMs: 7000 }).catch(() => []), 7000, []);
          al.filter((r: any) => r.type === "sub").slice(0, 3).forEach((r: any, i: number) => servers.push({ id: `anilight:sub:${i}`, name: `AniLight ${r.quality}`.trim(), source: "anilight", provider: "anilight", type: "sub", quality: r.quality || "1080p", streamUrl: r.streamUrl, isM3U8: r.isM3U8, isMP4: r.isMP4, isEmbed: false, hardsub: false, priority: 9 + i * 0.1, subtitleTracks: (r.tracks || []).map((t: any) => ({ url: wrapStreamUrl(t.url), lang: t.lang || "en", label: t.label || "English" })) }));
          al.filter((r: any) => r.type === "dub").slice(0, 3).forEach((r: any, i: number) => servers.push({ id: `anilight:dub:${i}`, name: `AniLight ${r.quality} (Dub)`.trim(), source: "anilight", provider: "anilight", type: "dub", quality: r.quality || "1080p", streamUrl: r.streamUrl, isM3U8: r.isM3U8, isMP4: r.isMP4, isEmbed: false, hardsub: false, priority: 9.5 + i * 0.1, subtitleTracks: (r.tracks || []).map((t: any) => ({ url: wrapStreamUrl(t.url), lang: t.lang || "en", label: t.label || "English" })) }));
        } catch {}
      })(),
      // AniZone (priority 10)
      (async () => {
        try {
          const az = await withTimeout(resolveAniZone(id, epNum, title).catch(() => null), 7000, null);
          if (az?.m3u8Url) servers.push({ id: "anizone:sub", name: "AniZone", source: "anizone", provider: "anizone", type: "sub", quality: "1080p", streamUrl: wrapM3u8UrlWithReferer(az.m3u8Url, "https://anizone.to/"), isM3U8: true, isMP4: false, isEmbed: false, hardsub: false, priority: 10, subtitleTracks: wrapSubs(az.subtitleTracks) });
        } catch {}
      })(),
      // AniWaves (priority 11)
      (async () => {
        try {
          const aw = await withTimeout(resolveAniWaves(id, epNum, title).catch(() => null), 7000, null);
          if (aw?.servers?.length) { let p = 11; for (const srv of aw.servers) servers.push({ id: `aniwaves:${srv.svId}:${srv.type}`, name: srv.name, source: "aniwaves", provider: String(srv.svId), type: srv.type, quality: "1080p", streamUrl: srv.embedUrl, isM3U8: false, isMP4: false, isEmbed: true, hardsub: false, priority: p++, intro: aw.intro, outro: aw.outro }); }
        } catch {}
      })(),
      // AniKoto (priority 12) — m3u8 from megaplay.buzz + vidwish.live fallback
      (async () => {
        try {
          const ak = await withTimeout(resolveAniKoto(id, epNum, title).catch(() => null), 7000, null);
          if (ak?.servers?.length) {
            let p = 12;
            for (const srv of ak.servers) {
              // If we have m3u8, wrap through Worker proxy. Otherwise use embed URL as iframe.
              const streamUrl = srv.m3u8Url
                ? wrapM3u8UrlWithReferer(srv.m3u8Url, srv.referer)
                : srv.embedUrl;
              servers.push({
                id: `anikoto:${srv.type}:${p}`,
                name: srv.name,
                source: "anikoto",
                provider: "anikoto",
                type: srv.type,
                quality: srv.quality,
                streamUrl,
                isM3U8: !!srv.m3u8Url,
                isMP4: false,
                isEmbed: !srv.m3u8Url,
                hardsub: false,
                priority: p++,
                subtitleTracks: wrapSubs(srv.subtitleTracks),
                intro: srv.intro || ak.intro,
                outro: srv.outro || ak.outro,
              });
            }
          }
        } catch {}
      })(),
      // ReAnime (priority 13) — FlixCLOUD decrypted m3u8 (AES-256-CBC)
      (async () => {
        try {
          const ra = await withTimeout(fetchAllReAnimeSources(id, epNum, undefined, { sub: true, dub: true, timeoutMs: 7000 }).catch(() => []), 7000, []);
          if (ra?.length) {
            let p = 13;
            for (const r of ra) {
              servers.push({
                id: `reanime:${r.provider}:${p}`,
                name: `ReAnime ${r.provider.includes("dub") ? "(Dub)" : r.provider.includes("sub") ? "" : ""}`.trim() || `ReAnime ${p}`,
                source: "reanime",
                provider: r.provider,
                type: r.type,
                quality: r.quality || "1080p",
                streamUrl: r.streamUrl,
                isM3U8: r.isM3U8,
                isMP4: r.isMP4,
                isEmbed: r.isEmbed,
                hardsub: false,
                priority: p++,
                subtitleTracks: wrapSubs(r.subtitleTracks),
                intro: r.intro,
                outro: r.outro,
              });
            }
          }
        } catch {}
      })(),
      // AniKage (skip times only, priority 14) — runs independently, doesn't block
      (async () => {
        try {
          const ak = await withTimeout(resolveAniKageBoth(id, epNum, title).catch(() => ({ sub: null, dub: null, intro: null, outro: null })), 7000, { sub: null, dub: null, intro: null, outro: null });
          if (ak.intro) anikageIntro = ak.intro;
          if (ak.outro) anikageOutro = ak.outro;
          const akServers = [...(ak.sub?.servers || []), ...(ak.dub?.servers || [])];
          let p = 14;
          for (const srv of akServers) {
            const isNin = srv.m3u8Url.includes("ninstream.com");
            servers.push({ id: `anikage:${srv.provider}:${p}`, name: srv.name, source: "anikage", provider: srv.provider, type: srv.type, quality: srv.quality, streamUrl: isNin ? wrapM3u8UrlWithReferer(srv.m3u8Url, "https://senshi.live/") : wrapM3u8Url(srv.m3u8Url), isM3U8: true, isMP4: false, isEmbed: false, hardsub: false, priority: p++, intro: ak.intro, outro: ak.outro });
          }
        } catch {}
      })(),
      // Luna-Stream (priority 15+) — fetches ALL Luna providers in parallel
      // (anizone, megaplay, senshi, anidb, animesalt, hadfree, anibd, animenexus)
      // Each returns streamUrl + captions + intro/outro.
      (async () => {
        try {
          const lunaResults = await withTimeout(
            fetchAllLunaSources(id, epNum, { timeoutMs: 12000 }).catch(() => []),
            18000,
            [],
          );
          if (lunaResults?.length) {
            let p = 15;
            for (const r of lunaResults) {
              const meta = LUNA_PROVIDER_META[r.provider];
              const provName = meta?.name || (r.provider.charAt(0).toUpperCase() + r.provider.slice(1));
              const typeTag = r.type === "dub" ? " (Dub)" : (r.hardsub ? " (HS)" : "");
              servers.push({
                id: `luna:${r.provider}:${r.type}`,
                name: `Luna ${provName}${typeTag}`,
                source: "luna",
                provider: r.provider,
                type: r.type,
                quality: r.quality || "auto",
                streamUrl: r.streamUrl,
                isM3U8: r.isM3U8,
                isMP4: r.isMP4,
                isEmbed: false,
                hardsub: r.hardsub,
                priority: p++,
                subtitleTracks: (r.tracks || []).map(t => ({
                  url: t.url,
                  lang: t.lang || "en",
                  label: t.label || "English",
                })),
                intro: r.intro || null,
                outro: r.outro || null,
              });
            }
          }
        } catch {}
      })(),
    ];

    // Wait for ALL providers to finish (each has its own 7s timeout).
    // The user wants ALL servers to load, then sorted by priority.
    // "Whoever loads first doesn't matter after all server load it will be
    // in this formation" — so we wait for everything, then sort.
    // Max time: 7s per provider (parallel) + Luna 12s = ~12s total.
    await Promise.allSettled(providerPromises);

    // Apply AniKage skip times to ALL servers
    if (anikageIntro || anikageOutro) {
      for (const s of servers) {
        if (!s.intro && anikageIntro) s.intro = anikageIntro;
        if (!s.outro && anikageOutro) s.outro = anikageOutro;
      }
      console.log(`[instant-servers] AniKage skip times applied to ALL servers: intro=${JSON.stringify(anikageIntro)} outro=${JSON.stringify(anikageOutro)}`);
    }

    // DEDUPLICATE — remove only EXACT URL duplicates (same full URL including
    // query string). We do NOT:
    //   - Strip query strings (they contain stream tokens — different query
    //     strings = different streams)
    //   - Dedup by source:provider:type (different URLs from the same provider
    //     are different mirrors and should all be shown)
    //   - Filter by type (embed, mp4, and hls are ALL shown — the user wants
    //     every server visible)
    const seenUrls = new Set<string>();
    const deduped: typeof servers = [];
    for (const s of servers) {
      if (seenUrls.has(s.streamUrl)) continue;
      seenUrls.add(s.streamUrl);
      deduped.push(s);
    }
    const dupesRemoved = servers.length - deduped.length;
    if (dupesRemoved > 0) {
      console.log(`[instant-servers] Removed ${dupesRemoved} exact-URL duplicate servers`);
    }

    // Sort by priority
    deduped.sort((a, b) => a.priority - b.priority);

    console.log(
      `[instant-servers] AniList ${id} ep ${epNum}: ${deduped.length} instant servers (animex:${deduped.some(s => s.source === "animex") ? "✓" : "✗"} anidb:${deduped.some(s => s.source === "anidb") ? "✓" : "✗"} anineko:${deduped.some(s => s.source === "anineko") ? "✓" : "✗"} anilight:${deduped.some(s => s.source === "anilight") ? "✓" : "✗"} kyren:${deduped.some(s => s.source === "kyren") ? "✓" : "✗"} senshi:${deduped.some(s => s.source === "senshi") ? "✓" : "✗"} allmanga:${deduped.some(s => s.source === "allmanga") ? "✓" : "✗"} anikoto:${deduped.some(s => s.source === "anikoto") ? "✓" : "✗"} reanime:${deduped.some(s => s.source === "reanime") ? "✓" : "✗"} anikage:${anikageIntro || anikageOutro ? "✓" : "✗"} anidap:${deduped.some(s => s.source === "anidap") ? "✓" : "✗"} luna:${deduped.some(s => s.source === "luna") ? "✓" : "✗"} anipm:${deduped.some(s => s.source === "anipm") ? "✓" : "✗"})`,
    );

    return NextResponse.json({ servers: deduped });
  } catch (err) {
    console.error("[instant-servers] error:", err);
    return NextResponse.json({ servers: [] });
  }
}
