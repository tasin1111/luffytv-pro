"use client";

import { useState, useEffect, useCallback } from "react";
import { useAppStore } from "./store";

/**
 * AnimeComments — reusable comment section
 *
 * Used on:
 *   - anime-detail.tsx (Comments tab)
 *   - watch-page.tsx (bottom of watch page)
 *
 * Storage strategy:
 *   1. PRIMARY: localStorage (per-browser, works on Vercel where SQLite is read-only)
 *   2. OPTIONAL: tries to sync with /api/comments server endpoint
 *      - If server returns real data (DB available), merges it in
 *      - If server returns empty/fake data (DB unavailable), uses localStorage only
 *
 * Comments are keyed by animeId so each anime has its own thread.
 */

const STORAGE_KEY = "luffytv_comments";

type LocalComment = {
  id: string;
  animeId: string;
  animeTitle?: string;
  episode?: number | null;
  username: string;
  content: string;
  rating?: number | null;
  likes: number;
  createdAt: string;
};

function loadAllLocal(): Record<string, LocalComment[]> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

function saveAllLocal(all: Record<string, LocalComment[]>) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {}
}

function loadLocalComments(animeId: string): LocalComment[] {
  return loadAllLocal()[animeId] || [];
}

function saveLocalComment(c: LocalComment) {
  const all = loadAllLocal();
  if (!all[c.animeId]) all[c.animeId] = [];
  all[c.animeId].unshift(c);
  saveAllLocal(all);
}

