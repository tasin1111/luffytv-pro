"use client";

import { useState, useEffect, useRef } from "react";
import { useAppStore } from "./store";
import { getTmdbServers } from "@/lib/embed-servers";

interface TVShowInfo {
  id: number;
  name: string;
  poster_path?: string;
  backdrop_path?: string;
  overview?: string;
  first_air_date?: string;
  number_of_seasons?: number;
  number_of_episodes?: number;
  vote_average?: number;
  genres?: Array<{ id: number; name: string }>;
  seasons?: Array<{
    id: number; name: string; season_number: number;
    episode_count: number; poster_path?: string; air_date?: string;
  }>;
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

export default function TVWatchPage({ tvId, season: initialSeason, episode: initialEpisode }: { tvId: number; season: number; episode: number }) {
  const navigate = useAppStore(s => s.navigate);
  const [show, setShow] = useState<TVShowInfo | null>(null);
  const [episodes, setEpisodes] = useState<SeasonEpisodes | null>(null);
  const [currentSeason, setCurrentSeason] = useState(initialSeason);
  const [currentEpisode, setCurrentEpisode] = useState(initialEpisode);
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
        const res = await fetch(`/api/tmdb/detail?id=${tvId}&type=tv`);
        if (res.ok) {
          const data = await res.json();
          setShow(data);
          if (tmdbServers.length > 0) setActiveServer(tmdbServers[0].id);
        }
      } catch { /* ignore */ }
      setLoading(false);
    }
    load();
  }, [tvId]);

  useEffect(() => {
    async function loadSeason() {
      try {
        const res = await fetch(`/api/tmdb/season?tvId=${tvId}&season=${currentSeason}`);
        if (res.ok) setEpisodes(await res.json());
      } catch { /* ignore */ }
    }
    loadSeason();
  }, [tvId, currentSeason]);

  const currentServer = tmdbServers.find(s => s.id === activeServer);
  const embedUrl = currentServer?.generateUrl({
    tmdbId: tvId, episode: currentEpisode, season: currentSeason, translation: "sub",
  }) || "";

  const currentEp = episodes?.episodes?.find(e => e.episode_number === currentEpisode);
  const visibleServers = serversExpanded ? tmdbServers : tmdbServers.slice(0, 4);
  const score = show?.vote_average != null ? (show.vote_average > 10 ? show.vote_average / 10 : show.vote_average) : 0;

  return (
    <div className="fade-in">
      {/* ═══ Background ═══ */}
      {show?.backdrop_path && (
        <div className="immersive-bg" style={{ backgroundImage: `url(https://image.tmdb.org/t/p/w1280${show.backdrop_path})` }} />
      )}

      {/* ═══ Grid: video + sidebar ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-3 lg:gap-4">
        {/* Video Section */}
        <div className="space-y-0">
          {/* Player */}
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
                  if (useDirectEmbed) setUseDirectEmbed(false);
                  else setIframeError(true);
                }}
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center bg-[#0D0D0D]">
                <div className="text-center space-y-3">
                  <div className="w-16 h-16 rounded-full bg-[#ffffff]/10 flex items-center justify-center mx-auto">
                    <svg className="w-8 h-8 text-[#ffffff]" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3" /></svg>
                  </div>
                  <p className="text-[#666666] text-sm">Select a server to start watching</p>
                </div>
              </div>
            )}
          </div>

          {/* Controls bar */}
          <div className="glass-card rounded-none lg:rounded-xl p-3 sm:p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#ffffff] animate-pulse" />
                  <span className="text-[10px] font-bold text-[#ffffff] uppercase tracking-wider" style={{ fontFamily: GROTESK }}>Now Playing</span>
                </div>
                <h3 className="text-sm font-bold text-white truncate" style={{ fontFamily: GROTESK }}>
                  S{currentSeason} E{currentEpisode}{currentEp ? ` - ${currentEp.name}` : ""}
                </h3>
                <p className="text-xs text-[#666666]">{show?.name}</p>
              </div>
              {show && (
                <button onClick={() => navigate({ page: "tv-detail", id: tvId })}
                  className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.06] text-[#AAAAAA] hover:text-white hover:bg-white/[0.08] transition-all text-[11px] font-medium"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  Details
                </button>
              )}
            </div>

            {/* Server switcher */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-[#666666] uppercase tracking-wider" style={{ fontFamily: GROTESK }}>Server</span>
                {tmdbServers.length > 4 && (
                  <button onClick={() => setServersExpanded(!serversExpanded)} className="text-[10px] text-[#AAAAAA] hover:text-white transition-colors font-medium">
                    {serversExpanded ? "Show Less" : `+${tmdbServers.length - 4} More`}
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {visibleServers.map((server, idx) => (
                  <button key={server.id}
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
                <button
                  onClick={() => { setUseDirectEmbed(!useDirectEmbed); setIframeError(false); }}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all border ${
                    useDirectEmbed ? "bg-[#00D4AA]/10 text-[#00D4AA] border-[#00D4AA]/20" : "bg-white/[0.04] text-[#666666] border-white/[0.06] hover:text-[#AAAAAA]"
                  }`}
                  style={{ fontFamily: GROTESK }}
                >
                  <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: useDirectEmbed ? "#00D4AA" : "#666666" }} />
                  {useDirectEmbed ? "Direct" : "Proxy"}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Episode Sidebar */}
        <div className="glass-card rounded-none lg:rounded-xl overflow-hidden">
          <div className="p-3 sm:p-4 border-b border-white/[0.06] flex items-center justify-between">
            <h3 className="text-sm font-bold text-white" style={{ fontFamily: GROTESK }}>Episodes</h3>
            {show?.number_of_seasons && show.number_of_seasons > 1 && (
              <select value={currentSeason}
                onChange={e => { const s = parseInt(e.target.value); setCurrentSeason(s); setCurrentEpisode(1); }}
                className="bg-[#1A1A1A] text-[#AAAAAA] text-xs px-3 py-1.5 rounded-full border border-white/[0.06] outline-none focus:border-[#ffffff]/30"
              >
                {Array.from({ length: show.number_of_seasons }, (_, i) => (
                  <option key={i + 1} value={i + 1}>Season {i + 1}</option>
                ))}
              </select>
            )}
          </div>

          <div className="max-h-[500px] lg:max-h-[620px] overflow-y-auto">
            {episodes?.episodes ? episodes.episodes.map(ep => (
              <button key={ep.id}
                onClick={() => { setCurrentEpisode(ep.episode_number); navigate({ page: "tv-watch", id: tvId, season: ep.season_number, episode: ep.episode_number }); setIframeError(false); }}
                className={`w-full flex items-center gap-3 p-2.5 sm:p-3 text-left transition-all ${
                  currentEpisode === ep.episode_number
                    ? "bg-[#ffffff]/08 border-l-[3px] border-l-[#ffffff]"
                    : "hover:bg-white/[0.02] border-l-[3px] border-l-transparent"
                }`}
              >
                <div className="w-20 h-12 sm:w-24 sm:h-14 rounded-lg overflow-hidden shrink-0 bg-[#1A1A1A] relative">
                  {ep.still_path ? (
                    <img src={`https://image.tmdb.org/t/p/w300${ep.still_path}`} alt="" className="w-full h-full object-cover" loading="lazy" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xs font-bold text-[#666666]">{ep.episode_number}</div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-medium line-clamp-1 ${currentEpisode === ep.episode_number ? "text-white" : "text-[#AAAAAA]"}`}>{ep.name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[9px] text-[#ffffff] font-semibold" style={{ fontFamily: GROTESK }}>EP {ep.episode_number}</span>
                    {ep.runtime && <span className="text-[9px] text-[#666666]">{ep.runtime}m</span>}
                  </div>
                </div>
                {currentEpisode === ep.episode_number && (
                  <svg className="w-4 h-4 text-[#ffffff] shrink-0 animate-pulse" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3" /></svg>
                )}
              </button>
            )) : (
              Array.from({ length: 8 }, (_, i) => (
                <div key={i} className="flex items-center gap-3 p-3">
                  <div className="w-24 h-14 rounded-lg skeleton" />
                  <div className="flex-1 space-y-1"><div className="h-3 w-32 skeleton rounded" /><div className="h-2 w-16 skeleton rounded" /></div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ═══ Info card ═══ */}
      {show && (
        <div className="mt-3 glass-card rounded-xl p-4 space-y-3">
          <div className="flex gap-3 sm:gap-4">
            {show.poster_path && (
              <img src={`https://image.tmdb.org/t/p/w185${show.poster_path}`} alt={show.name} className="w-20 h-28 sm:w-24 sm:h-36 rounded-lg shrink-0 object-cover border border-white/[0.06]" />
            )}
            <div className="flex-1 min-w-0">
              <h3 className="text-base font-bold text-white" style={{ fontFamily: GROTESK }}>{show.name}</h3>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-[#ffffff]/15 text-[#ffffff] border border-[#ffffff]/25">TV SHOW</span>
                {show.number_of_seasons && <span className="text-xs text-[#AAAAAA]">{show.number_of_seasons} Season{show.number_of_seasons > 1 ? "s" : ""}</span>}
                {score > 0 && (
                  <span className="flex items-center gap-1">
                    <svg className="w-3.5 h-3.5 text-[#FFB800]" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                    <span className="text-xs font-bold text-[#FFB800]">{score.toFixed(1)}</span>
                  </span>
                )}
              </div>
              {show.overview && <p className="text-xs text-[#AAAAAA] line-clamp-2 mt-2" style={{ fontFamily: INTER }}>{show.overview}</p>}
              {show.genres && (
                <div className="flex gap-1.5 mt-2 flex-wrap">
                  {show.genres.slice(0, 4).map(g => {
                    const color = GENRE_COLORS[g.name] || "#ffffff";
                    return <span key={g.id} className="px-2.5 py-0.5 text-[9px] font-semibold rounded-full" style={{ color, backgroundColor: `${color}15`, border: `1px solid ${color}20` }}>{g.name}</span>;
                  })}
                </div>
              )}
              <button onClick={() => navigate({ page: "tv-detail", id: tvId })}
                className="text-[11px] text-[#ffffff]/70 hover:text-[#ffffff] mt-2 transition-colors font-medium"
              >View Full Details →</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
