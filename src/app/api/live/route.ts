import { NextResponse } from "next/server";

// ============================================================
// LIVE TV & SPORTS — Multi-Source Aggregator
// Sources: streamfree.app, dami-tv.pro, watchfooty.st, ESPN (schedules),
//          sportsembed.su (embeds)
// ============================================================

const TIMEOUT = 10000;
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";

function makeCtrl() { const c = new AbortController(); setTimeout(() => c.abort(), TIMEOUT); return c; }
async function httpGet(url: string, headers: Record<string, string> = {}): Promise<Response> {
  return fetch(url, { signal: makeCtrl().signal, headers: { "User-Agent": UA, Accept: "application/json", ...headers } });
}

// Sport color mapping
const SPORT_COLORS: Record<string, string> = {
  football: "#22c55e", basketball: "#ef4444", "american-football": "#dc2626", hockey: "#06b6d4",
  baseball: "#3b82f6", tennis: "#a855f7", fight: "#f97316", fighting: "#f97316", "motor-sports": "#eab308",
  racing: "#eab308", rugby: "#10b981", golf: "#84cc16", cricket: "#f59e0b", billiards: "#E63946",
  afl: "#14b8a6", "australian-football": "#14b8a6", darts: "#f43f5e", other: "#6b7280",
  futsal: "#06b6d4", motorsport: "#eab308", cycling: "#84cc16", horse_racing: "#eab308",
  "horse_racing_(uk)": "#eab308", combat: "#f97316", volleyball: "#f59e0b",
};

const SPORT_NAMES: Record<string, string> = {
  football: "Football", basketball: "Basketball", "american-football": "American Football",
  hockey: "Hockey", baseball: "Baseball", tennis: "Tennis", fight: "Fight / MMA / Boxing",
  fighting: "Fight / MMA / Boxing", "motor-sports": "Motor Sports", racing: "Motor Sports",
  motorsport: "Motor Sports", rugby: "Rugby", golf: "Golf", cricket: "Cricket",
  billiards: "Billiards", afl: "AFL", "australian-football": "AFL", darts: "Darts",
  other: "Other", futsal: "Futsal", cycling: "Cycling", horse_racing: "Horse Racing",
  "horse_racing_(uk)": "Horse Racing", combat: "Combat", volleyball: "Volleyball",
};

interface LiveMatch {
  id: string;
  title: string;
  sport: string;
  sportName: string;
  date: number;
  poster: string;
  popular: boolean;
  homeTeam: string;
  awayTeam: string;
  homeBadge: string;
  awayBadge: string;
  isLive: boolean;
  apiSource: string;
  sources: { source: string; id: string }[];
  // Provider-specific fields for stream resolution
  streamKey?: string;
  streamCategory?: string;
  channelCode?: string;
  channelName?: string;
  damitvId?: string;
  damitvName?: string;
  // Multiple DamiTV IDs for same match from different channels (e.g. TNT Sports 1 & 4)
  damitvIds?: { id: string; name: string; embed?: string }[];
  // Pre-built embed URL from DamiTV API (the `iframe` or `embed` field)
  damitvEmbedUrl?: string;
  watchfootyId?: number;
  sportsrcCategory?: string;
  sportsrcId?: string;
  // WatchFooty extended fields
  watchfootyStreams?: { id: string; url: string; quality: string; language: string; isRedirect: boolean; nsfw: boolean; ads: boolean }[];
  league?: string;
  leagueLogo?: string;
  homeScore?: number;
  awayScore?: number;
  currentMinute?: string;
}

interface SportCategory { id: string; name: string; displayName?: string; liveCount?: number; }

// ── SOURCE 1: streamfree.app (PRIMARY — TV channels + M3U8 with CORS CDN!) ──
// StreamFree provides both TV channels (Sky F1, Willow, etc.) and live match streams.
// We also check /api/stream-status/{key} to verify which channels are actually available.
const STREAMFREE_CHANNELS = [
  { key: "skyf1", name: "Sky Sports F1", category: "racing", sport: "motor-sports" },
  { key: "willow", name: "Willow Cricket", category: "cricket", sport: "cricket" },
  { key: "cricketsky", name: "Sky Sports Cricket", category: "cricket", sport: "cricket" },
  { key: "skytennis", name: "Sky Sports Tennis", category: "tennis", sport: "tennis" },
  { key: "skysports", name: "Sky Sports Main Event", category: "soccer", sport: "football" },
  { key: "skysportsfootball", name: "Sky Sports Football", category: "football", sport: "football" },
  { key: "skysportsnews", name: "Sky Sports News", category: "news", sport: "other" },
  { key: "skysportsgolf", name: "Sky Sports Golf", category: "golf", sport: "golf" },
  { key: "skysportsaction", name: "Sky Sports Action", category: "soccer", sport: "football" },
  { key: "skysportsarena", name: "Sky Sports Arena", category: "soccer", sport: "football" },
  { key: "btsport", name: "BT Sport", category: "soccer", sport: "football" },
  { key: "tntsports1", name: "TNT Sports 1", category: "soccer", sport: "football" },
  { key: "espn", name: "ESPN", category: "soccer", sport: "football" },
  { key: "cbc", name: "CBC", category: "soccer", sport: "football" },
  { key: "bbc", name: "BBC Sport", category: "soccer", sport: "football" },
  { key: "supersport", name: "SuperSport", category: "soccer", sport: "football" },
];

// Build a quick lookup map: streamKey → correct category
const SF_KEY_CATEGORY_MAP: Record<string, string> = {};
for (const ch of STREAMFREE_CHANNELS) { SF_KEY_CATEGORY_MAP[ch.key] = ch.category; }

// Smart StreamFree category resolver:
// 1. Check known channel mapping first (most accurate)
// 2. If API category is generic "sports", detect from channel name
// 3. Fall back to API category
function resolveStreamfreeCategory(streamKey: string, apiCategory: string, channelName: string): string {
  // Priority 1: Known channel mapping
  if (SF_KEY_CATEGORY_MAP[streamKey]) return SF_KEY_CATEGORY_MAP[streamKey];

  // Priority 2: If API says "sports", detect from the channel name
  if (apiCategory === "sports" || apiCategory === "other") {
    const name = (channelName || "").toLowerCase();
    if (name.includes("cricket")) return "cricket";
    if (name.includes("tennis")) return "tennis";
    if (name.includes("f1") || name.includes("racing") || name.includes("rally") || name.includes("motor")) return "racing";
    if (name.includes("golf")) return "golf";
    if (name.includes("football") || name.includes("soccer")) return "football";
    if (name.includes("basketball") || name.includes("nba")) return "basketball";
    if (name.includes("baseball") || name.includes("mlb")) return "baseball";
    if (name.includes("hockey") || name.includes("nhl")) return "hockey";
    if (name.includes("fight") || name.includes("ufc") || name.includes("boxing")) return "combat";
    if (name.includes("rugby")) return "rugby";
    if (name.includes("dart")) return "darts";
    if (name.includes("news")) return "news";
  }

  // Priority 3: Use API category as-is
  return apiCategory;
}

async function fetchStreamfreeChannelStatus(): Promise<LiveMatch[]> {
  // Check availability of known TV channels via /api/stream-status/{key}
  const channels: LiveMatch[] = [];
  const results = await Promise.allSettled(
    STREAMFREE_CHANNELS.map(async (ch) => {
      try {
        const res = await httpGet(`https://streamfree.app/api/stream-status/${ch.key}`);
        if (!res.ok) return null;
        const data = await res.json();
        if (!data.available) return null;
        // Find best available quality
        const qualities = data.qualities || {};
        const bestQuality = qualities["1080p"] ? "1080p" : qualities["720p"] ? "720p" : qualities["540p"] ? "540p" : "1080p";
        return {
          id: `sf-ch-${ch.key}`,
          title: ch.name,
          sport: ch.sport,
          sportName: SPORT_NAMES[ch.sport] || ch.name,
          date: 0,
          poster: "",
          popular: false,
          homeTeam: "",
          awayTeam: "",
          homeBadge: "",
          awayBadge: "",
          isLive: true,
          apiSource: "streamfree",
          sources: [],
          streamKey: ch.key,
          streamCategory: ch.category,
          channelName: ch.name,
          channelCode: ch.category,
        } as LiveMatch;
      } catch { return null; }
    })
  );
  for (const r of results) {
    if (r.status === "fulfilled" && r.value) channels.push(r.value);
  }
  return channels;
}

