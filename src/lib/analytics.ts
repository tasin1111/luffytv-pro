/**
 * Lightweight, privacy-friendly analytics — localStorage-backed.
 *
 * WHY LOCALSTORAGE: the app has no writable database on Vercel (SQLite is
 * read-only on serverless), so — exactly like auth & comments — analytics are
 * recorded per-browser in localStorage. Everything here is real data collected
 * from actual usage of THIS deployment in THIS browser. It is structured so it
 * can later be swapped for a server endpoint (POST each event to /api/analytics
 * backed by Vercel KV / Postgres) to aggregate across all visitors & devices.
 *
 * Metrics computed: page views, sessions, bounce rate, returning vs new,
 * average session length, active-now, top pages, referrers, and daily series.
 */

const KEY = "luffytv_analytics";
const SESSION_GAP = 30 * 60 * 1000; // 30 min of inactivity ends a session
const ACTIVE_WINDOW = 5 * 60 * 1000; // "active now" = seen in last 5 min
const MAX_VIEWS = 4000;
const MAX_SESSIONS = 2000;

export interface Session {
  id: string;
  start: number;
  end: number;
  views: number;
  referrer: string;
  entry: string;
}
export interface PageView {
  ts: number;
  path: string;
}
export interface AnalyticsData {
  visitorId: string;
  firstSeen: number;
  lastSeen: number;
  sessions: Session[];
  views: PageView[];
}

function uid(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

function empty(): AnalyticsData {
  const now = Date.now();
  return { visitorId: uid(), firstSeen: now, lastSeen: now, sessions: [], views: [] };
}

export function loadAnalytics(): AnalyticsData {
  if (typeof window === "undefined") return empty();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return empty();
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return empty();
    return {
      visitorId: parsed.visitorId || uid(),
      firstSeen: parsed.firstSeen || Date.now(),
      lastSeen: parsed.lastSeen || Date.now(),
      sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
      views: Array.isArray(parsed.views) ? parsed.views : [],
    };
  } catch {
    return empty();
  }
}

function save(data: AnalyticsData) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {}
}

/** Record a page view. Call on every route change. */
export function trackPageview(path: string) {
  if (typeof window === "undefined") return;
  const data = loadAnalytics();
  const now = Date.now();
  const gap = now - data.lastSeen;
  const cur = data.sessions[data.sessions.length - 1];

  if (cur && gap < SESSION_GAP && data.sessions.length > 0) {
    cur.end = now;
    cur.views += 1;
  } else {
    let referrer = "direct";
    try {
      const r = document.referrer;
      if (r && !r.includes(window.location.host)) referrer = new URL(r).hostname;
    } catch {}
    data.sessions.push({ id: uid(), start: now, end: now, views: 1, referrer, entry: path });
    if (data.sessions.length > MAX_SESSIONS) data.sessions = data.sessions.slice(-MAX_SESSIONS);
  }

  data.views.push({ ts: now, path });
  if (data.views.length > MAX_VIEWS) data.views = data.views.slice(-MAX_VIEWS);
  data.lastSeen = now;
  save(data);
}

const DAY = 86400000;
function dayStart(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export interface AnalyticsMetrics {
  visitorId: string;
  firstSeen: number;
  totalViews: number;
  totalSessions: number;
  bounceRate: number;        // % of sessions with a single page view
  returningSessions: number; // sessions beyond the first
  returningRate: number;     // % returning
  avgSessionSec: number;
  activeNow: number;         // 1 if seen in last 5 min, else 0
  viewsToday: number;
  views7d: number;
  sessionsToday: number;
  sessions7d: number;
  topPaths: { path: string; count: number }[];
  referrers: { source: string; count: number }[];
  daily: { day: number; views: number; sessions: number }[]; // last 14 days
}

export function getMetrics(data: AnalyticsData = loadAnalytics()): AnalyticsMetrics {
  const now = Date.now();
  const totalSessions = data.sessions.length;
  const totalViews = data.views.length;
  const bounced = data.sessions.filter((s) => s.views <= 1).length;
  const bounceRate = totalSessions ? Math.round((bounced / totalSessions) * 100) : 0;
  const returningSessions = Math.max(0, totalSessions - 1);
  const returningRate = totalSessions ? Math.round((returningSessions / totalSessions) * 100) : 0;
  const durations = data.sessions.map((s) => s.end - s.start);
  const avgSessionSec = durations.length ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length / 1000) : 0;
  const activeNow = now - data.lastSeen < ACTIVE_WINDOW ? 1 : 0;

  const todayStart = dayStart(now);
  const weekStart = todayStart - 6 * DAY;
  const viewsToday = data.views.filter((v) => v.ts >= todayStart).length;
  const views7d = data.views.filter((v) => v.ts >= weekStart).length;
  const sessionsToday = data.sessions.filter((s) => s.start >= todayStart).length;
  const sessions7d = data.sessions.filter((s) => s.start >= weekStart).length;

  const pathCount = new Map<string, number>();
  for (const v of data.views) pathCount.set(v.path, (pathCount.get(v.path) || 0) + 1);
  const topPaths = [...pathCount.entries()].map(([path, count]) => ({ path, count })).sort((a, b) => b.count - a.count).slice(0, 8);

  const refCount = new Map<string, number>();
  for (const s of data.sessions) refCount.set(s.referrer, (refCount.get(s.referrer) || 0) + 1);
  const referrers = [...refCount.entries()].map(([source, count]) => ({ source, count })).sort((a, b) => b.count - a.count).slice(0, 6);

  const daily: { day: number; views: number; sessions: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const d0 = todayStart - i * DAY;
    const d1 = d0 + DAY;
    daily.push({
      day: d0,
      views: data.views.filter((v) => v.ts >= d0 && v.ts < d1).length,
      sessions: data.sessions.filter((s) => s.start >= d0 && s.start < d1).length,
    });
  }

  return {
    visitorId: data.visitorId,
    firstSeen: data.firstSeen,
    totalViews,
    totalSessions,
    bounceRate,
    returningSessions,
    returningRate,
    avgSessionSec,
    activeNow,
    viewsToday,
    views7d,
    sessionsToday,
    sessions7d,
    topPaths,
    referrers,
    daily,
  };
}

/** Wipe all analytics (admin action). */
export function resetAnalytics() {
  if (typeof window === "undefined") return;
  try { localStorage.removeItem(KEY); } catch {}
}
