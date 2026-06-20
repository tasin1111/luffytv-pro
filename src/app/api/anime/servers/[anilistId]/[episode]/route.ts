/**
 * GET /api/anime/servers/[anilistId]/[episode]
 *
 * Returns ALL available servers for an episode — both Miruro and Animex.
 * Used by the watch page to show a server selector.
 *
 * Query params:
 *   type: "sub" | "dub" (default: sub)
 *
 * Returns:
 *   {
 *     servers: [
 *       { id: "miruro:kiwi", name: "Kiwi", source: "miruro", provider: "kiwi", quality: "1080p" },
 *       { id: "miruro:bee", name: "Bee", source: "miruro", provider: "bee" },
 *       { id: "animex:miku", name: "Miku", source: "animex", provider: "miku" },
 *       ...
 *     ]
 *   }
 */
import { NextRequest, NextResponse } from "next/server";
import { fetchRawEpisodes, getAvailableMiruroServers } from "@/lib/miruro-direct";
import { animexGetAnime, animexServers } from "@/lib/animex-api";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

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

  const servers: Array<{
    id: string;
    name: string;
    source: "miruro" | "animex";
    provider: string;
    quality?: string;
    type: "sub" | "dub";
  }> = [];

  // ─── Miruro servers ──────────────────────────────────────────────
  try {
    const rawData = await fetchRawEpisodes(id);
    if (rawData?.providers) {
      // Sub servers
      const miruroSub = getAvailableMiruroServers(rawData, epNum, "sub");
      for (const s of miruroSub) {
        servers.push({
          id: `miruro:${s.provider}:sub`,
          name: `Miruro ${s.provider.charAt(0).toUpperCase() + s.provider.slice(1)}`,
          source: "miruro",
          provider: s.provider,
          type: "sub",
        });
      }
      // Dub servers
      const miruroDub = getAvailableMiruroServers(rawData, epNum, "dub");
      for (const s of miruroDub) {
        servers.push({
          id: `miruro:${s.provider}:dub`,
          name: `Miruro ${s.provider.charAt(0).toUpperCase() + s.provider.slice(1)} (Dub)`,
          source: "miruro",
          provider: s.provider,
          type: "dub",
        });
      }
    }
  } catch (e) {
    console.error("[Servers] Miruro failed:", e);
  }

  // ─── Animex servers ──────────────────────────────────────────────
  try {
    const anime = await animexGetAnime(id);
    if (anime?.slug) {
      const serversData = await animexServers(anime.slug, epNum);
      // Sub providers
      for (const p of serversData.subProviders) {
        servers.push({
          id: `animex:${p.id}:sub`,
          name: `Animex ${p.id.charAt(0).toUpperCase() + p.id.slice(1)}`,
          source: "animex",
          provider: p.id,
          type: "sub",
        });
      }
      // Dub providers
      for (const p of serversData.dubProviders) {
        servers.push({
          id: `animex:${p.id}:dub`,
          name: `Animex ${p.id.charAt(0).toUpperCase() + p.id.slice(1)} (Dub)`,
          source: "animex",
          provider: p.id,
          type: "dub",
        });
      }
    }
  } catch (e) {
    console.error("[Servers] Animex failed:", e);
  }

  return NextResponse.json({
    anilistId: id,
    episode: epNum,
    servers,
    total: servers.length,
  }, {
    headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" },
  });
}
