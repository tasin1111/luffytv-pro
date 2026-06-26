"use client";

import { useState, useEffect } from "react";
import { Search, Download, Check, ExternalLink, AlertTriangle, Loader2, Database, Magnet } from "lucide-react";
import { useAppStore } from "./store";

// ============================================================
// TORRENT PAGE — Anime torrent search via feed.animetosho.org
// Adapted from github.com/Varomine/MioAnime Torrent.jsx
// ============================================================

const POPULAR_SEARCHES = [
  "One Piece", "Naruto", "Demon Slayer", "Jujutsu Kaisen",
  "Bleach", "Chainsaw Man", "Attack on Titan", "My Hero Academia"
];

function formatBytes(bytes: number, decimals = 2): string {
  if (!bytes) return "0 Bytes";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KiB", "MiB", "GiB", "TiB", "PiB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
}

interface TorrentResult {
  title: string;
  size: string;
  seeders: number;
  leechers: number;
  magnet: string;
  torrent: string;
  link: string;
}

export default function TorrentPage() {
  const { navigate } = useAppStore();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeQuery, setActiveQuery] = useState("One Piece");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<TorrentResult[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchTorrents = async (query: string) => {
    const trimmed = query.trim();
    if (!trimmed) return;

    setLoading(true);
    setError(null);
    try {
      const url = `https://feed.animetosho.org/json?qx=1&q=${encodeURIComponent(trimmed)}`;
      const res = await fetch(url);

      if (!res.ok) {
        throw new Error(`Failed to fetch torrents (Status: ${res.status})`);
      }

      const data = await res.json();
      const rawResults: TorrentResult[] = (data || []).map((item: any) => ({
        title: item.title,
        size: formatBytes(item.total_size),
        seeders: item.seeders || 0,
        leechers: item.leechers || 0,
        magnet: item.magnet_uri,
        torrent: item.torrent_url,
        link: item.link
      }));

      const sortedResults = [...rawResults].sort((a, b) => (b.seeders || 0) - (a.seeders || 0));
      setResults(sortedResults);
    } catch (err) {
      console.error("Torrent search error:", err);
      setError("Failed to fetch torrent search results. Please check your network or try again.");
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTorrents(activeQuery);
  }, [activeQuery]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      setActiveQuery(searchQuery.trim());
    }
  };

  const handleChipClick = (query: string) => {
    setSearchQuery(query);
    setActiveQuery(query);
  };

  const handleCopyMagnet = async (magnet: string, id: string) => {
    if (!magnet) return;
    try {
      await navigator.clipboard.writeText(magnet);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error("Failed to copy magnet link:", err);
    }
  };

  return (
    <div className="torrent-page" style={{ paddingTop: "80px", minHeight: "100vh", background: "#0a0a0c", color: "#fff" }}>
      <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "0 16px", display: "flex", flexDirection: "column", gap: "20px" }}>

        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: "8px", display: "flex", flexDirection: "column", alignItems: "center", gap: "4px" }}>
          <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", width: "50px", height: "50px", borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "4px" }}>
            <Database size={24} style={{ color: "#D4A017" }} />
          </div>
          <h1 style={{
            fontSize: "2.5rem", fontWeight: 800, letterSpacing: "-0.5px",
            background: "linear-gradient(135deg, #fff 30%, #D4A017 100%)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            backgroundClip: "text", margin: 0
          }}>
            Torrent Index
          </h1>
          <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "14px", maxWidth: "560px", lineHeight: 1.6 }}>
            Find high-quality anime releases, episodes, and movies indexed directly from torrent networks.
          </p>
        </div>

        {/* Search Panel */}
        <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "16px", padding: "20px", display: "flex", flexDirection: "column", gap: "16px" }}>
          <form onSubmit={handleSearchSubmit} style={{ display: "flex", gap: "12px" }}>
            <div style={{ position: "relative", flex: 1 }}>
              <input
                type="text"
                placeholder="Search anime releases (e.g. Naruto, Demon Slayer)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: "100%", height: "48px",
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: "8px", padding: "0 16px 0 44px",
                  color: "#fff", fontSize: "14px", outline: "none",
                  transition: "border-color 0.2s, box-shadow 0.2s"
                }}
                onFocus={(e) => { e.target.style.borderColor = "#D4A017"; e.target.style.boxShadow = "0 0 0 3px rgba(212,160,23,0.12)"; }}
                onBlur={(e) => { e.target.style.borderColor = "rgba(255,255,255,0.08)"; e.target.style.boxShadow = "none"; }}
              />
              <Search size={18} style={{ position: "absolute", left: "16px", top: "50%", transform: "translateY(-50%)", color: "rgba(255,255,255,0.3)", pointerEvents: "none" }} />
            </div>
            <button type="submit" disabled={loading} style={{
              height: "48px", padding: "0 32px",
              background: "linear-gradient(135deg, #C8924A, #D4A017)",
              color: "#000", fontWeight: 700, borderRadius: "8px",
              fontSize: "14px", border: "none", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
              transition: "transform 0.2s, opacity 0.2s"
            }}>
              {loading ? <Loader2 size={18} className="animate-spin" /> : "Search"}
            </button>
          </form>

          {/* Popular chips */}
          <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
            <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "1px", fontWeight: 700 }}>
              Popular:
            </span>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              {POPULAR_SEARCHES.map((query) => (
                <button key={query} type="button" onClick={() => handleChipClick(query)} style={{
                  padding: "6px 12px", borderRadius: "9999px",
                  background: activeQuery === query ? "rgba(212,160,23,0.12)" : "rgba(255,255,255,0.03)",
                  border: `1px solid ${activeQuery === query ? "#D4A017" : "rgba(255,255,255,0.08)"}`,
                  fontSize: "12px", color: activeQuery === query ? "#D4A017" : "rgba(255,255,255,0.5)",
                  fontWeight: 500, cursor: "pointer", transition: "all 0.2s"
                }}>
                  {query}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Results */}
        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "64px 0", gap: "12px" }}>
            <Loader2 size={40} className="animate-spin" style={{ color: "#D4A017" }} />
            <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "14px" }}>Searching indexes for "{activeQuery}"...</p>
          </div>
        ) : error ? (
          <div style={{ background: "rgba(239,68,68,0.05)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: "16px", padding: "32px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", gap: "12px" }}>
            <AlertTriangle size={32} style={{ color: "#ef4444" }} />
            <div>
              <h3 style={{ fontSize: "16px", fontWeight: 700, marginBottom: "4px" }}>Search Failed</h3>
              <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "14px" }}>{error}</p>
            </div>
            <button onClick={() => fetchTorrents(activeQuery)} style={{ padding: "8px 20px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "8px", fontSize: "13px", fontWeight: 600, color: "#fff", cursor: "pointer" }}>
              Retry
            </button>
          </div>
        ) : results.length > 0 ? (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", padding: "0 4px" }}>
              <span style={{ fontSize: "14px", color: "rgba(255,255,255,0.5)" }}>
                Found <strong style={{ color: "#fff" }}>{results.length}</strong> torrents for "{activeQuery}"
              </span>
              <span style={{ fontSize: "11px", color: "#D4A017", background: "rgba(212,160,23,0.1)", padding: "4px 8px", borderRadius: "4px", fontWeight: 600 }}>
                Sorted by Seeders
              </span>
            </div>

            {/* Table */}
            <div style={{ width: "100%", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "16px", overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                <thead>
                  <tr>
                    <th style={{ background: "rgba(255,255,255,0.03)", padding: "16px", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px", color: "rgba(255,255,255,0.3)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>Title</th>
                    <th style={{ background: "rgba(255,255,255,0.03)", padding: "16px", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px", color: "rgba(255,255,255,0.3)", borderBottom: "1px solid rgba(255,255,255,0.06)", textAlign: "center" }}>Size</th>
                    <th style={{ background: "rgba(255,255,255,0.03)", padding: "16px", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px", color: "rgba(255,255,255,0.3)", borderBottom: "1px solid rgba(255,255,255,0.06)", textAlign: "center" }}>Seeders</th>
                    <th style={{ background: "rgba(255,255,255,0.03)", padding: "16px", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px", color: "rgba(255,255,255,0.3)", borderBottom: "1px solid rgba(255,255,255,0.06)", textAlign: "center" }}>Leechers</th>
                    <th style={{ background: "rgba(255,255,255,0.03)", padding: "16px", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px", color: "rgba(255,255,255,0.3)", borderBottom: "1px solid rgba(255,255,255,0.06)", textAlign: "center" }}>Download</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((torrent, index) => {
                    const uniqueId = `${torrent.magnet || index}-${index}`;
                    const isCopied = copiedId === uniqueId;
                    return (
                      <tr key={uniqueId} style={{ transition: "background-color 0.15s" }}
                        onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.03)"}
                        onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
                        <td style={{ padding: "16px", borderBottom: "1px solid rgba(255,255,255,0.04)", fontSize: "14px" }}>
                          <span title={torrent.title} style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", textOverflow: "ellipsis", fontWeight: 500, lineHeight: 1.4, color: "#fff" }}>
                            {torrent.title}
                          </span>
                        </td>
                        <td style={{ padding: "16px", borderBottom: "1px solid rgba(255,255,255,0.04)", textAlign: "center", fontFamily: "monospace", fontSize: "13px", color: "rgba(255,255,255,0.5)" }}>
                          {torrent.size || "N/A"}
                        </td>
                        <td style={{ padding: "16px", borderBottom: "1px solid rgba(255,255,255,0.04)", textAlign: "center" }}>
                          <span style={{ color: "#4ade80", background: "rgba(74,222,128,0.1)", padding: "4px 8px", borderRadius: "4px", fontSize: "13px", fontWeight: 700 }}>
                            {torrent.seeders ?? 0}
                          </span>
                        </td>
                        <td style={{ padding: "16px", borderBottom: "1px solid rgba(255,255,255,0.04)", textAlign: "center" }}>
                          <span style={{ color: "#ef4444", background: "rgba(239,68,68,0.1)", padding: "4px 8px", borderRadius: "4px", fontSize: "13px", fontWeight: 700 }}>
                            {torrent.leechers ?? 0}
                          </span>
                        </td>
                        <td style={{ padding: "16px", borderBottom: "1px solid rgba(255,255,255,0.04)", textAlign: "center" }}>
                          <div style={{ display: "flex", gap: "6px", justifyContent: "center", alignItems: "center" }}>
                            <button type="button" onClick={() => handleCopyMagnet(torrent.magnet, uniqueId)} title={isCopied ? "Copied!" : "Copy Magnet Link"} style={{
                              display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "4px",
                              height: "32px", padding: "0 8px", fontSize: "11px", fontWeight: 600, borderRadius: "6px",
                              border: `1px solid ${isCopied ? "#22c55e" : "rgba(255,255,255,0.08)"}`,
                              background: isCopied ? "rgba(34,197,94,0.15)" : "transparent",
                              color: isCopied ? "#22c55e" : "rgba(255,255,255,0.5)", cursor: "pointer", transition: "all 0.15s"
                            }}>
                              {isCopied ? <Check size={15} /> : <Magnet size={15} />}
                            </button>
                            {torrent.torrent && (
                              <a href={torrent.torrent} target="_blank" rel="noopener noreferrer" title="Download .torrent" style={{
                                display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "4px",
                                height: "32px", padding: "0 8px", fontSize: "11px", fontWeight: 600, borderRadius: "6px",
                                border: "1px solid rgba(255,255,255,0.08)", background: "transparent",
                                color: "rgba(96,165,250,0.8)", textDecoration: "none", transition: "all 0.15s"
                              }}>
                                <Download size={15} />
                              </a>
                            )}
                            {torrent.link && (
                              <a href={torrent.link} target="_blank" rel="noopener noreferrer" title="View on AnimeTosho" style={{
                                display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "4px",
                                height: "32px", padding: "0 8px", fontSize: "11px", fontWeight: 600, borderRadius: "6px",
                                border: "1px solid rgba(255,255,255,0.08)", background: "transparent",
                                color: "rgba(255,255,255,0.4)", textDecoration: "none", transition: "all 0.15s"
                              }}>
                                <ExternalLink size={15} />
                              </a>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "16px", padding: "64px 32px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}>
            <Database size={48} style={{ color: "rgba(255,255,255,0.15)", marginBottom: "4px" }} />
            <h3 style={{ fontSize: "20px", color: "#fff", fontWeight: 700 }}>No Torrents Found</h3>
            <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "14px" }}>We couldn't find any active torrent releases for "{activeQuery}".</p>
            <p style={{ color: "rgba(255,255,255,0.25)", fontSize: "12px", marginTop: "4px" }}>Tip: Try searching for a simplified anime title or English title names.</p>
          </div>
        )}
      </div>
    </div>
  );
}
