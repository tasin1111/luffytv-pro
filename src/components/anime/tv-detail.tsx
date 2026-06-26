"use client";

import { useState, useEffect } from "react";
import { useAppStore } from "./store";
import AnimeCard from "./anime-card";
import type { TMDBContentItem } from "./store";

interface TVDetail {
  id: number;
  name: string;
  original_name?: string;
  overview?: string;
  poster_path?: string;
  backdrop_path?: string;
  vote_average?: number;
  vote_count?: number;
  genres?: Array<{ id: number; name: string }>;
  first_air_date?: string;
  number_of_seasons?: number;
  number_of_episodes?: number;
  status?: string;
  tagline?: string;
  networks?: Array<{ id: number; name: string; logo_path?: string }>;
  seasons?: Array<{
    id: number; name: string; season_number: number;
    episode_count: number; poster_path?: string; air_date?: string;
  }>;
  credits?: {
    cast: Array<{ id: number; name: string; character?: string; profile_path?: string; order?: number }>;
  };
  videos?: { results: Array<{ id: string; key: string; name: string; site: string; type: string }> };
  similar?: { results: TMDBContentItem[] };
  recommendations?: { results: TMDBContentItem[] };
  external_ids?: { imdb_id?: string };
  episode_run_time?: number[];
}

interface SeasonEpisodes {
  episodes: Array<{
    id: number;
    name: string;
    overview?: string;
    episode_number: number;
    season_number: number;
    still_path?: string;
    air_date?: string;
    runtime?: number;
    vote_average?: number;
  }>;
}

const GROTESK = "var(--font-space-grotesk), 'Space Grotesk', sans-serif";
const INTER = "var(--font-inter), 'Inter', sans-serif";

const GENRE_COLORS: Record<string, string> = {
  "Action & Adventure": "#ef4444", Animation: "#ffffff", Comedy: "#eab308",
  Crime: "#6366f1", Documentary: "#10b981", Drama: "#6366f1",
  Family: "#ec4899", Kids: "#f59e0b", Mystery: "#0ea5e9",
  News: "#64748b", Reality: "#f97316", "Sci-Fi & Fantasy": "#06b6d4",
  Soap: "#ec4899", Talk: "#64748b", Western: "#a16207",
};

