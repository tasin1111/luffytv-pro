import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 15;

const TMDB_API_KEY = process.env.TMDB_API_KEY || "";
const TMDB_BASE = "https://api.themoviedb.org/3";
const TMDB_IMG = "https://image.tmdb.org/t/p";

interface TMDBLogo {
  logoUrl: string;
  backdropUrl: string;
}

const cache = new Map<number, TMDBLogo>();

/**
 * GET /api/anime/tmdb-images?anilistId={id}&title={title}
 * Returns TMDB logo (transparent PNG) + high-quality backdrop.
 */
export async function GET(request: NextRequest) {
  const anilistId = parseInt(request.nextUrl.searchParams.get("anilistId") || "0", 10);
  const title = request.nextUrl.searchParams.get("title") || "";

  if (!anilistId || !TMDB_API_KEY) {
    return NextResponse.json({ error: "Missing anilistId or TMDB_API_KEY" }, { status: 400 });
  }

  if (cache.has(anilistId)) {
    return NextResponse.json(cache.get(anilistId));
  }

  try {
    // Search TMDB by title
    const searchUrl = `${TMDB_BASE}/search/tv?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(title)}&include_adult=false`;
    const searchRes = await fetch(searchUrl, { cache: "no-store" });
    if (!searchRes.ok) return NextResponse.json({ logoUrl: "", backdropUrl: "" });
    const searchData = await searchRes.json();
    const results = searchData?.results || [];
    if (results.length === 0) return NextResponse.json({ logoUrl: "", backdropUrl: "" });

    const tmdbId = results[0].id;

    // Get images
    const imagesUrl = `${TMDB_BASE}/tv/${tmdbId}/images?api_key=${TMDB_API_KEY}&include_image_language=en,null`;
    const imagesRes = await fetch(imagesUrl, { cache: "no-store" });
    if (!imagesRes.ok) return NextResponse.json({ logoUrl: "", backdropUrl: "" });
    const imagesData = await imagesRes.json();

    // Best English logo (transparent PNG)
    const logos = imagesData?.logos || [];
    const enLogos = logos.filter((l: any) => l.iso_639_1 === "en");
    const bestLogo = enLogos[0] || logos[0];
    const logoUrl = bestLogo ? `${TMDB_IMG}/original${bestLogo.file_path}` : "";

    // Best backdrop
    const backdrops = imagesData?.backdrops || [];
    const bestBd = backdrops.find((b: any) => b.iso_639_1 === null) || backdrops[0];
    const backdropUrl = bestBd ? `${TMDB_IMG}/original${bestBd.file_path}` : "";

    const result: TMDBLogo = { logoUrl, backdropUrl };
    cache.set(anilistId, result);
    setTimeout(() => cache.delete(anilistId), 600000);

    return NextResponse.json(result, {
      headers: { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=1200" },
    });
  } catch {
    return NextResponse.json({ logoUrl: "", backdropUrl: "" });
  }
}
