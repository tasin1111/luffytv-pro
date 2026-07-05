/**
 * GET /api/anime/animetsu-servers/[anilistId]/[episode]
 *
 * Fetches Animetsu servers INDEPENDENTLY from the main servers endpoint.
 * Animetsu has 4 providers (kite, dio, sage, meg) and uses its own
 * scraper proxy at animetsu-scraper-jade.vercel.app — this can be slow.
 *
 * Running as a separate request means it doesn't compete with other sources
 * for the Vercel 60s timeout. The watch page fetches this in parallel with
 * /api/anime/servers and appends servers when ready.
 */
import { NextRequest, NextResponse } from "next/server";
import { fetchAnimetsuSources } from "@/lib/animetsu-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface AnimetsuServer {
  id: string;
  name: string;
  source: "animetsu";
  provider: string;
  type: "sub" | "dub";
  quality: string;
  streamUrl: string;
  isM3U8: boolean;
  isMP4: boolean;
  hardsub: boolean;
  subtitleTracks: Array<{ url: string; lang: string; label: string }>;
  intro: { start: number; end: number } | null;
  outro: { start: number; end: number } | null;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ anilistId: string; episode: string }> }
) {
  const { anilistId, episode } = await params;
  const id = parseInt(anilistId, 10);
  const epNum = parseInt(episode, 10);
  if (isNaN(id) || id <= 0 || isNaN(epNum) || epNum <= 0) {
    return NextResponse.json({ error: "Invalid params" }, { status: 400 });
  }

  try {
    const results = await fetchAnimetsuSources(id, epNum, {
      sub: true,
      dub: true,
      timeoutMs: 15000,  // generous timeout since this runs separately
    });

    const servers: AnimetsuServer[] = results.map((r: any) => ({
      id: `animetsu:${r.provider}:${r.type}`,
      name: `Animetsu ${r.provider[0].toUpperCase() + r.provider.slice(1)}${r.type === "dub" ? " (Dub)" : ""}`,
      source: "animetsu" as const,
      provider: r.provider,
      type: r.type,
      quality: r.quality || "auto",
      streamUrl: r.streamUrl,
      isM3U8: r.isM3U8,
      isMP4: r.isMP4 || false,
      hardsub: r.hardsub || false,
      subtitleTracks: r.subtitleTracks || [],
      intro: r.intro || null,
      outro: r.outro || null,
    }));

    console.log(`[Animetsu-Servers] ${anilistId} ep${epNum}: ${servers.length} servers`);
    return NextResponse.json({
      anilistId: id,
      episode: epNum,
      servers,
      total: servers.length,
    }, {
      headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" },
    });
  } catch (e: any) {
    console.error(`[Animetsu-Servers] failed for ${anilistId} ep${epNum}:`, e?.message || e);
    return NextResponse.json({
      servers: [],
      total: 0,
      error: e?.message || "Failed to fetch Animetsu servers",
    }, { status: 200 });  // return 200 with empty array so watch page doesn't crash
  }
}
