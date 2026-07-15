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
import { fetchAnimePaheSources } from "@/lib/animepahe-api";
import { fetchAniLightSources } from "@/lib/anilight-api";
import { fetchAllKyrenSources } from "@/lib/kyren-api";
import { resolveAniKoto } from "@/lib/anikoto-direct";
import { fetchAllReAnimeSources } from "@/lib/reanime-api";
import { fetchAllLunaSources, LUNA_PROVIDER_META } from "@/lib/luna-api";
import { fetchAniPmSources } from "@/lib/anipm-api";
import { resolveAnichiStreams } from "@/lib/anichi-direct";
import { resolveAninekoStreams } from "@/lib/anineko-to-direct";
import { wrapM3u8Url, wrapM3u8UrlWithReferer } from "@/lib/proxy";

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

    // Wrap subtitle URLs through the DEDICATED subtitle worker (luffytv-subs).
    // This worker is SEPARATE from luffytv-proxy — it ONLY handles subtitles:
    //   1. Injects the correct Referer/Origin per CDN host (no 403s)
    //   2. Converts SRT → WebVTT on-the-fly (browsers only render VTT)
    //   3. Converts ASS → WebVTT (basic — strips styling, extracts Dialogue)
    //   4. Passes VTT through with correct content-type
    //   5. Caches at edge for 24h (subtitles don't change)
    //   6. Full CORS headers (Access-Control-Allow-Origin: *)
    //
    // If NEXT_PUBLIC_SUBS_PROXY_BASE isn't set, falls back to /api/stream
    // (Vercel route) which has the same SRT→VTT conversion.
    const SUBS_WORKER = process.env.NEXT_PUBLIC_SUBS_PROXY_BASE || "";

    function wrapSubs(tracks?: Array<{ url: string; lang: string; label: string }>): Array<{ url: string; lang: string; label: string }> | undefined {
      if (!tracks || tracks.length === 0) return undefined;
      // NOTE: .ass subtitles ARE included now — the luffytv-subs worker
      // converts them to VTT (basic conversion: strips styling tags, extracts
      // Dialogue lines). If the worker isn't deployed, /api/stream fallback
      // will pass them through with application/x-subrip content-type and the
      // browser won't render them — but at least the menu won't be cluttered
      // with broken tracks (the <track> element silently ignores unknown formats).
      return tracks.map(t => {
        const url = t.url || "";
        return {
          url: url.startsWith("http") ? wrapSubsUrl(url) : url,
          lang: t.lang || "en",
          label: t.label || "English",
        };
      });
    }

    // Wrap a subtitle URL through the dedicated subtitle worker.
    // Uses the /sub?url=<encoded>&ref=<encoded> endpoint (easy to debug).
    // Falls back to /api/stream if the worker isn't configured.
    function wrapSubsUrl(rawUrl: string): string {
      const url = rawUrl.replace(/^https?:\/\/\/+/i, "https://"); // fix triple-slash bug
      const referer = getRefererForSubtitle(url);
      if (SUBS_WORKER) {
        // Primary: dedicated subtitle worker
        return `${SUBS_WORKER}/sub?url=${encodeURIComponent(url)}&ref=${encodeURIComponent(referer)}`;
      }
      // Fallback: Vercel /api/stream route (has SRT→VTT conversion)
      return `/api/stream?url=${encodeURIComponent(url)}&referer=${encodeURIComponent(referer)}`;
    }

    // Determine the correct Referer for a subtitle URL based on its CDN host.
    // This is critical — many subtitle CDNs return 403 without the right Referer.
    function getRefererForSubtitle(url: string): string {
      try {
        const hostname = new URL(url).hostname;
        if (hostname.includes("animex") || hostname.includes("24stream")) return "https://animex.one/";
        if (hostname.includes("miruro") || hostname.includes("anidb")) return "https://www.miruro.tv/";
        if (hostname.includes("kwik")) return "https://kwik.cx/";
        if (hostname.includes("owocdn") || hostname.includes("uwucdn")) return "https://kwik.cx/";
        if (hostname.includes("krussdomi")) return "https://krussdomi.com/";
        if (hostname.includes("megaplay")) return "https://megaplay.buzz/";
        if (hostname.includes("vibeplayer") || hostname.includes("vivibebe")) return "https://vibeplayer.site/";
        if (hostname.includes("animeapps")) return "https://animex.one/";
        if (hostname.includes("nekostream")) return "https://www.miruro.tv/";
        if (hostname.includes("slopnet") || hostname.includes("flixcloud")) return "https://flixcloud.cc/";
        if (hostname.includes("kyren")) return "https://kyren.moe/";
        if (hostname.includes("anikage")) return "https://anikage.cc/";
        if (hostname.includes("ani.pm")) return "https://ani.pm/";
        if (hostname.includes("ninstream") || hostname.includes("senshi")) return "https://senshi.live/";
        if (hostname.includes("xin-cdn") || hostname.includes("anizone")) return "https://anizone.to/";
        if (hostname.includes("animeheaven")) return "https://animeheaven.me/";
        if (hostname.includes("allanime") || hostname.includes("allmanga")) return "https://allanime.uns.bio/";
        if (hostname.includes("lostproject")) return "https://megaplay.buzz/"; // VERIFIED: lostproject requires megaplay referer
        if (hostname.includes("animeonsen")) return "https://www.animeonsen.xyz/";
        if (hostname.includes("vid-cdn")) return "https://luna.animeaqua.net/";
        if (hostname.includes("anizara")) return "https://anineko.to/"; // AniNeko.to subtitle CDN
        if (hostname.includes("vidtube")) return "https://anichi.to/"; // Anichi.to embed CDN
        return "https://www.miruro.tv/"; // default
      } catch {
        return "https://www.miruro.tv/";
      }
    }

    // Wrap subtitle URLs through the dedicated subtitle worker (or /api/stream
    // fallback). Used for CF-protected CDNs. ASS subtitles are kept — the
    // luffytv-subs worker converts them to VTT.
    function wrapSubsVercel(tracks: Array<{ url: string; lang?: string; label?: string }> | undefined, referer: string): Array<{ url: string; lang: string; label: string }> {
      if (!tracks || tracks.length === 0) return [];
      return tracks.map(t => {
        const url = (t.url || "").replace(/^https?:\/\/\/+/i, "https://");
        const ref = referer || getRefererForSubtitle(url);
        if (SUBS_WORKER) {
          return {
            url: url.startsWith("http")
              ? `${SUBS_WORKER}/sub?url=${encodeURIComponent(url)}&ref=${encodeURIComponent(ref)}`
              : url,
            lang: t.lang || "en",
            label: t.label || "English",
          };
        }
        return {
          url: url.startsWith("http")
            ? `/api/stream?url=${encodeURIComponent(url)}&referer=${encodeURIComponent(ref)}`
            : url,
          lang: t.lang || "en",
          label: t.label || "English",
        };
      });
    }

    const servers: Array<{
      id: string;
      name: string;
      source: "animex" | "anidb" | "anineko" | "anidap" | "anikage" | "senshi" | "allmanga" | "anizone" | "aniwaves" | "anilight" | "kyren" | "anikoto" | "reanime" | "luna" | "anipm" | "anichi" | "anineko-to";
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
      // AnimePahe (priority 0.8) — pure m3u8 + subtitles, CF bypass via scraper
      (async () => {
        try {
          const paheResults = await withTimeout(
            fetchAnimePaheSources(id, epNum, title).catch(() => []),
            10000,
            [],
          );
          if (paheResults?.length) {
            let p = 0.8;
            for (const r of paheResults) {
              servers.push({
                id: `animepahe:${r.provider}:${r.type}`,
                name: `AnimePahe ${r.quality}${r.type === "dub" ? " (Dub)" : ""}`,
                source: "animepahe" as any,
                provider: r.provider,
                type: r.type,
                quality: r.quality || "1080p",
                streamUrl: r.streamUrl,
                isM3U8: r.isM3U8,
                isMP4: r.isMP4,
                isEmbed: false,
                hardsub: r.hardsub,
                priority: p++,
                subtitleTracks: r.tracks,
                intro: r.intro || null,
                outro: r.outro || null,
              });
            }
          }
        } catch {}
      })(),
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
          if (kr?.length) { let p = 3; for (const r of kr) servers.push({ id: `kyren:${r.server}:${r.type}`, name: `Kyren ${r.server.charAt(0).toUpperCase() + r.server.slice(1)}${r.type === "dub" ? " (Dub)" : ""}`, source: "kyren", provider: r.server, type: r.type, quality: r.quality || "1080p", streamUrl: r.streamUrl, isM3U8: r.isM3U8, isMP4: r.isMP4, isEmbed: false, hardsub: false, priority: p++, subtitleTracks: wrapSubsVercel(r.tracks as any, "https://kyren.moe/") }); }
        } catch {}
      })(),
      // AniDap (priority 4) — fetch ALL providers in parallel
      (async () => {
        try {
          const adResults = await withTimeout(
            fetchAllAniDapSources(id, epNum, { sub: true, dub: true, timeoutMs: 12000 }).catch(() => []),
            12000,
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
                subtitleTracks: wrapSubsVercel(r.tracks as any, "https://megaplay.buzz/"),
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
          if (pm?.length) { let p = 5; for (const r of pm) { if (!r.streamUrl) continue; servers.push({ id: `anipm:${r.provider}:${r.type}`, name: `AniPm ${r.provider}${r.type === "dub" ? " (Dub)" : ""}`, source: "anipm" as any, provider: r.provider, type: r.type, quality: r.quality || "1080p", streamUrl: r.streamUrl, isM3U8: r.isM3U8, isMP4: r.isMP4, isEmbed: r.isEmbed, hardsub: r.hardsub, priority: p++, subtitleTracks: wrapSubsVercel(r.tracks as any, "https://ani.pm/") }); } }
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
          al.filter((r: any) => r.type === "sub").slice(0, 3).forEach((r: any, i: number) => servers.push({ id: `anilight:sub:${i}`, name: `AniLight ${r.quality}`.trim(), source: "anilight", provider: "anilight", type: "sub", quality: r.quality || "1080p", streamUrl: r.streamUrl, isM3U8: r.isM3U8, isMP4: r.isMP4, isEmbed: false, hardsub: false, priority: 9 + i * 0.1, subtitleTracks: wrapSubsVercel(r.tracks as any, "https://anilight.live/") }))
          al.filter((r: any) => r.type === "dub").slice(0, 3).forEach((r: any, i: number) => servers.push({ id: `anilight:dub:${i}`, name: `AniLight ${r.quality} (Dub)`.trim(), source: "anilight", provider: "anilight", type: "dub", quality: r.quality || "1080p", streamUrl: r.streamUrl, isM3U8: r.isM3U8, isMP4: r.isMP4, isEmbed: false, hardsub: false, priority: 9.5 + i * 0.1, subtitleTracks: wrapSubsVercel(r.tracks as any, "https://anilight.live/") }))
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
                subtitleTracks: wrapSubsVercel(srv.subtitleTracks as any, "https://megaplay.buzz/"),
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

      // ── Anichi.to (priority 0.5 — embed streams with skip times) ──
      // New site, returns embed URLs (vidtube/megaplay) + intro/outro skip data
      (async () => {
        try {
          const anichiResults = await withTimeout(
            resolveAnichiStreams(id, epNum, title),
            10000,
            [],
          );
          if (anichiResults?.length) {
            let p = 0.5;
            for (const r of anichiResults) {
              // Use the FULL stream URL (path + query) for guaranteed unique ID.
              // Previous 8-char hash caused collisions when two servers shared
              // the same path prefix (e.g. megaplay.buzz/stream/s-5/73497/sub
              // for both HD-1 and Vidstream-2).
              let urlKey = "unknown";
              try {
                const u = new URL(r.streamUrl);
                urlKey = (u.hostname.split(".")[0] + u.pathname + u.search).slice(0, 60);
              } catch {}
              servers.push({
                id: `anichi:${urlKey}:${r.type}${r.hardsub ? ":hsub" : ""}`,
                name: `Anichi ${r.serverName}${r.type === "dub" ? " (Dub)" : r.hardsub ? " (HS)" : ""}`,
                source: "anichi" as any,
                provider: r.serverName.toLowerCase().replace(/\s/g, ""),
                type: r.type,
                quality: r.quality || "1080p",
                streamUrl: r.streamUrl,
                isM3U8: r.isM3U8,
                isMP4: r.isMP4,
                isEmbed: r.isEmbed,
                hardsub: r.hardsub,
                priority: p,
                subtitleTracks: wrapSubs(r.subtitleTracks),
                intro: r.intro || null,
                outro: r.outro || null,
              });
              p += 0.1;
            }
          }
        } catch {}
      })(),

      // ── AniNeko.to (priority 0.6 — embed streams WITH subtitles!) ──
      // New site, returns embed URLs + soft sub subtitle URLs from cdn.anizara.store
      (async () => {
        try {
          const aninekoResults = await withTimeout(
            resolveAninekoStreams(id, epNum, title),
            10000,
            [],
          );
          if (aninekoResults?.length) {
            let p = 0.6;
            for (const r of aninekoResults) {
              // Use the FULL stream URL (path + query) for guaranteed unique ID.
              let urlKey = "unknown";
              try {
                const u = new URL(r.streamUrl);
                urlKey = (u.hostname.split(".")[0] + u.pathname + u.search).slice(0, 60);
              } catch {}
              servers.push({
                id: `anineko-to:${urlKey}:${r.type}${r.hardsub ? ":hsub" : ""}`,
                name: `AniNeko ${r.serverName}${r.type === "dub" ? " (Dub)" : r.hardsub ? " (HS)" : ""}`,
                source: "anineko-to" as any,
                provider: r.serverName.toLowerCase().replace(/\s/g, ""),
                type: r.type,
                quality: r.quality || "1080p",
                streamUrl: r.streamUrl,
                isM3U8: r.isM3U8,
                isMP4: r.isMP4,
                isEmbed: r.isEmbed,
                hardsub: r.hardsub,
                priority: p,
                subtitleTracks: wrapSubs(r.subtitleTracks),
                intro: null,
                outro: null,
              });
              p += 0.1;
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
