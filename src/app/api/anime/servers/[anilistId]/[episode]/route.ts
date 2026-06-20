/**
 * GET /api/anime/servers/[anilistId]/[episode]
 *
 * Returns servers FAST (no verification) + a streamUrl for each.
 * The watch page loads instantly and plays immediately.
 * If a stream fails when clicked, the user sees "try another server".
 *
 * Fast mode: ~1 second (just fetch episode lists, no stream verification)
 * The streamUrl is built from the provider + episode ID — it will resolve
 * when the player actually requests it through the stream proxy.
 */
import { NextRequest, NextResponse } from "next/server";
import {
  fetchRawEpisodes,
  getAvailableMiruroServers,
  getSourceFromProvider,
} from "@/lib/miruro-direct";
import { animexGetAnime, animexServers } from "@/lib/animex-api";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ anilistId: string; episode: string }> }
) {
  const { anilistId, episode } = await params;
  const id = parseInt(anilistId, 10);
  const epNum = parseInt(episode, 10);
  if (isNaN(id) || id <= 0) {
    return NextResponse.json({ error: "Invalid anilistId" }, { status: 400 });
  }

  const url = new URL(req.url);
  const verify = url.searchParams.get("verify") === "true";

  const servers: Array<{
    id: string;
    name: string;
    source: "miruro" | "animex";
    provider: string;
    type: "sub" | "dub";
    quality?: string;
    streamUrl?: string;
    streamReferer?: string;
    isM3U8?: boolean;
  }> = [];

  // ─── Gather ALL candidate servers in parallel ─────────────────────
  const [miruroRaw, animexData] = await Promise.allSettled([
    fetchRawEpisodes(id),
    (async () => {
      const anime = await animexGetAnime(id);
      if (!anime?.slug) return null;
      const servers = await animexServers(anime.slug, epNum);
      return { slug: anime.slug, servers };
    })(),
  ]);

  // Miruro candidates
  if (miruroRaw.status === "fulfilled" && miruroRaw.value?.providers) {
    for (const cat of ["sub", "dub"] as const) {
      const miruroServers = getAvailableMiruroServers(miruroRaw.value, epNum, cat);
      for (const s of miruroServers) {
        servers.push({
          id: `miruro:${s.provider}:${cat}`,
          name: `Miruro ${s.provider.charAt(0).toUpperCase() + s.provider.slice(1)}${cat === "dub" ? " (Dub)" : ""}`,
          source: "miruro",
          provider: s.provider,
          type: cat,
        });
      }
    }
  }

  // Animex candidates
  let animexSlug: string | null = null;
  if (animexData.status === "fulfilled" && animexData.value) {
    animexSlug = animexData.value.slug;
    for (const cat of ["sub", "dub"] as const) {
      const providers = cat === "dub"
        ? animexData.value.servers.dubProviders
        : animexData.value.servers.subProviders;
      for (const p of providers) {
        servers.push({
          id: `animex:${p.id}:${cat}`,
          name: `Animex ${p.id.charAt(0).toUpperCase() + p.id.slice(1)}${cat === "dub" ? " (Dub)" : ""}`,
          source: "animex",
          provider: p.id,
          type: cat,
        });
      }
    }
  }

  // ─── If no verify requested, return immediately ───────────────────
  // The streamUrl will be fetched on-demand when the user clicks a server.
  // This makes the server list load in ~1 second instead of ~4-8 seconds.
  if (!verify) {
    return NextResponse.json({
      anilistId: id,
      episode: epNum,
      servers,
      total: servers.length,
      verified: false,
    }, {
      headers: { "Cache-Control": "public, s-maxage=120, stale-while-revalidate=600" },
    });
  }

  // ─── Verify mode: check each server in parallel ───────────────────
  console.log(`[Servers] verifying ${servers.length} candidates...`);

  const verificationPromises = servers.map(async (server) => {
    try {
      if (server.source === "miruro") {
        const result = await Promise.race([
          getSourceFromProvider(id, epNum, server.type, server.provider),
          new Promise<null>(resolve => setTimeout(() => resolve(null), 8000)),
        ]);
        if (result?.url) {
          const streamReferer = result.streamReferer || "";
          return {
            ...server,
            quality: result.quality,
            streamUrl: `/api/anime/scraper/stream?provider=miruro&subProvider=${encodeURIComponent(server.provider)}&mode=manifest&url=${encodeURIComponent(result.url)}${streamReferer ? `&referer=${encodeURIComponent(streamReferer)}` : ""}`,
            streamReferer,
            isM3U8: result.isM3U8,
          };
        }
      } else if (server.source === "animex" && animexSlug) {
        const { animexSources } = await import("@/lib/animex-api");
        const result = await Promise.race([
          animexSources(animexSlug, epNum, server.type, server.provider),
          new Promise<null>(resolve => setTimeout(() => resolve(null), 8000)),
        ]);
        if (result?.sources?.length) {
          const playable = result.sources.find(s => {
            const u = s.url || "";
            const t = s.type || "";
            const isM3U8 = u.includes(".m3u8") || t.includes("mpegurl");
            const isMP4 = u.includes(".mp4");
            return (isM3U8 || isMP4) && !u.includes(".mpd");
          });
          if (playable?.url) {
            const PROVIDER_HEADERS: Record<string, string> = {
              beep: "https://animex.one/", mimi: "https://animex.one/",
              vee: "https://www.animeonsen.xyz/", yuki: "https://megaplay.buzz/",
              miku: "https://allanime.uns.bio", neko: "https://animeverse.to/",
              huzz: "https://kem.clvd.xyz/", mochi: "https://animex.one",
              uwu: "https://allanime.uns.bio", koto: "https://allanime.uns.bio",
              kiwi: "https://anidb.app/", kami: "https://animex.one/",
              sax: "https://animex.one/", yume: "https://animex.one/",
            };
            const referer = PROVIDER_HEADERS[server.provider] || "https://animex.one/";
            return {
              ...server,
              quality: playable.quality || "auto",
              streamUrl: `/api/anime/scraper/stream?provider=animex&subProvider=${encodeURIComponent(server.provider)}&referer=${encodeURIComponent(referer)}&mode=manifest&url=${encodeURIComponent(playable.url)}`,
              streamReferer: referer,
              isM3U8: playable.url.includes(".m3u8") || playable.type?.includes("mpegurl"),
            };
          }
        }
      }
    } catch (e) {
      console.error(`[Servers] ${server.id} verification failed:`, e);
    }
    return null;
  });

  const results = await Promise.allSettled(verificationPromises);
  const verifiedServers = servers.filter((_, i) => {
    const r = results[i];
    return r.status === "fulfilled" && r.value;
  }).map((server, i) => {
    const r = results[servers.indexOf(server)];
    return r.status === "fulfilled" && r.value ? r.value : server;
  });

  console.log(`[Servers] ${verifiedServers.length}/${servers.length} verified`);

  return NextResponse.json({
    anilistId: id,
    episode: epNum,
    servers: verifiedServers,
    total: verifiedServers.length,
    verified: true,
  }, {
    headers: { "Cache-Control": "public, s-maxage=120, stale-while-revalidate=600" },
  });
}
