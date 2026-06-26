"use client";

import { useState, useEffect, useRef } from "react";
import { useAppStore } from "./store";
import { getTmdbServers } from "@/lib/embed-servers";

interface MovieInfo {
  id: number;
  title: string;
  original_title?: string;
  poster_path?: string;
  backdrop_path?: string;
  overview?: string;
  release_date?: string;
  runtime?: number;
  vote_average?: number;
  vote_count?: number;
  genres?: Array<{ id: number; name: string }>;
  tagline?: string;
  status?: string;
  production_companies?: Array<{ id: number; name: string; logo_path?: string }>;
  external_ids?: { imdb_id?: string };
  credits?: {
    cast: Array<{ id: number; name: string; character?: string; profile_path?: string; order?: number }>;
    crew?: Array<{ id: number; name: string; job?: string; department?: string; profile_path?: string }>;
  };
  similar?: { results: Array<any> };
  recommendations?: { results: Array<any> };
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

export default function MovieWatchPage({ movieId }: { movieId: number }) {
  const navigate = useAppStore(s => s.navigate);
  const [movie, setMovie] = useState<MovieInfo | null>(null);
  const [activeServer, setActiveServer] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [iframeError, setIframeError] = useState(false);
  const [useDirectEmbed, setUseDirectEmbed] = useState(true);
  const [serversExpanded, setServersExpanded] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const tmdbServers = getTmdbServers();

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/tmdb/detail?id=${movieId}&type=movie`);
        if (res.ok) {
          const data = await res.json();
          setMovie(data);
          if (tmdbServers.length > 0) setActiveServer(tmdbServers[0].id);
        }
      } catch { /* ignore */ }
      setLoading(false);
    }
    load();
  }, [movieId]);

  const currentServer = tmdbServers.find(s => s.id === activeServer);
  const embedUrl = currentServer?.generateUrl({
    tmdbId: movieId, episode: 1, season: 0, translation: "sub",
  }) || "";

  const year = movie?.release_date?.split("-")[0];
  const hours = movie?.runtime ? Math.floor(movie.runtime / 60) : 0;
  const minutes = movie?.runtime ? movie.runtime % 60 : 0;
  const director = movie?.credits?.crew?.find(c => c.job === "Director");
  const topCast = movie?.credits?.cast?.slice(0, 10) || [];
  const score = movie?.vote_average != null ? (movie.vote_average > 10 ? movie.vote_average / 10 : movie.vote_average) : 0;
  const visibleServers = serversExpanded ? tmdbServers : tmdbServers.slice(0, 4);

  return (
    <div className="fade-in">
      {/* ═══ Immersive blurred background ═══ */}
      {movie?.backdrop_path && (
        <div className="immersive-bg" style={{ backgroundImage: `url(https://image.tmdb.org/t/p/w1280${movie.backdrop_path})` }} />
      )}

