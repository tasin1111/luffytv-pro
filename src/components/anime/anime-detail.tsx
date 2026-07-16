"use client";

import { useState, useEffect } from "react";
import { useAppStore } from "./store";
import type { AnimeItem } from "./store";
import type { MiruroAnimeResult } from "@/lib/miruro-api";
import type { AniListMedia } from "@/lib/anilist-api";
import AnimeComments from "./anime-comments";
import MusicTab from "./music-tab";

// ============================================================
// Types
// ============================================================
interface AnimeDetailProps {
  animeId: string;
}

interface EpisodeData {
  episodeIdNum: number;
  notes?: string | null;
  thumbnails?: string[];
  title?: string | null;
  thumbnail?: string | null;
  description?: string | null;
  source?: string;
  subSlug?: string;
  dubSlug?: string | null;
  anitakuSlug?: string | null;
}

interface MiruroEpData {
  sub: Array<{ number: number; slug: string; title?: string; thumbnail?: string }>;
  dub: Array<{ number: number; slug: string; title?: string; thumbnail?: string }>;
}

interface AniListRelation {
  relationType: string;
  id: number;
  title: { romaji?: string; english?: string; native?: string };
  coverImage: { extraLarge?: string; large?: string; medium?: string };
  type?: string;
  format?: string;
  episodes?: number;
  status?: string;
}

interface AniListRecommendation {
  id: number;
  title: { romaji?: string; english?: string; native?: string };
  coverImage: { extraLarge?: string; large?: string; medium?: string };
  type?: string;
  episodes?: number;
  averageScore?: number;
  status?: string;
}

interface CharacterData {
  id: number;
  name: { full: string; native?: string };
  image: { large?: string; medium?: string };
  role: string;
  voiceActors?: Array<{ name: { full: string }; image?: { medium?: string } }>;
}

// ── Tab type ──
type DetailTab = "episodes" | "characters" | "seasons" | "music" | "related" | "morelikethis";

// ── Status label helper ──
const statusLabel = (s: string) => {
  if (s === "RELEASING") return "Airing";
  if (s === "FINISHED") return "Complete";
  if (s === "NOT_YET_RELEASED") return "Upcoming";
  return s || "—";
};

// ── Countdown Timer — pure B/W ──
function CountdownTimer({ airingAt, episode }: { airingAt: number; episode: number }) {
  const [timeLeft, setTimeLeft] = useState("");
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    function update() {
      const now = Math.floor(Date.now() / 1000);
      const diff = airingAt - now;
      if (diff <= 0) {
        setExpired(true);
        setTimeLeft("");
        return;
      }
      const d = Math.floor(diff / 86400);
      const h = Math.floor((diff % 86400) / 3600);
      const m = Math.floor((diff % 3600) / 60);
      const s = diff % 60;
      setTimeLeft(`${d}d ${h}h ${m}m ${s}s`);
    }
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [airingAt]);

  if (expired) return null;

  return (
    <div className="inline-flex items-center gap-2 px-3 py-1.5 border border-white/15 rounded-md bg-white/[0.02]">
      <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
      <span className="text-[10px] text-white/60 font-bold uppercase tracking-[0.2em]">Ep {episode} in</span>
      <span className="text-xs font-bold text-white tabular-nums font-mono">{timeLeft}</span>
    </div>
  );
}

