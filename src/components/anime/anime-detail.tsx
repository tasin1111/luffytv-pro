"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useAppStore, getAnimeTitle, getAnimeImage } from "./store";
import type { AnimeItem } from "./store";
import type { MiruroAnimeResult } from "@/lib/miruro-api";
import type { AniListMedia } from "@/lib/anilist-api";

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

type DetailTab = "overview" | "episodes" | "characters" | "trailer";

// ── Countdown Timer Component ──
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
    <div className="flex items-center gap-2 px-3 py-1.5 bg-[#FF8C00]/10 border border-[#FF8C00]/20 rounded-lg">
      <div className="w-2 h-2 rounded-full bg-[#FF8C00] animate-pulse" />
      <span className="text-[11px] text-[#FF8C00]/70 font-semibold">Ep {episode} in</span>
      <span className="text-[12px] font-extrabold text-[#FF8C00] tracking-wide font-mono">{timeLeft}</span>
    </div>
  );
}

// ── Circular Score Badge ──
function ScoreBadge({ score }: { score: number }) {
  const pct = score * 10; // score is 0-10, convert to 0-100
  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (pct / 100) * circumference;

  return (
    <div className="relative w-16 h-16 flex items-center justify-center">
      <svg className="w-16 h-16 -rotate-90" viewBox="0 0 64 64">
        <circle cx="32" cy="32" r={radius} fill="none" stroke="#1A1A1A" strokeWidth="4" />
        <circle
          cx="32" cy="32" r={radius} fill="none"
          stroke="#FFB800" strokeWidth="4"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-700"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-sm font-extrabold text-white leading-none">{pct}%</span>
      </div>
    </div>
  );
}

