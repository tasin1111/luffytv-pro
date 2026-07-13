"use client";

import { useState, useEffect } from "react";
import { useAppStore } from "./store";
import { coverUrl, type Novel } from "@/lib/novel-api";

// ============================================================
// NOVEL PAGE — Browse, search, and discover novels
// White + purple theme (matches NovelNavbar)
// Powered by novelarchive.cc API
// ============================================================

// Tailwind-safe genre accent classes. We use a small lookup so the JIT
// compiler sees the literal class names.
const genreTextClass: Record<string, string> = {
  action: "text-red-600",
  adventure: "text-green-600",
  comedy: "text-amber-600",
  drama: "text-blue-600",
  fantasy: "text-purple-600",
  harem: "text-pink-600",
  isekai: "text-indigo-600",
  "martial arts": "text-orange-600",
  mystery: "text-cyan-600",
  romance: "text-pink-500",
  "sci-fi": "text-emerald-600",
  "slice of life": "text-lime-600",
  supernatural: "text-purple-600",
  horror: "text-red-700",
};
const genreBgClass: Record<string, string> = {
  action: "bg-red-50",
  adventure: "bg-green-50",
  comedy: "bg-amber-50",
  drama: "bg-blue-50",
  fantasy: "bg-purple-50",
  harem: "bg-pink-50",
  isekai: "bg-indigo-50",
  "martial arts": "bg-orange-50",
  mystery: "bg-cyan-50",
  romance: "bg-pink-50",
  "sci-fi": "bg-emerald-50",
  "slice of life": "bg-lime-50",
  supernatural: "bg-purple-50",
  horror: "bg-red-50",
};
const genreBorderClass: Record<string, string> = {
  action: "border-red-100",
  adventure: "border-green-100",
  comedy: "border-amber-100",
  drama: "border-blue-100",
  fantasy: "border-purple-100",
  harem: "border-pink-100",
  isekai: "border-indigo-100",
  "martial arts": "border-orange-100",
  mystery: "border-cyan-100",
  romance: "border-pink-100",
  "sci-fi": "border-emerald-100",
  "slice of life": "border-lime-100",
  supernatural: "border-purple-100",
  horror: "border-red-100",
};

function genreClasses(genre: string) {
  const key = genre.toLowerCase();
  return {
    text: genreTextClass[key] || "text-purple-600",
    bg: genreBgClass[key] || "bg-purple-50",
    border: genreBorderClass[key] || "border-purple-100",
  };
}

