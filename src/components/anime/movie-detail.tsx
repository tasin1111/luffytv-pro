"use client";

import { useState, useEffect } from "react";
import { useAppStore } from "./store";
import AnimeCard from "./anime-card";
import type { TMDBContentItem } from "./store";

interface MovieDetail {
  id: number;
  title: string;
  original_title?: string;
  overview?: string;
  poster_path?: string;
  backdrop_path?: string;
  vote_average?: number;
  vote_count?: number;
  genres?: Array<{ id: number; name: string }>;
  release_date?: string;
  runtime?: number;
  status?: string;
  tagline?: string;
  production_companies?: Array<{ id: number; name: string; logo_path?: string }>;
  credits?: {
    cast: Array<{ id: number; name: string; character?: string; profile_path?: string; order?: number }>;
    crew?: Array<{ id: number; name: string; job?: string; department?: string; profile_path?: string }>;
  };
  videos?: { results: Array<{ id: string; key: string; name: string; site: string; type: string }> };
  similar?: { results: TMDBContentItem[] };
  recommendations?: { results: TMDBContentItem[] };
  external_ids?: { imdb_id?: string };
  belongs_to_collection?: { id: number; name: string; poster_path?: string; backdrop_path?: string };
}

const GROTESK = "var(--font-space-grotesk), 'Space Grotesk', sans-serif";
const INTER = "var(--font-inter), 'Inter', sans-serif";

const GENRE_COLORS: Record<string, string> = {
  Action: "#ef4444", Adventure: "#f59e0b", Animation: "#ffffff",
  Comedy: "#eab308", Crime: "#6366f1", Documentary: "#10b981",
  Drama: "#6366f1", Family: "#ec4899", Fantasy: "#ffffff",
  History: "#a855f7", Horror: "#dc2626", Music: "#06b6d4",
  Mystery: "#0ea5e9", Romance: "#ec4899", "Science Fiction": "#06b6d4",
  "TV Movie": "#64748b", Thriller: "#f97316", War: "#64748b",
  Western: "#a16207",
};

