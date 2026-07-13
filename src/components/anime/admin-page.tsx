"use client";

import { useState, useEffect, useMemo } from "react";
import { useAppStore } from "./store";
import { isAdminUser, listUsersSafe } from "@/lib/auth-local";
import { getMetrics, loadAnalytics, resetAnalytics, type AnalyticsMetrics } from "@/lib/analytics";
import { loadSeo, saveSeo, auditSeo, DEFAULT_SEO, type SeoSettings } from "@/lib/seo-config";

/**
 * AdminPage — owner analytics + SEO control center.
 *
 * Access is gated to the site owner (earliest signup or allow-listed email).
 * All figures are REAL, collected by the built-in localStorage analytics
 * tracker for this deployment (see src/lib/analytics.ts). To aggregate across
 * every visitor & device, point the tracker at a shared datastore (Vercel KV /
 * Postgres) — the metric shapes here are already server-ready.
 */

type Tab = "overview" | "audience" | "content" | "users" | "seo";

const ACCENT = "#3b82f6";

export default function AdminPage() {
  const navigate = useAppStore((s) => s.navigate);
  const user = useAppStore((s) => s.user);
  const [tab, setTab] = useState<Tab>("overview");
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!user) navigate({ page: "signin" });
  }, [user, navigate]);

  const allowed = useMemo(() => (user ? isAdminUser(user) : false), [user]);
  const metrics = useMemo<AnalyticsMetrics>(() => getMetrics(loadAnalytics()), [refreshKey]);
  const users = useMemo(() => listUsersSafe(), [refreshKey]);

  if (!user) return null;

  if (!allowed) {
    return (
      <div className="min-h-screen w-full bg-[#0a0a0a] text-white flex items-center justify-center px-4">
        <div className="max-w-sm text-center rounded-2xl border border-[#1a1a1a] bg-[#111] p-8">
          <div className="w-14 h-14 rounded-full bg-red-500/15 border border-red-500/30 flex items-center justify-center mx-auto mb-4 text-2xl">🔒</div>
          <h1 className="text-xl font-bold mb-1">Admin only</h1>
          <p className="text-sm text-gray-500 mb-5">This dashboard is restricted to the site owner.</p>
          <button onClick={() => navigate({ page: "home" })} className="px-4 py-2 rounded-lg text-black text-sm font-bold" style={{ backgroundColor: ACCENT }}>
            Back to site
          </button>
        </div>
      </div>
    );
  }

  if (!metrics) return null;

  const TABS: { id: Tab; label: string; icon: string }[] = [
    { id: "overview", label: "Overview", icon: "📊" },
    { id: "audience", label: "Audience", icon: "👥" },
    { id: "content", label: "Content", icon: "🎬" },
    { id: "users", label: "Users", icon: "🧑" },
    { id: "seo", label: "SEO", icon: "🚀" },
  ];

  return (
    <div className="min-h-screen w-full bg-[#0a0a0a] text-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black flex items-center gap-2">
              <span>Admin</span>
              <span className="text-xs font-bold px-2 py-1 rounded-md" style={{ backgroundColor: ACCENT + "22", color: ACCENT }}>LIVE</span>
            </h1>
            <p className="text-xs text-gray-500 mt-1">Analytics & SEO control center · {user.name}</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setRefreshKey((k) => k + 1)} className="px-3 py-2 rounded-lg bg-white/[0.04] border border-[#1a1a1a] text-xs font-bold text-gray-300 hover:bg-white/[0.08]">↻ Refresh</button>
            <button onClick={() => navigate({ page: "home" })} className="px-3 py-2 rounded-lg bg-white/[0.04] border border-[#1a1a1a] text-xs font-bold text-gray-300 hover:bg-white/[0.08]">← Site</button>
          </div>
        </div>

        {/* Data-scope note */}
        <div className="rounded-xl border border-[#1a1a1a] bg-[#111]/60 px-4 py-3 mb-6 flex items-start gap-2">
          <span className="text-sm">ℹ️</span>
          <p className="text-[11px] text-gray-500 leading-relaxed">
            Metrics are collected live by the built-in tracker (per deployment). Registered-user data is real. For global multi-device analytics,
            connect a shared datastore (Vercel KV / Postgres) — the tracker is already structured for it.
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 border-b border-[#1a1a1a] overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2.5 text-sm font-bold whitespace-nowrap border-b-2 -mb-px transition-all ${tab === t.id ? "text-white" : "border-transparent text-gray-500 hover:text-gray-300"}`}
              style={tab === t.id ? { borderColor: ACCENT } : undefined}
            >
              <span className="mr-1.5">{t.icon}</span>{t.label}
            </button>
          ))}
        </div>

        {tab === "overview" && <Overview m={metrics} userCount={users.length} users={users} />}
        {tab === "audience" && <Audience m={metrics} />}
        {tab === "content" && <Content m={metrics} />}
        {tab === "users" && <Users users={users} />}
        {tab === "seo" && <Seo />}

        {tab !== "seo" && (
          <div className="mt-8 flex justify-end">
            <button
              onClick={() => { if (confirm("Reset all analytics data on this browser? This cannot be undone.")) { resetAnalytics(); setRefreshKey((k) => k + 1); } }}
              className="px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/25 text-xs font-bold text-red-400 hover:bg-red-500/20"
            >
              Reset analytics
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════ shared bits ═══════════════════════════
function StatCard({ label, value, sub, accent = ACCENT }: { label: string; value: string | number; sub?: string; accent?: string }) {
  return (
    <div className="rounded-xl border border-[#1a1a1a] bg-[#111] p-4">
      <p className="text-[10px] uppercase tracking-wider text-gray-500 font-bold mb-1.5">{label}</p>
      <p className="text-2xl sm:text-3xl font-black" style={{ color: accent }}>{value}</p>
      {sub && <p className="text-[11px] text-gray-500 mt-1">{sub}</p>}
    </div>
  );
}

function Panel({ title, children, right }: { title: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-[#1a1a1a] bg-[#111] p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-bold text-gray-200">{title}</h2>
        {right}
      </div>
      {children}
    </section>
  );
}

// Simple dual-series bar chart (views + sessions), no external deps.
function DailyChart({ daily }: { daily: AnalyticsMetrics["daily"] }) {
  const max = Math.max(1, ...daily.map((d) => d.views));
  return (
    <div>
      <div className="flex items-stretch gap-1.5 h-40">
        {daily.map((d, i) => {
          const vh = Math.round((d.views / max) * 100);
          const sh = Math.round((d.sessions / max) * 100);
          return (
            <div key={i} className="flex-1 h-full flex flex-col items-center justify-end gap-0.5 group relative">
              <div className="w-full flex items-end justify-center gap-0.5 h-full">
                <div className="w-1/2 rounded-t transition-all self-end" style={{ height: `${vh}%`, minHeight: d.views ? 3 : 0, backgroundColor: ACCENT }} />
                <div className="w-1/2 rounded-t transition-all self-end" style={{ height: `${sh}%`, minHeight: d.sessions ? 3 : 0, backgroundColor: "#22D3EE" }} />
              </div>
              <div className="absolute -top-8 hidden group-hover:block bg-black border border-[#2a2a2a] rounded px-2 py-1 text-[10px] whitespace-nowrap z-10">
                {new Date(d.day).toLocaleDateString(undefined, { month: "short", day: "numeric" })}: {d.views}v · {d.sessions}s
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-4 mt-3 text-[11px] text-gray-500">
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: ACCENT }} /> Page views</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-[#22D3EE]" /> Sessions</span>
        <span className="ml-auto">Last 14 days</span>
      </div>
    </div>
  );
}

function BarList({ rows, accent = ACCENT }: { rows: { label: string; value: number }[]; accent?: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  if (rows.length === 0) return <p className="text-sm text-gray-600 text-center py-6">No data yet.</p>;
  return (
    <div className="flex flex-col gap-2.5">
      {rows.map((r) => (
        <div key={r.label} className="flex items-center gap-3">
          <span className="text-xs text-gray-400 w-32 truncate shrink-0">{r.label}</span>
          <div className="flex-1 h-2 rounded-full bg-[#1a1a1a] overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${(r.value / max) * 100}%`, backgroundColor: accent }} />
          </div>
          <span className="text-xs font-bold text-gray-300 tabular-nums w-10 text-right">{r.value}</span>
        </div>
      ))}
    </div>
  );
}

function fmtDuration(sec: number): string {
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}m ${s}s`;
}

const PAGE_LABELS: Record<string, string> = {
  landing: "Landing", home: "Anime Home", hub: "Hub", movies: "Movies", tv: "TV Shows",
  manga: "Manga", novel: "Novels", live: "Live Sports", search: "Search", profile: "Profile",
  watch: "Anime Watch", "movie-watch": "Movie Watch", "tv-watch": "TV Watch",
  "manga-read": "Manga Reader", "novel-read": "Novel Reader", admin: "Admin", guide: "Guide",
};
const label = (p: string) => PAGE_LABELS[p] || p;

// ═══════════════════════════════════ OVERVIEW ═══════════════════════════════
function Overview({ m, userCount, users }: { m: AnalyticsMetrics; userCount: number; users: ReturnType<typeof listUsersSafe> }) {
  const DAY = 86400000;
  const now = Date.now();
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const newToday = users.filter((u) => new Date(u.createdAt).getTime() >= todayStart.getTime()).length;
  const new7d = users.filter((u) => new Date(u.createdAt).getTime() >= now - 7 * DAY).length;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Page Views" value={m.totalViews.toLocaleString()} sub={`${m.viewsToday} today`} />
        <StatCard label="Sessions" value={m.totalSessions.toLocaleString()} sub={`${m.sessionsToday} today`} />
        <StatCard label="Active Now" value={m.activeNow} sub="last 5 min" accent="#22c55e" />
        <StatCard label="Registered Users" value={userCount.toLocaleString()} sub={`+${newToday} today`} accent="#a855f7" />
        <StatCard label="Bounce Rate" value={`${m.bounceRate}%`} sub="single-page visits" accent="#f59e0b" />
        <StatCard label="Returning" value={`${m.returningRate}%`} sub={`${m.returningSessions} sessions`} accent="#22D3EE" />
        <StatCard label="Avg. Session" value={fmtDuration(m.avgSessionSec)} sub="per visit" accent="#F472B6" />
        <StatCard label="New Signups (7d)" value={new7d} sub={`${userCount} all-time`} accent="#10B981" />
      </div>

      <Panel title="Traffic — page views & sessions">
        <DailyChart daily={m.daily} />
      </Panel>

      <div className="grid md:grid-cols-2 gap-6">
        <Panel title="Top pages">
          <BarList rows={m.topPaths.map((p) => ({ label: label(p.path), value: p.count }))} />
        </Panel>
        <Panel title="Traffic sources">
          <BarList rows={m.referrers.map((r) => ({ label: r.source, value: r.count }))} accent="#22D3EE" />
        </Panel>
      </div>
    </div>
  );
}

// ═══════════════════════════════════ AUDIENCE ═══════════════════════════════
function Audience({ m }: { m: AnalyticsMetrics }) {
  const newSessions = Math.max(0, m.totalSessions - m.returningSessions);
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Total Sessions" value={m.totalSessions} />
        <StatCard label="New Visitors" value={newSessions} accent="#22c55e" />
        <StatCard label="Returning" value={m.returningSessions} accent="#22D3EE" />
        <StatCard label="Bounce Rate" value={`${m.bounceRate}%`} accent="#f59e0b" />
      </div>
      <div className="grid md:grid-cols-2 gap-6">
        <Panel title="New vs Returning">
          <div className="flex h-4 w-full rounded-full overflow-hidden bg-[#1a1a1a] mb-4">
            <div style={{ width: `${m.totalSessions ? (newSessions / m.totalSessions) * 100 : 0}%`, backgroundColor: "#22c55e" }} />
            <div style={{ width: `${m.returningRate}%`, backgroundColor: "#22D3EE" }} />
          </div>
          <div className="flex flex-col gap-2 text-xs">
            <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-sm bg-[#22c55e]" /><span className="text-gray-400 flex-1">New</span><span className="font-bold">{newSessions}</span></div>
            <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-sm bg-[#22D3EE]" /><span className="text-gray-400 flex-1">Returning</span><span className="font-bold">{m.returningSessions}</span></div>
          </div>
        </Panel>
        <Panel title="Traffic sources">
          <BarList rows={m.referrers.map((r) => ({ label: r.source, value: r.count }))} accent="#22D3EE" />
        </Panel>
      </div>
      <Panel title="Engagement — daily sessions">
        <DailyChart daily={m.daily} />
      </Panel>
    </div>
  );
}

// ═══════════════════════════════════ CONTENT ════════════════════════════════
function Content({ m }: { m: AnalyticsMetrics }) {
  // Map page-view counts to content sections (real engagement).
  const sectionOf = (p: string): string | null => {
    if (["home", "watch", "anime", "genre"].includes(p)) return "Anime";
    if (p.startsWith("movie") || p === "movies") return "Movies";
    if (p.startsWith("tv")) return "TV";
    if (p.startsWith("manga")) return "Manga";
    if (p.startsWith("novel")) return "Novels";
    if (p.startsWith("live")) return "Live";
    return null;
  };
  const bySection = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of m.topPaths) { const s = sectionOf(p.path); if (s) map.set(s, (map.get(s) || 0) + p.count); }
    const colors: Record<string, string> = { Anime: "#48A6FF", Movies: "#F59E0B", TV: "#34D399", Manga: "#F472B6", Novels: "#a855f7", Live: "#ef4444" };
    return [...map.entries()].map(([label, value]) => ({ label, value, color: colors[label] || ACCENT })).sort((a, b) => b.value - a.value);
  }, [m]);
  const sum = bySection.reduce((s, r) => s + r.value, 0) || 1;

  return (
    <div className="space-y-6">
      <Panel title="Content engagement by section">
        {bySection.length === 0 ? (
          <p className="text-sm text-gray-600 text-center py-6">No section views recorded yet — browse the site to populate this.</p>
        ) : (
          <>
            <div className="flex h-4 w-full rounded-full overflow-hidden bg-[#1a1a1a] mb-4">
              {bySection.map((r) => <div key={r.label} style={{ width: `${(r.value / sum) * 100}%`, backgroundColor: r.color }} title={`${r.label}: ${r.value}`} />)}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {bySection.map((r) => (
                <div key={r.label} className="rounded-lg border border-[#1a1a1a] p-3" style={{ background: `linear-gradient(135deg, ${r.color}14, transparent)` }}>
                  <p className="text-xl font-black" style={{ color: r.color }}>{r.value}</p>
                  <p className="text-xs text-gray-400">{r.label} <span className="text-gray-600">· {Math.round((r.value / sum) * 100)}%</span></p>
                </div>
              ))}
            </div>
          </>
        )}
      </Panel>
      <Panel title="All viewed pages">
        <BarList rows={m.topPaths.map((p) => ({ label: label(p.path), value: p.count }))} />
      </Panel>
    </div>
  );
}

// ═══════════════════════════════════ USERS ══════════════════════════════════
function Users({ users }: { users: ReturnType<typeof listUsersSafe> }) {
  if (users.length === 0) {
    return <Panel title="Registered users"><p className="text-sm text-gray-600 text-center py-8">No registered users on this deployment yet.</p></Panel>;
  }
  return (
    <Panel title={`Registered users (${users.length})`}>
      <div className="overflow-x-auto scroll-container -mx-1 px-1">
        <table className="w-full text-sm min-w-[520px]">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-wider text-gray-500 border-b border-[#1a1a1a]">
              <th className="py-2 pr-3 font-bold">User</th>
              <th className="py-2 px-3 font-bold">Username</th>
              <th className="py-2 px-3 font-bold">Email</th>
              <th className="py-2 pl-3 font-bold text-right">Joined</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u, i) => (
              <tr key={u.id} className="border-b border-[#141414] hover:bg-white/[0.02]">
                <td className="py-2.5 pr-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0" style={{ backgroundColor: (u.avatarColor || ACCENT) + "22", color: u.avatarColor || ACCENT }}>
                      {u.avatarEmoji || (u.avatar || u.name.charAt(0)).toUpperCase()}
                    </div>
                    <span className="font-semibold text-gray-200 truncate">{u.name}</span>
                    {i === 0 && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ backgroundColor: ACCENT + "22", color: ACCENT }}>OWNER</span>}
                  </div>
                </td>
                <td className="py-2.5 px-3 text-gray-500 font-mono">@{u.username}</td>
                <td className="py-2.5 px-3 text-gray-500 truncate max-w-[180px]">{u.email}</td>
                <td className="py-2.5 pl-3 text-gray-500 text-right whitespace-nowrap">{new Date(u.createdAt).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

// ═══════════════════════════════════ SEO ════════════════════════════════════
function Seo() {
  const [s, setS] = useState<SeoSettings>(() => loadSeo());
  const [saved, setSaved] = useState(false);
  const audit = useMemo(() => auditSeo(s), [s]);
  const set = (k: keyof SeoSettings, v: string | boolean) => { setS((prev) => ({ ...prev, [k]: v })); setSaved(false); };
  const scoreColor = audit.score >= 80 ? "#22c55e" : audit.score >= 50 ? "#f59e0b" : "#ef4444";

  const field = (label: string, k: keyof SeoSettings, area = false, ph = "") => (
    <div className="mb-4">
      <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">{label}</label>
      {area ? (
        <textarea value={String(s[k])} onChange={(e) => set(k, e.target.value)} rows={3} placeholder={ph}
          className="w-full px-3 py-2 rounded-lg bg-[#0a0a0a] border border-[#1a1a1a] text-sm text-white outline-none focus:border-[#3b82f6]/50 resize-none" />
      ) : (
        <input value={String(s[k])} onChange={(e) => set(k, e.target.value)} placeholder={ph}
          className="w-full px-3 py-2 rounded-lg bg-[#0a0a0a] border border-[#1a1a1a] text-sm text-white outline-none focus:border-[#3b82f6]/50" />
      )}
    </div>
  );

  return (
    <div className="grid lg:grid-cols-[1fr_360px] gap-6">
      {/* Editor */}
      <Panel title="Search engine optimization" right={
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">Score</span>
          <span className="text-lg font-black" style={{ color: scoreColor }}>{audit.score}</span>
        </div>
      }>
        {field("Site Name", "siteName")}
        {field("Meta Title", "title")}
        {field("Meta Description", "description", true)}
        {field("Keywords (comma separated)", "keywords", true)}
        {field("Canonical URL", "canonicalUrl", false, "https://…")}
        <div className="grid grid-cols-2 gap-3">
          {field("OG Image URL", "ogImage", false, "/og.png")}
          {field("Twitter Handle", "twitterHandle", false, "@handle")}
        </div>
        <label className="flex items-center gap-2.5 mb-5 cursor-pointer">
          <input type="checkbox" checked={s.robotsIndex} onChange={(e) => set("robotsIndex", e.target.checked)} className="w-4 h-4 accent-[#3b82f6]" />
          <span className="text-sm text-gray-300">Allow search engines to index the site</span>
        </label>
        <div className="flex gap-2">
          <button onClick={() => { saveSeo(s); setSaved(true); }} className="px-4 py-2 rounded-lg text-black text-sm font-bold" style={{ backgroundColor: ACCENT }}>
            {saved ? "Saved ✓" : "Save SEO settings"}
          </button>
          <button onClick={() => { setS(DEFAULT_SEO); setSaved(false); }} className="px-4 py-2 rounded-lg bg-white/[0.04] border border-[#1a1a1a] text-sm font-bold text-gray-400">Reset to default</button>
        </div>
      </Panel>

      {/* Preview + audit */}
      <div className="space-y-6">
        <Panel title="Google preview">
          <div className="rounded-lg bg-white p-3">
            <p className="text-[#1a0dab] text-[15px] leading-snug truncate">{s.title || "Page title"}</p>
            <p className="text-[#006621] text-xs truncate">{s.canonicalUrl || "https://luffytv.app"}</p>
            <p className="text-[#545454] text-xs leading-snug line-clamp-2 mt-0.5">{s.description || "Meta description preview…"}</p>
          </div>
          <p className="text-[10px] text-gray-600 mt-2">Live sitelinks search box, sitemap.xml & robots.txt ship automatically.</p>
        </Panel>
        <Panel title="SEO audit">
          <div className="flex flex-col gap-2">
            {audit.checks.map((c) => (
              <div key={c.id} className="flex items-start gap-2" title={c.hint}>
                <span className={`text-sm mt-0.5 ${c.ok ? "text-green-500" : "text-red-500"}`}>{c.ok ? "✓" : "✗"}</span>
                <div>
                  <p className={`text-xs font-semibold ${c.ok ? "text-gray-300" : "text-gray-400"}`}>{c.label}</p>
                  {!c.ok && <p className="text-[10px] text-gray-600">{c.hint}</p>}
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}
