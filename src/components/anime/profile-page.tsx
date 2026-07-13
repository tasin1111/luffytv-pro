"use client";

import { useState, useEffect, useMemo, type ReactNode } from "react";
import { useAppStore, type User, type HistoryItem } from "./store";
import { updateUserProfile } from "@/lib/auth-local";

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

  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editBio, setEditBio] = useState("");
  const [editColor, setEditColor] = useState("");
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [playlistTab, setPlaylistTab] = useState<"active" | "manga" | "novel">("active");
  const [activityRange, setActivityRange] = useState<"year" | "month" | "week">("year");

  // Redirect to signin if not logged in
  useEffect(() => {
    if (!user) navigate({ page: "signin" });
  }, [user, navigate]);

  // ── Level / XP math ──
  // 1 episode = 10 XP, Level = floor(totalXP / 1000) + 1
  const totalXP = history.length * 10;
  const level = Math.floor(totalXP / 1000) + 1;
  const xpInCurrentLevel = totalXP % 1000;
  const xpToNextLevel = 1000 - xpInCurrentLevel;
  const xpProgressPct = (xpInCurrentLevel / 1000) * 100;

  // ── Activity heatmap data ──
  // Count episodes watched per day, then build a 7-row × N-week grid.
  const heatmap = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const h of history) {
      try {
        const d = new Date(h.updatedAt);
        if (isNaN(d.getTime())) continue;
        const key = dateKey(d);
        counts[key] = (counts[key] || 0) + 1;
      } catch {}
    }

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
    return { days, numWeeks, counts };
  }, [history, activityRange]);

  if (!user) return null;

  // ── Avatar ──
  const avatarLetter = (user.avatar || user.username.charAt(0) || "?").toUpperCase();
  const avatarColor = user.avatarColor || "#7c3aed";

  // ── Open edit modal (initialize form from current user) ──
  const openEditModal = () => {
    setEditName(user.name);
    setEditBio(user.bio || "");
    setEditColor(user.avatarColor || "#7c3aed");
    setEditing(true);
  };

  // ── Handle save edit ──
  const handleSaveEdit = () => {
    const updated = updateUserProfile(user.id, {
      name: editName.trim() || user.name,
      bio: editBio.trim(),
      avatarColor: editColor,
      avatar: editName.trim().charAt(0).toUpperCase() || user.avatar,
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
        <section className="relative rounded-2xl border border-[#1a1a1a] bg-[#111111] p-5 sm:p-8 mb-6 overflow-hidden">
          {/* subtle radial accent */}
          <div
            className="absolute -top-20 -right-20 w-64 h-64 rounded-full opacity-[0.15] pointer-events-none"
            style={{ background: `radial-gradient(circle, ${avatarColor}, transparent 70%)` }}
          />

          {/* Edit + logout buttons top-right */}
          <div className="absolute top-4 right-4 flex gap-2 z-10">
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
              className="w-20 h-20 sm:w-24 sm:h-24 rounded-full flex items-center justify-center text-3xl sm:text-4xl font-bold border-2 border-[#1a1a1a] shrink-0"
              style={{ backgroundColor: avatarColor + "22", color: avatarColor }}
            >
              {avatarLetter}
            </div>

            {/* Username + Online badge */}
            <div className="flex items-center gap-2 flex-wrap mt-4 mb-3">
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-200">{user.name}</h1>
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-green-500/15 border border-green-500/30">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                <span className="text-[10px] font-bold text-green-400 uppercase tracking-wider">Online</span>
              </span>
              <span className="text-sm text-gray-600 font-mono">@{user.username}</span>
            </div>

            {/* Badges row */}
            <div className="flex items-center gap-2 flex-wrap mb-5">
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-yellow-500/15 border border-yellow-500/30 text-[11px] font-bold text-yellow-400">
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 16.8l-6.2 4.5 2.4-7.4L2 9.4h7.6z" />
                </svg>
                Level {level}
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-purple-500/15 border border-purple-500/30 text-[11px] font-bold text-purple-400">
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2l8 4v6c0 5-3.4 9.7-8 11-4.6-1.3-8-6-8-11V6l8-4z" />
                </svg>
                Subscribed Member
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-blue-500/15 border border-blue-500/30 text-[11px] font-bold text-blue-400">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.86 9.86 0 01-4-.8L3 20l1.3-3.9A7.97 7.97 0 013 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                Comments: 0
              </span>
            </div>

            {/* XP bar */}
            <div className="max-w-md">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-medium text-gray-500">Experience</span>
                <span className="text-xs font-bold text-gray-300 font-mono">
                  {xpInCurrentLevel} / 1000 XP
                </span>
              </div>
              <div className="h-2 w-full rounded-full bg-[#1a1a1a] overflow-hidden">
                <div
                  className="h-full bg-[#3b82f6] rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(xpProgressPct, 100)}%` }}
                />
              </div>
              <p className="text-[11px] text-gray-500 mt-1.5">
                {xpToNextLevel} XP to level {level + 1}
              </p>
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════
            TWO-COLUMN LAYOUT
            ═══════════════════════════════════════════════════════════ */}
        <div className="grid grid-cols-1 lg:grid-cols-[65fr_35fr] gap-6">
          {/* ── Left column ── */}
          <div className="flex flex-col gap-6 min-w-0">
            {/* Activity History */}
            <Module
              title="Activity History"
              subtitle="Anime episodes watched per day"
              icon={
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              }
            >
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs text-gray-500">
                  {history.length} episode{history.length !== 1 ? "s" : ""} watched total
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
                  { id: "active" as const, label: "Active" },
                  { id: "manga" as const, label: "Manga" },
                  { id: "novel" as const, label: "Novel" },
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
                  </button>
                ))}
              </div>
              <div className="text-center py-10">
                <div className="w-12 h-12 rounded-full bg-[#1a1a1a] flex items-center justify-center mx-auto mb-3">
                  <svg className="w-6 h-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
                  </svg>
                </div>
                <p className="text-sm text-gray-400 font-medium">
                  No public {playlistTab === "active" ? "anime" : playlistTab} playlists found
                </p>
                <p className="text-xs text-gray-600 mt-1">
                  Create a playlist and set it to public to share it with the community
                </p>
              </div>
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
              <RecentlyWatched history={history} navigate={navigate} />
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
                <StatRow label="Episodes" value={history.length} />
                <StatRow label="Comments" value={0} last />
              </div>
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
              <div className="text-center py-8">
                <div className="w-14 h-14 rounded-full bg-[#1a1a1a] flex items-center justify-center mx-auto mb-3">
                  <svg className="w-7 h-7 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                  </svg>
                </div>
                <p className="text-sm text-gray-400 font-medium leading-relaxed">
                  Start watching anime and engaging to unlock achievements!
                </p>
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
            className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0a0a0a] p-6 shadow-2xl"
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

            {/* Avatar preview */}
            <div className="flex justify-center mb-5">
              <div
                className="w-20 h-20 rounded-full flex items-center justify-center text-3xl font-bold border-2 border-white/15"
                style={{ backgroundColor: editColor + "33", color: editColor }}
              >
                {(editName || user.username).charAt(0).toUpperCase()}
              </div>
            </div>

            {/* Display name */}
            <label className="block text-xs font-bold text-white/60 uppercase tracking-wider mb-2">
              Display Name
            </label>
            <input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              maxLength={40}
              className="w-full px-4 py-2.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-white outline-none focus:border-[#3b82f6]/50 transition-all mb-4"
            />

            {/* Bio */}
            <label className="block text-xs font-bold text-white/60 uppercase tracking-wider mb-2">
              Bio
            </label>
            <textarea
              value={editBio}
              onChange={(e) => setEditBio(e.target.value)}
              maxLength={200}
              rows={3}
              placeholder="Tell the crew about yourself..."
              className="w-full px-4 py-2.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-white placeholder-white/20 outline-none focus:border-[#3b82f6]/50 transition-all resize-none mb-1"
            />
            <p className="text-[10px] text-white/30 text-right mb-4">{editBio.length}/200</p>

            {/* Avatar color */}
            <label className="block text-xs font-bold text-white/60 uppercase tracking-wider mb-2">
              Avatar Color
            </label>
            <div className="flex flex-wrap gap-2 mb-6">
              {AVATAR_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setEditColor(c)}
                  className={`w-8 h-8 rounded-full border-2 transition-all ${
                    editColor === c ? "border-white scale-110" : "border-white/10 hover:scale-105"
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
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
                className="flex-1 py-2.5 rounded-lg bg-[#3b82f6] text-white text-sm font-bold hover:bg-[#60a5fa] transition-all"
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

// ── Recently Watched Episodes ──
function RecentlyWatched({
  history,
  navigate,
}: {
  history: HistoryItem[];
  navigate: (r: any) => void;
}) {
  if (history.length === 0) {
    return (
      <div className="text-center py-10">
        <div className="w-12 h-12 rounded-full bg-[#1a1a1a] flex items-center justify-center mx-auto mb-3">
          <svg className="w-6 h-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
        </div>
        <p className="text-sm text-gray-400 font-medium">No watch history yet</p>
        <p className="text-xs text-gray-600 mt-1">Start watching anime to see your progress here</p>
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
      {history.slice(0, 12).map((h) => (
        <button
          key={h.id}
          onClick={() =>
            navigate({
              page: "watch",
              id: h.animeId,
              episode: h.episodeNum,
              title: h.animeName,
              image: h.thumbnail,
            })
          }
          className="group text-left"
        >
          <div className="relative w-full aspect-[3/4] bg-[#1a1a1a] rounded-lg overflow-hidden">
            {h.thumbnail ? (
              <img
                src={h.thumbnail}
                alt={h.animeName}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                loading="lazy"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-700 font-bold text-2xl">
                {h.animeName.charAt(0)}
              </div>
            )}
            {/* Episode badge */}
            <div className="absolute top-2 right-2 px-2 py-0.5 rounded bg-black/80 backdrop-blur text-[10px] font-bold text-white">
              EP {h.episodeNum}
            </div>
            {/* Progress bar */}
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/60">
              <div
                className="h-full bg-[#3b82f6]"
                style={{ width: `${Math.min(h.progress, 100)}%` }}
              />
            </div>
            {/* Play overlay on hover */}
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur flex items-center justify-center">
                <svg className="w-4 h-4 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
            </div>
          </div>
          <p className="text-xs font-semibold text-gray-300 truncate mt-2 group-hover:text-[#3b82f6] transition-colors">
            {h.animeName}
          </p>
          <p className="text-[10px] text-gray-500">{Math.round(h.progress)}% watched</p>
        </button>
      ))}
    </div>
  );
}
