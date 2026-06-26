"use client";

import { useState, useEffect, useCallback } from "react";
import { useAppStore } from "./store";

// ============================================================
// LIVE NEWS PAGE — WatchFooty News API
// Dedicated news section with sport filters, search, pagination
// API: https://api.watchfooty.st/api/v1/news
// Full article detail view with BBCode content parser
// ============================================================

interface NewsArticle {
  id: string;
  headline: string;
  description: string | null;
  url: string;
  imageUrl: string | null;
  publishedAt: string;
  editedAt: string | null;
  sport: string;
  author: string | null;
  content?: string | null;
  mentions?: {
    name: string;
    url: string;
    entityId: string;
    entityType: string;
  }[] | null;
}

interface NewsPagination {
  limit: number;
  offset: number;
  nextOffset: number | null;
}

const SPORT_FILTERS = [
  { id: "all", label: "All Sports", icon: "📰", color: "#ffffff" },
  { id: "football", label: "Football", icon: "⚽", color: "#22c55e" },
  { id: "basketball", label: "Basketball", icon: "🏀", color: "#ef4444" },
  { id: "american-football", label: "NFL", icon: "🏈", color: "#dc2626" },
  { id: "hockey", label: "Hockey", icon: "🏒", color: "#06b6d4" },
  { id: "baseball", label: "Baseball", icon: "⚾", color: "#3b82f6" },
  { id: "tennis", label: "Tennis", icon: "🎾", color: "#a855f7" },
  { id: "fight", label: "MMA/Boxing", icon: "🥊", color: "#f97316" },
  { id: "motor-sports", label: "Motorsport", icon: "🏎️", color: "#eab308" },
  { id: "cricket", label: "Cricket", icon: "🏏", color: "#f59e0b" },
  { id: "rugby", label: "Rugby", icon: "🏉", color: "#10b981" },
  { id: "golf", label: "Golf", icon: "⛳", color: "#84cc16" },
];

const SPORT_TAG_COLORS: Record<string, string> = {
  football: "#22c55e",
  basketball: "#ef4444",
  hockey: "#06b6d4",
  baseball: "#3b82f6",
  tennis: "#a855f7",
  fight: "#f97316",
  "motor-sports": "#eab308",
  cricket: "#f59e0b",
  rugby: "#10b981",
  golf: "#84cc16",
  "american-football": "#dc2626",
  other: "#6b7280",
};

