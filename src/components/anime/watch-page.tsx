"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useAppStore } from "./store";
import { getAnimeServers, getHindiServers } from "@/lib/embed-servers";

// ============================================================
// WATCH PAGE — Ultimate Structural Redesign
//
// Structural inspiration synthesis:
//   Animetsu.net — Floating mini-player, trending rank, relationship tags
//   AnimeX.one — Named server pills, screenshot, W2G, HardSub/SoftSub, theatre, PiP
//   Anime.nexus — Tabbed content, timestamp comments, Up Next card, Cmd+Palette, SUB/AUD counts
//   Kuroiru.co — Live countdown schedules, keyboard shortcuts
//   ModSyndicate.com — Jump-to-episode spinbox, minimal chrome
//   Anidap.se — Playlists, community features
//   Reanime.to / LunarAnime.ru — Dual-language UI patterns
// ============================================================

interface WatchPageProps {
  animeId: string;
  episodeNum: number;
}

interface ServerInfo {
  id: string;
  name: string;
  url: string;
  color: string;
  idType: "tmdb" | "anilist" | "mal" | "session";
  supportsDub: boolean;
  supportsHindi: boolean;
  category: "anime" | "tmdb" | "hindi";
  noSandbox?: boolean;
}

interface CommentData {
  id: string;
  username: string;
  avatar?: string;
  text: string;
  createdAt: string;
  likes: number;
}

interface RelationAnime {
  id: number;
  title: { english?: string; romaji?: string; native?: string };
  coverImage?: { extraLarge?: string; large?: string; medium?: string };
  relationType?: string;
  type?: string;
  format?: string;
  episodes?: number;
  status?: string;
}

interface RecommendationAnime {
  id: number;
  title: { english?: string; romaji?: string; native?: string };
  coverImage?: { extraLarge?: string; large?: string; medium?: string };
  type?: string;
  episodes?: number;
  averageScore?: number;
}

type TranslationType = "sub" | "dub" | "hindi";
type ContentTab = "episodes" | "info" | "relations" | "comments";
type EpisodeViewMode = "list" | "grid";
type EpisodeSortOrder = "asc" | "desc";

