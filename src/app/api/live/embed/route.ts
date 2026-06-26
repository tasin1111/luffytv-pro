import { NextResponse } from "next/server";

// ============================================================
// LIVE STREAM RESOLVER — DamiTV + StreamFree + WatchFooty
// PRIMARY: DamiTV (https://dami-tv.pro/embed/?id={MATCH_ID})
// SECONDARY: streamfree.app (origin/miror servers + embed)
// TERTIARY: watchfooty.st (embed URLs), sportsembed.su (embed)
// NO sandbox attribute on iframes — it blocks embeds from loading
// ============================================================

export const runtime = "edge";

const TIMEOUT = 12000;
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";

function makeCtrl() { const c = new AbortController(); setTimeout(() => c.abort(), TIMEOUT); return c; }
async function GEThtml(url: string, extraHeaders: Record<string, string> = {}): Promise<string> {
  const res = await fetch(url, { signal: makeCtrl().signal, headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml", ...extraHeaders } });
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`);
  return res.text();
}
async function GETjson(url: string, extraHeaders: Record<string, string> = {}): Promise<any> {
  const res = await fetch(url, { signal: makeCtrl().signal, headers: { "User-Agent": UA, Accept: "application/json", ...extraHeaders } });
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`);
  return res.json();
}

interface StreamResult {
  id: string;
  streamNo: number;
  language: string;
  hd: boolean;
  m3u8Url: string;
  quality: string;
  source: string;
  viewers: number;
  provider: string;
  embedUrl?: string;
  corsEnabled: boolean;
  referer?: string;
  streamType: "m3u8" | "embed";
}

// ── PROVIDER 1b: streamed.pk (Multi-server sports embeds) ──
// StreamedPK provides embed URLs from multiple servers (admin, alpha, bravo, etc.)
// Sources come as "streamed-admin", "streamed-alpha", etc. with source IDs
async function resolveStreamedPK(sources: { source: string; id: string }[]): Promise<StreamResult[]> {
  const results: StreamResult[] = [];
  const sourceLabels: Record<string, string> = {
    admin: "Admin", alpha: "Alpha", bravo: "Bravo", charlie: "Charlie",
    delta: "Delta", echo: "Echo", foxtrot: "Foxtrot", golf: "Golf",
    hotel: "Hotel", intel: "Intel",
  };

  const resolvePromises = sources.map(async (src) => {
    const serverResults: StreamResult[] = [];
    try {
      // Extract the server name from "streamed-{server}"
      const serverName = src.source.replace("streamed-", "");
      const res = await fetch(`https://streamed.pk/api/stream/${serverName}/${encodeURIComponent(src.id)}`, {
        signal: makeCtrl().signal,
        headers: { "User-Agent": UA, Accept: "application/json" },
      });
      if (!res.ok) return serverResults;
      const data = await res.json();
      if (!Array.isArray(data)) return serverResults;

      for (const stream of data) {
        if (stream.embedUrl) {
          const label = sourceLabels[serverName] || serverName.charAt(0).toUpperCase() + serverName.slice(1);
          serverResults.push({
            id: `sp-${serverName}-${src.id}-${stream.streamNo || serverResults.length}`,
            streamNo: stream.streamNo || serverResults.length + 1,
            language: stream.language || "English",
            hd: stream.hd !== false,
            m3u8Url: "",
            quality: stream.hd ? "720p" : "SD",
            source: `StreamedPK ${label}`,
            viewers: 0,
            provider: "streamedpk",
            corsEnabled: false,
            referer: "https://streamed.pk/",
            embedUrl: stream.embedUrl,
            streamType: "embed",
          });
        }
      }
    } catch {}
    return serverResults;
  });

  const allResults = await Promise.allSettled(resolvePromises);
  for (const r of allResults) {
    if (r.status === "fulfilled") results.push(...r.value);
  }
  return results;
}

// ── PROVIDER 2: streamfree.app (CDN has CORS!) ──
async function resolveStreamfree(category: string, streamKey: string): Promise<StreamResult[]> {
  const results: StreamResult[] = [];

  try {
    const embedUrl = `https://streamfree.app/embed/${category}/${streamKey}?quality=1080p&category=${category}&server=origin`;
    const html = await GEThtml(embedUrl, { Referer: "https://streamfree.app/" });

    let tokens: Record<string, { _t: string; _e: number; _n: string }> = {};

    const patterns = [
      new RegExp('const\\s+_0x\\s*=\\s*(\\{[^}]+\\})', 's'),
      new RegExp('var\\s+_0x\\s*=\\s*(\\{[^}]+\\})', 's'),
      new RegExp('window\\._0x\\s*=\\s*(\\{[^}]+\\})', 's'),
    ];

    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match) {
        try {
          let jsonStr = match[1].replace(/'/g, '"').replace(/(\w+)\s*:/g, '"$1":').replace(/""/g, '"');
          tokens = JSON.parse(jsonStr);
          break;
        } catch { continue; }
      }
    }

    if (Object.keys(tokens).length === 0) {
      const tokenRegex = /"(\d{3,4}p)"\s*:\s*\{[^}]*"_t"\s*:\s*"([^"]+)"[^}]*"_e"\s*:\s*(\d+)[^}]*"_n"\s*:\s*"([^"]+)"[^}]*\}/g;
      let m;
      while ((m = tokenRegex.exec(html)) !== null) {
        tokens[m[1]] = { _t: m[2], _e: parseInt(m[3]), _n: m[4] };
      }
    }

    if (Object.keys(tokens).length === 0) {
      const anyToken = html.match(/"_t"\s*:\s*"([^"]+)"/);
      const anyExpiry = html.match(/"_e"\s*:\s*(\d+)/);
      const anyNonce = html.match(/"_n"\s*:\s*"([^"]+)"/);
      if (anyToken && anyExpiry && anyNonce) {
        tokens["720p"] = { _t: anyToken[1], _e: parseInt(anyExpiry[1]), _n: anyNonce[1] };
      }
    }

    if (Object.keys(tokens).length === 0) {
      const m3u8Match = html.match(/https?:\/\/[^\s"']+\.m3u8[^\s"']*/);
      if (m3u8Match) {
        results.push({
          id: `sf-direct-${streamKey}`, streamNo: 1, language: "English", hd: true,
          m3u8Url: m3u8Match[0], quality: "720p", source: "StreamFree", viewers: 0,
          provider: "streamfree", corsEnabled: true, referer: "https://streamfree.app/",
          streamType: "m3u8",
        });
        return results;
      }
      return [];
    }

    let cdnDomain = "https://streamfree.app";
    try {
      const keyData = await GETjson(`https://streamfree.app/get-stream-key/${streamKey}`, { Referer: "https://streamfree.app/" });
      if (keyData.server_domain) cdnDomain = keyData.server_domain.replace(/\/$/, "");
    } catch {
      try {
        const cdnData = await GETjson(`https://streamfree.app/get-stream-key/${streamKey}?force_server=cdn`, { Referer: "https://streamfree.app/" });
        if (cdnData.server_domain) cdnDomain = cdnData.server_domain.replace(/\/$/, "");
      } catch {}
    }

    let streamNo = 1;
    const qualityOrder = ["2160p", "1080p", "720p", "540p"];
    for (const quality of qualityOrder) {
      const token = tokens[quality];
      if (!token) continue;
      const m3u8Url = `${cdnDomain}/live/${streamKey}${quality}/index.m3u8?_t=${encodeURIComponent(token._t)}&_e=${token._e}&_n=${encodeURIComponent(token._n)}`;
      results.push({
        id: `sf-${quality}-${streamKey}`, streamNo, language: "English", hd: quality !== "540p",
        m3u8Url, quality, source: `StreamFree ${quality}`, viewers: 0, provider: "streamfree",
        corsEnabled: true, referer: "https://streamfree.app/", streamType: "m3u8",
      });
      streamNo++;
    }

    // StreamFree embed with proper format: /embed/{category}/{key}?quality=1080p&category={cat}&server=origin
    const streamfreeEmbedUrl = `https://streamfree.app/embed/${category}/${streamKey}?quality=1080p&category=${category}&server=origin`;
    results.push({
      id: `sf-embed-${streamKey}`, streamNo, language: "English", hd: true,
      m3u8Url: "", quality: "1080p", source: "StreamFree Origin", viewers: 0, provider: "streamfree",
      corsEnabled: false, referer: "https://streamfree.app/", embedUrl: streamfreeEmbedUrl, streamType: "embed",
    });
    // Also add miror server as backup
    const mirorEmbedUrl = `https://streamfree.app/embed/${category}/${streamKey}?quality=1080p&category=${category}&server=miror`;
    results.push({
      id: `sf-embed-miror-${streamKey}`, streamNo: streamNo + 1, language: "English", hd: true,
      m3u8Url: "", quality: "1080p", source: "StreamFree Miror", viewers: 0, provider: "streamfree",
      corsEnabled: false, referer: "https://streamfree.app/", embedUrl: mirorEmbedUrl, streamType: "embed",
    });
  } catch (err: any) {
    if (category && streamKey) {
      // Fallback embed with proper format
      results.push({
        id: `sf-embed-fallback-${streamKey}`, streamNo: 1, language: "English", hd: true,
        m3u8Url: "", quality: "1080p", source: "StreamFree Origin", viewers: 0, provider: "streamfree",
        corsEnabled: false, referer: "https://streamfree.app/",
        embedUrl: `https://streamfree.app/embed/${category}/${streamKey}?quality=1080p&category=${category}&server=origin`,
        streamType: "embed",
      });
      results.push({
        id: `sf-embed-miror-fallback-${streamKey}`, streamNo: 2, language: "English", hd: true,
        m3u8Url: "", quality: "1080p", source: "StreamFree Miror", viewers: 0, provider: "streamfree",
        corsEnabled: false, referer: "https://streamfree.app/",
        embedUrl: `https://streamfree.app/embed/${category}/${streamKey}?quality=1080p&category=${category}&server=miror`,
        streamType: "embed",
      });
    }
  }

  return results;
}

