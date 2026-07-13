"use client";

import { useState, useEffect } from "react";
import { useAppStore } from "./store";
import { coverUrl, type Novel, type NovelDetail } from "@/lib/novel-api";

// ============================================================
// NOVEL DETAIL PAGE — Novel info + chapter list
// White + purple theme (matches NovelNavbar)
// Powered by novelarchive.cc API
// ============================================================

interface NovelDetailProps {
  novelId: string;
  novelTitle: string;
  novelCover: string;
  novelAuthor: string;
  novelSource: string;
}

// Tailwind-safe genre accent classes
const genreTextClass: Record<string, string> = {
  action: "text-red-600",
  adventure: "text-green-600",
  comedy: "text-amber-600",
  drama: "text-blue-600",
  fantasy: "text-purple-600",
  harem: "text-pink-600",
  isekai: "text-indigo-600",
  mystery: "text-cyan-600",
  romance: "text-pink-500",
  "sci-fi": "text-emerald-600",
  supernatural: "text-purple-600",
};
const genreBgClass: Record<string, string> = {
  action: "bg-red-50",
  adventure: "bg-green-50",
  comedy: "bg-amber-50",
  drama: "bg-blue-50",
  fantasy: "bg-purple-50",
  harem: "bg-pink-50",
  isekai: "bg-indigo-50",
  mystery: "bg-cyan-50",
  romance: "bg-pink-50",
  "sci-fi": "bg-emerald-50",
  supernatural: "bg-purple-50",
};
const genreBorderClass: Record<string, string> = {
  action: "border-red-100",
  adventure: "border-green-100",
  comedy: "border-amber-100",
  drama: "border-blue-100",
  fantasy: "border-purple-100",
  harem: "border-pink-100",
  isekai: "border-indigo-100",
  mystery: "border-cyan-100",
  romance: "border-pink-100",
  "sci-fi": "border-emerald-100",
  supernatural: "border-purple-100",
};

function genreClasses(genre: string) {
  const key = genre.toLowerCase();
  return {
    text: genreTextClass[key] || "text-purple-600",
    bg: genreBgClass[key] || "bg-purple-50",
    border: genreBorderClass[key] || "border-purple-100",
  };
}

