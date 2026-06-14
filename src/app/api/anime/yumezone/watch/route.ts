import { NextRequest, NextResponse } from "next/server";
import {
  miruroEpisodes,
  miruroWatch,
  miruroWatchProvider,
  getEpisodeSlugForProvider,
  getAvailableProvidersForEpisode,
  type MiruroProviderEpisodes,
} from "@/lib/miruro-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// CDN proxy for Miruro/arc/jet/zoro streams (from YumeZone source)
const CDN_PROXY_URL = process.env.CDN_PROXY_URL || "https://cdn-eu.1ani.me/proxy/m3u8";

// Provider priority matching YumeZone
const PROVIDER_PRIORITY = [
  "zenith", "kiwi", "ax-mimi", "ax-wave", "ax-shiro", "ax-yuki", "ax-zen", "ax-beep",
  "bee", "miku", "zoro", "arc", "jet",
];

/**
 * GET /api/anime/yumezone/watch?anilistId=1535&episode=1&provider=kiwi&type=sub
 *
 * Properly maps AniList ID to Miruro episode slug, then fetches the correct
 * m3u8/HLS stream with proper headers and proxy routing.
 *
 * Flow (matching YumeZone):
 * 1. Fetch episodes from Miruro API -> get providers_map
 * 2. Find episode ID for requested provider + episode number + category
 * 3. Fetch stream data from Miruro watch API: /watch/{provider}/{anilistId}/{category}/{slug}
 * 4. Route m3u8 URLs through appropriate proxy (cdn-eu for arc/jet/zoro, kiwi worker for kiwi/ax-*)
 * 5. Return structured video data with HLS sources, embed sources, subtitles, intro/outro
 */
export async function GET(req: NextRequest) {
  const anilistIdStr = req.nextUrl.searchParams.get("anilistId");
  const episodeStr = req.nextUrl.searchParams.get("episode") || "1";
  const provider = req.nextUrl.searchParams.get("provider") || "";
  const translationType = (req.nextUrl.searchParams.get("type") || "sub") as "sub" | "dub";

  if (!anilistIdStr) {
    return NextResponse.json({ error: "anilistId required" }, { status: 400 });
  }

  const anilistId = parseInt(anilistIdStr);
  const episodeNum = parseInt(episodeStr);

  if (isNaN(anilistId)) {
    return NextResponse.json({ error: "Invalid anilistId" }, { status: 400 });
  }

  try {
    // Step 1: Fetch episodes to get the providers_map and episode slugs
    const epData = await miruroEpisodes(anilistId);
    const providersMap = epData.providersMap || {};

    // Step 2: Handle Zoro/Megaplay provider specially (YumeZone approach)
    // Zoro uses direct embed: megaplay.buzz/stream/ani/{anilistId}/{ep}/{lang}
    if (provider === "zoro" || (!provider && Object.keys(providersMap).length === 0)) {
      const lang = translationType === "dub" ? "dub" : "sub";
      const embedUrl = `https://megaplay.buzz/stream/ani/${anilistId}/${episodeNum}/${lang}`;
      return NextResponse.json({
        video_link: embedUrl,
        source_type: "embed",
        embed_sources: [{ url: embedUrl, quality: "default", label: "Megaplay (Embed)", type: "embed" }],
        hls_sources: [],
        video_sources: [],
        subtitle_tracks: [],
        intro: null,
        outro: null,
        provider: "zoro",
        available_qualities: [],
      });
    }

    // Step 3: Determine which provider to use
    let activeProvider = provider;
    let episodeSlug: string | null = null;

    // Try the requested provider first
    if (activeProvider && providersMap[activeProvider]) {
      episodeSlug = getEpisodeSlugForProvider(providersMap, activeProvider, episodeNum, translationType);
    }

    // If no slug found, try providers in priority order
    if (!episodeSlug) {
      const availableProviders = getAvailableProvidersForEpisode(providersMap, episodeNum, translationType);

      for (const candidateProvider of availableProviders) {
        const slug = getEpisodeSlugForProvider(providersMap, candidateProvider, episodeNum, translationType);
        if (slug) {
          activeProvider = candidateProvider;
          episodeSlug = slug;
          break;
        }
      }
    }

    // If still no slug, try all providers
    if (!episodeSlug) {
      for (const [provName, provData] of Object.entries(providersMap)) {
        if (!provData?.episodes) continue;
        const eps = translationType === "dub" ? provData.episodes.dub : provData.episodes.sub;
        const ep = eps.find(e => e.number === episodeNum);
        if (ep) {
          activeProvider = provName;
          episodeSlug = ep.slug || ep.id || String(ep.number);
          break;
        }
      }
    }

    // Last resort: use episode number as slug
    if (!episodeSlug) {
      episodeSlug = String(episodeNum);
      if (!activeProvider) activeProvider = "kiwi";
    }

    console.log(`[YumeZone Watch] anilistId=${anilistId} ep=${episodeNum} provider=${activeProvider} slug=${episodeSlug}`);

    // Step 4: Fetch stream data from Miruro watch API with auto-switching
    const result = await miruroWatch(
      activeProvider,
      anilistId,
      translationType,
      episodeSlug,
      providersMap,
      episodeNum
    );

    if (!result || result.sources.length === 0) {
      return NextResponse.json({
        error: "No sources found",
        provider: activeProvider,
        episodeSlug,
        _debug: { anilistId, episodeNum, translationType, triedProviders: result?.triedProviders || [] },
      }, { status: 404 });
    }

    // Step 5: Separate sources into HLS and embed, and route through proxy
    const hlsSources: Array<{
      url: string; quality: string; label: string; isM3U8: boolean;
      width?: number; height?: number; codec?: string; fansub?: string;
    }> = [];
    const embedSources: Array<{
      url: string; quality: string; label: string; type: string;
    }> = [];

    for (const source of result.sources) {
      const url = source.url || "";
      if (!url) continue;

      // Route through proxy based on provider (YumeZone routing logic)
      const routedUrl = routeStreamProxy(url, activeProvider, source.headers || result.headers);

      if (source.isM3U8 || url.includes(".m3u8") || source.sourceType === "internal") {
        hlsSources.push({
          url: routedUrl,
          quality: source.quality || "Auto",
          label: source.quality || "Auto",
          isM3U8: true,
        });
      } else if (source.sourceType === "external" || source.type === "iframe" || source.type === "embed") {
        embedSources.push({
          url: routedUrl,
          quality: source.quality || "SD",
          label: source.sourceName || source.quality || "Embed",
          type: "embed",
        });
      } else {
        // Default: treat as HLS
        hlsSources.push({
          url: routedUrl,
          quality: source.quality || "Auto",
          label: source.quality || "Auto",
          isM3U8: true,
        });
      }
    }

    // Route subtitle URLs through CDN proxy
    const subtitleTracks = (result.subtitles || []).map(sub => ({
      url: routeCdnProxy(sub.url, { referer: "https://miruro.tv/" }),
      label: sub.lang || sub.language || "English",
      kind: "subtitles" as const,
    }));

    // Determine source type
    let sourceType: "hls" | "embed" | "mp4" = "hls";
    if (hlsSources.length === 0 && embedSources.length > 0) sourceType = "embed";
    else if (hlsSources.length === 0 && embedSources.length === 0) sourceType = "mp4";

    // Determine the primary video link
    let videoLink = "";
    if (sourceType === "embed" && embedSources.length > 0) {
      videoLink = embedSources[0].url;
    } else if (hlsSources.length > 0) {
      videoLink = hlsSources[0].url;
    }

    return NextResponse.json({
      video_link: videoLink,
      source_type: sourceType,
      hls_sources: hlsSources,
      embed_sources: embedSources,
      video_sources: [],
      subtitle_tracks: subtitleTracks,
      intro: result.intro || null,
      outro: result.outro || null,
      provider: result.provider || activeProvider,
      available_qualities: hlsSources.map(s => s.quality),
      tried_providers: result.triedProviders || [],
      all_providers: result.allProviders || [],
      _debug: { anilistId, episodeNum, translationType, episodeSlug, activeProvider },
    });
  } catch (err) {
    console.error("[YumeZone Watch] Error:", err);
    return NextResponse.json({
      error: "Watch failed. Please try again.",
      _debug: { anilistId, episodeNum, translationType },
    }, { status: 500 });
  }
}

