"use client";

import { useState, useEffect, useCallback } from "react";
import { useAppStore } from "./store";
import HLSPlayerNew from "./hls-player-new";
import { getProviderDisplayName } from "@/lib/miruro-api";

// ============================================================
// WATCH PAGE — YumeZone-style native HLS.js player
// Replaces iframe embeds with native HLS streaming + provider fallback
// ============================================================

interface WatchPageProps {
  animeId: string;
  episodeNum: number;
}

interface StreamData {
  video_link: string;
  source_type: "hls" | "embed" | "mp4";
  hls_sources: Array<{
    url: string;
    quality: string;
    label: string;
    isM3U8: boolean;
    width?: number;
    height?: number;
  }>;
  embed_sources: Array<{
    url: string;
    quality: string;
    label: string;
    type: string;
  }>;
  subtitle_tracks: Array<{
    url: string;
    label: string;
    kind: "subtitles";
  }>;
  intro: { start: number; end: number } | null;
  outro: { start: number; end: number } | null;
  provider: string;
  available_qualities: string[];
  tried_providers?: string[];
  all_providers?: string[];
  _fallback?: boolean;
}

interface EpisodeItem {
  number: number;
  title: string;
  filler: boolean;
  id: string;
}

interface ProviderEpisodes {
  meta: { title: string };
  episodes: {
    sub: EpisodeItem[];
    dub: EpisodeItem[];
  };
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

type ContentTab = "episodes" | "info" | "relations";
type EpisodeSortOrder = "asc" | "desc";

const PROVIDER_PRIORITY = [
  "zenith", "kiwi", "ax-mimi", "ax-wave", "ax-shiro", "ax-yuki", "ax-zen", "ax-beep",
  "bee", "miku", "zoro", "arc", "jet",
];

export default function WatchPage({ animeId, episodeNum }: WatchPageProps) {
  const navigate = useAppStore(s => s.navigate);

  // ── AniList ID ──
  const parsedId = (() => {
    const cleanId = animeId.replace(/^miruro_/, "").replace(/^mal_/, "");
    if (/^\d+$/.test(cleanId)) return parseInt(cleanId);
    return null;
  })();
  const [anilistId, setAnilistId] = useState<number | null>(parsedId);

  // ── Stream State ──
  const [streamData, setStreamData] = useState<StreamData | null>(null);
  const [activeProvider, setActiveProvider] = useState("kiwi");
  const [translation, setTranslation] = useState<"sub" | "dub">("sub");
  const [availableProviders, setAvailableProviders] = useState<string[]>([]);
  const [failedProviders, setFailedProviders] = useState<Set<string>>(new Set());
  const [dubAvailable, setDubAvailable] = useState(false);
  const [streamLoading, setStreamLoading] = useState(true);
  const [streamError, setStreamError] = useState<string | null>(null);

  // ── Anime Data ──
  const [episodeList, setEpisodeList] = useState<EpisodeItem[]>([]);
  const [animeTitle, setAnimeTitle] = useState("");
  const [animeImage, setAnimeImage] = useState("");
  const [animeDescription, setAnimeDescription] = useState("");
  const [animeStatus, setAnimeStatus] = useState("");
  const [animeType, setAnimeType] = useState("");
  const [animeSeason, setAnimeSeason] = useState("");
  const [animeEpisodes, setAnimeEpisodes] = useState<number | null>(null);
  const [animeDuration, setAnimeDuration] = useState<number | null>(null);
  const [animeStudios, setAnimeStudios] = useState<string[]>([]);
  const [animeGenres, setAnimeGenres] = useState<string[]>([]);
  const [animeScore, setAnimeScore] = useState<number | null>(null);
  const [animeNextAiring, setAnimeNextAiring] = useState<{ episode: number; airingAt: number } | null>(null);

  // ── Providers Map ──
  const [providersMap, setProvidersMap] = useState<Record<string, ProviderEpisodes>>({});

  // ── UI State ──
  const [activeTab, setActiveTab] = useState<ContentTab>("episodes");
  const [epSortOrder, setEpSortOrder] = useState<EpisodeSortOrder>("asc");
  const [epSearch, setEpSearch] = useState("");
  const [synopsisExpanded, setSynopsisExpanded] = useState(false);
  const [autoNext, setAutoNext] = useState(true);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showUpNext, setShowUpNext] = useState(true);
  const [jumpToEp, setJumpToEp] = useState("");
  const [countdown, setCountdown] = useState("");

