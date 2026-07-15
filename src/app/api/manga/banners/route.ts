import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 20;

/**
 * GET /api/manga/banners?ids=30002,30013,16498
 *
 * Takes a comma-separated list of AniList manga IDs and returns a
 * map of { anilistId: { banner, cover, title, score, genres } }.
 * Used by the manga page to fetch real banner images for the hero
 * carousel + featured section (atsumaru only returns posters).
 *
 * AniList GraphQL is public — no auth needed.
 */

const cache = new Map<number, any>();

export async function GET(request: NextRequest) {
  const idsParam = request.nextUrl.searchParams.get("ids") || "";
  if (!idsParam) {
    return NextResponse.json({ error: "ids required (comma-separated)" }, { status: 400 });
  }

  const ids = idsParam
    .split(",")
    .map(s => parseInt(s.trim(), 10))
    .filter(n => !isNaN(n) && n > 0);

  if (ids.length === 0) {
    return NextResponse.json({ banners: {} });
  }

  // Only fetch IDs we don't already have cached
  const toFetch = ids.filter(id => !cache.has(id));

  if (toFetch.length > 0) {
    try {
      // AniList GraphQL — query multiple manga at once
      const query = `
        query($ids: [Int]) {
          Page(perPage: 50) {
            media(id_in: $ids, type: MANGA) {
              id
              title { english romaji native }
              bannerImage
              coverImage { extraLarge large medium }
              averageScore
              genres
              description
              status
              format
            }
          }
        }
      `;
      const res = await fetch("https://graphql.anilist.co", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, variables: { ids: toFetch } }),
        cache: "no-store",
      });
      if (res.ok) {
        const json = await res.json();
        const media = json?.data?.Page?.media || [];
        for (const m of media) {
          cache.set(m.id, {
            id: m.id,
            title: m.title?.english || m.title?.romaji || m.title?.native || "Unknown",
            banner: m.bannerImage || "",
            cover: m.coverImage?.extraLarge || m.coverImage?.large || m.coverImage?.medium || "",
            score: m.averageScore || 0,
            genres: m.genres || [],
            description: m.description || "",
            status: m.status || "",
            format: m.format || "",
          });
        }
      }
    } catch (err: any) {
      console.error("[manga/banners] Error:", err?.message || err);
    }
  }

  const banners: Record<number, any> = {};
  for (const id of ids) {
    if (cache.has(id)) banners[id] = cache.get(id);
  }

  return NextResponse.json({ banners });
}
