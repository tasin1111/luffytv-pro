"use client";

import { useState, useEffect, useMemo } from "react";
import { useAppStore } from "./store";
import { Search, Play, Music as MusicIcon, ChevronLeft, Calendar, Disc, User, Loader2, AlertCircle, X } from "lucide-react";

// ============================================================
// ANIME MUSIC PAGE — Opening & Ending themes
// Uses api.animethemes.moe (public API, no auth needed)
// Adapted from github.com/Varomine/MioAnime Music.jsx
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

  // Fetch featured anime on load
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

        if (ops.length > 0) {
          setActiveTab("OP");
          setCurrentTheme(ops[0]);
        } else if (eds.length > 0) {
          setActiveTab("ED");
          setCurrentTheme(eds[0]);
        } else if (animethemes.length > 0) {
          setActiveTab("OP");
          setCurrentTheme(animethemes[0]);
        }
      }
    } catch (err) {
      console.error("Details fetch error:", err);
      setError("Could not load themes for this anime. Please try again.");
    } finally {
      setDetailsLoading(false);
    }
  };

  const handlePlayTheme = (theme: any) => {
    setCurrentTheme(theme);
  };

  const handleBackToList = () => {
    setSelectedAnime(null);
    setThemes([]);
    setCurrentTheme(null);
  };

  const getCoverImage = (animeItem: any) => {
    if (!animeItem) return "";
    const images = animeItem.images || [];
    const large = images.find((img: any) => img.facet === "Large Cover");
    if (large) return large.link;
    const small = images.find((img: any) => img.facet === "Small Cover");
    if (small) return small.link;
    return "";
  };

  const filteredThemes = themes.filter((t) => {
    if (activeTab === "OP") return t.type?.startsWith("OP");
    return t.type?.startsWith("ED");
  });

  const currentVideoUrl = currentTheme?.animethemeentries?.[0]?.videos?.[0]?.link || "";
  const currentAudioUrl = currentTheme?.animethemeentries?.[0]?.videos?.[0]?.audio?.link || "";

  return (
    <div className="music-page" style={{ paddingTop: "80px", minHeight: "100vh", background: "#0a0a0c", color: "#fff" }}>
      <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "0 16px" }}>
        {/* Header */}
        <div className="music-header" style={{ textAlign: "center", marginBottom: "32px" }}>
          <h1 className="music-page-title" style={{
            fontSize: "2.5rem", fontWeight: 800, letterSpacing: "-0.5px",
            background: "linear-gradient(135deg, #D4A017, #F5C842)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            backgroundClip: "text", marginBottom: "8px"
          }}>
            Anime Themes
          </h1>
          <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "14px", maxWidth: "600px", margin: "0 auto" }}>
            Listen and watch clean Opening and Ending credits of your favorite anime series
          </p>
        </div>

        {/* Search bar */}
        {!selectedAnime && (
          <form className="music-search-bar" onSubmit={handleSearchSubmit} style={{ display: "flex", gap: "12px", maxWidth: "720px", margin: "0 auto 48px" }}>
            <div className="music-input-wrapper" style={{ position: "relative", flex: 1 }}>
              <Search size={18} style={{ position: "absolute", left: "16px", top: "50%", transform: "translateY(-50%)", color: "rgba(255,255,255,0.3)", pointerEvents: "none" }} />
              <input
                type="text"
                placeholder="Search anime themes (e.g. Naruto, Bleach, Attack on Titan)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: "100%", height: "48px", padding: "0 48px 0 48px",
                  background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: "9999px", color: "#fff", fontSize: "14px", outline: "none",
                  transition: "border-color 0.2s, box-shadow 0.2s"
                }}
                onFocus={(e) => { e.target.style.borderColor = "#D4A017"; e.target.style.boxShadow = "0 0 0 3px rgba(212,160,23,0.12)"; }}
                onBlur={(e) => { e.target.style.borderColor = "rgba(255,255,255,0.08)"; e.target.style.boxShadow = "none"; }}
              />
              {searchQuery && (
                <button type="button" onClick={() => { setSearchQuery(""); setSearchResults([]); setHasSearched(false); }}
                  style={{ position: "absolute", right: "16px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "rgba(255,255,255,0.4)", cursor: "pointer", fontSize: "12px", fontWeight: 600 }}>
                  Clear
                </button>
              )}
            </div>
            <button type="submit" style={{
              height: "48px", padding: "0 32px", borderRadius: "9999px",
              background: "linear-gradient(135deg, #D4A017, #C8924A)", border: "none",
              color: "#000", fontSize: "14px", fontWeight: 700, cursor: "pointer", transition: "transform 0.2s"
            }}>
              Search
            </button>
          </form>
        )}

        {/* Error */}
        {error && (
          <div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "16px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: "8px", color: "#ef4444", maxWidth: "720px", margin: "0 auto 16px", fontSize: "14px" }}>
            <AlertCircle size={20} />
            <span>{error}</span>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px", padding: "64px 0" }}>
            <Loader2 size={32} className="animate-spin" style={{ color: "#D4A017" }} />
            <span style={{ color: "rgba(255,255,255,0.5)", fontSize: "14px" }}>Fetching themes...</span>
          </div>
        )}

        {/* Player view */}
        {selectedAnime && (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <button onClick={handleBackToList} style={{
              alignSelf: "flex-start", display: "flex", alignItems: "center", gap: "8px",
              padding: "8px 16px", borderRadius: "8px", background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.7)",
              fontSize: "13px", fontWeight: 600, cursor: "pointer", transition: "all 0.2s"
            }}>
              <ChevronLeft size={16} /> Back to List
            </button>

            {detailsLoading ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px", padding: "64px 0" }}>
                <Loader2 size={32} className="animate-spin" style={{ color: "#D4A017" }} />
                <span style={{ color: "rgba(255,255,255,0.5)", fontSize: "14px" }}>Loading theme videos...</span>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: "20px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "16px", overflow: "hidden" }}>
                {/* Left: Video player */}
                <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "16px" }}>
                  {currentVideoUrl ? (
                    <div style={{ aspectRatio: "16/9", background: "#000", borderRadius: "12px", overflow: "hidden", border: "1px solid rgba(255,255,255,0.06)" }}>
                      <video src={currentVideoUrl} controls autoPlay style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                    </div>
                  ) : (
                    <div style={{ aspectRatio: "16/9", background: "#000", borderRadius: "12px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.3)", gap: "8px", border: "1px solid rgba(255,255,255,0.06)" }}>
                      <AlertCircle size={32} />
                      <span>No video file available for this theme.</span>
                    </div>
                  )}

                  {/* Now playing */}
                  {currentTheme && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        <span style={{ fontWeight: 700, padding: "3px 8px", borderRadius: "4px", background: "rgba(212,160,23,0.15)", color: "#D4A017", fontSize: "12px" }}>
                          {currentTheme.type}
                        </span>
                        <h2 style={{ fontSize: "20px", fontWeight: 700, color: "#fff", margin: 0 }}>
                          {currentTheme.song?.title || "Unknown Song"}
                        </h2>
                      </div>
                      {currentTheme.song?.artists?.length > 0 && (
                        <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "#D4A017", fontSize: "14px", fontWeight: 500 }}>
                          <User size={14} />
                          <span>{currentTheme.song.artists.map((a: any) => a.name).join(", ")}</span>
                        </div>
                      )}
                      <div style={{ display: "flex", alignItems: "center", gap: "4px", color: "rgba(255,255,255,0.4)", fontSize: "12px", marginTop: "4px" }}>
                        <Disc size={14} />
                        <span>{selectedAnime.name}</span>
                        {selectedAnime.year && (
                          <>
                            <Calendar size={14} style={{ marginLeft: "12px" }} />
                            <span>{selectedAnime.year}</span>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Right: Playlist */}
                <div style={{ display: "flex", flexDirection: "column", background: "rgba(0,0,0,0.3)", borderLeft: "1px solid rgba(255,255,255,0.06)", maxHeight: "520px" }}>
                  <div style={{ display: "flex", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                    <button onClick={() => setActiveTab("OP")} style={{
                      flex: 1, height: "48px", fontSize: "12px", fontWeight: 600,
                      color: activeTab === "OP" ? "#D4A017" : "rgba(255,255,255,0.4)",
                      borderBottom: activeTab === "OP" ? "2px solid #D4A017" : "2px solid transparent",
                      background: "none", border: "none", cursor: "pointer", transition: "all 0.15s"
                    }}>
                      Openings (OP)
                    </button>
                    <button onClick={() => setActiveTab("ED")} style={{
                      flex: 1, height: "48px", fontSize: "12px", fontWeight: 600,
                      color: activeTab === "ED" ? "#D4A017" : "rgba(255,255,255,0.4)",
                      borderBottom: activeTab === "ED" ? "2px solid #D4A017" : "2px solid transparent",
                      background: "none", border: "none", cursor: "pointer", transition: "all 0.15s"
                    }}>
                      Endings (ED)
                    </button>
                  </div>
                  <div style={{ flex: 1, overflowY: "auto", padding: "12px", display: "flex", flexDirection: "column", gap: "8px" }}>
                    {filteredThemes.length > 0 ? filteredThemes.map((t) => {
                      const isPlaying = currentTheme?.id === t.id;
                      return (
                        <button key={t.id} onClick={() => handlePlayTheme(t)} style={{
                          display: "flex", alignItems: "center", gap: "12px", padding: "12px",
                          background: isPlaying ? "rgba(212,160,23,0.1)" : "rgba(255,255,255,0.03)",
                          border: `1px solid ${isPlaying ? "#D4A017" : "rgba(255,255,255,0.06)"}`,
                          borderRadius: "8px", textAlign: "left", cursor: "pointer", width: "100%",
                          transition: "all 0.2s"
                        }}>
                          <span style={{
                            width: "28px", height: "28px", borderRadius: "9999px",
                            background: isPlaying ? "#D4A017" : "rgba(255,255,255,0.05)",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            flexShrink: 0, color: isPlaying ? "#000" : "rgba(255,255,255,0.4)"
                          }}>
                            <Play size={14} fill={isPlaying ? "#000" : "none"} />
                          </span>
                          <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                            <span style={{ fontSize: "10px", fontWeight: 700, color: "#D4A017", textTransform: "uppercase", letterSpacing: "0.5px" }}>{t.type}</span>
                            <span style={{ fontSize: "14px", fontWeight: 600, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                              {t.song?.title || "Unknown Song"}
                            </span>
                            {t.song?.artists?.length > 0 && (
                              <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                {t.song.artists.map((a: any) => a.name).join(", ")}
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    }) : (
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "150px", textAlign: "center", color: "rgba(255,255,255,0.3)", fontSize: "14px" }}>
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
            <h2 style={{ fontSize: "20px", fontWeight: 700, marginBottom: "16px", borderLeft: "3px solid #D4A017", paddingLeft: "12px" }}>
              {hasSearched ? `Search Results (${searchResults.length})` : "Popular Anime Themes"}
            </h2>

            {(hasSearched ? searchResults : featuredAnime).length > 0 ? (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "20px" }}>
                {(hasSearched ? searchResults : featuredAnime).map((anime) => {
                  const cover = getCoverImage(anime);
                  const title = anime.name;
                  const year = anime.year;
                  const type = anime.media_format;
                  return (
                    <div key={anime.id} onClick={() => handleSelectAnime(anime)} style={{
                      display: "flex", flexDirection: "column", borderRadius: "12px", overflow: "hidden",
                      background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)",
                      cursor: "pointer", transition: "all 0.2s"
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-4px)"; e.currentTarget.style.borderColor = "#D4A017"; e.currentTarget.style.boxShadow = "0 8px 24px rgba(0,0,0,0.4)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.transform = "none"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)"; e.currentTarget.style.boxShadow = "none"; }}
                    >
                      <div style={{ position: "relative", aspectRatio: "3/4", background: "#14141a", overflow: "hidden" }}>
                        {cover ? (
                          <img src={cover} alt={title} loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover", transition: "transform 0.3s" }} />
                        ) : (
                          <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.15)" }}>
                            <MusicIcon size={32} />
                          </div>
                        )}
                        <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(2px)", display: "flex", alignItems: "center", justifyContent: "center", opacity: 0, transition: "opacity 0.2s" }}
                          onMouseEnter={(e) => e.currentTarget.style.opacity = "1"}
                          onMouseLeave={(e) => e.currentTarget.style.opacity = "0"}>
                          <Play size={32} fill="#D4A017" />
                        </div>
                      </div>
                      <div style={{ padding: "12px", display: "flex", flexDirection: "column", gap: "2px" }}>
                        <h3 style={{ fontSize: "14px", fontWeight: 600, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", margin: 0 }}>{title}</h3>
                        <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)" }}>
                          {year && <span>{year}</span>}
                          {type && <span> • {type}</span>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "64px 0", color: "rgba(255,255,255,0.4)" }}>
                <MusicIcon size={48} style={{ color: "rgba(255,255,255,0.15)", marginBottom: "8px", opacity: 0.5 }} />
                <h3 style={{ fontSize: "16px", fontWeight: 600 }}>No anime found</h3>
                <p style={{ fontSize: "14px" }}>Try searching for a different anime name to discover its themes.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