  // ── Relations ──
  const [relations, setRelations] = useState<RelationAnime[]>([]);

  // ── Callbacks (declared BEFORE effects that reference them) ──

  const switchEpisode = useCallback((epNum: number) => {
    navigate({ page: "watch", id: animeId, episode: epNum, title: animeTitle, image: animeImage });
  }, [navigate, animeId, animeTitle, animeImage]);

  const handleProviderFailed = useCallback((provider: string) => {
    setFailedProviders(prev => {
      const next = new Set(prev);
      next.add(provider);
      const nextProvider = availableProviders.find(p => !next.has(p) && p !== provider);
      if (nextProvider) {
        setActiveProvider(nextProvider);
      } else {
        setStreamError("All providers failed. Try refreshing the page.");
        setStreamLoading(false);
      }
      return next;
    });
  }, [availableProviders]);

  const handleProviderSelect = useCallback((provider: string) => {
    if (provider === activeProvider) return;
    setActiveProvider(provider);
    setFailedProviders(new Set());
    setStreamError(null);
  }, [activeProvider]);

  const handleTranslationChange = useCallback((t: "sub" | "dub") => {
    if (t === translation) return;
    setTranslation(t);
    setFailedProviders(new Set());
    setStreamError(null);
  }, [translation]);

  const handleVideoEnded = useCallback(() => {
    if (autoNext) {
      const nextEpNum = episodeNum + 1;
      if (episodeList.some(ep => ep.number === nextEpNum)) {
        switchEpisode(nextEpNum);
      }
    }
  }, [autoNext, episodeNum, episodeList, switchEpisode]);



  // ── Load anime info ──
  useEffect(() => {
    let cancelled = false;
    async function loadInfo() {
      try {
        const res = await fetch(`/api/anime/info?id=${encodeURIComponent(animeId)}`);
        if (cancelled) return;
        if (res.ok) {
          const data = await res.json();
          const info = data.anilistInfo;

          if (info) {
            setAnimeTitle(
              info.title?.english || info.title?.romaji || ""
            );
            setAnimeImage(
              info.coverImage?.extraLarge || info.coverImage?.large || ""
            );
            setAnimeDescription(
              info.description?.replace(/<[^>]*>/g, "") || ""
            );
            if (info.id && !anilistId) setAnilistId(info.id);
            if (info.status) setAnimeStatus(info.status);
            if (info.format) setAnimeType(info.format);
            if (info.season && info.seasonYear) setAnimeSeason(`${info.season} ${info.seasonYear}`);
            if (info.episodes) setAnimeEpisodes(info.episodes);
            if (info.duration) setAnimeDuration(info.duration);
            if (info.averageScore) setAnimeScore(info.averageScore);
            if (info.genres) setAnimeGenres(info.genres);
            if (info.studios?.nodes) {
              setAnimeStudios(
                info.studios.nodes
                  .filter((s: any) => s.isAnimationStudio)
                  .map((s: any) => s.name)
              );
            } else if (Array.isArray(info.studios) && info.studios[0]?.name) {
              setAnimeStudios(
                info.studios
                  .filter((s: any) => s.isAnimationStudio)
                  .map((s: any) => s.name)
              );
            }
            if (info.nextAiringEpisode) setAnimeNextAiring(info.nextAiringEpisode);
            if (data.nextAiringEpisode) setAnimeNextAiring(data.nextAiringEpisode);

            // Relations
            if (info.relations) {
              const relsRaw = Array.isArray(info.relations) && info.relations[0]?.relationType
                ? info.relations
                : (info.relations?.edges || []);
              if (relsRaw.length > 0) {
                setRelations(relsRaw.map((edge: any) => {
                  const node = edge.node || edge;
                  return {
                    relationType: edge.relationType,
                    id: node.id,
                    title: node.title,
                    coverImage: node.coverImage,
                    type: node.type,
                    format: node.format,
                    episodes: node.episodes,
                    status: node.status,
                  };
                }));
              }
            }
          }
        }
      } catch { /* ignore */ }
    }
    loadInfo();
    return () => { cancelled = true; };
  }, [animeId, anilistId]);

