/**
 * AniWaves.ru API Client
 * ----------------------
 * AniWaves is an anime streaming site with embed-based servers.
 *
 * Flow:
 *   1. Search: GET /filter?keyword={query} → parse /watch/{slug}-{id} links
 *   2. Episodes: GET /ajax/episode/list/{watchId} → parse data-ids + data-num
 *   3. Servers: GET /ajax/server/list?servers={epId} → parse data-link-id, names, types
 *   4. Embed URL: GET /ajax/sources?id={sourceId} → returns embed URL
 *
 * Providers: Vidplay, BYFMS, DGHG, MyCloud, etc.
 * Types: sub, dub, ssub (soft sub)
 * Embed URLs are iframe embeds (play.echovideo.ru, etc.)
 */

const BASE = "https://aniwaves.ru";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

const HEADERS: Record<string, string> = {
  "User-Agent": UA,
  "Accept": "text/html,application/json,*/*",
  "Accept-Language": "en-US,en;q=0.9",
  "Referer": "https://aniwaves.ru/",
};

export interface AniWavesResult {
  provider: string;
  type: "sub" | "dub";
  streamUrl: string;
  quality: string;
  isM3U8: boolean;
  isMP4: boolean;
  isEmbed: boolean;
  hardsub: boolean;
  tracks: Array<{ url: string; lang: string; label: string }>;
  intro: { start: number; end: number } | null;
  outro: { start: number; end: number } | null;
}

// Search for anime by title
async function searchAniWaves(title: string, timeoutMs = 8000): Promise<string | null> {
  try {
    const res = await Promise.race([
      fetch(`${BASE}/filter?keyword=${encodeURIComponent(title)}`, { headers: HEADERS, cache: "no-store" }),
      new Promise<Response | null>(r => setTimeout(() => r(null), timeoutMs)),
    ]);
    if (!res || !res.ok) return null;
    const html = await res.text();
    // Parse /watch/{slug}-{id} links
    const match = html.match(/href="\/watch\/[^"]+-(\d+)"/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

// Get episode ID for a specific episode number
async function getEpisodeId(watchId: string, epNum: number, timeoutMs = 8000): Promise<string | null> {
  try {
    const res = await Promise.race([
      fetch(`${BASE}/ajax/episode/list/${watchId}`, { headers: HEADERS, cache: "no-store" }),
      new Promise<Response | null>(r => setTimeout(() => r(null), timeoutMs)),
    ]);
    if (!res || !res.ok) return null;
    const data = await res.json();
    const html = data?.result || data?.html || "";
    // Parse data-ids and data-num
    const ids = html.match(/data-ids="([^"]*)"/g) || [];
    const nums = html.match(/data-num="(\d+)"/g) || [];
    for (let i = 0; i < ids.length && i < nums.length; i++) {
      const id = ids[i].match(/data-ids="([^"]*)"/)?.[1] || "";
      const num = parseInt(nums[i].match(/(\d+)/)?.[1] || "0", 10);
      if (num === epNum && id) return id;
    }
    // Fallback: first episode
    if (ids.length > 0) return ids[0].match(/data-ids="([^"]*)"/)?.[1] || null;
    return null;
  } catch {
    return null;
  }
}

// Get servers for an episode
interface WaveServer {
  name: string;
  sourceId: string;
  type: "sub" | "dub";
}

async function getServers(epId: string, timeoutMs = 8000): Promise<WaveServer[]> {
  try {
    const res = await Promise.race([
      fetch(`${BASE}/ajax/server/list?servers=${epId}`, { headers: HEADERS, cache: "no-store" }),
      new Promise<Response | null>(r => setTimeout(() => r(null), timeoutMs)),
    ]);
    if (!res || !res.ok) return [];
    const data = await res.json();
    const html = data?.result || data?.html || "";
    const servers: WaveServer[] = [];

    // Parse data-link-id, data-sv-id, and data-type
    const linkMatches = html.match(/data-link-id="([^"]+)"/g) || [];
    const typeMatches = html.match(/data-type="(sub|dub|ssub|raw)"/g) || [];

    for (let i = 0; i < linkMatches.length; i++) {
      const sourceId = linkMatches[i].match(/data-link-id="([^"]+)"/)?.[1] || "";
      if (!sourceId) continue;
      const typeRaw = typeMatches[i]?.match(/data-type="([^"]+)"/)?.[1] || "sub";
      const type = typeRaw === "dub" ? "dub" : "sub";
      // Try to get server name from nearby text
      const nameMatch = html.match(new RegExp(`data-link-id="${sourceId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[^>]*>\\s*([^<]+)`));
      const name = nameMatch?.[1]?.trim() || `Server ${i + 1}`;
      servers.push({ name, sourceId, type });
    }

    return servers;
  } catch {
    return [];
  }
}

