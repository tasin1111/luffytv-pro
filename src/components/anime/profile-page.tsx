"use client";

import { useState, useEffect, useMemo, type ReactNode } from "react";
import { useAppStore, type User, type HistoryItem, type BookmarkItem, type LibraryEntry, type MediaProgressEntry } from "./store";
import { updateUserProfile, isAdminUser } from "@/lib/auth-local";

// ── Customization presets ──
const BANNER_PRESETS: Record<string, (accent: string) => string> = {
  aurora: (a) => `radial-gradient(circle at 15% 0%, ${a}55, transparent 45%), radial-gradient(circle at 85% 10%, ${a}30, transparent 50%), linear-gradient(180deg, #141414, #0a0a0a)`,
  sunset: (a) => `linear-gradient(120deg, ${a}44 0%, #1a0f14 45%, #0a0a0a 100%)`,
  mesh: (a) => `radial-gradient(circle at 20% 20%, ${a}44, transparent 40%), radial-gradient(circle at 70% 60%, ${a}22, transparent 45%), radial-gradient(circle at 90% 10%, ${a}33, transparent 40%), #0c0c0c`,
  wave: (a) => `linear-gradient(60deg, #0a0a0a 0%, ${a}22 50%, #0a0a0a 100%), radial-gradient(circle at 50% -20%, ${a}40, transparent 60%)`,
  minimal: () => `linear-gradient(180deg, #141414, #0a0a0a)`,
};
const BANNER_KEYS = Object.keys(BANNER_PRESETS);

const ACCENT_SWATCHES = [
  "#3b82f6", "#48A6FF", "#F472B6", "#F59E0B", "#10B981",
  "#a855f7", "#22D3EE", "#ef4444", "#84cc16", "#eab308",
];

const GENRE_OPTIONS = [
  "Action", "Adventure", "Comedy", "Drama", "Fantasy", "Horror",
  "Isekai", "Mystery", "Romance", "Sci-Fi", "Slice of Life", "Sports",
  "Supernatural", "Thriller", "Shounen", "Seinen", "Mecha", "Psychological",
];

const AVATAR_EMOJIS = ["", "🔥", "⚔️", "🌙", "👑", "🐉", "⚡", "🌸", "💀", "🎮", "🍥", "⭐", "🥷", "🦊", "🩸", "🗡️"];