export default function NovelDetailPage({ novelId, novelTitle, novelCover, novelAuthor }: NovelDetailProps) {
  const navigate = useAppStore(s => s.navigate);
  const [detail, setDetail] = useState<NovelDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [chapterSearch, setChapterSearch] = useState("");
  const [descExpanded, setDescExpanded] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/novels/${novelId}`);
        if (!res.ok) return;
        const data = await res.json();
        setDetail(data);
      } catch (e) {
        console.error("Novel detail error:", e);
      } finally {
        setLoading(false);
      }
    })();
  }, [novelId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center pt-16 bg-gray-50">
        <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center pt-16 gap-4 bg-gray-50">
        <p className="text-gray-500">Novel not found</p>
        <button onClick={() => navigate({ page: "novel" })} className="text-purple-600 hover:underline text-sm">
          Back to Novels
        </button>
      </div>
    );
  }

  const novel: Novel = detail.novel;
  const cover = novelCover || coverUrl(novel, 500);
  const genres = (novel.genres || "").split(",").filter(Boolean);
  const totalChapters = parseInt(novel.total_chapters || "0") || 0;
  const chapterNames = detail.chapter_names || [];
  const filteredChapters = chapterSearch
    ? chapterNames.map((name, i) => ({ name, num: i + 1 })).filter(c => c.name.toLowerCase().includes(chapterSearch.toLowerCase()) || String(c.num).includes(chapterSearch))
    : chapterNames.map((name, i) => ({ name, num: i + 1 }));

  const handleReadChapter = (chapterNum: number) => {
    navigate({
      page: "novel-read",
      novelId,
      novelTitle: novel.title,
      chapterId: `chapter-${chapterNum}`,
      chapterNum,
      chapterTitle: chapterNames[chapterNum - 1] || `Chapter ${chapterNum}`,
      totalChapters,
      novelSource: "novelarchive",
    } as any);
  };

  return (
    <div className="min-h-screen pb-12 bg-gray-50">
      {/* ═══ HERO BANNER ═══ */}
      <div className="relative h-[40vh] min-h-[300px] w-full overflow-hidden bg-gradient-to-br from-purple-50 via-white to-purple-100/40">
        <div className="absolute inset-0">
          {cover && (
            <img src={cover} alt="" className="w-full h-full object-cover scale-110 opacity-25" style={{ filter: "blur(30px)" }} />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-white via-white/85 to-white/40" />
        </div>

        <button
          onClick={() => navigate({ page: "novel" })}
          className="absolute top-20 left-4 z-10 flex items-center gap-1 px-3 py-1.5 rounded-full bg-white/80 backdrop-blur-sm border border-purple-100 text-sm text-gray-700 hover:bg-white hover:border-purple-300 transition-colors shadow-sm"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M15 18l-6-6 6-6" /></svg>
          Back
        </button>

        <div className="relative h-full max-w-5xl mx-auto px-4 flex items-end pb-6">
          <div className="flex gap-5 w-full">
            {/* Cover */}
            <div className="shrink-0 w-28 sm:w-40 aspect-[3/4] rounded-xl overflow-hidden shadow-xl shadow-purple-200/50 border-4 border-white">
              {cover ? (
                <img src={cover} alt={novel.title} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-purple-50">
                  <svg className="w-10 h-10 text-purple-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                    <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
                    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
                  </svg>
                </div>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0 space-y-2">
              <h1 className="text-xl sm:text-3xl font-extrabold text-gray-800 leading-tight">{novel.title}</h1>
              <p className="text-sm text-gray-500">by {novel.author}</p>

              {/* Stat badges */}
              <div className="flex items-center gap-2 flex-wrap">
                {novel.rating > 0 && (
                  <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-50 border border-amber-100 text-xs font-bold text-amber-700">
                    ★ {novel.rating.toFixed(1)}
                  </span>
                )}
                {totalChapters > 0 && (
                  <span className="px-2.5 py-1 rounded-full bg-purple-50 border border-purple-100 text-xs font-bold text-purple-700">
                    {totalChapters} Chapters
                  </span>
                )}
                {novel.views_number > 0 && (
                  <span className="px-2.5 py-1 rounded-full bg-blue-50 border border-blue-100 text-xs font-bold text-blue-700">
                    {novel.views_number > 999 ? `${(novel.views_number / 1000).toFixed(1)}k` : novel.views_number} Views
                  </span>
                )}
                {novel.release_status === "ongoing" && (
                  <span className="px-2.5 py-1 rounded-full bg-green-50 border border-green-100 text-xs font-bold text-green-700">
                    Ongoing
                  </span>
                )}
              </div>

              {/* Genres */}
              {genres.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {genres.map(g => {
                    const gc = genreClasses(g);
                    return (
                      <span
                        key={g}
                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${gc.bg} ${gc.text} ${gc.border}`}
                      >
                        {g}
                      </span>
                    );
                  })}
                </div>
              )}

              {/* Start Reading */}
              {totalChapters > 0 && (
                <button
                  onClick={() => handleReadChapter(1)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-purple-500 text-white font-bold text-sm hover:bg-purple-600 transition-all hover:scale-105 shadow-lg shadow-purple-200 mt-2"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" /></svg>
                  Start Reading
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ═══ DESCRIPTION + CHAPTERS ═══ */}
      <div className="max-w-4xl mx-auto px-4 mt-6 space-y-6">
        {/* Synopsis */}
        {novel.description && (
          <section className="bg-white border border-purple-100 rounded-2xl p-5 shadow-sm shadow-purple-100/40">
            <h2 className="text-base font-bold text-gray-800 mb-2">Synopsis</h2>
            <p className={`text-sm text-gray-600 leading-relaxed whitespace-pre-line ${descExpanded ? "" : "line-clamp-4"}`}>
              {novel.description}
            </p>
            {novel.description.length > 200 && (
              <button onClick={() => setDescExpanded(!descExpanded)} className="text-xs text-purple-600 hover:underline mt-1 font-medium">
                {descExpanded ? "Show Less" : "Read More"}
              </button>
            )}
          </section>
        )}

        {/* Chapter List */}
        <section className="bg-white border border-purple-100 rounded-2xl p-5 shadow-sm shadow-purple-100/40">
          <div className="flex items-center justify-between mb-3 gap-3">
            <h2 className="text-base font-bold text-gray-800">
              Chapters <span className="text-gray-400 font-normal text-sm">({chapterNames.length})</span>
            </h2>
            <div className="relative flex-1 max-w-xs">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-purple-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                value={chapterSearch}
                onChange={e => setChapterSearch(e.target.value)}
                placeholder="Search chapters..."
                className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-purple-50 border border-purple-100 text-sm text-gray-700 placeholder-gray-400 outline-none focus:border-purple-400 focus:bg-white transition-all"
              />
            </div>
          </div>

          <div className="space-y-0.5 max-h-[500px] overflow-y-auto rounded-xl border border-purple-50 bg-gray-50/50 p-2">
            {filteredChapters.length === 0 ? (
              <p className="text-center text-gray-400 text-sm py-8">No chapters found</p>
            ) : (
              filteredChapters.slice(0, 200).map(c => (
                <button
                  key={c.num}
                  onClick={() => handleReadChapter(c.num)}
                  className="w-full flex items-center gap-3 px-2.5 py-2 rounded-lg hover:bg-purple-50 border border-transparent hover:border-purple-100 transition-colors text-left group bg-white"
                >
                  <span className="shrink-0 w-8 h-8 rounded-lg bg-purple-50 border border-purple-100 flex items-center justify-center text-[10px] font-bold text-purple-600 group-hover:bg-purple-100 group-hover:text-purple-700 transition-colors">
                    {c.num}
                  </span>
                  <span className="flex-1 text-sm text-gray-600 group-hover:text-purple-700 transition-colors truncate">
                    {c.name}
                  </span>
                  <svg className="w-3.5 h-3.5 text-gray-300 group-hover:text-purple-500 transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path d="M9 18l6-6-6-6" />
                  </svg>
                </button>
              ))
            )}
            {filteredChapters.length > 200 && (
              <p className="text-center text-xs text-gray-400 py-3">
                Showing first 200 of {filteredChapters.length} chapters
              </p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