async function fetchStreamfreeStreams(): Promise<LiveMatch[]> {
  try {
    const res = await httpGet("https://streamfree.app/streams");
    if (!res.ok) return [];
    const data = await res.json();
    if (!data || typeof data !== "object") return [];

    const root = data.streams && typeof data.streams === "object" ? data.streams : data;
    const matches: LiveMatch[] = [];
    for (const [category, streams] of Object.entries(root)) {
      if (!Array.isArray(streams)) continue;
      for (const s of streams as any[]) {
        const sport = mapCategoryToSport(s.category || category);
        const homeTeam = s.home_team || s.team1?.name || extractTeam(s.title || s.name || "", 0);
        const awayTeam = s.away_team || s.team2?.name || extractTeam(s.title || s.name || "", 1);
        const homeBadge = s.home_logo || s.home_badge || s.team1?.logo || "";
        const awayBadge = s.away_logo || s.away_badge || s.team2?.logo || "";
        const ts = s.match_timestamp ? s.match_timestamp * 1000 :
                   s.starts_at ? s.starts_at * 1000 :
                   s.date ? new Date(s.date).getTime() : 0;

        // Determine if this is a TV channel or a real match
        const isChannel = !homeTeam && !awayTeam && !ts;

        // IMPORTANT: Resolve the correct StreamFree category for embed URLs.
        // The API may return a generic "sports" category, but the embed URL needs
        // the specific sport category (cricket, tennis, racing, etc.).
        const streamKey = s.stream_key || s.key || s.id || "";
        const rawApiCategory = category || s.category;
        const resolvedCategory = resolveStreamfreeCategory(streamKey, rawApiCategory, s.title || s.name || "");

        matches.push({
          id: `sf-${streamKey || Math.random().toString(36).slice(2)}`,
          title: s.title || s.name || formatTitle(streamKey),
          sport: isChannel ? "other" : sport,
          sportName: isChannel ? "TV Channel" : (SPORT_NAMES[sport] || capitalize(s.category || category)),
          date: ts,
          poster: s.poster || s.image || s.thumbnail_url ? `https://streamfree.app${s.thumbnail_url}` : "",
          popular: !isChannel && (s.featured || s.popular || false),
          homeTeam,
          awayTeam,
          homeBadge,
          awayBadge,
          isLive: s.live || s.is_live || s.status === "live" || isChannel || false,
          apiSource: "streamfree",
          sources: [],
          streamKey,
          // Use RESOLVED category (sport-specific, not generic "sports")
          streamCategory: resolvedCategory,
          channelName: isChannel ? (s.title || s.name || "") : undefined,
          channelCode: isChannel ? resolvedCategory : undefined,
        });
      }
    }
    return matches;
  } catch { return []; }
}

// ── SOURCE 2: dami-tv.pro (ONLY actual live/upcoming matches — no 24/7 channels) ──
// DamiTV has a lot of 24/7 channels (South Park, COWS, etc.) that flood the match list.
// We ONLY want actual live sports matches here. TV channels go to fetchDamiTVChannels().
async function fetchDamiTVStreams(): Promise<LiveMatch[]> {
  try {
    const res = await httpGet("https://dami-tv.pro/papi/api/streams");
    if (!res.ok) return [];
    const data = await res.json();
    if (!data.streams || !Array.isArray(data.streams)) return [];

    const matches: LiveMatch[] = [];
    for (const category of data.streams) {
      if (!Array.isArray(category.streams)) continue;
      // Skip 24/7 stream categories entirely — those go to TV Channels
      const catName = (category.category || "").toLowerCase();
      if (catName.includes("24/7") || catName === "24-7-streams") continue;

      for (const s of category.streams) {
        // Skip 24/7 always-live channels — they are NOT real matches
        if (s.always_live === 1) continue;
        // Skip ended matches — no point showing them as regular matches
        if (s.status === "ended" || s.status === "finished") continue;
        // Only include actual live or upcoming sports matches
        const isLive = s.status === "live" || s.is_live === true;
        const isUpcoming = s.status === "upcoming" || s.status === "pre";
        if (!isLive && !isUpcoming) continue;

        const sport = mapCategoryToSport(s.category_name || category.category || "");
        const homeTeam = s.teams?.home?.name || extractTeam(s.name || "", 0);
        const awayTeam = s.teams?.away?.name || extractTeam(s.name || "", 1);
        // DamiTV badges: can be full URLs (https://r2.thesportsdb.com/...) or
        // encoded strings (GwZg7AZpYEZgHC...) that need prefixing with dami-tv.pro/spimg/proxy/
        const rawHomeBadge = s.teams?.home?.badge || "";
        const rawAwayBadge = s.teams?.away?.badge || "";
        const homeBadge = rawHomeBadge && !rawHomeBadge.startsWith("http")
          ? `https://dami-tv.pro/spimg/proxy/${rawHomeBadge}.webp`
          : rawHomeBadge;
        const awayBadge = rawAwayBadge && !rawAwayBadge.startsWith("http")
          ? `https://dami-tv.pro/spimg/proxy/${rawAwayBadge}.webp`
          : rawAwayBadge;
        const ts = s.starts_at ? s.starts_at * 1000 : 0;
        const dId = s.uri_name || s.id || "";
        const dName = s.name || "";
        // Capture pre-built embed URLs from the DamiTV API — these are the correct URLs
        const dEmbedUrl = s.iframe || s.embed || "";
        // Capture DamiTV sources array (PPV embed sources)
        const dSources: { source: string; id: string }[] = Array.isArray(s.sources)
          ? s.sources.map((src: any) => ({ source: `damitv-${src.source || "default"}`, id: src.id || src.embed || "" }))
          : [];
        matches.push({
          id: `dami-${dId || Math.random().toString(36).slice(2)}`,
          title: s.name || s.title || formatTitle(s.id || ""),
          sport,
          sportName: SPORT_NAMES[sport] || capitalize(s.category_name || category.category || ""),
          date: ts,
          poster: s.poster || "",
          popular: isLive, // Only live matches are popular
          homeTeam,
          awayTeam,
          homeBadge,
          awayBadge,
          isLive,
          apiSource: "damitv",
          sources: dSources,
          damitvId: dId,
          damitvName: dName,
          // Pre-built embed URL from DamiTV API (iframe/embed field)
          damitvEmbedUrl: dEmbedUrl,
          // Initialize damitvIds with this entry — will accumulate during merge
          damitvIds: dId ? [{ id: dId, name: dName, embed: dEmbedUrl }] : [],
        });
      }
    }
    return matches;
  } catch { return []; }
}

// ── SOURCE 2b: dami-tv.pro TV channels (24/7 streams + live channels) ──
// ONLY returns always-live TV channels (24/7 South Park, Rally TV, etc.)
// and channels that don't have real team matchups. These go in the TV Channels section.
async function fetchDamiTVChannels(): Promise<LiveMatch[]> {
  try {
    const res = await httpGet("https://dami-tv.pro/papi/api/streams");
    if (!res.ok) return [];
    const data = await res.json();
    if (!data.streams || !Array.isArray(data.streams)) return [];

    const channels: LiveMatch[] = [];
    for (const category of data.streams) {
      if (!Array.isArray(category.streams)) continue;
      for (const s of category.streams) {
        // ONLY include always-live channels and 24/7 streams
        // Regular live/upcoming matches are handled by fetchDamiTVStreams()
        const isAlwaysLive = s.always_live === 1;
        const catName = (s.category_name || category.category || "").toLowerCase();
        const is247Category = catName.includes("24/7") || catName === "24-7-streams";
        if (!isAlwaysLive && !is247Category) continue;

        const sport = mapCategoryToSport(s.category_name || category.category || "");
        channels.push({
          id: `dami-ch-${s.id || s.uri_name || Math.random().toString(36).slice(2)}`,
          title: s.name || s.title || formatTitle(s.id || ""),
          sport: is247Category ? "other" : sport,
          sportName: is247Category ? "TV Channel" : (SPORT_NAMES[sport] || capitalize(s.category_name || "")),
          date: 0, // TV channels have no specific match time
          poster: s.poster || "",
          popular: false, // TV channels are not "popular matches"
          homeTeam: "",
          awayTeam: "",
          homeBadge: s.poster || "",
          awayBadge: "",
          isLive: true, // Always-live channels are always live
          apiSource: "damitv",
          sources: [],
          damitvId: s.uri_name || s.id || "",
          damitvName: s.name || "",
          channelName: s.name || "",
          channelCode: s.category_name || category.category || "",
        });
      }
    }
    return channels;
  } catch { return []; }
}

// ── SOURCE 4: watchfooty.st (rich match data + embed URLs + scores + streams) ──
const WF_BASE = "https://api.watchfooty.st";

function mapWfSport(sport: string): string {
  const m: Record<string, string> = {
    football: "football", basketball: "basketball", "american-football": "american-football",
    hockey: "hockey", baseball: "baseball", tennis: "tennis", fighting: "fight",
    fight: "fight", motorsport: "motor-sports", "motor-sports": "motor-sports",
    racing: "motor-sports", rugby: "rugby", golf: "golf", cricket: "cricket",
    afl: "afl", "australian-football": "afl", darts: "darts", futsal: "futsal",
    cycling: "cycling", horse_racing: "horse_racing", combat: "fight",
    volleyball: "volleyball", billiards: "billiards",
  };
  return m[sport?.toLowerCase()] || sport || "other";
}

async function fetchWatchfootyLive(): Promise<LiveMatch[]> {
  try {
    const res = await httpGet(`${WF_BASE}/api/v1/matches/live`);
    if (!res.ok) return [];
    const data = await res.json();
    if (!Array.isArray(data)) return [];

    return data.map((raw: any): LiveMatch => {
      const m = deepToPrimitive(raw); // Convert ALL {value, displayValue} objects to primitives
      const sport = mapWfSport(m.sport || "other");
      const streams = Array.isArray(m.streams) ? m.streams.map((s: any) => ({
        id: String(s.id || ""),
        url: s.url || "",
        quality: s.quality || "hd",
        language: s.language || "english",
        isRedirect: s.isRedirect || false,
        nsfw: s.nsfw || false,
        ads: s.ads || false,
      })) : [];
      return {
        id: `wf-${m.matchId || Math.random()}`,
        title: m.title || "Match",
        sport,
        sportName: SPORT_NAMES[sport] || m.sport || capitalize(sport),
        date: m.date ? new Date(m.date).getTime() : (m.timestamp ? m.timestamp * 1000 : 0),
        poster: m.poster ? (m.poster.startsWith("http") ? m.poster : `${WF_BASE}${m.poster}`) : "",
        popular: true,
        homeTeam: m.teams?.home?.name || "",
        awayTeam: m.teams?.away?.name || "",
        homeBadge: m.teams?.home?.logoUrl ? (m.teams.home.logoUrl.startsWith("http") ? m.teams.home.logoUrl : `${WF_BASE}${m.teams.home.logoUrl}`) : (m.teams?.home?.logo ? (m.teams.home.logo.startsWith("http") ? m.teams.home.logo : `${WF_BASE}${m.teams.home.logo}`) : ""),
        awayBadge: m.teams?.away?.logoUrl ? (m.teams.away.logoUrl.startsWith("http") ? m.teams.away.logoUrl : `${WF_BASE}${m.teams.away.logoUrl}`) : (m.teams?.away?.logo ? (m.teams.away.logo.startsWith("http") ? m.teams.away.logo : `${WF_BASE}${m.teams.away.logo}`) : ""),
        isLive: true, // This endpoint ONLY returns matches that are currently live
        apiSource: "watchfooty",
        sources: [],
        watchfootyId: m.matchId,
        watchfootyStreams: streams,
        league: m.league || "",
        leagueLogo: m.leagueLogo ? (m.leagueLogo.startsWith("http") ? m.leagueLogo : `${WF_BASE}${m.leagueLogo}`) : "",
        homeScore: toPrimitive(m.scores?.home) ?? undefined,
        awayScore: toPrimitive(m.scores?.away) ?? undefined,
        currentMinute: toPrimitive(m.currentMinute) || undefined,
      };
    });
  } catch { return []; }
}