// Get embed URL for a server
async function getEmbedUrl(sourceId: string, timeoutMs = 8000): Promise<{ url: string; skipData?: any } | null> {
  try {
    const res = await Promise.race([
      fetch(`${BASE}/ajax/sources?id=${sourceId}&asi=0&autoPlay=0`, { headers: HEADERS, cache: "no-store" }),
      new Promise<Response | null>(r => setTimeout(() => r(null), timeoutMs)),
    ]);
    if (!res || !res.ok) return null;
    const data = await res.json();
    const result = data?.result || data;
    if (result?.url) return { url: result.url, skipData: result.skip_data };
    return null;
  } catch {
    return null;
  }
}

// Main: fetch ALL AniWaves sources
export async function fetchAniWavesSources(
  anilistId: number,
  epNum: number,
  options?: { sub?: boolean; dub?: boolean; timeoutMs?: number }
): Promise<AniWavesResult[]> {
  const wantSub = options?.sub ?? true;
  const wantDub = options?.dub ?? true;
  const timeoutMs = options?.timeoutMs ?? 8000;

  // Get title from AniList
  let title: string;
  try {
    const titleRes = await fetch("https://graphql.anilist.co", {
      method: "POST",
      headers: { "Content-Type": "application/json", "User-Agent": UA },
      body: JSON.stringify({
        query: `query($id:Int){Media(id:$id,type:ANIME){id title{english romaji native}}}`,
        variables: { id: anilistId },
      }),
      cache: "no-store",
    });
    const titleData = await titleRes.json();
    title = titleData?.data?.Media?.title?.english || titleData?.data?.Media?.title?.romaji || "";
    if (!title) return [];
  } catch {
    return [];
  }

  // Step 1: Search
  const watchId = await searchAniWaves(title, timeoutMs);
  if (!watchId) {
    console.log(`[AniWaves] no results for "${title}"`);
    return [];
  }

  // Step 2: Get episode ID
  const epId = await getEpisodeId(watchId, epNum, timeoutMs);
  if (!epId) {
    console.log(`[AniWaves] no episode ${epNum} found`);
    return [];
  }

  // Step 3: Get servers
  const servers = await getServers(epId, timeoutMs);
  if (servers.length === 0) {
    console.log(`[AniWaves] no servers for episode ${epNum}`);
    return [];
  }

  // Step 4: Get embed URLs for all servers in parallel
  const results = await Promise.allSettled(
    servers.map(async (server): Promise<AniWavesResult | null> => {
      if (server.type === "sub" && !wantSub) return null;
      if (server.type === "dub" && !wantDub) return null;

      const embedData = await getEmbedUrl(server.sourceId, timeoutMs);
      if (!embedData?.url) return null;

      // Parse skip data (intro/outro)
      let intro: { start: number; end: number } | null = null;
      let outro: { start: number; end: number } | null = null;
      if (embedData.skipData) {
        if (embedData.skipData.intro && embedData.skipData.intro[1] > 0) {
          intro = { start: embedData.skipData.intro[0], end: embedData.skipData.intro[1] };
        }
        if (embedData.skipData.outro && embedData.skipData.outro[1] > 0) {
          outro = { start: embedData.skipData.outro[0], end: embedData.skipData.outro[1] };
        }
      }

      return {
        provider: server.name,
        type: server.type,
        streamUrl: embedData.url, // embed URL — loaded in iframe directly
        quality: "auto",
        isM3U8: false,
        isMP4: false,
        isEmbed: true,
        hardsub: false,
        tracks: [],
        intro,
        outro,
      };
    })
  );

  const verified: AniWavesResult[] = [];
  for (const r of results) {
    if (r.status === "fulfilled" && r.value) verified.push(r.value);
  }

  console.log(`[AniWaves] ${verified.length}/${servers.length} servers returned embed URLs`);
  return verified;
}