// ── Novel Card ──
function NovelCard({ novel, onClick }: { novel: Novel; onClick: (n: Novel) => void }) {
  const cover = coverUrl(novel, 320);
  const genres = (novel.genres || "").split(",").filter(Boolean).slice(0, 2);
  const totalChapters = parseInt(novel.total_chapters || "0") || 0;

  return (
    <button
      onClick={() => onClick(novel)}
      className="group relative bg-white border border-purple-100 hover:border-purple-300 rounded-2xl overflow-hidden transition-all duration-300 hover:scale-[1.02] hover:shadow-lg hover:shadow-purple-100/60 text-left w-full"
    >
      <div className="p-3">
        <div className="flex gap-3">
          {/* Cover */}
          <div className="w-14 h-20 rounded-lg bg-purple-50 border border-purple-100 flex items-center justify-center overflow-hidden flex-shrink-0">
            {cover ? (
              <img src={cover} alt={novel.title} className="w-full h-full object-cover" loading="lazy" />
            ) : (
              <svg className="w-7 h-7 text-purple-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
              </svg>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-gray-800 line-clamp-2 leading-snug group-hover:text-purple-600 transition-colors">
              {novel.title}
            </h3>
            {novel.author && (
              <p className="text-[10px] text-gray-500 mt-1 truncate">{novel.author}</p>
            )}
            <div className="flex flex-wrap gap-1 mt-1.5">
              {genres.map(g => {
                const gc = genreClasses(g);
                return (
                  <span
                    key={g}
                    className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full border ${gc.bg} ${gc.text} ${gc.border}`}
                  >
                    {g}
                  </span>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between mt-3 pt-2 border-t border-gray-100">
          <div className="flex items-center gap-2">
            {novel.rating > 0 && (
              <span className="flex items-center gap-0.5 text-[10px] text-amber-600 font-medium">
                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
                {novel.rating.toFixed(1)}
              </span>
            )}
            {totalChapters > 0 && (
              <span className="text-[10px] text-gray-500">
                {totalChapters > 999 ? `${(totalChapters / 1000).toFixed(1)}k` : totalChapters} ch
              </span>
            )}
          </div>
          {novel.release_status === "ongoing" && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-green-50 text-green-600 border border-green-100">
              Ongoing
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

function NovelCardSkeleton() {
  return (
    <div className="bg-white border border-purple-100 rounded-2xl p-3 animate-pulse">
      <div className="flex gap-3">
        <div className="w-14 h-20 rounded-lg bg-gray-100" />
        <div className="flex-1 space-y-2">
          <div className="h-3 bg-gray-100 rounded w-full" />
          <div className="h-3 bg-gray-100 rounded w-2/3" />
          <div className="h-2 bg-gray-100 rounded w-1/2" />
        </div>
      </div>
    </div>
  );
}

// ============================================================
// NOVEL PAGE — Main component
// ============================================================
export default function NovelPage() {
  const navigate = useAppStore(s => s.navigate);
  const [searchQuery, setSearchQuery] = useState("");
  const [trending, setTrending] = useState<Novel[]>([]);
  const [recent, setRecent] = useState<Novel[]>([]);
  const [updated, setUpdated] = useState<Novel[]>([]);
  const [editorsChoice, setEditorsChoice] = useState<Novel[]>([]);
  const [genres, setGenres] = useState<{ value: string; label: string }[]>([]);
  const [searchResults, setSearchResults] = useState<Novel[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchMode, setSearchMode] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [heroIdx, setHeroIdx] = useState(0);

  // Load home data
  useEffect(() => {
    (async () => {
      try {
        const [tr, rc, up, ed, gn] = await Promise.all([
          fetch("/api/novels/trending?limit=12").then(r => r.json()).catch(() => ({ novels: [] })),
          fetch("/api/novels/recent?limit=12").then(r => r.json()).catch(() => ({ novels: [] })),
          fetch("/api/novels/recently-updated?limit=12").then(r => r.json()).catch(() => ({ novels: [] })),
          fetch("/api/novels/editors-choice?limit=5").then(r => r.json()).catch(() => ({ novels: [] })),
          fetch("/api/novels/genres").then(r => r.json()).catch(() => ({ genres: [] })),
        ]);
        setTrending(tr.novels || []);
        setRecent(rc.novels || []);
        setUpdated(up.novels || []);
        setEditorsChoice(ed.novels || []);
        setGenres(gn.genres || []);
      } catch (e) {
        console.error("Novel home error:", e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Rotate hero
  useEffect(() => {
    if (editorsChoice.length === 0) return;
    const interval = setInterval(() => {
      setHeroIdx(prev => (prev + 1) % Math.min(editorsChoice.length, 5));
    }, 7000);
    return () => clearInterval(interval);
  }, [editorsChoice]);

  // Debounced search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchMode(false);
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setSearchMode(true);
      setSearchLoading(true);
      try {
        const res = await fetch(`/api/novels/search?q=${encodeURIComponent(searchQuery)}&limit=24`);
        const data = await res.json();
        setSearchResults(data.novels || []);
      } catch {
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleNovelClick = (novel: Novel) => {
    navigate({
      page: "novel-detail",
      novelId: novel.id,
      novelTitle: novel.title,
      novelCover: coverUrl(novel, 400),
      novelAuthor: novel.author || "",
      novelSource: "novelarchive",
    } as any);
  };

  const heroNovel = editorsChoice[heroIdx];

  return (
    <div className="min-h-screen pb-8 bg-gray-50">
      {/* ── HERO SPOTLIGHT ── */}
      {heroNovel ? (
        <HeroSpotlight novel={heroNovel} onRead={() => handleNovelClick(heroNovel)} />
      ) : loading ? (
        <div className="h-[40vh] bg-purple-50 animate-pulse" />
      ) : null}

      {/* ── SEARCH BAR ── */}
      <div className="max-w-2xl mx-auto px-4 mb-8 -mt-8 relative z-10">
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search novels by title, author, or genre..."
            className="w-full bg-white border border-purple-100 rounded-xl pl-10 pr-4 py-3 text-sm text-gray-700 placeholder-gray-400 outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100 transition-all shadow-md shadow-purple-100/40"
          />
        </div>
      </div>

      {/* ── SEARCH RESULTS ── */}
      {searchMode ? (
        <div className="px-4 max-w-7xl mx-auto">
          <h2 className="text-lg font-bold text-gray-800 mb-4">
            Search Results {searchResults.length > 0 && `(${searchResults.length})`}
          </h2>
          {searchLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {Array.from({ length: 8 }).map((_, i) => <NovelCardSkeleton key={i} />)}
            </div>
          ) : searchResults.length === 0 ? (
            <p className="text-center text-gray-400 text-sm py-12">No novels found. Try a different search.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {searchResults.map((n, i) => <NovelCard key={n.id} novel={n} onClick={handleNovelClick} />)}
            </div>
          )}
        </div>
      ) : (
        <>
          {/* ── TRENDING NOW ── */}
          <Section title="Trending Now" accent="bg-orange-500">
            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {Array.from({ length: 8 }).map((_, i) => <NovelCardSkeleton key={i} />)}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {trending.slice(0, 12).map((n, i) => <NovelCard key={n.id} novel={n} onClick={handleNovelClick} />)}
              </div>
            )}
          </Section>

          {/* ── RECENTLY UPDATED ── */}
          <Section title="Recently Updated" accent="bg-blue-500">
            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {Array.from({ length: 8 }).map((_, i) => <NovelCardSkeleton key={i} />)}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {updated.slice(0, 12).map((n, i) => <NovelCard key={n.id} novel={n} onClick={handleNovelClick} />)}
              </div>
            )}
          </Section>

          {/* ── BROWSE BY GENRE ── */}
          {genres.length > 0 && (
            <Section title="Browse by Genre" accent="bg-purple-500">
              <div className="flex flex-wrap gap-2">
                {genres.slice(0, 24).map((g) => (
                  <button
                    key={g.value}
                    onClick={() => setSearchQuery(g.label)}
                    className="px-3 py-1.5 rounded-full bg-purple-50 border border-purple-100 text-xs font-medium text-purple-600 hover:border-purple-300 hover:bg-purple-100 hover:text-purple-700 transition-all"
                  >
                    {g.label}
                  </button>
                ))}
              </div>
            </Section>
          )}

          {/* ── NEW ARRIVALS ── */}
          <Section title="New Arrivals" accent="bg-red-500">
            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {Array.from({ length: 8 }).map((_, i) => <NovelCardSkeleton key={i} />)}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {recent.slice(0, 12).map((n, i) => <NovelCard key={n.id} novel={n} onClick={handleNovelClick} />)}
              </div>
            )}
          </Section>
        </>
      )}
    </div>
  );
}

// ── Hero Spotlight ───────────────────────────────────────────────────────────

function HeroSpotlight({ novel, onRead }: { novel: Novel; onRead: () => void }) {
  const cover = coverUrl(novel, 800);
  const genres = (novel.genres || "").split(",").filter(Boolean).slice(0, 4);
  const totalChapters = parseInt(novel.total_chapters || "0") || 0;

  return (
    <section className="relative h-[45vh] min-h-[320px] w-full overflow-hidden bg-gradient-to-br from-purple-50 via-white to-purple-100/40">
      <div className="absolute inset-0">
        {cover && (
          <img src={cover} alt="" className="w-full h-full object-cover scale-110 opacity-20" style={{ filter: "blur(20px)" }} />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-white via-white/80 to-white/40" />
      </div>

      <div className="relative h-full max-w-7xl mx-auto px-4 flex items-end pb-8 pt-16">
        <div className="flex gap-5 items-end w-full">
          <div className="shrink-0 w-28 sm:w-40 aspect-[3/4] rounded-xl overflow-hidden shadow-xl shadow-purple-200/50 border-4 border-white hidden sm:block">
            {cover && <img src={cover} alt={novel.title} className="w-full h-full object-cover" />}
          </div>

          <div className="flex-1 min-w-0 space-y-2">
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-purple-100 border border-purple-200 text-xs font-bold text-purple-700">
              ✦ Editor's Choice
            </span>
            <h1 className="text-2xl sm:text-4xl font-extrabold text-gray-800 leading-tight">{novel.title}</h1>
            <p className="text-sm text-gray-500">by {novel.author}</p>
            <p className="text-sm text-gray-600 line-clamp-2 max-w-2xl">{(novel.description || "").replace(/\\n/g, " ").slice(0, 200)}</p>
            <div className="flex items-center gap-3 text-sm flex-wrap">
              {novel.rating > 0 && <span className="text-amber-600 font-medium">★ {novel.rating.toFixed(1)}</span>}
              {totalChapters > 0 && <span className="text-gray-500">{totalChapters} chapters</span>}
            </div>
            <button
              onClick={onRead}
              className="mt-2 inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-purple-500 text-white font-bold text-sm hover:bg-purple-600 transition-all hover:scale-105 shadow-lg shadow-purple-200"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" /></svg>
              Start Reading
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Section wrapper ──────────────────────────────────────────────────────────

function Section({ title, accent, children }: { title: string; accent: string; children: React.ReactNode }) {
  return (
    <section className="px-4 max-w-7xl mx-auto mb-10">
      <div className="flex items-center gap-2 mb-4">
        <div className={`w-1 h-5 rounded-full ${accent}`} />
        <h2 className="text-lg sm:text-xl font-bold text-gray-800">{title}</h2>
      </div>
      {children}
    </section>
  );
}