async function fetchWatchfootyAll(): Promise<LiveMatch[]> {
  try {
    const res = await httpGet(`${WF_BASE}/api/v1/matches/all`);
    if (!res.ok) return [];
    const data = await res.json();
    if (!Array.isArray(data)) return [];

    return data.map((raw: any): LiveMatch => {
      const m = deepToPrimitive(raw); // Convert ALL {value, displayValue} objects to primitives
      const sport = mapWfSport(m.sport || "other");
      const streams = Array.isArray(m.streams) ? m.streams.map((s: any) => ({
        id: String(s.id || ""),
        url: s.url || "",
        quality: s.quality || "hd",
        language: s.language || "english",
        isRedirect: s.isRedirect || false,
        nsfw: s.nsfw || false,
        ads: s.ads || false,
      })) : [];
      return {
        id: `wf-${m.matchId || Math.random()}`,
        title: m.title || "Match",
        sport,
        sportName: SPORT_NAMES[sport] || m.sport || capitalize(sport),
        date: m.date ? new Date(m.date).getTime() : (m.timestamp ? m.timestamp * 1000 : 0),
        poster: m.poster ? (m.poster.startsWith("http") ? m.poster : `${WF_BASE}${m.poster}`) : "",
        popular: false,
        homeTeam: m.teams?.home?.name || "",
        awayTeam: m.teams?.away?.name || "",
        homeBadge: m.teams?.home?.logoUrl ? (m.teams.home.logoUrl.startsWith("http") ? m.teams.home.logoUrl : `${WF_BASE}${m.teams.home.logoUrl}`) : (m.teams?.home?.logo ? (m.teams.home.logo.startsWith("http") ? m.teams.home.logo : `${WF_BASE}${m.teams.home.logo}`) : ""),
        awayBadge: m.teams?.away?.logoUrl ? (m.teams.away.logoUrl.startsWith("http") ? m.teams.away.logoUrl : `${WF_BASE}${m.teams.away.logoUrl}`) : (m.teams?.away?.logo ? (m.teams.away.logo.startsWith("http") ? m.teams.away.logo : `${WF_BASE}${m.teams.away.logo}`) : ""),
        isLive: m.status === "in" || m.status === "live" || m.status === "1" || m.status === "2" || m.status === "HT" || m.status === "Q1" || m.status === "Q2" || m.status === "Q3" || m.status === "Q4" || m.status === "LIVE",
        apiSource: "watchfooty",
        sources: [],
        watchfootyId: m.matchId,
        watchfootyStreams: streams,
        league: m.league || "",
        leagueLogo: m.leagueLogo ? (m.leagueLogo.startsWith("http") ? m.leagueLogo : `${WF_BASE}${m.leagueLogo}`) : "",
        homeScore: toPrimitive(m.scores?.home) ?? undefined,
        awayScore: toPrimitive(m.scores?.away) ?? undefined,
        currentMinute: toPrimitive(m.currentMinute) || undefined,
      };
    });
  } catch { return []; }
}

async function fetchWatchfootyPopularLive(): Promise<LiveMatch[]> {
  try {
    const res = await httpGet(`${WF_BASE}/api/v1/matches/popular/live`);
    if (!res.ok) return [];
    const data = await res.json();
    if (!Array.isArray(data)) return [];

    return data.map((raw: any): LiveMatch => {
      const m = deepToPrimitive(raw); // Convert ALL {value, displayValue} objects to primitives
      const sport = mapWfSport(m.sport || "other");
      const streams = Array.isArray(m.streams) ? m.streams.map((s: any) => ({
        id: String(s.id || ""),
        url: s.url || "",
        quality: s.quality || "hd",
        language: s.language || "english",
        isRedirect: s.isRedirect || false,
        nsfw: s.nsfw || false,
        ads: s.ads || false,
      })) : [];
      return {
        id: `wf-${m.matchId || Math.random()}`,
        title: m.title || "Match",
        sport,
        sportName: SPORT_NAMES[sport] || m.sport || capitalize(sport),
        date: m.date ? new Date(m.date).getTime() : (m.timestamp ? m.timestamp * 1000 : 0),
        poster: m.poster ? (m.poster.startsWith("http") ? m.poster : `${WF_BASE}${m.poster}`) : "",
        popular: true,
        homeTeam: m.teams?.home?.name || "",
        awayTeam: m.teams?.away?.name || "",
        homeBadge: m.teams?.home?.logoUrl ? (m.teams.home.logoUrl.startsWith("http") ? m.teams.home.logoUrl : `${WF_BASE}${m.teams.home.logoUrl}`) : (m.teams?.home?.logo ? (m.teams.home.logo.startsWith("http") ? m.teams.home.logo : `${WF_BASE}${m.teams.home.logo}`) : ""),
        awayBadge: m.teams?.away?.logoUrl ? (m.teams.away.logoUrl.startsWith("http") ? m.teams.away.logoUrl : `${WF_BASE}${m.teams.away.logoUrl}`) : (m.teams?.away?.logo ? (m.teams.away.logo.startsWith("http") ? m.teams.away.logo : `${WF_BASE}${m.teams.away.logo}`) : ""),
        isLive: true, // This endpoint ONLY returns popular LIVE matches
        apiSource: "watchfooty",
        sources: [],
        watchfootyId: m.matchId,
        watchfootyStreams: streams,
        league: m.league || "",
        leagueLogo: m.leagueLogo ? (m.leagueLogo.startsWith("http") ? m.leagueLogo : `${WF_BASE}${m.leagueLogo}`) : "",
        homeScore: toPrimitive(m.scores?.home) ?? undefined,
        awayScore: toPrimitive(m.scores?.away) ?? undefined,
        currentMinute: toPrimitive(m.currentMinute) || undefined,
      };
    });
  } catch { return []; }
}

// ── Fetch WatchFooty sports list ──
async function fetchWatchfootySports(): Promise<SportCategory[]> {
  try {
    const res = await httpGet(`${WF_BASE}/api/v1/sports`);
    if (!res.ok) return [];
    const data = await res.json();
    if (!Array.isArray(data)) return [];
    return data.map((s: any) => ({
      id: mapWfSport(s.name || s.id || ""),
      name: SPORT_NAMES[mapWfSport(s.name || s.id || "")] || s.displayName || capitalize(s.name || ""),
      displayName: s.displayName || s.name || "",
    }));
  } catch { return []; }
}

// ── Fetch WatchFooty top leagues ──
async function fetchWatchfootyTopLeagues(sport?: string): Promise<string[]> {
  try {
    const url = sport
      ? `${WF_BASE}/api/v1/top-leagues/${encodeURIComponent(sport)}`
      : `${WF_BASE}/api/v1/top-leagues`;
    const res = await httpGet(url);
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data.map(String) : [];
  } catch { return []; }
}

// ── Fetch WatchFooty top teams ──
async function fetchWatchfootyTopTeams(sport?: string): Promise<string[]> {
  try {
    const url = sport
      ? `${WF_BASE}/api/v1/top-teams/${encodeURIComponent(sport)}`
      : `${WF_BASE}/api/v1/top-teams`;
    const res = await httpGet(url);
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data.map(String) : [];
  } catch { return []; }
}

