import { NextRequest, NextResponse } from "next/server";
import { getMangaDetail, searchManga, getMangaDetail as getDetail } from "@/lib/manga-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/manga/detail?id={mangaId}&title={fallbackTitle}
 *
 * The optional `title` param is used for cross-provider fallback:
 * if the primary provider's info endpoint fails (mangaball's is
 * intermittent), we search atsumaru by title and merge the metadata
 * (genres, tags, description, author, poster) while keeping the
 * primary provider's chapters (for multi-language support).
 */
export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id");
  const fallbackTitle = request.nextUrl.searchParams.get("title") || "";
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  try {
    const detail = await getMangaDetail(id);

    // Cross-provider fallback: if detail has no genres/description (info
    // endpoint failed), search atsumaru by title and merge metadata
    if (detail && fallbackTitle && !detail.genres?.length && !detail.description) {
      try {
        const atsuResults = await searchManga(fallbackTitle, 3);
        // Find best match by title
        const match = atsuResults.find(r =>
          (r.englishTitle || r.title).toLowerCase().includes(fallbackTitle.toLowerCase()) ||
          fallbackTitle.toLowerCase().includes((r.englishTitle || r.title).toLowerCase())
        ) || atsuResults[0];

        if (match) {
          const atsuDetail = await getDetail(match.id);
          if (atsuDetail) {
            // Merge atsumaru metadata into the mangaball detail
            // Keep mangaball's chapters (multi-language) but use atsumaru's
            // genres, tags, description, author, poster, status
            return NextResponse.json({
              ...detail,
              title: detail.title === "Unknown Title" ? atsuDetail.title : detail.title,
              englishTitle: atsuDetail.englishTitle || detail.englishTitle,
              poster: detail.poster || atsuDetail.poster,
              banner: atsuDetail.banner || detail.banner,
              cover: detail.cover || atsuDetail.cover,
              description: atsuDetail.description || detail.description,
              genres: atsuDetail.genres?.length ? atsuDetail.genres : detail.genres,
              tags: atsuDetail.tags?.length ? atsuDetail.tags : detail.tags,
              authors: atsuDetail.authors && atsuDetail.authors !== "Unknown" ? atsuDetail.authors : detail.authors,
              artists: atsuDetail.artists?.length ? atsuDetail.artists : detail.artists,
              status: atsuDetail.status || detail.status,
              year: atsuDetail.year || detail.year,
              anilistId: atsuDetail.anilistId || detail.anilistId,
              rating: atsuDetail.rating || detail.rating,
              // Keep mangaball's chapters (they have multi-language support)
              chapters: detail.chapters,
              totalChapters: detail.totalChapters,
              source: detail.source,
            });
          }
        }
      } catch { /* ignore cross-provider fallback errors */ }
    }

    if (detail) return NextResponse.json(detail);
    return NextResponse.json({ error: "Manga not found" }, { status: 404 });
  } catch {
    return NextResponse.json({ error: "Failed to fetch manga details" }, { status: 500 });
  }
}
