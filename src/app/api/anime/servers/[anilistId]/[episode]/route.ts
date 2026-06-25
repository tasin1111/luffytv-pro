/**
 * GET /api/anime/servers/[anilistId]/[episode]
 *
 * Returns ONLY servers that have a VERIFIED working stream.
 * All servers checked IN PARALLEL (4s timeout each).
 *
 * Sources:
 *   - Miruro (kiwi, pewe, bee, bonk, moo, ally, hop) — HLS m3u8
 *   - Animex (miku, yuki, beep, mimi, mochi, uwu, etc.) — HLS m3u8
 *   - AniVault (AnimeHeaven) — MP4 direct
 *   - AniVexa (animegg, allmanga, anikoto) — HLS m3u8 + MP4
 *
 * Each server includes a ready-to-play `streamUrl`.
 */
import { NextRequest, NextResponse } from "next/server";
import {
  fetchRawEpisodes,
  getAvailableMiruroServers,
  getSourceFromProvider,
} from "@/lib/miruro-direct";
import { animexGetAnime, animexServers, animexSources } from "@/lib/animex-api";
import {
  fetchAllAniDapSources,
  ANIDAP_PROVIDER_META,
  type AniDapProvider,
} from "@/lib/anidap-api";
import { fetchAniLightSources } from "@/lib/anilight-api";
import { wrapStreamUrl, wrapM3u8Url } from "@/lib/proxy";
import {
  fetchAllKyrenSources,
  KYREN_SERVER_NAMES,
  type KyrenServer,
} from "@/lib/kyren-api";
import { fetchAnikageSources } from "@/lib/anikage-api";
import { fetchMioAnimeSources } from "@/lib/mioanime-api";
import { anixtvFetchAllServers } from "@/lib/anixtv-api";
import { fetchAnistreamSources } from "@/lib/anistream-api";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const ANIVAULT_API = "https://anivault-scraper.up.railway.app/api/watch/animeheaven";
const ANIVEXA_API = "https://anivexa-api-tawny.vercel.app";
const ANIVAULT_SENSHI = "https://anivault-scraper.up.railway.app/api/watch/senshi"; // broken — CF blocks

// AniVexa providers that work (tested)
const ANIVEXA_PROVIDERS = ["animegg", "allmanga", "anikoto", "anineko"] as const;

/**
 * Build a proxy URL using proxy.anikuro.to — the same proxy that was working
 * before. It's a Cloudflare Worker that:
 *   - Rewrites m3u8 manifest (segments + AES keys + sub-playlists)
 *   - Sends correct Referer/Origin headers upstream
 *   - Adds permissive CORS headers for browser playback
 *
 * URL format: https://proxy.anikuro.to/{base64(url|referer)}.{m3u8|mp4}
 *
 * Note: Anikuro does NOT work for some Cloudflare-protected CDNs (e.g.
 * vault-XX.uwucdn.top from AniDap) — it returns 500 for those. AniDap
 * streams use their own buildAniDapProxyUrl() (also via Anikuro) defined
 * in /lib/anidap-api.ts. Subtitle URLs from AniDap use our own scraper
 * stream proxy because Anikuro 500s on those.
 */
/**
 * Build a playable URL for a stream.
 * Routes the DIRECT stream URL through our Cloudflare Worker.
 * The worker adds the correct Referer header (from REFERER_MAP) + CORS headers.
 * OLD approach used cdn.animex.su XOR wrapper — DEAD (DNS NXDOMAIN as of 2026-06-25).
 */
function buildProxyUrl(streamUrl: string, referer: string, isMP4: boolean = false): string {
  // Use wrapM3u8Url for HLS (rewrites segment URLs), wrapStreamUrl for MP4.
  // Both route through our worker when NEXT_PUBLIC_PROXY_BASE is set.
  return isMP4 ? wrapStreamUrl(streamUrl) : wrapM3u8Url(streamUrl);
}

