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

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const ANIVAULT_API = "https://anivault-scraper.up.railway.app/api/watch/animeheaven";
const ANIVEXA_API = "https://anivexa-api-tawny.vercel.app";

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
  source: "miruro" | "animex" | "anivault" | "anivexa";
  provider: string;
  type: "sub" | "dub";
  quality: string;
  streamUrl: string;
  isM3U8: boolean;
  isMP4: boolean;
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

  // ─── Gather all candidate servers in parallel ─────────────────────
  interface Candidate {
    id: string; name: string;
    source: "miruro" | "animex" | "anivault" | "anivexa";
    provider: string; type: "sub" | "dub";
  }
  const candidates: Candidate[] = [];

  const [miruroRaw, animexData, anivaultSub, anivaultDub] = await Promise.allSettled([
    fetchRawEpisodes(id),
    (async () => {
      const anime = await animexGetAnime(id);
      if (!anime?.slug) return null;
      return { slug: anime.slug, servers: await animexServers(anime.slug, epNum) };
    })(),
    fetch(`${ANIVAULT_API}/${id}/${epNum}/sub?server=AnimeHeaven`).then(r => r.ok ? r.json() : null).catch(() => null),
    fetch(`${ANIVAULT_API}/${id}/${epNum}/dub?server=AnimeHeaven`).then(r => r.ok ? r.json() : null).catch(() => null),
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

  // Animex
  let animexSlug: string | null = null;
  if (animexData.status === "fulfilled" && animexData.value) {
    animexSlug = animexData.value.slug;
    for (const cat of ["sub", "dub"] as const) {
      const provs = cat === "dub" ? animexData.value.servers.dubProviders : animexData.value.servers.subProviders;
      for (const p of provs) {
        candidates.push({
          id: `animex:${p.id}:${cat}`,
          name: `Animex ${p.id[0].toUpperCase() + p.id.slice(1)}${cat === "dub" ? " (Dub)" : ""}`,
          source: "animex", provider: p.id, type: cat,
        });
      }
    }
  }

  // AniVault (AnimeHeaven)
  if (anivaultSub.status === "fulfilled" && anivaultSub.value?.mp4) {
    candidates.push({ id: "anivault:animeheaven:sub", name: "AnimeHeaven", source: "anivault", provider: "AnimeHeaven", type: "sub" });
  }
  if (anivaultDub.status === "fulfilled" && anivaultDub.value?.mp4) {
    candidates.push({ id: "anivault:animeheaven:dub", name: "AnimeHeaven (Dub)", source: "anivault", provider: "AnimeHeaven", type: "dub" });
  }

  // AniVexa (animegg, allmanga, anikoto)
  for (const prov of ["animegg", "allmanga", "anikoto"] as const) {
    for (const cat of ["sub", "dub"] as const) {
      candidates.push({
        id: `anivexa:${prov}:${cat}`,
        name: `${prov[0].toUpperCase() + prov.slice(1)}${cat === "dub" ? " (Dub)" : ""}`,
        source: "anivexa", provider: prov, type: cat,
      });
    }
  }

  console.log(`[Servers] ${candidates.length} candidates — verifying in parallel...`);

  // ─── Verify ALL in parallel (4s timeout each) ─────────────────────
  const verifyPromises = candidates.map(async (c): Promise<VerifiedServer | null> => {
    try {
      if (c.source === "miruro") {
        const result = await Promise.race([
          getSourceFromProvider(id, epNum, c.type, c.provider),
          new Promise<null>(r => setTimeout(() => r(null), 4000)),
        ]);
        if (result?.url) {
          const ref = result.streamReferer || "";
          return { ...c, quality: result.quality || "auto",
            streamUrl: `/api/anime/scraper/stream?provider=miruro&subProvider=${encodeURIComponent(c.provider)}&mode=manifest&url=${encodeURIComponent(result.url)}${ref ? `&referer=${encodeURIComponent(ref)}` : ""}`,
            isM3U8: result.isM3U8, isMP4: !result.isM3U8 };
        }
      }
      if (c.source === "animex" && animexSlug) {
        const result = await Promise.race([
          animexSources(animexSlug, epNum, c.type, c.provider),
          new Promise<null>(r => setTimeout(() => r(null), 4000)),
        ]);
        if (result?.sources?.length) {
          const p = result.sources.find(s => {
            const u = s.url || "", t = s.type || "";
            return ((u.includes(".m3u8") || t.includes("mpegurl") || (u.includes(".txt") && t.includes("mpegurl")) || u.includes(".mp4")) && !u.includes(".mpd"));
          });
          if (p?.url) {
            const ref = ANIMEX_REFERERS[c.provider] || "https://animex.one/";
            const isM3U8 = p.url.includes(".m3u8") || p.type?.includes("mpegurl");
            return { ...c, quality: p.quality || "auto",
              streamUrl: `/api/anime/scraper/stream?provider=animex&subProvider=${encodeURIComponent(c.provider)}&referer=${encodeURIComponent(ref)}&mode=manifest&url=${encodeURIComponent(p.url)}`,
              isM3U8, isMP4: !isM3U8 };
          }
        }
      }
      if (c.source === "anivault") {
        const data = c.type === "dub" ? (anivaultDub.status === "fulfilled" ? anivaultDub.value : null) : (anivaultSub.status === "fulfilled" ? anivaultSub.value : null);
        if (data?.streamUrl) {
          return { ...c, quality: "MP4", streamUrl: data.streamUrl, isM3U8: !!data.m3u8, isMP4: !!data.mp4 };
        }
      }
      if (c.source === "anivexa") {
        // Fetch from AniVexa API — the anivexa-direct endpoint handles all the
        // stream resolution (clock.json for allmanga, ssub/sdub for anikoto, etc.)
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
            const streams = res.streams || [];
            const playable = streams.find((s: any) => s.isActive && s.url && (s.type === "mp4" || s.type === "hls"))
                          || streams.find((s: any) => s.url && (s.type === "mp4" || s.type === "hls"));
            if (playable) {
              streamUrl = playable.url;
              streamReferer = playable.referer || "https://www.animegg.org/";
              quality = playable.quality || "auto";
              isMP4 = playable.type === "mp4";
              isM3U8 = playable.type === "hls" || playable.url.includes(".m3u8");
            }
          } else if (c.provider === "allmanga") {
            const sources = res.sources || [];
            const clockSource = sources.find((s: any) => s.url && s.url.includes("clock.json"));
            if (clockSource) {
              const ref = clockSource.headers?.Referer || "https://allmanga.to";
              const ua = clockSource.headers?.["User-Agent"] || "Mozilla/5.0";
              const clockRes = await Promise.race([
                fetch(clockSource.url, { headers: { Referer: ref, "User-Agent": ua }, cache: "no-store" }).then(r => r.ok ? r.json() : null),
                new Promise<null>(r => setTimeout(() => r(null), 3000)),
              ]);
              if (clockRes?.links?.length) {
                const hlsLink = clockRes.links.find((l: any) => l.hls) || clockRes.links[0];
                if (hlsLink?.link) {
                  streamUrl = hlsLink.link;
                  streamReferer = ref;
                  quality = hlsLink.resolutionStr || "auto";
                  isM3U8 = true;
                  isMP4 = false;
                }
              }
            }
          } else if (c.provider === "anikoto") {
            const key = c.type === "dub" ? "sdub" : "ssub";
            const streams = res[key]?.streams || [];
            const hlsStream = streams.find((s: any) => s.type === "hls" && s.url)
                           || streams.find((s: any) => s.url && !s.type?.includes("embed"));
            if (hlsStream) {
              streamUrl = hlsStream.url;
              streamReferer = hlsStream.referer || "https://megaplay.buzz/";
              quality = "auto";
              isM3U8 = true;
              isMP4 = false;
            }
          }

          if (streamUrl) {
            return { ...c, quality,
              streamUrl: `/api/anime/scraper/stream?provider=${encodeURIComponent(c.provider)}&subProvider=${encodeURIComponent(c.provider)}&referer=${encodeURIComponent(streamReferer)}&mode=manifest&url=${encodeURIComponent(streamUrl)}`,
              isM3U8, isMP4 };
          }
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

  console.log(`[Servers] ${verified.length}/${candidates.length} verified`);

  return NextResponse.json({ anilistId: id, episode: epNum, servers: verified, total: verified.length }, {
    headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" },
  });
}
