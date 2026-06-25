"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useAppStore } from "./store";
import HLSPlayerNew from "./hls-player-new";
import { getProviderDisplayName } from "@/lib/miruro-api";
import { proxifyM3u8, proxify } from "@/lib/proxy";

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
  /**
   * Translation mode — 3-way toggle like AniDap/Anistream:
   *   "sub"     → Soft sub (subtitles as separate VTT track)
   *   "hardsub" → Hard sub (subtitles burned into video)
   *   "dub"     → English dub audio
   *
   * For backwards compatibility with the existing code that uses "sub"|"dub",
   * "sub" and "hardsub" both map to type="sub" servers (just filtered by
   * the `hardsub` flag on each server).
   */
  const [translation, setTranslation] = useState<"sub" | "hardsub" | "dub" | "hindi">("sub");
  const [availableProviders, setAvailableProviders] = useState<string[]>([]);
  const [failedProviders, setFailedProviders] = useState<Set<string>>(new Set());
  const [dubAvailable, setDubAvailable] = useState(false);
  const [hardsubAvailable, setHardsubAvailable] = useState(false);
  const [softsubAvailable, setSoftsubAvailable] = useState(false);
  const [hindiAvailable, setHindiAvailable] = useState(false);
  const [streamLoading, setStreamLoading] = useState(true);
  const [streamError, setStreamError] = useState<string | null>(null);

  // ── Server List (Miruro + Animex + AniVault + AniVexa + Senshi + AniDap + AniLight + Kyren — ALL verified) ──
  interface ServerEntry {
    id: string;
    name: string;
    source: "miruro" | "animex" | "anivault" | "anivexa" | "senshi" | "anidap" | "anilight" | "kyren" | "anikage" | "mioanime" | "anixtv";
    provider: string;
    type: "sub" | "dub";
    quality?: string;
    streamUrl?: string;
    isM3U8?: boolean;
    isMP4?: boolean;
    /** Whether subtitles are burned into the video (hard sub) vs soft sub */
    hardsub?: boolean;
    /** AniDap/AniLight streams include WebVTT subtitle tracks + intro/outro chapters */
    subtitleTracks?: Array<{ url: string; lang: string; label: string }>;
    intro?: { start: number; end: number } | null;
    outro?: { start: number; end: number } | null;
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

  // ── Player Control Bar State (CinemaOS-style) ──
  const [autoPlay, setAutoPlay] = useState(true);
  const [autoSkip, setAutoSkip] = useState(true);
  const [skipFiller, setSkipFiller] = useState(true);
  const [flipLayout, setFlipLayout] = useState(false);
  const [lightsOff, setLightsOff] = useState(false);

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
        // Map 3-way translation mode to the 2-way type the miruro-direct API expects
        const apiType = translation === "dub" ? "dub" : "sub";
        const res = await fetch(
          `/api/anime/scraper/miruro-direct/${anilistId}/${episodeNum}?type=${apiType}`
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

  const handleTranslationChange = useCallback((t: "sub" | "hardsub" | "dub" | "hindi") => {
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

  // NOTE: The old fetchStream effect that called /api/anime/scraper/miruro-direct
  // has been REMOVED. Stream loading is now handled by the server selector
  // effect below (line ~575) which uses the verified streamUrl from /api/anime/servers.
  // The old effect was competing with the new one and overriding the stream data.

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
        // Detect what's available: hard sub, soft sub, dub, hindi
        const hasDub = data.servers.some((s: ServerEntry) => s.type === "dub" && s.source !== "anixtv");
        const hasHardsub = data.servers.some((s: ServerEntry) => s.type === "sub" && s.hardsub === true);
        const hasSoftsub = data.servers.some((s: ServerEntry) => s.type === "sub" && s.hardsub !== true);
        const hasHindi = data.servers.some((s: ServerEntry) => s.source === "anixtv");
        setDubAvailable(hasDub);
        setHardsubAvailable(hasHardsub);
        setSoftsubAvailable(hasSoftsub);
        setHindiAvailable(hasHindi);

        // Auto-select first server matching current translation mode.
        // Translation modes: "sub" (soft sub preferred, falls back to hardsub),
        // "hardsub", "dub" (English dub), "hindi" (Hindi dub from AnixTV).
        let firstMatch: ServerEntry | undefined;
        if (translation === "hindi") {
          firstMatch = data.servers.find((s: ServerEntry) => s.source === "anixtv");
        } else if (translation === "dub") {
          firstMatch = data.servers.find((s: ServerEntry) => s.type === "dub" && s.source !== "anixtv");
        } else if (translation === "hardsub") {
          firstMatch = data.servers.find((s: ServerEntry) => s.type === "sub" && s.hardsub === true);
        } else {
          // "sub" → soft sub preferred, fall back to any sub (hardsub ok)
          firstMatch = data.servers.find((s: ServerEntry) => s.type === "sub" && s.hardsub !== true)
                    || data.servers.find((s: ServerEntry) => s.type === "sub");
        }

        // If first match doesn't exist (e.g. user picked "hardsub" but only
        // soft sub is available), fall back to whatever's first available
        // in priority order: soft sub → hard sub → dub
        if (!firstMatch) {
          firstMatch = data.servers.find((s: ServerEntry) => s.type === "sub" && s.hardsub !== true)
                    || data.servers.find((s: ServerEntry) => s.type === "sub")
                    || data.servers.find((s: ServerEntry) => s.type === "dub")
                    || data.servers[0];
          // Update translation to match what we actually picked
          if (firstMatch) {
            if (firstMatch.type === "dub") setTranslation("dub");
            else if (firstMatch.hardsub === true) setTranslation("hardsub");
            else setTranslation("sub");
          }
        }

        if (firstMatch) {
          setSelectedServer(firstMatch.id);
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

    // ── Fetch Animex servers SEPARATELY (doesn't block the main list) ──
    // Animex fetches from pp.animex.one in batches — takes longer than other
    // sources. This runs in parallel and appends servers when ready.
    fetch(`/api/anime/animex-servers/${anilistId}/${episodeNum}`)
      .then(r => r.ok ? r.json() : null)
      .then(animexData => {
        if (cancelled || !animexData?.servers?.length) return;
        // Append Animex servers to the existing server list
        setServerList(prev => {
          // Avoid duplicates — only add servers whose IDs don't already exist
          const existingIds = new Set(prev.map(s => s.id));
          const newServers = animexData.servers.filter((s: ServerEntry) => !existingIds.has(s.id));
          const combined = [...prev, ...newServers];
          // Update availability flags
          const hasDub = combined.some((s: ServerEntry) => s.type === "dub" && s.source !== "anixtv");
          const hasHardsub = combined.some((s: ServerEntry) => s.type === "sub" && s.hardsub === true);
          const hasSoftsub = combined.some((s: ServerEntry) => s.type === "sub" && s.hardsub !== true);
          const hasHindi = combined.some((s: ServerEntry) => s.source === "anixtv");
          setDubAvailable(hasDub);
          setHardsubAvailable(hasHardsub);
          setSoftsubAvailable(hasSoftsub);
          setHindiAvailable(hasHindi);
          console.log(`[WatchPage] Animex servers loaded: +${newServers.length} (total: ${combined.length})`);
          return combined;
        });
      })
      .catch(() => {
        // Animex failed silently — other servers are still available
        console.log("[WatchPage] Animex servers failed to load (non-critical)");
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
    const isEmbed = (server as any).isEmbed === true;

    // AniDap streams come with their own WebVTT subtitle tracks (for softsub
    // providers like vee/yuki/miku/neko) and intro/outro chapters. Pass them
    // through to the HLS player.
    const subtitleTracks = (server as ServerEntry).subtitleTracks || [];
    const intro = (server as ServerEntry).intro ?? null;
    const outro = (server as ServerEntry).outro ?? null;

    const newStreamData: StreamData = {
      video_link: streamUrl,
      source_type: isEmbed ? "embed" : (isMP4 ? "mp4" : "hls"),
      hls_sources: [{
        url: streamUrl,
        quality,
        label: `${server.name} ${quality}`.trim(),
        isM3U8,
      }],
      embed_sources: [],
      subtitle_tracks: subtitleTracks.map(t => ({
        url: t.url,
        label: t.label || t.lang || "English",
        kind: "subtitles" as const,
      })),
      intro,
      outro,
      provider: `${server.source}:${server.provider}`,
      available_qualities: [quality],
    };

    console.log(`[WatchPage] Playing via ${server.source}:${server.provider} (${quality}) — subs=${subtitleTracks.length} intro=${intro ? `${intro.start}-${intro.end}` : "no"} outro=${outro ? `${outro.start}-${outro.end}` : "no"}`);
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
              key={selectedServer}
              url={proxifyM3u8(streamData.video_link)}
              animeId={animeId}
              episodeNum={episodeNum}
              sourceType="hls"
              intro={streamData.intro}
              outro={streamData.outro}
              allStreams={streamData.hls_sources.map(s => ({
                url: proxifyM3u8(s.url),
                quality: s.quality || "Auto",
                label: s.label || s.quality || "Auto",
              }))}
              subtitleTracks={(streamData.subtitle_tracks || []).map(s => ({ url: proxify(s.url, "raw"), lang: s.label || "en", label: s.label || "English" }))}
              onEnded={handleVideoEnded}
              onProviderFailed={() => handleProviderFailed(activeProvider)}
              autoplay={autoPlay}
            />
          )}

          {/* MP4 Player */}
          {streamData && streamData.source_type === "mp4" && streamData.video_link && (
            <HLSPlayerNew
              key={`mp4-${selectedServer}`}
              url={proxify(streamData.video_link, "raw")}
              animeId={animeId}
              episodeNum={episodeNum}
              sourceType="mp4"
              intro={streamData.intro}
              outro={streamData.outro}
              onEnded={handleVideoEnded}
              onProviderFailed={() => handleProviderFailed(activeProvider)}
              autoplay={autoPlay}
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

      {/* ─── PLAYER CONTROL BAR (CinemaOS-style) ─── */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="flex items-center gap-4 py-3 px-4 bg-black border border-white/[0.06] rounded-xl mt-2 flex-wrap">
          {/* Toggle Switches */}
          {[
            { label: "Autoplay", state: autoPlay, setter: setAutoPlay },
            { label: "Auto Skip", state: autoSkip, setter: setAutoSkip },
            { label: "Auto Next", state: autoNext, setter: setAutoNext },
            { label: "Skip Filler", state: skipFiller, setter: setSkipFiller },
            { label: "Flip Layout", state: flipLayout, setter: setFlipLayout },
          ].map(({ label, state, setter }) => (
            <button
              key={label}
              onClick={() => setter(!state)}
              className="flex items-center gap-2 group"
            >
              {/* Custom toggle circle */}
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                state
                  ? "bg-white border-white"
                  : "bg-transparent border-zinc-600 group-hover:border-zinc-400"
              }`}>
                {state && (
                  <svg className="w-3 h-3 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
              <span className={`text-xs font-medium transition-colors ${
                state ? "text-white" : "text-zinc-500 group-hover:text-zinc-300"
              }`}>{label}</span>
            </button>
          ))}

          {/* Divider */}
          <div className="w-px h-6 bg-white/[0.06] mx-1" />

          {/* Action Buttons */}
          <button
            onClick={() => setShowShortcuts(!showShortcuts)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-white/[0.06] transition-colors"
          >
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
              <rect x="14" y="14" width="7" height="7" rx="1" />
            </svg>
            <span className="text-xs font-medium text-white">Shortcuts</span>
          </button>

          <button
            onClick={() => setLightsOff(!lightsOff)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors ${
              lightsOff ? "bg-amber-500/10" : "hover:bg-white/[0.06]"
            }`}
          >
            <svg className={`w-4 h-4 ${lightsOff ? "text-amber-400" : "text-white"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.1V18h6v-1.2c0-.8.4-1.6 1-2.1A7 7 0 0 0 12 2z" />
            </svg>
            <span className={`text-xs font-medium ${lightsOff ? "text-amber-400" : "text-white"}`}>Lights Off</span>
          </button>
        </div>
      </div>

      {/* Lights Off overlay */}
      {lightsOff && (
        <div
          className="fixed inset-0 bg-black/90 z-30 pointer-events-none"
          style={{ backdropFilter: "blur(8px)" }}
        />
      )}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pb-12">

        {/* ─── CONTENT AREA ─── */}
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
                  translation === "hindi"
                    ? "bg-purple-500/15 text-purple-400"
                    : translation === "dub"
                    ? "bg-red-500/15 text-red-400"
                    : translation === "hardsub"
                    ? "bg-orange-500/15 text-orange-400"
                    : "bg-[#D4A017]/15 text-[#D4A017]"
                }`}>
                  {translation === "sub" ? "SOFT SUB" : translation === "hardsub" ? "HARD SUB" : translation === "dub" ? "DUB" : "HINDI DUB"}
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

            {/* SUB / HARD SUB / DUB Toggle — 3-way like AniDap/Anistream */}
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Audio</span>
              <div className="flex rounded-lg overflow-hidden border border-white/[0.06]">
                {/* Soft Sub */}
                <button
                  onClick={() => handleTranslationChange("sub")}
                  className={`px-3 py-1.5 text-xs font-bold transition-colors ${
                    translation === "sub"
                      ? "bg-[#D4A017] text-black"
                      : "bg-[#111118] text-zinc-400 hover:text-white"
                  } ${!softsubAvailable ? "opacity-40 cursor-not-allowed" : ""}`}
                  disabled={!softsubAvailable}
                  title="Soft sub — subtitles as separate VTT track"
                >
                  SOFT SUB
                </button>
                {/* Hard Sub */}
                <button
                  onClick={() => handleTranslationChange("hardsub")}
                  className={`px-3 py-1.5 text-xs font-bold transition-colors ${
                    translation === "hardsub"
                      ? "bg-[#D4A017] text-black"
                      : "bg-[#111118] text-zinc-400 hover:text-white"
                  } ${!hardsubAvailable ? "opacity-40 cursor-not-allowed" : ""}`}
                  disabled={!hardsubAvailable}
                  title="Hard sub — subtitles burned into video"
                >
                  HARD SUB
                </button>
                {/* Dub (English) */}
                <button
                  onClick={() => handleTranslationChange("dub")}
                  className={`px-3 py-1.5 text-xs font-bold transition-colors ${
                    translation === "dub"
                      ? "bg-[#D4A017] text-black"
                      : "bg-[#111118] text-zinc-400 hover:text-white"
                  } ${!dubAvailable ? "opacity-40 cursor-not-allowed" : ""}`}
                  disabled={!dubAvailable}
                  title="Dub — English dubbed audio"
                >
                  DUB
                </button>
                {/* Hindi Dub (AnixTV — multi-audio HLS with Hindi/Tamil/Telugu/Bengali/etc.)
                    ALWAYS enabled — if no hindi servers, show "not in database" message
                    instead of graying out the button. User should always be able to click
                    HINDI to check availability. */}
                <button
                  onClick={() => handleTranslationChange("hindi")}
                  className={`px-3 py-1.5 text-xs font-bold transition-colors ${
                    translation === "hindi"
                      ? "bg-[#D4A017] text-black"
                      : "bg-[#111118] text-zinc-400 hover:text-white"
                  }`}
                  title="Hindi Dub — AnixTV multi-audio (Hindi/Tamil/Telugu/Bengali/Malayalam/Marathi/Kannada)"
                >
                  HINDI
                </button>
              </div>
            </div>

            {/* Provider Pills — filtered by current translation mode */}
            {serverList.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Server</span>
                {serverList
                  .filter(s => {
                    // Filter by translation mode:
                    //   "sub"     → ALL sub servers (soft sub first, then hardsub as fallback)
                    //               — shows every available sub server so the user has more choice
                    //   "hardsub" → ONLY hard sub servers (type=sub, hardsub === true)
                    //   "dub"     → ONLY English dub servers (type=dub, NOT anixtv)
                    //   "hindi"   → ONLY AnixTV servers (Hindi/multi-audio dub from anixtv.in)
                    if (translation === "hindi") return s.source === "anixtv";
                    if (translation === "dub") return s.type === "dub" && s.source !== "anixtv";
                    if (translation === "hardsub") return s.type === "sub" && s.hardsub === true;
                    // "sub" → show ALL type=sub servers (both soft sub and hardsub)
                    return s.type === "sub";
                  })
                  .sort((a, b) => {
                    // In "sub" mode, sort soft-sub before hardsub (so user sees soft sub first)
                    if (translation === "sub") {
                      if (a.hardsub !== true && b.hardsub === true) return -1;
                      if (a.hardsub === true && b.hardsub !== true) return 1;
                    }
                    return 0;
                  })
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

            {/* HINDI mode but no hindi servers available — show "not in database" message */}
            {translation === "hindi" && serverList.length > 0 && !serverList.some(s => s.source === "anixtv") && !streamLoading && (
              <div className="text-center py-4 px-4 rounded-lg bg-purple-500/5 border border-purple-500/20">
                <p className="text-purple-300 text-sm font-medium mb-1">Not in our Hindi database</p>
                <p className="text-zinc-500 text-xs">
                  This anime doesn't have a Hindi dub on AnixTV yet. Try SOFT SUB / HARD SUB / DUB instead.
                </p>
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
