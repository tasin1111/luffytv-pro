/**
 * GET /api/anime/animex-servers/[anilistId]/[episode]
 *
 * Fetches Animex servers INDEPENDENTLY from chad.anidap.se (the mirror of pp.animex.one).
 * This runs as a SEPARATE request from the main servers endpoint,
 * so it doesn't compete with other sources for the Vercel 30s timeout.
 *
 * The watch page fetches this in parallel with /api/anime/servers —
 * main servers load first, Animex servers get appended when ready.
 *
 * Dynamically fetches the actual sub/dub provider list from /servers endpoint
 * (no more hardcoding provider IDs that drift over time).
 * Fallback to known-good lists if /servers endpoint fails.
 */
import { NextRequest, NextResponse } from "next/server";
import { animexGetAnime, animexServers, animexSources } from "@/lib/animex-api";

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

// Providers that serve SOFT SUB (subtitles as separate track, not burned in).
// Everything else is hardsub. Matches what animex.one reports.
const ANIMEX_SOFTSUB = new Set(["beep", "yuki"]);

// Hardcoded fallback lists — used only if /servers endpoint fails to return a list.
// These match what animex.one currently reports (verified 2026-06).
// Actual sub: beep, yuki, miku, neko, mochi, uwu (6 providers — meets "minimum 6" requirement)
// Actual dub: yuki, miku, mochi, uwu (4 providers)
const FALLBACK_SUB_PROVIDERS = ["beep", "yuki", "miku", "neko", "mochi", "uwu"];
const FALLBACK_DUB_PROVIDERS = ["yuki", "miku", "mochi", "uwu"];

/**
 * Build a playable URL for a stream.
 *
 * OLD approach (BROKEN): XOR-encode the URL and route through cdn.animex.su.
 *   cdn.animex.su is DEAD (DNS NXDOMAIN as of 2026-06-25) — all such URLs return 530.
 *
 * NEW approach: Route the DIRECT stream URL through our Cloudflare Worker.
 *   The worker adds the correct Referer header (from REFERER_MAP) and bypasses CORS.
 *   For CDN-swapped URLs (bd.24stream.xyz etc.), the worker also handles Referer.
 *
 * If the URL is already on a 24stream.xyz CDN (post-swap), it's direct — just wrap
 * through the worker for Referer + CORS.
 * Otherwise (e.g. vibeplayer.site, animeapps.top), wrap through worker too.
 */
function buildProxyUrl(streamUrl: string, referer: string, isMP4: boolean = false): string {
  // Route through our worker — it will add Referer based on the hostname
  const PROXY_BASE = process.env.NEXT_PUBLIC_PROXY_BASE || "";
  if (!PROXY_BASE) {
    // Fallback: use the old XOR wrapper (will fail if cdn.animex.su is down,
    // but at least doesn't crash). Prefer m3u8 mode for HLS, raw for MP4.
    const key = "aproxy2026";
    const keyBytes = Buffer.from(key);
    const combined = Buffer.from(streamUrl + "\0" + referer);
    const xored = Buffer.alloc(combined.length);
    for (let i = 0; i < combined.length; i++) {
      xored[i] = combined[i] ^ keyBytes[i % keyBytes.length];
    }
    const b64 = xored.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    return `https://cdn.animex.su/stream/${b64}/index.txt`;
  }
  // Use /proxy/m3u8 for HLS (rewrites segment URLs inside the manifest),
  // /proxy/raw for MP4 (pass-through).
  const mode = isMP4 ? "raw" : "m3u8";
  return `${PROXY_BASE}/proxy/${mode}?url=${encodeURIComponent(streamUrl)}`;
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
    // Step 1: Resolve AniList ID → Animex slug
    const anime = await animexGetAnime(id);
    if (!anime?.slug) {
      return NextResponse.json({ servers: [], total: 0, message: "Anime not found on Animex" });
    }

    // Step 2: Fetch the ACTUAL provider list from /servers endpoint.
    // This returns subProviders + dubProviders arrays — we use these instead
    // of hardcoding provider IDs (which drift over time as animex adds/removes providers).
    const serversList = await animexServers(anime.slug, epNum);
    const subProviderIds: string[] = (serversList.subProviders || []).map((p: any) => p.id);
    const dubProviderIds: string[] = (serversList.dubProviders || []).map((p: any) => p.id);

    // Fall back to known-good lists if /servers endpoint returns nothing
    const subProviders = subProviderIds.length > 0 ? subProviderIds : FALLBACK_SUB_PROVIDERS;
    const dubProviders = dubProviderIds.length > 0 ? dubProviderIds : FALLBACK_DUB_PROVIDERS;

    // Step 3: Build job list — sub + dub providers
    const jobs: Array<{ provider: string; type: "sub" | "dub" }> = [];
    for (const p of subProviders) jobs.push({ provider: p, type: "sub" });
    for (const p of dubProviders) jobs.push({ provider: p, type: "dub" });

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

          // Apply CDN swap (these mirrors serve the same files without CF protection)
          let streamUrl = p.url;
          streamUrl = streamUrl.replace("https://playeng.animeapps.top/r2/", "https://bd.24stream.xyz/media/");
          streamUrl = streamUrl.replace("https://vibeplayer.site/public/stream/", "https://hawk.24stream.xyz/media/");
          streamUrl = streamUrl.replace("https://hls.anidb.app/stream/", "https://wave.24stream.xyz/stream/");
          streamUrl = streamUrl.replace("https://tools.fast4speed.rsvp", "https://mp4.24stream.xyz/storage");

          const isSwapped = /^https?:\/\/[^/]*\.24stream\.xyz\//.test(streamUrl);
          const proxyUrl = isSwapped ? streamUrl : buildProxyUrl(streamUrl, ref, !isM3U8);

          // ── VERIFICATION REMOVED ──
          // The HEAD verification was killing valid servers because:
          // 1. Some CDNs return 403 on HEAD but 200 on GET (different behavior)
          // 2. Time-limited signed URLs expire between verification and playback
          // 3. CDNs that block Vercel IPs fail verification even though they work
          //    through the proxy
          // Instead: return ALL servers. The player will retry on failure, and
          // the user can switch servers if one doesn't work.

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

    console.log(`[Animex-Servers] ${servers.length}/${jobs.length} servers for anilistId=${id} ep${epNum} (sub:${subProviders.length} dub:${dubProviders.length})`);

    return NextResponse.json({
      anilistId: id,
      episode: epNum,
      servers,
      total: servers.length,
      subProviders,
      dubProviders,
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