export default function AnimeComments({
  animeId,
  animeTitle,
  episode,
  variant = "full",
}: {
  animeId: string;
  animeTitle: string;
  episode?: number | null;
  variant?: "full" | "compact";
}) {
  const user = useAppStore((s) => s.user);
  const navigate = useAppStore((s) => s.navigate);
  const [comments, setComments] = useState<LocalComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState("");
  const [rating, setRating] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [stats, setStats] = useState({ avgRating: 0, totalRatings: 0 });

  const fetchComments = useCallback(async () => {
    setLoading(true);
    // 1. Load local comments immediately (instant)
    const local = loadLocalComments(animeId);

    // 2. Try server API in parallel (may have shared comments if DB is configured)
    let serverComments: LocalComment[] = [];
    try {
      const res = await fetch(`/api/comments?animeId=${encodeURIComponent(animeId)}`);
      if (res.ok) {
        const data = await res.json();
        serverComments = (data.comments || []).filter(
          (c: any) => c && c.id && c.id !== "0" // filter out safe-proxy fake responses
        );
      }
    } catch {}

    // 3. Merge: server comments + local comments, dedupe by id
    const merged: LocalComment[] = [];
    const seen = new Set<string>();
    // Server first (older, shared), then local (newer, this browser)
    for (const c of serverComments) {
      if (!seen.has(c.id)) {
        seen.add(c.id);
        merged.push(c);
      }
    }
    for (const c of local) {
      if (!seen.has(c.id)) {
        seen.add(c.id);
        merged.push(c);
      }
    }
    // Sort by createdAt desc (newest first)
    merged.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    setComments(merged);

    // Calculate stats from all merged comments that have a rating
    const rated = merged.filter((c) => c.rating != null && c.rating > 0);
    const avg =
      rated.length > 0
        ? rated.reduce((sum, c) => sum + (c.rating || 0), 0) / rated.length
        : 0;
    setStats({
      avgRating: Math.round(avg * 10) / 10,
      totalRatings: rated.length,
    });
    setLoading(false);
  }, [animeId]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !content.trim()) return;
    setSubmitting(true);

    // Use logged-in user's name as the comment username
    const commentUsername = user.name || user.username;

    // Create the comment object immediately (instant UX)
    const newComment: LocalComment = {
      id: `local_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      animeId,
      animeTitle: animeTitle || undefined,
      episode: episode != null && episode > 0 ? Number(episode) : null,
      username: commentUsername,
      content: content.trim(),
      rating: rating > 0 ? rating : null,
      likes: 0,
      createdAt: new Date().toISOString(),
    };

    // 1. Save to localStorage (instant, always works)
    saveLocalComment(newComment);

    // 2. Try to also post to server (for cross-device sync if DB is configured)
    try {
      await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          animeId,
          episode: episode != null && episode > 0 ? Number(episode) : null,
          username: commentUsername,
          content: content.trim(),
          rating: rating > 0 ? rating : null,
        }),
      });
    } catch {}

    // 3. Clear form and refetch
    setContent("");
    setRating(0);
    setSubmitting(false);
    fetchComments();
  };

  const formatTime = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(dateStr).toLocaleDateString();
  };

  const headingClass =
    variant === "compact" ? "text-base font-bold text-white" : "text-lg font-bold text-white";

  return (
    <div className="space-y-5 fade-in">
      {/* Section header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-white/70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          <h2 className={headingClass}>
            Community Discussion
            {comments.length > 0 && (
              <span className="ml-2 text-xs font-medium text-white/40">({comments.length})</span>
            )}
          </h2>
        </div>
      </div>

      {/* Rating summary */}
      {stats.totalRatings > 0 && (
        <div className="flex items-center gap-4 p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
          <div className="text-center min-w-[60px]">
            <p className="text-3xl font-bold text-yellow-400 leading-none">{stats.avgRating}</p>
            <div className="flex items-center gap-0.5 justify-center mt-1.5">
              {Array.from({ length: 5 }).map((_, i) => (
                <svg key={i} className={`w-3 h-3 ${i < Math.round(stats.avgRating) ? "text-yellow-400" : "text-white/10"}`} fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
              ))}
            </div>
            <p className="text-[10px] text-white/30 mt-1">{stats.totalRatings} rating{stats.totalRatings !== 1 ? "s" : ""}</p>
          </div>
          <div className="h-12 w-px bg-white/[0.06]" />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-white/60">Community rating</p>
            <p className="text-xs text-white/30 truncate">for {animeTitle}</p>
          </div>
        </div>
      )}

      {/* Comment form — gated on login */}
      {user ? (
        <form onSubmit={handleSubmit} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold border border-white/15 shrink-0"
                style={{
                  backgroundColor: (user.avatarColor || "#7c3aed") + "44",
                  color: user.avatarColor || "#7c3aed",
                }}
              >
                {(user.avatar || user.username.charAt(0) || "?").toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-bold text-white leading-tight">{user.name}</p>
                <p className="text-[10px] text-white/40 font-mono">@{user.username}</p>
              </div>
            </div>
            <span className="text-[10px] text-white/30">{content.length}/500</span>
          </div>
          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder={`Share your thoughts about ${animeTitle ? animeTitle.slice(0, 40) : "this anime"}...`}
            className="w-full px-3 py-2 rounded-lg bg-black/40 border border-white/[0.06] text-sm text-white placeholder-white/20 outline-none focus:border-white/20 transition-colors resize-none"
            rows={3}
            maxLength={500}
          />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              <span className="text-xs text-white/30 mr-1">Rating:</span>
              {Array.from({ length: 5 }).map((_, i) => (
                <button key={i} type="button" onClick={() => setRating(i + 1 === rating ? 0 : i + 1)} className="hover:scale-110 transition-transform">
                  <svg className={`w-5 h-5 transition-colors ${i < rating ? "text-yellow-400" : "text-white/10"}`} fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                </button>
              ))}
            </div>
            <button
              type="submit"
              disabled={submitting || !content.trim()}
              className="px-5 py-2 rounded-lg bg-white text-black text-xs font-bold hover:bg-white/90 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              {submitting ? "Posting..." : "Post Comment"}
            </button>
          </div>
        </form>
      ) : (
        /* Sign-in CTA when logged out */
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6 text-center">
          <div className="w-12 h-12 rounded-full bg-white/[0.04] flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <p className="text-sm font-bold text-white mb-1">Sign in to leave a comment</p>
          <p className="text-xs text-white/40 mb-4">Join the community discussion — it&apos;s free!</p>
          <div className="flex items-center justify-center gap-2">
            <button
              onClick={() => navigate({ page: "signin" })}
              className="px-4 py-2 rounded-lg bg-[#3b82f6] text-white text-xs font-bold hover:bg-[#60a5fa] transition-colors"
            >
              Sign in
            </button>
            <button
              onClick={() => navigate({ page: "signup" })}
              className="px-4 py-2 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white text-xs font-bold hover:bg-white/[0.1] transition-colors"
            >
              Create account
            </button>
          </div>
        </div>
      )}

      {/* Comments list */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 animate-pulse">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 rounded-full bg-white/5" />
                <div className="h-3 w-24 bg-white/5 rounded" />
              </div>
              <div className="h-3 w-full bg-white/5 rounded mb-1" />
              <div className="h-3 w-2/3 bg-white/5 rounded" />
            </div>
          ))}
        </div>
      ) : comments.length === 0 ? (
        <div className="text-center py-12 rounded-xl border border-white/[0.06] bg-white/[0.02]">
          <svg className="w-12 h-12 text-white/10 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          <p className="text-white/30 text-sm">No comments yet. Be the first to share your thoughts!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {comments.map((c) => (
            <div key={c.id} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 hover:border-white/[0.12] transition-colors">
              <div className="flex items-center gap-2.5 mb-2">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-white/10 to-white/[0.02] flex items-center justify-center shrink-0 border border-white/10">
                  <span className="text-xs font-bold text-white/60">{(c.username || "A")[0].toUpperCase()}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <p className="text-sm font-bold text-white truncate">{c.username || "Anonymous"}</p>
                    {c.episode != null && Number(c.episode) > 0 && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[#FF8C00]/15 text-[#FF8C00] uppercase tracking-wider shrink-0">
                        EP {c.episode}
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-white/30">{formatTime(c.createdAt)}</p>
                </div>
                {c.rating && (
                  <div className="flex items-center gap-0.5 shrink-0">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <svg key={i} className={`w-3 h-3 ${i < c.rating ? "text-yellow-400" : "text-white/10"}`} fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                    ))}
                  </div>
                )}
              </div>
              <p className="text-sm text-white/70 leading-relaxed break-words whitespace-pre-wrap">{c.content}</p>
              {c.likes > 0 && (
                <div className="flex items-center gap-1 mt-2 text-xs text-white/30">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3zM7 22H4a2 2 0 01-2-2v-7a2 2 0 012-2h3" /></svg>
                  {c.likes}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
