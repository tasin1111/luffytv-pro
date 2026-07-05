import { NextRequest, NextResponse } from "next/server";
import { getTrending, getPopular, getTopRated, getSeasonAnime } from "@/lib/anilist-api";
import { miruroTrending, miruroPopular } from "@/lib/miruro-api";
import { malTopAnime, malSeasonNow } from "@/lib/mal-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/anime/anilist-trending
 * PARALLEL 3-LAYER FALLBACK: All sources raced simultaneously — fastest wins.
 *
 * Optional query params:
 *   - section: "trending" | "popular" | "topRated" | "season" | "all" (default: all)
 *   - season: "SPRING" | "SUMMER" | "FALL" | "WINTER" (for season filter)
 *   - year: number (for season filter, e.g. 2025)
 */
export async function GET(request: NextRequest) {
  const section = request.nextUrl.searchParams.get("section") || "all";
  const season = request.nextUrl.searchParams.get("season") || undefined;
  const yearStr = request.nextUrl.searchParams.get("year");
  const year = yearStr ? parseInt(yearStr) : new Date().getFullYear();

  try {
    const results: Record<string, any> = {};

    // Build all the fetch promises upfront so they run in parallel
    const fetches: Record<string, Promise<any>> = {};

    if (section === "all" || section === "trending") {
      fetches.trending = Promise.any([
        getTrending(1, 25).then(d => d && d.length > 0 ? { data: d, source: "anilist" } : Promise.reject("empty")),
        miruroTrending(1, 25).then(d => d && d.length > 0 ? { data: d, source: "miruro" } : Promise.reject("empty")),
        malTopAnime(1, 25, "airing").then(d => d && d.length > 0 ? { data: d, source: "mal" } : Promise.reject("empty")),
      ]).catch(() => ({ data: [], source: "none" }));
    }

    if (section === "all" || section === "popular") {
      fetches.popular = Promise.any([
        getPopular(1, 25).then(d => d && d.length > 0 ? { data: d, source: "anilist" } : Promise.reject("empty")),
        miruroPopular(1, 25).then(d => d && d.length > 0 ? { data: d, source: "miruro" } : Promise.reject("empty")),
        malTopAnime(1, 25, "bypopularity").then(d => d && d.length > 0 ? { data: d, source: "mal" } : Promise.reject("empty")),
      ]).catch(() => ({ data: [], source: "none" }));
    }

    if (section === "all" || section === "topRated") {
      fetches.topRated = Promise.any([
        getTopRated(1, 25).then(d => d && d.length > 0 ? { data: d, source: "anilist" } : Promise.reject("empty")),
        miruroPopular(1, 25).then(d => d && d.length > 0 ? { data: d, source: "miruro" } : Promise.reject("empty")),
        malTopAnime(1, 25, "all").then(d => d && d.length > 0 ? { data: d, source: "mal" } : Promise.reject("empty")),
      ]).catch(() => ({ data: [], source: "none" }));
    }

    if (section === "season" || section === "all") {
      const currentMonth = new Date().getMonth();
      let currentSeason = season;
      if (!currentSeason) {
        if (currentMonth >= 0 && currentMonth <= 2) currentSeason = "WINTER";
        else if (currentMonth >= 3 && currentMonth <= 5) currentSeason = "SPRING";
        else if (currentMonth >= 6 && currentMonth <= 8) currentSeason = "SUMMER";
        else currentSeason = "FALL";
      }

      fetches.season = Promise.any([
        getSeasonAnime(currentSeason!, year, 1, 25).then(d => d && d.length > 0 ? { data: d, source: "anilist" } : Promise.reject("empty")),
        miruroTrending(1, 50).then(d => {
          const filtered = d.filter((a: any) => a.season?.toUpperCase() === currentSeason && a.seasonYear === year);
          return filtered.length > 0 ? { data: filtered, source: "miruro" } : Promise.reject("empty");
        }),
        malSeasonNow(1, 25).then(d => d && d.length > 0 ? { data: d, source: "mal" } : Promise.reject("empty")),
      ]).catch(() => ({ data: [], source: "none" }));

      results.seasonInfo = { season: currentSeason, year };
    }

    // Resolve all fetches in parallel
    const resolved = await Promise.all(Object.values(fetches));
    const keys = Object.keys(fetches);
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      const result = resolved[i];
      results[key] = result.data || [];
      results[`_${key}Source`] = result.source;
    }

    // CDN-cache only when at least one section actually has data. Caching an
    // all-empty payload would pin a blank homepage for the whole TTL. On Vercel
    // this also stops AniList rate-limiting the shared egress IPs, which was
    // forcing the MAL fallback (no descriptions/banners) on the home carousel.
    const hasData = Object.keys(results).some(k => Array.isArray(results[k]) && results[k].length > 0);
    return NextResponse.json(results, {
      headers: {
        "Cache-Control": hasData
          ? "public, s-maxage=1800, stale-while-revalidate=86400"
          : "no-store",
      },
    });
  } catch (err) {
    console.error("[anilist-trending] Error:", err);
    return NextResponse.json({ error: "Failed to fetch trending data" }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