  // ── Load episodes from YumeZone API ──
  useEffect(() => {
    if (!anilistId) return;
    let cancelled = false;
    async function loadEpisodes() {
      try {
        const res = await fetch(`/api/anime/yumezone/episodes?anilistId=${anilistId}`);
        if (cancelled) return;
        if (res.ok) {
          const data = await res.json();
          if (data.episodes?.length) {
            setEpisodeList(data.episodes);
          }
          if (data.providersMap) {
            setProvidersMap(data.providersMap);
          }
          if (data.sortedProviders?.length) {
            setAvailableProviders(data.sortedProviders);
          } else if (data.allProviders?.length) {
            setAvailableProviders(data.allProviders);
          }
          if (data.defaultProvider) {
            setActiveProvider(data.defaultProvider);
          }
          setDubAvailable(data.dubAvailable || false);
        }
      } catch { /* ignore */ }
    }
    loadEpisodes();
    return () => { cancelled = true; };
  }, [anilistId]);

  // ── Fetch stream data when provider/episode/translation changes ──
  useEffect(() => {
    if (!anilistId) return;
    let cancelled = false;
    requestAnimationFrame(() => {
      setStreamLoading(true);
      setStreamError(null);
      setStreamData(null);
    });

    async function fetchStream() {
      try {
        const res = await fetch(
          `/api/anime/yumezone/watch?anilistId=${anilistId}&episode=${episodeNum}&provider=${activeProvider}&type=${translation}`
        );
        if (cancelled) return;
        if (res.ok) {
          const data: StreamData = await res.json();
          if ((data as any).error) {
            handleProviderFailed(activeProvider);
            return;
          }
          if (data.video_link || data.hls_sources?.length || data.embed_sources?.length) {
            setStreamData(data);
            setStreamLoading(false);
          } else {
            handleProviderFailed(activeProvider);
          }
        } else {
          handleProviderFailed(activeProvider);
        }
      } catch {
        if (!cancelled) {
          handleProviderFailed(activeProvider);
        }
      }
    }
    fetchStream();
    return () => { cancelled = true; };
  }, [anilistId, episodeNum, activeProvider, translation, handleProviderFailed]);