// ── PROVIDER 3: dami-tv.pro ──
// Correct embed URLs from DamiTV API docs:
// - Sports matches: https://dami-tv.pro/embed/?id={MATCH_ID} (URL-encoded)
// - TV channels: https://dami-tv.pro/cdn-stream/{CHANNEL_NAME} (URL-encoded)
// DO NOT use /player/hls/ — it returns 403 Forbidden
async function resolveDamiTV(matchId: string, matchName: string): Promise<StreamResult[]> {
  const results: StreamResult[] = [];
  try {
    const displayName = matchName || matchId;

    // Check if matchId is a numeric channel ID (for TV channels)
    const isNumericId = /^\d+$/.test(matchId);

    if (isNumericId) {
      // TV channel: Use /cdn-stream/{name} as PRIMARY (works for TV channels)
      // Also try /embed/?ch={numericId} as a secondary option
      const encodedName = encodeURIComponent(displayName || `Channel ${matchId}`);

      // PRIMARY: cdn-stream — this is the correct URL for TV channels
      results.push({
        id: `dami-cdn-${matchId}`, streamNo: 1, language: "English", hd: true,
        m3u8Url: "", quality: "720p", source: "DamiTV Stream", viewers: 0, provider: "damitv",
        corsEnabled: false, referer: "https://dami-tv.pro/",
        embedUrl: `https://dami-tv.pro/cdn-stream/${encodedName}`,
        streamType: "embed",
      });

      // SECONDARY: /embed/?ch={numericId} — uses resolve API internally
      results.push({
        id: `dami-embed-ch-${matchId}`, streamNo: 2, language: "English", hd: true,
        m3u8Url: "", quality: "720p", source: "DamiTV Player", viewers: 0, provider: "damitv",
        corsEnabled: false, referer: "https://dami-tv.pro/",
        embedUrl: `https://dami-tv.pro/embed/?ch=${matchId}`,
        streamType: "embed",
      });
    } else {
      // Sports match: Use /embed/?id={MATCH_ID} — this is the CORRECT embed URL
      // The matchId is the uri_name like "mlb/2026-05-27/mia-tor" or "roland-garros-tnt-sports-1"
      // Extract channel name from the displayName if present (e.g., "Roland-Garros: TNT Sports 1")
      const channelSuffix = displayName.includes(":") ? displayName.split(":").pop()?.trim() : "";
      const sourceLabel = channelSuffix ? `DamiTV ${channelSuffix}` : "DamiTV Embed";
      results.push({
        id: `dami-embed-${matchId}`, streamNo: 1, language: "English", hd: true,
        m3u8Url: "", quality: "720p", source: sourceLabel, viewers: 0, provider: "damitv",
        corsEnabled: false, referer: "https://dami-tv.pro/",
        embedUrl: `https://dami-tv.pro/embed/?id=${encodeURIComponent(matchId)}`,
        streamType: "embed",
      });
    }
  } catch {}
  return results;
}

