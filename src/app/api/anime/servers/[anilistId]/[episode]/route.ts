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
import { wrapStreamUrl, wrapM3u8Url, wrapM3u8UrlWithReferer } from "@/lib/proxy";
import {
  fetchAllKyrenSources,
  KYREN_SERVER_NAMES,
  type KyrenServer,
} from "@/lib/kyren-api";
import { fetchAnikageSources } from "@/lib/anikage-api";
import { fetchMioAnimeSources } from "@/lib/mioanime-api";
import { fetchAnistreamSources } from "@/lib/anistream-api";
import { fetchAnikuroSources } from "@/lib/anikuro-api";
import { fetchAniPmSources } from "@/lib/anipm-api";
import { fetchAnimetsuSources } from "@/lib/animetsu-api";
import { fetchAnimeHeavenSources } from "@/lib/animeheaven-api";
// AniWaves removed — not working (user request)
import { fetchAllAnimePaheSources, ANIMEPAHE_ENABLED } from "@/lib/animepahe-api";
import { fetchAllOnsenSources, ONSEN_ENABLED } from "@/lib/animeonsen-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

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
 * Build a playable URL for a stream using the 3-tier proxy system.
 * Uses wrapM3u8UrlWithReferer so the source-provided Referer is encoded in the token.
 */