export default function TVDetailPage({ tvId }: { tvId: number }) {
  const navigate = useAppStore(s => s.navigate);
  const [show, setShow] = useState<TVDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [showTrailer, setShowTrailer] = useState(false);
  const [selectedSeason, setSelectedSeason] = useState(1);
  const [episodes, setEpisodes] = useState<SeasonEpisodes | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/tmdb/detail?id=${tvId}&type=tv`);
        if (res.ok) {
          const data = await res.json();
          setShow(data);
          if (data.number_of_seasons) setSelectedSeason(1);
        }
      } catch { /* ignore */ }
      setLoading(false);
    }
    load();
  }, [tvId]);

  useEffect(() => {
    if (!tvId || !selectedSeason) return;
    async function loadSeason() {
      try {
        const res = await fetch(`/api/tmdb/season?tvId=${tvId}&season=${selectedSeason}`);
        if (res.ok) setEpisodes(await res.json());
      } catch { /* ignore */ }
    }
    loadSeason();
  }, [tvId, selectedSeason]);

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

  if (!show) return <div className="text-center py-20"><p className="text-[#666666]">TV show not found</p></div>;

  const trailer = show.videos?.results?.find(v => v.type === "Trailer" && v.site === "YouTube");
  const year = show.first_air_date?.split("-")[0];
  const score = show.vote_average != null ? (show.vote_average > 10 ? show.vote_average / 10 : show.vote_average) : 0;

  return (
    <div className="space-y-6 sm:space-y-8 fade-in">
      {/* ═══ Hero ═══ */}
      <div className="relative h-[60vh] sm:h-[75vh] lg:h-[90vh] overflow-hidden">
        {show.backdrop_path && (
          <img src={`https://image.tmdb.org/t/p/w1280${show.backdrop_path}`} alt={show.name} className="absolute inset-0 w-full h-full object-cover ken-burns" />
        )}

        {showTrailer && trailer && (
          <div className="absolute inset-0 z-10 bg-black">
            <iframe
              src={`https://www.youtube.com/embed/${trailer.key}?autoplay=1&mute=1&loop=1&playlist=${trailer.key}&controls=0&showinfo=0&modestbranding=1`}
              className="w-full h-full" allowFullScreen allow="autoplay; encrypted-media"
              style={{ filter: "brightness(0.7)" }}
            />
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-r from-[#0D0D0D] via-[#0D0D0D]/60 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0D0D0D] via-[#0D0D0D]/30 to-transparent" />
        <div className="absolute inset-0 bg-[#0D0D0D]/10" />

        <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-6 lg:p-12">
          <div className="max-w-[1400px] mx-auto flex flex-col lg:flex-row items-end gap-4 sm:gap-6 lg:gap-8">
            {/* Mobile: Poster + Info */}
            <div className="flex gap-4 sm:gap-6 lg:hidden w-full">
              {show.poster_path && (
                <div className="shrink-0">
                  <img src={`https://image.tmdb.org/t/p/w342${show.poster_path}`} alt={show.name}
                    className="w-[100px] sm:w-[140px] rounded-xl shadow-2xl shadow-black/60 border border-white/[0.08]" />
                </div>
              )}
              <div className="flex-1 min-w-0 space-y-2">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#ffffff]/20 text-[#ffffff] border border-[#ffffff]/25">TV SHOW</span>
                  {score > 0 && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#FFB800]/15 text-[#FFB800] border border-[#FFB800]/25">
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                      {score.toFixed(1)}
                    </span>
                  )}
                  {year && <span className="text-[10px] text-[#AAAAAA] font-medium">{year}</span>}
                  {show.number_of_seasons && <span className="text-[10px] text-[#AAAAAA]">{show.number_of_seasons} Season{show.number_of_seasons > 1 ? "s" : ""}</span>}
                </div>
                <h1 className="text-xl sm:text-3xl font-bold text-white line-clamp-2 tracking-tight" style={{ fontFamily: GROTESK }}>{show.name}</h1>
                <div className="flex items-center gap-2 pt-1">
                  <button onClick={() => navigate({ page: "tv-watch", id: show.id, season: 1, episode: 1 })}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#ffffff] text-white text-xs font-semibold hover:bg-[#d32f3f] transition-colors shadow-lg shadow-[#ffffff]/25">
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3" /></svg>
                    Watch
                  </button>
                  {trailer && (
                    <button onClick={() => setShowTrailer(!showTrailer)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white/[0.08] text-white text-xs font-medium border border-white/[0.15] backdrop-blur-sm hover:bg-white/[0.12] transition-colors">
                      Trailer
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Desktop: Info */}
            <div className="hidden lg:flex flex-1 flex-col items-start space-y-4">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold bg-[#ffffff]/20 text-[#ffffff] border border-[#ffffff]/25">
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z"/></svg>
                  TV SHOW
                </span>
                {score > 0 && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-[#FFB800]/15 text-[#FFB800] border border-[#FFB800]/25">
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                    {score.toFixed(1)}
                  </span>
                )}
                {year && <span className="px-3 py-1 rounded-full text-[11px] font-medium bg-white/[0.06] border border-white/[0.10] text-[#AAAAAA]">{year}</span>}
                {show.number_of_seasons && <span className="px-3 py-1 rounded-full text-[11px] font-medium bg-white/[0.06] border border-white/[0.10] text-[#AAAAAA]">{show.number_of_seasons} Season{show.number_of_seasons > 1 ? "s" : ""}</span>}
              </div>

              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white line-clamp-2 tracking-tight" style={{ fontFamily: GROTESK }}>{show.name}</h1>
              {show.tagline && <p className="text-sm text-[#AAAAAA] italic" style={{ fontFamily: INTER }}>&quot;{show.tagline}&quot;</p>}

              {show.genres && show.genres.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {show.genres.map(g => {
                    const color = GENRE_COLORS[g.name] || "#ffffff";
                    return <span key={g.id} className="px-3 py-1 text-xs font-medium rounded-full" style={{ color, backgroundColor: `${color}15`, border: `1px solid ${color}25`, fontFamily: GROTESK }}>{g.name}</span>;
                  })}
                </div>
              )}

              <div className="flex items-center gap-3 pt-2">
                <button onClick={() => navigate({ page: "tv-watch", id: show.id, season: 1, episode: 1 })}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-[#ffffff] text-white text-sm font-semibold hover:bg-[#d32f3f] transition-colors shadow-lg shadow-[#ffffff]/25">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3" /></svg>
                  Watch Now
                </button>
                {trailer && (
                  <button onClick={() => setShowTrailer(!showTrailer)}
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-white/[0.08] text-white text-sm font-medium border border-white/[0.15] backdrop-blur-sm hover:bg-white/[0.12] transition-colors">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    {showTrailer ? "Hide Trailer" : "Trailer"}
                  </button>
                )}
                <button className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-white/[0.08] text-white text-sm font-medium border border-white/[0.15] backdrop-blur-sm hover:bg-white/[0.12] transition-colors">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" /></svg>
                  Add to List
                </button>
              </div>
            </div>

            {/* Desktop: 3D poster */}
            {show.poster_path && (
              <div className="hidden lg:block shrink-0">
                <img src={`https://image.tmdb.org/t/p/w500${show.poster_path}`} alt={show.name} className="w-[260px] rounded-xl poster-3d" />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ═══ Info ═══ */}
      <div className="space-y-4 sm:space-y-6">
        <div className="glass-card rounded-xl p-4 sm:p-6 space-y-4">
          {show.overview && (
            <div>
              <h3 className="text-sm font-semibold text-[#AAAAAA] mb-2 flex items-center gap-2" style={{ fontFamily: GROTESK }}>
                <div className="w-1 h-4 rounded-full bg-[#ffffff]" /> Overview
              </h3>
              <p className="text-sm text-[#AAAAAA] leading-relaxed" style={{ fontFamily: INTER }}>{show.overview}</p>
            </div>
          )}
          {show.networks && show.networks.length > 0 && (
            <div>
              <span className="text-[10px] font-bold text-[#666666] uppercase tracking-wider" style={{ fontFamily: GROTESK }}>Networks</span>
              <div className="flex gap-3 mt-1.5">
                {show.networks.map(n => (
                  <div key={n.id} className="flex items-center gap-2 bg-white/[0.04] px-3 py-1.5 rounded-lg border border-white/[0.06]">
                    {n.logo_path ? <img src={`https://image.tmdb.org/t/p/w92${n.logo_path}`} alt={n.name} className="h-4" /> : <span className="text-xs text-[#AAAAAA]">{n.name}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Cast */}
        {show.credits?.cast && show.credits.cast.length > 0 && (
          <div className="glass-card rounded-xl p-4 sm:p-6">
            <h3 className="text-sm font-semibold text-[#AAAAAA] mb-3 flex items-center gap-2" style={{ fontFamily: GROTESK }}>
              <div className="w-1 h-4 rounded-full bg-[#4A90E2]" /> Top Cast
            </h3>
            <div className="flex gap-3 sm:gap-4 overflow-x-auto scroll-container pb-2">
              {show.credits.cast.slice(0, 12).map(person => (
                <div key={person.id} className="shrink-0 text-center w-[80px] sm:w-[100px]">
                  <div className="w-[70px] h-[70px] sm:w-[90px] sm:h-[90px] rounded-full bg-[#1A1A1A] overflow-hidden mx-auto mb-2 border-2 border-white/[0.06]">
                    {person.profile_path ? (
                      <img src={`https://image.tmdb.org/t/p/w185${person.profile_path}`} alt={person.name} className="w-full h-full object-cover" loading="lazy" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-lg text-[#666666] font-semibold">{person.name.charAt(0)}</div>
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

      {/* ═══ Episodes ═══ */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-[#4A90E2]/15 text-[#4A90E2] border border-[#4A90E2]/25" style={{ fontFamily: GROTESK }}>EPISODES</span>
            <h3 className="text-lg font-bold text-white" style={{ fontFamily: GROTESK }}>Season {selectedSeason}</h3>
          </div>
          {show.number_of_seasons && show.number_of_seasons > 1 && (
            <select value={selectedSeason} onChange={e => setSelectedSeason(parseInt(e.target.value))}
              className="bg-[#1A1A1A] text-[#AAAAAA] text-sm px-4 py-2 rounded-full border border-white/[0.06] outline-none focus:border-[#ffffff]/30"
            >
              {Array.from({ length: show.number_of_seasons }, (_, i) => (
                <option key={i + 1} value={i + 1}>Season {i + 1}</option>
              ))}
            </select>
          )}
        </div>

        <div className="space-y-2">
          {episodes?.episodes ? episodes.episodes.map(ep => (
            <button key={ep.id}
              onClick={() => navigate({ page: "tv-watch", id: show.id, season: ep.season_number, episode: ep.episode_number })}
              className="w-full flex items-center gap-3 sm:gap-4 p-2.5 sm:p-3 rounded-xl text-left bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.05] hover:border-white/[0.08] transition-all group"
            >
              <div className="w-20 h-12 sm:w-28 sm:h-16 rounded-lg overflow-hidden shrink-0 bg-[#1A1A1A] relative">
                {ep.still_path ? (
                  <img src={`https://image.tmdb.org/t/p/w300${ep.still_path}`} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform" loading="lazy" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xs font-bold text-[#666666]">{ep.episode_number}</div>
                )}
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40">
                  <svg className="w-6 h-6 sm:w-8 sm:h-8 text-[#ffffff]" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3" /></svg>
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs sm:text-sm font-medium text-white line-clamp-1">{ep.name}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] text-[#ffffff] font-semibold" style={{ fontFamily: GROTESK }}>EP {ep.episode_number}</span>
                  {ep.runtime && <span className="text-[10px] text-[#666666]">{ep.runtime}m</span>}
                  {ep.air_date && <span className="text-[10px] text-[#666666] hidden sm:inline">{ep.air_date}</span>}
                </div>
                {ep.overview && <p className="text-[10px] sm:text-[11px] text-[#666666] line-clamp-1 mt-0.5 hidden sm:block">{ep.overview}</p>}
              </div>
            </button>
          )) : (
            Array.from({ length: 5 }, (_, i) => (
              <div key={i} className="flex items-center gap-4 p-3">
                <div className="w-28 h-16 rounded-lg skeleton" />
                <div className="flex-1 space-y-1"><div className="h-4 w-48 skeleton rounded" /><div className="h-3 w-24 skeleton rounded" /></div>
              </div>
            ))
          )}
        </div>
      </section>

      {/* Similar / Recommendations */}
      {show.similar?.results && show.similar.results.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2.5">
            <span className="px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-[#ffffff]/15 text-[#ffffff] border border-[#ffffff]/25" style={{ fontFamily: GROTESK }}>SIMILAR</span>
            <h3 className="text-lg font-bold text-white" style={{ fontFamily: GROTESK }}>You May Also Like</h3>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
            {show.similar.results.slice(0, 12).map((item, i) => (<AnimeCard key={item.id} tmdbItem={{ ...item, media_type: "tv" }} index={i} />))}
          </div>
        </section>
      )}

      {show.recommendations?.results && show.recommendations.results.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2.5">
            <span className="px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-[#4A90E2]/15 text-[#4A90E2] border border-[#4A90E2]/25" style={{ fontFamily: GROTESK }}>RECOMMENDED</span>
            <h3 className="text-lg font-bold text-white" style={{ fontFamily: GROTESK }}>More Like This</h3>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
            {show.recommendations.results.slice(0, 12).map((item, i) => (<AnimeCard key={item.id} tmdbItem={{ ...item, media_type: "tv" }} index={i} />))}
          </div>
        </section>
      )}
    </div>
  );
}