// ── Fetch WatchFooty popular matches ──
async function fetchWatchfootyPopular(): Promise<LiveMatch[]> {
  try {
    const res = await httpGet(`${WF_BASE}/api/v1/matches/popular`);
    if (!res.ok) return [];
    const data = await res.json();
    if (!Array.isArray(data)) return [];

    return data.map((raw: any): LiveMatch => {
      const m = deepToPrimitive(raw); // Convert ALL {value, displayValue} objects to primitives
      const sport = mapWfSport(m.sport || "other");
      const streams = Array.isArray(m.streams) ? m.streams.map((s: any) => ({
        id: String(s.id || ""),
        url: s.url || "",
        quality: s.quality || "hd",
        language: s.language || "english",
        isRedirect: s.isRedirect || false,
        nsfw: s.nsfw || false,
        ads: s.ads || false,
      })) : [];
      return {
        id: `wf-${m.matchId || Math.random()}`,
        title: m.title || "Match",
        sport,
        sportName: SPORT_NAMES[sport] || m.sport || capitalize(sport),
        date: m.date ? new Date(m.date).getTime() : (m.timestamp ? m.timestamp * 1000 : 0),
        poster: m.poster ? (m.poster.startsWith("http") ? m.poster : `${WF_BASE}${m.poster}`) : "",
        popular: true,
        homeTeam: m.teams?.home?.name || "",
        awayTeam: m.teams?.away?.name || "",
        homeBadge: m.teams?.home?.logoUrl ? (m.teams.home.logoUrl.startsWith("http") ? m.teams.home.logoUrl : `${WF_BASE}${m.teams.home.logoUrl}`) : (m.teams?.home?.logo ? (m.teams.home.logo.startsWith("http") ? m.teams.home.logo : `${WF_BASE}${m.teams.home.logo}`) : ""),
        awayBadge: m.teams?.away?.logoUrl ? (m.teams.away.logoUrl.startsWith("http") ? m.teams.away.logoUrl : `${WF_BASE}${m.teams.away.logoUrl}`) : (m.teams?.away?.logo ? (m.teams.away.logo.startsWith("http") ? m.teams.away.logo : `${WF_BASE}${m.teams.away.logo}`) : ""),
        isLive: m.status === "in" || m.status === "live" || m.status === "1" || m.status === "2" || m.status === "HT" || m.status === "Q1" || m.status === "Q2" || m.status === "Q3" || m.status === "Q4" || m.status === "LIVE",
        apiSource: "watchfooty",
        sources: [],
        watchfootyId: m.matchId,
        watchfootyStreams: streams,
        league: m.league || "",
        leagueLogo: m.leagueLogo ? (m.leagueLogo.startsWith("http") ? m.leagueLogo : `${WF_BASE}${m.leagueLogo}`) : "",
        homeScore: toPrimitive(m.scores?.home) ?? undefined,
        awayScore: toPrimitive(m.scores?.away) ?? undefined,
        currentMinute: toPrimitive(m.currentMinute) || undefined,
      };
    });
  } catch { return []; }
}

// ── SOURCE 5: streamed.pk (Sports embed aggregation) ──
// StreamedPK provides live match embeds from multiple server sources (admin, alpha, bravo, etc.)
async function fetchStreamedPK(): Promise<LiveMatch[]> {
  try {
    const res = await httpGet("https://streamed.pk/api/matches/live");
    if (!res.ok) return [];
    const data = await res.json();
    if (!Array.isArray(data)) return [];

    return data.map((match: any): LiveMatch => {
      const catName = match.category || "other";
      const sport = mapCategoryToSport(catName);
      const homeTeam = match.teams?.home?.name || extractTeam(match.title || "", 0);
      const awayTeam = match.teams?.away?.name || extractTeam(match.title || "", 1);
      const homeBadge = match.teams?.home?.badge ? `https://streamed.pk/api/images/proxy/${match.teams.home.badge}` : "";
      const awayBadge = match.teams?.away?.badge ? `https://streamed.pk/api/images/proxy/${match.teams.away.badge}` : "";

      // Build sources array from StreamedPK sources
      const sources: { source: string; id: string }[] = (match.sources || []).map((s: any) => ({
        source: `streamed-${s.source}`,
        id: s.id || "",
      }));

      return {
        id: `sp-${match.id}`,
        title: match.title || "Live Match",
        sport,
        sportName: SPORT_NAMES[sport] || capitalize(catName),
        date: match.date ? new Date(match.date).getTime() : 0,
        poster: match.poster ? `https://streamed.pk${match.poster}` : "",
        popular: match.popular || false,
        homeTeam,
        awayTeam,
        homeBadge,
        awayBadge,
        isLive: true,
        apiSource: "streamedpk",
        sources,
      };
    });
  } catch { return []; }
}

// ── SOURCE 6: ESPN (schedules + scores) ──
async function fetchESPNMatches(): Promise<LiveMatch[]> {
  const espnSports = [
    { sport: "basketball", league: "nba" },
    { sport: "football", league: "nfl" },
    { sport: "soccer", league: "eng.1" },
    { sport: "hockey", league: "nhl" },
    { sport: "baseball", league: "mlb" },
  ];
  const matches: LiveMatch[] = [];
  const results = await Promise.allSettled(
    espnSports.map(async (espn) => {
      try {
        const res = await httpGet(`https://site.api.espn.com/apis/site/v2/sports/${espn.sport}/${espn.league}/scoreboard`);
        if (!res.ok) return [];
        const data = await res.json();
        return (data.events || []).map((e: any): LiveMatch => {
          const comp = e.competitions?.[0];
          const home = comp?.competitors?.find((c: any) => c.homeAway === "home");
          const away = comp?.competitors?.find((c: any) => c.homeAway === "away");
          const sport = espn.sport === "soccer" ? "football" : espn.sport;
          return {
            id: `espn-${e.id}`,
            title: e.name || "Match",
            sport,
            sportName: SPORT_NAMES[sport] || capitalize(sport),
            date: e.date ? new Date(e.date).getTime() : 0,
            poster: "",
            popular: false,
            homeTeam: home?.team?.displayName || "",
            awayTeam: away?.team?.displayName || "",
            homeBadge: home?.team?.logo || "",
            awayBadge: away?.team?.logo || "",
            isLive: comp?.status?.type?.name === "in" || false,
            apiSource: "espn",
            sources: [],
            homeScore: home?.score ? parseInt(home.score) : undefined,
            awayScore: away?.score ? parseInt(away.score) : undefined,
          };
        });
      } catch { return []; }
    })
  );
  for (const r of results) {
    if (r.status === "fulfilled" && Array.isArray(r.value)) matches.push(...r.value);
  }
  return matches;
}

// ── SOURCE 7: sportsembed.su (embed URLs for live sports) ──
async function fetchSportsembedSu(): Promise<LiveMatch[]> {
  try {
    const res = await httpGet("https://sportsembed.su/api/events/live", { Referer: "https://sportsembed.su/" });
    if (!res.ok) return [];
    const data = await res.json();
    if (!Array.isArray(data)) return [];

    return data.map((ev: any): LiveMatch => {
      const sport = mapCategoryToSport(ev.sport || ev.category || "other");
      return {
        id: `se-${ev.id || Math.random()}`,
        title: ev.title || ev.name || "Live Event",
        sport,
        sportName: SPORT_NAMES[sport] || capitalize(ev.sport || "Sports"),
        date: ev.date ? new Date(ev.date).getTime() : (ev.start_time ? ev.start_time * 1000 : 0),
        poster: ev.poster || ev.image || "",
        popular: ev.featured || false,
        homeTeam: ev.home_team || ev.teams?.home?.name || extractTeam(ev.title || "", 0),
        awayTeam: ev.away_team || ev.teams?.away?.name || extractTeam(ev.title || "", 1),
        homeBadge: ev.home_logo || ev.teams?.home?.logo || "",
        awayBadge: ev.away_logo || ev.teams?.away?.logo || "",
        isLive: ev.live || ev.is_live || ev.status === "live" || ev.status === "in" || false,
        apiSource: "sportsembed",
        sources: [],
        sportsrcCategory: ev.category || ev.sport || "",
        sportsrcId: ev.id || "",
      };
    });
  } catch { return []; }
}

// ── SOURCE 8: VIPStreamed / StreamedTV (api.vipstreamed.live) ──
async function fetchVIPStreamed(): Promise<LiveMatch[]> {
  try {
    const res = await httpGet("https://api.vipstreamed.live/api/streams");
    if (!res.ok) return [];
    const data = await res.json();
    const matches: LiveMatch[] = [];

    // Handle array format
    const streamList = data.streams || data.data || data.events || (Array.isArray(data) ? data : null);
    if (Array.isArray(streamList)) {
      for (const s of streamList as any[]) {
        const title = s.name || s.title || `${s.homeTeam || "TBD"} vs ${s.awayTeam || "TBD"}`;
        const catName = s.category || s.sport || "other";
        const sport = mapCategoryToSport(catName);
        const matchId = String(s.id || s.matchId || Math.random().toString(36).slice(2));
        const embedUrl = s.embed || s.embedUrl || s.url || s.link || "";

        matches.push({
          id: `vs-${matchId}`,
          title,
          sport,
          sportName: SPORT_NAMES[sport] || capitalize(catName),
          date: s.date || s.startTime ? new Date(s.date || s.startTime).getTime() : 0,
          poster: s.poster || s.thumbnail || s.image || "",
          popular: s.featured || s.popular || false,
          homeTeam: s.teams?.home?.name || s.homeTeam || extractTeam(title, 0),
          awayTeam: s.teams?.away?.name || s.awayTeam || extractTeam(title, 1),
          homeBadge: s.teams?.home?.logo || s.homeLogo || s.homeBadge || "",
          awayBadge: s.teams?.away?.logo || s.awayLogo || s.awayBadge || "",
          isLive: s.status === "live" || s.is_live || false,
          apiSource: "vipstreamed",
          sources: embedUrl ? [{ source: "vipstreamed", id: embedUrl }] : [],
        });
      }
    }

    // Handle grouped format { category: [streams] }
    if (typeof data.streams === "object" && !Array.isArray(data.streams)) {
      for (const [cat, streams] of Object.entries(data.streams)) {
        if (!Array.isArray(streams)) continue;
        for (const s of streams as any[]) {
          const title = s.name || s.title || "Unknown Match";
          const catName = s.category || cat || "other";
          const sport = mapCategoryToSport(catName);
          const matchId = String(s.id || s.matchId || Math.random().toString(36).slice(2));
          const embedUrl = s.embed || s.embedUrl || s.url || s.link || "";

          matches.push({
            id: `vs-${matchId}`,
            title,
            sport,
            sportName: SPORT_NAMES[sport] || capitalize(catName),
            date: 0,
            poster: s.poster || "",
            popular: false,
            homeTeam: s.teams?.home?.name || s.homeTeam || extractTeam(title, 0),
            awayTeam: s.teams?.away?.name || s.awayTeam || extractTeam(title, 1),
            homeBadge: s.teams?.home?.logo || s.homeLogo || "",
            awayBadge: s.teams?.away?.logo || s.awayLogo || "",
            isLive: s.status === "live" || false,
            apiSource: "vipstreamed",
            sources: embedUrl ? [{ source: "vipstreamed", id: embedUrl }] : [],
          });
        }
      }
    }

    return matches;
  } catch { return []; }
}