export default function MovieDetailPage({ movieId }: { movieId: number }) {
  const navigate = useAppStore(s => s.navigate);
  const [movie, setMovie] = useState<MovieDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [showTrailer, setShowTrailer] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/tmdb/detail?id=${movieId}&type=movie`);
        if (res.ok) setMovie(await res.json());
      } catch { /* ignore */ }
      setLoading(false);
    }
    load();
  }, [movieId]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="min-h-[70vh] sm:min-h-[90vh] skeleton" />
        <div className="p-4 sm:p-6 space-y-4">
          <div className="flex gap-4">
            <div className="w-[140px] sm:w-[220px] aspect-[2/3] skeleton rounded-xl shrink-0" />
            <div className="flex-1 space-y-3">
              <div className="h-8 w-64 skeleton rounded" />
              <div className="h-4 w-40 skeleton rounded" />
              <div className="h-20 skeleton rounded" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!movie) {
    return (
      <div className="text-center py-20">
        <svg className="w-16 h-16 mx-auto text-[#666666] mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
        </svg>
        <p className="text-[#666666]">Movie not found</p>
      </div>
    );
  }

  const trailer = movie.videos?.results?.find(v => v.type === "Trailer" && v.site === "YouTube");
  const year = movie.release_date?.split("-")[0];
  const hours = movie.runtime ? Math.floor(movie.runtime / 60) : 0;
  const minutes = movie.runtime ? movie.runtime % 60 : 0;
  const director = movie.credits?.crew?.find(c => c.job === "Director");
  const score = movie.vote_average != null ? (movie.vote_average > 10 ? movie.vote_average / 10 : movie.vote_average) : 0;

  return (
    <div className="space-y-6 sm:space-y-8 fade-in">
      {/* ═══ Hero Section — Anikage cinematic, mobile-first ═══ */}
      <div className="relative h-[60vh] sm:h-[75vh] lg:h-[90vh] overflow-hidden">
        {/* Backdrop image */}
        {movie.backdrop_path && (
          <img
            src={`https://image.tmdb.org/t/p/w1280${movie.backdrop_path}`}
            alt={movie.title}
            className="absolute inset-0 w-full h-full object-cover ken-burns"
          />
        )}

        {/* Trailer as background */}
        {showTrailer && trailer && (
          <div className="absolute inset-0 z-10 bg-black">
            <iframe
              src={`https://www.youtube.com/embed/${trailer.key}?autoplay=1&mute=1&loop=1&playlist=${trailer.key}&controls=0&showinfo=0&modestbranding=1`}
              className="w-full h-full"
              allowFullScreen
              allow="autoplay; encrypted-media"
              style={{ filter: "brightness(0.7)" }}
            />
          </div>
        )}

        {/* Multi-layer gradient overlays */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#0D0D0D] via-[#0D0D0D]/60 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0D0D0D] via-[#0D0D0D]/30 to-transparent" />
        <div className="absolute inset-0 bg-[#0D0D0D]/10" />

        {/* Content */}
        <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-6 lg:p-12">
          <div className="max-w-[1400px] mx-auto flex flex-col lg:flex-row items-end gap-4 sm:gap-6 lg:gap-8">
            {/* Mobile: Poster + Info side by side */}
            <div className="flex gap-4 sm:gap-6 lg:hidden w-full">
              {movie.poster_path && (
                <div className="shrink-0">
                  <img
                    src={`https://image.tmdb.org/t/p/w342${movie.poster_path}`}
                    alt={movie.title}
                    className="w-[100px] sm:w-[140px] rounded-xl shadow-2xl shadow-black/60 border border-white/[0.08]"
                  />
                </div>
              )}
              <div className="flex-1 min-w-0 space-y-2">
                {/* Badges */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#ffffff]/20 text-[#ffffff] border border-[#ffffff]/25">
                    MOVIE
                  </span>
                  {score > 0 && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#FFB800]/15 text-[#FFB800] border border-[#FFB800]/25">
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                      {score.toFixed(1)}
                    </span>
                  )}
                  {year && <span className="text-[10px] text-[#AAAAAA] font-medium">{year}</span>}
                  {movie.runtime ? <span className="text-[10px] text-[#AAAAAA]">{hours}h {minutes}m</span> : null}
                </div>
                {/* Title */}
                <h1 className="text-xl sm:text-3xl font-bold text-white line-clamp-2 tracking-tight" style={{ fontFamily: GROTESK }}>
                  {movie.title}
                </h1>
                {/* CTA */}
                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={() => navigate({ page: "movie-watch", id: movie.id })}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#ffffff] text-white text-xs font-semibold hover:bg-[#d32f3f] transition-colors shadow-lg shadow-[#ffffff]/25"
                  >
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3" /></svg>
                    Watch
                  </button>
                  {trailer && (
                    <button
                      onClick={() => setShowTrailer(!showTrailer)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white/[0.08] text-white text-xs font-medium border border-white/[0.15] backdrop-blur-sm hover:bg-white/[0.12] transition-colors"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      Trailer
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Desktop: Info only (poster on right) */}
            <div className="hidden lg:flex flex-1 flex-col items-start space-y-4">
              {/* Badges */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold bg-[#ffffff]/20 text-[#ffffff] border border-[#ffffff]/25">
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z"/></svg>
                  MOVIE
                </span>
                {score > 0 && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-[#FFB800]/15 text-[#FFB800] border border-[#FFB800]/25">
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                    {score.toFixed(1)}
                  </span>
                )}
                {year && <span className="px-3 py-1 rounded-full text-[11px] font-medium bg-white/[0.06] border border-white/[0.10] text-[#AAAAAA]">{year}</span>}
                {movie.runtime ? <span className="px-3 py-1 rounded-full text-[11px] font-medium bg-white/[0.06] border border-white/[0.10] text-[#AAAAAA]">{hours}h {minutes}m</span> : null}
                <span className="px-3 py-1 rounded-full text-[11px] font-medium bg-[#FFB800]/10 text-[#FFB800] border border-[#FFB800]/20">HD</span>
              </div>

              {/* Title */}
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white line-clamp-2 tracking-tight" style={{ fontFamily: GROTESK }}>
                {movie.title}
              </h1>

              {/* Tagline */}
              {movie.tagline && <p className="text-sm text-[#AAAAAA] italic" style={{ fontFamily: INTER }}>&quot;{movie.tagline}&quot;</p>}

              {/* Genre pills */}
              {movie.genres && movie.genres.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {movie.genres.map(g => {
                    const color = GENRE_COLORS[g.name] || "#ffffff";
                    return (
                      <span key={g.id} className="px-3 py-1 text-xs font-medium rounded-full"
                        style={{
                          color,
                          backgroundColor: `${color}15`,
                          border: `1px solid ${color}25`,
                          fontFamily: GROTESK,
                        }}
                      >
                        {g.name}
                      </span>
                    );
                  })}
                </div>
              )}

              {/* CTA Buttons */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={() => navigate({ page: "movie-watch", id: movie.id })}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-[#ffffff] text-white text-sm font-semibold hover:bg-[#d32f3f] transition-colors shadow-lg shadow-[#ffffff]/25"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3" /></svg>
                  Watch Now
                </button>
                {trailer && (
                  <button
                    onClick={() => setShowTrailer(!showTrailer)}
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-white/[0.08] text-white text-sm font-medium border border-white/[0.15] backdrop-blur-sm hover:bg-white/[0.12] transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    {showTrailer ? "Hide Trailer" : "Trailer"}
                  </button>
                )}
                <button
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-white/[0.08] text-white text-sm font-medium border border-white/[0.15] backdrop-blur-sm hover:bg-white/[0.12] transition-colors"
                  onClick={() => {}}
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                  </svg>
                  Add to List
                </button>
              </div>
            </div>

            {/* Desktop: 3D tilted poster */}
            {movie.poster_path && (
              <div className="hidden lg:block shrink-0">
                <img
                  src={`https://image.tmdb.org/t/p/w500${movie.poster_path}`}
                  alt={movie.title}
                  className="w-[260px] rounded-xl poster-3d"
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ═══ Info Section — glass panels ═══ */}
      <div className="space-y-4 sm:space-y-6">
        {/* Overview + Director — glass panel */}
        <div className="glass-card rounded-xl p-4 sm:p-6 space-y-4">
          {movie.overview && (
            <div>
              <h3 className="text-sm font-semibold text-[#AAAAAA] mb-2 flex items-center gap-2" style={{ fontFamily: GROTESK }}>
                <div className="w-1 h-4 rounded-full bg-[#ffffff]" />
                Overview
              </h3>
              <p className="text-sm text-[#AAAAAA] leading-relaxed" style={{ fontFamily: INTER }}>{movie.overview}</p>
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {director && (
              <div>
                <span className="text-[10px] font-bold text-[#666666] uppercase tracking-wider" style={{ fontFamily: GROTESK }}>Director</span>
                <p className="text-sm text-white font-medium mt-0.5">{director.name}</p>
              </div>
            )}
            {movie.status && (
              <div>
                <span className="text-[10px] font-bold text-[#666666] uppercase tracking-wider" style={{ fontFamily: GROTESK }}>Status</span>
                <p className="text-sm text-white font-medium mt-0.5">{movie.status === "Released" ? "Released" : movie.status}</p>
              </div>
            )}
            {movie.production_companies && movie.production_companies.length > 0 && (
              <div className="col-span-2 sm:col-span-1">
                <span className="text-[10px] font-bold text-[#666666] uppercase tracking-wider" style={{ fontFamily: GROTESK }}>Production</span>
                <p className="text-xs text-[#AAAAAA] mt-0.5 line-clamp-2">{movie.production_companies.slice(0, 3).map(c => c.name).join(" · ")}</p>
              </div>
            )}
          </div>
        </div>

        {/* Cast — glass panel */}
        {movie.credits?.cast && movie.credits.cast.length > 0 && (
          <div className="glass-card rounded-xl p-4 sm:p-6">
            <h3 className="text-sm font-semibold text-[#AAAAAA] mb-3 flex items-center gap-2" style={{ fontFamily: GROTESK }}>
              <div className="w-1 h-4 rounded-full bg-[#4A90E2]" />
              Top Cast
            </h3>
            <div className="flex gap-3 sm:gap-4 overflow-x-auto scroll-container pb-2">
              {movie.credits.cast.slice(0, 12).map(person => (
                <div key={person.id} className="shrink-0 text-center w-[80px] sm:w-[100px]">
                  <div className="w-[70px] h-[70px] sm:w-[90px] sm:h-[90px] rounded-full bg-[#1A1A1A] overflow-hidden mx-auto mb-2 border-2 border-white/[0.06]">
                    {person.profile_path ? (
                      <img src={`https://image.tmdb.org/t/p/w185${person.profile_path}`} alt={person.name} className="w-full h-full object-cover" loading="lazy" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-lg text-[#666666] font-semibold">
                        {person.name.charAt(0)}
                      </div>
                    )}
                  </div>
                  <p className="text-[10px] sm:text-[11px] text-white font-medium line-clamp-1">{person.name}</p>
                  {person.character && <p className="text-[8px] sm:text-[9px] text-[#666666] line-clamp-1">{person.character}</p>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ═══ Similar Movies ═══ */}
      {movie.similar?.results && movie.similar.results.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2.5">
            <span className="px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-[#ffffff]/15 text-[#ffffff] border border-[#ffffff]/25" style={{ fontFamily: GROTESK }}>
              SIMILAR
            </span>
            <h3 className="text-lg font-bold text-white" style={{ fontFamily: GROTESK }}>You May Also Like</h3>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
            {movie.similar.results.slice(0, 12).map((item, i) => (
              <AnimeCard key={item.id} tmdbItem={{ ...item, media_type: "movie" }} index={i} />
            ))}
          </div>
        </section>
      )}

      {/* ═══ Recommendations ═══ */}
      {movie.recommendations?.results && movie.recommendations.results.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2.5">
            <span className="px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-[#4A90E2]/15 text-[#4A90E2] border border-[#4A90E2]/25" style={{ fontFamily: GROTESK }}>
              RECOMMENDED
            </span>
            <h3 className="text-lg font-bold text-white" style={{ fontFamily: GROTESK }}>More Like This</h3>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
            {movie.recommendations.results.slice(0, 12).map((item, i) => (
              <AnimeCard key={item.id} tmdbItem={{ ...item, media_type: "movie" }} index={i} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