      {/* ═══ Video Player ═══ */}
      <div className="relative w-full aspect-video bg-black rounded-none lg:rounded-2xl overflow-hidden player-glow">
        {embedUrl && !iframeError ? (
          <iframe
            ref={iframeRef}
            key={`${embedUrl}-${useDirectEmbed}`}
            src={useDirectEmbed ? embedUrl : `/api/embed/proxy?url=${encodeURIComponent(embedUrl)}`}
            className="absolute inset-0 w-full h-full"
            allowFullScreen
            allow="autoplay; fullscreen; picture-in-picture; encrypted-media; screen-wake-lock; clipboard-write; document-domain"
            referrerPolicy="no-referrer"
            onError={() => {
              if (useDirectEmbed) {
                setUseDirectEmbed(false);
              } else {
                setIframeError(true);
              }
            }}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-[#0D0D0D]">
            <div className="text-center space-y-3">
              <div className="w-16 h-16 rounded-full bg-[#ffffff]/10 flex items-center justify-center mx-auto">
                <svg className="w-8 h-8 text-[#ffffff]" viewBox="0 0 24 24" fill="currentColor">
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
              </div>
              <p className="text-[#666666] text-sm">Select a server to start watching</p>
            </div>
          </div>
        )}
      </div>

      {/* ═══ Player Controls Bar — Anikage glass style ═══ */}
      <div className="glass-card rounded-none lg:rounded-xl p-3 sm:p-4 mt-1 space-y-3">
        {/* Top: Title + Now Playing */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-1.5 h-1.5 rounded-full bg-[#ffffff] animate-pulse" />
              <span className="text-[10px] font-bold text-[#ffffff] uppercase tracking-wider" style={{ fontFamily: GROTESK }}>Now Playing</span>
            </div>
            <h3 className="text-sm font-bold text-white truncate" style={{ fontFamily: GROTESK }}>{movie?.title || "Loading..."}</h3>
            {movie?.tagline && <p className="text-[10px] text-[#666666] italic mt-0.5">&quot;{movie.tagline}&quot;</p>}
          </div>
          {/* Back to detail button */}
          {movie && (
            <button
              onClick={() => navigate({ page: "movie-detail", id: movie.id })}
              className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.06] text-[#AAAAAA] hover:text-white hover:bg-white/[0.08] transition-all text-[11px] font-medium"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              Details
            </button>
          )}
        </div>

        {/* Server Switcher */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-[#666666] uppercase tracking-wider" style={{ fontFamily: GROTESK }}>Server</span>
            {tmdbServers.length > 4 && (
              <button
                onClick={() => setServersExpanded(!serversExpanded)}
                className="text-[10px] text-[#AAAAAA] hover:text-white transition-colors font-medium"
              >
                {serversExpanded ? "Show Less" : `+${tmdbServers.length - 4} More`}
              </button>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {visibleServers.map((server, idx) => (
              <button
                key={server.id}
                onClick={() => { setActiveServer(server.id); setIframeError(false); setUseDirectEmbed(true); }}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all ${
                  activeServer === server.id
                    ? "bg-[#ffffff]/15 text-white border border-[#ffffff]/30 shadow-sm shadow-[#ffffff]/10"
                    : "bg-white/[0.04] text-[#AAAAAA] border border-white/[0.06] hover:bg-white/[0.08] hover:text-white"
                }`}
                style={{ fontFamily: GROTESK }}
              >
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: activeServer === server.id ? "#ffffff" : server.color }} />
                Server {idx + 1}
              </button>
            ))}
            {/* Proxy / Direct toggle */}
            <button
              onClick={() => { setUseDirectEmbed(!useDirectEmbed); setIframeError(false); }}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all border ${
                useDirectEmbed
                  ? "bg-[#00D4AA]/10 text-[#00D4AA] border-[#00D4AA]/20"
                  : "bg-white/[0.04] text-[#666666] border-white/[0.06] hover:text-[#AAAAAA]"
              }`}
              style={{ fontFamily: GROTESK }}
              title={useDirectEmbed ? "Direct embed — bypasses proxy" : "Proxy mode — anti-sandbox enabled"}
            >
              <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: useDirectEmbed ? "#00D4AA" : "#666666" }} />
              {useDirectEmbed ? "Direct" : "Proxy"}
            </button>
          </div>
        </div>
      </div>

      {/* ═══ Movie Info Card — glass panel ═══ */}
      {movie && (
        <div className="mt-3 glass-card rounded-xl p-4 space-y-4">
          <div className="flex gap-3 sm:gap-4">
            {movie.poster_path && (
              <img
                src={`https://image.tmdb.org/t/p/w185${movie.poster_path}`}
                alt={movie.title}
                className="w-20 h-30 sm:w-24 sm:h-36 rounded-lg shrink-0 object-cover border border-white/[0.06]"
              />
            )}
            <div className="flex-1 min-w-0">
              <h3 className="text-base font-bold text-white" style={{ fontFamily: GROTESK }}>{movie.title}</h3>
              {movie.tagline && <p className="text-[10px] text-[#666666] italic mt-0.5">&quot;{movie.tagline}&quot;</p>}
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-[#ffffff]/15 text-[#ffffff] border border-[#ffffff]/25">MOVIE</span>
                {year && <span className="text-xs text-[#AAAAAA]">{year}</span>}
                {movie.runtime ? <span className="text-xs text-[#AAAAAA]">{hours}h {minutes}m</span> : null}
                {score > 0 && (
                  <span className="flex items-center gap-1">
                    <svg className="w-3.5 h-3.5 text-[#FFB800]" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                    <span className="text-xs font-bold text-[#FFB800]">{score.toFixed(1)}</span>
                    <span className="text-[9px] text-[#666666]">/ 10</span>
                  </span>
                )}
              </div>
              {movie.overview && <p className="text-xs text-[#AAAAAA] line-clamp-3 mt-2 leading-relaxed" style={{ fontFamily: INTER }}>{movie.overview}</p>}
              {movie.genres && movie.genres.length > 0 && (
                <div className="flex gap-1.5 mt-2 flex-wrap">
                  {movie.genres.map(g => {
                    const color = GENRE_COLORS[g.name] || "#ffffff";
                    return (
                      <span key={g.id} className="px-2.5 py-0.5 text-[9px] font-semibold rounded-full"
                        style={{ color, backgroundColor: `${color}15`, border: `1px solid ${color}20` }}
                      >
                        {g.name}
                      </span>
                    );
                  })}
                </div>
              )}
              {director && (
                <div className="mt-2 flex items-center gap-1.5">
                  <span className="text-[9px] text-[#666666] uppercase font-bold" style={{ fontFamily: GROTESK }}>Director</span>
                  <span className="text-[11px] text-white font-medium">{director.name}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══ Top Cast — glass panel ═══ */}
      {topCast.length > 0 && (
        <div className="mt-3 glass-card rounded-xl p-4">
          <h3 className="text-sm font-semibold text-[#AAAAAA] mb-3 flex items-center gap-2" style={{ fontFamily: GROTESK }}>
            <div className="w-1 h-4 rounded-full bg-[#4A90E2]" />
            Top Cast
          </h3>
          <div className="flex gap-3 overflow-x-auto scroll-container pb-2">
            {topCast.map(person => (
              <div key={person.id} className="shrink-0 text-center w-[72px] sm:w-[85px]">
                <div className="w-[64px] h-[64px] sm:w-[76px] sm:h-[76px] rounded-full bg-[#1A1A1A] overflow-hidden mx-auto mb-1.5 border-2 border-white/[0.06]">
                  {person.profile_path ? (
                    <img src={`https://image.tmdb.org/t/p/w185${person.profile_path}`} alt={person.name} className="w-full h-full object-cover" loading="lazy" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-base text-[#666666] font-semibold">
                      {person.name.charAt(0)}
                    </div>
                  )}
                </div>
                <p className="text-[9px] sm:text-[10px] text-white font-medium line-clamp-1">{person.name}</p>
                {person.character && <p className="text-[8px] text-[#666666] line-clamp-1">{person.character}</p>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