export default function AnimeDetailPage({ animeId }: AnimeDetailProps) {
  const navigate = useAppStore(s => s.navigate);
  const bookmarks = useAppStore(s => s.bookmarks);
  const setBookmarks = useAppStore(s => s.setBookmarks);

  // ── Core state (loaded first — instant display) ──
  const [anime, setAnime] = useState<AnimeItem | null>(null);
  const [miruroInfo, setMiruroInfo] = useState<MiruroAnimeResult | null>(null);
  const [anilistMedia, setAnilistMedia] = useState<AniListMedia | null>(null);
  const [anilistInfo, setAnilistInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [anilistId, setAnilistId] = useState<number | null>(null);
  const [totalEpisodes, setTotalEpisodes] = useState<number | null>(null);

  // ── Episodes (loaded with core) ──
  const [episodes, setEpisodes] = useState<EpisodeData[]>([]);
  const [miruroEps, setMiruroEps] = useState<MiruroEpData>({ sub: [], dub: [] });
  const [activeTab, setActiveTab] = useState<DetailTab>("overview");
  const [activeEpiTab, setActiveEpiTab] = useState<"sub" | "dub">("sub");

  // ── Deferred state (loaded after initial render) ──
  const [anilistRelations, setAnilistRelations] = useState<AniListRelation[]>([]);
  const [franchiseSeasons, setFranchiseSeasons] = useState<AniListRelation[]>([]);
  const [franchiseRelated, setFranchiseRelated] = useState<AniListRelation[]>([]);
  const [anilistRecommendations, setAnilistRecommendations] = useState<AniListRecommendation[]>([]);
  const [anilistStudios, setAnilistStudios] = useState<Array<{ id: number; name: string; isAnimationStudio: boolean }>>([]);
  const [anilistTrailer, setAnilistTrailer] = useState<{ id: string; site: string; thumbnail: string } | null>(null);
  const [deferredLoaded, setDeferredLoaded] = useState(false);

  // ── Next airing episode ──
  const [nextAiring, setNextAiring] = useState<{ episode: number; airingAt: number } | null>(null);

  // ── Characters (from info API — instant!) ──
  const [characters, setCharacters] = useState<CharacterData[]>([]);

  // ── Source info for metadata ──
  const [source, setSource] = useState<string>("");

  // ── UI state for expanded sections ──
  const [synopsisExpanded, setSynopsisExpanded] = useState(false);
  const [aliasesExpanded, setAliasesExpanded] = useState(false);
  const [showAllCharacters, setShowAllCharacters] = useState(false);
  const [charRoleFilter, setCharRoleFilter] = useState<"all" | "MAIN" | "SUPPORTING">("all");
  const [epSearch, setEpSearch] = useState("");
  const [epPage, setEpPage] = useState(1);
  const EPS_PER_PAGE = 24;

  // ── Reset all state when animeId changes ──
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAnime(null);
    setMiruroInfo(null);
    setAnilistMedia(null);
    setAnilistInfo(null);
    setAnilistId(null);
    setTotalEpisodes(null);
    setEpisodes([]);
    setMiruroEps({ sub: [], dub: [] });
    setActiveTab("overview");
    setActiveEpiTab("sub");
    setAnilistRelations([]);
    setFranchiseSeasons([]);
    setFranchiseRelated([]);
    setAnilistRecommendations([]);
    setAnilistStudios([]);
    setAnilistTrailer(null);
    setDeferredLoaded(false);
    setNextAiring(null);
    setCharacters([]);
    setSource("");
    setSynopsisExpanded(false);
    setAliasesExpanded(false);
    setShowAllCharacters(false);
    setCharRoleFilter("all");
    setEpSearch("");
    setEpPage(1);
  }, [animeId]);

  // ── Load core data — info first (instant), then episodes (progressive) ──
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);

      const cleanId = animeId.replace(/^miruro_/, "").replace(/^mal_/, "");
      if (/^\d+$/.test(cleanId)) setAnilistId(parseInt(cleanId));

      // Step 1: Load info FAST (1-2s) — show page immediately after this
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
            if (data.anilistInfo.trailer) {
              setAnilistTrailer(data.anilistInfo.trailer);
            }
            if (data.anilistInfo.nextAiringEpisode) {
              setNextAiring(data.anilistInfo.nextAiringEpisode);
            } else if (data.nextAiringEpisode) {
              setNextAiring(data.nextAiringEpisode);
            }
          }
          if (data.totalEpisodes != null && data.totalEpisodes > 0) setTotalEpisodes(data.totalEpisodes);
          if (data.anilistInfo?.source) setSource(data.anilistInfo.source);
        }
      } catch { /* info load failed */ }

      // Show the page NOW — info is loaded
      if (!cancelled) setLoading(false);

      // Step 2: Load episodes DIRECTLY from miruro.tv (no external API)
      try {
        // Resolve anilistId if not yet known
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
          const epRes = await fetch(`/api/anime/miruro-direct/episodes/${aid}`);
          if (epRes.ok && !cancelled) {
            const data = await epRes.json();
            // Merge sub + dub episodes
            const subEps = data.sub || [];
            const dubEps = data.dub || [];
            const all = new Map<number, EpisodeData>();
            for (const ep of subEps) {
              all.set(Number(ep.number), {
                episodeIdNum: Number(ep.number),
                title: ep.title || `Episode ${ep.number}`,
                thumbnail: ep.thumbnail || ep.image || null,
                description: ep.description || null,
                source: "miruro",
                subSlug: ep.id || ep.slug || String(ep.number),
              });
            }
            for (const ep of dubEps) {
              const num = Number(ep.number);
              if (!all.has(num)) {
                all.set(num, {
                  episodeIdNum: num,
                  title: ep.title || `Episode ${ep.number}`,
                  thumbnail: ep.thumbnail || ep.image || null,
                  description: ep.description || null,
                  source: "miruro",
                  subSlug: ep.id || ep.slug || String(ep.number),
                });
              }
            }
            const episodes = Array.from(all.values()).sort((a, b) => a.episodeIdNum - b.episodeIdNum);
            if (episodes.length > 0) {
              setEpisodes(episodes);
            }
            const epTotal = data.totalEpisodes ?? episodes.length;
            if (epTotal && !cancelled) setTotalEpisodes(epTotal);
          }
        }
      } catch { /* episodes load failed */ }
    }
    load();
    return () => { cancelled = true; };
  }, [animeId]);

  // ── Load full franchise in background (non-blocking) ──
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
            const seasons = data.seasons.map(mapRelation);
            const related = data.related.map(mapRelation);
            setFranchiseSeasons(seasons);
            setFranchiseRelated(related);
            setAnilistRelations([...seasons, ...related]);
          }
        }
      } catch { /* ignore */ }
    }
    loadFranchise();
  }, [anilistId]);

  // ── Load deferred data (only if info API didn't provide it) ──
  useEffect(() => {
    if (!anilistId) return;
    if (anilistRelations.length > 0 || characters.length > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDeferredLoaded(true);
      return;
    }
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
      setDeferredLoaded(true);
    }
    loadDeferred();
  }, [anilistId]);

  // ── Loading skeleton ──
  if (loading) {
    return (
      <div className="fade-in">
        <div className="relative h-[420px] bg-[#1A1A1A] animate-pulse" />
        <div className="px-4 sm:px-6 lg:px-12 -mt-24 relative z-10">
          <div className="flex flex-col md:flex-row gap-6">
            <div className="w-[180px] sm:w-[200px] aspect-[2/3] bg-[#1A1A1A] rounded-xl animate-pulse shrink-0" />
            <div className="flex-1 space-y-3 pt-4">
              <div className="h-5 w-32 bg-[#1A1A1A] rounded animate-pulse" />
              <div className="h-8 w-72 bg-[#1A1A1A] rounded animate-pulse" />
              <div className="h-4 w-48 bg-[#1A1A1A] rounded animate-pulse" />
              <div className="flex gap-2 mt-4">
                <div className="h-10 w-32 bg-[#1A1A1A] rounded-lg animate-pulse" />
                <div className="h-10 w-28 bg-[#1A1A1A] rounded-lg animate-pulse" />
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
  const banner = anilistMedia?.bannerImage || anilistInfo?.bannerImage || miruroInfo?.bannerImage || image;

  const alDesc = anilistMedia?.description?.replace(/<[^>]*>/g, "") || anilistInfo?.description?.replace(/<[^>]*>/g, "") || "";
  const miruroDesc = miruroInfo?.description?.replace(/<[^>]*>/g, "") || "";
  const allanimeDesc = anime?.description || "";
  const description = alDesc || miruroDesc || allanimeDesc;

  const alScoreRaw = anilistMedia?.averageScore ?? anilistInfo?.averageScore ?? miruroInfo?.averageScore ?? null;
  const anilistScore = alScoreRaw ? (alScoreRaw > 20 ? alScoreRaw / 10 : alScoreRaw) : null;

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

  // ── Episode search & pagination ──
  const searchLower = epSearch.toLowerCase();
  const filteredEps = (hasMiruroEps ? currentEps : episodes).filter((ep: any) => {
    if (!epSearch) return true;
    const epNum = hasMiruroEps ? ep.number : ep.episodeIdNum;
    const epTitle = hasMiruroEps ? (ep.title || "") : (ep.title || ep.notes || "");
    return String(epNum).includes(searchLower) || epTitle.toLowerCase().includes(searchLower);
  });
  const totalPages = Math.ceil(filteredEps.length / EPS_PER_PAGE);
  const paginatedEps = filteredEps.slice(0, epPage * EPS_PER_PAGE);

  // ── Characters filter ──
  const filteredChars = charRoleFilter === "all"
    ? characters
    : characters.filter(c => c.role === charRoleFilter);
  const visibleChars = showAllCharacters ? filteredChars : filteredChars.slice(0, 12);

  // ── Alternative titles ──
  const altTitles: Array<{ label: string; value: string }> = [];
  if (anilistTitleRomaji && anilistTitleRomaji !== displayTitle) altTitles.push({ label: "Romaji", value: anilistTitleRomaji });
  if (anilistTitleNative) altTitles.push({ label: "Native", value: anilistTitleNative });
  if (anilistTitle && anilistTitle !== displayTitle && anilistTitle !== anilistTitleRomaji) altTitles.push({ label: "English", value: anilistTitle });
  if (allanimeTitle && allanimeTitle !== displayTitle && allanimeTitle !== anilistTitle && allanimeTitle !== anilistTitleRomaji) altTitles.push({ label: "Alternative", value: allanimeTitle });

  const handleWatch = (episodeNum: number) => {
    const watchId = anilistId ? String(anilistId) : animeId;
    navigate({ page: "watch", id: watchId, episode: episodeNum, title: displayTitle, image });
  };

  const bookmarked = bookmarks.some(b => b.animeId === animeId);
  const toggleBookmark = () => {
    if (bookmarked) {
      setBookmarks(bookmarks.filter(b => b.animeId === animeId));
    } else {
      setBookmarks([...bookmarks, { id: animeId, animeId, animeName: displayTitle, thumbnail: image, score: anilistScore || 0, type: type || "TV", status: "", createdAt: new Date().toISOString() }]);
    }
  };

  const hasTrailer = anilistTrailer && anilistTrailer.site === "youtube";

  // ── Status color helper ──
  const statusColor = (s: string) => {
    if (s === "RELEASING") return { bg: "bg-[#00D4AA]/15", text: "text-[#00D4AA]", border: "border-[#00D4AA]/20" };
    if (s === "FINISHED") return { bg: "bg-[#4A90E2]/15", text: "text-[#4A90E2]", border: "border-[#4A90E2]/20" };
    if (s === "NOT_YET_RELEASED") return { bg: "bg-[#FF8C00]/15", text: "text-[#FF8C00]", border: "border-[#FF8C00]/20" };
    return { bg: "bg-white/[0.06]", text: "text-[#AAAAAA]", border: "border-white/[0.08]" };
  };
  const statusLabel = (s: string) => {
    if (s === "RELEASING") return "Airing";
    if (s === "FINISHED") return "Complete";
    if (s === "NOT_YET_RELEASED") return "Upcoming";
    return s;
  };

  // ── Render ──
  return (
    <div className="fade-in bg-[#0D0D0D] min-h-screen">

      {/* ═══════════════════════════════════════════════════════
          HERO SECTION — Full-width banner with overlaid content
          ═══════════════════════════════════════════════════════ */}
      <div className="relative overflow-hidden">
        {/* Banner background */}
        <div className="absolute inset-0">
          {banner && <img src={banner} alt="" className="w-full h-full object-cover" />}
          <div className="absolute inset-0 bg-gradient-to-t from-[#0D0D0D] via-[#0D0D0D]/85 to-[#0D0D0D]/50" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#0D0D0D]/90 via-transparent to-transparent" />
        </div>

        {/* Hero content */}
        <div className="relative px-4 sm:px-6 lg:px-12 pt-20 sm:pt-24 pb-8 flex flex-col md:flex-row gap-6 lg:gap-10">

          {/* Poster */}
          {image && (
            <div className="relative shrink-0 w-[160px] sm:w-[190px] md:w-[210px] self-center md:self-end">
              <img
                src={image}
                alt={displayTitle}
                className="w-full aspect-[2/3] object-cover rounded-xl border border-white/[0.08] shadow-[0_8px_40px_rgba(0,0,0,0.7)]"
              />
              {/* Score badge — circular gold ring */}
              {anilistScore && (
                <div className="absolute -bottom-4 left-1/2 -translate-x-1/2">
                  <ScoreBadge score={anilistScore} />
                </div>
              )}
            </div>
          )}

          {/* Info section overlaid on banner */}
          <div className="flex flex-col items-center md:items-start text-center md:text-left flex-1 min-w-0 pb-6">
            {/* Native/Japanese title */}
            {anilistTitleNative && (
              <p className="text-[11px] sm:text-xs text-[#666666] tracking-wide mb-1 font-medium">{anilistTitleNative}</p>
            )}

            {/* English title — large */}
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white leading-tight mb-2">{displayTitle}</h1>

            {/* Romaji title if different */}
            {anilistTitleRomaji && anilistTitleRomaji !== displayTitle && (
              <p className="text-xs sm:text-sm text-[#AAAAAA] mb-3 line-clamp-1">{anilistTitleRomaji}</p>
            )}

            {/* Metadata pills row */}
            <div className="flex items-center justify-center md:justify-start gap-2 flex-wrap mb-4">
              {season && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold bg-white/[0.06] text-[#AAAAAA] rounded-md border border-white/[0.08]">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>
                  {season}
                </span>
              )}
              {type && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold bg-white/[0.06] text-[#AAAAAA] rounded-md border border-white/[0.08]">
                  {type}
                </span>
              )}
              {episodesCount && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold bg-white/[0.06] text-[#AAAAAA] rounded-md border border-white/[0.08]">
                  {episodesCount} Ep{episodesCount !== 1 ? "s" : ""}
                </span>
              )}
              {status && (() => {
                const sc = statusColor(status);
                return (
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold rounded-md border ${sc.bg} ${sc.text} ${sc.border}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${status === "RELEASING" ? "bg-[#00D4AA] animate-pulse" : status === "FINISHED" ? "bg-[#4A90E2]" : "bg-[#FF8C00]"}`} />
                    {statusLabel(status)}
                  </span>
                );
              })()}
            </div>

            {/* Genre tags */}
            {allGenres.length > 0 && (
              <div className="flex items-center justify-center md:justify-start gap-1.5 flex-wrap mb-5">
                {allGenres.map(g => (
                  <button
                    key={g}
                    onClick={() => navigate({ page: "genre", genre: g })}
                    className="px-2.5 py-0.5 text-[10px] font-semibold bg-[#E63946]/10 text-[#E63946]/80 rounded-full border border-[#E63946]/15 hover:bg-[#E63946]/20 hover:text-[#E63946] transition-all"
                  >
                    {g}
                  </button>
                ))}
              </div>
            )}

            {/* Action buttons row */}
            <div className="flex items-center justify-center md:justify-start gap-2.5 flex-wrap mb-4">
              {/* Watch Now — Red solid */}
              {hasAnyEpisodes && (
                <button
                  onClick={() => handleWatch(1)}
                  className="inline-flex items-center gap-2 px-7 py-2.5 bg-[#E63946] text-white text-sm font-bold rounded-lg hover:bg-[#E63946]/80 transition-all shadow-lg shadow-[#E63946]/20 active:scale-95"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3" /></svg>
                  Watch Now
                </button>
              )}
              {/* Add to List — Glass button */}
              <button
                onClick={toggleBookmark}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-white/[0.06] backdrop-blur-md text-white border border-white/[0.10] rounded-lg hover:bg-white/[0.12] transition-all text-sm font-medium"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill={bookmarked ? "#FFB800" : "none"} stroke={bookmarked ? "#FFB800" : "currentColor"} strokeWidth={2}>
                  <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                </svg>
                {bookmarked ? "In List" : "Add to List"}
              </button>
              {/* Share — Glass button */}
              <button
                onClick={() => {
                  if (navigator.share) {
                    navigator.share({ title: displayTitle, url: window.location.href });
                  } else {
                    navigator.clipboard.writeText(window.location.href);
                  }
                }}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-white/[0.06] backdrop-blur-md text-white border border-white/[0.10] rounded-lg hover:bg-white/[0.12] transition-all text-sm font-medium"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" /></svg>
                Share
              </button>
              {/* AniList — Outlined */}
              {anilistId && (
                <a
                  href={`https://anilist.co/anime/${anilistId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-transparent text-[#4A90E2] border border-[#4A90E2]/30 rounded-lg hover:bg-[#4A90E2]/10 transition-all text-sm font-medium"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M6.361 2.943L0 21.056h4.942l1.077-3.133H11.4l1.052 3.133H22.9c.71 0 1.1-.395 1.1-1.1V4.043c0-.71-.39-1.1-1.1-1.1h-4.465c-.71 0-1.1.39-1.1 1.1v8.076L11.26 2.943H6.361zm2.717 5.36l2.327 6.28H6.697l2.381-6.28z"/></svg>
                  AniList
                </a>
              )}
              {/* MAL — Outlined */}
              {anilistId && (
                <a
                  href={`https://myanimelist.net/anime/${anilistId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-transparent text-[#4A90E2] border border-[#4A90E2]/30 rounded-lg hover:bg-[#4A90E2]/10 transition-all text-sm font-medium"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M8.273 7.247v8.423l-2.103-.003v-5.216l-2.03 2.404-1.989-2.458-.02 5.285H.001L0 7.247h2.203l1.865 2.545 2.015-2.546 2.19.001zm5.828 0v8.423H12l-.023-3.75-1.696 3.75H8.69l-1.67-3.75v3.75H4.863V7.247h2.46l2.123 4.444 2.126-4.444h2.529z"/></svg>
                  MAL
                </a>
              )}
            </div>

            {/* Next Episode Countdown */}
            {nextAiring && (
              <CountdownTimer airingAt={nextAiring.airingAt} episode={nextAiring.episode} />
            )}
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════
          TAB BAR — Glass style with red bottom border
          ═══════════════════════════════════════════════════════ */}
      <div className="sticky top-0 z-30 bg-[#0D0D0D]/95 backdrop-blur-lg border-b border-white/[0.06]">
        <div className="w-full px-4 sm:px-6 lg:px-12">
          <div className="flex items-center gap-0">
            {([
              { id: "overview" as DetailTab, label: "Overview" },
              { id: "episodes" as DetailTab, label: "Episodes", badge: episodesCount || (hasMiruroEps ? currentEps.length : episodes.length) || undefined },
              { id: "characters" as DetailTab, label: "Characters", badge: characters.length || undefined },
              ...(hasTrailer ? [{ id: "trailer" as DetailTab, label: "Trailer" }] : []),
            ]).map(tab => (
              <button
                key={tab.id}
                onClick={() => { setActiveTab(tab.id); setEpPage(1); }}
                className={`relative flex items-center justify-center gap-2 px-5 py-3.5 text-[12px] font-bold transition-all ${
                  activeTab === tab.id
                    ? "text-white"
                    : "text-[#666666] hover:text-[#AAAAAA]"
                }`}
              >
                {tab.label}
                {tab.badge && (
                  <span className={`px-1.5 py-0.5 text-[9px] font-bold rounded ${
                    activeTab === tab.id ? "bg-[#E63946]/20 text-[#E63946]" : "bg-white/[0.06] text-[#666666]"
                  }`}>
                    {tab.badge}
                  </span>
                )}
                {/* Red bottom border for active tab */}
                {activeTab === tab.id && (
                  <span className="absolute bottom-0 left-2 right-2 h-[2px] bg-[#E63946] rounded-full" />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════
          TAB CONTENT
          ═══════════════════════════════════════════════════════ */}
      <div className="w-full px-4 sm:px-6 lg:px-12 py-6 pb-16">

        {/* ─── OVERVIEW TAB ─── */}
        {activeTab === "overview" && (
          <div className="space-y-8 fade-in">

            {/* Synopsis with Show More */}
            {description && (
              <div>
                <h3 className="text-xs font-bold text-[#666666] uppercase tracking-wider mb-2">Synopsis</h3>
                <p className={`text-sm text-[#AAAAAA] leading-relaxed max-w-4xl ${!synopsisExpanded ? "line-clamp-4" : ""}`}>
                  {description}
                </p>
                {description.length > 200 && (
                  <button
                    onClick={() => setSynopsisExpanded(!synopsisExpanded)}
                    className="mt-1.5 text-xs font-semibold text-[#E63946] hover:text-[#E63946]/80 transition-colors"
                  >
                    {synopsisExpanded ? "Show Less" : "Show More"}
                  </button>
                )}
              </div>
            )}

            {/* Also Known As */}
            {altTitles.length > 0 && (
              <div>
                <h3 className="text-xs font-bold text-[#666666] uppercase tracking-wider mb-2">Also Known As</h3>
                <div className="flex flex-col gap-1.5">
                  {(aliasesExpanded ? altTitles : altTitles.slice(0, 2)).map(t => (
                    <div key={t.label} className="flex items-start gap-3">
                      <span className="shrink-0 px-2 py-0.5 text-[9px] font-bold bg-white/[0.06] text-[#666666] rounded border border-white/[0.06] uppercase">{t.label}</span>
                      <span className="text-sm text-[#AAAAAA]">{t.value}</span>
                    </div>
                  ))}
                </div>
                {altTitles.length > 2 && (
                  <button
                    onClick={() => setAliasesExpanded(!aliasesExpanded)}
                    className="mt-1.5 text-xs font-semibold text-[#E63946] hover:text-[#E63946]/80 transition-colors"
                  >
                    {aliasesExpanded ? "Show Less" : `+${altTitles.length - 2} more`}
                  </button>
                )}
              </div>
            )}

            {/* Info Grid — two-column with icons */}
            <div>
              <h3 className="text-xs font-bold text-[#666666] uppercase tracking-wider mb-3">Information</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {[
                  { icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><rect x="2" y="2" width="20" height="20" rx="2.18" /><line x1="7" y1="2" x2="7" y2="22" /><line x1="17" y1="2" x2="17" y2="22" /><line x1="2" y1="12" x2="22" y2="12" /></svg>, label: "Format", value: type },
                  { icon: <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3" /></svg>, label: "Episodes", value: episodesCount ? String(episodesCount) : "" },
                  { icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>, label: "Duration", value: duration ? `${duration} min` : "" },
                  { icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>, label: "Status", value: status ? statusLabel(status) : "", color: status ? statusColor(status).text : "" },
                  { icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /></svg>, label: "Source", value: source },
                  { icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>, label: "Season", value: season },
                  { icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" /></svg>, label: "Studios", value: studioNames.length > 0 ? studioNames.join(", ") : "" },
                  { icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></svg>, label: "Country", value: country },
                ].filter(item => item.value).map(item => (
                  <div key={item.label} className="flex items-start gap-2.5 p-3 bg-[#1A1A1A] rounded-lg border border-white/[0.06]">
                    <span className={item.color || "text-[#666666]"}>{item.icon}</span>
                    <div className="min-w-0">
                      <p className="text-[9px] text-[#666666] uppercase tracking-wider font-bold">{item.label}</p>
                      <p className={`text-sm font-medium mt-0.5 ${item.color || "text-[#AAAAAA]"}`}>{item.value}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* ═══════════════════════════════════════════════════
                SEASONS — Franchise with relation type badges
                ═══════════════════════════════════════════════════ */}
            {franchiseSeasons.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-1 h-5 rounded-full bg-[#E63946]" />
                    <h3 className="text-sm text-white font-bold">Seasons</h3>
                    <span className="text-[10px] text-[#666666] ml-1">({franchiseSeasons.length})</span>
                  </div>
                </div>
                <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide" style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}>
                  {franchiseSeasons.map(r => {
                    const rTitle = r.title?.english || r.title?.romaji || r.title?.native || "Unknown";
                    const rImg = r.coverImage?.extraLarge || r.coverImage?.large || r.coverImage?.medium || "";
                    const isSequel = r.relationType === "SEQUEL";
                    const isPrequel = r.relationType === "PREQUEL";
                    return (
                      <button
                        key={r.id}
                        onClick={() => navigate({ page: "anime", id: String(r.id) })}
                        className="group relative shrink-0 w-[160px] sm:w-[180px] rounded-lg overflow-hidden border border-white/[0.06] hover:border-[#E63946]/30 transition-all"
                      >
                        <div className="relative w-full aspect-[3/4] bg-[#1A1A1A] overflow-hidden">
                          {rImg ? (
                            <img src={rImg} alt={rTitle} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-white/10 font-bold text-lg">{rTitle.charAt(0)}</div>
                          )}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
                          {/* Relation type badge */}
                          <span className={`absolute top-2 right-2 px-1.5 py-0.5 text-[8px] font-bold rounded ${
                            isSequel ? "bg-[#E63946]/90 text-white" :
                            isPrequel ? "bg-[#9333EA]/90 text-white" :
                            "bg-white/15 text-white/70 backdrop-blur-sm"
                          }`}>
                            {r.relationType?.replace(/_/g, " ")}
                          </span>
                          {/* Info at bottom */}
                          <div className="absolute bottom-0 left-0 right-0 p-2.5">
                            <p className="text-[11px] font-bold text-white line-clamp-2 group-hover:text-[#E63946] transition-colors leading-tight">{rTitle}</p>
                            <div className="flex items-center gap-2 mt-1">
                              {r.format && <span className="text-[8px] text-white/40 font-medium">{r.format}</span>}
                              {r.episodes && <span className="text-[8px] text-white/30">{r.episodes} eps</span>}
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ═══════════════════════════════════════════════════
                CHARACTERS — Preview (first 8 with show more)
                ═══════════════════════════════════════════════════ */}
            {characters.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-1 h-5 rounded-full bg-[#FFB800]" />
                    <h3 className="text-sm text-white font-bold">Characters</h3>
                    <span className="text-[10px] text-[#666666] ml-1">({characters.length})</span>
                  </div>
                  {characters.length > 8 && (
                    <button
                      onClick={() => setActiveTab("characters")}
                      className="text-[11px] font-semibold text-[#E63946] hover:text-[#E63946]/80 transition-colors"
                    >
                      View All →
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2.5">
                  {characters.slice(0, 8).map(c => {
                    const cImg = c.image?.large || c.image?.medium || "";
                    const va = c.voiceActors?.[0];
                    return (
                      <div
                        key={c.id}
                        className="bg-[#1A1A1A] rounded-lg border border-white/[0.06] overflow-hidden group hover:border-[#FFB800]/20 transition-all"
                      >
                        <div className="relative w-full aspect-[3/4] overflow-hidden bg-[#0D0D0D]">
                          {cImg ? (
                            <img src={cImg} alt={c.name.full} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-sm text-white/10 font-bold">{c.name.full?.charAt(0) || "?"}</div>
                          )}
                          <span className={`absolute top-1 left-1 px-1.5 py-0.5 text-[7px] font-bold rounded ${
                            c.role === "MAIN" ? "bg-[#E63946]/80 text-white" : "bg-white/15 text-white/60 backdrop-blur-sm"
                          }`}>
                            {c.role === "MAIN" ? "Main" : "Supporting"}
                          </span>
                        </div>
                        <div className="p-1.5">
                          <p className="text-[10px] font-semibold text-[#AAAAAA] line-clamp-1 group-hover:text-[#FFB800] transition-colors leading-tight">{c.name.full}</p>
                          {va && (
                            <p className="text-[8px] text-[#666666] line-clamp-1 mt-0.5">{va.name.full}</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ═══════════════════════════════════════════════════
                RELATED — spin-offs, adaptations, side stories
                ═══════════════════════════════════════════════════ */}
            {franchiseRelated.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-1 h-5 rounded-full bg-[#4A90E2]" />
                  <h3 className="text-sm text-white font-bold">Related</h3>
                  <span className="text-[10px] text-[#666666] ml-1">({franchiseRelated.length})</span>
                </div>
                <div className="flex gap-3 overflow-x-auto pb-2" style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}>
                  {franchiseRelated.map(r => {
                    const rTitle = r.title?.english || r.title?.romaji || r.title?.native || "Unknown";
                    const rImg = r.coverImage?.extraLarge || r.coverImage?.large || r.coverImage?.medium || "";
                    return (
                      <button
                        key={r.id}
                        onClick={() => navigate({ page: "anime", id: String(r.id) })}
                        className="group relative shrink-0 w-[160px] sm:w-[180px] rounded-lg overflow-hidden border border-white/[0.06] hover:border-[#4A90E2]/30 transition-all"
                      >
                        <div className="relative w-full aspect-[3/4] bg-[#1A1A1A] overflow-hidden">
                          {rImg ? (
                            <img src={rImg} alt={rTitle} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-white/10 font-bold text-lg">{rTitle.charAt(0)}</div>
                          )}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
                          <span className="absolute top-2 right-2 px-1.5 py-0.5 text-[8px] font-bold rounded bg-white/15 text-white/70 backdrop-blur-sm">
                            {r.relationType?.replace(/_/g, " ")}
                          </span>
                          <div className="absolute bottom-0 left-0 right-0 p-2.5">
                            <p className="text-[11px] font-bold text-white line-clamp-2 group-hover:text-[#4A90E2] transition-colors leading-tight">{rTitle}</p>
                            <div className="flex items-center gap-2 mt-1">
                              {r.format && <span className="text-[8px] text-white/40">{r.format}</span>}
                              {r.episodes && <span className="text-[8px] text-white/30">{r.episodes} eps</span>}
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ═══════════════════════════════════════════════════
                RECOMMENDATIONS
                ═══════════════════════════════════════════════════ */}
            {anilistRecommendations.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-1 h-5 rounded-full bg-[#00D4AA]" />
                  <h3 className="text-sm text-white font-bold">Recommendations</h3>
                  <span className="text-[10px] text-[#666666] ml-1">({anilistRecommendations.length})</span>
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-2.5">
                  {anilistRecommendations.slice(0, 16).map(r => {
                    const rTitle = r.title?.english || r.title?.romaji || r.title?.native || "Unknown";
                    const rImg = r.coverImage?.extraLarge || r.coverImage?.large || r.coverImage?.medium || "";
                    const rScore = r.averageScore ? (r.averageScore > 10 ? r.averageScore / 10 : r.averageScore) : null;
                    return (
                      <button
                        key={r.id}
                        onClick={() => navigate({ page: "anime", id: String(r.id) })}
                        className="group text-left"
                      >
                        <div className="aspect-[3/4] rounded-lg overflow-hidden border border-white/[0.06] bg-[#1A1A1A] mb-1.5 relative">
                          {rImg ? (
                            <img src={rImg} alt={rTitle} className="w-full h-full object-cover group-hover:scale-105 transition-transform" loading="lazy" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-xs text-white/20">{rTitle.charAt(0)}</div>
                          )}
                          {rScore && (
                            <span className="absolute bottom-1 right-1 px-1.5 py-0.5 text-[9px] font-bold bg-black/70 text-[#FFB800] rounded backdrop-blur-sm">{rScore.toFixed(1)}</span>
                          )}
                        </div>
                        <p className="text-[10px] text-[#AAAAAA] font-medium line-clamp-2 group-hover:text-[#E63946] transition-colors">{rTitle}</p>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ─── EPISODES TAB ─── */}
        {activeTab === "episodes" && (
          <div className="space-y-4 fade-in">
            {/* Sub/Dub toggle */}
            {hasMiruroEps && miruroEps.dub.length > 0 && (
              <div className="flex items-center gap-1 bg-[#1A1A1A] rounded-lg p-0.5 border border-white/[0.06] w-fit">
                {(["sub", "dub"] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => { setActiveEpiTab(tab); setEpPage(1); }}
                    className={`px-5 py-2 text-[11px] font-bold rounded-md transition-all ${
                      activeEpiTab === tab
                        ? "bg-[#E63946] text-white"
                        : "text-[#666666] hover:text-[#AAAAAA]"
                    }`}
                  >
                    {tab.toUpperCase()} ({tab === "sub" ? miruroEps.sub.length : miruroEps.dub.length})
                  </button>
                ))}
              </div>
            )}

            {/* Search episodes */}
            <div className="relative max-w-md">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#666666]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
              <input
                type="text"
                value={epSearch}
                onChange={e => { setEpSearch(e.target.value); setEpPage(1); }}
                placeholder="Search episodes..."
                className="w-full pl-9 pr-4 py-2.5 bg-[#1A1A1A] border border-white/[0.08] rounded-lg text-sm text-white placeholder-[#666666] focus:outline-none focus:border-[#E63946]/40 transition-colors"
              />
            </div>

            {/* Episode count */}
            <p className="text-xs text-[#666666]">{filteredEps.length} episode{filteredEps.length !== 1 ? "s" : ""}{epSearch ? ` found` : ""}</p>

            {/* Episode grid */}
            {(episodes.length > 0 || hasMiruroEps) ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {paginatedEps.map((ep: any) => {
                  const epNum = hasMiruroEps ? ep.number : ep.episodeIdNum;
                  const matchedApiEp = hasMiruroEps ? episodes.find((e: any) => e.episodeIdNum === epNum) : ep;
                  const epTitle = hasMiruroEps ? (ep.title || matchedApiEp?.title || matchedApiEp?.notes) : (ep.title || ep.notes);
                  const epThumb = hasMiruroEps ? (ep.thumbnail || matchedApiEp?.thumbnail || matchedApiEp?.thumbnails?.[0]) : (ep.thumbnail || ep.thumbnails?.[0]);
                  const epDesc = matchedApiEp?.description || null;
                  const fallbackImg = banner || image;
                  const isNextEp = nextAiring && nextAiring.episode === epNum;
                  return (
                    <button
                      key={`ep-${epNum}`}
                      onClick={() => handleWatch(epNum)}
                      className={`group flex items-start gap-3 p-3 rounded-xl bg-[#1A1A1A] border transition-all text-left hover:bg-[#1A1A1A]/80 ${
                        isNextEp ? "border-[#FF8C00]/30 hover:border-[#FF8C00]/50" : "border-white/[0.06] hover:border-[#E63946]/30"
                      }`}
                    >
                      {/* Thumbnail with play overlay */}
                      <div className="relative w-32 sm:w-36 shrink-0 aspect-video bg-[#0D0D0D] rounded-lg overflow-hidden">
                        {epThumb ? (
                          <img src={epThumb} alt={`Ep ${epNum}`} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" referrerPolicy="no-referrer" />
                        ) : fallbackImg ? (
                          <>
                            <img src={fallbackImg} alt={`Ep ${epNum}`} className="w-full h-full object-cover opacity-30 group-hover:scale-105 transition-transform duration-300" loading="lazy" referrerPolicy="no-referrer" />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/50 to-black/30" />
                          </>
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-[#1A1A1A]">
                            <span className="text-2xl font-extrabold text-white/[0.06] group-hover:text-[#E63946]/20 transition-colors">{epNum}</span>
                          </div>
                        )}
                        {/* Play overlay */}
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center">
                          <div className="w-9 h-9 rounded-full bg-[#E63946] flex items-center justify-center opacity-0 group-hover:opacity-100 scale-75 group-hover:scale-100 transition-all shadow-lg shadow-[#E63946]/30">
                            <svg className="w-4 h-4 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3" /></svg>
                          </div>
                        </div>
                        {/* Episode number badge */}
                        <span className={`absolute top-1.5 left-1.5 px-1.5 py-0.5 text-[9px] font-extrabold rounded ${
                          isNextEp ? "bg-[#FF8C00]/90 text-white" : "bg-[#E63946]/80 text-white"
                        }`}>
                          {epNum}
                        </span>
                        {/* Duration badge */}
                        {duration && (
                          <span className="absolute bottom-1.5 right-1.5 px-1 py-0.5 text-[8px] font-bold bg-black/70 text-white/60 rounded">{duration}m</span>
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0 py-0.5">
                        <h4 className="text-sm font-bold text-white/90 line-clamp-2 group-hover:text-[#E63946] transition-colors leading-snug">
                          {epTitle || `Episode ${epNum}`}
                        </h4>
                        {epDesc && (
                          <p className="text-[11px] text-[#666666] line-clamp-2 mt-1 leading-relaxed">{epDesc}</p>
                        )}
                        {isNextEp && (
                          <span className="inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 text-[9px] font-bold bg-[#FF8C00]/15 text-[#FF8C00] rounded border border-[#FF8C00]/20">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#FF8C00] animate-pulse" />
                            Next Episode
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : episodesCount && episodesCount > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {Array.from({ length: Math.min(episodesCount, 50) }, (_, i) => i + 1).map(num => {
                  const fallbackImg = banner || image;
                  const isNextEp = nextAiring && nextAiring.episode === num;
                  return (
                    <button
                      key={`gen-${num}`}
                      onClick={() => handleWatch(num)}
                      className={`group flex items-start gap-3 p-3 rounded-xl bg-[#1A1A1A] border transition-all text-left ${
                        isNextEp ? "border-[#FF8C00]/30 hover:border-[#FF8C00]/50" : "border-white/[0.06] hover:border-[#E63946]/30"
                      }`}
                    >
                      <div className="relative w-32 sm:w-36 shrink-0 aspect-video bg-[#0D0D0D] rounded-lg overflow-hidden">
                        {fallbackImg ? (
                          <>
                            <img src={fallbackImg} alt={`Ep ${num}`} className="w-full h-full object-cover opacity-30 group-hover:scale-105 transition-transform duration-300" loading="lazy" referrerPolicy="no-referrer" />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/50 to-black/30" />
                          </>
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-[#1A1A1A]">
                            <span className="text-2xl font-extrabold text-white/[0.06] group-hover:text-[#E63946]/20 transition-colors">{num}</span>
                          </div>
                        )}
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center">
                          <div className="w-9 h-9 rounded-full bg-[#E63946] flex items-center justify-center opacity-0 group-hover:opacity-100 scale-75 group-hover:scale-100 transition-all shadow-lg shadow-[#E63946]/30">
                            <svg className="w-4 h-4 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3" /></svg>
                          </div>
                        </div>
                        <span className={`absolute top-1.5 left-1.5 px-1.5 py-0.5 text-[9px] font-extrabold rounded ${
                          isNextEp ? "bg-[#FF8C00]/90 text-white" : "bg-[#E63946]/80 text-white"
                        }`}>
                          {num}
                        </span>
                        {duration && (
                          <span className="absolute bottom-1.5 right-1.5 px-1 py-0.5 text-[8px] font-bold bg-black/70 text-white/60 rounded">{duration}m</span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0 py-0.5">
                        <h4 className="text-sm font-bold text-white/90 group-hover:text-[#E63946] transition-colors leading-snug">
                          Episode {num}
                        </h4>
                        {isNextEp && (
                          <span className="inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 text-[9px] font-bold bg-[#FF8C00]/15 text-[#FF8C00] rounded border border-[#FF8C00]/20">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#FF8C00] animate-pulse" />
                            Next Episode
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-16 bg-[#1A1A1A] rounded-xl border border-white/[0.06]">
                <svg className="w-12 h-12 text-[#666666] mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path d="M15.536 8.464a5 5 0 010 7.072M18.364 5.636a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707A1 1 0 0112 5.586v12.828a1 1 0 01-1.707.707L5.586 15z" />
                </svg>
                <p className="text-[#666666] text-sm font-medium">No episodes available yet</p>
              </div>
            )}

            {/* Load more */}
            {filteredEps.length > epPage * EPS_PER_PAGE && (
              <div className="flex justify-center">
                <button
                  onClick={() => setEpPage(p => p + 1)}
                  className="px-6 py-2.5 bg-[#1A1A1A] border border-white/[0.08] rounded-lg text-sm font-semibold text-[#AAAAAA] hover:text-white hover:border-[#E63946]/30 transition-all"
                >
                  Load More Episodes
                </button>
              </div>
            )}
          </div>
        )}

        {/* ─── CHARACTERS TAB ─── */}
        {activeTab === "characters" && (
          <div className="space-y-4 fade-in">
            {/* Role filter */}
            {characters.length > 0 && (
              <div className="flex items-center gap-1 bg-[#1A1A1A] rounded-lg p-0.5 border border-white/[0.06] w-fit">
                {(["all", "MAIN", "SUPPORTING"] as const).map(filter => (
                  <button
                    key={filter}
                    onClick={() => { setCharRoleFilter(filter); setShowAllCharacters(false); }}
                    className={`px-4 py-2 text-[11px] font-bold rounded-md transition-all ${
                      charRoleFilter === filter
                        ? "bg-[#E63946] text-white"
                        : "text-[#666666] hover:text-[#AAAAAA]"
                    }`}
                  >
                    {filter === "all" ? "All" : filter === "MAIN" ? "Main" : "Supporting"}
                    <span className="ml-1 text-[9px] opacity-70">
                      ({filter === "all" ? characters.length : characters.filter(c => c.role === filter).length})
                    </span>
                  </button>
                ))}
              </div>
            )}

            {/* Character grid */}
            {filteredChars.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                {visibleChars.map(c => {
                  const cImg = c.image?.large || c.image?.medium || "";
                  const va = c.voiceActors?.[0];
                  return (
                    <div
                      key={c.id}
                      className="bg-[#1A1A1A] rounded-lg border border-white/[0.06] overflow-hidden group hover:border-[#FFB800]/20 transition-all"
                    >
                      <div className="relative w-full aspect-[3/4] overflow-hidden bg-[#0D0D0D]">
                        {cImg ? (
                          <img src={cImg} alt={c.name.full} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-lg text-white/10 font-bold">{c.name.full?.charAt(0) || "?"}</div>
                        )}
                        <span className={`absolute top-1.5 left-1.5 px-1.5 py-0.5 text-[8px] font-bold rounded ${
                          c.role === "MAIN" ? "bg-[#E63946]/80 text-white" : "bg-white/15 text-white/60 backdrop-blur-sm"
                        }`}>
                          {c.role === "MAIN" ? "Main" : "Supporting"}
                        </span>
                      </div>
                      <div className="p-2.5">
                        <p className="text-[11px] font-bold text-[#AAAAAA] line-clamp-1 group-hover:text-[#FFB800] transition-colors leading-tight">{c.name.full}</p>
                        {c.name.native && (
                          <p className="text-[9px] text-[#666666] line-clamp-1 mt-0.5">{c.name.native}</p>
                        )}
                        {va && (
                          <div className="flex items-center gap-1.5 mt-1.5 pt-1.5 border-t border-white/[0.04]">
                            {va.image?.medium && (
                              <img src={va.image.medium} alt="" className="w-5 h-5 rounded-full object-cover border border-white/[0.06]" loading="lazy" />
                            )}
                            <span className="text-[9px] text-[#666666] line-clamp-1">{va.name.full}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-16 bg-[#1A1A1A] rounded-xl border border-white/[0.06]">
                <svg className="w-12 h-12 text-[#666666] mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" />
                </svg>
                <p className="text-[#666666] text-sm font-medium">No character information available</p>
              </div>
            )}

            {/* Show more */}
            {filteredChars.length > 12 && (
              <div className="flex justify-center">
                <button
                  onClick={() => setShowAllCharacters(!showAllCharacters)}
                  className="px-6 py-2.5 bg-[#1A1A1A] border border-white/[0.08] rounded-lg text-sm font-semibold text-[#AAAAAA] hover:text-white hover:border-[#FFB800]/30 transition-all"
                >
                  {showAllCharacters ? "Show Less" : `Show All (${filteredChars.length})`}
                </button>
              </div>
            )}
          </div>
        )}

        {/* ─── TRAILER TAB ─── */}
        {activeTab === "trailer" && hasTrailer && (
          <div className="fade-in">
            <div className="relative w-full aspect-video max-w-4xl mx-auto rounded-xl overflow-hidden border border-white/[0.08] shadow-2xl shadow-black/40">
              <iframe
                src={`https://www.youtube.com/embed/${anilistTrailer!.id}?autoplay=0&rel=0&modestbranding=1&playsinline=1&origin=${typeof window !== 'undefined' ? window.location.origin : ''}`}
                className="w-full h-full"
                allowFullScreen
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                referrerPolicy="strict-origin-when-cross-origin"
                title="Anime Trailer"
              />
            </div>
            {/* Trailer thumbnail as link */}
            {anilistTrailer!.thumbnail && (
              <p className="text-center text-[11px] text-[#666666] mt-3">
                Trailer from YouTube
              </p>
            )}
          </div>
        )}

        {/* No trailer available */}
        {activeTab === "trailer" && !hasTrailer && (
          <div className="text-center py-16 bg-[#1A1A1A] rounded-xl border border-white/[0.06]">
            <svg className="w-12 h-12 text-[#666666] mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <rect x="2" y="4" width="20" height="16" rx="2" />
              <polygon points="10 9 15 12 10 15" fill="currentColor" stroke="none" />
            </svg>
            <p className="text-[#666666] text-sm font-medium">No trailer available</p>
          </div>
        )}
      </div>

      {/* Hide scrollbar utility */}
      <style jsx global>{`
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}