// ============================================================
// MAIN — Pure Black & White Detail Page (Miruro-inspired)
// Layout: left rail (poster + facts) | right content (title + tabs)
// ============================================================
export default function AnimeDetailPage({ animeId }: AnimeDetailProps) {
  const navigate = useAppStore(s => s.navigate);
  const bookmarks = useAppStore(s => s.bookmarks);
  const setBookmarks = useAppStore(s => s.setBookmarks);

  // ── Core state ──
  const [anime, setAnime] = useState<AnimeItem | null>(null);
  const [miruroInfo, setMiruroInfo] = useState<MiruroAnimeResult | null>(null);
  const [anilistMedia, setAnilistMedia] = useState<AniListMedia | null>(null);
  const [anilistInfo, setAnilistInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [anilistId, setAnilistId] = useState<number | null>(null);
  const [totalEpisodes, setTotalEpisodes] = useState<number | null>(null);

  const [episodes, setEpisodes] = useState<EpisodeData[]>([]);
  const [miruroEps, setMiruroEps] = useState<MiruroEpData>({ sub: [], dub: [] });
  const [activeEpiTab, setActiveEpiTab] = useState<"sub" | "dub">("sub");

  const [anilistRelations, setAnilistRelations] = useState<AniListRelation[]>([]);
  const [franchiseSeasons, setFranchiseSeasons] = useState<AniListRelation[]>([]);
  const [franchiseRelated, setFranchiseRelated] = useState<AniListRelation[]>([]);
  const [anilistRecommendations, setAnilistRecommendations] = useState<AniListRecommendation[]>([]);
  const [anilistStudios, setAnilistStudios] = useState<Array<{ id: number; name: string; isAnimationStudio: boolean }>>([]);
  const [anilistTrailer, setAnilistTrailer] = useState<{ id: string; site: string; thumbnail: string } | null>(null);

  const [nextAiring, setNextAiring] = useState<{ episode: number; airingAt: number } | null>(null);
  const [characters, setCharacters] = useState<CharacterData[]>([]);
  const [source, setSource] = useState<string>("");

  // TMDB logo + backdrop (fetched separately, like the home page hero)
  const [tmdbLogo, setTmdbLogo] = useState<string>("");
  const [tmdbBackdrop, setTmdbBackdrop] = useState<string>("");

  // UI state
  const [synopsisExpanded, setSynopsisExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<DetailTab>("episodes");
  const [epSearch, setEpSearch] = useState("");
  const [epPage, setEpPage] = useState(1);
  const EPS_PER_PAGE = 24;

  // ── Reset on animeId change ──
  useEffect(() => {
    setAnime(null);
    setMiruroInfo(null);
    setAnilistMedia(null);
    setAnilistInfo(null);
    setAnilistId(null);
    setTotalEpisodes(null);
    setEpisodes([]);
    setMiruroEps({ sub: [], dub: [] });
    setActiveEpiTab("sub");
    setAnilistRelations([]);
    setFranchiseSeasons([]);
    setFranchiseRelated([]);
    setAnilistRecommendations([]);
    setAnilistStudios([]);
    setAnilistTrailer(null);
    setNextAiring(null);
    setCharacters([]);
    setSource("");
    setTmdbLogo("");
    setTmdbBackdrop("");
    setSynopsisExpanded(false);
    setActiveTab("episodes");
    setEpSearch("");
    setEpPage(1);
  }, [animeId]);

  // ── Load core data ──
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);

      const cleanId = animeId.replace(/^miruro_/, "").replace(/^mal_/, "");
      if (/^\d+$/.test(cleanId)) setAnilistId(parseInt(cleanId));

      try {
        const infoRes = await fetch(`/api/anime/info?id=${encodeURIComponent(animeId)}`);
        if (infoRes.ok && !cancelled) {
          const data = await infoRes.json();
          setAnime(data.anime);
          setMiruroInfo(data.miruroInfo);
          if (data.anilistInfo) {
            setAnilistInfo(data.anilistInfo);
            if (data.anilistInfo.characters && Array.isArray(data.anilistInfo.characters)) {
              setCharacters(data.anilistInfo.characters);
            }
            const studiosRaw = Array.isArray(data.anilistInfo.studios) ? data.anilistInfo.studios : (data.anilistInfo.studios?.nodes || []);
            if (studiosRaw.length > 0) {
              setAnilistStudios(studiosRaw.map((s: any) => ({
                id: s.id, name: s.name, isAnimationStudio: s.isAnimationStudio
              })));
            }
            const mapRelation = (edge: any) => {
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
            };
            if (data.anilistInfo.franchiseSeasons || data.anilistInfo.franchiseRelated) {
              const seasons = (data.anilistInfo.franchiseSeasons || []).map(mapRelation);
              const related = (data.anilistInfo.franchiseRelated || []).map(mapRelation);
              setFranchiseSeasons(seasons);
              setFranchiseRelated(related);
              setAnilistRelations([...seasons, ...related]);
            } else {
              const relsRaw = Array.isArray(data.anilistInfo.relations) && data.anilistInfo.relations[0]?.relationType
                ? data.anilistInfo.relations
                : (data.anilistInfo.relations?.edges || []);
              if (relsRaw.length > 0) {
                const mapped = relsRaw.map(mapRelation);
                setAnilistRelations(mapped);
                const seasons = mapped.filter(r =>
                  (r.relationType === "SEQUEL" || r.relationType === "PREQUEL") &&
                  (!r.format || r.format === "TV" || r.format === "TV_SHORT" || r.format === "OVA" || r.format === "ONA")
                );
                const related = mapped.filter(r => !seasons.some(s => s.id === r.id));
                setFranchiseSeasons(seasons);
                setFranchiseRelated(related);
              }
            }
            const recsRaw = Array.isArray(data.anilistInfo.recommendations) ? data.anilistInfo.recommendations : (data.anilistInfo.recommendations?.nodes || []);
            if (recsRaw.length > 0) {
              setAnilistRecommendations(
                recsRaw
                  .filter((r: any) => r.mediaRecommendation || r.id)
                  .map((r: any) => {
                    const m = r.mediaRecommendation || r;
                    return {
                      id: m.id,
                      title: m.title,
                      coverImage: m.coverImage,
                      type: m.type,
                      episodes: m.episodes,
                      averageScore: m.averageScore,
                      status: m.status,
                    };
                  })
              );
            }
            if (data.anilistInfo.trailer) setAnilistTrailer(data.anilistInfo.trailer);
            if (data.anilistInfo.nextAiringEpisode) setNextAiring(data.anilistInfo.nextAiringEpisode);
            else if (data.nextAiringEpisode) setNextAiring(data.nextAiringEpisode);
          }
          if (data.totalEpisodes != null && data.totalEpisodes > 0) setTotalEpisodes(data.totalEpisodes);
          if (data.anilistInfo?.source) setSource(data.anilistInfo.source);
        }
      } catch { /* ignore */ }

      if (!cancelled) setLoading(false);

      // Load episodes
      try {
        let aid = anilistId;
        if (!aid) {
          try {
            const infoRes = await fetch(`/api/anime/info?id=${encodeURIComponent(animeId)}`);
            if (infoRes.ok) {
              const info = await infoRes.json();
              aid = info?.anilistInfo?.id ? Number(info.anilistInfo.id) : null;
              if (aid && !cancelled) setAnilistId(aid);
            }
          } catch { /* ignore */ }
        }
        if (aid && !cancelled) {
          // Use the aggregated episodes endpoint which pulls thumbnails
          // from TMDB + TVMaze + AniList + Miruro (much better images
          // than miruro-direct alone which often has no thumbnails)
          const epRes = await fetch(`/api/anime/episodes?id=${encodeURIComponent(animeId)}`);
          if (epRes.ok && !cancelled) {
            const data = await epRes.json();
            const rawEps: any[] = data.episodes || [];
            const eps: EpisodeData[] = rawEps.map((ep: any) => ({
              episodeIdNum: Number(ep.episodeIdNum || ep.number || 0),
              title: ep.title || null,
              thumbnail: ep.thumbnail || null,
              description: ep.description || null,
              source: ep.source || "miruro",
              subSlug: ep.subSlug || String(ep.episodeIdNum || ep.number),
              dubSlug: ep.dubSlug || null,
            })).filter((ep: EpisodeData) => ep.episodeIdNum > 0)
               .sort((a, b) => a.episodeIdNum - b.episodeIdNum);

            if (eps.length > 0) setEpisodes(eps);

            // Derive sub/dub from episode data
            const hasDub = eps.some(ep => ep.dubSlug);
            if (hasDub) {
              setMiruroEps({
                sub: eps.map(ep => ({ number: ep.episodeIdNum, slug: ep.subSlug || String(ep.episodeIdNum), title: ep.title || `Episode ${ep.episodeIdNum}`, thumbnail: ep.thumbnail || undefined })),
                dub: eps.filter(ep => ep.dubSlug).map(ep => ({ number: ep.episodeIdNum, slug: ep.dubSlug!, title: ep.title || `Episode ${ep.episodeIdNum}`, thumbnail: ep.thumbnail || undefined })),
              });
            }
            const epTotal = data.totalEpisodes ?? eps.length;
            if (epTotal && !cancelled) setTotalEpisodes(epTotal);
          }
        }
      } catch { /* ignore */ }
    }
    load();
    return () => { cancelled = true; };
  }, [animeId]);

  // ── Load full franchise in background ──
  useEffect(() => {
    if (!anilistId) return;
    async function loadFranchise() {
      try {
        const res = await fetch(`/api/anime/franchise?id=${anilistId}`);
        if (res.ok) {
          const data = await res.json();
          if (data.seasons?.length > franchiseSeasons.length) {
            const mapRelation = (edge: any) => ({
              relationType: edge.relationType,
              id: edge.id,
              title: edge.title,
              coverImage: edge.coverImage,
              type: edge.type,
              format: edge.format,
              episodes: edge.episodes,
              status: edge.status,
            });
            setFranchiseSeasons(data.seasons.map(mapRelation));
            setFranchiseRelated(data.related.map(mapRelation));
            setAnilistRelations([...data.seasons, ...data.related].map(mapRelation));
          }
        }
      } catch { /* ignore */ }
    }
    loadFranchise();
  }, [anilistId]);

  // ── Load deferred data ──
  useEffect(() => {
    if (!anilistId) return;
    if (anilistRelations.length > 0 || characters.length > 0) return;
    async function loadDeferred() {
      try {
        const res = await fetch(`/api/anime/anilist-detail?id=${anilistId}`);
        if (res.ok) {
          const data = await res.json();
          if (data.relations?.length) setAnilistRelations(data.relations);
          if (data.recommendations?.length) setAnilistRecommendations(data.recommendations);
          if (data.studios?.length) setAnilistStudios(data.studios);
          if (data.trailer) setAnilistTrailer(data.trailer);
          if (data.characters?.length) setCharacters(data.characters);
          if (data.details) {
            setAnilistMedia(data.details);
            if (data.details.episodes) setTotalEpisodes(prev => prev ?? data.details.episodes);
            if (data.details.nextAiringEpisode) setNextAiring(data.details.nextAiringEpisode);
          }
          if (data.details?.source) setSource(data.details.source);
        }
      } catch { /* ignore */ }
    }
    loadDeferred();
  }, [anilistId]);

  // ── Fetch TVDB logo + backdrop (clearlogos from thetvdb.com) ──
  // TVDB has the best anime clearlogos (transparent PNG logos).
  // Falls back to AniList banner if TVDB has no background.
  useEffect(() => {
    if (!anilistId) return;
    let cancelled = false;
    async function fetchTvdb() {
      try {
        const alTitleObj = anilistInfo?.title || anilistMedia?.title || null;
        const titleForSearch =
          alTitleObj?.english || alTitleObj?.romaji ||
          miruroInfo?.title?.english || miruroInfo?.title?.romaji ||
          anime?.englishName || anime?.name ||
          "";
        if (!titleForSearch) return;
        const res = await fetch(
          `/api/anime/tvdb-images/${anilistId}?title=${encodeURIComponent(titleForSearch)}`
        );
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (cancelled) return;
        if (data.logoUrl) setTmdbLogo(data.logoUrl);
        if (data.backdropUrl) setTmdbBackdrop(data.backdropUrl);
      } catch { /* ignore — page still works with AniList banner */ }
    }
    fetchTvdb();
    return () => { cancelled = true; };
  }, [anilistId, anilistInfo, anilistMedia, miruroInfo, anime]);

  // ── Loading skeleton ──
  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white">
        {/* Banner skeleton */}
        <div className="h-screen bg-white/[0.03] animate-pulse" />
        {/* Two-column skeleton */}
        <div className="px-4 sm:px-6 py-4 -mt-32 relative">
          <div className="flex flex-col lg:flex-row gap-6 xl:gap-9">
            {/* Left sidebar skeleton */}
            <div className="hidden lg:flex w-50 xl:w-60 2xl:w-64 flex-col gap-4 shrink-0">
              <div className="w-full aspect-[2/3] rounded-xl bg-white/[0.05] animate-pulse" />
              <div className="h-8 rounded-xl bg-white/[0.06] animate-pulse" />
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex flex-col gap-1">
                  <div className="h-2.5 w-16 rounded bg-white/[0.06] animate-pulse" />
                  <div className="h-3 w-20 rounded bg-white/[0.05] animate-pulse" />
                </div>
              ))}
            </div>
            {/* Main column skeleton */}
            <div className="flex-1 space-y-6">
              <div className="h-3 w-24 rounded bg-white/[0.06] animate-pulse" />
              <div className="h-8 w-2/3 rounded bg-white/[0.08] animate-pulse" />
              <div className="flex gap-2">
                <div className="h-6 w-16 rounded bg-white/[0.08] animate-pulse" />
                <div className="h-6 w-16 rounded bg-white/[0.06] animate-pulse" />
                <div className="h-6 w-16 rounded bg-white/[0.06] animate-pulse" />
              </div>
              <div className="flex gap-2">
                <div className="h-9 w-30 rounded-full bg-white/[0.1] animate-pulse" />
                <div className="h-9 w-9 rounded-full bg-white/[0.06] animate-pulse" />
                <div className="h-9 w-9 rounded-full bg-white/[0.06] animate-pulse" />
              </div>
              <div className="space-y-2">
                <div className="h-3 w-full rounded bg-white/[0.04] animate-pulse" />
                <div className="h-3 w-5/6 rounded bg-white/[0.04] animate-pulse" />
                <div className="h-3 w-3/4 rounded bg-white/[0.04] animate-pulse" />
              </div>
              {/* Tab bar skeleton */}
              <div className="border-b border-white/10 h-12 flex items-center gap-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-4 w-20 rounded bg-white/[0.06] animate-pulse" />
                ))}
              </div>
              {/* Episode grid skeleton */}
              <div className="flex flex-wrap gap-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="w-1/4 p-2">
                    <div className="aspect-video rounded-xl bg-white/[0.04] animate-pulse" />
                    <div className="h-3 w-3/4 rounded bg-white/[0.04] animate-pulse mt-2" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Derived data ──
  const alTitle = anilistMedia?.title || anilistInfo?.title || null;
  const miruroTitle = miruroInfo?.title || null;
  const anilistTitle = String(alTitle?.english || alTitle?.romaji || miruroTitle?.english || miruroTitle?.romaji || "");
  const anilistTitleRomaji = String(alTitle?.romaji || miruroTitle?.romaji || "");
  const anilistTitleNative = String(alTitle?.native || miruroTitle?.native || "");
  const allanimeTitle = anime ? String(anime.englishName || anime.name || "") : "";
  const displayTitle = anilistTitle || allanimeTitle || "Unknown";

  const alImage = anilistMedia?.coverImage?.extraLarge || anilistMedia?.coverImage?.large || anilistInfo?.coverImage?.extraLarge || anilistInfo?.coverImage?.large || "";
  const image = alImage || miruroInfo?.coverImage?.extraLarge || miruroInfo?.coverImage?.large || anime?.thumbnail || "";
  // Banner priority:
  //   1. TMDB backdrop (highest quality, full-screen)
  //   2. AniList bannerImage (real anime banner)
  //   3. Miruro bannerImage
  //   4. AniList cover extraLarge (poster — better than nothing, fills the banner area)
  const banner = tmdbBackdrop || anilistMedia?.bannerImage || anilistInfo?.bannerImage || miruroInfo?.bannerImage || alImage || image;

  const alDesc = anilistMedia?.description?.replace(/<[^>]*>/g, "") || anilistInfo?.description?.replace(/<[^>]*>/g, "") || "";
  const miruroDesc = miruroInfo?.description?.replace(/<[^>]*>/g, "") || "";
  const allanimeDesc = anime?.description || "";
  const description = alDesc || miruroDesc || allanimeDesc;

  const alScoreRaw = anilistMedia?.averageScore ?? anilistInfo?.averageScore ?? miruroInfo?.averageScore ?? null;
  const anilistScore = alScoreRaw ? (alScoreRaw > 20 ? alScoreRaw / 10 : alScoreRaw) : null;
  const anilistScorePct = alScoreRaw ? (alScoreRaw > 20 ? alScoreRaw : alScoreRaw * 10) : null;

  const rawGenres: any[] = anilistMedia?.genres || anilistInfo?.genres || miruroInfo?.genres || anime?.genres || [];
  const allGenres: string[] = rawGenres.filter((g: any) => typeof g === "string").map((g: string) => g);

  const status = String(anilistMedia?.status || anilistInfo?.status || miruroInfo?.status || anime?.status || "");
  const type = String(anilistMedia?.format || anilistInfo?.format || miruroInfo?.format || miruroInfo?.type || anime?.type || "");
  const alSeason = (anilistMedia?.season || anilistInfo?.season) && (anilistMedia?.seasonYear || anilistInfo?.seasonYear)
    ? `${anilistMedia?.season || anilistInfo?.season} ${anilistMedia?.seasonYear || anilistInfo?.seasonYear}` : "";
  const season = alSeason || (miruroInfo?.season && miruroInfo?.seasonYear ? `${miruroInfo.season} ${miruroInfo.seasonYear}` : "") || anime?.season || "";
  const episodesCount = totalEpisodes || anilistMedia?.episodes || anilistInfo?.episodes || miruroInfo?.episodes || (anime as any)?.episodeCount || null;
  const studioNames = anilistStudios.filter(s => s.isAnimationStudio).map(s => s.name);
  const duration = anilistMedia?.duration || anilistInfo?.duration || null;
  const country = anilistMedia?.countryOfOrigin || anilistInfo?.countryOfOrigin || "";

  const hasMiruroEps = miruroEps.sub.length > 0 || miruroEps.dub.length > 0;
  const currentEps = hasMiruroEps
    ? (activeEpiTab === "dub" && miruroEps.dub.length > 0 ? miruroEps.dub : miruroEps.sub)
    : episodes;
  const hasAnyEpisodes = episodes.length > 0 || hasMiruroEps || (episodesCount != null && episodesCount > 0);

  const searchLower = epSearch.toLowerCase();
  const filteredEps = (hasMiruroEps ? currentEps : episodes).filter((ep: any) => {
    if (!epSearch) return true;
    const epNum = hasMiruroEps ? ep.number : ep.episodeIdNum;
    const epTitle = hasMiruroEps ? (ep.title || "") : (ep.title || ep.notes || "");
    return String(epNum).includes(searchLower) || epTitle.toLowerCase().includes(searchLower);
  });
  const paginatedEps = filteredEps.slice(0, epPage * EPS_PER_PAGE);

  // (Tab logic removed — single-scroll editorial layout)

  const handleWatch = (episodeNum: number) => {
    const watchId = anilistId ? String(anilistId) : animeId;
    navigate({ page: "watch", id: watchId, episode: episodeNum, title: displayTitle, image });
  };

  const bookmarked = bookmarks.some(b => b.animeId === animeId);
  const toggleBookmark = () => {
    if (bookmarked) {
      setBookmarks(bookmarks.filter(b => b.animeId !== animeId));
    } else {
      setBookmarks([...bookmarks, { id: animeId, animeId, animeName: displayTitle, thumbnail: image, score: anilistScore || 0, type: type || "TV", status: "", createdAt: new Date().toISOString() }]);
    }
  };

  const hasTrailer = anilistTrailer && anilistTrailer.site === "youtube";

  // ============================================================
  // RENDER — Animetsu faithful copy
  // Blurred banner backdrop + left sidebar (poster + metadata) +
  // right main (title + genres + buttons + synopsis) + tab bar +
  // episode grid with thumbnails. Pure B/W.
  // ============================================================

  const GROTESK = "var(--font-space-grotesk), 'Space Grotesk', sans-serif";
  const INTER = "var(--font-inter), 'Inter', sans-serif";

  const tabs: Array<{ id: DetailTab; label: string }> = [
    { id: "episodes", label: "Episodes" },
    { id: "characters", label: "Characters" },
    { id: "seasons", label: "Seasons" },
    { id: "music", label: "Music" },
    { id: "related", label: "Related" },
    { id: "morelikethis", label: "More like this" },
  ];

  return (
    <div className="min-h-screen bg-black text-white relative" style={{ fontFamily: INTER }}>

      {/* ═══ BANNER — full screen, truly full-bleed (zero padding) ═══ */}
      {banner && (
        <div className="fixed top-0 left-0 w-full h-screen overflow-hidden z-0">
          <img src={banner} alt="" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />
        </div>
      )}

      {/* ═══ MAIN CONTENT WRAPPER — no padding, full bleed ═══ */}
      <div className="flex w-full flex-col gap-y-4 relative z-10">

        {/* ═══ TWO-COLUMN LAYOUT: sidebar + main ═══ */}
        <div className="flex w-full max-lg:flex-col gap-4 xl:gap-6 mt-60 px-4 sm:px-6">

          {/* ═══ LEFT SIDEBAR — only render if image exists (prevents empty box) ═══ */}
          {image && (
          <aside className="hidden lg:flex w-50 xl:w-60 2xl:w-64 flex-col gap-4 shrink-0">
            {/* Poster */}
            {image && (
              <div className="aspect-[2/3] w-full bg-white/10 rounded-xl overflow-hidden">
                <img src={image} alt={displayTitle} className="w-full h-full object-cover" />
              </div>
            )}

            {/* Watch trailer button — always visible, film/play icon */}
            <button
              onClick={() => {
                const el = document.getElementById("trailer-section");
                if (el) el.scrollIntoView({ behavior: "smooth" });
              }}
              className="flex items-center justify-center gap-2 bg-white/8 hover:bg-white/10 ring-1 ring-white/12 rounded-xl h-8 px-4 w-full text-xs font-medium transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="4" width="20" height="16" rx="2" />
                <polygon points="10 9 15 12 10 15" fill="currentColor" stroke="none" />
              </svg>
              Watch trailer
            </button>

            {/* Metadata */}
            <div className="flex flex-col gap-4 w-full text-sm mt-2">
              {type && (
                <div className="flex flex-col gap-1">
                  <span className="font-bold text-white/60 text-xs uppercase tracking-wider" style={{ fontFamily: GROTESK }}>Format</span>
                  <span className="text-white">{type}</span>
                </div>
              )}
              {status && (
                <div className="flex flex-col gap-1">
                  <span className="font-bold text-white/60 text-xs uppercase tracking-wider" style={{ fontFamily: GROTESK }}>Status</span>
                  <span className="text-white">{statusLabel(status)}</span>
                </div>
              )}
              {season && (
                <div className="flex flex-col gap-1">
                  <span className="font-bold text-white/60 text-xs uppercase tracking-wider" style={{ fontFamily: GROTESK }}>Season</span>
                  <span className="text-white">{season.toUpperCase()}</span>
                </div>
              )}
              {anilistScore && (
                <div className="flex flex-col gap-1">
                  <span className="font-bold text-white/60 text-xs uppercase tracking-wider" style={{ fontFamily: GROTESK }}>Average score</span>
                  <span className="text-white">{anilistScorePct}%</span>
                </div>
              )}
              {source && (
                <div className="flex flex-col gap-1">
                  <span className="font-bold text-white/60 text-xs uppercase tracking-wider" style={{ fontFamily: GROTESK }}>Source</span>
                  <span className="text-white">{source.toUpperCase()}</span>
                </div>
              )}
              {studioNames.length > 0 && (
                <div className="flex flex-col gap-1">
                  <span className="font-bold text-white/60 text-xs uppercase tracking-wider" style={{ fontFamily: GROTESK }}>Studios</span>
                  <div className="flex flex-wrap gap-1.5">
                    {studioNames.map(s => (
                      <span key={s} className="px-2 py-1 ring-2 ring-white/15 ring-inset rounded text-xs font-medium">{s}</span>
                    ))}
                  </div>
                </div>
              )}
              {allGenres.length > 0 && (
                <div className="flex flex-col gap-1">
                  <span className="font-bold text-white/60 text-xs uppercase tracking-wider" style={{ fontFamily: GROTESK }}>Genres</span>
                  <div className="flex flex-wrap gap-1.5">
                    {allGenres.map(g => (
                      <span key={g} className="px-2 py-1 ring-2 ring-white/15 ring-inset rounded text-xs font-medium">{g}</span>
                    ))}
                  </div>
                </div>
              )}
              {/* Alternative titles */}
              {(anilistTitleRomaji || anilistTitleNative) && (
                <div className="flex flex-col gap-3 mt-2 pt-3 border-t border-white/10">
                  {anilistTitleRomaji && anilistTitleRomaji !== displayTitle && (
                    <div className="flex flex-col gap-1">
                      <span className="font-bold text-white/60 text-xs uppercase tracking-wider" style={{ fontFamily: GROTESK }}>Romaji</span>
                      <span className="text-white text-sm">{anilistTitleRomaji}</span>
                    </div>
                  )}
                  {anilistTitleNative && (
                    <div className="flex flex-col gap-1">
                      <span className="font-bold text-white/60 text-xs uppercase tracking-wider" style={{ fontFamily: GROTESK }}>Native</span>
                      <span className="text-white text-sm">{anilistTitleNative}</span>
                    </div>
                  )}
                  {allanimeTitle && allanimeTitle !== displayTitle && allanimeTitle !== anilistTitleRomaji && (
                    <div className="flex flex-col gap-1">
                      <span className="font-bold text-white/60 text-xs uppercase tracking-wider" style={{ fontFamily: GROTESK }}>English</span>
                      <span className="text-white text-sm">{allanimeTitle}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </aside>
          )}

          {/* ═══ RIGHT MAIN COLUMN ═══ */}
          <div className="flex flex-col grow gap-8">

            {/* ─── TITLE + GENRES + BUTTONS + SYNOPSIS ─── */}
            <div className="flex w-full flex-col gap-7">

              {/* Mobile poster (visible only on mobile/tablet) */}
              {image && (
                <div className="lg:hidden flex justify-center">
                  <div className="w-36 sm:w-46 aspect-[2/3] bg-white/10 rounded-xl overflow-hidden">
                    <img src={image} alt={displayTitle} className="w-full h-full object-cover" />
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-6 max-md:items-center">

                {/* Title + season */}
                <div className="flex flex-col gap-2 max-md:items-center">
                  {/* Season — small, above title */}
                  {season && (
                    <div className="text-sm lg:text-base text-white/50 order-first" style={{ fontFamily: GROTESK }}>
                      {season.toUpperCase()}
                    </div>
                  )}
                  {/* Title */}
                  {tmdbLogo ? (
                    <img src={tmdbLogo} alt={displayTitle} className="max-w-[400px] max-h-[90px]" style={{ objectFit: "contain", objectPosition: "left" }} />
                  ) : (
                    <div className="text-xl md:text-2xl xl:text-3xl font-extrabold max-md:text-center" style={{ fontFamily: GROTESK }}>
                      {displayTitle}
                    </div>
                  )}
                </div>

                {/* Genre chips — Animetsu style (filled bg, black text) */}
                {allGenres.length > 0 && (
                  <div className="flex flex-wrap gap-3 justify-center md:justify-start">
                    {allGenres.slice(0, 5).map(g => (
                      <button
                        key={g}
                        onClick={() => navigate({ page: "genre", genre: g })}
                        className="text-xs rounded font-bold px-2 py-1 transition-opacity hover:opacity-75"
                        style={{ backgroundColor: "#e49343", color: "black" }}
                      >
                        {g}
                      </button>
                    ))}
                  </div>
                )}

                {/* Action buttons — Watch + Bookmark + Share + AniList + MAL */}
                <div className="flex items-center gap-2 justify-center md:justify-start">
                  {hasAnyEpisodes && (
                    <button
                      onClick={() => handleWatch(1)}
                      className="bg-white rounded-full w-30 h-9.5 text-black font-semibold flex items-center justify-center gap-2 transition-opacity hover:brightness-90"
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="black" stroke="currentColor" strokeWidth="2"><path d="M5 5a2 2 0 0 1 3.008-1.728l11.997 6.998a2 2 0 0 1 .003 3.458l-12 7A2 2 0 0 1 5 19z" /></svg>
                    </button>
                  )}
                  <button
                    onClick={toggleBookmark}
                    className="rounded-full backdrop-blur-lg size-10 flex items-center justify-center bg-white/10 hover:bg-white/15 transition-colors"
                    title="Bookmark"
                  >
                    <svg width="18" height="18" fill={bookmarked ? "currentColor" : "transparent"} stroke="currentColor" strokeWidth="1.9" viewBox="0 0 24 24"><path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" /></svg>
                  </button>
                  <button
                    onClick={() => { if (navigator.share) navigator.share({ title: displayTitle, url: window.location.href }); else navigator.clipboard.writeText(window.location.href); }}
                    className="rounded-full backdrop-blur-lg size-10 flex items-center justify-center bg-white/10 hover:bg-white/15 transition-colors"
                    title="Share"
                  >
                    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" /></svg>
                  </button>
                  {anilistId && (
                    <a href={`https://anilist.co/anime/${anilistId}`} target="_blank" rel="noopener noreferrer" className="rounded-full backdrop-blur-lg size-10 flex items-center justify-center bg-[#02a9ff]/15 hover:bg-[#02a9ff]/30 transition-colors" title="AniList">
                      <svg viewBox="0 0 512 512" width="18" height="18"><path d="M321.92 323.27V136.6c0-10.698-5.887-16.602-16.558-16.602h-36.433c-10.672 0-16.561 5.904-16.561 16.602v88.651c0 2.497 23.996 14.089 24.623 16.541 18.282 71.61 3.972 128.92-13.359 131.6 28.337 1.405 31.455 15.064 10.348 5.731 3.229-38.209 15.828-38.134 52.049-1.406.31.317 7.427 15.282 7.87 15.282h85.545c10.672 0 16.558-5.9 16.558-16.6v-36.524c0-10.698-5.886-16.602-16.558-16.602z" fill="#02a9ff" /><path d="M170.68 120 74.999 393h74.338l16.192-47.222h80.96L262.315 393h73.968l-95.314-273zm11.776 165.28 23.183-75.629 25.393 75.629z" fill="#fefefe" /></svg>
                    </a>
                  )}
                  {anilistId && (
                    <a href={`https://myanimelist.net/anime/${anilistId}`} target="_blank" rel="noopener noreferrer" className="rounded-full backdrop-blur-lg size-10 flex items-center justify-center bg-[#2e51a2]/20 hover:bg-[#2e51a2]/40 transition-colors" title="MAL">
                      <svg viewBox="0 0 24 24" width="18" height="18"><path fill="#1159ff" d="M8.273 7.247v8.423l-2.103-.003v-5.216l-2.03 2.404-1.989-2.458-.02 5.285H.001L0 7.247h2.203l1.865 2.545 2.015-2.546 2.19.001zm8.628 2.069l.025 6.335h-2.365l-.008-2.871h-2.8c.07.499.21 1.266.417 1.779.155.381.298.751.583 1.128l-1.705 1.125c-.349-.636-.622-1.337-.878-2.082a9.296 9.296 0 0 1-.507-2.179c-.085-.75-.097-1.471.107-2.212a3.908 3.908 0 0 1 1.161-1.866c.313-.293.749-.5 1.1-.687.351-.187.743-.264 1.107-.359a7.405 7.405 0 0 1 1.191-.183c.398-.034 1.107-.066 2.39-.028l.545 1.749H14.51c-.593.008-.878.001-1.341.209a2.236 2.236 0 0 0-1.278 1.92l2.663.033.038-1.81h2.309zm3.992-2.099v6.627l3.107.032-.43 1.775h-4.807V7.187l2.13.03z" /></svg>
                    </a>
                  )}
                </div>
              </div>

              {/* Synopsis — 3-line clamp */}
              {description && (
                <div className="flex gap-3 flex-col w-full">
                  <p className={`text-sm font-medium text-white/70 w-full max-md:text-center line-clamp-3 ${synopsisExpanded ? "line-clamp-none" : ""}`}>
                    {description}
                  </p>
                  {description.length > 200 && (
                    <button onClick={() => setSynopsisExpanded(!synopsisExpanded)} className="text-xs font-bold text-white/50 hover:text-white transition-colors self-start">
                      {synopsisExpanded ? "Show Less" : "Read More"}
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* ═══ TAB BAR ═══ */}
            <div className="flex flex-col w-full">
              <div className="flex w-full overflow-x-auto text-sm font-medium h-12 border-b border-white/20">
                {tabs.map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`py-2 px-3 flex items-center justify-center h-12 border-b-2 shrink-0 transition-colors ${
                      activeTab === tab.id
                        ? "text-white border-white"
                        : "text-white/40 hover:text-white border-transparent"
                    }`}
                    style={{ fontFamily: GROTESK }}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* ═══ TAB CONTENT ═══ */}
              <div className="flex w-full py-6">

                {/* ─── EPISODES TAB ─── */}
                {activeTab === "episodes" && (
                  <div className="flex flex-col w-full gap-2">
                    {/* Controls row */}
                    <div className="flex items-center w-full gap-2 justify-between px-2 mb-2">
                      <span className="flex items-center justify-center gap-1 font-medium h-8 text-xs px-2 rounded-md bg-white/8 text-white/50">
                        {filteredEps.length || episodesCount || 0} Episodes
                      </span>
                      <div className="flex items-center gap-2 h-8 text-white/50 ml-auto">
                        {hasMiruroEps && miruroEps.dub.length > 0 && (
                          <div className="flex items-center gap-0 p-0.5 rounded-md bg-white/8">
                            {(["sub", "dub"] as const).map(tab => (
                              <button key={tab} onClick={() => setActiveEpiTab(tab)} className={`px-2 py-1 text-[10px] font-bold uppercase rounded transition-all ${activeEpiTab === tab ? "bg-white text-black" : "text-white/50"}`}>{tab}</button>
                            ))}
                          </div>
                        )}
                        <div className="relative w-28">
                          <svg className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
                          <input type="text" value={epSearch} onChange={e => { setEpSearch(e.target.value); setEpPage(1); }} placeholder="Find..." className="w-full pl-7 pr-2 h-8 text-[11px] bg-white/8 rounded-md text-white placeholder-white/30 focus:outline-none" />
                        </div>
                      </div>
                    </div>

                    {/* Episode grid — Animetsu style cards */}
                    {hasAnyEpisodes ? (
                      <div className="flex flex-wrap w-full gap-y-3">
                        {(episodes.length > 0 || hasMiruroEps ? paginatedEps : Array.from({ length: Math.min(episodesCount || 0, 30) }, (_, i) => i + 1)).map((ep: any, idx: number) => {
                          const epNum = typeof ep === "number" ? ep : (hasMiruroEps ? ep.number : ep.episodeIdNum);
                          const matchedApiEp = typeof ep === "object" && hasMiruroEps ? episodes.find((e: any) => e.episodeIdNum === epNum) : (typeof ep === "object" ? ep : null);
                          const epTitle = typeof ep === "object" ? (hasMiruroEps ? (ep.title || matchedApiEp?.title || matchedApiEp?.notes) : (ep.title || ep.notes)) : null;
                          const epThumb = typeof ep === "object" ? (hasMiruroEps ? (ep.thumbnail || matchedApiEp?.thumbnail || matchedApiEp?.thumbnails?.[0]) : (ep.thumbnail || ep.thumbnails?.[0])) : null;
                          const isNextEp = nextAiring && nextAiring.episode === epNum;
                          const fallbackImg = banner || image;
                          return (
                            <button
                              key={`ep-${epNum}-${idx}`}
                              onClick={() => handleWatch(epNum)}
                              className={`flex w-1/2 xs:w-1/3 md:w-1/4 xl:w-1/5 2xl:w-1/6 p-2 sm:p-2.5 shrink-0 group hover:ring-1 ring-white/15 hover:bg-white/10 rounded-2xl transition-all text-left ${isNextEp ? "ring-1 ring-white/30" : ""}`}
                            >
                              <div className="flex flex-col gap-2 w-full">
                                {/* Thumbnail */}
                                <div className="flex w-full aspect-video shrink-0 rounded-xl bg-white/10 overflow-hidden relative">
                                  {epThumb ? (
                                    <img src={epThumb} alt={`Ep ${epNum}`} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" referrerPolicy="no-referrer" />
                                  ) : fallbackImg ? (
                                    <img src={fallbackImg} alt={`Ep ${epNum}`} className="w-full h-full object-cover opacity-30" loading="lazy" referrerPolicy="no-referrer" />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center"><span className="text-lg font-extrabold text-white/10">{epNum}</span></div>
                                  )}
                                  {/* Play overlay */}
                                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center">
                                    <div className="w-9 h-9 rounded-full bg-white flex items-center justify-center opacity-0 group-hover:opacity-100 scale-75 group-hover:scale-100 transition-all">
                                      <svg className="w-4 h-4 text-black ml-0.5" fill="currentColor" viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3" /></svg>
                                    </div>
                                  </div>
                                  {/* EP number */}
                                  <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 text-[9px] font-extrabold rounded bg-black/80 text-white">Ep {epNum}</span>
                                  {isNextEp && <span className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 text-[8px] font-bold bg-white text-black rounded">● Next</span>}
                                </div>
                                {/* Title */}
                                <div className="text-xs font-medium text-white/80 line-clamp-1 group-hover:text-white transition-colors">
                                  {epTitle || `Episode ${epNum}`}
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-center py-12 text-white/40 text-sm">No episodes available</div>
                    )}

                    {filteredEps.length > epPage * EPS_PER_PAGE && (
                      <div className="flex justify-center mt-4">
                        <button onClick={() => setEpPage(p => p + 1)} className="px-5 py-2 text-xs font-bold text-white/60 hover:text-white bg-white/8 hover:bg-white/12 rounded-md transition-colors">Load More</button>
                      </div>
                    )}
                  </div>
                )}

                {/* ─── CHARACTERS TAB — Animetsu style horizontal rows ─── */}
                {activeTab === "characters" && (
                  <div className="w-full">
                    {characters.length > 0 ? (
                      <div className="flex flex-wrap w-full">
                        {characters.map((c: any) => {
                          const cImg = c.image?.large || c.image?.medium || "";
                          const va = c.voiceActors?.[0];
                          const vaImg = va?.image?.large || va?.image?.medium || "";
                          return (
                            <div key={c.id} className="flex w-full md:w-1/2 2xl:w-1/3 shrink-0 p-2 h-25">
                              <div className="flex w-full bg-white/10 rounded-xl overflow-hidden hover:bg-white/15 transition-colors">
                                {/* Character image (left) */}
                                <div className="flex h-full aspect-square bg-white/5 shrink-0">
                                  {cImg ? (
                                    <img src={cImg} alt={c.name.full} className="w-full h-full object-cover" loading="lazy" />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center text-xl text-white/15 font-bold">{c.name.full?.charAt(0) || "?"}</div>
                                  )}
                                </div>
                                {/* Names (middle) */}
                                <div className="flex flex-col justify-center gap-1 text-sm w-full p-3 min-w-0">
                                  <div className="flex flex-col gap-0.5">
                                    <span className="font-semibold text-white truncate">{c.name.full}</span>
                                    <span className="text-white/40 text-xs font-medium">{c.role === "MAIN" ? "MAIN" : "SUPPORTING"}</span>
                                  </div>
                                  {va && (
                                    <div className="flex flex-col gap-0.5 items-end text-right">
                                      <span className="font-semibold text-white truncate">{va.name.full}</span>
                                      <span className="text-white/40 text-xs font-medium">Japanese</span>
                                    </div>
                                  )}
                                </div>
                                {/* VA image (right) */}
                                {va && (
                                  <div className="flex h-full aspect-square bg-white/5 shrink-0">
                                    {vaImg ? (
                                      <img src={vaImg} alt={va.name.full} className="w-full h-full object-cover" loading="lazy" />
                                    ) : (
                                      <div className="w-full h-full flex items-center justify-center text-xl text-white/15 font-bold">{va.name.full?.charAt(0) || "?"}</div>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : <div className="text-center py-12 text-white/40 text-sm">No characters available</div>}
                  </div>
                )}

                {/* ─── SEASONS TAB — franchise seasons (sequels/prequels) ─── */}
                {activeTab === "seasons" && (
                  <div className="w-full">
                    {franchiseSeasons.length > 0 ? (
                      <div className="flex flex-col gap-4">
                        <p className="text-xs text-white/50">
                          {franchiseSeasons.length} {franchiseSeasons.length === 1 ? "season" : "seasons"} in this franchise. Click any season to view its details.
                        </p>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                          {franchiseSeasons.map((r: any, idx: number) => {
                            const rTitle = r.title?.english || r.title?.romaji || r.title?.native || "Unknown";
                            const rImg = r.coverImage?.extraLarge || r.coverImage?.large || r.coverImage?.medium || "";
                            return (
                              <button
                                key={`${r.id}-${idx}`}
                                onClick={() => navigate({ page: "anime", id: String(r.id) })}
                                className="group flex flex-col gap-2 text-left"
                              >
                                <div className="aspect-[2/3] rounded-lg overflow-hidden bg-white/10 relative">
                                  {rImg ? (
                                    <img src={rImg} alt={rTitle} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center text-white/15 font-bold text-xl">{rTitle.charAt(0)}</div>
                                  )}
                                  {/* Season number badge */}
                                  <span className="absolute top-1.5 left-1.5 px-2 py-0.5 text-[9px] font-extrabold rounded bg-black/80 text-white">
                                    {idx + 1}
                                  </span>
                                  {/* Episodes badge */}
                                  {r.episodes && (
                                    <span className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 text-[8px] font-bold rounded bg-black/80 text-white/80">
                                      {r.episodes} eps
                                    </span>
                                  )}
                                </div>
                                <div className="flex flex-col gap-0.5">
                                  <p className="text-[11px] font-semibold text-white line-clamp-2 group-hover:text-violet-300 transition-colors leading-tight">{rTitle}</p>
                                  {r.format && (
                                    <span className="text-[9px] text-white/40 uppercase tracking-wider">{r.format.replace(/_/g, " ")}</span>
                                  )}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-12">
                        <p className="text-white/40 text-sm">No seasons found</p>
                        <p className="text-white/30 text-xs mt-1">This anime may be a standalone series or seasons data hasn't loaded yet.</p>
                      </div>
                    )}
                  </div>
                )}

                {/* ─── MUSIC TAB — OP/ED themes from animethemes.moe ─── */}
                {activeTab === "music" && (
                  <div className="w-full">
                    <MusicTab
                      anilistId={anilistId}
                      currentTitle={displayTitle}
                      romajiTitle={anilistTitleRomaji}
                      seasons={franchiseSeasons}
                    />
                  </div>
                )}

                {/* ─── RELATED TAB ─── */}
                {activeTab === "related" && (
                  <div className="w-full space-y-6">
                    {franchiseSeasons.length > 0 && (
                      <div>
                        <h3 className="text-xs font-bold text-white/50 uppercase tracking-wider mb-3" style={{ fontFamily: GROTESK }}>Seasons</h3>
                        <div className="flex flex-wrap gap-3">
                          {franchiseSeasons.map((r: any) => {
                            const rTitle = r.title?.english || r.title?.romaji || r.title?.native || "Unknown";
                            const rImg = r.coverImage?.extraLarge || r.coverImage?.large || r.coverImage?.medium || "";
                            return (
                              <button key={r.id} onClick={() => navigate({ page: "anime", id: String(r.id) })} className="w-30 group hover:bg-white/5 rounded-xl p-1.5 transition-all text-left">
                                <div className="aspect-[2/3] rounded-lg overflow-hidden bg-white/10 mb-1.5">
                                  {rImg ? <img src={rImg} alt={rTitle} className="w-full h-full object-cover group-hover:scale-105 transition-transform" loading="lazy" /> : <div className="w-full h-full flex items-center justify-center text-white/15 font-bold text-xl">{rTitle.charAt(0)}</div>}
                                </div>
                                <p className="text-[10px] font-medium text-white/70 line-clamp-2 group-hover:text-white">{rTitle}</p>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    {franchiseRelated.length > 0 && (
                      <div>
                        <h3 className="text-xs font-bold text-white/50 uppercase tracking-wider mb-3" style={{ fontFamily: GROTESK }}>Related</h3>
                        <div className="flex flex-wrap gap-3">
                          {franchiseRelated.map((r: any) => {
                            const rTitle = r.title?.english || r.title?.romaji || r.title?.native || "Unknown";
                            const rImg = r.coverImage?.extraLarge || r.coverImage?.large || r.coverImage?.medium || "";
                            return (
                              <button key={r.id} onClick={() => navigate({ page: "anime", id: String(r.id) })} className="w-30 group hover:bg-white/5 rounded-xl p-1.5 transition-all text-left">
                                <div className="aspect-[2/3] rounded-lg overflow-hidden bg-white/10 mb-1.5">
                                  {rImg ? <img src={rImg} alt={rTitle} className="w-full h-full object-cover group-hover:scale-105 transition-transform" loading="lazy" /> : <div className="w-full h-full flex items-center justify-center text-white/15 font-bold text-xl">{rTitle.charAt(0)}</div>}
                                </div>
                                <p className="text-[10px] font-medium text-white/70 line-clamp-2 group-hover:text-white">{rTitle}</p>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    {franchiseSeasons.length === 0 && franchiseRelated.length === 0 && <div className="text-center py-12 text-white/40 text-sm">No related anime</div>}
                  </div>
                )}

                {/* ─── MORE LIKE THIS TAB ─── */}
                {activeTab === "morelikethis" && (
                  <div className="w-full">
                    {anilistRecommendations.length > 0 ? (
                      <div className="flex flex-wrap gap-3">
                        {anilistRecommendations.map((r: any) => {
                          const rTitle = r.title?.english || r.title?.romaji || r.title?.native || "Unknown";
                          const rImg = r.coverImage?.extraLarge || r.coverImage?.large || r.coverImage?.medium || "";
                          const rScore = r.averageScore ? (r.averageScore > 10 ? r.averageScore / 10 : r.averageScore) : null;
                          return (
                            <button key={r.id} onClick={() => navigate({ page: "anime", id: String(r.id) })} className="w-30 group hover:bg-white/5 rounded-xl p-1.5 transition-all text-left">
                              <div className="aspect-[2/3] rounded-lg overflow-hidden bg-white/10 mb-1.5 relative">
                                {rImg ? <img src={rImg} alt={rTitle} className="w-full h-full object-cover group-hover:scale-105 transition-transform" loading="lazy" /> : <div className="w-full h-full flex items-center justify-center text-white/15 font-bold text-xl">{rTitle.charAt(0)}</div>}
                                {rScore && <span className="absolute bottom-1 right-1 px-1 py-0.5 text-[8px] font-bold bg-black/80 text-white rounded">{rScore.toFixed(1)}</span>}
                              </div>
                              <p className="text-[10px] font-medium text-white/70 line-clamp-2 group-hover:text-white">{rTitle}</p>
                            </button>
                          );
                        })}
                      </div>
                    ) : <div className="text-center py-12 text-white/40 text-sm">No recommendations</div>}
                  </div>
                )}
              </div>
            </div>

            {/* Trailer section */}
            {hasTrailer && (
              <div id="trailer-section" className="flex flex-col gap-4">
                <h3 className="text-sm font-bold text-white/50 uppercase tracking-wider" style={{ fontFamily: GROTESK }}>Trailer</h3>
                <div className="relative w-full aspect-video max-w-2xl rounded-xl overflow-hidden bg-white/10">
                  <iframe src={`https://www.youtube.com/embed/${anilistTrailer!.id}?autoplay=0&rel=0&modestbranding=1&playsinline=1&origin=${typeof window !== 'undefined' ? window.location.origin : ''}`} className="w-full h-full" allowFullScreen allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerPolicy="strict-origin-when-cross-origin" title="Anime Trailer" />
                </div>
              </div>
            )}

            {/* Comments */}
            <div className="flex flex-col gap-4">
              <h3 className="text-sm font-bold text-white/50 uppercase tracking-wider" style={{ fontFamily: GROTESK }}>Comments</h3>
              <AnimeComments animeId={animeId} animeTitle={displayTitle} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// (Sub-components removed — everything inline)