// ── SOURCE 9: PPV.to (api.ppv.to/api/streams) ──
async function fetchPPVto(): Promise<LiveMatch[]> {
  try {
    const res = await httpGet("https://api.ppv.to/api/streams");
    if (!res.ok) return [];
    const data = await res.json();
    const matches: LiveMatch[] = [];

    // PPV.to API format: { success, streams: [{ category, id, always_live, streams: [{ name, poster, uri_name, embed, ... }] }] }
    const streamList = data.streams || data.data || data.events || (Array.isArray(data) ? data : null);
    if (Array.isArray(streamList)) {
      for (const item of streamList as any[]) {
        // Check if this is a category group with nested streams (PPV.to format)
        if (item.streams && Array.isArray(item.streams) && item.category) {
          const catName = item.category || "other";
          const isAlwaysLive = item.always_live === true || item.always_live === 1;
          for (const s of item.streams) {
            const title = s.name || s.title || `${s.homeTeam || "TBD"} vs ${s.awayTeam || "TBD"}`;
            const sport = mapCategoryToSport(catName);
            const matchId = String(s.id || s.uri_name || Math.random().toString(36).slice(2));
            const embedUrl = s.embed || s.iframe || s.embedUrl || s.url || s.link || "";
            const ts = s.starts_at ? s.starts_at * 1000 : (s.date ? new Date(s.date).getTime() : 0);

            // Build sources: main iframe + any substreams (additional servers)
            const ppvSources: { source: string; id: string }[] = [];
            if (embedUrl) {
              ppvSources.push({ source: "ppv-to", id: embedUrl });
            }
            // Add substreams as additional server options
            if (Array.isArray(s.substreams)) {
              for (const sub of s.substreams) {
                const subEmbed = sub.iframe || sub.embed || sub.embedUrl || sub.url || sub.link || "";
                if (subEmbed && !ppvSources.some(ps => ps.id === subEmbed)) {
                  ppvSources.push({ source: "ppv-to", id: subEmbed });
                }
              }
            }
            // Also add the tag/source_tag as a label reference
            const tagLabel = s.tag || s.source_tag || "";

            matches.push({
              id: `ppv-${matchId}`,
              title,
              sport,
              sportName: SPORT_NAMES[sport] || capitalize(catName),
              date: ts,
              poster: s.poster || s.thumbnail || s.image || "",
              popular: s.featured || s.popular || false,
              homeTeam: s.teams?.home?.name || s.homeTeam || extractTeam(title, 0),
              awayTeam: s.teams?.away?.name || s.awayTeam || extractTeam(title, 1),
              homeBadge: s.teams?.home?.logo || s.homeLogo || s.homeBadge || "",
              awayBadge: s.teams?.away?.logo || s.awayLogo || s.awayBadge || "",
              isLive: s.status === "live" || s.is_live || isAlwaysLive,
              apiSource: "ppv-to",
              sources: ppvSources,
            });
          }
        } else {
          // Flat format — each item is a match directly
          const title = item.name || item.title || `${item.homeTeam || "TBD"} vs ${item.awayTeam || "TBD"}`;
          const catName = item.category || item.sport || "other";
          const sport = mapCategoryToSport(catName);
          const matchId = String(item.id || item.matchId || Math.random().toString(36).slice(2));
          const embedUrl = item.embed || item.embedUrl || item.url || item.link || "";

          matches.push({
            id: `ppv-${matchId}`,
            title,
            sport,
            sportName: SPORT_NAMES[sport] || capitalize(catName),
            date: item.date || item.startTime ? new Date(item.date || item.startTime).getTime() : 0,
            poster: item.poster || item.thumbnail || item.image || "",
            popular: item.featured || item.popular || false,
            homeTeam: item.teams?.home?.name || item.homeTeam || extractTeam(title, 0),
            awayTeam: item.teams?.away?.name || item.awayTeam || extractTeam(title, 1),
            homeBadge: item.teams?.home?.logo || item.homeLogo || item.homeBadge || "",
            awayBadge: item.teams?.away?.logo || item.awayLogo || item.awayBadge || "",
            isLive: item.status === "live" || item.is_live || false,
            apiSource: "ppv-to",
            sources: embedUrl ? [{ source: "ppv-to", id: embedUrl }] : [],
          });
        }
      }
    }

    // Handle grouped format { category: [streams] }
    if (typeof data.streams === "object" && !Array.isArray(data.streams)) {
      for (const [cat, streams] of Object.entries(data.streams)) {
        if (!Array.isArray(streams)) continue;
        for (const s of streams as any[]) {
          const title = s.name || s.title || "Unknown Match";
          const catName = s.category || cat || "other";
          const sport = mapCategoryToSport(catName);
          const matchId = String(s.id || s.matchId || Math.random().toString(36).slice(2));
          const embedUrl = s.embed || s.embedUrl || s.url || s.link || "";

          matches.push({
            id: `ppv-${matchId}`,
            title,
            sport,
            sportName: SPORT_NAMES[sport] || capitalize(catName),
            date: 0,
            poster: s.poster || "",
            popular: false,
            homeTeam: s.teams?.home?.name || s.homeTeam || extractTeam(title, 0),
            awayTeam: s.teams?.away?.name || s.awayTeam || extractTeam(title, 1),
            homeBadge: s.teams?.home?.logo || s.homeLogo || "",
            awayBadge: s.teams?.away?.logo || s.awayLogo || "",
            isLive: s.status === "live" || false,
            apiSource: "ppv-to",
            sources: embedUrl ? [{ source: "ppv-to", id: embedUrl }] : [],
          });
        }
      }
    }

    return matches;
  } catch { return []; }
}

// ── Normalize team names for fuzzy matching ──
// Handles "Man City" vs "Manchester City", abbreviations, etc.
function normalizeTeamName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\bman\b/g, "manchester")
    .replace(/\bunited\b/g, "utd")
    .replace(/\bwolverhampton\b/g, "wolves")
    .replace(/\btottenham\b/g, "spurs")
    .replace(/\bblackburn\b/g, "rovers")
    .replace(/\bfc\b/g, "")
    .replace(/\bsc\b/g, "")
    .replace(/\bafc\b/g, "")
    .replace(/\binc\b/g, "")
    .trim();
}

// ── Extract base event name from DamiTV title ──
// DamiTV often returns "Roland-Garros: TNT Sports 1", "Roland-Garros: TNT Sports 4"
// We need to extract "roland-garros" as the base event name for deduplication
function extractBaseEventName(title: string): string {
  // Remove channel suffixes like ": TNT Sports 1", ": ESPN 2", etc.
  return title
    .toLowerCase()
    .trim()
    // Remove patterns like ": TNT Sports X", ": Sky Sports X", ": ESPN X"
    .replace(/\s*:\s*(tnt\s*sports|sky\s*sports|espn|bbc|itv|channel|bein|supersport|dazn|prime|peacock|paramount|fox|cbs|nbc|abc|tbs|tnt|trutv)\s*\d*\s*$/i, "")
    // Remove trailing numbers after space (e.g., " 1", " 4")
    .replace(/\s+\d{1,2}\s*$/, "")
    .trim();
}

