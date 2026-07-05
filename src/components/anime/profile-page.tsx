"use client";

import { useState, useEffect } from "react";
import { useAppStore, type User } from "./store";
import { updateUserProfile } from "@/lib/auth-local";

/**
 * ProfilePage — user profile with anime progress
 *
 * Sections:
 *   1. Profile header — avatar, name, @username, email, bio, edit button
 *   2. Stats row — bookmarks count, history count, total watch time
 *   3. Tabs: Continue Watching | Bookmarks | Comments
 *   4. Edit profile modal (inline) — name, bio, avatar color
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

  const [tab, setTab] = useState<"history" | "bookmarks">("history");
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editBio, setEditBio] = useState("");
  const [editColor, setEditColor] = useState("");
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  // Redirect to signin if not logged in
  useEffect(() => {
    if (!user) navigate({ page: "signin" });
  }, [user, navigate]);

  // Init edit form when opening
  useEffect(() => {
    if (editing && user) {
      setEditName(user.name);
      setEditBio(user.bio || "");
      setEditColor(user.avatarColor || "#7c3aed");
    }
  }, [editing, user]);

  if (!user) return null;

  // ── Stats ──
  const bookmarksCount = bookmarks.length;
  const historyCount = history.length;
  const totalWatchSeconds = history.reduce((sum, h) => sum + (h.progress / 100) * h.duration, 0);
  const totalWatchHours = Math.round((totalWatchSeconds / 3600) * 10) / 10;
  const completedEps = history.filter((h) => h.progress >= 90).length;

  // ── Avatar ──
  const avatarLetter = (user.avatar || user.username.charAt(0) || "?").toUpperCase();
  const avatarColor = user.avatarColor || "#7c3aed";

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

  const formatTime = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    if (days < 30) return `${Math.floor(days / 7)}w ago`;
    return new Date(dateStr).toLocaleDateString();
  };

  const AVATAR_COLORS = ["#7c3aed", "#60a5fa", "#3b82f6", "#22c55e", "#3b82f6", "#ec4899", "#f59e0b", "#10b981", "#8b5cf6", "#ef4444", "#06b6d4", "#84cc16"];

  return (
    <div className="min-h-screen w-full bg-black text-white">
      {/* ═══════════════════════════════════════════════════════════
          HEADER BANNER
          ═══════════════════════════════════════════════════════════ */}
      <div
        className="relative h-48 sm:h-56 overflow-hidden"
        style={{
          background: `radial-gradient(circle at 30% 50%, ${avatarColor}33, transparent 60%), radial-gradient(circle at 70% 50%, ${avatarColor}22, transparent 60%), #080808`,
        }}
      >
        {/* Grid overlay */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
            backgroundSize: "30px 30px",
          }}
        />
        {/* Edit + logout buttons top-right */}
        <div className="absolute top-4 right-4 flex gap-2 z-10">
          <button
            onClick={() => setEditing(true)}
            className="px-4 py-2 rounded-lg bg-white/[0.08] border border-white/15 backdrop-blur text-xs font-bold text-white hover:bg-white/[0.15] transition-all flex items-center gap-1.5"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Edit Profile
          </button>
          <button
            onClick={() => setShowLogoutConfirm(true)}
            className="px-4 py-2 rounded-lg bg-red-500/10 border border-red-500/30 backdrop-blur text-xs font-bold text-red-300 hover:bg-red-500/20 transition-all flex items-center gap-1.5"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Logout
          </button>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════
          PROFILE INFO (overlapping banner)
          ═══════════════════════════════════════════════════════════ */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 -mt-16 relative z-10">
        <div className="flex flex-col sm:flex-row sm:items-end gap-4">
          {/* Avatar */}
          <div
            className="w-32 h-32 sm:w-36 sm:h-36 rounded-full flex items-center justify-center text-5xl font-bold border-4 border-black shadow-2xl shrink-0"
            style={{ backgroundColor: avatarColor + "33", color: avatarColor, borderColor: "#000" }}
          >
            {avatarLetter}
          </div>

          {/* Name + meta */}
          <div className="flex-1 pb-2">
            <h1 className="text-3xl sm:text-4xl font-extrabold leading-tight">{user.name}</h1>
            <div className="flex items-center gap-3 mt-1.5 flex-wrap">
              <span className="text-sm text-[#3b82f6] font-mono">@{user.username}</span>
              <span className="text-xs text-white/30">·</span>
              <span className="text-sm text-white/50">{user.email}</span>
            </div>
            {user.bio && (
              <p className="text-sm text-white/60 mt-3 max-w-lg leading-relaxed">{user.bio}</p>
            )}
            <p className="text-xs text-white/30 mt-2">
              Joined {formatTime(user.createdAt)}
            </p>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════
            STATS ROW
            ═══════════════════════════════════════════════════════════ */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-8">
          {[
            { label: "Bookmarks", value: bookmarksCount, icon: "⭐", color: "#3b82f6" },
            { label: "Watched Eps", value: historyCount, icon: "📺", color: "#7c3aed" },
            { label: "Completed", value: completedEps, icon: "✓", color: "#22c55e" },
            { label: "Watch Hours", value: totalWatchHours, icon: "⏱", color: "#60a5fa" },
          ].map((s) => (
            <div
              key={s.label}
              className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 hover:border-white/[0.12] transition-colors"
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-base">{s.icon}</span>
                <p className="text-[10px] uppercase tracking-wider text-white/40 font-bold">{s.label}</p>
              </div>
              <p className="text-2xl font-extrabold" style={{ color: s.color }}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* ═══════════════════════════════════════════════════════════
            TABS
            ═══════════════════════════════════════════════════════════ */}
        <div className="flex gap-1 mt-10 border-b border-white/[0.06]">
          {[
            { id: "history" as const, label: "Continue Watching", count: historyCount },
            { id: "bookmarks" as const, label: "Bookmarks", count: bookmarksCount },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-3 text-sm font-bold transition-all border-b-2 -mb-px ${
                tab === t.id
                  ? "border-[#3b82f6] text-white"
                  : "border-transparent text-white/40 hover:text-white/70"
              }`}
            >
              {t.label}
              {t.count > 0 && (
                <span className="ml-2 text-xs text-white/30">({t.count})</span>
              )}
            </button>
          ))}
        </div>

        {/* ═══════════════════════════════════════════════════════════
            TAB CONTENT
            ═══════════════════════════════════════════════════════════ */}
        <div className="py-6 pb-20">
          {tab === "history" && (
            <HistoryTab history={history} navigate={navigate} />
          )}
          {tab === "bookmarks" && (
            <BookmarksTab bookmarks={bookmarks} navigate={navigate} />
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════
          EDIT MODAL
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
          LOGOUT CONFIRM
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

// ── History tab — shows recent watch history with progress bars ──
function HistoryTab({ history, navigate }: { history: any[]; navigate: (r: any) => void }) {
  if (history.length === 0) {
    return (
      <div className="text-center py-16 rounded-xl border border-white/[0.06] bg-white/[0.02]">
        <div className="w-16 h-16 rounded-full bg-white/[0.04] flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-white/15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
        </div>
        <p className="text-white/40 text-sm font-medium">No watch history yet</p>
        <p className="text-white/25 text-xs mt-1">Start watching anime to see your progress here</p>
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
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
      {history.slice(0, 20).map((h) => (
        <button
          key={h.id}
          onClick={() => navigate({ page: "watch", id: h.animeId, episode: h.episodeNum, title: h.animeName, image: h.thumbnail })}
          className="group text-left"
        >
          <div className="relative w-full aspect-[3/4] bg-white/5 rounded-lg overflow-hidden">
            {h.thumbnail ? (
              <img src={h.thumbnail} alt={h.animeName} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-white/10 font-bold text-2xl">
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
          <p className="text-xs font-semibold text-white truncate mt-2 group-hover:text-[#3b82f6] transition-colors">
            {h.animeName}
          </p>
          <p className="text-[10px] text-white/40">{Math.round(h.progress)}% watched</p>
        </button>
      ))}
    </div>
  );
}

// ── Bookmarks tab — shows bookmarked anime in a grid ──
function BookmarksTab({ bookmarks, navigate }: { bookmarks: any[]; navigate: (r: any) => void }) {
  if (bookmarks.length === 0) {
    return (
      <div className="text-center py-16 rounded-xl border border-white/[0.06] bg-white/[0.02]">
        <div className="w-16 h-16 rounded-full bg-white/[0.04] flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-white/15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
          </svg>
        </div>
        <p className="text-white/40 text-sm font-medium">No bookmarks yet</p>
        <p className="text-white/25 text-xs mt-1">Tap the bookmark icon on any anime to save it here</p>
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
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
      {bookmarks.map((b) => (
        <button
          key={b.id}
          onClick={() => navigate({ page: "anime", id: b.animeId })}
          className="group text-left"
        >
          <div className="relative w-full aspect-[3/4] bg-white/5 rounded-lg overflow-hidden">
            {b.thumbnail ? (
              <img src={b.thumbnail} alt={b.animeName} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-white/10 font-bold text-2xl">
                {b.animeName.charAt(0)}
              </div>
            )}
            {b.score && (
              <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded bg-black/80 backdrop-blur text-[10px] font-bold text-yellow-400">
                ★ {b.score}
              </div>
            )}
          </div>
          <p className="text-xs font-semibold text-white truncate mt-2 group-hover:text-[#3b82f6] transition-colors">
            {b.animeName}
          </p>
        </button>
      ))}
    </div>
  );
}
