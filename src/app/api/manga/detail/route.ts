import { NextRequest, NextResponse } from "next/server";
import { getMangaDetail, searchManga, getMangaDetail as getDetail } from "@/lib/manga-api";
import { getComixDetail } from "@/lib/comix-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/manga/detail?id={mangaId}&title={fallbackTitle}
 *
 * The optional `title` param is used for:
 * 1. Cross-provider metadata fallback (atsumaru for genres/description)
 * 2. Cross-provider chapter merge (comix.to for additional English scans)
 *
 * When a mangaball manga is opened, we ALSO search comix.to for the same
 * title and merge its English chapter scans into the chapter list. This
 * ensures the user sees ALL available English scans from both providers.
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
        const match = atsuResults.find(r =>
          (r.englishTitle || r.title).toLowerCase().includes(fallbackTitle.toLowerCase()) ||
          fallbackTitle.toLowerCase().includes((r.englishTitle || r.title).toLowerCase())
        ) || atsuResults[0];

        if (match) {
          const atsuDetail = await getDetail(match.id);
          if (atsuDetail) {
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
              chapters: detail.chapters,
              totalChapters: detail.totalChapters,
              source: detail.source,
            });
          }
        }
      } catch { /* ignore cross-provider fallback errors */ }
    }

    // Cross-provider chapter merge: if this is a mangaball manga,
    // ALSO fetch comix.to chapters for the same title and merge them.
    // This adds additional English scan groups from comix.to's huge library.
    if (detail && fallbackTitle && id.startsWith("mb:") && detail.chapters?.length) {
      try {
        // Search comix.to via the comix-proxy route for the title
        const origin = process.env.VERCEL_URL
          ? `https://${process.env.VERCEL_URL}`
          : process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

        // Fetch comix.to browse page and search for the title
        const comixSearchUrl = `${origin}/api/manga/comix-proxy?url=${encodeURIComponent(
          `https://comix.to/browse?q=${encodeURIComponent(fallbackTitle)}`
        )}`;
        const comixSearchRes = await fetch(comixSearchUrl, {
          signal: AbortSignal.timeout(20000),
        });

        if (comixSearchRes.ok) {
          const comixSearchData = await comixSearchRes.json();
          const comixHtml = comixSearchData.html || "";

          // Parse manga entries from the browse page HTML
          // Look for title links that match the search title
          const titleLinks = comixHtml.match(/\/title\/([a-z0-9]+)-([a-z0-9-]+)/g) || [];
          const uniqueHids = new Set<string>();
          for (const link of titleLinks) {
            const hidMatch = link.match(/\/title\/([a-z0-9]+)-/);
            if (hidMatch) uniqueHids.add(hidMatch[1]);
          }

          // Try each HID to find a title match
          for (const hid of uniqueHids) {
            try {
              const comixDetail = await getComixDetail(hid);
              if (comixDetail && comixDetail.chapters?.length) {
                // Check if titles match (case-insensitive, partial match)
                const comixTitle = (comixDetail.englishTitle || comixDetail.title || "").toLowerCase();
                const searchTitle = fallbackTitle.toLowerCase();
                if (comixTitle.includes(searchTitle) || searchTitle.includes(comixTitle) ||
                    comixTitle.slice(0, 30) === searchTitle.slice(0, 30)) {
                  // Merge comix.to chapters into the mangaball chapters
                  // Mark them with source "comix" so the reader knows how to load pages
                  const comixChapters = comixDetail.chapters.map(ch => ({
                    ...ch,
                    id: `cx:${hid}:${ch.id}`,  // Prefix with comix HID for reader routing
                    lang: "en",
                    scanGroup: ch.scanGroup || "Comix",
                  }));

                  // Merge: add comix chapters that don't duplicate existing mangaball chapters
                  // (by number + group name)
                  const existingKeys = new Set(
                    detail.chapters.map(ch => `${ch.number}:${ch.scanGroup || ch.lang || ""}`)
                  );
                  const newChapters = comixChapters.filter(ch => {
                    const key = `${ch.number}:${ch.scanGroup || "Comix"}`;
                    return !existingKeys.has(key);
                  });

                  if (newChapters.length > 0) {
                    detail.chapters = [...detail.chapters, ...newChapters];
                    detail.totalChapters = detail.chapters.length;
                  }
                  break; // Found the match, stop searching
                }
              }
            } catch { /* ignore individual comix title fetch errors */ }
          }
        }
      } catch { /* ignore comix chapter merge errors */ }
    }

    if (detail) return NextResponse.json(detail);
    return NextResponse.json({ error: "Manga not found" }, { status: 404 });
  } catch {
    return NextResponse.json({ error: "Failed to fetch manga details" }, { status: 500 });
  }
}

