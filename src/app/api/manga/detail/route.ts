import { NextRequest, NextResponse } from "next/server";
import { getMangaDetail, searchManga, getMangaDetail as getDetail } from "@/lib/manga-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/manga/detail?id={mangaId}&title={fallbackTitle}
 *
 * Cross-provider chapter merge:
 * - English: atsumaru + mangaball (show ALL English scans from both)
 * - Other languages: mangaball only
 *
 * When a mangaball manga detail is loaded, we ALSO search atsumaru
 * for the same title and merge its English chapters. Both providers'
 * English scans are shown — atsumaru first, then mangaball.
 */
export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id");
  const fallbackTitle = request.nextUrl.searchParams.get("title") || "";
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  try {
    const detail = await getMangaDetail(id);

    // Cross-provider metadata fallback: if detail has no genres/description,
    // search atsumaru by title and merge metadata
    if (detail && fallbackTitle && !detail.genres?.length && !detail.description) {
      try {
        const atsuResults = await searchManga(fallbackTitle, 3);
        const match = atsuResults.find(r =>
          (r.englishTitle || r.title).toLowerCase().includes(fallbackTitle.toLowerCase()) ||
          fallbackTitle.toLowerCase().includes((r.englishTitle || r.title).toLowerCase())
        ) || atsuResults[0];

        if (match) {
          const atsuDetail = await getDetail(match.id);
          if (atsuDetail) {
            // Merge metadata but keep mangaball chapters
            if (!detail.description && atsuDetail.description) {
              detail.description = atsuDetail.description;
            }
            if (!detail.genres?.length && atsuDetail.genres?.length) {
              detail.genres = atsuDetail.genres;
              detail.tags = atsuDetail.tags;
            }
            if (detail.title === "Unknown Title" && atsuDetail.title) {
              detail.title = atsuDetail.title;
              detail.englishTitle = atsuDetail.englishTitle;
            }
            if (!detail.poster && atsuDetail.poster) {
              detail.poster = atsuDetail.poster;
              detail.cover = atsuDetail.cover;
            }
            if (!detail.anilistId && atsuDetail.anilistId) {
              detail.anilistId = atsuDetail.anilistId;
            }
          }
        }
      } catch { /* ignore */ }
    }

    // Cross-provider chapter merge: if this is a mangaball manga,
    // also fetch atsumaru English chapters for the same title.
    // Show ALL English scans from BOTH providers.
    if (detail && fallbackTitle && id.startsWith("mb:") && detail.chapters?.length) {
      try {
        // Search atsumaru for the title
        const atsuResults = await searchManga(fallbackTitle, 5);
        // Find best title match
        const match = atsuResults.find(r => {
          const rTitle = (r.englishTitle || r.title || "").toLowerCase();
          const sTitle = fallbackTitle.toLowerCase();
          return rTitle.includes(sTitle) || sTitle.includes(rTitle) ||
                 rTitle.slice(0, 20) === sTitle.slice(0, 20);
        }) || atsuResults[0];

        if (match) {
          // match.id may have 'at:' prefix from searchManga() — strip it
          const atsuMangaId = match.id.replace(/^at:/, "");
          const atsuDetail = await getDetail(`at:${atsuMangaId}`);
          if (atsuDetail && atsuDetail.chapters?.length) {
            // Add atsumaru English chapters
            // ID format: "at:{atsumaruMangaId}:{chapterNumber}"
            const atsuEnChapters = atsuDetail.chapters.map(ch => ({
              ...ch,
              id: `at:${atsuMangaId}:${ch.number}`,
              lang: "en",
              scanGroup: "Atsumaru",
            }));

            // Merge: atsumaru English first, then ALL mangaball chapters (English + non-English)
            detail.chapters = [...atsuEnChapters, ...detail.chapters];
            detail.totalChapters = detail.chapters.length;

            // Merge metadata if still missing
            if (!detail.description && atsuDetail.description) {
              detail.description = atsuDetail.description;
            }
            if (!detail.genres?.length && atsuDetail.genres?.length) {
              detail.genres = atsuDetail.genres;
              detail.tags = atsuDetail.tags;
            }
            if (!detail.poster && atsuDetail.poster) {
              detail.poster = atsuDetail.poster;
              detail.cover = atsuDetail.cover;
            }
          }
        }
      } catch { /* ignore atsumaru merge errors */ }
    }

    if (detail) return NextResponse.json(detail);
    return NextResponse.json({ error: "Manga not found" }, { status: 404 });
  } catch {
    return NextResponse.json({ error: "Failed to fetch manga details" }, { status: 500 });
  }
}
