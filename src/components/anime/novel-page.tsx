"use client";

import { useState, useEffect } from "react";
import { useAppStore } from "./store";
import { coverUrl, type Novel } from "@/lib/novel-api";

// ============================================================
// NOVEL PAGE — Browse, search, and discover novels
// Black + white theme (matches LuffyTV site)
// Powered by novelarchive.cc API
// ============================================================

// ── Novel Card ──
function NovelCard({ novel, onClick }: { novel: Novel; onClick: (n: Novel) => void }) {
  const cover = coverUrl(novel, 320);
  const genres = (novel.genres || "").split(",").filter(Boolean).slice(0, 2);
  const totalChapters = parseInt(novel.total_chapters || "0") || 0;

  return (
    <button
      onClick={() => onClick(novel)}
      className="group relative bg-white/[0.02] border border-white/[0.06] hover:border-white/[0.12] rounded-2xl overflow-hidden transition-all duration-300 hover:scale-[1.02] hover:shadow-lg hover:shadow-black/50 text-left w-full"
    >
      <div className="p-3">
        <div className="flex gap-3">
          {/* Cover */}
          <div className="w-14 h-20 rounded-lg bg-white/[0.04] border border-white/[0.06] flex items-center justify-center overflow-hidden flex-shrink-0">
            {cover ? (
              <img src={cover} alt={novel.title} className="w-full h-full object-cover" loading="lazy" />
            ) : (
              <svg className="w-7 h-7 text-white/30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
              </svg>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-white line-clamp-2 leading-snug group-hover:text-white transition-colors">
              {novel.title}
            </h3>
            {novel.author && (
              <p className="text-[10px] text-white/40 mt-1 truncate">{novel.author}</p>
            )}
            <div className="flex flex-wrap gap-1 mt-1.5">
              {genres.map(g => (
                <span
                  key={g}
                  className="text-[8px] font-bold px-1.5 py-0.5 rounded-full bg-white/[0.06] text-white/60 border border-white/[0.08]"
                >
                  {g}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between mt-3 pt-2 border-t border-white/[0.06]">
          <div className="flex items-center gap-2">
            {novel.rating > 0 && (
              <span className="flex items-center gap-0.5 text-[10px] text-[#D4A017] font-medium">
                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
                {novel.rating.toFixed(1)}
              </span>
            )}
            {totalChapters > 0 && (
              <span className="text-[10px] text-white/40">
                {totalChapters > 999 ? `${(totalChapters / 1000).toFixed(1)}k` : totalChapters} ch
              </span>
            )}
          </div>
          {novel.release_status === "ongoing" && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-white/[0.06] text-emerald-400 border border-white/[0.08]">
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
    <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-3 animate-pulse">
      <div className="flex gap-3">
        <div className="w-14 h-20 rounded-lg bg-white/[0.04]" />
        <div className="flex-1 space-y-2">
          <div className="h-3 bg-white/[0.04] rounded w-full" />
          <div className="h-3 bg-white/[0.04] rounded w-2/3" />
          <div className="h-2 bg-white/[0.04] rounded w-1/2" />
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

  // Listen for search events from the NovelNavbar
  useEffect(() => {
    const onNovelSearch = (e: Event) => {
      const detail = (e as CustomEvent).detail as string;
      if (detail) {
        setSearchQuery(detail);
        // Scroll to top so search results are visible
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    };
    window.addEventListener("novel-search", onNovelSearch);
    return () => window.removeEventListener("novel-search", onNovelSearch);
  }, []);

  // Listen for tab events from the NovelNavbar (scroll to section)
  useEffect(() => {
    const onNovelTab = (e: Event) => {
      const detail = (e as CustomEvent).detail as string;
      if (detail) {
        // Clear search if we're switching to a section
        if (detail === "trending" || detail === "browse" || detail === "recent") {
          setSearchQuery("");
        }
        // Scroll to the section after a short delay (to ensure DOM is ready)
        setTimeout(() => {
          const el = document.getElementById(`novel-section-${detail}`);
          if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 150);
      }
    };
    window.addEventListener("novel-tab", onNovelTab);
    return () => window.removeEventListener("novel-tab", onNovelTab);
  }, []);

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
    <div className="min-h-screen pb-8 bg-black">
      {/* ── HERO SPOTLIGHT ── */}
      {heroNovel ? (
        <HeroSpotlight novel={heroNovel} onRead={() => handleNovelClick(heroNovel)} />
      ) : loading ? (
        <div className="h-[40vh] bg-white/[0.02] animate-pulse" />
      ) : null}

      {/* ── SEARCH BAR ── */}
      <div className="max-w-2xl mx-auto px-4 mb-8 -mt-8 relative z-10">
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search novels by title, author, or genre..."
            className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder:text-white/30 outline-none focus:border-white/30 focus:bg-white/[0.06] transition-all"
          />
        </div>
      </div>

      {/* ── SEARCH RESULTS ── */}
      {searchMode ? (
        <div className="px-4 max-w-7xl mx-auto">
          <h2 className="text-lg font-bold text-white mb-4">
            Search Results {searchResults.length > 0 && `(${searchResults.length})`}
          </h2>
          {searchLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {Array.from({ length: 8 }).map((_, i) => <NovelCardSkeleton key={i} />)}
            </div>
          ) : searchResults.length === 0 ? (
            <p className="text-center text-white/30 text-sm py-12">No novels found. Try a different search.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {searchResults.map((n, i) => <NovelCard key={n.id} novel={n} onClick={handleNovelClick} />)}
            </div>
          )}
        </div>
      ) : (
        <>
          {/* ── TRENDING NOW ── */}
          <Section id="novel-section-trending" title="Trending Now" accent="bg-white">
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
          <Section id="novel-section-recent" title="Recently Updated" accent="bg-white">
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
            <Section id="novel-section-browse" title="Browse by Genre" accent="bg-[#D4A017]">
              <div className="flex flex-wrap gap-2">
                {genres.slice(0, 24).map((g) => (
                  <button
                    key={g.value}
                    onClick={() => setSearchQuery(g.label)}
                    className="px-3 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.08] text-xs font-medium text-white/60 hover:border-white/20 hover:text-white transition-all"
                  >
                    {g.label}
                  </button>
                ))}
              </div>
            </Section>
          )}

          {/* ── NEW ARRIVALS ── */}
          <Section title="New Arrivals" accent="bg-white">
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
  const totalChapters = parseInt(novel.total_chapters || "0") || 0;

  return (
    <section className="relative h-[45vh] min-h-[320px] w-full overflow-hidden bg-black">
      <div className="absolute inset-0">
        {cover && (
          <img src={cover} alt="" className="w-full h-full object-cover scale-110 opacity-20" style={{ filter: "blur(20px)" }} />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/80 to-black/40" />
      </div>

      <div className="relative h-full max-w-7xl mx-auto px-4 flex items-end pb-8 pt-16">
        <div className="flex gap-5 items-end w-full">
          <div className="shrink-0 w-28 sm:w-40 aspect-[3/4] rounded-xl overflow-hidden shadow-lg shadow-black/50 border-2 border-white/[0.08] hidden sm:block">
            {cover && <img src={cover} alt={novel.title} className="w-full h-full object-cover" />}
          </div>

          <div className="flex-1 min-w-0 space-y-2">
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-white/[0.06] border border-white/[0.12] text-xs font-bold text-[#D4A017]">
              ✦ Editor's Choice
            </span>
            <h1 className="text-2xl sm:text-4xl font-extrabold text-white leading-tight">{novel.title}</h1>
            <p className="text-sm text-white/40">by {novel.author}</p>
            <p className="text-sm text-white/60 line-clamp-2 max-w-2xl">{(novel.description || "").replace(/\\n/g, " ").slice(0, 200)}</p>
            <div className="flex items-center gap-3 text-sm flex-wrap">
              {novel.rating > 0 && <span className="text-[#D4A017] font-medium">★ {novel.rating.toFixed(1)}</span>}
              {totalChapters > 0 && <span className="text-white/40">{totalChapters} chapters</span>}
            </div>
            <button
              onClick={onRead}
              className="mt-2 inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white text-black font-bold text-sm hover:bg-white/90 transition-all hover:scale-105"
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

function Section({ id, title, accent, children }: { id?: string; title: string; accent: string; children: React.ReactNode }) {
  return (
    <section id={id} className="px-4 max-w-7xl mx-auto mb-10 scroll-mt-20">
      <div className="flex items-center gap-2 mb-4">
        <div className={`w-1 h-5 rounded-full ${accent}`} />
        <h2 className="text-lg sm:text-xl font-bold text-white">{title}</h2>
      </div>
      {children}
    </section>
  );
}