// ── Merge & Deduplicate ──
// Strategy:
// 1. WatchFooty is PRIMARY for display data (title, poster, teams, badges, scores, league)
// 2. Merge by team names (homeTeam/awayTeam) across providers
// 3. For DamiTV entries without teams, merge by base event name (e.g. "Roland-Garros")
// 4. Accumulate ALL stream provider IDs (damitvIds, streamKey, etc.) as server options
function mergeMatches(lists: LiveMatch[][]): LiveMatch[] {
  const seen = new Map<string, LiveMatch>();

  // Process WatchFooty first (best display data), then other providers
  // This ensures WatchFooty data is the base for merged matches
  const orderedLists: LiveMatch[][] = [];
  const wfLists: LiveMatch[][] = [];
  const otherLists: LiveMatch[][] = [];
  for (const list of lists) {
    const hasWatchfooty = list.some(m => m.apiSource === "watchfooty");
    if (hasWatchfooty) wfLists.push(list);
    else otherLists.push(list);
  }
  orderedLists.push(...wfLists, ...otherLists);

  for (const list of orderedLists) {
    for (const m of list) {
      // ── Generate match key ──
      // Priority 1: Exact team match key
      const exactKey = m.homeTeam && m.awayTeam
        ? `${m.sport}:${m.homeTeam.toLowerCase().trim()}:${m.awayTeam.toLowerCase().trim()}`
        : "";

      // Priority 2: Base event name key (for DamiTV entries without proper teams)
      const baseEventKey = (!m.homeTeam || !m.awayTeam) && m.title
        ? `${m.sport}:${extractBaseEventName(m.title)}`
        : "";

      // Try exact match first
      let existing = exactKey ? seen.get(exactKey) : undefined;

      // If no exact match, try fuzzy match by normalized team names
      if (!existing && m.homeTeam && m.awayTeam) {
        const normHome = normalizeTeamName(m.homeTeam);
        const normAway = normalizeTeamName(m.awayTeam);
        for (const [, existingMatch] of seen) {
          if (existingMatch.sport !== m.sport) continue;
          if (!existingMatch.homeTeam || !existingMatch.awayTeam) continue;
          const eNormHome = normalizeTeamName(existingMatch.homeTeam);
          const eNormAway = normalizeTeamName(existingMatch.awayTeam);
          // Direct match (order same or swapped)
          const directMatch =
            (normHome === eNormHome && normAway === eNormAway) ||
            (normHome === eNormAway && normAway === eNormHome);
          // Partial match: one team name contains the other
          const partialMatch =
            (normHome.includes(eNormHome) || eNormHome.includes(normHome)) &&
            (normAway.includes(eNormAway) || eNormAway.includes(normAway));
          if (directMatch || partialMatch) {
            existing = existingMatch;
            break;
          }
        }
      }

      // If still no match, try base event name match (for DamiTV entries without teams)
      if (!existing && baseEventKey) {
        existing = seen.get(baseEventKey);
        // Also check if any existing match has a similar base event name
        if (!existing) {
          for (const [key, existingMatch] of seen) {
            if (existingMatch.sport !== m.sport) continue;
            const existingBaseKey = `${existingMatch.sport}:${extractBaseEventName(existingMatch.title)}`;
            if (existingBaseKey === baseEventKey && baseEventKey.split(":")[1].length > 3) {
              existing = existingMatch;
              break;
            }
          }
        }
      }

      if (existing) {
        // ── MERGE: Prefer WatchFooty for display, accumulate all stream IDs ──
        if (m.apiSource === "watchfooty" && existing.apiSource !== "watchfooty") {
          // WatchFooty has best display data — use it as base, keep existing stream IDs
          const merged = { ...m, ...pickMissing(m, existing) };
          // Accumulate DamiTV IDs from existing into merged
          merged.damitvIds = mergeDamitvIds(existing.damitvIds, m.damitvIds);
          // Also keep the existing match's provider IDs if WatchFooty doesn't have them
          if (existing.damitvId && !merged.damitvId) merged.damitvId = existing.damitvId;
          if (existing.damitvName && !merged.damitvName) merged.damitvName = existing.damitvName;
          if (existing.damitvEmbedUrl && !merged.damitvEmbedUrl) merged.damitvEmbedUrl = existing.damitvEmbedUrl;
          if (existing.streamKey && !merged.streamKey) merged.streamKey = existing.streamKey;
          if (existing.streamCategory && !merged.streamCategory) merged.streamCategory = existing.streamCategory;
          if (existing.sportsrcCategory && !merged.sportsrcCategory) merged.sportsrcCategory = existing.sportsrcCategory;
          if (existing.sportsrcId && !merged.sportsrcId) merged.sportsrcId = existing.sportsrcId;
          // Update all key mappings
          if (exactKey) seen.set(exactKey, merged);
          if (baseEventKey) seen.set(baseEventKey, merged);
          // Update the old key that pointed to existing
          for (const [k, v] of seen) {
            if (v === existing && k !== exactKey && k !== baseEventKey) {
              seen.set(k, merged);
            }
          }
        } else {
          // Fill in missing fields from new match into existing
          const updates = pickMissing(existing, m);
          // Accumulate DamiTV IDs — this is the KEY fix
          const mergedIds = mergeDamitvIds(existing.damitvIds, m.damitvIds);
          if (mergedIds.length > (existing.damitvIds?.length || 0)) {
            updates.damitvIds = mergedIds;
          }
          // If new match is DamiTV, add its ID to damitvIds even if existing already has one
          if (m.apiSource === "damitv" && m.damitvId) {
            if (!existing.damitvIds) existing.damitvIds = [];
            if (!existing.damitvIds.some(d => d.id === m.damitvId)) {
              updates.damitvIds = [...(existing.damitvIds || []), { id: m.damitvId, name: m.damitvName || m.damitvId, embed: m.damitvEmbedUrl }];
            }
            // Also set the embed URL
            if (m.damitvEmbedUrl && !existing.damitvEmbedUrl) updates.damitvEmbedUrl = m.damitvEmbedUrl;
          }
          Object.assign(existing, updates);
        }
        // Also update key mappings
        if (exactKey && !seen.has(exactKey)) seen.set(exactKey, existing);
        if (baseEventKey && !seen.has(baseEventKey)) seen.set(baseEventKey, existing);
        continue;
      }

      // New match — add to seen map
      if (exactKey) seen.set(exactKey, m);
      if (baseEventKey && baseEventKey !== exactKey) seen.set(baseEventKey, m);
      if (!exactKey && !baseEventKey) seen.set(m.id, m);
    }
  }

  return Array.from(seen.values()).sort((a, b) => {
    if (a.isLive && !b.isLive) return -1;
    if (!a.isLive && b.isLive) return 1;
    if (a.popular && !b.popular) return -1;
    if (!a.popular && b.popular) return 1;
    return a.date - b.date;
  });
}

// ── Merge DamiTV IDs arrays — deduplicate by id ──
function mergeDamitvIds(base?: { id: string; name: string; embed?: string }[], fill?: { id: string; name: string; embed?: string }[]): { id: string; name: string; embed?: string }[] {
  const combined = [...(base || []), ...(fill || [])];
  const seen = new Set<string>();
  return combined.filter(d => {
    if (seen.has(d.id)) return false;
    seen.add(d.id);
    return true;
  });
}

function pickMissing(base: LiveMatch, fill: LiveMatch): Partial<LiveMatch> {
  const result: Partial<LiveMatch> = {};
  if (!base.homeBadge && fill.homeBadge) result.homeBadge = fill.homeBadge;
  if (!base.awayBadge && fill.awayBadge) result.awayBadge = fill.awayBadge;
  if (!base.poster && fill.poster) result.poster = fill.poster;
  if (!base.homeTeam && fill.homeTeam) result.homeTeam = fill.homeTeam;
  if (!base.awayTeam && fill.awayTeam) result.awayTeam = fill.awayTeam;
  if (!base.streamKey && fill.streamKey) result.streamKey = fill.streamKey;
  if (!base.streamCategory && fill.streamCategory) result.streamCategory = fill.streamCategory;
  if (fill.popular) result.popular = true;
  // Only mark as live if confirmed by a source; don't override a correct non-live status
  // from a more authoritative/recent source
  if (fill.isLive && !base.isLive) result.isLive = true;
  // Merge sources from fill into base
  if (fill.sources.length > 0) {
    if (base.sources.length === 0) {
      // Base has no sources — just use fill's sources
      result.sources = fill.sources;
    } else {
      // Base has sources — merge in any new ones from fill
      const existingKeys = new Set(base.sources.map(s => `${s.source}:${s.id}`));
      const newSources = fill.sources.filter(s => !existingKeys.has(`${s.source}:${s.id}`));
      if (newSources.length > 0) result.sources = [...base.sources, ...newSources];
    }
  }
  // WatchFooty fields — prefer WatchFooty data for scores, streams, league
  if (!base.watchfootyStreams && fill.watchfootyStreams && fill.watchfootyStreams.length > 0) result.watchfootyStreams = fill.watchfootyStreams;
  if (!base.league && fill.league) result.league = fill.league;
  if (!base.leagueLogo && fill.leagueLogo) result.leagueLogo = fill.leagueLogo;
  if (base.homeScore === undefined && fill.homeScore !== undefined) result.homeScore = fill.homeScore;
  if (base.awayScore === undefined && fill.awayScore !== undefined) result.awayScore = fill.awayScore;
  if (!base.currentMinute && fill.currentMinute) result.currentMinute = fill.currentMinute;
  if (!base.watchfootyId && fill.watchfootyId) result.watchfootyId = fill.watchfootyId;
  // Also pick missing DamiTV and SportsEmbed IDs
  // IMPORTANT: Only merge damitvId if the match actually came from DamiTV API
  // This prevents DamiTV showing as a source for every match
  if (!base.damitvId && fill.damitvId && fill.apiSource === "damitv") result.damitvId = fill.damitvId;
  if (!base.damitvName && fill.damitvName && fill.apiSource === "damitv") result.damitvName = fill.damitvName;
  if (!base.sportsrcCategory && fill.sportsrcCategory && fill.apiSource === "sportsembed") result.sportsrcCategory = fill.sportsrcCategory;
  if (!base.sportsrcId && fill.sportsrcId && fill.apiSource === "sportsembed") result.sportsrcId = fill.sportsrcId;
  if (!base.channelCode && fill.channelCode) result.channelCode = fill.channelCode;
  if (!base.channelName && fill.channelName) result.channelName = fill.channelName;
  return result;
}

// ── Helpers ──
// Safely extract a primitive from API values that might be objects like {value, displayValue}
function toPrimitive(v: any): any {
  if (v === null || v === undefined) return undefined;
  if (typeof v === "object") {
    // Handle {value, displayValue} pattern from some APIs
    if ("value" in v) return toPrimitive(v.value);
    if ("displayValue" in v) return toPrimitive(v.displayValue);
    // Handle other object patterns
    if (typeof v.toString === "function" && v.toString() !== "[object Object]") return v.toString();
    return undefined;
  }
  return v;
}

// Deep conversion: recursively converts ALL {value, displayValue} objects to primitives
// Use this on raw API responses from WatchFooty BEFORE extracting fields
// NOTE: Do NOT restrict by key count — WatchFooty objects can have extra keys
// like {value, displayValue, type, shortDisplayValue} which must still be converted.
function deepToPrimitive(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map(deepToPrimitive);
  if (typeof obj === "object") {
    // If this looks like a WatchFooty value object {value, displayValue}, extract the primitive
    // Do NOT limit by key count — some objects have extra metadata keys
    if ("value" in obj || "displayValue" in obj) {
      // Prefer numeric value, fall back to displayValue
      if ("value" in obj) return deepToPrimitive(obj.value);
      if ("displayValue" in obj) return deepToPrimitive(obj.displayValue);
    }
    // Recursively convert all nested properties
    const result: Record<string, any> = {};
    for (const [k, v] of Object.entries(obj)) {
      result[k] = deepToPrimitive(v);
    }
    return result;
  }
  return obj;
}
function capitalize(s: string): string { return s ? s.charAt(0).toUpperCase() + s.slice(1).replace(/-/g, " ") : ""; }

