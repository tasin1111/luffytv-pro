"use client";

import { useState, useEffect, useMemo } from "react";
import { useAppStore } from "./store";
import { Search, Play, Music as MusicIcon, ChevronLeft, Calendar, Disc, User, Loader2, AlertCircle, X } from "lucide-react";

// ============================================================
// ANIME MUSIC PAGE — Opening & Ending themes (modern v4)
// Uses api.animethemes.moe (public API, no auth needed)
// ============================================================

export default function MusicPage() {
  const { navigate } = useAppStore();
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [featuredAnime, setFeaturedAnime] = useState<any[]>([]);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [hasSearched, setHasSearched] = useState(false);

  const [selectedAnime, setSelectedAnime] = useState<any>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [themes, setThemes] = useState<any[]>([]);
  const [currentTheme, setCurrentTheme] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<"OP" | "ED">("OP");

  useEffect(() => {
    const fetchFeatured = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("https://api.animethemes.moe/anime?page[size]=12&include=images");
        if (!res.ok) throw new Error("Failed to fetch featured themes.");
        const json = await res.json();
        setFeaturedAnime(json.anime || []);
      } catch (err) {
        console.error("Featured themes fetch error:", err);
        setError("Failed to load initial themes list. Please try again.");
      } finally {
        setLoading(false);
      }
    };
    fetchFeatured();
  }, []);

  const handleSearchSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const query = searchQuery.trim();
    if (!query) {
      setHasSearched(false);
      setSearchResults([]);
      return;
    }
    setLoading(true);
    setError(null);
    setSelectedAnime(null);
    try {
      const res = await fetch(`https://api.animethemes.moe/search?q=${encodeURIComponent(query)}&fields[search]=anime&include[anime]=images`);
      if (!res.ok) throw new Error("Search failed.");
      const json = await res.json();
      const searchAnimeList = json.search?.anime || [];
      setSearchResults(searchAnimeList);
      setHasSearched(true);
    } catch (err) {
      console.error("Search error:", err);
      setError("Failed to search anime themes. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSelectAnime = async (anime: any) => {
    setDetailsLoading(true);
    setError(null);
    setSelectedAnime(anime);
    setCurrentTheme(null);
    try {
      const res = await fetch(`https://api.animethemes.moe/anime/${anime.slug}?include=animethemes.song.artists,animethemes.animethemeentries.videos,images`);
      if (!res.ok) throw new Error("Failed to load anime theme details.");
      const json = await res.json();
      const animeDetails = json.anime;
      if (animeDetails) {
        setSelectedAnime(animeDetails);
        const animethemes = animeDetails.animethemes || [];
        setThemes(animethemes);
        const ops = animethemes.filter((t: any) => t.type?.startsWith("OP"));
        const eds = animethemes.filter((t: any) => t.type?.startsWith("ED"));
        if (ops.length > 0) { setActiveTab("OP"); setCurrentTheme(ops[0]); }
        else if (eds.length > 0) { setActiveTab("ED"); setCurrentTheme(eds[0]); }
        else if (animethemes.length > 0) { setActiveTab("OP"); setCurrentTheme(animethemes[0]); }
      }
    } catch (err) {
      console.error("Details fetch error:", err);
      setError("Could not load themes for this anime. Please try again.");
    } finally {
      setDetailsLoading(false);
    }
  };

  const handlePlayTheme = (theme: any) => setCurrentTheme(theme);
  const handleBackToList = () => { setSelectedAnime(null); setThemes([]); setCurrentTheme(null); };

  const getCoverImage = (animeItem: any) => {
    if (!animeItem) return "";
    const images = animeItem.images || [];
    const large = images.find((img: any) => img.facet === "Large Cover");
    if (large) return large.link;
    const small = images.find((img: any) => img.facet === "Small Cover");
    if (small) return small.link;
    return "";
  };

  const filteredThemes = themes.filter((t) => activeTab === "OP" ? t.type?.startsWith("OP") : t.type?.startsWith("ED"));
  const currentVideoUrl = currentTheme?.animethemeentries?.[0]?.videos?.[0]?.link || "";
  const currentAudioUrl = currentTheme?.animethemeentries?.[0]?.videos?.[0]?.audio?.link || "";

  return (
    <div className="ltv-v4 min-h-screen" style={{ paddingTop: "90px" }}>
      <div className="max-w-[1200px] mx-auto px-4 lg:px-6">

        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight mb-3"
              style={{ background: "linear-gradient(135deg, #fff 0%, rgba(255,255,255,0.5) 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
            Anime Themes
          </h1>
          <p className="text-white/50 text-sm max-w-[600px] mx-auto">
            Listen and watch clean Opening and Ending credits of your favorite anime series
          </p>
        </div>

        {/* Search bar */}
        {!selectedAnime && (
          <form onSubmit={handleSearchSubmit} className="flex gap-3 max-w-[720px] mx-auto mb-12">
            <div className="relative flex-1 ltv-search-input">
              <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none" />
              <input
                type="text"
                placeholder="Search anime themes (e.g. Naruto, Bleach, Attack on Titan)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="ltv-input"
                style={{ height: "48px", paddingLeft: "44px", paddingRight: searchQuery ? "80px" : "16px", borderRadius: "9999px" }}
              />
              {searchQuery && (
                <button type="button" onClick={() => { setSearchQuery(""); setSearchResults([]); setHasSearched(false); }}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-white text-xs font-semibold">
                  Clear
                </button>
              )}
            </div>
            <button type="submit" className="ltv-btn ltv-btn-primary" style={{ height: "48px", padding: "0 28px", borderRadius: "9999px" }}>
              Search
            </button>
          </form>
        )}

        {/* Error */}
        {error && (
          <div className="flex items-center gap-3 p-4 mb-4 rounded-xl max-w-[720px] mx-auto"
               style={{ background: "rgba(230,57,70,0.08)", border: "1px solid rgba(230,57,70,0.20)", color: "#ffffff" }}>
            <AlertCircle size={20} />
            <span className="text-sm">{error}</span>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex flex-col items-center gap-3 py-16">
            <div className="ltv-spinner ltv-spinner-lg" />
            <span className="text-white/50 text-sm">Fetching themes...</span>
          </div>
        )}

        {/* Player view */}
        {selectedAnime && (
          <div className="flex flex-col gap-4">
            <button onClick={handleBackToList}
              className="ltv-btn ltv-btn-ghost self-start"
              style={{ height: "36px", padding: "0 14px" }}>
              <ChevronLeft size={16} /> Back to List
            </button>

            {detailsLoading ? (
              <div className="flex flex-col items-center gap-3 py-16">
                <div className="ltv-spinner ltv-spinner-lg" />
                <span className="text-white/50 text-sm">Loading theme videos...</span>
              </div>
            ) : (
              <div className="grid lg:grid-cols-[1fr_340px] gap-5 ltv-card overflow-hidden" style={{ borderRadius: "16px" }}>
                {/* Left: Video player */}
                <div className="p-5 flex flex-col gap-4">
                  {currentVideoUrl ? (
                    <div className="aspect-video bg-black rounded-xl overflow-hidden border border-white/[0.06]">
                      <video src={currentVideoUrl} controls autoPlay className="w-full h-full object-contain" />
                    </div>
                  ) : (
                    <div className="aspect-video bg-black rounded-xl flex flex-col items-center justify-center text-white/30 gap-2 border border-white/[0.06]">
                      <AlertCircle size={32} />
                      <span className="text-sm">No video file available for this theme.</span>
                    </div>
                  )}

                  {/* Now playing */}
                  {currentTheme && (
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="ltv-badge ltv-badge-red">{currentTheme.type}</span>
                        <h2 className="text-xl font-bold text-white">
                          {currentTheme.song?.title || "Unknown Song"}
                        </h2>
                      </div>
                      {currentTheme.song?.artists?.length > 0 && (
                        <div className="flex items-center gap-1.5 text-[#FFB800] text-sm font-medium">
                          <User size={14} />
                          <span>{currentTheme.song.artists.map((a: any) => a.name).join(", ")}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-3 text-white/40 text-xs mt-1">
                        <span className="flex items-center gap-1.5"><Disc size={14} /> {selectedAnime.name}</span>
                        {selectedAnime.year && (
                          <span className="flex items-center gap-1.5"><Calendar size={14} /> {selectedAnime.year}</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Right: Playlist */}
                <div className="flex flex-col bg-black/40 border-l border-white/[0.06] max-h-[520px]">
                  <div className="flex border-b border-white/[0.06]">
                    <button onClick={() => setActiveTab("OP")}
                      className={`flex-1 h-12 text-xs font-bold transition-colors relative ${
                        activeTab === "OP" ? "text-white" : "text-white/40 hover:text-white/70"
                      }`}>
                      Openings (OP)
                      {activeTab === "OP" && (
                        <span className="absolute bottom-0 left-4 right-4 h-0.5 bg-[#ffffff] rounded-full" />
                      )}
                    </button>
                    <button onClick={() => setActiveTab("ED")}
                      className={`flex-1 h-12 text-xs font-bold transition-colors relative ${
                        activeTab === "ED" ? "text-white" : "text-white/40 hover:text-white/70"
                      }`}>
                      Endings (ED)
                      {activeTab === "ED" && (
                        <span className="absolute bottom-0 left-4 right-4 h-0.5 bg-[#ffffff] rounded-full" />
                      )}
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2 ltv-scroll">
                    {filteredThemes.length > 0 ? filteredThemes.map((t) => {
                      const isPlaying = currentTheme?.id === t.id;
                      return (
                        <button key={t.id} onClick={() => handlePlayTheme(t)}
                          className={`flex items-center gap-3 p-3 rounded-lg text-left cursor-pointer w-full transition-all ${
                            isPlaying ? "ltv-music-card is-playing" : "ltv-music-card"
                          }`}>
                          <span className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
                            isPlaying ? "bg-[#ffffff] text-white" : "bg-white/[0.05] text-white/40"
                          }`}>
                            <Play size={12} fill={isPlaying ? "#fff" : "none"} />
                          </span>
                          <div className="flex flex-col min-w-0">
                            <span className="text-[10px] font-bold text-[#ffffff] uppercase tracking-wider">{t.type}</span>
                            <span className="text-sm font-semibold text-white truncate">{t.song?.title || "Unknown Song"}</span>
                            {t.song?.artists?.length > 0 && (
                              <span className="text-xs text-white/40 truncate">{t.song.artists.map((a: any) => a.name).join(", ")}</span>
                            )}
                          </div>
                        </button>
                      );
                    }) : (
                      <div className="flex items-center justify-center h-32 text-center text-white/30 text-sm">
                        No themes found in this category.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Anime grid */}
        {!selectedAnime && !loading && (
          <div>
            <h2 className="ltv-section-title mb-4">
              {hasSearched ? `Search Results (${searchResults.length})` : "Popular Anime Themes"}
            </h2>

            {(hasSearched ? searchResults : featuredAnime).length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {(hasSearched ? searchResults : featuredAnime).map((anime) => {
                  const cover = getCoverImage(anime);
                  const title = anime.name;
                  const year = anime.year;
                  const type = anime.media_format;
                  return (
                    <button key={anime.id} onClick={() => handleSelectAnime(anime)}
                      className="ltv-poster-card group">
                      <div className="relative w-full ltv-aspect-poster overflow-hidden bg-[#14141a]">
                        {cover ? (
                          <img src={cover} alt={title} loading="lazy" className="ltv-poster-img" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-white/15">
                            <MusicIcon size={32} />
                          </div>
                        )}
                        <div className="ltv-poster-overlay" />
                        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <div className="w-12 h-12 rounded-full bg-[#ffffff] flex items-center justify-center shadow-lg shadow-[#ffffff]/40">
                            <Play size={20} fill="#fff" className="text-white ml-0.5" />
                          </div>
                        </div>
                      </div>
                      <div className="p-3 flex flex-col gap-1">
                        <h3 className="text-sm font-semibold text-white truncate">{title}</h3>
                        <div className="text-xs text-white/40">
                          {year && <span>{year}</span>}
                          {type && <span> • {type}</span>}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="ltv-empty">
                <div className="ltv-empty-icon">
                  <MusicIcon size={28} />
                </div>
                <div className="ltv-empty-title">No anime found</div>
                <div className="ltv-empty-desc">Try searching for a different anime name to discover its themes.</div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