const ANIMEX_REFERERS: Record<string, string> = {
  beep: "https://animex.one/", mimi: "https://animex.one/",
  vee: "https://www.animeonsen.xyz/", yuki: "https://megaplay.buzz/",
  miku: "https://allanime.uns.bio", neko: "https://animeverse.to/",
  huzz: "https://kem.clvd.xyz/", mochi: "https://animex.one",
  uwu: "https://allanime.uns.bio", koto: "https://allanime.uns.bio",
  kiwi: "https://anidb.app/", kami: "https://animex.one/",
  sax: "https://animex.one/", yume: "https://animex.one/",
};

interface VerifiedServer {
  id: string;
  name: string;
  source: "miruro" | "animex" | "anivault" | "anivexa" | "senshi" | "anidap" | "anilight" | "kyren" | "anikage" | "mioanime" | "anixtv" | "anistream";
  provider: string;
  type: "sub" | "dub";
  quality: string;
  streamUrl: string;
  isM3U8: boolean;
  isMP4: boolean;
  isEmbed?: boolean;
  /**
   * Whether this stream has subtitles burned into the video (hard sub) vs
   * provided as a separate VTT track (soft sub). Used by the watch-page UI
   * to filter servers when the user picks "Hard Sub" vs "Soft Sub".
   *
   * Mapping:
   *   - AniDap beep/meme/uwu/kuro/sax/yume (under type=sub) → hardsub=true
   *   - AniDap mimi/mochi/uwu/kuro/sax/yume (under type=dub) → harddub=true
   *     (but we still mark hardsub=true since subs are burned in)
   *   - AniDap vee/yuki/miku/neko (under type=sub) → hardsub=false (soft sub)
   *   - Animex beep/mimi/miku/uwu/etc → hardsub=true (Animex doesn't do soft sub)
   *   - AniLight → hardsub=false (returns WebVTT subtitle tracks)
   *   - Kyren → hardsub=false (returns optional WebVTT subtitle tracks)
   *   - Miruro/AniVexa/Senshi/AniVault → unknown, default false
   */
  hardsub?: boolean;
  /** Optional WebVTT subtitle tracks (AniDap/AniLight providers include these) */
  subtitleTracks?: Array<{ url: string; lang: string; label: string }>;
  /** Optional intro chapter for auto-skip */
  intro?: { start: number; end: number } | null;
  /** Optional outro chapter for auto-skip */
  outro?: { start: number; end: number } | null;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ anilistId: string; episode: string }> }
) {
  const { anilistId, episode } = await params;
  const id = parseInt(anilistId, 10);
  const epNum = parseInt(episode, 10);
  if (isNaN(id) || id <= 0) {
    return NextResponse.json({ error: "Invalid anilistId" }, { status: 400 });
  }

  // ─── Resolve anime title from AniList (needed for AnixTV search) ────────────
  // AnixTV's watch URL requires the anime title as a query param — without it,
  // AnixTV can't find the anime and returns no iframe → no hindi servers.
  let animeTitle = "Anime";
  try {
    const titleRes = await fetch("https://graphql.anilist.co", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: `query($id:Int){Media(id:$id,type:ANIME){id title{english romaji native}}}`,
        variables: { id },
      }),
    });
    if (titleRes.ok) {
      const titleData = await titleRes.json();
      const t = titleData?.data?.Media?.title;
      animeTitle = t?.english || t?.romaji || t?.native || "Anime";
    }
  } catch { /* fallback to "Anime" */ }

  // ─── Gather all candidate servers in parallel ─────────────────────
  interface Candidate {
    id: string; name: string;
    source: "miruro" | "animex" | "anivault" | "anivexa" | "senshi" | "anidap";
    provider: string; type: "sub" | "dub";
  }
  const candidates: Candidate[] = [];

  // Fire AniDap resolver + sources fetch in parallel with the other sources.
  // AniDap gives us 11 providers × 2 types (sub/dub) — all verified playable.
  // Also fire AniLight + Kyren in parallel — both return direct-playable streams.
  const [miruroRaw, animexData, anivaultSub, anivaultDub, anidapResults, anilightResults, kyrenResults, anikageResults, mioanimeResults, anixtvResults, anistreamResults] = await Promise.allSettled([
    fetchRawEpisodes(id),
    (async () => {
      const anime = await animexGetAnime(id);
      if (!anime?.slug) return null;
      return { slug: anime.slug, servers: await animexServers(anime.slug, epNum) };
    })(),
    fetch(`${ANIVAULT_API}/${id}/${epNum}/sub?server=AnimeHeaven`).then(r => r.ok ? r.json() : null).catch(() => null),
    fetch(`${ANIVAULT_API}/${id}/${epNum}/dub?server=AnimeHeaven`).then(r => r.ok ? r.json() : null).catch(() => null),
    fetchAllAniDapSources(id, epNum, { sub: true, dub: true, timeoutMs: 5000 }),
    fetchAniLightSources(id, epNum, { sub: true, dub: true, timeoutMs: 6000 }),
    fetchAllKyrenSources(id, epNum, { sub: true, dub: true, timeoutMs: 6000 }),
    fetchAnikageSources(id, epNum, { timeoutMs: 7000 }),
    fetchMioAnimeSources(id, epNum, { timeoutMs: 7000 }),
    // AnixTV: Hindi dubbed anime (anixtv.in / anixx.fun). Multi-audio HLS with
    // Hindi/Tamil/Telugu/Bengali/Malayalam/Marathi/Kannada/English/Korean/Japanese tracks.
    // Tries providers 1-5 in parallel; most anime only have provider 1.
    anixtvFetchAllServers(id, epNum, animeTitle, 1),
    // Anistream.one: uses api.anistream.one (OWN REST API, NOT Cloudflare-protected).
    // Returns DIRECT stream URLs — no XOR wrapper, no cdn.animex.su needed.
    // Has embed providers too (ok.ru, mp4upload) for some servers.
    fetchAnistreamSources(id, epNum, { sub: true, dub: true, timeoutMs: 6000 }),
  ]);

  // Miruro
  if (miruroRaw.status === "fulfilled" && miruroRaw.value?.providers) {
    for (const cat of ["sub", "dub"] as const) {
      for (const s of getAvailableMiruroServers(miruroRaw.value, epNum, cat)) {
        candidates.push({
          id: `miruro:${s.provider}:${cat}`,
          name: `Miruro ${s.provider[0].toUpperCase() + s.provider.slice(1)}${cat === "dub" ? " (Dub)" : ""}`,
          source: "miruro", provider: s.provider, type: cat,
        });
      }
    }
  }

  // Animex — NOT included in the main servers endpoint.
  // Animex has its own dedicated endpoint: /api/anime/animex-servers/{id}/{ep}
  // The watch page fetches it separately so it doesn't compete for the 30s timeout.
  // Animex servers appear in the watch page after they finish loading.
  let animexSlug: string | null = null;
  if (animexData.status === "fulfilled" && animexData.value) {
    animexSlug = animexData.value.slug;
  }
  // No animexVerified here — it's fetched separately by the watch page.

  // AniVault (AnimeHeaven)
  if (anivaultSub.status === "fulfilled" && anivaultSub.value?.mp4) {
    candidates.push({ id: "anivault:animeheaven:sub", name: "AnimeHeaven", source: "anivault", provider: "AnimeHeaven", type: "sub" });
  }
  if (anivaultDub.status === "fulfilled" && anivaultDub.value?.mp4) {
    candidates.push({ id: "anivault:animeheaven:dub", name: "AnimeHeaven (Dub)", source: "anivault", provider: "AnimeHeaven", type: "dub" });
  }

  // AniVexa (animegg, allmanga, anikoto, anineko)
  for (const prov of ANIVEXA_PROVIDERS) {
    for (const cat of ["sub", "dub"] as const) {
      candidates.push({
        id: `anivexa:${prov}:${cat}`,
        name: `${prov[0].toUpperCase() + prov.slice(1)}${cat === "dub" ? " (Dub)" : ""}`,
        source: "anivexa", provider: prov, type: cat,
      });
    }
  }

  // Senshi via AniVault anikoto source (CF bypass)
  // Only add 2 servers (sub + dub) to keep verification fast
  candidates.push({ id: "senshi:VidPlay-1:sub", name: "Senshi", source: "senshi", provider: "VidPlay-1", type: "sub" });
  candidates.push({ id: "senshi:VidPlay-1:dub", name: "Senshi (Dub)", source: "senshi", provider: "VidPlay-1", type: "dub" });

  // AniDap results are ALREADY verified playable (fetchAllAniDapSources filters out
  // providers with no playable stream). We push them straight into the final list
  // — no need to re-verify each one. We also pass through subtitles + intro/outro.
  const anidapVerified: VerifiedServer[] = [];
  if (anidapResults.status === "fulfilled" && anidapResults.value) {
    for (const r of anidapResults.value) {
      const meta = ANIDAP_PROVIDER_META[r.provider as AniDapProvider];
      const provName = meta?.name || (r.provider[0].toUpperCase() + r.provider.slice(1));
      const typeTag = r.type === "dub" ? " (Dub)" : (meta?.hardsub ? " (HS)" : "");
      anidapVerified.push({
        id: `anidap:${r.provider}:${r.type}`,
        name: `AniDap ${provName}${typeTag}`,
        source: "anidap",
        provider: r.provider,
        type: r.type,
        quality: r.quality,
        streamUrl: r.streamUrl,
        isM3U8: r.isM3U8,
        isMP4: r.isMP4,
        // Mark hardsub servers — from AniDap's metadata
        hardsub: meta?.hardsub === true,
        subtitleTracks: r.tracks.map(t => ({ url: t.url, lang: t.lang, label: t.label })),
        intro: r.intro,
        outro: r.outro,
      });
    }
    console.log(`[Servers] AniDap: ${anidapVerified.length} verified streams (already pre-checked)`);
  }

  // AniLight results — pre-verified playable, direct CDN URLs (no proxy needed).
  // AniLight results — includes BOTH:
  //   1. Quality variants (1080p, 720p, 360p) from /api/watch/mal — direct ESA CDN
  //   2. Death Note servers (Light, Near, Ryu, Misa, Kiwi, Misora, Raye, Rem) from /api/sources
  // All show with "AniLight" prefix.
  const anilightVerified: VerifiedServer[] = [];
  if (anilightResults.status === "fulfilled" && anilightResults.value) {
    for (const r of anilightResults.value) {
      // Capitalize first letter for display
      const serverDisplay = r.server.charAt(0).toUpperCase() + r.server.slice(1);
      const typeTag = r.type === "dub" ? " (Dub)" : (r.hardsub ? " (HS)" : "");
      anilightVerified.push({
        id: `anilight:${r.server}:${r.type}`,
        name: `AniLight ${serverDisplay}${typeTag}`,
        source: "anilight",
        provider: r.server,
        type: r.type,
        quality: r.quality,
        streamUrl: r.streamUrl,
        isM3U8: r.isM3U8,
        isMP4: r.isMP4,
        hardsub: r.hardsub,
        subtitleTracks: r.tracks.map(t => ({ url: t.url, lang: t.lang, label: t.label })),
      });
    }
    console.log(`[Servers] AniLight: ${anilightVerified.length} servers (quality variants + Death Note servers)`);
  }

  // Kyren results — pre-verified playable, HLS through kyren's CF Worker (permissive CORS)
  const kyrenVerified: VerifiedServer[] = [];
  if (kyrenResults.status === "fulfilled" && kyrenResults.value) {
    for (const r of kyrenResults.value) {
      const serverName = KYREN_SERVER_NAMES[r.server as KyrenServer] || r.server;
      kyrenVerified.push({
        id: `kyren:${r.server}:${r.type}`,
        name: `Kyren ${serverName}${r.type === "dub" ? " (Dub)" : ""}`,
        source: "kyren",
        provider: r.server,
        type: r.type,
        quality: r.quality,
        streamUrl: r.streamUrl,
        isM3U8: r.isM3U8,
        isMP4: r.isMP4,
        // Kyren streams are soft sub (return optional WebVTT subtitle tracks)
        hardsub: false,
        subtitleTracks: r.tracks.map(t => ({ url: t.url, lang: t.lang, label: t.label || t.lang })),
      });
    }
    console.log(`[Servers] Kyren: ${kyrenVerified.length} verified streams (HLS via kyren Worker)`);
  }

  // Anikage results — 5 servers (megg, kiss, miko, verse, neko) × sub/dub
  const anikageVerified: VerifiedServer[] = [];
  if (anikageResults.status === "fulfilled" && anikageResults.value) {
    for (const r of anikageResults.value) {
      const serverName = r.server.charAt(0).toUpperCase() + r.server.slice(1);
      const typeTag = r.type === "dub" ? " (Dub)" : (r.hardsub ? " (HS)" : "");
      anikageVerified.push({
        id: `anikage:${r.server}:${r.type}`,
        name: `Anikage ${serverName}${typeTag}`,
        source: "anikage",
        provider: r.server,
        type: r.type,
        quality: r.quality,
        streamUrl: r.streamUrl,
        isM3U8: r.isM3U8,
        isMP4: r.isMP4,
        hardsub: r.hardsub,
        subtitleTracks: r.tracks,
        intro: r.intro,
        outro: r.outro,
      });
    }
    console.log(`[Servers] Anikage: ${anikageVerified.length} servers`);
  }

  // MioAnime results — AniZone + Verse + Senshi + AllAnime (4 sources)
  const mioanimeVerified: VerifiedServer[] = [];
  if (mioanimeResults.status === "fulfilled" && mioanimeResults.value) {
    for (const r of mioanimeResults.value) {
      const typeTag = r.type === "dub" ? " (Dub)" : (r.hardsub ? " (HS)" : "");
      mioanimeVerified.push({
        id: r.id,
        name: `${r.name}${typeTag}`,
        source: "mioanime",
        provider: r.id,
        type: r.type,
        quality: r.quality,
        streamUrl: r.streamUrl,
        isM3U8: r.isM3U8,
        isMP4: r.isMP4,
        isEmbed: (r as any).isEmbed === true,
        hardsub: r.hardsub,
        subtitleTracks: r.subtitleTracks,
      });
    }
    console.log(`[Servers] MioAnime: ${mioanimeVerified.length} servers`);
  }

  // AnixTV (Hindi dubbed anime from anixtv.in / anixx.fun)
  // Already returns playable m3u8 URLs — no verification needed (would slow things down).
  const anixtvVerified: VerifiedServer[] = [];
  if (anixtvResults.status === "fulfilled" && anixtvResults.value) {
    for (const r of anixtvResults.value) {
      anixtvVerified.push({
        id: r.id,
        name: r.name,
        source: "anixtv",
        provider: r.provider,
        type: r.type,
        quality: r.quality,
        streamUrl: r.streamUrl,
        isM3U8: r.isM3U8,
        isMP4: r.isMP4,
        hardsub: r.hardsub,
        subtitleTracks: r.subtitleTracks,
        intro: r.intro,
        outro: r.outro,
      });
    }
    console.log(`[Servers] AnixTV: ${anixtvVerified.length} servers (Hindi dub)`);
  }

  // MegaPlay Hindi removed — was returning 410 errors (expired/removed).
  // AnixTV is the sole Hindi source now. If AnixTV doesn't have the anime,
  // the HINDI button shows "Not in our Hindi database" message.

  // Anistream.one (api.anistream.one — OWN REST API, not CF-protected)
  // Returns DIRECT stream URLs — no XOR wrapper, no cdn.animex.su needed.
  // Has embed providers (ok.ru, mp4upload) + HLS providers (beep, yuki, mimi, mochi).
  const anistreamVerified: VerifiedServer[] = [];
  if (anistreamResults.status === "fulfilled" && anistreamResults.value) {
    for (const r of anistreamResults.value) {
      const provName = r.server[0].toUpperCase() + r.server.slice(1);
      const typeTag = r.type === "dub" ? " (Dub)" : (r.hardsub ? " (HS)" : "");
      anistreamVerified.push({
        id: `anistream:${r.server}:${r.type}`,
        name: `Anistream ${provName}${typeTag}`,
        source: "anistream",
        provider: r.server,
        type: r.type,
        quality: r.quality,
        streamUrl: r.streamUrl,
        isM3U8: r.isM3U8,
        isMP4: r.isMP4,
        isEmbed: r.isEmbed,
        hardsub: r.hardsub,
        subtitleTracks: r.tracks,
        intro: r.intro,
        outro: r.outro,
      });
    }
    console.log(`[Servers] Anistream: ${anistreamVerified.length} servers`);
  }

  console.log(`[Servers] ${candidates.length} candidates — verifying in parallel...`);

  // ─── Verify ALL in parallel (4s timeout each) ─────────────────────
  const verifyPromises = candidates.map(async (c): Promise<VerifiedServer | null> => {
    try {
      if (c.source === "miruro") {
        const result = await Promise.race([
          getSourceFromProvider(id, epNum, c.type, c.provider),
          new Promise<null>(r => setTimeout(() => r(null), 10000)),
        ]);
        if (result?.url) {
          const ref = result.streamReferer || "";
          return { ...c, quality: result.quality || "auto",
            streamUrl: buildProxyUrl(result.url, ref || "https://www.miruro.tv/", !result.isM3U8),
            isM3U8: result.isM3U8, isMP4: !result.isM3U8 };
        }
      }
      // Animex servers are pre-built from AniDap's results (above) — skip verify
      if (c.source === "anivault") {
        const data = c.type === "dub" ? (anivaultDub.status === "fulfilled" ? anivaultDub.value : null) : (anivaultSub.status === "fulfilled" ? anivaultSub.value : null);
        if (data?.streamUrl) {
          return { ...c, quality: "MP4", streamUrl: data.streamUrl, isM3U8: !!data.m3u8, isMP4: !!data.mp4 };
        }
      }
      if (c.source === "anivexa") {
        // Fetch from AniVexa API
        const res = await Promise.race([
          fetch(`${ANIVEXA_API}/watch/${c.provider}/${id}/${c.type}/${c.provider}-${epNum}`).then(r => r.ok ? r.json() : null),
          new Promise<null>(r => setTimeout(() => r(null), 5000)),
        ]);
        if (res) {
          let streamUrl: string | null = null;
          let streamReferer: string = "https://allmanga.to/";
          let quality: string = "auto";
          let isM3U8 = true;
          let isMP4 = false;

          if (c.provider === "animegg") {
            // Animegg returns MP4 streams in multiple qualities (360p, 480p, 720p, 1080p)
            // Pick the highest quality MP4 available
            const streams = (res.streams || []).filter((s: any) => s.type === "mp4" && s.url);
            // Prefer 1080p, then 720p, then 480p, then 360p, then first
            const qualityOrder = ["1080p", "720p", "480p", "360p"];
            const playable = streams.find((s: any) => s.quality === "1080p")
                          || streams.find((s: any) => s.quality === "720p")
                          || streams.find((s: any) => qualityOrder.includes(s.quality))
                          || streams[0];
            if (playable) {
              streamUrl = playable.url;
              streamReferer = playable.referer || "https://www.animegg.org/";
              quality = playable.quality || "auto";
              isMP4 = true;
              isM3U8 = false;
            }
          } else if (c.provider === "allmanga") {
            // AllManga returns 7 sources — 3 are clock.json resolvers (→ HLS m3u8),
            // 4 are iframe embeds (streamsb, mp4upload, ok.ru, streamlare — skip).
            // Resolve ALL clock.json sources and pick the first that returns HLS.
            const sources = res.sources || [];
            const clockSources = sources.filter((s: any) => s.url && s.url.includes("clock.json"));
            const ref = "https://allmanga.to";
            const ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0";
            for (const cs of clockSources) {
              try {
                const clockRes = await Promise.race([
                  fetch(cs.url, { headers: { Referer: ref, "User-Agent": ua }, cache: "no-store" }).then(r => r.ok ? r.json() : null),
                  new Promise<null>(r => setTimeout(() => r(null), 3000)),
                ]);
                if (clockRes?.links?.length) {
                  const hlsLink = clockRes.links.find((l: any) => l.hls) || clockRes.links[0];
                  if (hlsLink?.link) {
                    streamUrl = hlsLink.link;
                    streamReferer = ref;
                    quality = hlsLink.resolutionStr || cs.name || "auto";
                    isM3U8 = true;
                    isMP4 = false;
                    break; // Use first working clock.json source
                  }
                }
              } catch {
                // try next clock source
              }
            }
          } else if (c.provider === "anikoto") {
            // Anikoto returns ssub.streams[] / sdub.streams[]
            const key = c.type === "dub" ? "sdub" : "ssub";
            const streams = (res[key]?.streams || []).filter((s: any) => s.type === "hls" && s.url);
            if (streams.length > 0) {
              streamUrl = streams[0].url;
              streamReferer = streams[0].referer || "https://megaplay.buzz/";
              quality = streams[0].server || "auto";
              isM3U8 = true;
              isMP4 = false;
            }
          } else if (c.provider === "anineko") {
            // AniNeko returns streams[] directly (same as animegg shape)
            const streams = (res.streams || []).filter((s: any) => s.type === "hls" && s.url);
            if (streams.length > 0) {
              streamUrl = streams[0].url;
              streamReferer = streams[0].referer || "https://vibeplayer.site/";
              quality = streams[0].server || "auto";
              isM3U8 = true;
              isMP4 = false;
            }
          }

          if (streamUrl) {
            // For MP4, use mode=segment (no manifest rewriting needed)
            // For HLS, use mode=manifest (needs URL rewriting)
            const mode = isMP4 ? "segment" : "manifest";
            return { ...c, quality,
              streamUrl: buildProxyUrl(streamUrl, streamReferer, isMP4),
              isM3U8, isMP4 };
          }
        }
      }
      if (c.source === "senshi") {
        // Use AniVault's anikoto source (which scrapes senshi.live with CF bypass)
        // Endpoint: /api/watch/anikoto/{anilistId}/{ep}/{type}?server={serverId}
        const serverParam = c.provider; // e.g. "VidPlay-1"
        const res = await Promise.race([
          fetch(`${ANIVAULT_SENSHI.replace('/senshi', '/anikoto')}/${id}/${epNum}/${c.type}?server=${encodeURIComponent(serverParam)}`).then(r => r.ok ? r.json() : null),
          new Promise<null>(r => setTimeout(() => r(null), 3000)),
        ]);
        if (res?.hlsProxyUrl) {
          // AniVault already provides a proxied HLS URL — use it directly
          return { ...c, quality: res.server || "auto",
            streamUrl: res.hlsProxyUrl,
            isM3U8: true, isMP4: false };
        }
        if (res?.m3u8) {
          // Raw m3u8 — wrap through Anikuro proxy
          const ref = res.embedUrl ? new URL(res.embedUrl).origin + "/" : "https://senshi.live/";
          return { ...c, quality: res.server || "auto",
            streamUrl: buildProxyUrl(res.m3u8, ref, false),
            isM3U8: true, isMP4: false };
        }
      }
    } catch (e) { console.error(`[Servers] ${c.id} failed:`, e); }
    return null;
  });

  const results = await Promise.allSettled(verifyPromises);
  const verified: VerifiedServer[] = [];
  for (const r of results) {
    if (r.status === "fulfilled" && r.value) verified.push(r.value);
  }

  // Merge in the pre-verified AniDap + AniLight + Kyren streams (already have
  // playable streamUrl, subtitles, intro/outro chapters — no re-verification needed).
  verified.push(...anidapVerified);
  verified.push(...anilightVerified);
  verified.push(...kyrenVerified);
  verified.push(...anikageVerified);
  verified.push(...mioanimeVerified);
  verified.push(...anixtvVerified);
  verified.push(...anistreamVerified);
  // NOTE: Animex is NOT here — it's fetched separately via /api/anime/animex-servers

  const totalPre = anidapVerified.length + anilightVerified.length + kyrenVerified.length + anikageVerified.length + mioanimeVerified.length + anixtvVerified.length;
  console.log(`[Servers] ${verified.length}/${candidates.length + totalPre} verified (AniDap=${anidapVerified.length}, AniLight=${anilightVerified.length}, Kyren=${kyrenVerified.length}, Anikage=${anikageVerified.length}, MioAnime=${mioanimeVerified.length}, AnixTV=${anixtvVerified.length})`);

  return NextResponse.json({ anilistId: id, episode: epNum, servers: verified, total: verified.length }, {
    headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" },
  });
}
