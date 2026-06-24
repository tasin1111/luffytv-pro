import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ─────────────────────────────────────────────────────────────
// Luffy TV Live — Multi-source aggregator
// ALL 4 SOURCES working together with deduplication:
//   1. WatchFooty (api.watchfooty.st) — PRIMARY — has direct embed URLs
//   2. DamiTV (dami-tv.pro/papi/api/streams) — match source with embed URLs
//   3. VIPStreamed/StreamedTV (api.vipstreamed.live) — match source
//   4. PPV.to (api.ppv.to/api/streams) — match source
// Each source adds its own server button per match via deduplication.
// One match entry = multiple server options from different providers.
// ─────────────────────────────────────────────────────────────

interface StreamEmbed {
  url: string;
  source: string;
  quality: string;
  language: string;
}

interface MatchSource {
  source: string;
  sourceId: string;
  streamType: "m3u8" | "embed" | "channel";
  embeds?: StreamEmbed[];
}

interface UnifiedMatch {
  id: string;
  title: string;
  category: string;
  sport: string;
  league?: string;
  status: "live" | "upcoming" | "ended";
  date?: number;
  poster?: string;
  viewers?: number;
  homeTeam?: string;
  awayTeam?: string;
  homeLogo?: string;
  awayLogo?: string;
  sources: MatchSource[];
  type: "sport" | "channel";
  channelImage?: string;
  countryCode?: string;
  _relatedIds?: string[];
}

const SPORT_MAP: Record<string, string> = {
  soccer: "Soccer", football: "Football", basketball: "Basketball",
  baseball: "Baseball", hockey: "Hockey", tennis: "Tennis",
  fighting: "Fighting", combat: "Combat", mma: "MMA", boxing: "Boxing",
  rugby: "Rugby", golf: "Golf", racing: "Racing", motorsport: "Motorsport",
  afl: "AFL", cricket: "Cricket", darts: "Darts", volleyball: "Volleyball",
  handball: "Handball", other: "Other", nfl: "NFL", nba: "NBA",
  nhl: "NHL", mlb: "MLB", f1: "F1", ufc: "UFC",
};

function getSportName(cat: string): string {
  return SPORT_MAP[cat.toLowerCase()] || cat.charAt(0).toUpperCase() + cat.slice(1);
}

// ── Image Proxy URL helper ──
const PROXY_HOSTS = new Set([
  "dami-tv.pro", "api.watchfooty.st", "streamfree.app",
  "r2.thesportsdb.com", "streamed.pk", "sportsembed.su",
  "api.vipstreamed.live", "api.ppv.to", "a.espncdn.com",
  "site.api.espn.com", "api.cdnlivetv.tv", "cdnlivetv.tv",
  "i.imgur.com", "upload.wikimedia.org",
]);

