"use client";

import { useState, useEffect } from "react";
import { useAppStore, type TMDBContentItem } from "./store";
import AnimeCard from "./anime-card";

const CATEGORIES = [
  { id: "popular", label: "Popular", icon: "🔥" },
  { id: "top_rated", label: "Top Rated", icon: "⭐" },
  { id: "now_playing", label: "Now Playing", icon: "🎬" },
  { id: "upcoming", label: "Upcoming", icon: "📅" },
];

const GENRES = [
  { id: 28, name: "Action", color: "#ef4444" }, { id: 12, name: "Adventure", color: "#f59e0b" },
  { id: 16, name: "Animation", color: "#ffffff" }, { id: 35, name: "Comedy", color: "#eab308" },
  { id: 80, name: "Crime", color: "#6366f1" }, { id: 99, name: "Documentary", color: "#10b981" },
  { id: 18, name: "Drama", color: "#6366f1" }, { id: 10751, name: "Family", color: "#ec4899" },
  { id: 14, name: "Fantasy", color: "#ffffff" }, { id: 36, name: "History", color: "#a855f7" },
  { id: 27, name: "Horror", color: "#dc2626" }, { id: 10402, name: "Music", color: "#06b6d4" },
  { id: 9648, name: "Mystery", color: "#0ea5e9" }, { id: 10749, name: "Romance", color: "#ec4899" },
  { id: 878, name: "Sci-Fi", color: "#06b6d4" }, { id: 10770, name: "TV Movie", color: "#64748b" },
  { id: 53, name: "Thriller", color: "#f97316" }, { id: 10752, name: "War", color: "#64748b" },
  { id: 37, name: "Western", color: "#a16207" },
];

const GROTESK = "var(--font-space-grotesk), 'Space Grotesk', sans-serif";

