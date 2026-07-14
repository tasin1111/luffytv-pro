"use client";

import { useState, useMemo, useSyncExternalStore } from "react";
import {
  hasAdminCredential, setAdminCredential, verifyAdmin, getAdminUsername,
  changeAdminPassword, startAdminSession, isAdminSession, endAdminSession,
} from "@/lib/admin-auth";
import {
  loadAnalytics, getMetrics, getRangeMetrics, resetAnalytics, seedDemoAnalytics,
} from "@/lib/analytics";
import { listUsersSafe } from "@/lib/auth-local";
import { loadSeo, saveSeo, auditSeo, DEFAULT_SEO, type SeoSettings } from "@/lib/seo-config";

/* ============================================================
   Admin theme / customization (persisted)
   ============================================================ */
const ACCENTS = [
  { id: "blue", v: "#3b82f6" }, { id: "violet", v: "#8b5cf6" }, { id: "emerald", v: "#10b981" },
  { id: "amber", v: "#f59e0b" }, { id: "rose", v: "#f43f5e" }, { id: "cyan", v: "#06b6d4" },
];
const THEME_KEY = "luffytv_admin_accent";
function loadAccent(): string { try { return localStorage.getItem(THEME_KEY) || "#3b82f6"; } catch { return "#3b82f6"; } }
function saveAccent(v: string) { try { localStorage.setItem(THEME_KEY, v); } catch {} }

/* ============================================================
   Mounted gate (avoid SSR/localStorage hydration mismatch)
   ============================================================ */
const sub = () => () => {};
function useMounted() { return useSyncExternalStore(sub, () => true, () => false); }

export default function AdminApp() {
  const mounted = useMounted();
  if (!mounted) {
    return (
      <div className="min-h-screen bg-[#0b0e14] flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-white/20 border-t-white/70 animate-spin" />
      </div>
    );
  }
  return <AdminGate />;
}

/* ============================================================
   Auth gate — setup / login / dashboard
   ============================================================ */
function AdminGate() {
  const [authed, setAuthed] = useState(() => isAdminSession());
  if (authed) return <Dashboard onLogout={() => { endAdminSession(); setAuthed(false); }} />;
  return <AuthScreen onAuthed={() => setAuthed(true)} />;
}