function dateKeyOf(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
// Current + best day streaks from a set of active YYYY-MM-DD keys.
function streaksFromKeys(keys: Set<string>): { current: number; best: number } {
  if (keys.size === 0) return { current: 0, best: 0 };
  const days = [...keys].map((k) => { const [y, m, d] = k.split("-").map(Number); return new Date(y, m - 1, d).getTime(); }).sort((a, b) => a - b);
  const DAY = 86400000;
  let best = 1, run = 1;
  for (let i = 1; i < days.length; i++) {
    if (days[i] - days[i - 1] === DAY) { run++; best = Math.max(best, run); }
    else run = 1;
  }
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const t = today.getTime();
  const set = new Set(days);
  let current = 0;
  if (set.has(t) || set.has(t - DAY)) {
    let cur = set.has(t) ? t : t - DAY;
    while (set.has(cur)) { current++; cur -= DAY; }
  }
  return { current, best };
}

/**
 * ProfilePage — redesigned user profile
 *
 * Sections:
 *   1. Profile header — avatar, name, online badge, level/subscription/comments
 *      badges, XP progress bar, edit & logout buttons
 *   2. Two-column layout:
 *      - Left (65%): Activity History (heatmap), Comments, Public Playlists,
 *        Recently Watched Episodes
 *      - Right (35%): Quick Stats, Achievements
 *   3. Edit profile modal (kept from original)
 *   4. Logout confirmation modal (kept from original)
 *
 * If not logged in, redirects to signin.
 */
export default function ProfilePage() {
  const navigate = useAppStore((s) => s.navigate);
  const user = useAppStore((s) => s.user);
  const setUser = useAppStore((s) => s.setUser);
  const logout = useAppStore((s) => s.logout);
  const history = useAppStore((s) => s.history);
  const bookmarks = useAppStore((s) => s.bookmarks);
  const library = useAppStore((s) => s.library);
  const mediaProgress = useAppStore((s) => s.mediaProgress);
  const activity = useAppStore((s) => s.activity);

  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editBio, setEditBio] = useState("");
  const [editColor, setEditColor] = useState("");
  const [editAccent, setEditAccent] = useState("");
  const [editEmoji, setEditEmoji] = useState("");
  const [editBanner, setEditBanner] = useState("aurora");
  const [editTagline, setEditTagline] = useState("");
  const [editFavorites, setEditFavorites] = useState<string[]>([]);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [playlistTab, setPlaylistTab] = useState<"active" | "manga" | "novel">("active");
  const [activityRange, setActivityRange] = useState<"year" | "month" | "week">("year");

  // Redirect to signin if not logged in
  useEffect(() => {
    if (!user) navigate({ page: "signin" });
  }, [user, navigate]);

  // ── Level / XP math ──
  // Anime episode = 10 XP; manga/movie/tv/novel activity carries its own XP.
  // Level = floor(totalXP / 1000) + 1
  const activityXP = activity.reduce((sum, a) => sum + a.xp, 0);
  const totalXP = history.length * 10 + activityXP;
  const level = Math.floor(totalXP / 1000) + 1;
  const xpInCurrentLevel = totalXP % 1000;
  const xpToNextLevel = 1000 - xpInCurrentLevel;
  const xpProgressPct = (xpInCurrentLevel / 1000) * 100;

  // ── Cross-section tallies (real synced data) ──
  const kindCount = useMemo(() => {
    const c: Record<string, number> = { anime: history.length, manga: 0, movie: 0, tv: 0, novel: 0 };
    for (const a of activity) c[a.kind] = (c[a.kind] || 0) + 1;
    return c;
  }, [history, activity]);

  const mangaLib = useMemo(() => library.filter((l) => l.kind === "manga").sort((a, b) => b.addedAt - a.addedAt), [library]);
  const novelLib = useMemo(() => library.filter((l) => l.kind === "novel").sort((a, b) => b.addedAt - a.addedAt), [library]);
  const savedTotal = bookmarks.length + library.length;

  // ── Achievements (real thresholds) ──
  const achievements = useMemo(() => {
    const activeSections = (["anime", "manga", "movie", "tv", "novel"] as const).filter((k) => kindCount[k] > 0).length;
    const defs = [
      { id: "first", icon: "🌱", title: "First Steps", desc: "Log your first activity", ok: (kindCount.anime + kindCount.manga + kindCount.movie + kindCount.tv + kindCount.novel) >= 1 },
      { id: "explorer", icon: "🧭", title: "Explorer", desc: "Active in 2 sections", ok: activeSections >= 2 },
      { id: "polymath", icon: "🌐", title: "Polymath", desc: "Active in all 5 sections", ok: activeSections >= 5 },
      { id: "animefan", icon: "📺", title: "Anime Fan", desc: "Watch 10 episodes", ok: kindCount.anime >= 10 },
      { id: "animemaster", icon: "🏆", title: "Anime Master", desc: "Watch 50 episodes", ok: kindCount.anime >= 50 },
      { id: "mangareader", icon: "📖", title: "Manga Reader", desc: "Read 10 chapters", ok: kindCount.manga >= 10 },
      { id: "cinephile", icon: "🎬", title: "Cinephile", desc: "Watch 10 movies", ok: kindCount.movie >= 10 },
      { id: "binger", icon: "📡", title: "Binge Viewer", desc: "Watch 25 TV episodes", ok: kindCount.tv >= 25 },
      { id: "bookworm", icon: "📚", title: "Bookworm", desc: "Read 5 novel chapters", ok: kindCount.novel >= 5 },
      { id: "collector", icon: "⭐", title: "Collector", desc: "Save 10 titles", ok: savedTotal >= 10 },
      { id: "curator", icon: "💎", title: "Curator", desc: "Save 50 titles", ok: savedTotal >= 50 },
      { id: "level5", icon: "🚀", title: "Rising Star", desc: "Reach level 5", ok: level >= 5 },
    ];
    return { defs, unlocked: defs.filter((d) => d.ok).length, total: defs.length };
  }, [kindCount, savedTotal, level]);

  // ── Activity heatmap data ──
  // Count episodes watched per day, then build a 7-row × N-week grid.
  const heatmap = useMemo(() => {
    const counts: Record<string, number> = {};
    const tally = (ts: number) => {
      const d = new Date(ts);
      if (isNaN(d.getTime())) return;
      const key = dateKey(d);
      counts[key] = (counts[key] || 0) + 1;
    };
    for (const h of history) { try { tally(new Date(h.updatedAt).getTime()); } catch {} }
    for (const a of activity) tally(a.ts);

    const numWeeks = activityRange === "year" ? 53 : activityRange === "month" ? 5 : 1;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayDay = today.getDay(); // 0 = Sunday
    // End at the Saturday of the current week so the grid always ends aligned
    const end = new Date(today);
    end.setDate(today.getDate() + (6 - todayDay));
    const start = new Date(end);
    start.setDate(end.getDate() - (7 * numWeeks - 1));

    const days: { date: Date; count: number; key: string }[] = [];
    const cur = new Date(start);
    while (cur <= end) {
      const k = dateKey(cur);
      days.push({ date: new Date(cur), count: counts[k] || 0, key: k });
      cur.setDate(cur.getDate() + 1);
    }
    const total = Object.values(counts).reduce((s, n) => s + n, 0);
    return { days, numWeeks, counts, total };
  }, [history, activity, activityRange]);

  // ── Streaks (all-time, every section) ──
  const streaks = useMemo(() => {
    const keys = new Set<string>();
    for (const h of history) { const t = new Date(h.updatedAt).getTime(); if (!isNaN(t)) keys.add(dateKeyOf(t)); }
    for (const a of activity) keys.add(dateKeyOf(a.ts));
    return streaksFromKeys(keys);
  }, [history, activity]);

  // ── Continue: most-recent in-progress item across every section ──
  const resumeItem = useMemo(() => {
    type R = { title: string; cover?: string; badge: string; percent: number; ts: number; go: () => void; kind: string };
    const all: R[] = [
      ...history.map((h) => ({ title: h.animeName, cover: h.thumbnail, badge: `Episode ${h.episodeNum}`, percent: h.progress, ts: new Date(h.updatedAt).getTime(), kind: "Anime", go: () => navigate({ page: "watch", id: h.animeId, episode: h.episodeNum, title: h.animeName, image: h.thumbnail }) })),
      ...mediaProgress.map((p) => ({ title: p.title, cover: p.cover, badge: p.unitLabel, percent: p.percent, ts: p.updatedAt, kind: p.kind.charAt(0).toUpperCase() + p.kind.slice(1), go: () => navigate(p.resume) })),
    ].filter((r) => !isNaN(r.ts)).sort((a, b) => b.ts - a.ts);
    return all[0] || null;
  }, [history, mediaProgress, navigate]);

  // ── Section distribution (for the breakdown bar) ──
  const distribution = useMemo(() => {
    const rows = [
      { key: "anime", label: "Anime", color: "#48A6FF", value: kindCount.anime },
      { key: "manga", label: "Manga", color: "#F472B6", value: kindCount.manga },
      { key: "movie", label: "Movies", color: "#F59E0B", value: kindCount.movie },
      { key: "tv", label: "TV", color: "#34D399", value: kindCount.tv },
      { key: "novel", label: "Novels", color: "#a855f7", value: kindCount.novel },
    ];
    const sum = rows.reduce((s, r) => s + r.value, 0) || 1;
    return { rows, sum };
  }, [kindCount]);

  if (!user) return null;

  // ── Avatar / theming ──
  const avatarLetter = (user.avatar || user.username.charAt(0) || "?").toUpperCase();
  const avatarColor = user.avatarColor || "#7c3aed";
  const accent = user.accentColor || avatarColor;
  const bannerKey = user.banner && BANNER_PRESETS[user.banner] ? user.banner : "aurora";
  const bannerBg = BANNER_PRESETS[bannerKey](accent);
  const favorites = user.favorites || [];

  // ── Open edit modal (initialize form from current user) ──
  const openEditModal = () => {
    setEditName(user.name);
    setEditBio(user.bio || "");
    setEditColor(user.avatarColor || "#7c3aed");
    setEditAccent(user.accentColor || user.avatarColor || "#3b82f6");
    setEditEmoji(user.avatarEmoji || "");
    setEditBanner(user.banner && BANNER_PRESETS[user.banner] ? user.banner : "aurora");
    setEditTagline(user.tagline || "");
    setEditFavorites(user.favorites || []);
    setEditing(true);
  };

  const toggleFavorite = (g: string) => {
    setEditFavorites((prev) => (prev.includes(g) ? prev.filter((x) => x !== g) : prev.length >= 6 ? prev : [...prev, g]));
  };

  // ── Handle save edit ──
  const handleSaveEdit = () => {
    const updated = updateUserProfile(user.id, {
      name: editName.trim() || user.name,
      bio: editBio.trim(),
      avatarColor: editColor,
      avatar: editName.trim().charAt(0).toUpperCase() || user.avatar,
      accentColor: editAccent,
      avatarEmoji: editEmoji,
      banner: editBanner,
      tagline: editTagline.trim(),
      favorites: editFavorites,
    });
    if (updated) {
      setUser(updated as User);
      setEditing(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate({ page: "home" });
  };

  const AVATAR_COLORS = [
    "#7c3aed", "#60a5fa", "#3b82f6", "#22c55e", "#3b82f6", "#ec4899",
    "#f59e0b", "#10b981", "#8b5cf6", "#ef4444", "#06b6d4", "#84cc16",
  ];

  return (
    <div className="min-h-screen w-full bg-[#0a0a0a] text-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* ═══════════════════════════════════════════════════════════
            PROFILE HEADER
            ═══════════════════════════════════════════════════════════ */}
        <section
          className="relative rounded-2xl border border-[#1a1a1a] p-5 sm:p-8 mb-6 overflow-hidden"
          style={{ background: bannerBg }}
        >
          {/* Edit + logout buttons top-right */}
          <div className="absolute top-4 right-4 flex gap-2 z-10">
            {isAdminUser(user) && (
              <a
                href="/admin"
                className="px-3 py-1.5 rounded-lg border text-xs font-bold flex items-center gap-1.5 transition-all"
                style={{ backgroundColor: accent + "18", borderColor: accent + "55", color: accent }}
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                <span className="hidden sm:inline">Admin</span>
              </a>
            )}
            <button
              onClick={openEditModal}
              className="px-3 py-1.5 rounded-lg bg-white/[0.04] border border-[#1a1a1a] text-xs font-medium text-gray-400 hover:text-white hover:bg-white/[0.08] transition-all flex items-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              <span className="hidden sm:inline">Edit Profile</span>
            </button>
            <button
              onClick={() => setShowLogoutConfirm(true)}
              className="px-3 py-1.5 rounded-lg bg-white/[0.04] border border-[#1a1a1a] text-xs font-medium text-gray-400 hover:text-red-400 hover:bg-red-500/10 hover:border-red-500/30 transition-all flex items-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>

          {/* Avatar */}
          <div className="relative z-[1]">
            <div
              className="w-20 h-20 sm:w-24 sm:h-24 rounded-full flex items-center justify-center text-3xl sm:text-4xl font-bold border-2 shrink-0"
              style={{ backgroundColor: avatarColor + "22", color: avatarColor, borderColor: accent + "55", boxShadow: `0 0 24px ${accent}33` }}
            >
              {user.avatarEmoji ? user.avatarEmoji : avatarLetter}
            </div>

            {/* Username + Online badge */}
            <div className="flex items-center gap-2 flex-wrap mt-4 mb-1.5">
              <h1 className="text-2xl sm:text-3xl font-bold text-white">{user.name}</h1>
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-green-500/15 border border-green-500/30">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                <span className="text-[10px] font-bold text-green-400 uppercase tracking-wider">Online</span>
              </span>
              <span className="text-sm text-gray-400 font-mono">@{user.username}</span>
            </div>

            {/* Tagline */}
            {user.tagline && <p className="text-sm text-gray-300 italic mb-2.5">“{user.tagline}”</p>}

            {/* Badges row */}
            <div className="flex items-center gap-2 flex-wrap mb-3">
              <span
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold"
                style={{ backgroundColor: accent + "22", border: `1px solid ${accent}55`, color: accent }}
              >
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 16.8l-6.2 4.5 2.4-7.4L2 9.4h7.6z" />
                </svg>
                Level {level}
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-orange-500/15 border border-orange-500/30 text-[11px] font-bold text-orange-400">
                🔥 {streaks.current} day streak
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-purple-500/15 border border-purple-500/30 text-[11px] font-bold text-purple-400">
                🏅 {achievements.unlocked}/{achievements.total}
              </span>
            </div>

            {/* Favorite genre chips */}
            {favorites.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap mb-4">
                {favorites.map((g) => (
                  <span key={g} className="px-2 py-0.5 rounded-full bg-white/[0.06] border border-white/10 text-[10px] font-semibold text-gray-300">
                    {g}
                  </span>
                ))}
              </div>
            )}

            {/* XP bar */}
            <div className="max-w-md">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-medium text-gray-400">Experience</span>
                <span className="text-xs font-bold text-gray-200 font-mono">
                  {xpInCurrentLevel} / 1000 XP
                </span>
              </div>
              <div className="h-2 w-full rounded-full bg-black/40 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(xpProgressPct, 100)}%`, backgroundColor: accent, boxShadow: `0 0 10px ${accent}99` }}
                />
              </div>
              <p className="text-[11px] text-gray-400 mt-1.5">
                {xpToNextLevel} XP to level {level + 1}
              </p>
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════
            CONTINUE — resume most recent progress
            ═══════════════════════════════════════════════════════════ */}
        {resumeItem && (
          <button
            onClick={resumeItem.go}
            className="group relative w-full text-left rounded-2xl border border-[#1a1a1a] bg-[#111111] p-4 mb-6 overflow-hidden hover:border-[#2a2a2a] transition-all flex items-center gap-4"
          >
            <div className="relative w-14 h-20 rounded-lg overflow-hidden bg-[#1a1a1a] shrink-0">
              {resumeItem.cover ? (
                <img src={resumeItem.cover} alt={resumeItem.title} className="w-full h-full object-cover" loading="lazy" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-700 font-bold text-xl">{resumeItem.title.charAt(0)}</div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: accent }}>Continue where you left off</p>
              <p className="text-base font-bold text-white truncate">{resumeItem.title}</p>
              <p className="text-xs text-gray-500 mt-0.5">{resumeItem.kind} · {resumeItem.badge} · {Math.round(resumeItem.percent)}%</p>
              <div className="h-1 w-full max-w-xs rounded-full bg-[#1a1a1a] overflow-hidden mt-2">
                <div className="h-full rounded-full" style={{ width: `${Math.min(resumeItem.percent, 100)}%`, backgroundColor: accent }} />
              </div>
            </div>
            <div className="shrink-0 w-11 h-11 rounded-full flex items-center justify-center transition-transform group-hover:scale-110" style={{ backgroundColor: accent }}>
              <svg className="w-5 h-5 text-black ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
            </div>
          </button>
        )}

        {/* ═══════════════════════════════════════════════════════════
            TWO-COLUMN LAYOUT
            ═══════════════════════════════════════════════════════════ */}
        <div className="grid grid-cols-1 lg:grid-cols-[65fr_35fr] gap-6">
          {/* ── Left column ── */}
          <div className="flex flex-col gap-6 min-w-0">
            {/* Activity History */}
            <Module
              title="Activity History"
              subtitle="Everything you watch & read, per day"
              icon={
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              }
            >
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs text-gray-500">
                  {heatmap.total} activit{heatmap.total !== 1 ? "ies" : "y"} total
                </span>
                <div className="relative">
                  <select
                    value={activityRange}
                    onChange={(e) => setActivityRange(e.target.value as typeof activityRange)}
                    className="appearance-none pl-3 pr-8 py-1.5 rounded-md bg-[#0a0a0a] border border-[#1a1a1a] text-xs text-gray-300 outline-none cursor-pointer hover:border-[#2a2a2a] focus:border-[#3b82f6]/50"
                  >
                    <option value="year">Last year</option>
                    <option value="month">Last month</option>
                    <option value="week">Last week</option>
                  </select>
                  <svg
                    className="w-3 h-3 text-gray-500 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none"
                    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>

              {/* Heatmap */}
              <div className="overflow-x-auto -mx-1 px-1">
                <div className="flex flex-col gap-[3px] min-w-max">
                  {Array.from({ length: 7 }).map((_, dayIdx) => (
                    <div key={dayIdx} className="flex gap-[3px]">
                      {Array.from({ length: heatmap.numWeeks }).map((_, weekIdx) => {
                        const idx = weekIdx * 7 + dayIdx;
                        const day = heatmap.days[idx];
                        if (!day) {
                          return <div key={weekIdx} className="w-3 h-3 rounded-sm" />;
                        }
                        return (
                          <div
                            key={weekIdx}
                            title={`${day.date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })} — ${day.count} episode${day.count !== 1 ? "s" : ""}`}
                            className={`w-3 h-3 rounded-sm ${heatColor(day.count)} hover:ring-1 hover:ring-white/30 transition-all`}
                          />
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>

              {/* Legend */}
              <div className="flex items-center justify-end gap-1.5 mt-3">
                <span className="text-[10px] text-gray-600 mr-1">Less</span>
                <div className="w-3 h-3 rounded-sm bg-[#1a1a1a]" />
                <div className="w-3 h-3 rounded-sm bg-[#3b82f6]/30" />
                <div className="w-3 h-3 rounded-sm bg-[#3b82f6]/55" />
                <div className="w-3 h-3 rounded-sm bg-[#3b82f6]/80" />
                <div className="w-3 h-3 rounded-sm bg-[#3b82f6]" />
                <span className="text-[10px] text-gray-600 ml-1">More</span>
              </div>
            </Module>

            {/* Comments */}
            <Module
              title="Comments"
              icon={
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.86 9.86 0 01-4-.8L3 20l1.3-3.9A7.97 7.97 0 013 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              }
            >
              <div className="text-center py-10">
                <div className="w-12 h-12 rounded-full bg-[#1a1a1a] flex items-center justify-center mx-auto mb-3">
                  <svg className="w-6 h-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.86 9.86 0 01-4-.8L3 20l1.3-3.9A7.97 7.97 0 013 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
                <p className="text-sm text-gray-400 font-medium">No comments yet</p>
                <p className="text-xs text-gray-600 mt-1">
                  Comments you post on anime episodes will show up here
                </p>
              </div>
            </Module>

            {/* Public Playlists */}
            <Module
              title="Public Playlists"
              icon={
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
                </svg>
              }
            >
              <div className="flex gap-1 mb-4 border-b border-[#1a1a1a]">
                {([
                  { id: "active" as const, label: "Anime", count: bookmarks.length },
                  { id: "manga" as const, label: "Manga", count: mangaLib.length },
                  { id: "novel" as const, label: "Novel", count: novelLib.length },
                ]).map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setPlaylistTab(t.id)}
                    className={`px-3 py-2 text-xs font-bold border-b-2 -mb-px transition-all ${
                      playlistTab === t.id
                        ? "border-[#3b82f6] text-white"
                        : "border-transparent text-gray-500 hover:text-gray-300"
                    }`}
                  >
                    {t.label}
                    {t.count > 0 && <span className="ml-1.5 text-gray-600">({t.count})</span>}
                  </button>
                ))}
              </div>
              {playlistTab === "active" && (
                <BookmarkGrid
                  items={bookmarks}
                  navigate={navigate}
                  emptyLabel="No saved anime yet"
                  emptyCta="Browse Anime"
                  onCta={() => navigate({ page: "home" })}
                />
              )}
              {playlistTab === "manga" && (
                <LibraryGrid
                  items={mangaLib}
                  navigate={navigate}
                  emptyLabel="No saved manga yet"
                  emptyCta="Browse Manga"
                  onCta={() => navigate({ page: "manga" })}
                />
              )}
              {playlistTab === "novel" && (
                <LibraryGrid
                  items={novelLib}
                  navigate={navigate}
                  emptyLabel="No saved novels yet"
                  emptyCta="Browse Novels"
                  onCta={() => navigate({ page: "novel" })}
                />
              )}
            </Module>

            {/* Recently Watched Episodes */}
            <Module
              title="Recently Watched Episodes"
              icon={
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              }
            >
              <RecentlyWatched history={history} mediaProgress={mediaProgress} navigate={navigate} />
            </Module>
          </div>

          {/* ── Right column (sidebar) ── */}
          <div className="flex flex-col gap-6 min-w-0">
            {/* Quick Stats */}
            <Module
              title="Quick Stats"
              icon={
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              }
            >
              <div className="flex flex-col">
                <StatRow label="Level" value={level} />
                <StatRow label="Total XP" value={totalXP.toLocaleString()} />
                <StatRow label="Anime Episodes" value={kindCount.anime} />
                <StatRow label="Manga Chapters" value={kindCount.manga} />
                <StatRow label="Movies Watched" value={kindCount.movie} />
                <StatRow label="TV Episodes" value={kindCount.tv} />
                <StatRow label="Novel Chapters" value={kindCount.novel} />
                <StatRow label="Best Streak" value={`${streaks.best} days`} />
                <StatRow label="Saved Titles" value={savedTotal} last />
              </div>
            </Module>

            {/* Section Breakdown */}
            <Module
              title="Section Breakdown"
              icon={
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20.488 9A9.004 9.004 0 0015 3.512V9h5.488z" />
                </svg>
              }
            >
              {distribution.sum <= 1 && distribution.rows.every((r) => r.value === 0) ? (
                <p className="text-sm text-gray-500 text-center py-6">No activity to break down yet.</p>
              ) : (
                <>
                  <div className="flex h-3 w-full rounded-full overflow-hidden bg-[#1a1a1a] mb-4">
                    {distribution.rows.map((r) => r.value > 0 && (
                      <div key={r.key} style={{ width: `${(r.value / distribution.sum) * 100}%`, backgroundColor: r.color }} title={`${r.label}: ${r.value}`} />
                    ))}
                  </div>
                  <div className="flex flex-col gap-2.5">
                    {distribution.rows.map((r) => (
                      <div key={r.key} className="flex items-center gap-2 text-xs">
                        <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: r.color }} />
                        <span className="text-gray-400 flex-1">{r.label}</span>
                        <span className="font-bold text-gray-200 tabular-nums">{r.value}</span>
                        <span className="text-gray-600 tabular-nums w-9 text-right">{Math.round((r.value / distribution.sum) * 100)}%</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </Module>

            {/* Achievements */}
            <Module
              title="Achievements"
              icon={
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                </svg>
              }
            >
              <p className="text-xs text-gray-500 mb-4 -mt-2">
                <span className="font-bold text-gray-300">{achievements.unlocked}</span> of {achievements.total} unlocked
              </p>
              <div className="grid grid-cols-3 gap-2">
                {achievements.defs.map((a) => (
                  <div
                    key={a.id}
                    title={`${a.title} — ${a.desc}`}
                    className={`rounded-lg border p-2.5 text-center transition-all ${
                      a.ok
                        ? "border-[#3b82f6]/40 bg-[#3b82f6]/10"
                        : "border-[#1a1a1a] bg-[#0a0a0a] opacity-50"
                    }`}
                  >
                    <div className="text-xl mb-1" style={{ filter: a.ok ? "none" : "grayscale(1)" }}>{a.icon}</div>
                    <p className="text-[10px] font-bold text-gray-300 leading-tight">{a.title}</p>
                  </div>
                ))}
              </div>
            </Module>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════
          EDIT MODAL (preserved from original)
          ═══════════════════════════════════════════════════════════ */}
      {editing && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setEditing(false)}
        >
          <div
            className="w-full max-w-md max-h-[88vh] overflow-y-auto scroll-container rounded-2xl border border-white/10 bg-[#0a0a0a] p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold">Edit Profile</h3>
              <button
                onClick={() => setEditing(false)}
                className="w-8 h-8 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] flex items-center justify-center text-white/60"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Live banner + avatar preview */}
            <div
              className="relative rounded-xl border border-white/10 h-24 mb-5 overflow-hidden flex items-end p-3"
              style={{ background: BANNER_PRESETS[editBanner](editAccent) }}
            >
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold border-2"
                style={{ backgroundColor: editColor + "33", color: editColor, borderColor: editAccent + "88" }}
              >
                {editEmoji || (editName || user.username).charAt(0).toUpperCase()}
              </div>
            </div>

            {/* Display name */}
            <label className="block text-xs font-bold text-white/60 uppercase tracking-wider mb-2">Display Name</label>
            <input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              maxLength={40}
              className="w-full px-4 py-2.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-white outline-none focus:border-[#3b82f6]/50 transition-all mb-4"
            />

            {/* Tagline */}
            <label className="block text-xs font-bold text-white/60 uppercase tracking-wider mb-2">Tagline</label>
            <input
              value={editTagline}
              onChange={(e) => setEditTagline(e.target.value)}
              maxLength={60}
              placeholder="e.g. Certified binge master"
              className="w-full px-4 py-2.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-white placeholder-white/20 outline-none focus:border-[#3b82f6]/50 transition-all mb-4"
            />

            {/* Bio */}
            <label className="block text-xs font-bold text-white/60 uppercase tracking-wider mb-2">Bio</label>
            <textarea
              value={editBio}
              onChange={(e) => setEditBio(e.target.value)}
              maxLength={200}
              rows={3}
              placeholder="Tell the crew about yourself..."
              className="w-full px-4 py-2.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-white placeholder-white/20 outline-none focus:border-[#3b82f6]/50 transition-all resize-none mb-1"
            />
            <p className="text-[10px] text-white/30 text-right mb-4">{editBio.length}/200</p>

            {/* Avatar emoji */}
            <label className="block text-xs font-bold text-white/60 uppercase tracking-wider mb-2">Avatar Icon</label>
            <div className="flex flex-wrap gap-1.5 mb-4">
              {AVATAR_EMOJIS.map((em) => (
                <button
                  key={em || "letter"}
                  type="button"
                  onClick={() => setEditEmoji(em)}
                  className={`w-9 h-9 rounded-lg border text-lg flex items-center justify-center transition-all ${
                    editEmoji === em ? "border-white bg-white/10 scale-105" : "border-white/10 hover:bg-white/[0.06]"
                  }`}
                  title={em ? em : "Use first letter"}
                >
                  {em || (editName || user.username).charAt(0).toUpperCase()}
                </button>
              ))}
            </div>

            {/* Avatar color */}
            <label className="block text-xs font-bold text-white/60 uppercase tracking-wider mb-2">Avatar Color</label>
            <div className="flex flex-wrap gap-2 mb-4">
              {AVATAR_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setEditColor(c)}
                  className={`w-8 h-8 rounded-full border-2 transition-all ${editColor === c ? "border-white scale-110" : "border-white/10 hover:scale-105"}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>

            {/* Accent color */}
            <label className="block text-xs font-bold text-white/60 uppercase tracking-wider mb-2">Accent Color</label>
            <div className="flex flex-wrap gap-2 mb-4">
              {ACCENT_SWATCHES.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setEditAccent(c)}
                  className={`w-8 h-8 rounded-full border-2 transition-all ${editAccent === c ? "border-white scale-110" : "border-white/10 hover:scale-105"}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>

            {/* Banner style */}
            <label className="block text-xs font-bold text-white/60 uppercase tracking-wider mb-2">Banner Style</label>
            <div className="grid grid-cols-5 gap-2 mb-4">
              {BANNER_KEYS.map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setEditBanner(k)}
                  className={`h-10 rounded-lg border-2 transition-all ${editBanner === k ? "border-white scale-105" : "border-white/10 hover:scale-105"}`}
                  style={{ background: BANNER_PRESETS[k](editAccent) }}
                  title={k}
                />
              ))}
            </div>

            {/* Favorite genres */}
            <label className="block text-xs font-bold text-white/60 uppercase tracking-wider mb-2">
              Favorite Genres <span className="text-white/30 normal-case">({editFavorites.length}/6)</span>
            </label>
            <div className="flex flex-wrap gap-1.5 mb-6">
              {GENRE_OPTIONS.map((g) => {
                const on = editFavorites.includes(g);
                return (
                  <button
                    key={g}
                    type="button"
                    onClick={() => toggleFavorite(g)}
                    className="px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all"
                    style={{
                      backgroundColor: on ? editAccent + "22" : "rgba(255,255,255,0.03)",
                      borderColor: on ? editAccent + "88" : "rgba(255,255,255,0.1)",
                      color: on ? "#fff" : "rgba(255,255,255,0.5)",
                    }}
                  >
                    {g}
                  </button>
                );
              })}
            </div>

            {/* Save / cancel */}
            <div className="flex gap-2">
              <button
                onClick={() => setEditing(false)}
                className="flex-1 py-2.5 rounded-lg bg-white/[0.06] border border-white/[0.08] text-sm font-bold text-white/70 hover:bg-white/[0.1] transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                className="flex-1 py-2.5 rounded-lg text-black text-sm font-bold transition-all hover:opacity-90"
                style={{ backgroundColor: editAccent }}
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════
          LOGOUT CONFIRM (preserved from original)
          ═══════════════════════════════════════════════════════════ */}
      {showLogoutConfirm && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setShowLogoutConfirm(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#0a0a0a] p-6 shadow-2xl text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-14 h-14 rounded-full bg-red-500/15 border border-red-500/30 flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </div>
            <h3 className="text-lg font-bold mb-1">Log out?</h3>
            <p className="text-sm text-white/50 mb-6">
              You&apos;ll need to sign in again to comment and sync your progress.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="flex-1 py-2.5 rounded-lg bg-white/[0.06] border border-white/[0.08] text-sm font-bold text-white/70 hover:bg-white/[0.1] transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleLogout}
                className="flex-1 py-2.5 rounded-lg bg-red-500 text-white text-sm font-bold hover:bg-red-600 transition-all"
              >
                Log out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Helpers ──

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function heatColor(count: number): string {
  if (count === 0) return "bg-[#1a1a1a]";
  if (count === 1) return "bg-[#3b82f6]/30";
  if (count === 2) return "bg-[#3b82f6]/55";
  if (count <= 4) return "bg-[#3b82f6]/80";
  return "bg-[#3b82f6]";
}

// ── Module wrapper ──
function Module({
  title,
  subtitle,
  icon,
  children,
}: {
  title: string;
  subtitle?: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-[#1a1a1a] bg-[#111111] p-5 sm:p-6">
      <header className="flex items-start gap-3 mb-5">
        <div className="w-8 h-8 rounded-lg bg-[#1a1a1a] border border-[#1f1f1f] flex items-center justify-center text-gray-400 shrink-0">
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm sm:text-base font-bold text-gray-200">{title}</h2>
          {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
        </div>
      </header>
      {children}
    </section>
  );
}

// ── Stat row (Quick Stats) ──
function StatRow({ label, value, last }: { label: string; value: number | string; last?: boolean }) {
  return (
    <div
      className={`flex items-center justify-between py-3 ${
        last ? "" : "border-b border-[#1a1a1a]"
      }`}
    >
      <span className="text-sm text-gray-400">{label}</span>
      <span className="text-sm font-bold text-gray-200 font-mono tabular-nums">{value}</span>
    </div>
  );
}

// A normalized "recently active" tile — anime history + cross-section progress.
type RecentTile = {
  key: string;
  title: string;
  cover?: string;
  badge: string;
  percent: number;
  ts: number;
  onClick: () => void;
};

// ── Recently Watched / Read (all sections) ──
function RecentlyWatched({
  history,
  mediaProgress,
  navigate,
}: {
  history: HistoryItem[];
  mediaProgress: MediaProgressEntry[];
  navigate: (r: any) => void;
}) {
  const tiles: RecentTile[] = [
    ...history.map((h) => ({
      key: `a-${h.id}`,
      title: h.animeName,
      cover: h.thumbnail,
      badge: `EP ${h.episodeNum}`,
      percent: h.progress,
      ts: new Date(h.updatedAt).getTime(),
      onClick: () => navigate({ page: "watch", id: h.animeId, episode: h.episodeNum, title: h.animeName, image: h.thumbnail }),
    })),
    ...mediaProgress.map((p) => ({
      key: p.key,
      title: p.title,
      cover: p.cover,
      badge: p.unitLabel,
      percent: p.percent,
      ts: p.updatedAt,
      onClick: () => navigate(p.resume),
    })),
  ].sort((a, b) => b.ts - a.ts);

  if (tiles.length === 0) {
    return (
      <div className="text-center py-10">
        <div className="w-12 h-12 rounded-full bg-[#1a1a1a] flex items-center justify-center mx-auto mb-3">
          <svg className="w-6 h-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
        </div>
        <p className="text-sm text-gray-400 font-medium">Nothing watched or read yet</p>
        <p className="text-xs text-gray-600 mt-1">Start watching or reading to see your progress here</p>
        <button
          onClick={() => navigate({ page: "home" })}
          className="mt-4 px-4 py-2 rounded-lg bg-[#3b82f6] text-white text-xs font-bold hover:bg-[#60a5fa] transition-all"
        >
          Browse Anime
        </button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
      {tiles.slice(0, 12).map((t) => (
        <button key={t.key} onClick={t.onClick} className="group text-left">
          <div className="relative w-full aspect-[3/4] bg-[#1a1a1a] rounded-lg overflow-hidden">
            {t.cover ? (
              <img src={t.cover} alt={t.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-700 font-bold text-2xl">{t.title.charAt(0)}</div>
            )}
            <div className="absolute top-2 right-2 px-2 py-0.5 rounded bg-black/80 backdrop-blur text-[10px] font-bold text-white">{t.badge}</div>
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/60">
              <div className="h-full bg-[#3b82f6]" style={{ width: `${Math.min(t.percent, 100)}%` }} />
            </div>
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur flex items-center justify-center">
                <svg className="w-4 h-4 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
              </div>
            </div>
          </div>
          <p className="text-xs font-semibold text-gray-300 truncate mt-2 group-hover:text-[#3b82f6] transition-colors">{t.title}</p>
          <p className="text-[10px] text-gray-500">{Math.round(t.percent)}%</p>
        </button>
      ))}
    </div>
  );
}

// ── Empty state used by playlist grids ──
function GridEmpty({ label, cta, onCta }: { label: string; cta: string; onCta: () => void }) {
  return (
    <div className="text-center py-10">
      <div className="w-12 h-12 rounded-full bg-[#1a1a1a] flex items-center justify-center mx-auto mb-3">
        <svg className="w-6 h-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
        </svg>
      </div>
      <p className="text-sm text-gray-400 font-medium">{label}</p>
      <p className="text-xs text-gray-600 mt-1">Tap “My List” on any title to save it here</p>
      <button onClick={onCta} className="mt-4 px-4 py-2 rounded-lg bg-[#3b82f6] text-white text-xs font-bold hover:bg-[#60a5fa] transition-all">{cta}</button>
    </div>
  );
}

// ── Anime bookmark grid (Public Playlists → Anime) ──
function BookmarkGrid({
  items,
  navigate,
  emptyLabel,
  emptyCta,
  onCta,
}: {
  items: BookmarkItem[];
  navigate: (r: any) => void;
  emptyLabel: string;
  emptyCta: string;
  onCta: () => void;
}) {
  if (items.length === 0) return <GridEmpty label={emptyLabel} cta={emptyCta} onCta={onCta} />;
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
      {items.map((b) => (
        <button key={b.id} onClick={() => navigate({ page: "anime", id: b.animeId })} className="group text-left">
          <div className="relative w-full aspect-[3/4] bg-[#1a1a1a] rounded-lg overflow-hidden">
            {b.thumbnail ? (
              <img src={b.thumbnail} alt={b.animeName} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-700 font-bold text-2xl">{b.animeName.charAt(0)}</div>
            )}
            {b.score ? (
              <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded bg-black/80 backdrop-blur text-[10px] font-bold text-yellow-400">★ {b.score}</div>
            ) : null}
          </div>
          <p className="text-xs font-semibold text-gray-300 truncate mt-2 group-hover:text-[#3b82f6] transition-colors">{b.animeName}</p>
          {b.type && <p className="text-[10px] text-gray-500 truncate">{b.type}</p>}
        </button>
      ))}
    </div>
  );
}

// ── Library grid (Public Playlists → Manga / Novel) ──
function LibraryGrid({
  items,
  navigate,
  emptyLabel,
  emptyCta,
  onCta,
}: {
  items: LibraryEntry[];
  navigate: (r: any) => void;
  emptyLabel: string;
  emptyCta: string;
  onCta: () => void;
}) {
  if (items.length === 0) return <GridEmpty label={emptyLabel} cta={emptyCta} onCta={onCta} />;
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
      {items.map((l) => (
        <button key={l.key} onClick={() => navigate(l.resume)} className="group text-left">
          <div className="relative w-full aspect-[3/4] bg-[#1a1a1a] rounded-lg overflow-hidden">
            {l.cover ? (
              <img src={l.cover} alt={l.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-700 font-bold text-2xl">{l.title.charAt(0)}</div>
            )}
            {l.score ? (
              <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded bg-black/80 backdrop-blur text-[10px] font-bold text-yellow-400">★ {l.score}</div>
            ) : null}
          </div>
          <p className="text-xs font-semibold text-gray-300 truncate mt-2 group-hover:text-[#3b82f6] transition-colors">{l.title}</p>
          {l.meta && <p className="text-[10px] text-gray-500 truncate">{l.meta}</p>}
        </button>
      ))}
    </div>
  );
}
