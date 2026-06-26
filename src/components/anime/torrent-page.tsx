"use client";

import { useState, useEffect } from "react";
import { Search, Download, Check, ExternalLink, AlertTriangle, Database, Magnet } from "lucide-react";
import { useAppStore } from "./store";

// ============================================================
// TORRENT PAGE — Anime torrent search via feed.animetosho.org (modern v4)
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
      if (!res.ok) throw new Error(`Failed to fetch torrents (Status: ${res.status})`);
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

  useEffect(() => { fetchTorrents(activeQuery); }, [activeQuery]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) setActiveQuery(searchQuery.trim());
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
    <div className="ltv-v4 min-h-screen" style={{ paddingTop: "90px" }}>
      <div className="max-w-[1200px] mx-auto px-4 lg:px-6 flex flex-col gap-5">

        {/* Header */}
        <div className="text-center mb-2 flex flex-col items-center gap-2">
          <div className="w-12 h-12 rounded-xl bg-white/[0.03] border border-white/[0.08] flex items-center justify-center">
            <Database size={24} className="text-[#E63946]" />
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight"
              style={{ background: "linear-gradient(135deg, #fff 30%, #E63946 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
            Torrent Index
          </h1>
          <p className="text-white/50 text-sm max-w-[560px] leading-relaxed">
            Find high-quality anime releases, episodes, and movies indexed directly from torrent networks.
          </p>
        </div>

        {/* Search Panel */}
        <div className="ltv-card p-5 flex flex-col gap-4">
          <form onSubmit={handleSearchSubmit} className="flex gap-3">
            <div className="relative flex-1 ltv-search-input">
              <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none" />
              <input
                type="text"
                placeholder="Search anime releases (e.g. Naruto, Demon Slayer)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="ltv-input"
                style={{ height: "48px", paddingLeft: "44px" }}
              />
            </div>
            <button type="submit" disabled={loading} className="ltv-btn ltv-btn-primary" style={{ height: "48px", padding: "0 28px" }}>
              {loading ? <div className="ltv-spinner" /> : "Search"}
            </button>
          </form>

          {/* Popular chips */}
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-[11px] text-white/30 uppercase tracking-wider font-bold">
              Popular:
            </span>
            <div className="flex gap-2 flex-wrap">
              {POPULAR_SEARCHES.map((query) => (
                <button key={query} type="button" onClick={() => handleChipClick(query)}
                  className={`ltv-filter-chip${activeQuery === query ? " is-active" : ""}`}>
                  {query}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Results */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="ltv-spinner ltv-spinner-lg" />
            <p className="text-white/50 text-sm">Searching indexes for &ldquo;{activeQuery}&rdquo;...</p>
          </div>
        ) : error ? (
          <div className="ltv-card p-8 flex flex-col items-center justify-center text-center gap-3"
               style={{ background: "rgba(230,57,70,0.05)", borderColor: "rgba(230,57,70,0.20)" }}>
            <AlertTriangle size={32} className="text-[#E63946]" />
            <div>
              <h3 className="text-base font-bold mb-1">Search Failed</h3>
              <p className="text-white/50 text-sm">{error}</p>
            </div>
            <button onClick={() => fetchTorrents(activeQuery)} className="ltv-btn ltv-btn-ghost">
              Retry
            </button>
          </div>
        ) : results.length > 0 ? (
          <div>
            <div className="flex justify-between items-center mb-3 px-1">
              <span className="text-sm text-white/55">
                Found <strong className="text-white">{results.length}</strong> torrents for &ldquo;{activeQuery}&rdquo;
              </span>
              <span className="ltv-pill ltv-pill-gold">
                Sorted by Seeders
              </span>
            </div>

            {/* Results list — modern card-based */}
            <div className="flex flex-col gap-2">
              {results.map((torrent, index) => {
                const uniqueId = `${torrent.magnet || index}-${index}`;
                const isCopied = copiedId === uniqueId;
                return (
                  <div key={uniqueId} className="ltv-torrent-card">
                    {/* Title */}
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white leading-snug line-clamp-2" title={torrent.title}>
                        {torrent.title}
                      </p>
                    </div>

                    {/* Size */}
                    <div className="text-xs font-mono text-white/55 text-center">
                      {torrent.size || "N/A"}
                    </div>

                    {/* Seeders */}
                    <div className="flex items-center justify-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#10B981]" />
                      <span className="text-xs font-bold text-[#10B981]">{torrent.seeders ?? 0}</span>
                      <span className="text-[10px] text-white/40 uppercase tracking-wider">seed</span>
                    </div>

                    {/* Leechers */}
                    <div className="flex items-center justify-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#E63946]" />
                      <span className="text-xs font-bold text-[#E63946]">{torrent.leechers ?? 0}</span>
                      <span className="text-[10px] text-white/40 uppercase tracking-wider">leech</span>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-1.5 justify-center items-center">
                      <button type="button" onClick={() => handleCopyMagnet(torrent.magnet, uniqueId)}
                        title={isCopied ? "Copied!" : "Copy Magnet Link"}
                        className={`flex items-center justify-center w-8 h-8 rounded-md border transition-all ${
                          isCopied
                            ? "border-[#10B981] bg-[#10B981]/15 text-[#10B981]"
                            : "border-white/[0.08] bg-transparent text-white/55 hover:bg-white/[0.06] hover:text-white"
                        }`}>
                        {isCopied ? <Check size={15} /> : <Magnet size={15} />}
                      </button>
                      {torrent.torrent && (
                        <a href={torrent.torrent} target="_blank" rel="noopener noreferrer" title="Download .torrent"
                          className="flex items-center justify-center w-8 h-8 rounded-md border border-white/[0.08] bg-transparent text-[#4A90E2]/80 hover:bg-white/[0.06] hover:text-[#4A90E2] transition-all">
                          <Download size={15} />
                        </a>
                      )}
                      {torrent.link && (
                        <a href={torrent.link} target="_blank" rel="noopener noreferrer" title="View on AnimeTosho"
                          className="flex items-center justify-center w-8 h-8 rounded-md border border-white/[0.08] bg-transparent text-white/40 hover:bg-white/[0.06] hover:text-white transition-all">
                          <ExternalLink size={15} />
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="ltv-empty">
            <div className="ltv-empty-icon">
              <Database size={28} />
            </div>
            <div className="ltv-empty-title">No Torrents Found</div>
            <div className="ltv-empty-desc">
              We couldn&apos;t find any active torrent releases for &ldquo;{activeQuery}&rdquo;.
              <br />
              <span className="text-white/30 text-xs mt-2 block">Tip: Try searching for a simplified anime title or English title names.</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
