/**
 * GET /api/anime/servers/[anilistId]/[episode]
 *
 * Returns VERIFIED servers for an episode — only servers that actually
 * return a playable stream URL are included.
 *
 * How it works:
 *   1. Fetch episode list from Miruro (1 API call) + Animex servers (1 API call)
 *   2. For each provider, try to fetch the stream URL (parallel, 8s timeout each)
 *   3. Only return servers that returned a valid m3u8/mp4 URL
 *
 * This means every server shown WILL play when clicked.
 */
import { NextRequest, NextResponse } from "next/server";
import {
  fetchRawEpisodes,
  getAvailableMiruroServers,
  getSourceFromProvider,
} from "@/lib/miruro-direct";
import { animexGetAnime, animexServers, animexSources } from "@/lib/animex-api";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // need more time for parallel verification

interface ServerEntry {
  id: string;
  name: string;
  source: "miruro" | "animex";
  provider: string;
  type: "sub" | "dub";
  quality?: string;
  streamUrl?: string; // the actual playable URL (already proxied)
  streamReferer?: string;
  isM3U8?: boolean;
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

  // ─── Step 1: Gather ALL candidate servers ─────────────────────────
  const candidates: ServerEntry[] = [];

  // Miruro: fetch raw episode data once, extract all providers
  const miruroRaw = await fetchRawEpisodes(id).catch(() => null);
  if (miruroRaw?.providers) {
    for (const cat of ["sub", "dub"] as const) {
      const servers = getAvailableMiruroServers(miruroRaw, epNum, cat);
      for (const s of servers) {
        candidates.push({
          id: `miruro:${s.provider}:${cat}`,
          name: `Miruro ${s.provider.charAt(0).toUpperCase() + s.provider.slice(1)}${cat === "dub" ? " (Dub)" : ""}`,
          source: "miruro",
          provider: s.provider,
          type: cat,
        });
      }
    }
  }

  // Animex: resolve slug + get server list
  let animexSlug: string | null = null;
  try {
    const anime = await animexGetAnime(id);
    if (anime?.slug) {
      animexSlug = anime.slug;
      const serversData = await animexServers(anime.slug, epNum);
      for (const cat of ["sub", "dub"] as const) {
        const providers = cat === "dub" ? serversData.dubProviders : serversData.subProviders;
        for (const p of providers) {
          candidates.push({
            id: `animex:${p.id}:${cat}`,
            name: `Animex ${p.id.charAt(0).toUpperCase() + p.id.slice(1)}${cat === "dub" ? " (Dub)" : ""}`,
            source: "animex",
            provider: p.id,
            type: cat,
          });
        }
      }
    }
  } catch (e) {
    console.error("[Servers] Animex setup failed:", e);
  }

  console.log(`[Servers] ${candidates.length} candidates — verifying streams...`);

  // ─── Step 2: Verify each server in parallel (8s timeout each) ──────
  const verificationPromises = candidates.map(async (server) => {
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
        const result = await Promise.race([
          animexSources(animexSlug, epNum, server.type, server.provider),
          new Promise<null>(resolve => setTimeout(() => resolve(null), 8000)),
        ]);
        if (result?.sources?.length) {
          const playable = result.sources.find(s => {
            const u = s.url || "";
            const t = s.type || "";
            const isM3U8 = u.includes(".m3u8") || t.includes("mpegurl") || (u.includes(".txt") && t.includes("mpegurl"));
            const isMP4 = u.includes(".mp4");
            return (isM3U8 || isMP4) && !u.includes(".mpd");
          });
          if (playable?.url) {
            const PROVIDER_HEADERS: Record<string, string> = {
              beep: "https://animex.one/",
              mimi: "https://animex.one/",
              vee: "https://www.animeonsen.xyz/",
              yuki: "https://megaplay.buzz/",
              miku: "https://allanime.uns.bio",
              neko: "https://animeverse.to/",
              huzz: "https://kem.clvd.xyz/",
              mochi: "https://animex.one",
              uwu: "https://allanime.uns.bio",
              koto: "https://allanime.uns.bio",
              kiwi: "https://anidb.app/",
              kami: "https://animex.one/",
              sax: "https://animex.one/",
              yume: "https://animex.one/",
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
    return null; // not playable
  });

  const results = await Promise.allSettled(verificationPromises);

  // ─── Step 3: Filter to only verified servers ──────────────────────
  const verifiedServers: ServerEntry[] = [];
  for (const r of results) {
    if (r.status === "fulfilled" && r.value) {
      verifiedServers.push(r.value);
    }
  }

  console.log(`[Servers] ${verifiedServers.length}/${candidates.length} servers verified`);

  return NextResponse.json({
    anilistId: id,
    episode: epNum,
    servers: verifiedServers,
    total: verifiedServers.length,
  }, {
    headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" },
  });
}