function proxyImageUrl(url: string): string {
  if (!url) return "";
  const PROXY_BASE = process.env.NEXT_PUBLIC_PROXY_BASE || "";
  if (url.startsWith("/api/image-proxy")) return url;
  if (PROXY_BASE && url.startsWith(PROXY_BASE)) return url;
  if (url.startsWith("/")) return url;
  if (url.startsWith("data:")) return url;
  try {
    const parsed = new URL(url);
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
  return url;
}

// ── Source 1: WatchFooty (PRIMARY — has direct EMBED URLs!) ──
async function fetchWatchFooty(): Promise<UnifiedMatch[]> {
  try {
    const res = await fetch("https://api.watchfooty.st/api/v1/matches/live", {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    if (!Array.isArray(data)) return [];

    return data.map((match: any) => {
      const embeds: StreamEmbed[] = (match.streams || []).map((s: any) => ({
        url: s.url,
        source: s.source || "watchfooty",
        quality: s.quality || "HD",
        language: s.language || "English",
      }));

      const matchId = String(match.matchId || match.id);
      return {
        id: `wf_${matchId}`,
        title: match.title || "Unknown Match",
        category: match.sport?.toLowerCase() || "other",
        sport: getSportName(match.sport || "other"),
        league: match.league || undefined,
        status: "live" as const,
        date: match.date ? new Date(match.date).getTime() : undefined,
        poster: match.poster ? `https://api.watchfooty.st${match.poster}` : undefined,
        viewers: match.viewers || 0,
        homeTeam: match.teams?.home?.name,
        awayTeam: match.teams?.away?.name,
        homeLogo: match.teams?.home?.logoUrl ? `https://api.watchfooty.st${match.teams.home.logoUrl}` : undefined,
        awayLogo: match.teams?.away?.logoUrl ? `https://api.watchfooty.st${match.teams.away.logoUrl}` : undefined,
        sources: [{
          source: "watchfooty",
          sourceId: matchId,
          streamType: "embed" as const,
          embeds,
        }],
        type: "sport" as const,
      };
    });
  } catch (e) {
    console.error("[watchfooty] fetch error:", e);
    return [];
  }
}

// ── Source 2: DamiTV (dami-tv.pro) ──
// Provides match streams with embed URLs: https://dami-tv.pro/embed/?id={id}
async function fetchDamiTV(): Promise<UnifiedMatch[]> {
  try {
    const res = await fetch("https://dami-tv.pro/papi/api/streams", {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    if (!data.success || !data.streams) return [];

    const matches: UnifiedMatch[] = [];
    for (const category of data.streams) {
      const catName = category.category || "other";
      for (const stream of category.streams || []) {
        const status = stream.status === "live" ? "live" as const : stream.status === "ended" ? "ended" as const : "upcoming" as const;
        const embedUrl: string | undefined = stream.embed;
        matches.push({
          id: `dami_${stream.id}`,
          title: stream.name || `${stream.teams?.home?.name || "TBD"} vs ${stream.teams?.away?.name || "TBD"}`,
          category: catName,
          sport: getSportName(catName),
          league: stream.league || stream.tag || catName.toUpperCase(),
          status,
          poster: stream.poster,
          viewers: stream.viewers || 0,
          homeTeam: stream.teams?.home?.name,
          awayTeam: stream.teams?.away?.name,
          homeLogo: stream.teams?.home?.badge || stream.teams?.home?.logo || undefined,
          awayLogo: stream.teams?.away?.badge || stream.teams?.away?.logo || undefined,
          sources: [{
            source: "dami-tv",
            sourceId: stream.id,
            streamType: "embed" as const,
            embeds: embedUrl ? [{ url: embedUrl, source: "DamiTV", quality: "HD", language: "English" }] : [],
          }],
          type: "sport" as const,
        });
      }
    }
    return matches;
  } catch (e) {
    console.error("[dami-tv] fetch error:", e);
    return [];
  }
}

// ── Source 3: VIPStreamed / StreamedTV (api.vipstreamed.live) ──
async function fetchVIPStreamed(): Promise<UnifiedMatch[]> {
  try {
    const res = await fetch("https://api.vipstreamed.live/api/streams", {
      headers: { "User-Agent": "Mozilla/5.0", "Accept": "application/json" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const data = await res.json();

    const matches: UnifiedMatch[] = [];

    // Handle various response formats
    const streamList = data.streams || data.data || data.events || data;
    if (Array.isArray(streamList)) {
      for (const stream of streamList) {
        const title = stream.name || stream.title || `${stream.homeTeam || "TBD"} vs ${stream.awayTeam || "TBD"}`;
        const catName = (stream.category || stream.sport || "other").toLowerCase();
        const matchId = String(stream.id || stream.matchId || Math.random().toString(36).slice(2));
        const embedUrl = stream.embed || stream.embedUrl || stream.url || stream.link || "";

        const embeds: StreamEmbed[] = [];
        if (embedUrl) {
          embeds.push({ url: embedUrl, source: "VIPStreamed", quality: stream.quality || "HD", language: stream.language || "English" });
        }

        matches.push({
          id: `vs_${matchId}`,
          title,
          category: catName,
          sport: getSportName(catName),
          league: stream.league || stream.competition || catName.toUpperCase(),
          status: stream.status === "live" ? "live" as const : stream.status === "ended" ? "ended" as const : "upcoming" as const,
          date: stream.date || stream.startTime ? new Date(stream.date || stream.startTime).getTime() : undefined,
          poster: stream.poster || stream.thumbnail || stream.image || undefined,
          viewers: stream.viewers || 0,
          homeTeam: stream.teams?.home?.name || stream.homeTeam,
          awayTeam: stream.teams?.away?.name || stream.awayTeam,
          homeLogo: stream.teams?.home?.logo || stream.homeLogo || stream.homeBadge || undefined,
          awayLogo: stream.teams?.away?.logo || stream.awayLogo || stream.awayBadge || undefined,
          sources: [{
            source: "vipstreamed",
            sourceId: matchId,
            streamType: embedUrl ? "embed" as const : "channel" as const,
            embeds,
          }],
          type: "sport" as const,
        });
      }
    }

    // Handle grouped format { category: [streams] }
    if (typeof data.streams === "object" && !Array.isArray(data.streams)) {
      for (const [cat, streams] of Object.entries(data.streams)) {
        if (!Array.isArray(streams)) continue;
        for (const stream of streams as any[]) {
          const title = stream.name || stream.title || "Unknown Match";
          const catName = (stream.category || cat || "other").toLowerCase();
          const matchId = String(stream.id || stream.matchId || Math.random().toString(36).slice(2));
          const embedUrl = stream.embed || stream.embedUrl || stream.url || stream.link || "";

          const embeds: StreamEmbed[] = [];
          if (embedUrl) {
            embeds.push({ url: embedUrl, source: "VIPStreamed", quality: stream.quality || "HD", language: stream.language || "English" });
          }

          matches.push({
            id: `vs_${matchId}`,
            title,
            category: catName,
            sport: getSportName(catName),
            league: stream.league || stream.competition || catName.toUpperCase(),
            status: stream.status === "live" ? "live" as const : stream.status === "ended" ? "ended" as const : "upcoming" as const,
            viewers: stream.viewers || 0,
            homeTeam: stream.teams?.home?.name || stream.homeTeam,
            awayTeam: stream.teams?.away?.name || stream.awayTeam,
            homeLogo: stream.teams?.home?.logo || stream.homeLogo || undefined,
            awayLogo: stream.teams?.away?.logo || stream.awayLogo || undefined,
            sources: [{
              source: "vipstreamed",
              sourceId: matchId,
              streamType: embedUrl ? "embed" as const : "channel" as const,
              embeds,
            }],
            type: "sport" as const,
          });
        }
      }
    }

    return matches;
  } catch (e) {
    console.error("[vipstreamed] fetch error:", e);
    return [];
  }
}

// ── Source 4: PPV.to (api.ppv.to/api/streams) ──
async function fetchPPVto(): Promise<UnifiedMatch[]> {
  try {
    const res = await fetch("https://api.ppv.to/api/streams", {
      headers: { "User-Agent": "Mozilla/5.0", "Accept": "application/json" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const data = await res.json();

    const matches: UnifiedMatch[] = [];

    // PPV.to API format: { success, streams: [{ category, id, always_live, streams: [{ name, poster, uri_name, embed, ... }] }] }
    const streamList = data.streams || data.data || data.events || data;
    if (Array.isArray(streamList)) {
      for (const item of streamList) {
        // Check if this is a category group with nested streams (PPV.to format)
        if (item.streams && Array.isArray(item.streams) && item.category) {
          const catName = (item.category || "other").toLowerCase();
          const isAlwaysLive = item.always_live === true || item.always_live === 1;
          for (const s of item.streams) {
            const title = s.name || s.title || `${s.homeTeam || "TBD"} vs ${s.awayTeam || "TBD"}`;
            const matchId = String(s.id || s.uri_name || Math.random().toString(36).slice(2));
            const embedUrl = s.embed || s.iframe || s.embedUrl || s.url || s.link || "";
            const ts = s.starts_at ? s.starts_at * 1000 : (s.date ? new Date(s.date).getTime() : undefined);

            const embeds: StreamEmbed[] = [];
            if (embedUrl) {
              embeds.push({ url: embedUrl, source: "PPV.to", quality: s.quality || "HD", language: s.language || "English" });
            }

            matches.push({
              id: `ppv_${matchId}`,
              title,
              category: catName,
              sport: getSportName(catName),
              league: s.tag || s.league || s.competition || catName.toUpperCase(),
              status: s.status === "live" || isAlwaysLive ? "live" as const : s.status === "ended" ? "ended" as const : "upcoming" as const,
              date: ts,
              poster: s.poster || s.thumbnail || s.image || undefined,
              viewers: s.viewers || 0,
              homeTeam: s.teams?.home?.name || s.homeTeam,
              awayTeam: s.teams?.away?.name || s.awayTeam,
              homeLogo: s.teams?.home?.logo || s.homeLogo || s.homeBadge || undefined,
              awayLogo: s.teams?.away?.logo || s.awayLogo || s.awayBadge || undefined,
              sources: [{
                source: "ppv-to",
                sourceId: matchId,
                streamType: embedUrl ? "embed" as const : "channel" as const,
                embeds,
              }],
              type: "sport" as const,
            });
          }
        } else {
          // Flat format — each item is a match directly
          const title = item.name || item.title || `${item.homeTeam || "TBD"} vs ${item.awayTeam || "TBD"}`;
          const catName = (item.category || item.sport || "other").toLowerCase();
          const matchId = String(item.id || item.matchId || Math.random().toString(36).slice(2));
          const embedUrl = item.embed || item.embedUrl || item.url || item.link || "";

          const embeds: StreamEmbed[] = [];
          if (embedUrl) {
            embeds.push({ url: embedUrl, source: "PPV.to", quality: item.quality || "HD", language: item.language || "English" });
          }

          matches.push({
            id: `ppv_${matchId}`,
            title,
            category: catName,
            sport: getSportName(catName),
            league: item.league || item.competition || catName.toUpperCase(),
            status: item.status === "live" ? "live" as const : item.status === "ended" ? "ended" as const : "upcoming" as const,
            date: item.date || item.startTime ? new Date(item.date || item.startTime).getTime() : undefined,
            poster: item.poster || item.thumbnail || item.image || undefined,
            viewers: item.viewers || 0,
            homeTeam: item.teams?.home?.name || item.homeTeam,
            awayTeam: item.teams?.away?.name || item.awayTeam,
            homeLogo: item.teams?.home?.logo || item.homeLogo || item.homeBadge || undefined,
            awayLogo: item.teams?.away?.logo || item.awayLogo || item.awayBadge || undefined,
            sources: [{
              source: "ppv-to",
              sourceId: matchId,
              streamType: embedUrl ? "embed" as const : "channel" as const,
              embeds,
            }],
            type: "sport" as const,
          });
        }
      }
    }

    // Handle grouped format { category: [streams] }
    if (typeof data.streams === "object" && !Array.isArray(data.streams)) {
      for (const [cat, streams] of Object.entries(data.streams)) {
        if (!Array.isArray(streams)) continue;
        for (const stream of streams as any[]) {
          const title = stream.name || stream.title || "Unknown Match";
          const catName = (stream.category || cat || "other").toLowerCase();
          const matchId = String(stream.id || stream.matchId || Math.random().toString(36).slice(2));
          const embedUrl = stream.embed || stream.embedUrl || stream.url || stream.link || "";

          const embeds: StreamEmbed[] = [];
          if (embedUrl) {
            embeds.push({ url: embedUrl, source: "PPV.to", quality: stream.quality || "HD", language: stream.language || "English" });
          }

          matches.push({
            id: `ppv_${matchId}`,
            title,
            category: catName,
            sport: getSportName(catName),
            league: stream.league || stream.competition || catName.toUpperCase(),
            status: stream.status === "live" ? "live" as const : stream.status === "ended" ? "ended" as const : "upcoming" as const,
            viewers: stream.viewers || 0,
            homeTeam: stream.teams?.home?.name || stream.homeTeam,
            awayTeam: stream.teams?.away?.name || stream.awayTeam,
            homeLogo: stream.teams?.home?.logo || stream.homeLogo || undefined,
            awayLogo: stream.teams?.away?.logo || stream.awayLogo || undefined,
            sources: [{
              source: "ppv-to",
              sourceId: matchId,
              streamType: embedUrl ? "embed" as const : "channel" as const,
              embeds,
            }],
            type: "sport" as const,
          });
        }
      }
    }

    return matches;
  } catch (e) {
    console.error("[ppv.to] fetch error:", e);
    return [];
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const source = searchParams.get("source");

    const allMatches: UnifiedMatch[] = [];

    // ── Fetch ALL 4 SOURCES in parallel ──
    // WatchFooty + DamiTV + VIPStreamed + PPV.to all work together
    const [wfMatches, damiMatches, vsMatches, ppvMatches] = await Promise.allSettled([
      (!source || source === "watchfooty") ? fetchWatchFooty() : Promise.resolve([]),
      (!source || source === "dami-tv") ? fetchDamiTV() : Promise.resolve([]),
      (!source || source === "vipstreamed") ? fetchVIPStreamed() : Promise.resolve([]),
      (!source || source === "ppv-to") ? fetchPPVto() : Promise.resolve([]),
    ]);

    // Collect all matches — WatchFooty first (has embed URLs!), then others
    if (wfMatches.status === "fulfilled") allMatches.push(...wfMatches.value);
    if (damiMatches.status === "fulfilled") allMatches.push(...damiMatches.value);
    if (vsMatches.status === "fulfilled") allMatches.push(...vsMatches.value);
    if (ppvMatches.status === "fulfilled") allMatches.push(...ppvMatches.value);

    // ── Deduplication / Merging ──
    // Strategy: First try exact title match, then try team-based fuzzy match.
    // When matches are the same game, merge their sources so each match
    // has multiple server buttons (one from each provider).
    function normalizeTeamName(name: string): string {
      return name
        .toLowerCase()
        .replace(/[^a-z0-9 ]/g, "")
        .trim()
        .replace(/\bman\b/g, "manchester")
        .replace(/\bunited\b/g, "utd")
        .replace(/\bwolverhampton\b/g, "wolves")
        .replace(/\btottenham\b/g, "spurs")
        .replace(/\bblackburn\b/g, "rovers")
        .split(/\s+/)
        .sort()
        .join(" ");
    }

    function matchesAreSame(a: UnifiedMatch, b: UnifiedMatch): boolean {
      // Exact title match
      const keyA = a.title.toLowerCase().replace(/[^a-z0-9]/g, "");
      const keyB = b.title.toLowerCase().replace(/[^a-z0-9]/g, "");
      if (keyA === keyB) return true;

      // Team-based fuzzy match
      if (a.homeTeam && a.awayTeam && b.homeTeam && b.awayTeam) {
        const aHome = normalizeTeamName(a.homeTeam);
        const aAway = normalizeTeamName(a.awayTeam);
        const bHome = normalizeTeamName(b.homeTeam);
        const bAway = normalizeTeamName(b.awayTeam);

        const directMatch = (aHome === bHome && aAway === bAway) || (aHome === bAway && aAway === bHome);
        if (directMatch) return true;

        if (a.sport === b.sport) {
          const aTeams = new Set([aHome, aAway]);
          const bTeams = new Set([bHome, bAway]);
          let overlap = 0;
          for (const t of aTeams) {
            for (const bt of bTeams) {
              if (t === bt || t.includes(bt) || bt.includes(t)) overlap++;
            }
          }
          if (overlap >= 2) return true;
          if (overlap >= 1 && a.category === b.category) {
            const aWords = new Set(a.title.toLowerCase().replace(/[^a-z0-9 ]/g, "").split(/\s+/).filter(w => w.length > 3));
            const bWords = new Set(b.title.toLowerCase().replace(/[^a-z0-9 ]/g, "").split(/\s+/).filter(w => w.length > 3));
            let wordOverlap = 0;
            for (const w of aWords) { if (bWords.has(w)) wordOverlap++; }
            if (wordOverlap >= 2) return true;
          }
        }
      }

      // Title similarity for matches without teams
      if ((!a.homeTeam || !a.awayTeam) && (!b.homeTeam || !b.awayTeam) && a.sport === b.sport) {
        const shorter = keyA.length < keyB.length ? keyA : keyB;
        const longer = keyA.length < keyB.length ? keyB : keyA;
        let matchChars = 0;
        for (let i = 0; i < shorter.length; i++) {
          if (longer.includes(shorter.slice(i, i + 4))) matchChars++;
        }
        if (matchChars / shorter.length > 0.6) return true;
      }

      return false;
    }

    const dedupedMatches: UnifiedMatch[] = [];
    for (const m of allMatches) {
      const existingIdx = dedupedMatches.findIndex(e => matchesAreSame(e, m));
      if (existingIdx >= 0) {
        const existing = dedupedMatches[existingIdx];
        // Merge sources — add any source names we don't already have
        const existingSourceKeys = new Set(existing.sources.map(s => s.source));
        for (const src of m.sources) {
          if (!existingSourceKeys.has(src.source)) {
            existing.sources.push(src);
            existingSourceKeys.add(src.source);
          } else {
            // Same source provider — merge embeds if the existing source has fewer
            const existingSrc = existing.sources.find(s => s.source === src.source);
            if (existingSrc && src.embeds && src.embeds.length > 0) {
              if (!existingSrc.embeds) existingSrc.embeds = [];
              for (const embed of src.embeds) {
                if (!existingSrc.embeds.some(e => e.url === embed.url)) {
                  existingSrc.embeds.push(embed);
                }
              }
            }
          }
        }
        // Keep richer data
        if (m.poster && !existing.poster) existing.poster = m.poster;
        if (m.homeTeam && !existing.homeTeam) existing.homeTeam = m.homeTeam;
        if (m.awayTeam && !existing.awayTeam) existing.awayTeam = m.awayTeam;
        if (m.homeLogo && !existing.homeLogo) existing.homeLogo = m.homeLogo;
        if (m.awayLogo && !existing.awayLogo) existing.awayLogo = m.awayLogo;
        if (m.league && !existing.league) existing.league = m.league;
        if ((m.viewers || 0) > (existing.viewers || 0)) existing.viewers = m.viewers;
        if (!existing._relatedIds) (existing as any)._relatedIds = [existing.id];
        (existing as any)._relatedIds.push(m.id);
      } else {
        dedupedMatches.push({ ...m, sources: [...m.sources] });
      }
    }

    // Sort: live first, then upcoming, then ended
    dedupedMatches.sort((a, b) => {
      const statusOrder = { live: 0, upcoming: 1, ended: 2 };
      return (statusOrder[a.status] || 1) - (statusOrder[b.status] || 1);
    });

    const sourceStats: Record<string, number | string> = {
      "watchfooty": wfMatches.status === "fulfilled" ? wfMatches.value.length : "error",
      "dami-tv": damiMatches.status === "fulfilled" ? damiMatches.value.length : "error",
      "vipstreamed": vsMatches.status === "fulfilled" ? vsMatches.value.length : "error",
      "ppv-to": ppvMatches.status === "fulfilled" ? ppvMatches.value.length : "error",
    };

    // ── Proxy image URLs through /api/image-proxy ──
    for (const m of dedupedMatches) {
      if (m.poster) m.poster = proxyImageUrl(m.poster);
      if (m.homeLogo) m.homeLogo = proxyImageUrl(m.homeLogo);
      if (m.awayLogo) m.awayLogo = proxyImageUrl(m.awayLogo);
      if (m.channelImage) m.channelImage = proxyImageUrl(m.channelImage);
    }

    return NextResponse.json({
      success: true,
      totalSports: dedupedMatches.length,
      totalChannels: 0,
      matches: dedupedMatches,
      channels: [],
      sources: sourceStats,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch matches" },
      { status: 500 }
    );
  }
}