export default function WatchPage({ animeId, episodeNum }: WatchPageProps) {
  const navigate = useAppStore(s => s.navigate);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const episodeListRef = useRef<HTMLDivElement>(null);
  const watchContainerRef = useRef<HTMLDivElement>(null);

  // ── Listen for postMessage from iframe players ──
  useEffect(() => {
    function handleMessage(e: MessageEvent) {
      if (e.data?.type === 'player-ready') {
        setLoading(false);
        setPlaying(true);
      } else if (e.data?.type === 'player-error') {
        autoSwitchToNextServer();
      }
    }
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Player State ──
  const [useDirectEmbed, setUseDirectEmbed] = useState(true);
  const [servers, setServers] = useState<ServerInfo[]>([]);
  const [activeServerId, setActiveServerId] = useState<string>("");
  const [embedUrl, setEmbedUrl] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [translation, setTranslation] = useState<TranslationType>("sub");

  // ── Hard safety: loading state must never persist beyond 10s ──
  useEffect(() => {
    if (!loading) return;
    const maxTimer = setTimeout(() => setLoading(false), 10000);
    return () => clearTimeout(maxTimer);
  }, [loading]);

  // ── Anime Data ──
  const [episodeList, setEpisodeList] = useState<Array<{ number: number; slug: string }>>([]);
  const [animeTitle, setAnimeTitle] = useState("");
  const [animeImage, setAnimeImage] = useState("");
  const [animeDescription, setAnimeDescription] = useState("");
  const [anilistId, setAnilistId] = useState<number | null>(null);
  const [malId, setMalId] = useState<number | null>(null);
  const [tmdbSeason, setTmdbSeason] = useState<number | null>(null);
  const [tmdbId, setTmdbId] = useState<number | null>(null);
  const [tmdbBackdrop, setTmdbBackdrop] = useState("");
  const [tmdbRating, setTmdbRating] = useState<number | null>(null);
  const [tmdbGenres, setTmdbGenres] = useState<string[]>([]);
  const [animeStatus, setAnimeStatus] = useState("");
  const [animeType, setAnimeType] = useState("");
  const [animeSeason, setAnimeSeason] = useState("");
  const [animeEpisodes, setAnimeEpisodes] = useState<number | null>(null);
  const [animeDuration, setAnimeDuration] = useState<number | null>(null);
  const [animeStudios, setAnimeStudios] = useState<string[]>([]);
  const [animeNextAiring, setAnimeNextAiring] = useState<{ episode: number; airingAt: number } | null>(null);

  // ── UI State ──
  const [activeTab, setActiveTab] = useState<ContentTab>("episodes");
  const [epViewMode, setEpViewMode] = useState<EpisodeViewMode>("grid");
  const [epSortOrder, setEpSortOrder] = useState<EpisodeSortOrder>("asc");
  const [epSearch, setEpSearch] = useState("");
  const [synopsisExpanded, setSynopsisExpanded] = useState(false);
  const [theaterMode, setTheaterMode] = useState(false);
  const [autoNext, setAutoNext] = useState(true);
  const [showMiniPlayer, setShowMiniPlayer] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showUpNext, setShowUpNext] = useState(true);
  const [jumpToEp, setJumpToEp] = useState("");
  const [commentsVisible, setCommentsVisible] = useState(false);

  // ── Comments State ──
  const [comments, setComments] = useState<CommentData[]>([]);
  const [commentText, setCommentText] = useState("");
  const [commentsLoading, setCommentsLoading] = useState(false);

  // ── Relations & Recommendations ──
  const [relations, setRelations] = useState<RelationAnime[]>([]);
  const [recommendations, setRecommendations] = useState<RecommendationAnime[]>([]);

  // ── Next airing countdown ──
  const [countdown, setCountdown] = useState("");

  // ── Scroll-based mini player ──
  useEffect(() => {
    if (!playing || theaterMode) return;
    function handleScroll() {
      const container = watchContainerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      setShowMiniPlayer(rect.top < -200);
    }
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [playing, theaterMode]);

  // ── Keyboard shortcuts ──
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "?" && !e.ctrlKey && !e.metaKey) {
        const target = e.target as HTMLElement;
        if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;
        setShowShortcuts(prev => !prev);
      }
      if (e.key === "Escape") setShowShortcuts(false);
      // N = next ep, P = prev ep
      if (e.key === "n" && !e.ctrlKey) {
        const target = e.target as HTMLElement;
        if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;
        const next = episodeList.find(ep => ep.number === episodeNum + 1);
        if (next) switchEpisode(next.number);
      }
      if (e.key === "p" && !e.ctrlKey) {
        const target = e.target as HTMLElement;
        if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;
        if (episodeNum > 1) switchEpisode(episodeNum - 1);
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [episodeNum, episodeList]); // eslint-disable-line react-hooks/exhaustive-deps

  // Parse anime ID
  useEffect(() => {
    const cleanId = animeId.replace(/^miruro_/, "").replace(/^mal_/, "");
    if (/^\d+$/.test(cleanId)) setAnilistId(parseInt(cleanId));
  }, [animeId]);

  // Load anime info
  useEffect(() => {
    let cancelled = false;
    async function loadInfo() {
      try {
        const res = await fetch(`/api/anime/info?id=${encodeURIComponent(animeId)}`);
        if (cancelled) return;
        if (res.ok) {
          const data = await res.json();
          const anime = data.anime;
          const anilistInfo = data.anilistInfo;
          const tmdbFallback = data.tmdbFallbackInfo;
          const malInfo = data._source === "mal" ? data.anilistInfo : null;

          setAnimeTitle(
            anilistInfo?.title?.english || anilistInfo?.title?.romaji ||
            malInfo?.title?.english || malInfo?.title?.romaji ||
            tmdbFallback?.title?.english || tmdbFallback?.title?.romaji ||
            anime?.englishName || anime?.name || ""
          );
          setAnimeImage(
            anilistInfo?.coverImage?.extraLarge || anilistInfo?.coverImage?.large ||
            malInfo?.coverImage?.extraLarge || malInfo?.coverImage?.large ||
            tmdbFallback?.coverImage?.extraLarge || tmdbFallback?.coverImage?.large ||
            anime?.thumbnail || ""
          );
          setAnimeDescription(
            anilistInfo?.description?.replace(/<[^>]*>/g, "") ||
            malInfo?.description?.replace(/<[^>]*>/g, "") ||
            tmdbFallback?.description?.replace(/<[^>]*>/g, "") ||
            anime?.description || ""
          );

          if (anilistInfo?.id && !anilistId) setAnilistId(anilistInfo.id);
          if (anilistInfo?.idMal) setMalId(anilistInfo.idMal);
          if (!malId && anime?.idMal) setMalId(anime.idMal);

          if (data.tmdbData?.id) setTmdbId(data.tmdbData.id);
          else if (data.tmdbId) setTmdbId(data.tmdbId);
          if (data.tmdbSeason) setTmdbSeason(data.tmdbSeason);
          else if (data.zenshinMappings?.season?.tmdb) setTmdbSeason(data.zenshinMappings.season.tmdb);
          if (data.tmdbData) {
            if (data.tmdbData.backdropUrl) setTmdbBackdrop(data.tmdbData.backdropUrl);
            else if (data.tmdbData.backdrop_path) setTmdbBackdrop(`https://image.tmdb.org/t/p/w780${data.tmdbData.backdrop_path}`);
            if (data.tmdbData.vote_average) setTmdbRating(data.tmdbData.vote_average);
            if (data.tmdbData.genres) setTmdbGenres(data.tmdbData.genres.map((g: any) => typeof g === "string" ? g : g.name));
          }
          if (!tmdbRating && tmdbFallback?.averageScore) {
            setTmdbRating(tmdbFallback.averageScore > 10 ? tmdbFallback.averageScore / 10 : tmdbFallback.averageScore);
          }
          if (tmdbGenres.length === 0 && tmdbFallback?.genres?.length) {
            setTmdbGenres(tmdbFallback.genres.filter((g: any) => typeof g === "string"));
          }

          if (anilistInfo) {
            if (anilistInfo.status) setAnimeStatus(anilistInfo.status);
            if (anilistInfo.format) setAnimeType(anilistInfo.format);
            if (anilistInfo.season && anilistInfo.seasonYear) setAnimeSeason(`${anilistInfo.season} ${anilistInfo.seasonYear}`);
            if (anilistInfo.episodes) setAnimeEpisodes(anilistInfo.episodes);
            if (anilistInfo.duration) setAnimeDuration(anilistInfo.duration);
            if (anilistInfo.studios?.nodes) setAnimeStudios(anilistInfo.studios.nodes.filter((s: any) => s.isAnimationStudio).map((s: any) => s.name));
            if (anilistInfo.studios && Array.isArray(anilistInfo.studios) && anilistInfo.studios[0]?.name) setAnimeStudios(anilistInfo.studios.filter((s: any) => s.isAnimationStudio).map((s: any) => s.name));
            if (anilistInfo.nextAiringEpisode) setAnimeNextAiring(anilistInfo.nextAiringEpisode);
            if (data.nextAiringEpisode) setAnimeNextAiring(data.nextAiringEpisode);
          }

          if (anilistInfo) {
            const mapRel = (edge: any) => {
              const node = edge.node || edge;
              return {
                relationType: edge.relationType, id: node.id, title: node.title,
                coverImage: node.coverImage, type: node.type, format: node.format,
                episodes: node.episodes, status: node.status,
              };
            };
            const relsRaw = Array.isArray(anilistInfo.relations) && anilistInfo.relations[0]?.relationType
              ? anilistInfo.relations : (anilistInfo.relations?.edges || []);
            if (relsRaw.length > 0) setRelations(relsRaw.map(mapRel));

            const recsRaw = Array.isArray(anilistInfo.recommendations) ? anilistInfo.recommendations : (anilistInfo.recommendations?.nodes || []);
            if (recsRaw.length > 0) {
              setRecommendations(
                recsRaw.filter((r: any) => r.mediaRecommendation || r.id).map((r: any) => {
                  const m = r.mediaRecommendation || r;
                  return { id: m.id, title: m.title, coverImage: m.coverImage, type: m.type, episodes: m.episodes, averageScore: m.averageScore };
                })
              );
            }
          }
        }
      } catch { /* ignore */ }
    }
    loadInfo();
    return () => { cancelled = true; };
  }, [animeId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load episodes list
  useEffect(() => {
    let cancelled = false;
    async function loadEps() {
      try {
        const res = await fetch(`/api/anime/episodes?id=${encodeURIComponent(animeId)}`);
        if (cancelled) return;
        if (res.ok) {
          const data = await res.json();
          if (data.episodes?.length) {
            setEpisodeList(data.episodes.map((e: any) => ({ number: e.episodeIdNum, slug: String(e.episodeIdNum) })));
          }
        }
      } catch { /* ignore */ }
    }
    loadEps();
    return () => { cancelled = true; };
  }, [animeId]);

  // Fetch TMDB ID for anime
  useEffect(() => {
    if (!animeTitle || tmdbId) return;
    let cancelled = false;
    async function fetchTmdbId() {
      try {
        const res = await fetch(`/api/tmdb/search?q=${encodeURIComponent(animeTitle)}&type=tv`);
        if (!cancelled && res.ok) {
          const data = await res.json();
          if (data.results?.length > 0) {
            const match = data.results.find(
              (r: any) => r.name?.toLowerCase() === animeTitle.toLowerCase() ||
                          r.original_name?.toLowerCase() === animeTitle.toLowerCase()
            ) || data.results[0];
            if (match?.id) setTmdbId(match.id);
          }
        }
      } catch { /* ignore */ }
    }
    fetchTmdbId();
    return () => { cancelled = true; };
  }, [animeTitle, tmdbId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load comments
  useEffect(() => {
    if (!anilistId) return;
    let cancelled = false;
    async function loadComments() {
      setCommentsLoading(true);
      try {
        const res = await fetch(`/api/comments?animeId=${anilistId}&episode=${episodeNum}`);
        if (!cancelled && res.ok) {
          const data = await res.json();
          setComments(data.comments || []);
        }
      } catch { /* ignore */ }
      if (!cancelled) setCommentsLoading(false);
    }
    loadComments();
    return () => { cancelled = true; };
  }, [anilistId, episodeNum]);

  // Build servers based on translation type
  useEffect(() => {
    const availableServers: ServerInfo[] = [];

    if (translation === "hindi") {
      const hindiServers = getHindiServers();
      for (const server of hindiServers) {
        const url = server.generateUrl({
          anilistId: anilistId || undefined, malId: malId || undefined,
          episode: episodeNum, translation: "hindi", title: animeTitle,
        });
        if (url) {
          availableServers.push({
            id: server.id, name: server.name, url,
            color: server.color, idType: server.idType,
            supportsDub: false, supportsHindi: true,
            category: "hindi", noSandbox: server.noSandbox,
          });
        }
      }
    } else {
      const animeServers = getAnimeServers();
      for (const server of animeServers) {
        if (translation === "dub" && !server.supportsDub) continue;
        const url = server.generateUrl({
          anilistId: anilistId || undefined, malId: malId || undefined,
          tmdbId: tmdbId || undefined, episode: episodeNum,
          season: tmdbSeason || undefined, translation,
        });
        if (url) {
          availableServers.push({
            id: server.id, name: server.name, url,
            color: server.color, idType: server.idType,
            supportsDub: server.supportsDub, supportsHindi: false,
            category: server.category, noSandbox: server.noSandbox,
          });
        }
      }
    }

    setServers(availableServers);
    if (availableServers.length > 0) {
      const currentStillValid = availableServers.some(s => s.id === activeServerId);
      if (!currentStillValid) setActiveServerId(availableServers[0].id);
    }
  }, [anilistId, malId, tmdbId, tmdbSeason, episodeNum, translation, animeTitle]); // eslint-disable-line react-hooks/exhaustive-deps

  // When active server changes, update embed URL
  useEffect(() => {
    const server = servers.find(s => s.id === activeServerId);
    if (!server) { setLoading(false); return; }
    const isInternalApi = server.url.startsWith("/api/");
    setUseDirectEmbed(isInternalApi || !server.noSandbox);
    setEmbedUrl(server.url);
    setLoading(true);
    setError(null);
    setPlaying(false);
    const timer = setTimeout(() => setLoading(false), 5000);
    return () => clearTimeout(timer);
  }, [activeServerId, servers]);

  // Next airing countdown
  useEffect(() => {
    if (!animeNextAiring) return;
    function update() {
      const now = Math.floor(Date.now() / 1000);
      const diff = animeNextAiring.airingAt - now;
      if (diff <= 0) { setCountdown(""); return; }
      const d = Math.floor(diff / 86400);
      const h = Math.floor((diff % 86400) / 3600);
      const m = Math.floor((diff % 3600) / 60);
      const s = diff % 60;
      setCountdown(`${d}d ${h}h ${m}m ${s}s`);
    }
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [animeNextAiring]);

  // Auto-switch to next server on failure
  const autoSwitchToNextServer = useCallback(() => {
    const currentIdx = servers.findIndex(s => s.id === activeServerId);
    for (let i = currentIdx + 1; i < servers.length; i++) {
      setActiveServerId(servers[i].id);
      return;
    }
    for (let i = 0; i < currentIdx; i++) {
      if (servers[i].id !== activeServerId) {
        setActiveServerId(servers[i].id);
        return;
      }
    }
    setError("All servers failed. Try refreshing the page.");
  }, [servers, activeServerId]);

  const switchTranslation = (trans: TranslationType) => setTranslation(trans);
  const switchEpisode = (epNum: number) => {
    navigate({ page: "watch", id: animeId, episode: epNum, title: animeTitle, image: animeImage });
  };

  const retryLoad = () => {
    setError(null);
    if (!useDirectEmbed) {
      setUseDirectEmbed(true);
      setLoading(true);
    } else {
      const currentIdx = servers.findIndex(s => s.id === activeServerId);
      if (currentIdx < servers.length - 1) setActiveServerId(servers[currentIdx + 1].id);
      else setActiveServerId(servers[0]?.id || "");
    }
  };

  const submitComment = async () => {
    if (!commentText.trim() || !anilistId) return;
    try {
      const res = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ animeId: anilistId, episode: episodeNum, text: commentText.trim() }),
      });
      if (res.ok) {
        setCommentText("");
        const data = await res.json();
        setComments(prev => [data.comment, ...prev]);
      }
    } catch { /* ignore */ }
  };

  const activeServer = servers.find(s => s.id === activeServerId);
  const prevEp = episodeNum > 1 ? episodeNum - 1 : null;
  const nextEp = episodeList.find(e => e.number === episodeNum + 1) ? episodeNum + 1 : null;
  const hindiAvailable = getHindiServers().length > 0;

  // Filtered & sorted episodes
  const searchLower = epSearch.toLowerCase();
  const filteredEps = episodeList
    .filter(ep => !epSearch || String(ep.number).includes(searchLower))
    .sort((a, b) => epSortOrder === "asc" ? a.number - b.number : b.number - a.number);

  // ── Rating display ──
  const displayRating = tmdbRating ? (tmdbRating > 10 ? tmdbRating / 10 : tmdbRating) : null;

  // ── Translation badge color ──
  const getTransColor = (t: TranslationType) => {
    switch (t) {
      case "sub": return { bg: "bg-[#4A90E2]", text: "text-[#4A90E2]", light: "bg-[#4A90E2]/15", border: "border-[#4A90E2]/25" };
      case "dub": return { bg: "bg-[#E63946]", text: "text-[#E63946]", light: "bg-[#E63946]/15", border: "border-[#E63946]/25" };
      case "hindi": return { bg: "bg-[#FF6B00]", text: "text-[#FF6B00]", light: "bg-[#FF6B00]/15", border: "border-[#FF6B00]/25" };
    }
  };

  const statusColor = (s: string) => {
    if (s === "RELEASING") return { bg: "bg-[#00D4AA]/15", text: "text-[#00D4AA]" };
    if (s === "FINISHED") return { bg: "bg-[#4A90E2]/15", text: "text-[#4A90E2]" };
    if (s === "NOT_YET_RELEASED") return { bg: "bg-[#FF8C00]/15", text: "text-[#FF8C00]" };
    return { bg: "bg-white/[0.06]", text: "text-[#AAAAAA]" };
  };
  const statusLabel = (s: string) => {
    if (s === "RELEASING") return "Airing";
    if (s === "FINISHED") return "Complete";
    if (s === "NOT_YET_RELEASED") return "Upcoming";
    return s;
  };

  // ── Server icon initial (clean letter badge) ──
  const serverEmoji = (name: string) => {
    const map: Record<string, string> = {
      "Miku": "M", "Pikachu": "P", "Eevee": "E", "Charizard": "C", "Zoro": "Z",
      "Kiwi": "K", "Arc": "A", "Bee": "B", "Umbreon": "U",
      "Mewtwo": "M", "Bulbasaur": "B", "Charmander": "C", "Flareon": "F",
    };
    return map[name] || name.charAt(0).toUpperCase();
  };

  // ── Tab count badge ──
  const tabBadge = (tab: ContentTab) => {
    switch (tab) {
      case "episodes": return episodeList.length || 0;
      case "info": return animeTitle ? 1 : 0;
      case "relations": return relations.length;
      case "comments": return comments.length;
    }
  };

  return (
    <div className="fade-in min-h-screen bg-[#0F172A]">

      {/* ═══════════════════════════════════════════════════════
          IMMERSIVE BACKDROP — full-width cinematic gradient
          ═══════════════════════════════════════════════════════ */}
      {tmdbBackdrop && (
        <div className="wp-immersive" style={{ backgroundImage: `url(${tmdbBackdrop})` }} />
      )}

      {/* ═══════════════════════════════════════════════════════
          CINEMATIC PLAYER — full-width, edge-to-edge
          ═══════════════════════════════════════════════════════ */}
      <div ref={watchContainerRef} className={`wp-player-zone ${theaterMode ? "wp-theater" : ""}`}>
        <div className="wp-player-inner">
          {/* Hindi not available state */}
          {translation === "hindi" && servers.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center bg-[#0F172A]/95 z-20">
              <div className="text-center space-y-5 max-w-sm px-6">
                <div className="w-20 h-20 rounded-2xl bg-[#FF6B00]/10 border border-[#FF6B00]/20 flex items-center justify-center mx-auto">
                  <svg className="w-10 h-10 text-[#FF6B00]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <h3 className="text-[#FF6B00] text-lg font-bold">Hindi Dub Not Available</h3>
                <p className="text-white/40 text-sm">This anime doesn&apos;t have a Hindi dub yet.</p>
                <div className="flex items-center justify-center gap-3">
                  <button onClick={() => switchTranslation("sub")} className="wp-btn-accent">Watch SUB</button>
                  <button onClick={() => switchTranslation("dub")} className="wp-btn-ghost">Watch DUB</button>
                </div>
              </div>
            </div>
          )}

          {/* Iframe Player */}
          {embedUrl && !(translation === "hindi" && servers.length === 0) && (
            <iframe
              ref={iframeRef}
              key={`${activeServerId}-${embedUrl}-${useDirectEmbed}`}
              src={(() => {
                if (embedUrl.startsWith("/api/")) return embedUrl;
                return useDirectEmbed ? embedUrl : `/api/embed/proxy?url=${encodeURIComponent(embedUrl)}`;
              })()}
              className="w-full h-full border-0 relative z-10"
              allowFullScreen
              allow="autoplay; fullscreen; picture-in-picture; encrypted-media; screen-wake-lock; clipboard-write; document-domain"
              referrerPolicy="no-referrer"
              onLoad={() => {
                setLoading(false);
                if (!embedUrl.startsWith("/api/")) setPlaying(true);
              }}
              onError={() => {
                if (embedUrl.startsWith("/api/")) autoSwitchToNextServer();
                else if (useDirectEmbed) { setUseDirectEmbed(false); setLoading(true); }
                else autoSwitchToNextServer();
              }}
              title={`${animeTitle} - Episode ${episodeNum}`}
            />
          )}

          {/* Loading — cinematic pulse */}
          {loading && !(translation === "hindi" && servers.length === 0) && (
            <div className="absolute inset-0 flex items-center justify-center bg-[#0F172A]/90 z-20">
              <div className="text-center space-y-4">
                <div className="wp-loader-ring">
                  <div />
                  <div />
                </div>
                <p className="text-white/30 text-xs font-medium tracking-wide">
                  {embedUrl?.startsWith("/api/") ? "Connecting to" : "Loading from"} <span className="text-[#E63946]/70">{activeServer?.name || "server"}</span>...
                </p>
              </div>
            </div>
          )}

          {/* Error state */}
          {error && !loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-[#0F172A]/90 z-20">
              <div className="text-center space-y-5 max-w-sm px-6">
                <div className="w-16 h-16 rounded-2xl bg-[#E63946]/10 border border-[#E63946]/20 flex items-center justify-center mx-auto">
                  <svg className="w-8 h-8 text-[#E63946]/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <p className="text-white/60 text-sm">{error}</p>
                <div className="flex items-center justify-center gap-3">
                  <button onClick={retryLoad} className="wp-btn-accent">Retry</button>
                  <button onClick={autoSwitchToNextServer} className="wp-btn-ghost">Next Server</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════
          FLOATING MINI-PLAYER — Animetsu style
          Appears when user scrolls past the main player
          ═══════════════════════════════════════════════════════ */}
      {showMiniPlayer && playing && !theaterMode && (
        <div className="wp-mini-player">
          <div className="wp-mini-inner">
            <iframe
              key={`mini-${activeServerId}-${embedUrl}`}
              src={(() => {
                if (!embedUrl) return "";
                if (embedUrl.startsWith("/api/")) return embedUrl;
                return useDirectEmbed ? embedUrl : `/api/embed/proxy?url=${encodeURIComponent(embedUrl)}`;
              })()}
              className="w-full h-full border-0"
              allowFullScreen
              allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
              referrerPolicy="no-referrer"
              title="Mini Player"
            />
          </div>
          <div className="wp-mini-info">
            <p className="text-[10px] text-white/40 font-semibold truncate">{animeTitle}</p>
            <p className="text-[9px] text-white/20">EP {episodeNum}</p>
          </div>
          <button onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} className="wp-mini-expand">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
            </svg>
          </button>
          <button onClick={() => setShowMiniPlayer(false)} className="wp-mini-close">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════
          CONTENT AREA — below the cinematic player
          ═══════════════════════════════════════════════════════ */}
      <div className={`wp-content ${theaterMode ? "max-w-full px-4" : ""}`}>

        {/* ─── NOW PLAYING HERO BAR ───
            Full-width title bar with episode info + quick actions */}
        <div className="wp-hero-bar">
          {/* Left: Title info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2.5 mb-1.5">
              <span className="wp-live-dot" />
              <span className="wp-label-xs text-[#E63946]">Now Playing</span>
              <span className={`wp-trans-badge ${getTransColor(translation).light} ${getTransColor(translation).text} border ${getTransColor(translation).border}`}>
                {translation === "hindi" ? "HINDI DUB" : translation.toUpperCase()}
              </span>
              {activeServer && (
                <span className="wp-trans-badge bg-white/[0.06] text-white/50 border border-white/[0.08]">
                  {activeServer.name}
                </span>
              )}
            </div>
            <h1 className="wp-title-main">{animeTitle}</h1>
            <p className="wp-subtitle">
              Episode {episodeNum}{animeEpisodes ? ` of ${animeEpisodes}` : ""}
              {animeDuration && ` · ${animeDuration}min`}
              {animeStatus === "RELEASING" && (
                <span className="inline-flex items-center gap-1.5 ml-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#00D4AA] animate-pulse" />
                  <span className="text-[#00D4AA]/60">Airing</span>
                </span>
              )}
            </p>
          </div>

          {/* Right: Quick actions */}
          <div className="flex items-center gap-2 shrink-0">
            {prevEp && (
              <button onClick={() => switchEpisode(prevEp)} className="wp-ep-arrow" title="Previous Episode (P)">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
              </button>
            )}
            {nextEp && (
              <button onClick={() => switchEpisode(nextEp)} className="wp-ep-arrow-next" title="Next Episode (N)">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
              </button>
            )}
            <div className="w-px h-6 bg-white/[0.06] mx-1" />
            <button onClick={() => setTheaterMode(!theaterMode)} className={`wp-icon-btn ${theaterMode ? "active" : ""}`} title="Theater Mode">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <rect x="2" y="6" width="20" height="12" rx="2" />
                {theaterMode && <rect x="2" y="6" width="20" height="3" rx="1" className="fill-current" />}
              </svg>
            </button>
            <button onClick={() => setAutoNext(!autoNext)} className={`wp-icon-btn ${autoNext ? "active" : ""}`} title="Auto Next">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </button>
            <button onClick={() => { setUseDirectEmbed(!useDirectEmbed); setLoading(true); setError(null); }} className={`wp-icon-btn ${!useDirectEmbed ? "active" : ""}`} title={useDirectEmbed ? "Direct embed" : "Proxy mode"}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </button>
            <button onClick={() => setShowShortcuts(!showShortcuts)} className="wp-icon-btn" title="Keyboard Shortcuts (?)">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <rect x="2" y="6" width="20" height="12" rx="2" />
                <path d="M6 12h.01M10 12h.01M14 12h.01M18 12h.01M8 16h8" />
              </svg>
            </button>
          </div>
        </div>

        {/* ─── UP NEXT CARD — Anime.nexus style ─── */}
        {showUpNext && nextEp && animeTitle && (
          <div className="wp-up-next">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="w-10 h-10 rounded-lg bg-[#E63946]/15 border border-[#E63946]/20 flex items-center justify-center shrink-0">
                <svg className="w-5 h-5 text-[#E63946]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-bold text-white/80 truncate">Up Next: Episode {nextEp}</p>
                <p className="text-[10px] text-white/30 truncate">{animeTitle}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button onClick={() => switchEpisode(nextEp)} className="wp-btn-accent-sm">Play Now</button>
              <button onClick={() => setShowUpNext(false)} className="wp-icon-btn-sm" title="Dismiss">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
          </div>
        )}

        {/* ─── SERVER SELECTOR — AnimeX named pill style ─── */}
        <div className="wp-server-zone">
          {/* SUB/DUB/HINDI Toggle — segmented control */}
          <div className="wp-trans-toggle">
            {(["sub", "dub", ...(hindiAvailable ? ["hindi" as const] : [])] as const).map(t => (
              <button key={t} onClick={() => switchTranslation(t)}
                className={`wp-trans-btn ${translation === t ? `active-${t}` : ""}`}>
                {t === "hindi" ? "HINDI" : t.toUpperCase()}
              </button>
            ))}
          </div>

          {/* Server Pills — AnimeX named style with emojis */}
          <div className="wp-server-pills">
            {servers.map((s, idx) => (
              <button key={s.id}
                onClick={() => { setActiveServerId(s.id); setLoading(true); setError(null); }}
                className={`wp-server-pill ${activeServerId === s.id ? "active" : ""}`}
              >
                <span className="wp-server-emoji">{serverEmoji(s.name)}</span>
                <span className="wp-server-name">{s.name}</span>
                <span className="wp-server-num">S{idx + 1}</span>
              </button>
            ))}
          </div>
        </div>

        {/* ─── NEXT AIRING COUNTDOWN BAR ─── */}
        {animeNextAiring && countdown && (
          <div className="wp-countdown-bar">
            <div className="flex items-center gap-2">
              <div className="wp-countdown-dot" />
              <span className="text-[11px] text-[#FF8C00]/80 font-semibold">Episode {animeNextAiring.episode} airs in</span>
              <span className="text-[12px] font-extrabold text-[#FF8C00] tracking-wide font-mono">{countdown}</span>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════
            TABBED CONTENT — Anime.nexus style
            Episodes | Info | Relations | Comments
            ═══════════════════════════════════════════════════════ */}
        <div className="wp-tabs-container">
          {/* Tab Bar */}
          <div className="wp-tab-bar">
            {(["episodes", "info", "relations", "comments"] as const).map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`wp-tab ${activeTab === tab ? "active" : ""}`}>
                {tab === "episodes" && (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
                  </svg>
                )}
                {tab === "info" && (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <circle cx="12" cy="12" r="10" /><path d="M12 16v-4m0-4h.01" />
                  </svg>
                )}
                {tab === "relations" && (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101" />
                    <path d="M10.172 13.828a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                  </svg>
                )}
                {tab === "comments" && (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                )}
                <span>{tab.charAt(0).toUpperCase() + tab.slice(1)}</span>
                {tabBadge(tab) > 0 && (
                  <span className="wp-tab-count">{tabBadge(tab)}</span>
                )}
              </button>
            ))}
          </div>

          {/* ─── EPISODES TAB ─── */}
          {activeTab === "episodes" && (
            <div className="wp-tab-content">
              {/* Controls bar */}
              <div className="wp-ep-controls">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  {/* Search */}
                  <div className="wp-search-box flex-1 max-w-[200px]">
                    <svg className="wp-search-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </svg>
                    <input type="text" value={epSearch} onChange={e => setEpSearch(e.target.value)}
                      placeholder="Search ep..." className="wp-search-input" />
                  </div>

                  {/* Jump to episode — ModSyndicate spinbox */}
                  <div className="wp-jump-box">
                    <span className="wp-label-xs">Jump</span>
                    <input type="number" min={1} max={episodeList.length || 1}
                      value={jumpToEp} onChange={e => setJumpToEp(e.target.value)}
                      placeholder="#"
                      className="wp-jump-input"
                      onKeyDown={e => {
                        if (e.key === "Enter") {
                          const val = parseInt(jumpToEp);
                          if (val >= 1 && val <= episodeList.length) switchEpisode(val);
                        }
                      }}
                    />
                    <button onClick={() => {
                      const val = parseInt(jumpToEp);
                      if (val >= 1 && val <= episodeList.length) switchEpisode(val);
                    }} className="wp-jump-go">Go</button>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  {/* Sort */}
                  <button onClick={() => setEpSortOrder(epSortOrder === "asc" ? "desc" : "asc")}
                    className="wp-icon-btn-sm" title={epSortOrder === "asc" ? "Ascending" : "Descending"}>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      {epSortOrder === "asc" ? (
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
                      ) : (
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 4h13M3 8h9m-9 4h9m5-4v12m0 0l-4-4m4 4l4-4" />
                      )}
                    </svg>
                  </button>
                  {/* View toggle */}
                  <button onClick={() => setEpViewMode(epViewMode === "list" ? "grid" : "list")}
                    className="wp-icon-btn-sm" title={epViewMode === "list" ? "Grid view" : "List view"}>
                    {epViewMode === "list" ? (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" />
                        <line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {/* Episode Grid/List */}
              {filteredEps.length > 0 ? (
                epViewMode === "grid" ? (
                  /* GRID VIEW — compact numbered squares */
                  <div className="wp-ep-grid">
                    {filteredEps.map(ep => {
                      const isActive = ep.number === episodeNum;
                      return (
                        <button key={ep.number} onClick={() => switchEpisode(ep.number)}
                          className={`wp-ep-grid-item ${isActive ? "active" : ""}`}>
                          {isActive && (
                            <div className="wp-ep-playing-indicator">
                              <span /><span /><span />
                            </div>
                          )}
                          <span className="wp-ep-num">{ep.number}</span>
                          {isActive && <span className="wp-ep-label">Playing</span>}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  /* LIST VIEW — horizontal rows with playing indicator */
                  <div className="wp-ep-list">
                    {filteredEps.map(ep => {
                      const isActive = ep.number === episodeNum;
                      return (
                        <button key={ep.number} onClick={() => switchEpisode(ep.number)}
                          className={`wp-ep-list-row ${isActive ? "active" : ""}`}>
                          <div className={`wp-ep-list-num ${isActive ? "active" : ""}`}>
                            {isActive ? (
                              <div className="wp-ep-bars"><span /><span /><span /></div>
                            ) : ep.number}
                          </div>
                          <div className="flex-1 min-w-0 text-left">
                            <p className={`text-[12px] font-semibold truncate ${isActive ? "text-white" : "text-white/50"}`}>
                              Episode {ep.number}
                            </p>
                            <p className="text-[9px] text-white/15 mt-0.5">
                              {isActive ? "Currently Playing" : animeTitle}
                            </p>
                          </div>
                          {isActive && (
                            <span className="wp-trans-badge bg-[#E63946]/15 text-[#E63946] border border-[#E63946]/25">
                              {translation.toUpperCase()}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )
              ) : (
                <div className="wp-ep-loading">
                  {Array.from({ length: 24 }, (_, i) => (
                    <div key={i} className="wp-ep-grid-skeleton" />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ─── INFO TAB ─── */}
          {activeTab === "info" && (
            <div className="wp-tab-content">
              <div className="wp-info-layout">
                {/* Poster */}
                {animeImage && (
                  <div className="wp-info-poster">
                    <div className="wp-info-poster-inner"
                      onClick={() => navigate({ page: "anime", id: anilistId ? String(anilistId) : animeId })}>
                      <img src={animeImage} alt={animeTitle} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 hover:opacity-100 transition-opacity flex items-end justify-center pb-3">
                        <span className="text-[10px] font-bold text-white/80 bg-white/10 px-3 py-1 rounded-full backdrop-blur-sm">View Details</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Info Content */}
                <div className="flex-1 min-w-0 space-y-4">
                  <div>
                    <h2 className="text-xl font-bold text-white leading-tight">{animeTitle}</h2>
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      {displayRating && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#FFB800]/10 border border-[#FFB800]/20">
                          <svg className="w-3.5 h-3.5 text-[#FFB800]" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                          <span className="text-[12px] font-bold text-[#FFB800]">{displayRating.toFixed(1)}</span>
                        </span>
                      )}
                      {animeStatus && (() => {
                        const sc = statusColor(animeStatus);
                        return (
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold rounded-full ${sc.bg} ${sc.text}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${animeStatus === "RELEASING" ? "bg-[#00D4AA] animate-pulse" : "bg-current"}`} />
                            {statusLabel(animeStatus)}
                          </span>
                        );
                      })()}
                      {animeType && (
                        <span className="px-2.5 py-1 text-[10px] font-bold rounded-full bg-white/[0.04] text-white/40 border border-white/[0.06]">{animeType}</span>
                      )}
                    </div>
                  </div>

                  {/* Metadata grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {animeSeason && (
                      <div className="wp-meta-item">
                        <svg className="w-4 h-4 text-white/20 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>
                        <span className="truncate">{animeSeason}</span>
                      </div>
                    )}
                    {animeEpisodes && (
                      <div className="wp-meta-item">
                        <svg className="w-4 h-4 text-white/20 shrink-0" fill="currentColor" viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3" /></svg>
                        <span>{animeEpisodes} Episodes</span>
                      </div>
                    )}
                    {animeDuration && (
                      <div className="wp-meta-item">
                        <svg className="w-4 h-4 text-white/20 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                        <span>{animeDuration} min</span>
                      </div>
                    )}
                    {animeStudios.length > 0 && (
                      <div className="wp-meta-item">
                        <svg className="w-4 h-4 text-white/20 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /></svg>
                        <span className="truncate">{animeStudios.join(", ")}</span>
                      </div>
                    )}
                  </div>

                  {/* Genre Tags */}
                  {tmdbGenres.length > 0 && (
                    <div className="flex gap-1.5 flex-wrap">
                      {tmdbGenres.slice(0, 8).map((genre, i) => (
                        <button key={i} onClick={() => navigate({ page: "genre", genre })}
                          className="wp-genre-tag">
                          {genre}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Synopsis */}
                  {animeDescription && (
                    <div>
                      <p className={`text-[12px] text-white/40 leading-relaxed ${!synopsisExpanded ? "line-clamp-3" : ""}`}>
                        {animeDescription}
                      </p>
                      {animeDescription.length > 150 && (
                        <button onClick={() => setSynopsisExpanded(!synopsisExpanded)}
                          className="text-[11px] font-semibold text-[#E63946] hover:text-[#E63946]/80 mt-1 transition-colors">
                          {synopsisExpanded ? "Show Less" : "Read More"}
                        </button>
                      )}
                    </div>
                  )}

                  {/* Next airing countdown */}
                  {animeNextAiring && countdown && (
                    <div className="wp-countdown-inline">
                      <div className="wp-countdown-dot" />
                      <span className="text-[11px] text-[#FF8C00]/60 font-semibold">Episode {animeNextAiring.episode} airs in</span>
                      <span className="text-[12px] font-extrabold text-[#FF8C00] tracking-wide font-mono">{countdown}</span>
                    </div>
                  )}

                  <button
                    onClick={() => navigate({ page: "anime", id: anilistId ? String(anilistId) : animeId })}
                    className="wp-btn-ghost text-[11px]"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    View Full Anime Details
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ─── RELATIONS TAB ─── */}
          {activeTab === "relations" && (
            <div className="wp-tab-content">
              {relations.length > 0 && (
                <div className="mb-6">
                  <h3 className="wp-section-heading">Related Anime</h3>
                  <div className="wp-card-row">
                    {relations.map((r, i) => {
                      const rTitle = r.title?.english || r.title?.romaji || "Unknown";
                      const rImg = r.coverImage?.extraLarge || r.coverImage?.large || r.coverImage?.medium || "";
                      const relType = r.relationType || "";
                      return (
                        <button key={`${r.id}-${i}`} onClick={() => navigate({ page: "anime", id: String(r.id) })} className="wp-card">
                          <div className="wp-card-poster">
                            {rImg ? <img src={rImg} alt={rTitle} className="w-full h-full object-cover" /> : (
                              <div className="w-full h-full bg-[#151821] flex items-center justify-center">
                                <svg className="w-6 h-6 text-white/10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14" /></svg>
                              </div>
                            )}
                            {/* Relationship tag — Animetsu style */}
                            {relType && (
                              <div className={`wp-card-badge ${relType === "SEQUEL" || relType === "PREQUEL" ? "accent" : ""}`}>
                                {relType}
                              </div>
                            )}
                          </div>
                          <div className="wp-card-info">
                            <p className="wp-card-title">{rTitle}</p>
                            <p className="wp-card-meta">{r.format || r.type || ""}{r.episodes ? ` · ${r.episodes} eps` : ""}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              {recommendations.length > 0 && (
                <div>
                  <h3 className="wp-section-heading">Recommendations</h3>
                  <div className="wp-card-row">
                    {recommendations.slice(0, 12).map(r => {
                      const rTitle = r.title?.english || r.title?.romaji || "Unknown";
                      const rImg = r.coverImage?.extraLarge || r.coverImage?.large || r.coverImage?.medium || "";
                      return (
                        <button key={r.id} onClick={() => navigate({ page: "anime", id: String(r.id) })} className="wp-card">
                          <div className="wp-card-poster">
                            {rImg ? <img src={rImg} alt={rTitle} className="w-full h-full object-cover" /> : (
                              <div className="w-full h-full bg-[#151821] flex items-center justify-center">
                                <svg className="w-6 h-6 text-white/10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14" /></svg>
                              </div>
                            )}
                            {r.averageScore && (
                              <div className="wp-card-score">
                                {r.averageScore > 10 ? Math.round(r.averageScore / 10) : r.averageScore}%
                              </div>
                            )}
                          </div>
                          <div className="wp-card-info">
                            <p className="wp-card-title">{rTitle}</p>
                            <p className="wp-card-meta">{r.type || ""}{r.episodes ? ` · ${r.episodes} eps` : ""}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              {relations.length === 0 && recommendations.length === 0 && (
                <div className="wp-empty-state">
                  <svg className="w-12 h-12 text-white/8 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                    <path d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                  </svg>
                  <p className="text-white/20 text-sm">No relations or recommendations yet</p>
                </div>
              )}
            </div>
          )}

          {/* ─── COMMENTS TAB ─── */}
          {activeTab === "comments" && (
            <div className="wp-tab-content">
              {/* Spoiler gate — Anime.nexus style */}
              {!commentsVisible ? (
                <div className="wp-spoiler-gate">
                  <div className="w-14 h-14 rounded-2xl bg-[#E63946]/8 border border-[#E63946]/15 flex items-center justify-center mx-auto mb-4">
                    <svg className="w-7 h-7 text-[#E63946]/50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  </div>
                  <h3 className="text-white/60 text-sm font-bold mb-1">Comments may contain spoilers</h3>
                  <p className="text-white/25 text-xs mb-4">Proceed at your own risk</p>
                  <button onClick={() => setCommentsVisible(true)} className="wp-btn-accent text-[11px]">
                    Show Comments
                  </button>
                </div>
              ) : (
                <>
                  {/* Comment Input */}
                  <div className="wp-comment-input-zone">
                    <div className="w-9 h-9 rounded-full bg-[#E63946]/10 border border-[#E63946]/15 flex items-center justify-center shrink-0">
                      <svg className="w-4 h-4 text-[#E63946]/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                    <div className="flex-1 space-y-2">
                      <textarea
                        value={commentText}
                        onChange={e => setCommentText(e.target.value)}
                        placeholder="Share your thoughts on this episode..."
                        className="wp-comment-textarea"
                      />
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] text-white/15">EP {episodeNum} Discussion</span>
                        {commentText.trim() && (
                          <button onClick={submitComment} className="wp-btn-accent-sm">Post</button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Comments List */}
                  <div className="space-y-2 mt-4">
                    {commentsLoading ? (
                      Array.from({ length: 3 }, (_, i) => (
                        <div key={i} className="wp-comment-skeleton">
                          <div className="w-8 h-8 rounded-full bg-[#151821] shrink-0" />
                          <div className="flex-1 space-y-2">
                            <div className="h-3 w-24 bg-[#151821] rounded" />
                            <div className="h-3 w-full bg-[#151821] rounded" />
                          </div>
                        </div>
                      ))
                    ) : comments.length > 0 ? (
                      comments.map(c => (
                        <div key={c.id} className="wp-comment-item">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#E63946]/15 to-[#E63946]/5 flex items-center justify-center shrink-0">
                            <span className="text-[10px] font-bold text-white/60">{(c.username || "A")[0].toUpperCase()}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="text-[11px] font-semibold text-white/70">{c.username || "Anonymous"}</span>
                              <span className="text-[9px] text-white/20">{c.createdAt ? new Date(c.createdAt).toLocaleDateString() : ""}</span>
                            </div>
                            <p className="text-[12px] text-white/40 leading-relaxed">{c.text}</p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="wp-empty-state">
                        <svg className="w-10 h-10 text-white/8 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                          <path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                        <p className="text-white/15 text-xs">No comments yet. Be the first!</p>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════
          KEYBOARD SHORTCUTS OVERLAY — Kuroiru/cmd+palette style
          ═══════════════════════════════════════════════════════ */}
      {showShortcuts && (
        <div className="wp-overlay" onClick={() => setShowShortcuts(false)}>
          <div className="wp-shortcuts-panel" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white/80 text-sm font-bold">Keyboard Shortcuts</h3>
              <button onClick={() => setShowShortcuts(false)} className="wp-icon-btn-sm">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="space-y-2">
              {[
                ["N", "Next Episode"],
                ["P", "Previous Episode"],
                ["?", "Toggle this panel"],
                ["Esc", "Close overlay"],
              ].map(([key, desc]) => (
                <div key={key} className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-white/[0.03]">
                  <span className="text-white/40 text-xs">{desc}</span>
                  <kbd className="wp-kbd">{key}</kbd>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