// ── PROVIDER 4: watchfooty.st ──
async function resolveWatchfooty(matchId: number): Promise<StreamResult[]> {
  const results: StreamResult[] = [];
  try {
    const data = await GETjson(`https://api.watchfooty.st/api/v1/match/${matchId}`);
    const streams = data.streams || [];
    let streamNo = 1;
    for (const s of streams) {
      if (!s.url) continue;
      const label = `${s.language || "English"} ${s.quality || "HD"}`.trim();
      results.push({
        id: `wf-embed-${matchId}-${streamNo}`, streamNo, language: s.language || "English",
        hd: s.quality === "hd" || s.quality === "HD", m3u8Url: "", quality: s.quality === "hd" || s.quality === "HD" ? "720p" : "480p",
        source: `WatchFooty ${label}`, viewers: 0, provider: "watchfooty",
        corsEnabled: false, referer: "https://watchfooty.st/", embedUrl: s.url, streamType: "embed",
      });
      streamNo++;
    }
  } catch {}
  return results;
}

// ── PROVIDER 5: sportsembed.su ──
async function resolveSportsembedSu(category: string, matchId: string): Promise<StreamResult[]> {
  const results: StreamResult[] = [];
  try {
    const embedUrl = `https://sportsembed.su/embed/${category}/${matchId}`;
    const html = await GEThtml(embedUrl, { Referer: "https://sportsembed.su/" });
    const m3u8Matches = html.match(/https?:\/\/[^\s"']+\.m3u8[^\s"']*/g);
    if (m3u8Matches) {
      const seen = new Set<string>();
      for (const url of m3u8Matches) {
        if (seen.has(url)) continue; seen.add(url);
        results.push({
          id: `se-${category}-${matchId}-${results.length + 1}`, streamNo: results.length + 1,
          language: "English", hd: results.length === 0, m3u8Url: url,
          quality: results.length === 0 ? "720p" : "480p", source: "SportsEmbed", viewers: 0,
          provider: "sportsembed", corsEnabled: false, referer: "https://sportsembed.su/",
          embedUrl, streamType: "m3u8",
        });
      }
    }
  } catch {}
  return results;
}

// ── PROVIDER 6: embedsports.top ──
// Generates embed URLs based on sport category
// Pattern: https://embedsports.top/embed/admin/admin-{slug}/1
async function resolveEmbedsportsTop(sport: string, homeTeam: string, awayTeam: string, streamKey: string): Promise<StreamResult[]> {
  const results: StreamResult[] = [];

  // Map our sport categories to embedsports.top slugs
  const sportSlugMap: Record<string, string[]> = {
    cricket: ["willow-cricket", "sky-sports-cricket"],
    tennis: ["tennis-channel", "sky-sports-tennis"],
    "motor-sports": ["sky-sports-f1", "rally-tv"],
    racing: ["sky-sports-f1", "rally-tv"],
    football: ["sky-sports-football", "sky-sports-main-event"],
    soccer: ["sky-sports-football", "sky-sports-main-event"],
    basketball: ["espn"],
    "american-football": ["espn"],
    baseball: ["espn"],
    hockey: ["espn"],
    fight: ["sky-sports-action"],
    combat: ["sky-sports-action"],
    golf: ["sky-sports-golf"],
    rugby: ["sky-sports-action"],
  };

  // Also check streamKey for known channel mappings
  const channelSlugMap: Record<string, string> = {
    willow: "willow-cricket",
    cricketsky: "willow-cricket",
    skytennis: "tennis-channel",
    skyf1: "sky-sports-f1",
    skysportsgolf: "sky-sports-golf",
    skysportsfootball: "sky-sports-football",
    skysports: "sky-sports-main-event",
    skysportsmainevent: "sky-sports-main-event",
    skysportsaction: "sky-sports-action",
    skysportsarena: "sky-sports-arena",
    skysportsnews: "sky-sports-news",
    tntsports1: "tnt-sports",
    btsport: "tnt-sports",
    espn: "espn",
    cbc: "espn",
    bbc: "sky-sports-main-event",
    supersport: "sky-sports-main-event",
    rallytv: "rally-tv",
  };

  // If streamKey matches a known channel, use that slug
  const keyLower = (streamKey || "").toLowerCase();
  if (channelSlugMap[keyLower]) {
    const slug = channelSlugMap[keyLower];
    // Add multiple server options for known channels
    const maxServers = (keyLower === "willow" || keyLower === "cricketsky") ? 6 :
                       (keyLower === "skytennis" || keyLower === "tntsports1" || keyLower === "skyf1") ? 2 : 1;
    for (let i = 1; i <= maxServers; i++) {
      results.push({
        id: `es-ch-${slug}-${i}`, streamNo: i, language: "English", hd: true,
        m3u8Url: "", quality: "720p", source: `EmbedSports Server ${i}`, viewers: 0,
        provider: "embedsports", corsEnabled: false, referer: "https://embedsports.top/",
        embedUrl: `https://embedsports.top/embed/admin/admin-${slug}/${i}`,
        streamType: "embed",
      });
    }
    return results;
  }

  // Otherwise, add embeds based on sport category
  const slugs = sportSlugMap[sport] || [];
  for (const slug of slugs) {
    const maxServers = (sport === "cricket" || sport === "tennis") ? 2 : 1;
    for (let i = 1; i <= maxServers; i++) {
      results.push({
        id: `es-${sport}-${slug}-${i}`, streamNo: results.length + 1, language: "English", hd: true,
        m3u8Url: "", quality: "720p", source: `EmbedSports ${slug.replace(/-/g, " ")} ${i}`, viewers: 0,
        provider: "embedsports", corsEnabled: false, referer: "https://embedsports.top/",
        embedUrl: `https://embedsports.top/embed/admin/admin-${slug}/${i}`,
        streamType: "embed",
      });
    }
  }

  return results;
}

// ── MAIN HANDLER ──
export async function GET(req: Request) {
  const url = new URL(req.url);
  const provider = url.searchParams.get("provider") || "";
  const streamKey = url.searchParams.get("streamKey") || "";
  const streamCategory = url.searchParams.get("streamCategory") || "";
  const channelCode = url.searchParams.get("channelCode") || "";
  const damitvId = url.searchParams.get("damitvId") || "";
  const damitvName = url.searchParams.get("damitvName") || "";
  const damitvIds = url.searchParams.get("damitvIds") || ""; // JSON array: [{id, name}]
  const watchfootyId = url.searchParams.get("watchfootyId") || "";
  const sources = url.searchParams.get("sources") || "";
  const matchId = url.searchParams.get("matchId") || "";
  const homeTeam = url.searchParams.get("homeTeam") || "";
  const awayTeam = url.searchParams.get("awayTeam") || "";
  const sport = url.searchParams.get("sport") || "";

  if (!provider && !matchId) {
    return NextResponse.json({ error: "Missing provider or matchId" }, { status: 400 });
  }

  let parsedSources: { source: string; id: string }[] = [];
  if (sources) {
    try { parsedSources = JSON.parse(sources); if (!Array.isArray(parsedSources)) parsedSources = []; } catch { parsedSources = []; }
  }

  // Parse damitvIds (multiple DamiTV channel entries for the same match)
  let parsedDamitvIds: { id: string; name: string; embed?: string }[] = [];
  if (damitvIds) {
    try { parsedDamitvIds = JSON.parse(damitvIds); if (!Array.isArray(parsedDamitvIds)) parsedDamitvIds = []; } catch { parsedDamitvIds = []; }
  }

  const resolvePromises: Promise<StreamResult[]>[] = [];

  // ── PRIORITY 0: DamiTV pre-built embed URLs from the API ──
  // The DamiTV /papi/api/streams response includes `iframe` and `embed` fields
  // that already have the correct embed URLs. Use those directly instead of
  // constructing our own — this is the most reliable approach.
  for (const dEntry of parsedDamitvIds) {
    if (dEntry.embed) {
      const channelSuffix = dEntry.name?.includes(":") ? dEntry.name.split(":").pop()?.trim() : "";
      const sourceLabel = channelSuffix ? `DamiTV ${channelSuffix}` : "DamiTV Embed";
      resolvePromises.push(Promise.resolve([{
        id: `dami-api-${dEntry.id}`, streamNo: resolvePromises.length + 1, language: "English", hd: true,
        m3u8Url: "", quality: "720p", source: sourceLabel, viewers: 0, provider: "damitv",
        corsEnabled: false, referer: "https://dami-tv.pro/",
        embedUrl: dEntry.embed, streamType: "embed" as const,
      }]));
    }
  }

  // ── PRIORITY 1: DamiTV (if damitvId or damitvIds provided) — also generate embed URLs ──
  // Resolve EACH DamiTV ID as a separate stream/server option
  // This generates embed URLs using the correct /embed/?id={MATCH_ID} format
  if (parsedDamitvIds.length > 0) {
    // Resolve each DamiTV ID separately — each becomes its own server option
    for (const dEntry of parsedDamitvIds) {
      resolvePromises.push(resolveDamiTV(dEntry.id, dEntry.name));
    }
  } else if (damitvId) {
    // Fallback: single damitvId
    resolvePromises.push(resolveDamiTV(damitvId, damitvName));
  }

  // ── PRIORITY 2: streamfree (needs streamKey + streamCategory) ──
  if (streamKey && streamCategory) {
    resolvePromises.push(resolveStreamfree(streamCategory, streamKey));
  }

  // ── PRIORITY 2b: StreamedPK (needs sources array with streamed-* entries) ──
  const streamedSources = parsedSources.filter(s => s.source.startsWith("streamed-") && s.id);
  if (streamedSources.length > 0) {
    resolvePromises.push(resolveStreamedPK(streamedSources));
  }

  // Helper: clean matchId by stripping prefixes
  const cleanMatchId = matchId.replace(/^(espn|wf|sp|sf|cdn|dami|se|es)-/i, "");

  // ── PRIORITY 3: WatchFooty ──
  if (watchfootyId) {
    resolvePromises.push(resolveWatchfooty(parseInt(watchfootyId)));
  }

  // ── PRIORITY 4: SportsEmbed ──
  const sportsrcCategory = url.searchParams.get("sportsrcCategory") || streamCategory || "sports";
  const sportsrcId = url.searchParams.get("sportsrcId") || matchId || "";
  if (sportsrcId) {
    resolvePromises.push(resolveSportsembedSu(sportsrcCategory, sportsrcId));
  }

  // ── PRIORITY 5: EmbedSports.top — add sport-specific embed links ──
  // Only add if we have a sport category and either a streamKey or team names
  if (sport && (streamKey || homeTeam || awayTeam)) {
    resolvePromises.push(resolveEmbedsportsTop(sport, homeTeam, awayTeam, streamKey));
  }

  // ── PRIORITY 6: PPV.to — direct iframe embed URLs ──
  // PPV.to sources have embed URLs stored directly in the source id field
  const ppvSources = parsedSources.filter(s => s.source === "ppv-to" && s.id);
  if (ppvSources.length > 0) {
    const ppvStreams: StreamResult[] = ppvSources.map((src, idx) => ({
      id: `ppv-embed-${idx}`, streamNo: resolvePromises.length + idx + 1, language: "English", hd: true,
      m3u8Url: "", quality: "720p", source: `PPV.to Server ${idx + 1}`, viewers: 0,
      provider: "ppv-to", corsEnabled: false, referer: "https://ppv.to/",
      embedUrl: src.id, streamType: "embed" as const,
    }));
    resolvePromises.push(Promise.resolve(ppvStreams));
  }

  // ── PRIORITY 7: VIPStreamed — direct iframe embed URLs ──
  // VIPStreamed sources may have embed URLs stored in the source id field
  const vsSources = parsedSources.filter(s => s.source === "vipstreamed" && s.id);
  if (vsSources.length > 0) {
    const vsStreams: StreamResult[] = vsSources.map((src, idx) => ({
      id: `vs-embed-${idx}`, streamNo: resolvePromises.length + idx + 1, language: "English", hd: true,
      m3u8Url: "", quality: "720p", source: `VIPStreamed Server ${idx + 1}`, viewers: 0,
      provider: "vipstreamed", corsEnabled: false, referer: "",
      embedUrl: src.id, streamType: "embed" as const,
    }));
    resolvePromises.push(Promise.resolve(vsStreams));
  }

  // Fallback: if no providers matched at all, try SportsEmbed only
  // DO NOT add DamiTV as fallback — it shows broken streams for matches it doesn't have
  if (resolvePromises.length === 0 && matchId) {
    resolvePromises.push(resolveSportsembedSu("sports", cleanMatchId));
  }

  const allResults = await Promise.all(resolvePromises);
  const allStreams = allResults.flat();

  // Deduplicate
  const seen = new Set<string>();
  const uniqueStreams = allStreams.filter(s => {
    const key = s.streamType === "m3u8" && s.m3u8Url ? s.m3u8Url : (s.embedUrl || `${s.id}`);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Sort: DamiTV CDN first, WatchFooty second, StreamedPK third, PPV.to fourth, VIPStreamed fifth, other embeds, M3U8 last
  const providerPriority: Record<string, number> = { damitv: 1, watchfooty: 2, streamedpk: 3, "ppv-to": 4, vipstreamed: 5 };
  const qualityOrder: Record<string, number> = { "2160p": 1, "1080p": 2, "HD": 2, "720p": 3, "SD": 4, "540p": 5, "480p": 6 };
  uniqueStreams.sort((a, b) => {
    // Provider priority: DamiTV > WatchFooty > StreamedPK > others
    const aPrio = providerPriority[a.provider] || 99;
    const bPrio = providerPriority[b.provider] || 99;
    if (aPrio !== bPrio) return aPrio - bPrio;
    // Within same provider: embed before M3U8
    if (a.streamType === "embed" && b.streamType !== "embed") return -1;
    if (a.streamType !== "embed" && b.streamType === "embed") return 1;
    // Then by CORS
    if (a.corsEnabled && !b.corsEnabled) return -1;
    if (!a.corsEnabled && b.corsEnabled) return 1;
    return (qualityOrder[a.quality] || 99) - (qualityOrder[b.quality] || 99);
  });

  return NextResponse.json({
    streams: uniqueStreams,
    total: uniqueStreams.length,
    hasCORSStream: uniqueStreams.some(s => s.corsEnabled),
    hasEmbedStream: uniqueStreams.some(s => s.streamType === "embed"),
  });
}