// ── Image Proxy URL helper ──
// Routes external image URLs through Cloudflare Worker (NEXT_PUBLIC_PROXY_BASE)
// Falls back to /api/image-proxy if worker URL not configured.
// Bypasses CORS, referer blocking, and CSP issues in the browser.
const PROXY_BASE = process.env.NEXT_PUBLIC_PROXY_BASE || "";
const PROXY_HOSTS = new Set([
  "dami-tv.pro", "api.watchfooty.st", "streamfree.app",
  "r2.thesportsdb.com", "streamed.pk", "sportsembed.su",
  "api.vipstreamed.live", "api.ppv.to", "a.espncdn.com",
  "site.api.espn.com", "api.cdnlivetv.tv", "cdnlivetv.tv",
  "i.imgur.com", "upload.wikimedia.org",
]);

function proxyImageUrl(url: string): string {
  if (!url) return "";
  // Already a proxied URL — don't double-proxy
  if (url.startsWith("/api/image-proxy")) return url;
  if (PROXY_BASE && url.startsWith(PROXY_BASE)) return url;
  // Relative URLs — no proxy needed
  if (url.startsWith("/")) return url;
  // Data URLs — no proxy needed
  if (url.startsWith("data:")) return url;
  try {
    const parsed = new URL(url);
    // Check exact host or subdomain matches
    const needsProxy = PROXY_HOSTS.has(parsed.hostname) ||
      parsed.hostname.endsWith(".streamed.pk") ||
      parsed.hostname.endsWith(".thesportsdb.com") ||
      parsed.hostname.endsWith(".espncdn.com") ||
      parsed.hostname.endsWith(".imgur.com") ||
      parsed.hostname.endsWith(".wikimedia.org") ||
      parsed.hostname.endsWith(".dami-tv.pro");
    const isImage = parsed.protocol === "https:" && /\.(jpg|jpeg|png|webp|gif|svg|avif)/i.test(parsed.pathname);
    if (needsProxy || isImage) {
      if (PROXY_BASE) {
        return `${PROXY_BASE}/proxy/image?url=${encodeURIComponent(url)}`;
      }
      return `/api/image-proxy?url=${encodeURIComponent(url)}`;
    }
  } catch {}
  // Return as-is for non-parseable URLs
  return url;
}
function mapCategoryToSport(cat: string): string {
  const m: Record<string, string> = {
    basketball: "basketball", hockey: "hockey", baseball: "baseball", soccer: "football",
    football: "american-football", tennis: "tennis", cricket: "cricket", racing: "motor-sports",
    combat: "fight", fighting: "fight", afl: "afl", rugby: "rugby", golf: "golf",
    "motor-sports": "motor-sports", motorsport: "motor-sports", darts: "darts",
  };
  return m[cat?.toLowerCase()] || "other";
}
function extractTeam(title: string, index: 0 | 1): string {
  if (!title) return "";
  const parts = title.split(/\s+vs\.?\s+|\s+@\s+|\s+-\s+/i);
  return parts[index]?.trim() || "";
}
function formatTitle(key: string): string {
  if (!key) return "";
  return key.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

// ── SPORTS LIST (default fallback) ──
const ALL_SPORTS: SportCategory[] = [
  { id: "football", name: "Football" },
  { id: "basketball", name: "Basketball" },
  { id: "american-football", name: "American Football" },
  { id: "hockey", name: "Hockey" },
  { id: "baseball", name: "Baseball" },
  { id: "tennis", name: "Tennis" },
  { id: "fight", name: "Fight / MMA / Boxing" },
  { id: "motor-sports", name: "Motor Sports" },
  { id: "rugby", name: "Rugby" },
  { id: "golf", name: "Golf" },
  { id: "cricket", name: "Cricket" },
  { id: "other", name: "TV Channels / Other" },
];

export async function GET(req: Request) {
  const url = new URL(req.url);
  const sport = url.searchParams.get("sport") || "";
  const filter = url.searchParams.get("filter") || "";
  const mode = url.searchParams.get("mode") || ""; // "tv" for channels only

  try {
    // Fetch WatchFooty sports list + top leagues/teams in parallel with matches
    const wfSportsPromise = fetchWatchfootySports();
    const wfTopLeaguesPromise = fetchWatchfootyTopLeagues(sport || undefined);
    const wfTopTeamsPromise = fetchWatchfootyTopTeams(sport || undefined);

    // Fetch from ALL sources in parallel
    const [streamfree, streamfreeChannels, damiChannels, damiSports, streamedpk, wfLive, wfAll, wfPopularLive, wfPopular, espn, sportsembed, vipstreamed, ppvto] = await Promise.allSettled([
      fetchStreamfreeStreams(),
      fetchStreamfreeChannelStatus(), // Check StreamFree TV channel availability
      fetchDamiTVChannels(),
      fetchDamiTVStreams(),
      fetchStreamedPK(), // StreamedPK sports matches
      fetchWatchfootyLive(),
      fetchWatchfootyAll(),
      fetchWatchfootyPopularLive(),
      fetchWatchfootyPopular(),
      fetchESPNMatches(),
      fetchSportsembedSu(),
      fetchVIPStreamed(), // VIPStreamed/StreamedTV
      fetchPPVto(), // PPV.to streams
    ]);

    const wfSports = await wfSportsPromise;
    const topLeagues = await wfTopLeaguesPromise;
    const topTeams = await wfTopTeamsPromise;

    // ── TV Channels (separate from matches) ──
    // Combine StreamFree verified channels + DamiTV 24/7 channels + StreamedPK TV channels
    const sfChannels = streamfreeChannels.status === "fulfilled" ? streamfreeChannels.value : [];
    const damiTVChannels = damiChannels.status === "fulfilled" ? damiChannels.value : [];
    // Also extract TV channels from StreamFree streams list (channels with no teams/timestamp)
    const sfStreamChannels = (streamfree.status === "fulfilled" ? streamfree.value : [])
      .filter(m => m.channelName && !m.homeTeam && !m.awayTeam);
    // Deduplicate TV channels by name
    const allTVChannels: LiveMatch[] = [];
    const seenChannelNames = new Set<string>();
    for (const ch of [...sfChannels, ...sfStreamChannels]) {
      // NOTE: DamiTV channels removed from here — they now go to the dedicated Live TV (Daddylive) page
      const name = (ch.channelName || ch.title || "").toLowerCase().trim();
      if (!name || seenChannelNames.has(name)) continue;
      seenChannelNames.add(name);
      // Ensure channel fields are set
      if (!ch.channelName) ch.channelName = ch.title;
      if (!ch.channelCode) ch.channelCode = ch.streamCategory || ch.sport || "other";
      ch.isLive = true; // TV channels are always live
      allTVChannels.push(ch);
    }

    // Matches list: only real matches, NO TV channels mixed in
    const allLists: LiveMatch[][] = [
      // StreamFree: only real matches (filter out channels)
      (streamfree.status === "fulfilled" ? streamfree.value : []).filter(m => m.homeTeam || m.awayTeam || m.date),
      // DamiTV: only actual sports matches (already filtered in fetchDamiTVStreams)
      damiSports.status === "fulfilled" ? damiSports.value : [],
      // StreamedPK: live sports matches with multiple server sources
      streamedpk.status === "fulfilled" ? streamedpk.value : [],
      wfLive.status === "fulfilled" ? wfLive.value : [],
      wfAll.status === "fulfilled" ? wfAll.value : [],
      wfPopularLive.status === "fulfilled" ? wfPopularLive.value : [],
      wfPopular.status === "fulfilled" ? wfPopular.value : [],
      espn.status === "fulfilled" ? espn.value : [],
      sportsembed.status === "fulfilled" ? sportsembed.value : [],
      // VIPStreamed/StreamedTV — additional match source
      vipstreamed.status === "fulfilled" ? vipstreamed.value : [],
      // PPV.to — additional match source
      ppvto.status === "fulfilled" ? ppvto.value : [],
    ];

    let matches = mergeMatches(allLists);

    // ── POST-MERGE: Build complete sources array from all provider fields ──
    for (const m of matches) {
      const allSources: { source: string; id: string }[] = [];

      // DamiTV sources
      if (m.damitvId) {
        allSources.push({ source: "damitv", id: m.damitvId });
      }
      if (m.damitvIds && m.damitvIds.length > 0) {
        for (const d of m.damitvIds) {
          if (!allSources.some(s => s.source === "damitv" && s.id === d.id)) {
            allSources.push({ source: "damitv", id: d.id });
          }
        }
      }
      if (m.damitvEmbedUrl && !allSources.some(s => s.source === "damitv" && s.id === m.damitvEmbedUrl)) {
        allSources.push({ source: "damitv", id: m.damitvEmbedUrl });
      }

      // WatchFooty source
      if (m.watchfootyId) {
        allSources.push({ source: "watchfooty", id: String(m.watchfootyId) });
      }

      // StreamFree source
      if (m.streamKey) {
        allSources.push({ source: "streamfree", id: m.streamKey });
      }

      // SportsEmbed source
      if (m.sportsrcId) {
        allSources.push({ source: "sportsembed", id: m.sportsrcId });
      }

      // VIPStreamed source
      if (m.apiSource === "vipstreamed" || m.sources?.some(s => s.source === "vipstreamed")) {
        const vsSource = m.sources?.find(s => s.source === "vipstreamed");
        if (vsSource && !allSources.some(s => s.source === "vipstreamed" && s.id === vsSource.id)) {
          allSources.push(vsSource);
        }
      }

      // PPV.to source
      if (m.apiSource === "ppv-to" || m.sources?.some(s => s.source === "ppv-to")) {
        const ppvSource = m.sources?.find(s => s.source === "ppv-to");
        if (ppvSource && !allSources.some(s => s.source === "ppv-to" && s.id === ppvSource.id)) {
          allSources.push(ppvSource);
        }
      }

      // StreamedPK sources
      if (m.apiSource === "streamedpk" || m.sources?.some(s => s.source.startsWith("streamed-"))) {
        const spSources = m.sources?.filter(s => s.source.startsWith("streamed-")) || [];
        for (const sp of spSources) {
          if (!allSources.some(s => s.source === sp.source && s.id === sp.id)) {
            allSources.push(sp);
          }
        }
      }

      // Also add any sources from the existing sources array that weren't caught above
      for (const s of m.sources || []) {
        if (!allSources.some(a => a.source === s.source && a.id === s.id)) {
          allSources.push(s);
        }
      }

      m.sources = allSources;
    }

    // ── Also rebuild sources for TV channels ──
    for (const ch of allTVChannels) {
      const allSources: { source: string; id: string }[] = [];

      if (ch.damitvId) {
        allSources.push({ source: "damitv", id: ch.damitvId });
      }
      if (ch.streamKey) {
        allSources.push({ source: "streamfree", id: ch.streamKey });
      }
      if (ch.watchfootyId) {
        allSources.push({ source: "watchfooty", id: String(ch.watchfootyId) });
      }
      if (ch.sportsrcId) {
        allSources.push({ source: "sportsembed", id: ch.sportsrcId });
      }
      // Add any existing sources not caught above
      for (const s of ch.sources || []) {
        if (!allSources.some(a => a.source === s.source && a.id === s.id)) {
          allSources.push(s);
        }
      }

      ch.sources = allSources;
    }

    // ── Time-based sanity check: unmark stale "live" matches ──
    const STALE_LIVE_THRESHOLD = 4 * 60 * 60 * 1000; // 4 hours (matches rarely last longer)
    const now = Date.now();
    for (const m of matches) {
      if (!m.isLive) continue;
      // Always-live TV channels (no specific match time) stay live
      if (!m.date) continue;
      // If the match started less than 4 hours ago, keep it as live
      if (m.date > now - STALE_LIVE_THRESHOLD) continue;
      // Match started over 4 hours ago — only keep live if an authoritative source confirms it
      // ESPN explicitly checks competition status type === "in"
      const confirmedByEspn = m.apiSource === "espn";
      // DamiTV always_live channels are 24/7 — keep them
      const isAlwaysLiveChannel = m.apiSource === "damitv" && !m.homeTeam && !m.awayTeam;
      // NOTE: WatchFooty /all and /popular endpoints are NOT authoritative for live status
      // They return ended matches too. Only /live endpoint is authoritative.
      // Since WatchFooty matches get apiSource "watchfooty" regardless of which endpoint,
      // we DO NOT give them a free pass for stale matches.
      if (!confirmedByEspn && !isAlwaysLiveChannel) {
        m.isLive = false;
        m.popular = false; // Also unmark popular for ended matches
      }
    }

    // ── ALSO: If a match has no date and it's from WatchFooty /all or /popular ──
    // endpoint (not /live), don't trust its isLive flag blindly.
    // WatchFooty /popular returns matches that may have ended but are still "popular"

    // ── Unmark "popular" for ended matches ──
    // If a match is not live AND it started more than 4 hours ago, unmark it as popular
    // This prevents ended matches from showing in the "Popular Live" section
    for (const m of matches) {
      if (m.popular && !m.isLive && m.date && m.date < now - STALE_LIVE_THRESHOLD) {
        m.popular = false;
      }
    }

    // ── Filter out matches that have NO stream availability ──
    // If a match has no way to play it (no sources, no streamKey, no damitvId,
    // no watchfootyId, no channelCode, no sportsrcCategory/sportsrcId), remove it
    // Only filter for non-live matches that are NOT 24/7 TV channels
    matches = matches.filter(m => {
      // Always keep live matches — they might get streams from multiple providers
      if (m.isLive) return true;
      // Always keep popular matches
      if (m.popular) return true;
      // Always keep matches with any stream source
      if (m.sources && m.sources.length > 0) return true;
      if (m.streamKey) return true;
      if (m.damitvId) return true;
      if (m.watchfootyId) return true;
      if (m.channelCode) return true;
      if (m.sportsrcCategory && m.sportsrcId) return true;
      if (m.watchfootyStreams && m.watchfootyStreams.length > 0) return true;
      // For upcoming matches (future date), keep them even without sources
      // They might get streams closer to match time
      if (m.date && m.date > now) return true;
      // For non-live matches that already started but have no sources, hide them
      // unless they came from a source that might provide streams later
      if (m.apiSource === "streamfree" || m.apiSource === "damitv" || 
          m.apiSource === "sportsembed") return true;
      // No stream sources and not from a provider that could provide them — hide
      return false;
    });

    // Filter by sport
    if (sport) {
      matches = matches.filter(m => m.sport === sport);
    }

    // Filter for live matches
    if (filter === "live") {
      matches = matches.filter(m => {
        if (m.isLive) return true;
        if (!m.date) return false;
        return m.date <= now && m.date > now - 10800000;
      });
    }

    // For TV mode: use dami-tv channels as the primary source, fall back to streamfree
    if (mode === "tv") {
      const damiChannelsFound = matches.some(m => m.apiSource === "damitv" && m.channelName);
      if (!damiChannelsFound) {
        const alwaysLive = matches.filter(m => m.apiSource === "streamfree" && m.streamKey && !m.homeTeam && !m.awayTeam);
        for (const m of alwaysLive) {
          m.sport = "other";
          m.sportName = "TV Channel";
          m.channelName = m.title;
          m.channelCode = m.streamCategory || "";
          m.isLive = true;
        }
        const streamfreeAsChannels = matches.filter(m => m.apiSource === "streamfree" && m.streamKey);
        for (const m of streamfreeAsChannels) {
          if (!m.channelName) {
            m.channelName = m.homeTeam || m.title;
            m.channelCode = m.streamCategory || "";
          }
          if (m.sportName !== "TV Channel") {
            m.sportName = m.sportName || "TV Channel";
          }
        }
      }
    }

    // Compute live counts per sport
    const liveCountBySport: Record<string, number> = {};
    for (const m of matches) {
      if (m.isLive) {
        liveCountBySport[m.sport] = (liveCountBySport[m.sport] || 0) + 1;
      }
    }

    // Build sports list: prefer WatchFooty sports, merge with defaults
    let sportsList: SportCategory[] = ALL_SPORTS;
    if (wfSports.length > 0) {
      // Merge WF sports into our list
      const merged = new Map<string, SportCategory>();
      // Add WF sports first
      for (const ws of wfSports) {
        if (!merged.has(ws.id)) {
          merged.set(ws.id, { ...ws, liveCount: liveCountBySport[ws.id] || 0 });
        } else {
          const existing = merged.get(ws.id)!;
          merged.set(ws.id, { ...existing, displayName: ws.displayName || existing.displayName, liveCount: liveCountBySport[ws.id] || 0 });
        }
      }
      // Add any remaining sports that have matches
      for (const s of ALL_SPORTS) {
        if (!merged.has(s.id) && matches.some(m => m.sport === s.id)) {
          merged.set(s.id, { ...s, liveCount: liveCountBySport[s.id] || 0 });
        }
      }
      // Add the "other" category at the end
      if (!merged.has("other")) {
        merged.set("other", { id: "other", name: "Other", liveCount: liveCountBySport["other"] || 0 });
      }
      sportsList = Array.from(merged.values());
    }

    // Add live counts to sports
    sportsList = sportsList.map(s => ({ ...s, liveCount: liveCountBySport[s.id] || 0 }));

    // Count by source
    const sourceCounts: Record<string, number> = {};
    for (const m of matches) {
      sourceCounts[m.apiSource] = (sourceCounts[m.apiSource] || 0) + 1;
    }

    // Count popular live matches
    const popularLiveCount = matches.filter(m => m.isLive && m.popular).length;

    // ── Proxy ALL image URLs through our /api/image-proxy ──
    // This fixes images not loading in browser due to CORS/referer/CSRF blocking
    for (const m of matches) {
      m.poster = proxyImageUrl(m.poster);
      m.homeBadge = proxyImageUrl(m.homeBadge);
      m.awayBadge = proxyImageUrl(m.awayBadge);
      if (m.leagueLogo) m.leagueLogo = proxyImageUrl(m.leagueLogo);
    }
    for (const ch of allTVChannels) {
      ch.poster = proxyImageUrl(ch.poster);
      ch.homeBadge = proxyImageUrl(ch.homeBadge);
      ch.awayBadge = proxyImageUrl(ch.awayBadge);
    }

    return NextResponse.json({
      matches,
      tvChannels: allTVChannels,
      sports: sportsList,
      total: matches.length,
      liveCount: Object.values(liveCountBySport).reduce((a, b) => a + b, 0),
      popularLiveCount,
      sources: sourceCounts,
      topLeagues,
      topTeams,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to fetch live data", details: error.message },
      { status: 500 }
    );
  }
}
