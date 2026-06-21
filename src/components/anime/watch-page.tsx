"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useAppStore } from "./store";
import HLSPlayerNew from "./hls-player-new";
import { getProviderDisplayName } from "@/lib/miruro-api";

// ============================================================
// WATCH PAGE — Redesigned layout
// Player → Title/Nav → Tabs (Episodes/Info/Relations) → Servers
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

// ── Embed Player with auto-fallback on 410/dead links ──
// If the embed source returns a dead page (410 Gone, etc.), shows a "switch server" overlay
function EmbedPlayerWithFallback({
  src,
  animeTitle,
  episodeNum,
  provider,
  providersForCurrentEp,
  failedProviders,
  onProviderFailed,
  onProviderSelect,
  getProviderDisplayName,
}: {
  src: string;
  animeTitle: string;
  episodeNum: number;
  provider: string;
  providersForCurrentEp: string[];
  failedProviders: Set<string>;
  onProviderFailed: (p: string) => void;
  onProviderSelect: (p: string) => void;
  getProviderDisplayName: (p: string) => string;
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [embedFailed, setEmbedFailed] = useState(false);
  const [showServerOverlay, setShowServerOverlay] = useState(false);

  // Detect iframe load failure — embed sources often return 410 Gone
  useEffect(() => {
    const timer = setTimeout(() => {
      // After 8 seconds, if iframe loaded but content might be dead,
      // show the switch server button as a floating hint
      setShowServerOverlay(true);
    }, 8000);
    return () => clearTimeout(timer);
  }, [src]);

  const handleIframeLoad = useCallback(() => {
    // We can't read iframe content due to cross-origin, but we can
    // check if the URL might be a dead embed by doing a HEAD request
    try {
      fetch(src, { method: "HEAD", mode: "no-cors" }).catch(() => {});
    } catch {}
  }, [src]);

  const handleEmbedError = useCallback(() => {
    setEmbedFailed(true);
    onProviderFailed(provider);
  }, [provider, onProviderFailed]);

  const otherProviders = providersForCurrentEp.filter(
    p => p !== provider && !failedProviders.has(p)
  );

  if (embedFailed) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-[#0a0a0f] z-20">
        <div className="text-center space-y-4 max-w-sm px-6">
          <div className="w-12 h-12 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto">
            <svg className="w-6 h-6 text-red-400/70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <p className="text-zinc-300 text-sm">This embed source is unavailable (410 Gone)</p>
          {otherProviders.length > 0 ? (
            <div className="flex flex-wrap gap-2 justify-center">
              {otherProviders.map(p => (
                <button
                  key={p}
                  onClick={() => onProviderSelect(p)}
                  className="px-3 py-1.5 rounded-lg bg-[#D4A017] text-black text-xs font-bold hover:bg-[#c49515] transition-colors"
                >
                  Try {getProviderDisplayName(p)}
                </button>
              ))}
            </div>
          ) : (
            <button
              onClick={() => window.location.reload()}
              className="px-5 py-2 rounded-lg bg-[#D4A017] text-black text-sm font-bold hover:bg-[#c49515] transition-colors"
            >
              Refresh Page
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="absolute inset-0">
      <iframe
        ref={iframeRef}
        src={src}
        className="w-full h-full border-0"
        allowFullScreen
        allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
        referrerPolicy="no-referrer"
        title={`${animeTitle} - Episode ${episodeNum}`}
        onLoad={handleIframeLoad}
        onError={handleEmbedError}
      />
      {/* Floating "embed dead?" overlay — shows after 8s so user can switch servers */}
      {showServerOverlay && otherProviders.length > 0 && (
        <div className="absolute top-3 right-3 z-30">
          <div className="flex items-center gap-2 bg-black/80 backdrop-blur-md rounded-lg border border-white/[0.08] px-3 py-2 shadow-xl">
            <span className="text-[10px] text-zinc-400">Embed not working?</span>
            {otherProviders.slice(0, 3).map(p => (
              <button
                key={p}
                onClick={() => onProviderSelect(p)}
                className="px-2.5 py-1 rounded-md bg-[#D4A017] text-black text-[10px] font-bold hover:bg-[#c49515] transition-colors"
              >
                {getProviderDisplayName(p)}
              </button>
            ))}
            <button
              onClick={() => setShowServerOverlay(false)}
              className="p-1 text-zinc-500 hover:text-white transition-colors"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

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

  // ── Server List (Miruro + Animex + AniVault — ALL verified) ──
  interface ServerEntry {
    id: string;
    name: string;
    source: "miruro" | "animex" | "anivault";
    provider: string;
    type: "sub" | "dub";
    quality?: string;
    streamUrl?: string;
    isM3U8?: boolean;
    isMP4?: boolean;
  }
  const [serverList, setServerList] = useState<ServerEntry[]>([]);
  const [selectedServer, setSelectedServer] = useState<string>(""); // server id

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
  const [jumpToEp, setJumpToEp] = useState("");
  const [countdown, setCountdown] = useState("");

  // ── Relations ──
  const [relations, setRelations] = useState<RelationAnime[]>([]);

  // ── Callbacks (declared BEFORE effects that reference them) ──

  const switchEpisode = useCallback((epNum: number) => {
    navigate({ page: "watch", id: animeId, episode: epNum, title: animeTitle, image: animeImage });
  }, [navigate, animeId, animeTitle, animeImage]);

  // ── Scraper fallback state (now used as a simple retry token) ──
  const [scraperFallbackToken, setScraperFallbackToken] = useState(0);
  const [scraperSitesTried, setScraperSitesTried] = useState<string[]>([]);

  const handleProviderFailed = useCallback((_provider: string) => {
    // Simple retry — re-fetch from Miruro direct
    // (miruro-direct tries all 12 providers internally, so a retry may pick a different one)
    setStreamError("Stream failed. Retrying...");
    setStreamLoading(true);
    setScraperFallbackToken(t => t + 1);
  }, []);

  // ── Scraper retry effect: fires when handleProviderFailed triggers ──
  useEffect(() => {
    if (!scraperFallbackToken || !anilistId) return;
    let cancelled = false;

    async function retryStream() {
      try {
        const res = await fetch(
          `/api/anime/scraper/miruro-direct/${anilistId}/${episodeNum}?type=${translation}`
        );
        if (cancelled) return;
        if (res.ok) {
          const data = await res.json();
          if (data.url) {
            const streamData: StreamData = {
              video_link: data.url,
              source_type: data.sourceType === "mp4" ? "mp4" : "hls",
              hls_sources: [{
                url: data.url,
                quality: data.quality || "Auto",
                label: `Miruro ${data.provider} ${data.quality || ""}`.trim(),
                isM3U8: data.isM3U8 ?? true,
              }],
              embed_sources: [],
              subtitle_tracks: (data.subtitles || []).map((s: any) => ({
                url: s.url,
                label: s.language || s.lang || "English",
                kind: "subtitles" as const,
              })),
              intro: data.intro || null,
              outro: data.outro || null,
              provider: data.provider,
              available_qualities: [data.quality || "Auto"],
              tried_providers: data.triedProviders,
              all_providers: data.triedProviders,
            };
            setStreamData(streamData);
            setStreamLoading(false);
            setStreamError(null);
            return;
          }
        }
        if (!cancelled) {
          setStreamError("No stream available from Miruro. Try another episode.");
          setStreamLoading(false);
        }
      } catch {
        if (!cancelled) {
          setStreamError("Failed to load stream. Try refreshing the page.");
          setStreamLoading(false);
        }
      }
    }

    retryStream();
    return () => { cancelled = true; };
  }, [scraperFallbackToken, anilistId, episodeNum, translation]);

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

  // ── Load episodes DIRECTLY from miruro.tv (no external API) ──
  // Hits www.miruro.tv/api/secure/pipe via our /api/anime/miruro-direct/episodes route.
  // Returns sub + dub episode lists from all 12 Miruro providers (kiwi, bee, bonk, etc.)
  useEffect(() => {
    if (!anilistId) return;
    let cancelled = false;
    async function loadEpisodes() {
      try {
        const res = await fetch(`/api/anime/miruro-direct/episodes/${anilistId}`);
        if (cancelled) return;
        if (res.ok) {
          const data = await res.json();
          // Merge sub + dub into a unified episode list
          const subEps = data.sub || [];
          const dubEps = data.dub || [];
          const all = new Map<number, EpisodeItem>();
          for (const ep of subEps) {
            all.set(Number(ep.number), {
              number: Number(ep.number),
              title: ep.title || `Episode ${ep.number}`,
              filler: !!ep.isFiller || !!ep.filler,
              id: ep.id || ep.slug || String(ep.number),
            });
          }
          for (const ep of dubEps) {
            const num = Number(ep.number);
            if (!all.has(num)) {
              all.set(num, {
                number: num,
                title: ep.title || `Episode ${ep.number}`,
                filler: !!ep.isFiller || !!ep.filler,
                id: ep.id || ep.slug || String(ep.number),
              });
            }
          }
          const episodes = Array.from(all.values()).sort((a, b) => a.number - b.number);
          if (episodes.length > 0) {
            setEpisodeList(episodes);
          }
          if (data.providers?.length) {
            setAvailableProviders(data.providers);
          }
          if (data.defaultProvider) {
            setActiveProvider(data.defaultProvider);
          }
          setDubAvailable(dubEps.length > 0);
        }
      } catch { /* ignore */ }
    }
    loadEpisodes();
    return () => { cancelled = true; };
  }, [anilistId]);

  // ── Fetch stream DIRECTLY from miruro.tv (no external API, no fallback chain) ──
  // Single source of truth: /api/anime/scraper/miruro-direct/{anilistId}/{episode}
  // This hits www.miruro.tv/api/secure/pipe, tries all 12 providers (kiwi, bee, bonk...),
  // and returns the first playable m3u8 wrapped through our stream proxy.
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
          `/api/anime/scraper/miruro-direct/${anilistId}/${episodeNum}?type=${translation}`
        );
        if (cancelled) return;
        if (res.ok) {
          const data = await res.json();
          if (data.url) {
            // Build a StreamData-compatible object for the HLS player
            const streamData: StreamData = {
              video_link: data.url,                // already wrapped through /api/anime/scraper/stream
              source_type: data.sourceType === "mp4" ? "mp4" : "hls",
              hls_sources: [
                {
                  url: data.url,
                  quality: data.quality || "Auto",
                  label: `Miruro ${data.provider} ${data.quality || ""}`.trim(),
                  isM3U8: data.isM3U8 ?? true,
                },
              ],
              embed_sources: [],
              subtitle_tracks: (data.subtitles || []).map((s: any) => ({
                url: s.url,
                label: s.language || s.lang || "English",
                kind: "subtitles" as const,
              })),
              intro: data.intro || null,
              outro: data.outro || null,
              provider: data.provider,
              available_qualities: [data.quality || "Auto"],
              tried_providers: data.triedProviders,
              all_providers: data.triedProviders,
            };
            console.log(`[WatchPage] Playing via Miruro direct: ${data.provider}`);
            setStreamData(streamData);
            setStreamLoading(false);
            return;
          }
        }
        // Miruro direct returned no playable source
        if (!cancelled) {
          setStreamError("No stream available from Miruro. Try another episode.");
          setStreamLoading(false);
        }
      } catch (err: any) {
        if (!cancelled) {
          console.error("[WatchPage] Miruro direct failed:", err);
          setStreamError("Failed to load stream. Check your connection.");
          setStreamLoading(false);
        }
      }
    }
    fetchStream();
    return () => { cancelled = true; };
  }, [anilistId, episodeNum, translation]);

  // ── Fetch VERIFIED server list (all streams checked in parallel) ──
  // Takes ~4s but every server shown WILL play. No dead servers.
  // Each server includes a ready-to-play streamUrl — switching is instant.
  useEffect(() => {
    if (!anilistId) return;
    let cancelled = false;
    setServerList([]);
    setSelectedServer("");
    setStreamLoading(true);
    setStreamError(null);
    setStreamData(null);

    fetch(`/api/anime/servers/${anilistId}/${episodeNum}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (cancelled) return;
        if (!data?.servers?.length) {
          setStreamLoading(false);
          setStreamError("No servers available for this episode.");
          return;
        }
        setServerList(data.servers);
        const hasDub = data.servers.some((s: ServerEntry) => s.type === "dub");
        setDubAvailable(hasDub);
        // Auto-select first sub server
        const firstSub = data.servers.find((s: ServerEntry) => s.type === translation);
        if (firstSub) {
          setSelectedServer(firstSub.id);
        } else if (data.servers[0]) {
          setSelectedServer(data.servers[0].id);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setStreamLoading(false);
          setStreamError("Failed to load servers.");
        }
      });
    return () => { cancelled = true; };
  }, [anilistId, episodeNum]);

  // ── Play stream from selected server (INSTANT — no second API call) ──
  // The streamUrl is already verified and included in the server list.
  // Switching servers is instant — just set the stream data.
  useEffect(() => {
    if (!selectedServer) return;
    const server = serverList.find(s => s.id === selectedServer);
    if (!server) return;

    // The streamUrl is already in the server object — use it directly
    const streamUrl = (server as any).streamUrl;
    if (!streamUrl) {
      setStreamError(`${server.name} has no stream URL.`);
      setStreamLoading(false);
      return;
    }

    const quality = (server as any).quality || "Auto";
    const isM3U8 = (server as any).isM3U8 !== false;
    const isMP4 = (server as any).isMP4 === true;

    const newStreamData: StreamData = {
      video_link: streamUrl,
      source_type: isMP4 ? "mp4" : "hls",
      hls_sources: [{
        url: streamUrl,
        quality,
        label: `${server.name} ${quality}`.trim(),
        isM3U8,
      }],
      embed_sources: [],
      subtitle_tracks: [],
      intro: null,
      outro: null,
      provider: `${server.source}:${server.provider}`,
      available_qualities: [quality],
    };

    console.log(`[WatchPage] Playing via ${server.source}:${server.provider} (${quality})`);
    setStreamData(newStreamData);
    setStreamLoading(false);
    setStreamError(null);
  }, [selectedServer, serverList]);

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
    <div className="min-h-screen bg-[#0a0a0f]">

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

          {/* MP4 Player — for mochi, neko, uwu MP4 sources */}
          {streamData && streamData.source_type === "mp4" && streamData.video_link && (
            <HLSPlayerNew
              key={`mp4-${activeProvider}-${episodeNum}-${translation}`}
              url={streamData.video_link}
              animeId={animeId}
              episodeNum={episodeNum}
              sourceType="mp4"
              intro={streamData.intro}
              outro={streamData.outro}
              onEnded={handleVideoEnded}
              onProviderFailed={() => handleProviderFailed(activeProvider)}
              autoplay={true}
            />
          )}

          {/* Embed Player (for Megaplay/Hindi embeds) */}
          {streamData && streamData.source_type === "embed" && streamData.video_link && (
            <EmbedPlayerWithFallback
              key={`embed-${activeProvider}-${episodeNum}-${translation}`}
              src={streamData.video_link}
              animeTitle={animeTitle}
              episodeNum={episodeNum}
              provider={activeProvider}
              providersForCurrentEp={providersForCurrentEp}
              failedProviders={failedProviders}
              onProviderFailed={handleProviderFailed}
              onProviderSelect={handleProviderSelect}
              getProviderDisplayName={getProviderDisplayName}
            />
          )}

          {/* Loading state */}
          {streamLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-[#0a0a0f] z-20">
              <div className="text-center space-y-3">
                <div className="w-10 h-10 border-[3px] border-white/10 border-t-[#D4A017] rounded-full animate-spin mx-auto" />
                <p className="text-zinc-500 text-xs font-medium">
                  Loading from <span className="text-[#D4A017]">{getProviderDisplayName(activeProvider)}</span>...
                </p>
              </div>
            </div>
          )}

          {/* Error state */}
          {streamError && !streamLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-[#0a0a0f] z-20">
              <div className="text-center space-y-4 max-w-sm px-6">
                <div className="w-12 h-12 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto">
                  <svg className="w-6 h-6 text-red-400/70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <p className="text-zinc-300 text-sm">{streamError}</p>
                <button
                  onClick={() => {
                    setStreamError(null);
                    setStreamLoading(true);
                    setScraperFallbackToken(t => t + 1);
                  }}
                  className="px-5 py-2 rounded-lg bg-[#7c3aed] text-white text-sm font-bold hover:bg-[#6d28d9] transition-colors"
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
              <h1 className="text-lg sm:text-xl font-bold text-white truncate">{animeTitle}</h1>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className="text-sm text-zinc-400">
                  Episode {episodeNum}{animeEpisodes ? ` of ${animeEpisodes}` : ""}
                  {animeDuration && ` · ${animeDuration}min`}
                </span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  translation === "sub"
                    ? "bg-[#D4A017]/15 text-[#D4A017]"
                    : "bg-red-500/15 text-red-400"
                }`}>
                  {translation.toUpperCase()}
                </span>
                {streamData && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-white/[0.05] text-zinc-400">
                    {getProviderDisplayName(streamData.provider)}
                  </span>
                )}
                {animeStatus === "RELEASING" && (
                  <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Airing
                  </span>
                )}
              </div>
            </div>

            {/* Quick Nav */}
            <div className="flex items-center gap-1.5 shrink-0">
              {prevEp && (
                <button
                  onClick={() => switchEpisode(prevEp)}
                  className="p-2 rounded-lg bg-white/[0.05] text-zinc-400 hover:bg-white/[0.08] hover:text-white transition-colors"
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
                  className="p-2 rounded-lg bg-white/[0.05] text-zinc-400 hover:bg-white/[0.08] hover:text-white transition-colors"
                  title="Next Episode (N)"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              )}
              <button
                onClick={() => setAutoNext(!autoNext)}
                className={`p-2 rounded-lg transition-colors ${
                  autoNext
                    ? "bg-[#D4A017]/15 text-[#D4A017]"
                    : "bg-white/[0.05] text-zinc-500 hover:text-zinc-300"
                }`}
                title={`Auto Next: ${autoNext ? "ON" : "OFF"}`}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* ─── NEXT AIRING COUNTDOWN ─── */}
        {animeNextAiring && countdown && (
          <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/5 border border-amber-500/10">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            <span className="text-xs text-amber-400/80 font-semibold">
              Episode {animeNextAiring.episode} airs in
            </span>
            <span className="text-xs font-extrabold text-amber-400 tracking-wide font-mono">
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
                    ? "text-[#D4A017]"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                {tab === "episodes" && (
                  <span className="flex items-center gap-1.5">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
                    </svg>
                    Episodes
                    {episodeList.length > 0 && (
                      <span className="ml-1 px-1.5 py-0.5 rounded text-[10px] bg-white/[0.05] text-zinc-500">
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
                      <span className="ml-1 px-1.5 py-0.5 rounded text-[10px] bg-white/[0.05] text-zinc-500">
                        {relations.length}
                      </span>
                    )}
                  </span>
                )}
                {activeTab === tab && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#D4A017] rounded-full" />
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
                  <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
                  </svg>
                  <input
                    type="text"
                    value={epSearch}
                    onChange={e => setEpSearch(e.target.value)}
                    placeholder="Search ep..."
                    className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-[#111118] border border-white/[0.06] text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#D4A017]/30"
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
                    className="w-20 px-2 py-1.5 rounded-lg bg-[#111118] border border-white/[0.06] text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#D4A017]/30"
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
                    className="px-2.5 py-1.5 rounded-lg bg-[#D4A017] text-black text-xs font-bold hover:bg-[#c49515] transition-colors"
                  >
                    Go
                  </button>
                </div>

                {/* Sort */}
                <button
                  onClick={() => setEpSortOrder(prev => prev === "asc" ? "desc" : "asc")}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#111118] border border-white/[0.06] text-xs text-zinc-400 hover:text-white transition-colors"
                >
                  <svg className={`w-3.5 h-3.5 transition-transform ${epSortOrder === "desc" ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
                  </svg>
                  {epSortOrder === "asc" ? "1 → 24" : "24 → 1"}
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
                            ? "bg-[#D4A017] text-black shadow-lg shadow-[#D4A017]/20"
                            : ep.filler
                              ? "bg-amber-500/5 text-amber-400/70 border border-amber-500/10 hover:bg-amber-500/10"
                              : "bg-[#111118] text-zinc-400 border border-white/[0.04] hover:bg-white/[0.06] hover:text-white"
                        }`}
                        title={ep.filler ? `Ep ${ep.number} (Filler)` : `Episode ${ep.number}`}
                      >
                        {ep.number}
                        {ep.filler && (
                          <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-amber-400/50" />
                        )}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="py-12 text-center">
                  <p className="text-zinc-500 text-sm">
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
                  <div className="shrink-0 w-28 sm:w-36 rounded-lg overflow-hidden border border-white/[0.06]">
                    <img
                      src={animeImage}
                      alt={animeTitle}
                      className="w-full h-auto object-cover"
                      loading="lazy"
                    />
                  </div>
                )}
                <div className="flex-1 min-w-0 space-y-3">
                  <h2 className="text-lg font-bold text-white">{animeTitle}</h2>

                  {/* Metadata pills */}
                  <div className="flex flex-wrap gap-2">
                    {animeStatus && (
                      <span className={`px-2.5 py-1 rounded-md text-[11px] font-semibold bg-white/[0.05] ${statusColor(animeStatus)}`}>
                        {statusLabel(animeStatus)}
                      </span>
                    )}
                    {animeType && (
                      <span className="px-2.5 py-1 rounded-md text-[11px] font-medium bg-white/[0.05] text-zinc-400">
                        {animeType}
                      </span>
                    )}
                    {animeSeason && (
                      <span className="px-2.5 py-1 rounded-md text-[11px] font-medium bg-white/[0.05] text-zinc-400">
                        {animeSeason}
                      </span>
                    )}
                    {animeEpisodes && (
                      <span className="px-2.5 py-1 rounded-md text-[11px] font-medium bg-white/[0.05] text-zinc-400">
                        {animeEpisodes} Episodes
                      </span>
                    )}
                    {animeDuration && (
                      <span className="px-2.5 py-1 rounded-md text-[11px] font-medium bg-white/[0.05] text-zinc-400">
                        {animeDuration} min/ep
                      </span>
                    )}
                    {animeScore && (
                      <span className="px-2.5 py-1 rounded-md text-[11px] font-semibold bg-[#D4A017]/10 text-[#D4A017]">
                        {animeScore > 10 ? Math.round(animeScore) : animeScore}%
                      </span>
                    )}
                  </div>

                  {/* Studios */}
                  {animeStudios.length > 0 && (
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">Studio</span>
                      <span className="text-sm text-zinc-400">{animeStudios.join(", ")}</span>
                    </div>
                  )}

                  {/* Genres */}
                  {animeGenres.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {animeGenres.map(g => (
                        <span key={g} className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-white/[0.05] text-zinc-400 border border-white/[0.04]">
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
                  <h3 className="text-sm font-semibold text-white mb-2">Synopsis</h3>
                  <p className={`text-sm text-zinc-400 leading-relaxed ${!synopsisExpanded ? "line-clamp-4" : ""}`}>
                    {animeDescription}
                  </p>
                  {animeDescription.length > 200 && (
                    <button
                      onClick={() => setSynopsisExpanded(!synopsisExpanded)}
                      className="mt-1 text-xs font-medium text-[#D4A017] hover:text-[#c49515] transition-colors"
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
                        className="flex items-center gap-3 w-full p-3 rounded-lg bg-[#111118] border border-white/[0.04] hover:bg-white/[0.06] transition-colors text-left"
                      >
                        {relImage ? (
                          <img
                            src={relImage}
                            alt={relTitle}
                            className="w-12 h-16 rounded object-cover shrink-0"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-12 h-16 rounded bg-white/[0.03] shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-white truncate">{relTitle}</p>
                          <div className="flex items-center gap-2 mt-1">
                            {rel.relationType && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#D4A017]/10 text-[#D4A017]">
                                {rel.relationType}
                              </span>
                            )}
                            {rel.format && (
                              <span className="text-[11px] text-zinc-500">{rel.format}</span>
                            )}
                            {rel.episodes && (
                              <span className="text-[11px] text-zinc-500">{rel.episodes} eps</span>
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
                  <p className="text-zinc-500 text-sm">No relations found</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* ─── SERVER SELECTOR (BOTTOM) ─── */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        <div className="mt-8 pt-6 border-t border-white/[0.06]">
          <div className="space-y-4">

            {/* Section header */}
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-[#D4A017]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2" />
              </svg>
              <h3 className="text-sm font-bold text-white">Servers</h3>
            </div>

            {/* SUB/DUB Toggle */}
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Audio</span>
              <div className="flex rounded-lg overflow-hidden border border-white/[0.06]">
                <button
                  onClick={() => handleTranslationChange("sub")}
                  className={`px-4 py-1.5 text-xs font-bold transition-colors ${
                    translation === "sub"
                      ? "bg-[#D4A017] text-black"
                      : "bg-[#111118] text-zinc-400 hover:text-white"
                  }`}
                >
                  SUB
                </button>
                <button
                  onClick={() => handleTranslationChange("dub")}
                  className={`px-4 py-1.5 text-xs font-bold transition-colors ${
                    translation === "dub"
                      ? "bg-[#D4A017] text-black"
                      : "bg-[#111118] text-zinc-400 hover:text-white"
                  } ${!dubAvailable ? "opacity-40 cursor-not-allowed" : ""}`}
                  disabled={!dubAvailable}
                >
                  DUB
                </button>
              </div>
              {!dubAvailable && (
                <span className="text-[10px] text-zinc-600">No dub available</span>
              )}
            </div>

            {/* Provider Pills — Unified Miruro + Animex servers */}
            {serverList.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Server</span>
                {serverList
                  .filter(s => s.type === translation)
                  .map(s => (
                    <button
                      key={s.id}
                      onClick={() => {
                        setSelectedServer(s.id);
                        setStreamError(null);
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        selectedServer === s.id
                          ? "bg-[#7c3aed] text-white shadow-md shadow-[#7c3aed]/30"
                          : "bg-[#111118] text-zinc-400 border border-white/[0.04] hover:bg-white/[0.06] hover:text-white hover:border-[#7c3aed]/30"
                      }`}
                    >
                      {s.name}
                    </button>
                  ))}
              </div>
            )}

            {/* No servers available */}
            {serverList.length === 0 && !streamLoading && (
              <div className="text-center py-4">
                <p className="text-zinc-500 text-xs">Loading servers...</p>
              </div>
            )}
          </div>
        </div>

        {/* ─── KEYBOARD SHORTCUTS PANEL ─── */}
        {showShortcuts && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowShortcuts(false)}>
            <div
              className="w-full max-w-sm mx-4 rounded-xl bg-[#111118] border border-white/[0.06] shadow-2xl overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
                <h3 className="text-sm font-bold text-white">Keyboard Shortcuts</h3>
                <button
                  onClick={() => setShowShortcuts(false)}
                  className="p-1 rounded text-zinc-500 hover:text-white transition-colors"
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
                    <span className="text-xs text-zinc-400">{s.desc}</span>
                    <kbd className="px-2 py-0.5 rounded bg-white/[0.06] text-[10px] font-mono font-bold text-white border border-white/[0.06]">
                      {s.key}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