/**
 * Route stream URLs to the correct proxy based on provider type.
 * Matches YumeZone's _route_stream_proxy logic:
 * - kiwi / animex / ax-* -> kiwi worker proxy (not available, use CDN proxy)
 * - arc / jet / zoro / miruro -> cdn-eu proxy
 * - subtitles -> cdn-eu proxy
 */
function routeStreamProxy(url: string, provider: string, headers?: Record<string, string>): string {
  if (!url) return url;
  if (isAlreadyProxied(url)) return url;

  const providerNorm = (provider || "").toLowerCase();

  // These providers should NOT be proxied through CDN (they need worker proxy)
  // For now, use CDN proxy for everything since we don't have a kiwi worker
  return routeCdnProxy(url, headers);
}

/**
 * Route through CDN-EU proxy with optional headers
 * Format: https://cdn-eu.1ani.me/proxy/m3u8?url=...&headers={"referer":"..."}
 */
function routeCdnProxy(url: string, headers?: Record<string, string>): string {
  if (!url || isAlreadyProxied(url)) return url;

  try {
    const encodedUrl = encodeURIComponent(url);
    let proxyUrl = `${CDN_PROXY_URL}?url=${encodedUrl}`;

    if (headers && Object.keys(headers).length > 0) {
      // Filter out empty headers
      const filteredHeaders: Record<string, string> = {};
      for (const [k, v] of Object.entries(headers)) {
        if (v) filteredHeaders[k] = v;
      }
      if (Object.keys(filteredHeaders).length > 0) {
        proxyUrl += `&headers=${encodeURIComponent(JSON.stringify(filteredHeaders))}`;
      }
    }

    return proxyUrl;
  } catch {
    return url;
  }
}

function isAlreadyProxied(url: string): boolean {
  if (!url) return false;
  return (
    url.includes("cdn-eu.1ani.me/proxy/m3u8") ||
    url.includes("workers.dev/p/") ||
    url.includes("/api/hls-proxy") ||
    url.includes("/api/hls-resolve") ||
    url.startsWith("/api/")
  );
}
