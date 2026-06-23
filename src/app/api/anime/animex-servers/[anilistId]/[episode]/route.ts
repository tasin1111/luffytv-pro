/**
 * GET /api/anime/animex-servers/[anilistId]/[episode]
 *
 * Fetches Animex servers INDEPENDENTLY from pp.animex.one.
 * This runs as a SEPARATE request from the main servers endpoint,
 * so it doesn't compete with other sources for the Vercel 30s timeout.
 *
 * The watch page fetches this in parallel with /api/anime/servers —
 * main servers load first, Animex servers get appended when ready.
 *
 * Uses curl (via animex-api.ts) to bypass Cloudflare bot detection.
 * Fetches all 21 providers (11 sub + 10 dub) in batches of 3 with 500ms gap.
 */
import { NextRequest, NextResponse } from "next/server";
import { animexGetAnime, animexSources } from "@/lib/animex-api";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // 60s — generous timeout for batched fetching

const ANIMEX_REFERERS: Record<string, string> = {
  beep: "https://animex.one/", mimi: "https://animex.one/",
  vee: "https://www.animeonsen.xyz/", yuki: "https://megaplay.buzz/",
  miku: "https://allanime.uns.bio", neko: "https://animeverse.to/",
  huzz: "https://kem.clvd.xyz/", mochi: "https://animex.one",
  uwu: "https://allanime.uns.bio", koto: "https://allanime.uns.bio",
  kiwi: "https://anidb.app/", kami: "https://animex.one/",
  sax: "https://animex.one/", yume: "https://animex.one/",
};

interface AnimexServer {
  id: string;
  name: string;
  source: "animex";
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

function buildProxyUrl(streamUrl: string, referer: string, isMP4: boolean = false): string {
  const key = "aproxy2026";
  const keyBytes = Buffer.from(key);
  const combined = Buffer.from(streamUrl + "\0" + referer);
  const xored = Buffer.alloc(combined.length);
  for (let i = 0; i < combined.length; i++) {
    xored[i] = combined[i] ^ keyBytes[i % keyBytes.length];
  }
  const b64 = xored.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `https://pro.24stream.xyz/stream/${b64}/index.txt`;
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

  const ANIMEX_SUB_PROVIDERS = ["beep", "yuki", "mimi", "miku", "neko", "mochi", "uwu", "kuro", "sax", "yume", "koto"];
  const ANIMEX_DUB_PROVIDERS = ["mimi", "yuki", "mochi", "yume", "koto", "uwu", "sax", "kuro", "neko", "miku"];
  const ANIMEX_SOFTSUB = new Set(["beep", "yuki"]);

  try {
    // Step 1: Resolve AniList ID → Animex slug
    const anime = await animexGetAnime(id);
    if (!anime?.slug) {
      return NextResponse.json({ servers: [], total: 0, message: "Anime not found on Animex" });
    }

    // Step 2: Fetch all providers in batches of 3
    const jobs: Array<{ provider: string; type: "sub" | "dub" }> = [];
    for (const p of ANIMEX_SUB_PROVIDERS) jobs.push({ provider: p, type: "sub" });
    for (const p of ANIMEX_DUB_PROVIDERS) jobs.push({ provider: p, type: "dub" });

    const BATCH = 3;
    const GAP_MS = 500;
    const servers: AnimexServer[] = [];

    for (let i = 0; i < jobs.length; i += BATCH) {
      const batch = jobs.slice(i, i + BATCH);
      const batchResults = await Promise.allSettled(
        batch.map(async (job) => {
          const result = await Promise.race([
            animexSources(anime.slug, epNum, job.type, job.provider),
            new Promise<null>(r => setTimeout(() => r(null), 10000)),
          ]);
          if (!result?.sources?.length) return null;

          const p = result.sources.find(s => {
            const u = s.url || "", t = s.type || "";
            return ((u.includes(".m3u8") || t.includes("mpegurl") || (u.includes(".txt") && t.includes("mpegurl")) || u.includes(".mp4")) && !u.includes(".mpd"));
          });
          if (!p?.url) return null;

          const ref = ANIMEX_REFERERS[job.provider] || "https://animex.one/";
          const isM3U8 = p.url.includes(".m3u8") || p.type?.includes("mpegurl");

          // Apply CDN swap
          let streamUrl = p.url;
          streamUrl = streamUrl.replace("https://playeng.animeapps.top/r2/", "https://bd.24stream.xyz/media/");
          streamUrl = streamUrl.replace("https://vibeplayer.site/public/stream/", "https://hawk.24stream.xyz/media/");
          streamUrl = streamUrl.replace("https://hls.anidb.app/stream/", "https://wave.24stream.xyz/stream/");
          streamUrl = streamUrl.replace("https://tools.fast4speed.rsvp", "https://mp4.24stream.xyz/storage");

          const isSwapped = /^https?:\/\/[^/]*\.24stream\.xyz\//.test(streamUrl);
          const proxyUrl = isSwapped ? streamUrl : buildProxyUrl(streamUrl, ref, !isM3U8);

          const isHardsub = !ANIMEX_SOFTSUB.has(job.provider);
          const provName = job.provider[0].toUpperCase() + job.provider.slice(1).toLowerCase();
          const typeTag = job.type === "dub" ? " (Dub)" : (isHardsub ? " (HS)" : "");

          return {
            id: `animex:${job.provider}:${job.type}`,
            name: `Animex ${provName}${typeTag}`,
            source: "animex" as const,
            provider: job.provider,
            type: job.type,
            quality: p.quality || "auto",
            streamUrl: proxyUrl,
            isM3U8,
            isMP4: !isM3U8,
            hardsub: isHardsub,
            subtitleTracks: (result.tracks || []).map((t: any) => ({ url: t.url, lang: t.lang, label: t.label })),
            intro: result.intro || null,
            outro: result.outro || null,
          };
        })
      );

      for (const r of batchResults) {
        if (r.status === "fulfilled" && r.value) servers.push(r.value);
      }

      if (i + BATCH < jobs.length) {
        await new Promise(r => setTimeout(r, GAP_MS));
      }
    }

    console.log(`[Animex-Servers] ${servers.length}/${jobs.length} servers for anilistId=${id} ep${epNum}`);

    return NextResponse.json({
      anilistId: id,
      episode: epNum,
      servers,
      total: servers.length,
    }, {
      headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" },
    });
  } catch (e: any) {
    return NextResponse.json({
      error: "Animex fetch failed",
      message: e?.message || String(e),
      servers: [],
      total: 0,
    }, { status: 502 });
  }
}