export default function MoviesPage() {
  const navigate = useAppStore(s => s.navigate);
  const [category, setCategory] = useState("popular");
  const [genre, setGenre] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [movies, setMovies] = useState<TMDBContentItem[]>([]);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [featured, setFeatured] = useState<TMDBContentItem | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          category: genre ? "discover" : category,
          page: String(page),
        });
        if (genre) params.set("genre", String(genre));
        const res = await fetch(`/api/tmdb/movies?${params}`);
        if (res.ok && !cancelled) {
          const data = await res.json();
          setMovies(data.results || []);
          setTotalPages(Math.min(data.total_pages || 1, 500));
          // Set first movie as featured on page 1
          if (page === 1 && data.results?.length > 0) {
            setFeatured(data.results[0]);
          }
        }
      } catch { /* ignore */ }
      if (!cancelled) setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [category, genre, page]);

  const handleCategoryChange = (catId: string) => {
    setCategory(catId);
    setGenre(null);
    setPage(1);
  };

  const handleGenreChange = (gId: number | null) => {
    setGenre(gId);
    setPage(1);
  };

  const featuredBackdrop = featured?.backdrop_path
    ? `https://image.tmdb.org/t/p/w1280${featured.backdrop_path}`
    : "";
  const featuredTitle = featured?.title || "";
  const featuredOverview = featured?.overview || "";
  const featuredScore = featured?.vote_average;
  const featuredYear = featured?.release_date?.split("-")[0];

  return (
    <div className="space-y-8 fade-in">
      {/* ═══ Featured Hero — Anikage cinematic banner ═══ */}
      {featured && page === 1 && !genre && featuredBackdrop && (
        <div className="relative w-full h-[50vh] sm:h-[60vh] lg:h-[70vh] rounded-2xl overflow-hidden group">
          <img
            src={featuredBackdrop}
            alt={featuredTitle}
            className="absolute inset-0 w-full h-full object-cover scale-105 transition-transform duration-700 group-hover:scale-110"
          />
          {/* Multi-gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-r from-[#0D0D0D] via-[#0D0D0D]/60 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0D0D0D] via-[#0D0D0D]/30 to-transparent" />
          <div className="absolute inset-0 bg-[#0D0D0D]/10" />

          {/* Content */}
          <div className="absolute bottom-0 left-0 right-0 p-6 sm:p-10 lg:p-14">
            <div className="max-w-2xl">
              {/* Badges */}
              <div className="flex items-center gap-2 mb-4">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold bg-[#ffffff]/20 text-[#ffffff] border border-[#ffffff]/25">
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 23c-3.2 0-6-3.2-6-7.8 0-3 2.4-6.6 6-11.2 3.6 4.6 6 8.2 6 11.2 0 4.6-2.8 7.8-6 7.8z"/></svg>
                  Featured
                </span>
                {featuredScore != null && featuredScore > 0 && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-white/[0.08] border border-white/[0.12] text-white backdrop-blur-sm">
                    <svg className="w-3.5 h-3.5 text-[#FFB800]" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                    {(featuredScore > 10 ? featuredScore / 10 : featuredScore).toFixed(1)}
                  </span>
                )}
                {featuredYear && (
                  <span className="px-3 py-1 rounded-full text-[11px] font-semibold bg-white/[0.06] border border-white/[0.10] text-[#AAAAAA]">
                    {featuredYear}
                  </span>
                )}
              </div>

              {/* Title */}
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white line-clamp-2 mb-3 tracking-tight" style={{ fontFamily: GROTESK }}>
                {featuredTitle}
              </h1>

              {/* Overview */}
              {featuredOverview && (
                <p className="text-sm text-[#AAAAAA] line-clamp-2 max-w-lg mb-5">
                  {featuredOverview.slice(0, 180)}...
                </p>
              )}

              {/* CTA Buttons */}
              <div className="flex items-center gap-3">
                <button
                  onClick={() => navigate({ page: "movie-watch", id: featured.id })}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-[#ffffff] text-white text-sm font-semibold hover:bg-[#d32f3f] transition-colors shadow-lg shadow-[#ffffff]/25"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3" /></svg>
                  Watch Now
                </button>
                <button
                  onClick={() => navigate({ page: "movie-detail", id: featured.id })}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-white/[0.08] text-white text-sm font-medium border border-white/[0.15] backdrop-blur-sm hover:bg-white/[0.12] transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  More Info
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ Category Tabs — round pills ═══ */}
      <div className="flex items-center gap-2 overflow-x-auto scroll-container pb-2">
        {CATEGORIES.map(cat => (
          <button
            key={cat.id}
            onClick={() => handleCategoryChange(cat.id)}
            className={`shrink-0 px-5 py-2.5 text-sm font-semibold rounded-full transition-all whitespace-nowrap ${
              category === cat.id && !genre
                ? "bg-[#ffffff] text-white shadow-lg shadow-[#ffffff]/25"
                : "bg-white/[0.04] text-[#AAAAAA] hover:text-white hover:bg-white/[0.08] border border-white/[0.06]"
            }`}
            style={{ fontFamily: GROTESK }}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* ═══ Genre Filter — colored pills ═══ */}
      <div className="flex items-center gap-2 overflow-x-auto scroll-container pb-2">
        <button
          onClick={() => handleGenreChange(null)}
          className={`shrink-0 px-4 py-2 text-xs font-semibold rounded-full transition-all whitespace-nowrap border ${
            !genre
              ? "bg-[#ffffff]/15 text-[#ffffff] border-[#ffffff]/30"
              : "bg-white/[0.03] text-[#666666] hover:text-[#AAAAAA] border-white/[0.04] hover:border-white/[0.08]"
          }`}
          style={{ fontFamily: GROTESK }}
        >
          All Genres
        </button>
        {GENRES.map(g => {
          const isActive = genre === g.id;
          return (
            <button
              key={g.id}
              onClick={() => handleGenreChange(g.id)}
              className="group relative shrink-0 px-4 py-2 text-xs font-medium rounded-full border transition-all hover:scale-105 whitespace-nowrap"
              style={{
                fontFamily: GROTESK,
                color: isActive ? "#ffffff" : g.color,
                borderColor: isActive ? `${g.color}50` : `${g.color}25`,
                backgroundColor: isActive ? `${g.color}25` : `${g.color}08`,
              }}
            >
              {g.name}
            </button>
          );
        })}
      </div>

      {/* ═══ Movies Grid ═══ */}
      {loading ? (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-3">
          {Array.from({ length: 21 }).map((_, i) => (
            <div key={i} className="aspect-[2/3] skeleton rounded-xl" />
          ))}
        </div>
      ) : movies.length > 0 ? (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-3">
          {movies.map((item, i) => (
            <AnimeCard key={item.id} tmdbItem={{ ...item, media_type: "movie" }} index={i} />
          ))}
        </div>
      ) : (
        <div className="text-center py-20 rounded-2xl bg-[#1A1A1A]/40 border border-white/[0.06]">
          <svg className="w-12 h-12 mx-auto text-[#666666] mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
          </svg>
          <p className="text-[#666666] text-sm">No movies found</p>
        </div>
      )}

      {/* ═══ Pagination — Anikage style ═══ */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-4">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-5 py-2.5 text-sm font-medium rounded-full bg-white/[0.04] text-[#AAAAAA] hover:bg-white/[0.08] hover:text-white disabled:opacity-25 disabled:cursor-not-allowed transition-all border border-white/[0.06]"
            style={{ fontFamily: GROTESK }}
          >
            Previous
          </button>
          <span className="text-sm text-[#AAAAAA] px-3 font-medium" style={{ fontFamily: GROTESK }}>
            {page} <span className="text-[#666666]">of</span> {totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-5 py-2.5 text-sm font-medium rounded-full bg-white/[0.04] text-[#AAAAAA] hover:bg-white/[0.08] hover:text-white disabled:opacity-25 disabled:cursor-not-allowed transition-all border border-white/[0.06]"
            style={{ fontFamily: GROTESK }}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