function buildProxyUrl(streamUrl: string, referer: string, isMP4: boolean = false): string {
  if (isMP4) return wrapStreamUrl(streamUrl);
  return wrapM3u8UrlWithReferer(streamUrl, referer);
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
  source: "miruro" | "animex" | "anivault" | "anivexa" | "senshi" | "anidap" | "anilight" | "kyren" | "anikage" | "mioanime" | "anixtv" | "anistream" | "anikuro" | "anipm" | "animetsu" | "animeheaven" | "animepahe" | "animeonsen";
  provider: string;
  type: "sub" | "dub";
  quality: string;
  streamUrl: string;
  isM3U8: boolean;
  isMP4: boolean;
  isEmbed?: boolean;
  isDASH?: boolean;  // DASH .mpd stream (AnimeOnsen — needs dash.js player)
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
  let animeTitles: { english?: string; romaji?: string; native?: string } = {};
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
      animeTitles = { english: t?.english, romaji: t?.romaji, native: t?.native };
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

  // ── INCREASED TIMEOUTS: each source gets more time to respond ──
  // Old: AniDap=4s, others=5-6s. New: AniDap=8s, others=8-10s.
  // This fixes AniDap servers not showing (4s was too short).
  const ANIDAP_TIMEOUT = 8000;
  const OTHER_TIMEOUT = 8000;

  // Fire AniDap resolver + sources fetch in parallel with the other sources.
  // AniDap gives us 11 providers × 2 types (sub/dub) — all verified playable.
  // Also fire AniLight + Kyren + AniKuro + AnimePahe in parallel — all return direct-playable streams.
  const [miruroRaw, animexData, anivaultSub, anivaultDub, anidapResults, anilightResults, kyrenResults, anikageResults, mioanimeResults, anistreamResults, anikuroResults, anipmResults, animetsuResults, animeheavenResults, animepaheResults, onsenResults] = await Promise.allSettled([
    fetchRawEpisodes(id),
    (async () => {
      const anime = await animexGetAnime(id);
      if (!anime?.slug) return null;
      return { slug: anime.slug, servers: await animexServers(anime.slug, epNum) };
    })(),
    fetch(`${ANIVAULT_API}/${id}/${epNum}/sub?server=AnimeHeaven`).then(r => r.ok ? r.json() : null).catch(() => null),
    fetch(`${ANIVAULT_API}/${id}/${epNum}/dub?server=AnimeHeaven`).then(r => r.ok ? r.json() : null).catch(() => null),
    fetchAllAniDapSources(id, epNum, { sub: true, dub: true, timeoutMs: ANIDAP_TIMEOUT }),
    fetchAniLightSources(id, epNum, { sub: true, dub: true, timeoutMs: OTHER_TIMEOUT }),
    fetchAllKyrenSources(id, epNum, { sub: true, dub: true, timeoutMs: OTHER_TIMEOUT }),
    fetchAnikageSources(id, epNum, { timeoutMs: OTHER_TIMEOUT }),
    fetchMioAnimeSources(id, epNum, { timeoutMs: OTHER_TIMEOUT }),
    // Anistream.one: uses api.anistream.one (OWN REST API, NOT Cloudflare-protected).
    // Returns DIRECT stream URLs — no XOR wrapper, no cdn.animex.su needed.
    // Has embed providers too (ok.ru, mp4upload) for some servers.
    fetchAnistreamSources(id, epNum, { sub: true, dub: true, timeoutMs: OTHER_TIMEOUT }),
    // AniKuro.ru: Russian aggregator with 11 providers (animepahe, anikoto, animegg, etc.)
    // Returns stream URLs through proxy.anikuro.ru (base64-encoded, CORS enabled).
    fetchAnikuroSources(id, epNum, { sub: true, dub: true, timeoutMs: OTHER_TIMEOUT }),
    // Played as iframe embeds (kwik.cx blocks server-side scraping).
    // Ani.pm: Full scraper with categorized servers (Nova, Halo, Lyra, Cobalt, Orion, etc.)
    // Returns HLS (via worker proxy), MP4, and embed URLs.
    fetchAniPmSources(id, epNum, { sub: true, dub: true, timeoutMs: OTHER_TIMEOUT }),
    // Animetsu: 4 providers (kite, dio, sage, meg) with 360p/720p/1080p + subtitles + intro/outro
    fetchAnimetsuSources(id, epNum, { sub: true, dub: true, timeoutMs: OTHER_TIMEOUT }),
    // AnimeHeaven.me — direct MP4 streams
    fetchAnimeHeavenSources(id, epNum, { timeoutMs: OTHER_TIMEOUT }),
    // AnimePahe: external scraper with Cloudflare bypass (env-configured).
    // Skipped silently if ANIMEPAHE_SCRAPER_URL and ANIMEPAHE_CF_CLEARANCE are not set.
    ANIMEPAHE_ENABLED
      ? fetchAllAnimePaheSources(id, epNum, animeTitles, { sub: true, dub: true, timeoutMs: OTHER_TIMEOUT })
      : Promise.resolve([]),
    // AnimeOnsen: DASH .mpd streams with ASS subtitles (self-hosted CDN)
    ONSEN_ENABLED
      ? fetchAllOnsenSources(id, epNum, animeTitles, { sub: true, dub: false, timeoutMs: OTHER_TIMEOUT })
      : Promise.resolve([]),
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
      // Detect embed URLs (ok.ru, mp4upload) — these need iframe playback
      const isEmbedUrl = r.streamUrl.includes("ok.ru/videoembed")
                      || r.streamUrl.includes("mp4upload.com/embed")
                      || r.streamUrl.includes("streamlare.com/e/")
                      || r.streamUrl.includes("streamsb.net/e/");
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
        isEmbed: isEmbedUrl,
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

  // Anikage results — HLS (prox.anikage.cc) + embeds (otakuvid, otakuhg, vibeplayer, etc.)
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
        isEmbed: r.isEmbed === true,
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
  // The watch URL itself IS the player — just load it in an iframe.
  // No m3u8 resolution needed, no proxy needed.
  // URL: https://anixtv.in/anime-watch?action=hindi_N_player&id={anilistId}&season=1&episode={ep}&title={title}
  const anixtvVerified: VerifiedServer[] = [];
  // Always add AnixTV Hindi as an embed server — the page itself handles
  // whether the anime exists or not (shows "no video" if not available)
  anixtvVerified.push({
    id: "anixtv:hindi_1:dub",
    name: "AnixTV Hindi",
    source: "anixtv",
    provider: "hindi_1",
    type: "dub",
    quality: "1080p",
    streamUrl: `https://anixtv.in/anime-watch?action=hindi_1_player&id=${id}&season=1&episode=${epNum}&title=${encodeURIComponent(animeTitle)}`,
    isM3U8: false,
    isMP4: false,
    isEmbed: true,  // ← load in iframe, NOT hls.js
    hardsub: false,
    subtitleTracks: [],
    intro: null,
    outro: null,
  });
  console.log(`[Servers] AnixTV: 1 server (Hindi dub embed — direct iframe)`);

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

  // AniKuro.ru (Russian aggregator — 11 providers: animepahe, anikoto, animegg, etc.)
  // Returns proxy.anikuro.ru URLs (base64-encoded, CORS enabled, directly playable).
  const anikuroVerified: VerifiedServer[] = [];
  if (anikuroResults.status === "fulfilled" && anikuroResults.value) {
    const PROVIDER_NAMES: Record<string, string> = {
      animepahe: "AnimePahe", anikoto: "AniKoto", reanime: "ReAnime",
      animedao: "AnimeDao", animegg: "AnimeGG", anidb: "AniDB",
      animedunya: "AnimeDunya", animeverse: "AnimeVerse", allani: "AllAnime",
      senshi: "Senshi", animix: "AniMix",
    };
    for (const r of anikuroResults.value) {
      const provName = PROVIDER_NAMES[r.provider] || (r.provider[0].toUpperCase() + r.provider.slice(1));
      const typeTag = r.type === "dub" ? " (Dub)" : "";
      anikuroVerified.push({
        id: `anikuro:${r.provider}:${r.type}`,
        name: `AniKuro ${provName}${typeTag}`,
        source: "anikuro",
        provider: r.provider,
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
    console.log(`[Servers] AniKuro: ${anikuroVerified.length} servers`);
  }

  // Ani.pm results — only HLS + MP4 servers (skip embeds to avoid duplicates)
  // Each server gets a unique ID based on provider + name + type to prevent
  // the watch page from treating different servers as the same one.
  const anipmVerified: VerifiedServer[] = [];
  if (anipmResults.status === "fulfilled" && anipmResults.value) {
    const seenAnipm = new Set<string>();  // dedupe by provider+name+type
    for (const r of anipmResults.value) {
      // Skip embed URLs — they duplicate the HLS servers and cause confusion
      if (r.isEmbed) continue;

      // Dedupe by provider+name+type (in case API returns same server twice)
      const dedupeKey = `${r.provider}:${r.name}:${r.type}`;
      if (seenAnipm.has(dedupeKey)) continue;
      seenAnipm.add(dedupeKey);

      // Unique ID: anipm:provider:name:type (e.g. anipm:Lyra:Lyra·3:sub)
      const safeName = r.name.replace(/[^a-zA-Z0-9]/g, "");
      anipmVerified.push({
        id: `anipm:${r.provider}:${safeName}:${r.type}`,
        name: `AniPm ${r.name}`,
        source: "anipm",
        provider: r.provider,
        type: r.type,
        quality: r.quality,
        streamUrl: r.streamUrl,
        isM3U8: r.isM3U8,
        isMP4: r.isMP4,
        isEmbed: false,
        hardsub: r.hardsub,
        subtitleTracks: r.tracks,
        intro: null,
        outro: null,
      });
    }
    console.log(`[Servers] AniPm: ${anipmVerified.length} servers (HLS only, deduped)`);
  }

  // Animetsu results — 4 providers (kite, dio, sage, meg) × sub/dub
  // Each returns master m3u8 with 360p/720p/1080p + subtitles + intro/outro skips
  const animetsuVerified: VerifiedServer[] = [];
  if (animetsuResults.status === "fulfilled" && animetsuResults.value) {
    for (const r of animetsuResults.value) {
      animetsuVerified.push({
        id: `animetsu:${r.provider}:${r.type}`,
        name: `Animetsu ${r.provider.charAt(0).toUpperCase() + r.provider.slice(1)}${r.type === "dub" ? " (Dub)" : ""}`,
        source: "animetsu",
        provider: r.provider,
        type: r.type,
        quality: r.quality,
        streamUrl: r.streamUrl,
        isM3U8: r.isM3U8,
        isMP4: r.isMP4,
        isEmbed: false,
        hardsub: false,
        subtitleTracks: r.tracks,
        intro: r.intro,
        outro: r.outro,
      });
    }
    console.log(`[Servers] Animetsu: ${animetsuVerified.length} servers`);
  }

  // AnimeHeaven results — direct MP4 streams
  const animeheavenVerified: VerifiedServer[] = [];
  if (animeheavenResults.status === "fulfilled" && animeheavenResults.value) {
    for (const r of animeheavenResults.value) {
      animeheavenVerified.push({
        id: `animeheaven:${r.provider}:sub`,
        name: `AnimeHeaven`,
        source: "animeheaven",
        provider: r.provider,
        type: "sub",
        quality: r.quality,
        streamUrl: r.streamUrl,
        isM3U8: r.isM3U8,
        isMP4: r.isMP4,
        isEmbed: false,
        hardsub: false,
        subtitleTracks: [],
        intro: null,
        outro: null,
      });
    }
    console.log(`[Servers] AnimeHeaven: ${animeheavenVerified.length} servers`);
  }

  // AniWaves results — embed servers (Vidplay, MyCloud, BYFMS, DGHG, etc.)
  const aniwavesVerified: VerifiedServer[] = [];
  if (aniwavesResults.status === "fulfilled" && aniwavesResults.value) {
    for (const r of aniwavesResults.value) {
      aniwavesVerified.push({
        id: `aniwaves:${r.provider}:${r.type}`,
        name: `AniWaves ${r.provider}${r.type === "dub" ? " (Dub)" : ""}`,
        source: "aniwaves",
        provider: r.provider,
        type: r.type,
        quality: r.quality,
        streamUrl: r.streamUrl,
        isM3U8: r.isM3U8,
        isMP4: r.isMP4,
        isEmbed: true,
        hardsub: false,
        subtitleTracks: [],
        intro: null,
        outro: null,
      });
    }
    console.log(`[Servers] AniWaves: ${aniwavesVerified.length} servers`);
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
            streamUrl: wrapM3u8UrlWithReferer(result.url, ref || "https://www.miruro.tv/"),
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
        // Fetch from AniVexa API (increased timeout from 5s to 8s — was too short)
        const res = await Promise.race([
          fetch(`${ANIVEXA_API}/watch/${c.provider}/${id}/${c.type}/${c.provider}-${epNum}`).then(r => r.ok ? r.json() : null),
          new Promise<null>(r => setTimeout(() => r(null), 8000)),
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
                  new Promise<null>(r => setTimeout(() => r(null), 5000)),
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

  // ─── AnimePahe — pre-verified HLS m3u8 + MP4 streams via kwik.si ───────────
  // (always fires — scraper URL is hardcoded with env var override)
  const animepaheVerified: VerifiedServer[] = [];
  if (animepaheResults.status === "fulfilled" && Array.isArray(animepaheResults.value)) {
    for (const r of animepaheResults.value) {
      const qualityLabel = r.quality || "auto";
      const typeTag = r.type === "dub" ? " (Dub)" : "";
      // Detect embed URLs (kwik.cx raw embed fallback)
      const isEmbed = r.isEmbed === true
                    || r.streamUrl.includes("kwik.cx/e/");
      animepaheVerified.push({
        id: `animepahe:${r.type}:${qualityLabel}`,
        name: `AnimePahe ${qualityLabel}${typeTag}`,
        source: "animepahe",
        provider: "animepahe",
        type: r.type,
        quality: qualityLabel,
        streamUrl: r.streamUrl,
        isM3U8: r.isM3U8,
        isMP4: r.isMP4,
        isEmbed,
        hardsub: false,  // animepahe subs are soft (separate audio track available)
      });
    }
    if (animepaheVerified.length > 0) {
      console.log(`[Servers] AnimePahe: ${animepaheVerified.length} verified streams`);
    }
  }

  // ─── AnimeOnsen — DASH .mpd streams with ASS subtitles ────────────────────
  const onsenVerified: VerifiedServer[] = [];
  if (onsenResults.status === "fulfilled" && Array.isArray(onsenResults.value)) {
    for (const r of onsenResults.value) {
      onsenVerified.push({
        id: `animeonsen:${r.type}`,
        name: `AnimeOnsen ${r.quality}`,
        source: "animeonsen",
        provider: "animeonsen",
        type: r.type,
        quality: r.quality,
        streamUrl: r.streamUrl,
        isM3U8: r.isM3U8,
        isMP4: r.isMP4,
        isDASH: r.isDASH || false,
        hardsub: false,
        subtitleTracks: r.subtitleTracks || [],
        intro: r.intro || null,
        outro: r.outro || null,
      });
    }
    if (onsenVerified.length > 0) {
      console.log(`[Servers] AnimeOnsen: ${onsenVerified.length} verified streams`);
    }
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
  verified.push(...anikuroVerified);
  verified.push(...anipmVerified);
  verified.push(...animetsuVerified);
  verified.push(...animeheavenVerified);
  // AniWaves removed — not working
  verified.push(...animepaheVerified);
  verified.push(...onsenVerified);
  // NOTE: Animex is NOT here — it's fetched separately via /api/anime/animex-servers

  // ── STRICT FILTER: only show servers with a playable stream URL ───────────
  // A server must have:
  //   1. A streamUrl that's > 10 chars (not empty/undefined)
  //   2. The URL must start with http://, https://, or / (relative proxy URL)
  //   3. Must NOT be a data: URI or blob:
  //   4. Must be a playable format:
  //      - HLS (m3u8) → isM3U8 must be true OR url contains .m3u8
  //      - MP4 → isMP4 must be true OR url contains .mp4
  //      - Embed (iframe) → isEmbed must be true (kwik.cx, ok.ru, mp4upload, anixtv)
  //   5. If neither isM3U8, isMP4, nor isEmbed → reject (no playable format)
  const beforeFilter = verified.length;
  const filtered = verified.filter(s => {
    if (!s.streamUrl || s.streamUrl.length <= 10) return false;
    if (s.streamUrl.startsWith("data:") || s.streamUrl.startsWith("blob:")) return false;
    if (!s.streamUrl.startsWith("http") && !s.streamUrl.startsWith("/")) return false;

    // Must have at least one playable format
    const url = s.streamUrl.toLowerCase();
    const isHls = s.isM3U8 === true || url.includes(".m3u8") || url.includes("/m3u8");
    const isMp4 = s.isMP4 === true || url.includes(".mp4");
    const isEmbed = s.isEmbed === true
                  || url.includes("kwik.cx")
                  || url.includes("ok.ru/videoembed")
                  || url.includes("mp4upload.com/embed")
                  || url.includes("streamlare.com/e/")
                  || url.includes("streamsb.net/e/")
                  || url.includes("anixtv.in")
                  || url.includes("/embed/")
                  || url.includes("otakuvid.online/embed")
                  || url.includes("otakuhg.site/e/")
                  || url.includes("bibiemb.xyz/")
                  || url.includes("vibeplayer.site/")
                  || url.includes("playmogo.com/e/")
                  || url.includes("doodstream.com/e/")
                  || url.includes("streamtape.com/e/")
                  || url.includes("voe.sx/e/")
                  || url.includes("mixdrop.ag/e/")
                  || url.includes("upstream.to/e/");
    // Reject if no playable format detected
    const isDash = s.isDASH === true;
    if (!isHls && !isMp4 && !isEmbed && !isDash) return false;

    return true;
  });

  const totalPre = anidapVerified.length + anilightVerified.length + kyrenVerified.length + anikageVerified.length + mioanimeVerified.length + anixtvVerified.length + anistreamVerified.length + anikuroVerified.length + anipmVerified.length + animetsuVerified.length + animeheavenVerified.length + animepaheVerified.length + onsenVerified.length;
  console.log(`[Servers] ${filtered.length}/${beforeFilter} servers (filtered ${beforeFilter - filtered.length} empty/unplayable) — AniDap=${anidapVerified.length}, AniLight=${anilightVerified.length}, Kyren=${kyrenVerified.length}, Anikage=${anikageVerified.length}, MioAnime=${mioanimeVerified.length}, AnixTV=${anixtvVerified.length}, Anistream=${anistreamVerified.length}, AniKuro=${anikuroVerified.length}, AniPm=${anipmVerified.length}, Animetsu=${animetsuVerified.length}, AnimeHeaven=${animeheavenVerified.length}, AnimePahe=${animepaheVerified.length}, AnimeOnsen=${onsenVerified.length}`);

  // ── SORT by priority: Animex → AniDap → AniKuro → Miruro → AniKoto → AniNeko → others ──
  // User requested this specific order so the best servers appear first.
  const SOURCE_PRIORITY: Record<string, number> = {
    animex: 1,     // Animex (fetched separately, appended client-side)
    anidap: 2,     // AniDap (m3u8 + embed)
    animepahe: 3,  // AnimePahe
    animeonsen: 4,  // AnimeOnsen (DASH .mpd, high quality, ASS subs) (HLS m3u8 via aniwatchtv proxy, high quality 1080p, NO watermark)
    anikuro: 5,    // AniKuro (m3u8 via proxy.anikuro.ru)
    miruro: 6,     // Miruro (m3u8 via aniwatchtv)
    anikage: 7,    // AniKage (m3u8 via prox.anikage.cc)
    kyren: 8,      // Kyren (m3u8 via worker)
    anipm: 9,      // AniPm
    animetsu: 10,   // Animetsu (CDN can be flaky)
    animeheaven: 11, // AnimeHeaven (direct MP4)
    anilight: 12,  // AniLight (m3u8 via proxy)
    anivexa: 13,   // AniVexa (m3u8/mp4)
    mioanime: 14,  // MioAnime (m3u8 + embed)
    anistream: 15, // Anistream (m3u8 + embed)
    anixtv: 17,    // AnixTV (Hindi embed)
  };
  // Sort: sub before dub, then by source priority, then by quality
  const sorted = filtered.sort((a, b) => {
    // Sub first, then dub
    if (a.type !== b.type) return a.type === "sub" ? -1 : 1;
    // By source priority
    const pa = SOURCE_PRIORITY[a.source] || 99;
    const pb = SOURCE_PRIORITY[b.source] || 99;
    if (pa !== pb) return pa - pb;
    // By quality (1080p > 720p > 360p > auto)
    const qa = parseInt((a.quality || "").match(/(\d{3,4})/)?.[1] || "0", 10);
    const qb = parseInt((b.quality || "").match(/(\d{3,4})/)?.[1] || "0", 10);
    return qb - qa;
  });

  return NextResponse.json({ anilistId: id, episode: epNum, servers: sorted, total: sorted.length }, {
    headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" },
  });
}