  // ── Next airing countdown ──
  useEffect(() => {
    if (!animeNextAiring) return;
    function update() {
      const now = Math.floor(Date.now() / 1000);
      const diff = (animeNextAiring as { episode: number; airingAt: number }).airingAt - now;
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

  // ── Keyboard shortcuts ──
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;

      if (e.key === "?" && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setShowShortcuts(prev => !prev);
      }
      if (e.key === "Escape") setShowShortcuts(false);

      if (e.key === "n" && !e.ctrlKey && !e.metaKey) {
        const nextEpNum = episodeNum + 1;
        if (episodeList.some(ep => ep.number === nextEpNum)) {
          switchEpisode(nextEpNum);
        }
      }
      if (e.key === "p" && !e.ctrlKey && !e.metaKey) {
        if (episodeNum > 1) switchEpisode(episodeNum - 1);
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [episodeNum, episodeList, switchEpisode]);

  // ── Computed ──
  const prevEp = episodeNum > 1 ? episodeNum - 1 : null;
  const nextEp = episodeList.some(e => e.number === episodeNum + 1) ? episodeNum + 1 : null;

  const searchLower = epSearch.toLowerCase();
  const filteredEps = episodeList
    .filter(ep => !epSearch || String(ep.number).includes(searchLower))
    .sort((a, b) => epSortOrder === "asc" ? a.number - b.number : b.number - a.number);

  const statusLabel = (s: string) => {
    if (s === "RELEASING") return "Airing";
    if (s === "FINISHED") return "Complete";
    if (s === "NOT_YET_RELEASED") return "Upcoming";
    return s;
  };

  const statusColor = (s: string) => {
    if (s === "RELEASING") return "text-[#10B981]";
    if (s === "FINISHED") return "text-[#6366F1]";
    if (s === "NOT_YET_RELEASED") return "text-[#F59E0B]";
    return "text-[#64748B]";
  };

  // ── Get providers that have current episode ──
  const providersForCurrentEp = availableProviders.filter(p => {
    const pData = providersMap[p];
    if (!pData?.episodes) return false;
    const eps = translation === "dub" ? pData.episodes.dub : pData.episodes.sub;
    return eps.some(e => e.number === episodeNum);
  });

  // ── RENDER ──
  return (
    <div className="min-h-screen bg-[#0F1219]">

      {/* ─── PLAYER ZONE ─── */}
      <div className="w-full" style={{ maxWidth: "100vw" }}>
        <div className="relative w-full bg-black" style={{ aspectRatio: "16 / 9" }}>

          {/* HLS Native Player */}
          {streamData && streamData.source_type === "hls" && streamData.video_link && (
            <HLSPlayerNew
              key={`${activeProvider}-${episodeNum}-${translation}`}
              url={streamData.video_link}
              animeId={animeId}
              episodeNum={episodeNum}
              sourceType="hls"
              intro={streamData.intro}
              outro={streamData.outro}
              allStreams={streamData.hls_sources.map(s => ({
                url: s.url,
                quality: s.quality || "Auto",
                label: s.label || s.quality || "Auto",
              }))}
              onEnded={handleVideoEnded}
              onProviderFailed={() => handleProviderFailed(activeProvider)}
              autoplay={true}
            />
          )}

          {/* Embed Player (for Megaplay/Hindi embeds) */}
          {streamData && streamData.source_type === "embed" && streamData.video_link && (
            <iframe
              key={`embed-${activeProvider}-${episodeNum}-${translation}`}
              src={streamData.video_link}
              className="absolute inset-0 w-full h-full border-0"
              allowFullScreen
              allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
              referrerPolicy="no-referrer"
              title={`${animeTitle} - Episode ${episodeNum}`}
            />
          )}

          {/* Loading state */}
          {streamLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-[#0F1219] z-20">
              <div className="text-center space-y-4">
                <div className="w-12 h-12 border-[3px] border-white/10 border-t-[#8B5CF6] rounded-full animate-spin mx-auto" />
                <p className="text-[#94A3B8] text-xs font-medium tracking-wide">
                  Loading from <span className="text-[#8B5CF6]">{getProviderDisplayName(activeProvider)}</span>...
                </p>
              </div>
            </div>
          )}

          {/* Error state */}
          {streamError && !streamLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-[#0F1219] z-20">
              <div className="text-center space-y-4 max-w-sm px-6">
                <div className="w-14 h-14 rounded-xl bg-[#EF4444]/10 border border-[#EF4444]/20 flex items-center justify-center mx-auto">
                  <svg className="w-7 h-7 text-[#EF4444]/70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <p className="text-[#E2E8F0] text-sm">{streamError}</p>
                <button
                  onClick={() => {
                    setFailedProviders(new Set());
                    setStreamError(null);
                    setActiveProvider(providersForCurrentEp[0] || availableProviders[0] || "kiwi");
                  }}
                  className="px-5 py-2 rounded-lg bg-[#8B5CF6] text-white text-sm font-medium hover:bg-[#7C3AED] transition-colors"
                >
                  Retry
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ─── CONTENT AREA ─── */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pb-12">

        {/* ─── TITLE BAR ─── */}
        <div className="py-4 border-b border-white/[0.06]">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#8B5CF6]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#8B5CF6] animate-pulse" />
                  Now Playing
                </span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  translation === "sub"
                    ? "bg-[#8B5CF6]/15 text-[#8B5CF6]"
                    : "bg-[#EF4444]/15 text-[#EF4444]"
                }`}>
                  {translation.toUpperCase()}
                </span>
                {streamData && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-white/[0.05] text-[#94A3B8]">
                    {getProviderDisplayName(streamData.provider)}
                  </span>
                )}
              </div>
              <h1 className="text-lg sm:text-xl font-bold text-[#E2E8F0] truncate">{animeTitle}</h1>
              <p className="text-sm text-[#94A3B8] mt-0.5">
                Episode {episodeNum}{animeEpisodes ? ` of ${animeEpisodes}` : ""}
                {animeDuration && ` - ${animeDuration}min`}
                {animeStatus === "RELEASING" && (
                  <span className="inline-flex items-center gap-1.5 ml-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-pulse" />
                    <span className="text-[#10B981]">Airing</span>
                  </span>
                )}
              </p>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-1.5 shrink-0">
              {prevEp && (
                <button
                  onClick={() => switchEpisode(prevEp)}
                  className="p-2 rounded-lg bg-white/[0.05] text-[#94A3B8] hover:bg-white/[0.08] hover:text-white transition-colors"
                  title="Previous Episode (P)"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
              )}
              {nextEp && (
                <button
                  onClick={() => switchEpisode(nextEp)}
                  className="p-2 rounded-lg bg-white/[0.05] text-[#94A3B8] hover:bg-white/[0.08] hover:text-white transition-colors"
                  title="Next Episode (N)"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              )}
              <div className="w-px h-5 bg-white/[0.06] mx-1" />
              <button
                onClick={() => setAutoNext(!autoNext)}
                className={`p-2 rounded-lg transition-colors ${
                  autoNext
                    ? "bg-[#8B5CF6]/15 text-[#8B5CF6]"
                    : "bg-white/[0.05] text-[#64748B] hover:text-[#94A3B8]"
                }`}
                title={`Auto Next: ${autoNext ? "ON" : "OFF"}`}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </button>
              <button
                onClick={() => setShowShortcuts(!showShortcuts)}
                className="p-2 rounded-lg bg-white/[0.05] text-[#64748B] hover:bg-white/[0.08] hover:text-[#94A3B8] transition-colors"
                title="Keyboard Shortcuts (?)"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <rect x="2" y="6" width="20" height="12" rx="2" />
                  <path d="M6 12h.01M10 12h.01M14 12h.01M18 12h.01M8 16h8" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* ─── UP NEXT CARD ─── */}
        {showUpNext && nextEp && animeTitle && (
          <div className="mt-3 flex items-center justify-between gap-3 p-3 rounded-lg bg-[#161B26] border border-[rgba(139,92,246,0.12)]">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-lg bg-[#8B5CF6]/10 flex items-center justify-center shrink-0">
                <svg className="w-4 h-4 text-[#8B5CF6]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-[#E2E8F0] truncate">Up Next: Episode {nextEp}</p>
                <p className="text-[10px] text-[#64748B] truncate">{animeTitle}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => switchEpisode(nextEp)}
                className="px-3 py-1.5 rounded-md bg-[#8B5CF6] text-white text-xs font-semibold hover:bg-[#7C3AED] transition-colors"
              >
                Play
              </button>
              <button
                onClick={() => setShowUpNext(false)}
                className="p-1 rounded text-[#64748B] hover:text-[#94A3B8] transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* ─── SERVER SELECTOR ─── */}
        <div className="mt-4 flex flex-col gap-3">
          {/* SUB/DUB Toggle */}
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg overflow-hidden border border-[rgba(139,92,246,0.12)]">
              <button
                onClick={() => handleTranslationChange("sub")}
                className={`px-4 py-1.5 text-xs font-bold transition-colors ${
                  translation === "sub"
                    ? "bg-[#8B5CF6] text-white"
                    : "bg-[#161B26] text-[#94A3B8] hover:text-[#E2E8F0]"
                }`}
              >
                SUB
              </button>
              <button
                onClick={() => handleTranslationChange("dub")}
                className={`px-4 py-1.5 text-xs font-bold transition-colors ${
                  translation === "dub"
                    ? "bg-[#8B5CF6] text-white"
                    : "bg-[#161B26] text-[#94A3B8] hover:text-[#E2E8F0]"
                } ${!dubAvailable ? "opacity-40 cursor-not-allowed" : ""}`}
                disabled={!dubAvailable}
              >
                DUB
              </button>
            </div>
          </div>

          {/* Provider Pills */}
          {providersForCurrentEp.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-semibold text-[#64748B] uppercase tracking-wider mr-1">Server</span>
              {providersForCurrentEp.map(p => (
                <button
                  key={p}
                  onClick={() => handleProviderSelect(p)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    activeProvider === p
                      ? "bg-[#8B5CF6] text-white"
                      : failedProviders.has(p)
                        ? "bg-white/[0.03] text-[#64748B]/50 line-through cursor-not-allowed"
                        : "bg-white/[0.05] text-[#94A3B8] hover:bg-white/[0.08] hover:text-white"
                  }`}
                  disabled={failedProviders.has(p)}
                >
                  {getProviderDisplayName(p)}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ─── NEXT AIRING COUNTDOWN ─── */}
        {animeNextAiring && countdown && (
          <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-lg bg-[#F59E0B]/5 border border-[#F59E0B]/10">
            <span className="w-1.5 h-1.5 rounded-full bg-[#F59E0B] animate-pulse" />
            <span className="text-xs text-[#F59E0B]/80 font-semibold">
              Episode {animeNextAiring.episode} airs in
            </span>
            <span className="text-xs font-extrabold text-[#F59E0B] tracking-wide font-mono">
              {countdown}
            </span>
          </div>
        )}

        {/* ─── TABBED CONTENT ─── */}
        <div className="mt-6">
          {/* Tab Bar */}
          <div className="flex items-center gap-1 border-b border-white/[0.06] mb-4">
            {(["episodes", "info", "relations"] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2.5 text-sm font-medium transition-colors relative ${
                  activeTab === tab
                    ? "text-[#8B5CF6]"
                    : "text-[#64748B] hover:text-[#94A3B8]"
                }`}
              >
                {tab === "episodes" && (
                  <span className="flex items-center gap-1.5">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
                    </svg>
                    Episodes
                    {episodeList.length > 0 && (
                      <span className="ml-1 px-1.5 py-0.5 rounded text-[10px] bg-white/[0.05] text-[#64748B]">
                        {episodeList.length}
                      </span>
                    )}
                  </span>
                )}
                {tab === "info" && (
                  <span className="flex items-center gap-1.5">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <circle cx="12" cy="12" r="10" /><path d="M12 16v-4m0-4h.01" />
                    </svg>
                    Info
                  </span>
                )}
                {tab === "relations" && (
                  <span className="flex items-center gap-1.5">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101" />
                      <path d="M10.172 13.828a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                    </svg>
                    Relations
                    {relations.length > 0 && (
                      <span className="ml-1 px-1.5 py-0.5 rounded text-[10px] bg-white/[0.05] text-[#64748B]">
                        {relations.length}
                      </span>
                    )}
                  </span>
                )}
                {activeTab === tab && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#8B5CF6] rounded-full" />
                )}
              </button>
            ))}
          </div>

          {/* ─── EPISODES TAB ─── */}
          {activeTab === "episodes" && (
            <div>
              {/* Controls */}
              <div className="flex items-center gap-2 mb-4 flex-wrap">
                {/* Search */}
                <div className="relative flex-1 max-w-[200px]">
                  <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#64748B]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
                  </svg>
                  <input
                    type="text"
                    value={epSearch}
                    onChange={e => setEpSearch(e.target.value)}
                    placeholder="Search ep..."
                    className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-[#161B26] border border-[rgba(139,92,246,0.12)] text-xs text-[#E2E8F0] placeholder-[#64748B] focus:outline-none focus:border-[#8B5CF6]/30"
                  />
                </div>

                {/* Jump to episode */}
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min={1}
                    max={animeEpisodes || episodeList.length || 999}
                    value={jumpToEp}
                    onChange={e => setJumpToEp(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === "Enter" && jumpToEp) {
                        const epNum = parseInt(jumpToEp);
                        if (episodeList.some(ep => ep.number === epNum)) {
                          switchEpisode(epNum);
                          setJumpToEp("");
                        }
                      }
                    }}
                    placeholder="Go to ep"
                    className="w-20 px-2 py-1.5 rounded-lg bg-[#161B26] border border-[rgba(139,92,246,0.12)] text-xs text-[#E2E8F0] placeholder-[#64748B] focus:outline-none focus:border-[#8B5CF6]/30"
                  />
                  <button
                    onClick={() => {
                      if (jumpToEp) {
                        const epNum = parseInt(jumpToEp);
                        if (episodeList.some(ep => ep.number === epNum)) {
                          switchEpisode(epNum);
                          setJumpToEp("");
                        }
                      }
                    }}
                    className="px-2.5 py-1.5 rounded-lg bg-[#8B5CF6] text-white text-xs font-medium hover:bg-[#7C3AED] transition-colors"
                  >
                    Go
                  </button>
                </div>

                {/* Sort */}
                <button
                  onClick={() => setEpSortOrder(prev => prev === "asc" ? "desc" : "asc")}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#161B26] border border-[rgba(139,92,246,0.12)] text-xs text-[#94A3B8] hover:text-white transition-colors"
                >
                  <svg className={`w-3.5 h-3.5 transition-transform ${epSortOrder === "desc" ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
                  </svg>
                  {epSortOrder === "asc" ? "1 -> 24" : "24 -> 1"}
                </button>
              </div>

              {/* Episode Grid */}
              {filteredEps.length > 0 ? (
                <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12 gap-1.5">
                  {filteredEps.map(ep => {
                    const isActive = ep.number === episodeNum;
                    return (
                      <button
                        key={ep.number}
                        onClick={() => switchEpisode(ep.number)}
                        className={`relative px-2 py-2 rounded-lg text-xs font-medium transition-colors text-center ${
                          isActive
                            ? "bg-[#8B5CF6] text-white shadow-lg shadow-[#8B5CF6]/20"
                            : ep.filler
                              ? "bg-[#F59E0B]/5 text-[#F59E0B]/70 border border-[#F59E0B]/10 hover:bg-[#F59E0B]/10"
                              : "bg-[#161B26] text-[#94A3B8] border border-[rgba(139,92,246,0.08)] hover:bg-white/[0.08] hover:text-white"
                        }`}
                        title={ep.filler ? `Ep ${ep.number} (Filler)` : `Episode ${ep.number}`}
                      >
                        {ep.number}
                        {ep.filler && (
                          <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-[#F59E0B]/50" />
                        )}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="py-12 text-center">
                  <p className="text-[#64748B] text-sm">
                    {episodeList.length === 0 ? "Loading episodes..." : "No episodes found"}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ─── INFO TAB ─── */}
          {activeTab === "info" && (
            <div className="space-y-5">
              {/* Cover + Info */}
              <div className="flex gap-4 sm:gap-6">
                {animeImage && (
                  <div className="shrink-0 w-28 sm:w-36 rounded-lg overflow-hidden border border-[rgba(139,92,246,0.12)]">
                    <img
                      src={animeImage}
                      alt={animeTitle}
                      className="w-full h-auto object-cover"
                      loading="lazy"
                    />
                  </div>
                )}
                <div className="flex-1 min-w-0 space-y-3">
                  <h2 className="text-lg font-bold text-[#E2E8F0]">{animeTitle}</h2>

                  {/* Metadata pills */}
                  <div className="flex flex-wrap gap-2">
                    {animeStatus && (
                      <span className={`px-2.5 py-1 rounded-md text-[11px] font-semibold bg-white/[0.05] ${statusColor(animeStatus)}`}>
                        {statusLabel(animeStatus)}
                      </span>
                    )}
                    {animeType && (
                      <span className="px-2.5 py-1 rounded-md text-[11px] font-medium bg-white/[0.05] text-[#94A3B8]">
                        {animeType}
                      </span>
                    )}
                    {animeSeason && (
                      <span className="px-2.5 py-1 rounded-md text-[11px] font-medium bg-white/[0.05] text-[#94A3B8]">
                        {animeSeason}
                      </span>
                    )}
                    {animeEpisodes && (
                      <span className="px-2.5 py-1 rounded-md text-[11px] font-medium bg-white/[0.05] text-[#94A3B8]">
                        {animeEpisodes} Episodes
                      </span>
                    )}
                    {animeDuration && (
                      <span className="px-2.5 py-1 rounded-md text-[11px] font-medium bg-white/[0.05] text-[#94A3B8]">
                        {animeDuration} min/ep
                      </span>
                    )}
                    {animeScore && (
                      <span className="px-2.5 py-1 rounded-md text-[11px] font-semibold bg-[#8B5CF6]/10 text-[#8B5CF6]">
                        {animeScore > 10 ? Math.round(animeScore) : animeScore}%
                      </span>
                    )}
                  </div>

                  {/* Studios */}
                  {animeStudios.length > 0 && (
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">Studio</span>
                      <span className="text-sm text-[#94A3B8]">{animeStudios.join(", ")}</span>
                    </div>
                  )}

                  {/* Genres */}
                  {animeGenres.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {animeGenres.map(g => (
                        <span key={g} className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-white/[0.05] text-[#94A3B8] border border-white/[0.05]">
                          {g}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Synopsis */}
              {animeDescription && (
                <div>
                  <h3 className="text-sm font-semibold text-[#E2E8F0] mb-2">Synopsis</h3>
                  <p className={`text-sm text-[#94A3B8] leading-relaxed ${!synopsisExpanded ? "line-clamp-4" : ""}`}>
                    {animeDescription}
                  </p>
                  {animeDescription.length > 200 && (
                    <button
                      onClick={() => setSynopsisExpanded(!synopsisExpanded)}
                      className="mt-1 text-xs font-medium text-[#8B5CF6] hover:text-[#7C3AED] transition-colors"
                    >
                      {synopsisExpanded ? "Show less" : "Read more"}
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ─── RELATIONS TAB ─── */}
          {activeTab === "relations" && (
            <div>
              {relations.length > 0 ? (
                <div className="space-y-2">
                  {relations.map((rel, idx) => {
                    const relTitle = rel.title?.english || rel.title?.romaji || rel.title?.native || "Unknown";
                    const relImage = rel.coverImage?.extraLarge || rel.coverImage?.large || rel.coverImage?.medium || "";
                    return (
                      <button
                        key={`${rel.id}-${idx}`}
                        onClick={() => navigate({ page: "anime", id: String(rel.id) })}
                        className="flex items-center gap-3 w-full p-3 rounded-lg bg-[#161B26] border border-[rgba(139,92,246,0.08)] hover:bg-white/[0.06] transition-colors text-left"
                      >
                        {relImage ? (
                          <img
                            src={relImage}
                            alt={relTitle}
                            className="w-12 h-16 rounded object-cover shrink-0"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-12 h-16 rounded bg-white/[0.05] shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-[#E2E8F0] truncate">{relTitle}</p>
                          <div className="flex items-center gap-2 mt-1">
                            {rel.relationType && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#8B5CF6]/10 text-[#8B5CF6]">
                                {rel.relationType}
                              </span>
                            )}
                            {rel.format && (
                              <span className="text-[11px] text-[#64748B]">{rel.format}</span>
                            )}
                            {rel.episodes && (
                              <span className="text-[11px] text-[#64748B]">{rel.episodes} eps</span>
                            )}
                            {rel.status && (
                              <span className={`text-[11px] ${statusColor(rel.status)}`}>
                                {statusLabel(rel.status)}
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="py-12 text-center">
                  <p className="text-[#64748B] text-sm">No relations found</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ─── KEYBOARD SHORTCUTS PANEL ─── */}
      {showShortcuts && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowShortcuts(false)}>
          <div
            className="w-full max-w-sm mx-4 rounded-xl bg-[#161B26] border border-[rgba(139,92,246,0.12)] shadow-2xl overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
              <h3 className="text-sm font-bold text-[#E2E8F0]">Keyboard Shortcuts</h3>
              <button
                onClick={() => setShowShortcuts(false)}
                className="p-1 rounded text-[#64748B] hover:text-white transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-5 space-y-3">
              {[
                { key: "N", desc: "Next episode" },
                { key: "P", desc: "Previous episode" },
                { key: "Space / K", desc: "Play / Pause" },
                { key: "F", desc: "Fullscreen" },
                { key: "M", desc: "Mute / Unmute" },
                { key: "Left Arrow", desc: "Seek -10s" },
                { key: "Right Arrow", desc: "Seek +10s" },
                { key: "Up Arrow", desc: "Volume up" },
                { key: "Down Arrow", desc: "Volume down" },
                { key: "?", desc: "Toggle this panel" },
                { key: "Esc", desc: "Close this panel" },
              ].map(s => (
                <div key={s.key} className="flex items-center justify-between">
                  <span className="text-xs text-[#94A3B8]">{s.desc}</span>
                  <kbd className="px-2 py-0.5 rounded bg-white/[0.08] text-[10px] font-mono font-bold text-[#E2E8F0] border border-white/[0.06]">
                    {s.key}
                  </kbd>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