function timeAgo(dateStr: string): string {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

function getSportColor(sport: string): string {
  return SPORT_TAG_COLORS[sport] || SPORT_TAG_COLORS.other;
}

function getSportLabel(sport: string): string {
  const found = SPORT_FILTERS.find(f => f.id === sport);
  return found ? found.label : sport;
}

// ── BBCode-like content parser ──
// Converts WatchFooty's custom format to React elements
// Format: [p]...[/p], [b]...[/b], [i]...[/i], [a href="..."]...[/a], [embed .../]
function parseContent(content: string): React.ReactNode[] {
  if (!content) return [];

  const nodes: React.ReactNode[] = [];
  // Split into segments: tags and text
  const regex = /(\[\/?(?:p|b|i|a|embed)(?:\s[^\]]*?)?(?:\s*\/?)?\])/gi;
  const parts = content.split(regex).filter(Boolean);

  const stack: { tag: string; attrs: Record<string, string>; children: React.ReactNode[] }[] = [
    { tag: "root", attrs: {}, children: [] },
  ];

  function current() {
    return stack[stack.length - 1];
  }

  let keyIdx = 0;

  function parseAttrs(tagStr: string): Record<string, string> {
    const attrs: Record<string, string> = {};
    const attrRegex = /(\w+)=["']([^"']*)["']/g;
    let m;
    while ((m = attrRegex.exec(tagStr)) !== null) {
      attrs[m[1]] = m[2];
    }
    return attrs;
  }

  for (const part of parts) {
    // Opening tag
    const openMatch = part.match(/^\[(p|b|i|a|embed)(?:\s([^\]]*?))?\s*\/?\]$/i);
    // Closing tag
    const closeMatch = part.match(/^\[\/(p|b|i|a|embed)\]$/i);
    // Self-closing embed
    const selfCloseMatch = part.match(/^\[embed\s+(.*?)\s*\/\]$/i);

    if (selfCloseMatch) {
      const attrs = parseAttrs(selfCloseMatch[1]);
      const embedUrl = attrs.url || "";
      const socialType = attrs["social-type"] || "";

      if (embedUrl && socialType === "twitter") {
        current().children.push(
          <div key={`embed-${keyIdx++}`} className="my-4 rounded-xl overflow-hidden border border-white/[0.08]">
            <blockquote className="twitter-tweet" data-dnt="true">
              <a href={embedUrl} target="_blank" rel="noopener noreferrer" className="block p-4 bg-white/[0.03]">
                <div className="flex items-center gap-2 mb-2">
                  <svg className="w-4 h-4 text-[#1DA1F2]" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                  </svg>
                  <span className="text-[10px] text-[#1DA1F2] font-bold">View on X</span>
                </div>
              </a>
            </blockquote>
          </div>
        );
      } else if (embedUrl) {
        current().children.push(
          <a
            key={`embed-link-${keyIdx++}`}
            href={embedUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block my-4 p-3 rounded-xl bg-white/[0.03] border border-white/[0.08] text-[#ffffff] hover:bg-white/[0.06] transition-all text-xs"
          >
            🔗 View embedded content
          </a>
        );
      }
    } else if (openMatch && !closeMatch) {
      const tag = openMatch[1].toLowerCase();
      const isSelfClose = part.endsWith("/]");

      if (isSelfClose) {
        // Self-closing non-embed (unlikely but handle)
        continue;
      }

      const attrs = openMatch[2] ? parseAttrs(openMatch[2]) : {};
      stack.push({ tag, attrs, children: [] });
    } else if (closeMatch) {
      const tag = closeMatch[1].toLowerCase();
      // Find matching open tag in stack
      let found = false;
      for (let i = stack.length - 1; i > 0; i--) {
        if (stack[i].tag === tag) {
          const node = stack.pop()!;
          const rendered = renderNode(node.tag, node.attrs, node.children, keyIdx++);
          current().children.push(rendered);
          found = true;
          break;
        }
      }
      if (!found) {
        // No matching open tag, treat as text
        current().children.push(part);
      }
    } else {
      // Plain text
      if (part.trim()) {
        current().children.push(part);
      }
    }
  }

  // Flatten remaining stack
  while (stack.length > 1) {
    const node = stack.pop()!;
    const rendered = renderNode(node.tag, node.attrs, node.children, keyIdx++);
    current().children.push(rendered);
  }

  return stack[0].children;
}

function renderNode(
  tag: string,
  attrs: Record<string, string>,
  children: React.ReactNode[],
  key: number
): React.ReactNode {
  const text = children;

  switch (tag) {
    case "p":
      return (
        <p key={`p-${key}`} className="mb-3 text-white/65 text-[13px] leading-relaxed">
          {text}
        </p>
      );
    case "b":
      return (
        <strong key={`b-${key}`} className="font-bold text-white/85">
          {text}
        </strong>
      );
    case "i":
      return (
        <em key={`i-${key}`} className="italic text-white/50">
          {text}
        </em>
      );
    case "a": {
      const href = attrs.href || "#";
      const isExternal = href.startsWith("http");
      return (
        <a
          key={`a-${key}`}
          href={href}
          target={isExternal ? "_blank" : undefined}
          rel={isExternal ? "noopener noreferrer" : undefined}
          className="text-[#ffffff] hover:text-[#9d8ff5] underline underline-offset-2 transition-colors"
        >
          {text}
        </a>
      );
    }
    default:
      return <span key={`span-${key}`}>{text}</span>;
  }
}

export default function LiveNewsPage() {
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedSport, setSelectedSport] = useState("all");
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [pagination, setPagination] = useState<NewsPagination | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selectedArticle, setSelectedArticle] = useState<NewsArticle | null>(null);
  const [articleLoading, setArticleLoading] = useState(false);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => setSearchQuery(searchInput), 500);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Fetch news articles
  const fetchNews = useCallback(async (offset: number = 0, append: boolean = false) => {
    if (offset === 0) setLoading(true);
    else setLoadingMore(true);
    setError("");

    try {
      const params = new URLSearchParams();
      params.set("limit", "24");
      params.set("offset", String(offset));
      params.set("sort", "newest");
      if (selectedSport !== "all") params.set("sport", selectedSport);
      if (searchQuery) params.set("q", searchQuery);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const res = await fetch(`/api/news?${params.toString()}`, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (!res.ok) throw new Error("Failed to load news");
      const data = await res.json();

      const newArticles: NewsArticle[] = data.articles || [];
      if (append) {
        setArticles(prev => [...prev, ...newArticles]);
      } else {
        setArticles(newArticles);
      }
      setPagination(data.pagination || null);
    } catch (err: any) {
      setError(err.message || "Failed to load news");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [selectedSport, searchQuery]);

  useEffect(() => { fetchNews(0, false); }, [fetchNews]);

  // Load more articles
  const loadMore = useCallback(() => {
    if (pagination?.nextOffset !== null && pagination?.nextOffset !== undefined) {
      fetchNews(pagination.nextOffset, true);
    }
  }, [pagination, fetchNews]);

  // Fetch article detail
  const fetchArticleDetail = useCallback(async (articleId: string) => {
    setArticleLoading(true);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const res = await fetch(`/api/news/article/${encodeURIComponent(articleId)}`, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        setSelectedArticle(data);
      }
    } catch {
      // Fallback: just use the article data we already have
    }
    setArticleLoading(false);
  }, []);

  // Handle article click — open detail view
  const handleArticleClick = (article: NewsArticle) => {
    setSelectedArticle(article);
    fetchArticleDetail(article.id);
  };

  // Close article detail
  const closeArticleDetail = () => {
    setSelectedArticle(null);
  };

  // Back to list with ESC key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape" && selectedArticle) closeArticleDetail();
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [selectedArticle]);

  // ── ARTICLE DETAIL FULL PAGE VIEW ──
  if (selectedArticle) {
    const sportColor = getSportColor(selectedArticle.sport);

    return (
      <div className="min-h-screen -mx-4 lg:-mx-8" style={{ background: "linear-gradient(180deg, #0a0a12 0%, #0d0d18 30%, #0a0a12 100%)" }}>
        {/* Top bar */}
        <div className="sticky top-0 z-30 flex items-center justify-between px-4 lg:px-8 py-3 bg-[#0a0a12]/95 backdrop-blur-md border-b border-white/[0.06]">
          <button
            onClick={closeArticleDetail}
            className="flex items-center gap-2 text-white/50 hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            <span className="text-[12px] font-bold" style={{ fontFamily: "var(--font-space-mono), 'Space Mono', monospace" }}>
              Back to News
            </span>
          </button>

          <div className="flex items-center gap-2">
            <span
              className="px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider text-white"
              style={{ background: `${sportColor}30`, color: sportColor }}
            >
              {getSportLabel(selectedArticle.sport)}
            </span>
          </div>
        </div>

        {/* Hero image */}
        {selectedArticle.imageUrl && (
          <div className="relative h-56 sm:h-72 lg:h-80 overflow-hidden">
            <img
              src={selectedArticle.imageUrl}
              alt=""
              className="w-full h-full object-cover"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a12] via-[#0a0a12]/50 to-transparent" />
          </div>
        )}

        {/* Article body */}
        <div className="px-4 lg:px-8 -mt-16 relative z-10 max-w-3xl mx-auto">
          {/* Sport badge + meta */}
          <div className="flex items-center gap-3 mb-3">
            <span
              className="px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-wider text-white"
              style={{ background: `${sportColor}25`, color: sportColor, border: `1px solid ${sportColor}30` }}
            >
              {getSportLabel(selectedArticle.sport)}
            </span>
            <span className="text-[11px] text-white/30">{timeAgo(selectedArticle.publishedAt)}</span>
            {selectedArticle.editedAt && (
              <span className="text-[10px] text-white/15">(edited)</span>
            )}
          </div>

          {/* Headline */}
          <h1
            className="text-xl sm:text-2xl lg:text-3xl font-black text-white leading-tight mb-4"
            style={{ fontFamily: "var(--font-space-mono), 'Space Mono', monospace" }}
          >
            {selectedArticle.headline}
          </h1>

          {/* Author */}
          {selectedArticle.author && (
            <div className="flex items-center gap-2 mb-6">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-black text-white/60"
                style={{ background: `${sportColor}20`, border: `1px solid ${sportColor}25` }}
              >
                {selectedArticle.author.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="text-[12px] text-white/60 font-medium">{selectedArticle.author}</p>
                <p className="text-[10px] text-white/25">{new Date(selectedArticle.publishedAt).toLocaleDateString([], { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</p>
              </div>
            </div>
          )}

          {/* Divider */}
          <div className="h-px bg-white/[0.06] mb-6" />

          {/* Loading state */}
          {articleLoading ? (
            <div className="flex items-center justify-center py-12 gap-3">
              <div className="w-8 h-8 rounded-full border-2 border-[#ffffff]/30 border-t-[#ffffff] animate-spin" />
              <span className="text-sm text-white/30">Loading full article...</span>
            </div>
          ) : (
            <>
              {/* Parsed content */}
              {selectedArticle.content ? (
                <article className="mb-8">
                  {parseContent(selectedArticle.content)}
                </article>
              ) : selectedArticle.description ? (
                <p className="text-[13px] text-white/60 leading-relaxed mb-8">{selectedArticle.description}</p>
              ) : (
                <p className="text-sm text-white/30 mb-8">No content available.</p>
              )}

              {/* Entity mentions */}
              {selectedArticle.mentions && selectedArticle.mentions.length > 0 && (
                <div className="mb-6 pt-4 border-t border-white/[0.06]">
                  <p className="text-[10px] text-white/20 font-bold uppercase tracking-wider mb-3">Related Topics</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedArticle.mentions.map((mention, i) => (
                      <a
                        key={i}
                        href={mention.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-medium bg-white/[0.04] text-white/40 hover:text-white/70 hover:bg-white/[0.06] border border-white/[0.04] hover:border-white/[0.08] transition-all"
                      >
                        {mention.entityType === "sport" && "🏋️"}
                        {mention.entityType === "participant" && "👥"}
                        {mention.entityType === "tournament_template" && "🏆"}
                        {mention.entityType === "tag" && "🏷️"}
                        {mention.name}
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Read full article link */}
              <div className="mb-8 pt-4 border-t border-white/[0.06]">
                <a
                  href={selectedArticle.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-[12px] font-bold bg-[#ffffff]/15 text-[#ffffff] hover:bg-[#ffffff]/25 transition-all border border-[#ffffff]/20"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" />
                  </svg>
                  Read Full Article on WatchFooty
                </a>
              </div>

              {/* Share section */}
              <div className="mb-8 pt-4 border-t border-white/[0.06]">
                <p className="text-[10px] text-white/20 font-bold uppercase tracking-wider mb-3">Share</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      if (navigator.share) {
                        navigator.share({ title: selectedArticle.headline, url: selectedArticle.url });
                      } else {
                        navigator.clipboard.writeText(selectedArticle.url);
                      }
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold bg-white/[0.04] text-white/40 hover:text-white/70 hover:bg-white/[0.06] border border-white/[0.04] transition-all"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
                      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                    </svg>
                    Share
                  </button>
                  <button
                    onClick={() => { navigator.clipboard.writeText(selectedArticle.url); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold bg-white/[0.04] text-white/40 hover:text-white/70 hover:bg-white/[0.06] border border-white/[0.04] transition-all"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                    </svg>
                    Copy Link
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  // ── NEWS LIST VIEW ──
  return (
    <div className="min-h-screen pb-8 -mx-4 lg:-mx-8" style={{ background: "linear-gradient(180deg, rgba(7,7,12,1) 0%, rgba(12,12,20,1) 30%, rgba(7,7,12,1) 100%)" }}>
      {/* Header + Search */}
      <div className="px-4 lg:px-8 pt-4 pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1
              className="text-2xl font-black text-white"
              style={{ fontFamily: "var(--font-space-mono), 'Space Mono', monospace" }}
            >
              Sports News
            </h1>
            <p className="text-white/30 text-xs mt-0.5">
              {articles.length > 0 ? `${articles.length} articles` : "Loading..."}
              {" "}from WatchFooty
            </p>
          </div>

          {/* Search Bar */}
          <div className="relative w-full sm:w-64">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/25" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search news..."
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-white/25 outline-none focus:border-[#ffffff]/40 focus:bg-white/[0.06] transition-all"
              style={{ fontFamily: "var(--font-inter), 'Inter', sans-serif" }}
            />
            {searchInput && (
              <button
                onClick={() => setSearchInput("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/25 hover:text-white/60 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Sport Filter Chips */}
      <div className="px-4 lg:px-8 mb-2">
        <div className="flex gap-1.5 overflow-x-auto scrollbar-hide pb-1">
          {SPORT_FILTERS.map(filter => {
            const isActive = selectedSport === filter.id;
            return (
              <button
                key={filter.id}
                onClick={() => setSelectedSport(filter.id === selectedSport ? "all" : filter.id)}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-bold whitespace-nowrap transition-all ${
                  isActive
                    ? "text-white"
                    : "bg-white/[0.03] text-white/40 hover:text-white/60 hover:bg-white/[0.06] border border-white/[0.04]"
                }`}
                style={{
                  ...(isActive ? {
                    background: `linear-gradient(135deg, ${filter.color}25, ${filter.color}10)`,
                    border: `1px solid ${filter.color}40`,
                  } : {}),
                  fontFamily: "var(--font-space-mono), 'Space Mono', monospace",
                }}
              >
                <span className="text-sm">{filter.icon}</span>
                {filter.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Loading State */}
      {loading && articles.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <div className="w-12 h-12 rounded-full border-2 border-[#ffffff]/30 border-t-[#ffffff] animate-spin" />
          <p className="text-sm text-white/30">Loading news...</p>
          <p className="text-[10px] text-white/15">
            {selectedSport !== "all" ? `Fetching ${SPORT_FILTERS.find(f => f.id === selectedSport)?.label || selectedSport} news` : "Fetching latest sports news"}
          </p>
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <div className="text-5xl">📰</div>
          <p className="text-sm text-white/40">{error}</p>
          <button
            onClick={() => fetchNews(0, false)}
            className="px-4 py-2 rounded-lg bg-white/[0.06] text-white/50 text-[11px] font-bold hover:bg-white/[0.08]"
          >
            Retry
          </button>
        </div>
      )}

      {/* News Articles Grid */}
      {!loading && !error && (
        <div className="px-4 lg:px-8">
          {/* Featured article — first article with large card */}
          {articles.length > 0 && (
            <div className="mb-6">
              <button
                onClick={() => handleArticleClick(articles[0])}
                className="group w-full block rounded-2xl overflow-hidden border border-white/[0.06] hover:border-white/[0.12] transition-all duration-300 text-left"
              >
                <div className="relative">
                  {articles[0].imageUrl ? (
                    <div className="relative h-48 sm:h-64 lg:h-72 overflow-hidden">
                      <img
                        src={articles[0].imageUrl}
                        alt=""
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
                    </div>
                  ) : (
                    <div
                      className="h-32 sm:h-40"
                      style={{ background: `linear-gradient(135deg, ${getSportColor(articles[0].sport)}25, #0d0d12)` }}
                    />
                  )}

                  {/* Featured badge */}
                  <div className="absolute top-3 left-3 z-10">
                    <span className="px-2 py-0.5 rounded-md bg-[#ffffff] text-white text-[8px] font-black uppercase tracking-wider">
                      Featured
                    </span>
                  </div>

                  {/* Content overlay */}
                  <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-6">
                    <div className="flex items-center gap-2 mb-2">
                      <span
                        className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider text-white"
                        style={{ background: `${getSportColor(articles[0].sport)}30`, color: getSportColor(articles[0].sport) }}
                      >
                        {getSportLabel(articles[0].sport)}
                      </span>
                      <span className="text-[10px] text-white/40">{timeAgo(articles[0].publishedAt)}</span>
                    </div>
                    <h2 className="text-base sm:text-lg font-bold text-white group-hover:text-[#ffffff] transition-colors leading-snug mb-1" style={{ fontFamily: "var(--font-space-mono), 'Space Mono', monospace" }}>
                      {articles[0].headline}
                    </h2>
                    {articles[0].description && (
                      <p className="text-[11px] text-white/50 line-clamp-2 max-w-2xl">{articles[0].description}</p>
                    )}
                  </div>
                </div>
              </button>
            </div>
          )}

          {/* Article grid — remaining articles */}
          {articles.length > 1 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {articles.slice(1).map(article => {
                const sportColor = getSportColor(article.sport);

                return (
                  <button
                    key={article.id}
                    onClick={() => handleArticleClick(article)}
                    className="group block rounded-xl overflow-hidden bg-white/[0.02] border border-white/[0.06] hover:border-white/[0.12] hover:bg-white/[0.04] transition-all duration-300 hover:scale-[1.02] text-left"
                  >
                    {/* Article image */}
                    {article.imageUrl ? (
                      <div className="h-36 overflow-hidden">
                        <img
                          src={article.imageUrl}
                          alt=""
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                        />
                      </div>
                    ) : (
                      <div
                        className="h-20 flex items-center justify-center"
                        style={{ background: `linear-gradient(135deg, ${sportColor}15, ${sportColor}06, #0d0d12)` }}
                      >
                        <span className="text-3xl opacity-30">📰</span>
                      </div>
                    )}

                    {/* Article content */}
                    <div className="p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <span
                          className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider"
                          style={{ background: `${sportColor}20`, color: sportColor }}
                        >
                          {getSportLabel(article.sport)}
                        </span>
                        <span className="text-[8px] text-white/25">{timeAgo(article.publishedAt)}</span>
                      </div>
                      <p className="text-[11px] font-bold text-white/80 group-hover:text-white line-clamp-2 mb-1 leading-snug">
                        {article.headline}
                      </p>
                      {article.description && (
                        <p className="text-[9px] text-white/35 line-clamp-2">{article.description}</p>
                      )}
                      {article.author && (
                        <p className="text-[8px] text-white/15 mt-1.5">by {article.author}</p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* Load More Button */}
          {pagination?.nextOffset !== null && pagination?.nextOffset !== undefined && (
            <div className="flex justify-center mt-6">
              <button
                onClick={loadMore}
                disabled={loadingMore}
                className="px-6 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white/40 text-[11px] font-bold hover:bg-white/[0.06] hover:text-white/60 transition-all disabled:opacity-50"
                style={{ fontFamily: "var(--font-space-mono), 'Space Mono', monospace" }}
              >
                {loadingMore ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 rounded-full border-2 border-white/20 border-t-white/60 animate-spin" />
                    Loading more...
                  </span>
                ) : (
                  "Load More Articles"
                )}
              </button>
            </div>
          )}

          {/* No articles */}
          {articles.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <div className="text-5xl">🔍</div>
              <p className="text-sm text-white/40">No news articles found</p>
              <p className="text-[10px] text-white/20">Try adjusting your sport filter or search query</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