function AuthScreen({ onAuthed }: { onAuthed: () => void }) {
  const [mode] = useState<"setup" | "login">(hasAdminCredential() ? "login" : "setup");
  const [username, setUsername] = useState(mode === "login" ? getAdminUsername() : "");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [accent] = useState(loadAccent);

  const submit = () => {
    setError("");
    if (mode === "setup") {
      if (password !== confirm) { setError("Passwords do not match"); return; }
      const r = setAdminCredential(username, password);
      if (!r.ok) { setError(r.error || "Could not create credential"); return; }
      startAdminSession();
      onAuthed();
    } else {
      if (!verifyAdmin(username, password)) { setError("Invalid username or password"); return; }
      startAdminSession();
      onAuthed();
    }
  };

  return (
    <div className="min-h-screen bg-[#0b0e14] text-white flex items-center justify-center px-4"
      style={{ backgroundImage: `radial-gradient(circle at 20% 0%, ${accent}22, transparent 45%), radial-gradient(circle at 85% 100%, ${accent}15, transparent 45%)` }}>
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2.5 justify-center mb-6">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg font-black" style={{ backgroundColor: accent }}>L</div>
          <div>
            <p className="font-black text-lg leading-none">Luffy TV</p>
            <p className="text-[11px] text-white/40">Admin Console</p>
          </div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-[#111722] p-6 shadow-2xl">
          <h1 className="text-lg font-bold mb-1">{mode === "setup" ? "Create admin access" : "Admin sign in"}</h1>
          <p className="text-xs text-white/45 mb-5">{mode === "setup" ? "Set the credentials for this admin console." : "Enter your admin credentials to continue."}</p>

          <label className="block text-[11px] font-bold text-white/50 uppercase tracking-wider mb-1.5">Username</label>
          <input value={username} onChange={(e) => setUsername(e.target.value)} autoFocus={mode === "setup"}
            className="w-full px-3.5 py-2.5 rounded-lg bg-[#0b0e14] border border-white/10 text-sm outline-none focus:border-white/30 mb-4" placeholder="admin" />

          <label className="block text-[11px] font-bold text-white/50 uppercase tracking-wider mb-1.5">Password</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && mode === "login" && submit()}
            className="w-full px-3.5 py-2.5 rounded-lg bg-[#0b0e14] border border-white/10 text-sm outline-none focus:border-white/30 mb-4" placeholder="••••••••" />

          {mode === "setup" && (
            <>
              <label className="block text-[11px] font-bold text-white/50 uppercase tracking-wider mb-1.5">Confirm password</label>
              <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submit()}
                className="w-full px-3.5 py-2.5 rounded-lg bg-[#0b0e14] border border-white/10 text-sm outline-none focus:border-white/30 mb-4" placeholder="••••••••" />
            </>
          )}

          {error && <p className="text-xs text-red-400 mb-4">{error}</p>}

          <button onClick={submit} className="w-full py-2.5 rounded-lg text-black text-sm font-bold hover:opacity-90 transition-opacity" style={{ backgroundColor: accent }}>
            {mode === "setup" ? "Create & enter" : "Sign in"}
          </button>
          <a href="/" className="block text-center text-xs text-white/40 hover:text-white/70 mt-4">← Back to site</a>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   Dashboard shell (sidebar + topbar)
   ============================================================ */
type Tab = "dashboard" | "audience" | "content" | "users" | "seo" | "settings";
const NAV: { id: Tab; label: string; icon: string }[] = [
  { id: "dashboard", label: "Dashboard", icon: "grid" },
  { id: "audience", label: "Audience", icon: "users" },
  { id: "content", label: "Content", icon: "film" },
  { id: "users", label: "Members", icon: "user" },
  { id: "seo", label: "SEO", icon: "search" },
  { id: "settings", label: "Settings", icon: "cog" },
];

function Dashboard({ onLogout }: { onLogout: () => void }) {
  const [tab, setTab] = useState<Tab>("dashboard");
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [range, setRange] = useState<7 | 14 | 30>(14);
  const [accent, setAccent] = useState(loadAccent);
  const [refreshKey, setRefreshKey] = useState(0);

  const rm = useMemo(() => getRangeMetrics(range), [range, refreshKey]);
  const overall = useMemo(() => getMetrics(loadAnalytics()), [refreshKey]);
  const users = useMemo(() => listUsersSafe(), [refreshKey]);

  const setAcc = (v: string) => { setAccent(v); saveAccent(v); };

  return (
    <div className="min-h-screen bg-[#0b0e14] text-white flex" style={{ ["--acc" as string]: accent }}>
      {/* Mobile backdrop */}
      {mobileOpen && <div className="fixed inset-0 bg-black/60 z-30 lg:hidden" onClick={() => setMobileOpen(false)} />}
      {/* Sidebar */}
      <aside className={`fixed lg:sticky top-0 z-40 h-screen w-60 ${collapsed ? "lg:w-16" : "lg:w-60"} shrink-0 border-r border-white/[0.06] bg-[#0e131c] flex flex-col transition-all duration-200 ${mobileOpen ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0`}>
        <div className="h-16 flex items-center gap-2.5 px-4 border-b border-white/[0.06]">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-base font-black shrink-0" style={{ backgroundColor: accent }}>L</div>
          <div className={collapsed ? "lg:hidden" : ""}><p className="font-black text-sm leading-none">Luffy TV</p><p className="text-[10px] text-white/40 mt-0.5">Admin</p></div>
        </div>
        <nav className="flex-1 p-2.5 space-y-1">
          {NAV.map((n) => {
            const active = tab === n.id;
            return (
              <button key={n.id} onClick={() => { setTab(n.id); setMobileOpen(false); }} title={n.label}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all ${active ? "text-white" : "text-white/45 hover:text-white/80 hover:bg-white/[0.04]"}`}
                style={active ? { backgroundColor: accent + "1f", color: accent } : undefined}>
                <NavIcon name={n.icon} />
                <span className={collapsed ? "lg:hidden" : ""}>{n.label}</span>
              </button>
            );
          })}
        </nav>
        <div className="p-2.5 border-t border-white/[0.06] space-y-1">
          <button onClick={() => setCollapsed((c) => !c)} className="hidden lg:flex w-full items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold text-white/45 hover:text-white/80 hover:bg-white/[0.04]">
            <NavIcon name={collapsed ? "expand" : "collapse"} /><span className={collapsed ? "lg:hidden" : ""}>Collapse</span>
          </button>
          <button onClick={onLogout} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold text-red-400/80 hover:text-red-400 hover:bg-red-500/10">
            <NavIcon name="logout" /><span className={collapsed ? "lg:hidden" : ""}>Sign out</span>
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Topbar */}
        <header className="h-16 shrink-0 border-b border-white/[0.06] bg-[#0b0e14]/80 backdrop-blur sticky top-0 z-20 flex items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <button onClick={() => setMobileOpen(true)} className="lg:hidden w-9 h-9 rounded-lg border border-white/10 flex items-center justify-center text-white/70" aria-label="Open menu">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" d="M4 6h16M4 12h16M4 18h16" /></svg>
            </button>
            <div>
              <h1 className="text-lg font-black capitalize leading-none">{tab === "users" ? "Members" : tab}</h1>
              <p className="text-[11px] text-white/40 mt-0.5 hidden sm:block">{new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {(tab === "dashboard" || tab === "audience" || tab === "content") && (
              <div className="flex rounded-lg border border-white/10 overflow-hidden text-xs font-bold">
                {[7, 14, 30].map((d) => (
                  <button key={d} onClick={() => setRange(d as 7 | 14 | 30)}
                    className="px-2.5 py-1.5 transition-colors" style={range === d ? { backgroundColor: accent, color: "#000" } : { color: "rgba(255,255,255,0.5)" }}>{d}d</button>
                ))}
              </div>
            )}
            <button onClick={() => setRefreshKey((k) => k + 1)} className="w-9 h-9 rounded-lg border border-white/10 flex items-center justify-center text-white/60 hover:text-white hover:bg-white/[0.05]" title="Refresh">
              <NavIcon name="refresh" />
            </button>
            <a href="/" className="hidden sm:flex items-center gap-1.5 px-3 h-9 rounded-lg border border-white/10 text-xs font-bold text-white/60 hover:text-white hover:bg-white/[0.05]">View site</a>
            <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-black" style={{ backgroundColor: accent + "33", color: accent }}>{getAdminUsername().charAt(0).toUpperCase()}</div>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 overflow-x-hidden">
          {tab === "dashboard" && <DashboardTab rm={rm} overall={overall} userCount={users.length} accent={accent} />}
          {tab === "audience" && <AudienceTab rm={rm} overall={overall} accent={accent} />}
          {tab === "content" && <ContentTab rm={rm} accent={accent} />}
          {tab === "users" && <UsersTab users={users} accent={accent} />}
          {tab === "seo" && <SeoTab accent={accent} />}
          {tab === "settings" && <SettingsTab accent={accent} setAccent={setAcc} onData={() => setRefreshKey((k) => k + 1)} />}
        </main>
      </div>
    </div>
  );
}

/* ============================================================
   Reusable UI
   ============================================================ */
function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-white/[0.07] bg-[#111722] ${className}`}>{children}</div>;
}

function Delta({ v, invert = false }: { v: number | null; invert?: boolean }) {
  if (v === null) return <span className="text-[11px] text-white/30">— new</span>;
  const good = invert ? v <= 0 : v >= 0;
  return (
    <span className={`text-[11px] font-bold flex items-center gap-0.5 ${good ? "text-emerald-400" : "text-red-400"}`}>
      {v >= 0 ? "▲" : "▼"} {Math.abs(v)}%
    </span>
  );
}

function Kpi({ label, value, delta, invert, icon, accent, spark }: { label: string; value: string | number; delta?: number | null; invert?: boolean; icon: string; accent: string; spark?: number[] }) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between mb-3">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: accent + "1f", color: accent }}><NavIcon name={icon} /></div>
        {delta !== undefined && <Delta v={delta ?? null} invert={invert} />}
      </div>
      <p className="text-2xl font-black">{value}</p>
      <p className="text-[11px] text-white/45 mt-0.5">{label}</p>
      {spark && spark.length > 1 && <Sparkline data={spark} accent={accent} />}
    </Card>
  );
}

function Sparkline({ data, accent }: { data: number[]; accent: string }) {
  const max = Math.max(1, ...data);
  const pts = data.map((d, i) => `${(i / (data.length - 1)) * 100},${28 - (d / max) * 24}`).join(" ");
  return (
    <svg viewBox="0 0 100 28" preserveAspectRatio="none" className="w-full h-6 mt-2">
      <polyline points={pts} fill="none" stroke={accent} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function AreaChart({ series, accent }: { series: { day: number; views: number; sessions: number }[]; accent: string }) {
  const W = 700, H = 220, P = 8;
  const max = Math.max(1, ...series.map((s) => Math.max(s.views, s.sessions)));
  const x = (i: number) => P + (i / Math.max(1, series.length - 1)) * (W - 2 * P);
  const y = (v: number) => H - P - (v / max) * (H - 2 * P - 16);
  const line = (key: "views" | "sessions") => series.map((s, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(s[key])}`).join(" ");
  const area = `${line("views")} L${x(series.length - 1)},${H - P} L${x(0)},${H - P} Z`;
  return (
    <div className="w-full overflow-hidden">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="w-full h-56">
        <defs>
          <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={accent} stopOpacity="0.35" />
            <stop offset="100%" stopColor={accent} stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75, 1].map((g) => (
          <line key={g} x1={P} x2={W - P} y1={H - P - g * (H - 2 * P - 16)} y2={H - P - g * (H - 2 * P - 16)} stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
        ))}
        <path d={area} fill="url(#areaFill)" />
        <path d={line("views")} fill="none" stroke={accent} strokeWidth="2" vectorEffect="non-scaling-stroke" />
        <path d={line("sessions")} fill="none" stroke="#22D3EE" strokeWidth="2" strokeDasharray="4 3" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="flex items-center gap-4 mt-2 text-[11px] text-white/45 px-1">
        <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 rounded" style={{ backgroundColor: accent }} /> Page views</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 rounded bg-[#22D3EE]" /> Sessions</span>
        <span className="ml-auto">{new Date(series[0]?.day).toLocaleDateString(undefined, { month: "short", day: "numeric" })} – today</span>
      </div>
    </div>
  );
}

function Donut({ data, accent }: { data: { label: string; value: number; color: string }[]; accent: string }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return <p className="text-sm text-white/40 text-center py-8">No data yet.</p>;
  const R = 42, C = 2 * Math.PI * R;
  const segments = data.reduce<{ d: typeof data[number]; start: number }[]>((acc, d) => {
    const prev = acc.length ? acc[acc.length - 1] : null;
    const start = prev ? prev.start + prev.d.value / total : 0;
    return [...acc, { d, start }];
  }, []);
  return (
    <div className="flex items-center gap-5">
      <svg viewBox="0 0 100 100" className="w-28 h-28 shrink-0 -rotate-90">
        <circle cx="50" cy="50" r={R} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="12" />
        {segments.map(({ d, start }, i) => (
          <circle key={i} cx="50" cy="50" r={R} fill="none" stroke={d.color} strokeWidth="12" strokeDasharray={`${(d.value / total) * C} ${C}`} strokeDashoffset={-start * C} />
        ))}
      </svg>
      <div className="flex-1 min-w-0 space-y-1.5">
        {data.map((d) => (
          <div key={d.label} className="flex items-center gap-2 text-xs">
            <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: d.color }} />
            <span className="text-white/60 flex-1 truncate">{d.label}</span>
            <span className="font-bold tabular-nums">{Math.round((d.value / total) * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function BarList({ rows, accent }: { rows: { label: string; value: number }[]; accent: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  if (rows.length === 0) return <p className="text-sm text-white/35 text-center py-6">No data yet.</p>;
  return (
    <div className="space-y-2.5">
      {rows.map((r) => (
        <div key={r.label} className="flex items-center gap-3">
          <span className="text-xs text-white/55 w-28 truncate shrink-0">{r.label}</span>
          <div className="flex-1 h-2 rounded-full bg-white/[0.06] overflow-hidden"><div className="h-full rounded-full" style={{ width: `${(r.value / max) * 100}%`, backgroundColor: accent }} /></div>
          <span className="text-xs font-bold tabular-nums w-9 text-right">{r.value}</span>
        </div>
      ))}
    </div>
  );
}

function PanelHead({ title, sub }: { title: string; sub?: string }) {
  return <div className="mb-4"><h2 className="text-sm font-bold">{title}</h2>{sub && <p className="text-[11px] text-white/40 mt-0.5">{sub}</p>}</div>;
}

const PAGE_LABELS: Record<string, string> = {
  landing: "Landing", home: "Anime Home", hub: "Hub", movies: "Movies", tv: "TV Shows", manga: "Manga",
  novel: "Novels", live: "Live Sports", search: "Search", profile: "Profile", watch: "Anime Watch",
  "movie-watch": "Movie Watch", "tv-watch": "TV Watch", "manga-read": "Manga Reader", admin: "Admin",
};
const plabel = (p: string) => PAGE_LABELS[p] || p;
function fmtDur(sec: number) { return sec < 60 ? `${sec}s` : `${Math.floor(sec / 60)}m ${sec % 60}s`; }

/* ============================================================
   Tabs
   ============================================================ */
function DashboardTab({ rm, overall, userCount, accent }: { rm: ReturnType<typeof getRangeMetrics>; overall: ReturnType<typeof getMetrics>; userCount: number; accent: string }) {
  const sourceColors = ["#3b82f6", "#22D3EE", "#8b5cf6", "#f59e0b", "#10b981", "#f43f5e"];
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi label={`Page views · last ${rm.days}d`} value={rm.views.toLocaleString()} delta={rm.viewsDelta} icon="eye" accent={accent} spark={rm.series.map((s) => s.views)} />
        <Kpi label={`Sessions · last ${rm.days}d`} value={rm.sessions.toLocaleString()} delta={rm.sessionsDelta} icon="cursor" accent={accent} spark={rm.series.map((s) => s.sessions)} />
        <Kpi label="Bounce rate" value={`${rm.bounceRate}%`} delta={rm.bounceDelta} invert icon="bounce" accent={accent} />
        <Kpi label="Avg. session" value={fmtDur(rm.avgSessionSec)} delta={rm.avgDelta} icon="clock" accent={accent} />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi label="Active now" value={overall.activeNow} icon="live" accent="#10b981" />
        <Kpi label="Registered members" value={userCount} icon="user" accent="#8b5cf6" />
        <Kpi label="Returning" value={`${overall.returningRate}%`} icon="repeat" accent="#22D3EE" />
        <Kpi label="All-time views" value={overall.totalViews.toLocaleString()} icon="chart" accent="#f59e0b" />
      </div>

      <Card className="p-5">
        <PanelHead title="Traffic overview" sub={`Page views & sessions · last ${rm.days} days`} />
        <AreaChart series={rm.series} accent={accent} />
      </Card>

      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="p-5 lg:col-span-2">
          <PanelHead title="Top pages" />
          <BarList rows={rm.topPaths.map((p) => ({ label: plabel(p.path), value: p.count }))} accent={accent} />
        </Card>
        <Card className="p-5">
          <PanelHead title="Traffic sources" />
          <Donut data={rm.referrers.map((r, i) => ({ label: r.source, value: r.count, color: sourceColors[i % sourceColors.length] }))} accent={accent} />
        </Card>
      </div>
    </div>
  );
}

function AudienceTab({ rm, overall, accent }: { rm: ReturnType<typeof getRangeMetrics>; overall: ReturnType<typeof getMetrics>; accent: string }) {
  const newS = Math.max(0, overall.totalSessions - overall.returningSessions);
  const sourceColors = ["#3b82f6", "#22D3EE", "#8b5cf6", "#f59e0b", "#10b981", "#f43f5e"];
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi label="Sessions" value={rm.sessions} delta={rm.sessionsDelta} icon="cursor" accent={accent} />
        <Kpi label="New visitors" value={newS} icon="sparkle" accent="#10b981" />
        <Kpi label="Returning" value={overall.returningSessions} icon="repeat" accent="#22D3EE" />
        <Kpi label="Bounce rate" value={`${rm.bounceRate}%`} delta={rm.bounceDelta} invert icon="bounce" accent="#f59e0b" />
      </div>
      <Card className="p-5"><PanelHead title="Sessions over time" /><AreaChart series={rm.series} accent={accent} /></Card>
      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="p-5">
          <PanelHead title="New vs returning" />
          <div className="flex h-4 w-full rounded-full overflow-hidden bg-white/[0.06] mb-4">
            <div style={{ width: `${overall.totalSessions ? (newS / overall.totalSessions) * 100 : 0}%`, backgroundColor: "#10b981" }} />
            <div style={{ width: `${overall.returningRate}%`, backgroundColor: "#22D3EE" }} />
          </div>
          <div className="space-y-2 text-xs">
            <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-sm bg-[#10b981]" /><span className="text-white/60 flex-1">New</span><span className="font-bold">{newS}</span></div>
            <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-sm bg-[#22D3EE]" /><span className="text-white/60 flex-1">Returning</span><span className="font-bold">{overall.returningSessions}</span></div>
          </div>
        </Card>
        <Card className="p-5"><PanelHead title="Traffic sources" /><Donut data={rm.referrers.map((r, i) => ({ label: r.source, value: r.count, color: sourceColors[i % sourceColors.length] }))} accent={accent} /></Card>
      </div>
    </div>
  );
}

function ContentTab({ rm, accent }: { rm: ReturnType<typeof getRangeMetrics>; accent: string }) {
  const sectionOf = (p: string): string | null => {
    if (["home", "watch", "anime", "genre"].includes(p)) return "Anime";
    if (p.startsWith("movie") || p === "movies") return "Movies";
    if (p.startsWith("tv")) return "TV";
    if (p.startsWith("manga")) return "Manga";
    if (p.startsWith("novel")) return "Novels";
    if (p.startsWith("live")) return "Live";
    return null;
  };
  const colors: Record<string, string> = { Anime: "#48A6FF", Movies: "#F59E0B", TV: "#34D399", Manga: "#F472B6", Novels: "#a855f7", Live: "#ef4444" };
  const bySection = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of rm.topPaths) { const s = sectionOf(p.path); if (s) m.set(s, (m.get(s) || 0) + p.count); }
    return [...m.entries()].map(([label, value]) => ({ label, value, color: colors[label] })).sort((a, b) => b.value - a.value);
  }, [rm]);
  return (
    <div className="space-y-6">
      <Card className="p-5">
        <PanelHead title="Engagement by section" />
        {bySection.length === 0 ? <p className="text-sm text-white/35 text-center py-6">No section views recorded yet.</p> : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {bySection.map((r) => (
              <div key={r.label} className="rounded-xl border border-white/[0.06] p-4" style={{ background: `linear-gradient(135deg, ${r.color}14, transparent)` }}>
                <p className="text-2xl font-black" style={{ color: r.color }}>{r.value}</p>
                <p className="text-xs text-white/50 mt-0.5">{r.label}</p>
              </div>
            ))}
          </div>
        )}
      </Card>
      <Card className="p-5"><PanelHead title="All viewed pages" /><BarList rows={rm.topPaths.map((p) => ({ label: plabel(p.path), value: p.count }))} accent={accent} /></Card>
    </div>
  );
}

function UsersTab({ users, accent }: { users: ReturnType<typeof listUsersSafe>; accent: string }) {
  return (
    <Card className="p-5">
      <PanelHead title={`Registered members (${users.length})`} />
      {users.length === 0 ? <p className="text-sm text-white/35 text-center py-8">No registered members yet.</p> : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[520px]">
            <thead><tr className="text-left text-[10px] uppercase tracking-wider text-white/40 border-b border-white/[0.06]">
              <th className="py-2 pr-3 font-bold">Member</th><th className="py-2 px-3 font-bold">Username</th><th className="py-2 px-3 font-bold">Email</th><th className="py-2 pl-3 font-bold text-right">Joined</th>
            </tr></thead>
            <tbody>{users.map((u, i) => (
              <tr key={u.id} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                <td className="py-2.5 pr-3"><div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0" style={{ backgroundColor: (u.avatarColor || accent) + "22", color: u.avatarColor || accent }}>{u.avatarEmoji || (u.avatar || u.name.charAt(0)).toUpperCase()}</div>
                  <span className="font-semibold text-white/90 truncate">{u.name}</span>
                  {i === 0 && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ backgroundColor: accent + "22", color: accent }}>OWNER</span>}
                </div></td>
                <td className="py-2.5 px-3 text-white/45 font-mono">@{u.username}</td>
                <td className="py-2.5 px-3 text-white/45 truncate max-w-[180px]">{u.email}</td>
                <td className="py-2.5 pl-3 text-white/45 text-right whitespace-nowrap">{new Date(u.createdAt).toLocaleDateString()}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function SeoTab({ accent }: { accent: string }) {
  const [s, setS] = useState<SeoSettings>(() => loadSeo());
  const [saved, setSaved] = useState(false);
  const audit = useMemo(() => auditSeo(s), [s]);
  const set = (k: keyof SeoSettings, v: string | boolean) => { setS((p) => ({ ...p, [k]: v })); setSaved(false); };
  const scoreColor = audit.score >= 80 ? "#10b981" : audit.score >= 50 ? "#f59e0b" : "#ef4444";
  const field = (label: string, k: keyof SeoSettings, area = false, ph = "") => (
    <div className="mb-4">
      <label className="block text-[11px] font-bold text-white/50 uppercase tracking-wider mb-1.5">{label}</label>
      {area
        ? <textarea value={String(s[k])} onChange={(e) => set(k, e.target.value)} rows={3} placeholder={ph} className="w-full px-3 py-2 rounded-lg bg-[#0b0e14] border border-white/10 text-sm outline-none focus:border-white/30 resize-none" />
        : <input value={String(s[k])} onChange={(e) => set(k, e.target.value)} placeholder={ph} className="w-full px-3 py-2 rounded-lg bg-[#0b0e14] border border-white/10 text-sm outline-none focus:border-white/30" />}
    </div>
  );
  return (
    <div className="grid lg:grid-cols-[1fr_340px] gap-6">
      <Card className="p-5">
        <div className="flex items-center justify-between mb-4"><h2 className="text-sm font-bold">Search engine optimization</h2><span className="text-lg font-black" style={{ color: scoreColor }}>{audit.score}<span className="text-white/30 text-xs font-bold">/100</span></span></div>
        {field("Site name", "siteName")}
        {field("Meta title", "title")}
        {field("Meta description", "description", true)}
        {field("Keywords", "keywords", true)}
        {field("Canonical URL", "canonicalUrl", false, "https://…")}
        <div className="grid grid-cols-2 gap-3">{field("OG image URL", "ogImage", false, "/og.png")}{field("Twitter handle", "twitterHandle", false, "@handle")}</div>
        <label className="flex items-center gap-2.5 mb-5 cursor-pointer"><input type="checkbox" checked={s.robotsIndex} onChange={(e) => set("robotsIndex", e.target.checked)} className="w-4 h-4" style={{ accentColor: accent }} /><span className="text-sm text-white/70">Allow search engines to index the site</span></label>
        <div className="flex gap-2">
          <button onClick={() => { saveSeo(s); setSaved(true); }} className="px-4 py-2 rounded-lg text-black text-sm font-bold" style={{ backgroundColor: accent }}>{saved ? "Saved ✓" : "Save settings"}</button>
          <button onClick={() => { setS(DEFAULT_SEO); setSaved(false); }} className="px-4 py-2 rounded-lg border border-white/10 text-sm font-bold text-white/50">Reset</button>
        </div>
      </Card>
      <div className="space-y-6">
        <Card className="p-5"><PanelHead title="Google preview" />
          <div className="rounded-lg bg-white p-3">
            <p className="text-[#1a0dab] text-[15px] leading-snug truncate">{s.title || "Page title"}</p>
            <p className="text-[#006621] text-xs truncate">{s.canonicalUrl || "https://luffytv.app"}</p>
            <p className="text-[#545454] text-xs leading-snug line-clamp-2 mt-0.5">{s.description || "Meta description…"}</p>
          </div>
          <p className="text-[10px] text-white/40 mt-2">sitemap.xml, robots.txt & structured data ship automatically.</p>
        </Card>
        <Card className="p-5"><PanelHead title="SEO audit" />
          <div className="space-y-2">{audit.checks.map((c) => (
            <div key={c.id} className="flex items-start gap-2" title={c.hint}>
              <span className={`text-sm mt-0.5 ${c.ok ? "text-emerald-500" : "text-red-500"}`}>{c.ok ? "✓" : "✗"}</span>
              <div><p className={`text-xs font-semibold ${c.ok ? "text-white/70" : "text-white/50"}`}>{c.label}</p>{!c.ok && <p className="text-[10px] text-white/35">{c.hint}</p>}</div>
            </div>
          ))}</div>
        </Card>
      </div>
    </div>
  );
}

function SettingsTab({ accent, setAccent, onData }: { accent: string; setAccent: (v: string) => void; onData: () => void }) {
  const [oldPw, setOldPw] = useState(""); const [newPw, setNewPw] = useState(""); const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const changePw = () => { const r = changeAdminPassword(oldPw, newPw); setMsg({ ok: r.ok, t: r.ok ? "Password updated" : (r.error || "Failed") }); if (r.ok) { setOldPw(""); setNewPw(""); } };
  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <Card className="p-5">
        <PanelHead title="Appearance" sub="Personalize your admin console" />
        <label className="block text-[11px] font-bold text-white/50 uppercase tracking-wider mb-2">Accent color</label>
        <div className="flex gap-2.5 flex-wrap">
          {ACCENTS.map((a) => (
            <button key={a.id} onClick={() => setAccent(a.v)} className={`w-9 h-9 rounded-full border-2 transition-all ${accent === a.v ? "border-white scale-110" : "border-white/10 hover:scale-105"}`} style={{ backgroundColor: a.v }} title={a.id} />
          ))}
        </div>
      </Card>

      <Card className="p-5">
        <PanelHead title="Change password" sub="Update your admin credentials" />
        <input type="password" value={oldPw} onChange={(e) => setOldPw(e.target.value)} placeholder="Current password" className="w-full px-3 py-2 rounded-lg bg-[#0b0e14] border border-white/10 text-sm outline-none focus:border-white/30 mb-3" />
        <input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} placeholder="New password (min 6)" className="w-full px-3 py-2 rounded-lg bg-[#0b0e14] border border-white/10 text-sm outline-none focus:border-white/30 mb-3" />
        {msg && <p className={`text-xs mb-3 ${msg.ok ? "text-emerald-400" : "text-red-400"}`}>{msg.t}</p>}
        <button onClick={changePw} className="px-4 py-2 rounded-lg text-black text-sm font-bold" style={{ backgroundColor: accent }}>Update password</button>
      </Card>

      <Card className="p-5 lg:col-span-2">
        <PanelHead title="Data management" sub="Analytics stored locally on this deployment" />
        <div className="flex flex-wrap gap-2">
          <button onClick={() => { seedDemoAnalytics(); onData(); }} className="px-4 py-2 rounded-lg border border-white/10 text-sm font-bold text-white/70 hover:bg-white/[0.05]">Load sample data</button>
          <button onClick={() => { if (confirm("Reset all analytics data? This cannot be undone.")) { resetAnalytics(); onData(); } }} className="px-4 py-2 rounded-lg bg-red-500/10 border border-red-500/25 text-sm font-bold text-red-400 hover:bg-red-500/20">Reset analytics</button>
        </div>
        <p className="text-[11px] text-white/35 mt-3 max-w-xl leading-relaxed">Metrics are collected by the built-in tracker per deployment (localStorage). To aggregate across every visitor and device, connect a shared datastore (Vercel KV / Postgres) — the tracker is structured for it.</p>
      </Card>
    </div>
  );
}

/* ============================================================
   Inline icon set (stroke)
   ============================================================ */
function NavIcon({ name }: { name: string }) {
  const p: Record<string, string> = {
    grid: "M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm10 0a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zm10 0a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z",
    users: "M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-1.13a4 4 0 100-8 4 4 0 000 8z",
    film: "M7 4v16M17 4v16M3 8h4m10 0h4M3 16h4m10 0h4M4 4h16a1 1 0 011 1v14a1 1 0 01-1 1H4a1 1 0 01-1-1V5a1 1 0 011-1z",
    user: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z",
    search: "M21 21l-4.35-4.35M11 18a7 7 0 100-14 7 7 0 000 14z",
    cog: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065zM15 12a3 3 0 11-6 0 3 3 0 016 0z",
    eye: "M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z",
    cursor: "M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122",
    bounce: "M13 10V3L4 14h7v7l9-11h-7z",
    clock: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z",
    live: "M12 12a3 3 0 100-6 3 3 0 000 6z M4.5 4.5a10.5 10.5 0 000 15M19.5 4.5a10.5 10.5 0 010 15M7.5 7.5a6 6 0 000 9M16.5 7.5a6 6 0 010 9",
    repeat: "M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15",
    chart: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z",
    sparkle: "M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z",
    refresh: "M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15",
    logout: "M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1",
    collapse: "M11 19l-7-7 7-7m8 14l-7-7 7-7",
    expand: "M13 5l7 7-7 7M5 5l7 7-7 7",
  };
  return (
    <svg className="w-[18px] h-[18px] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d={p[name] || p.grid} />
    </svg>
  );
}
