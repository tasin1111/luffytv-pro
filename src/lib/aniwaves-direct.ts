/**
 * AniWaves Direct — scraper for aniwaves.ru
 *
 * AniWaves has a big library with multiple servers (Vidplay, MyCloud, etc.)
 * and NO login required to watch.
 *
 * Pipeline:
 *   1. Search: GET /ajax/anime/search?keyword={title} → parse slug from HTML
 *   2. Episode list: GET /ajax/episode/list/{animeId} → get episode data-ids
 *   3. Server list: GET /ajax/server/list?servers={animeId}&eps={epNum} → get server link-ids
 *   4. Sources: GET /ajax/sources?id={linkId} → get stream URL + skip data
 *
 * All endpoints return JSON with HTML in the "result" field.
 * No login required — all public AJAX endpoints.
 */

const ANIWAVES_BASE = "https://aniwaves.ru";

const HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.5",
  "X-Requested-With": "XMLHttpRequest",
  Referer: "https://aniwaves.ru/",
};

// ── Caches ──
const slugCache = new Map<number, { slug: string; animeId: string } | null>();
const CACHE_TTL = 60 * 60 * 1000;
const cacheTimestamps = new Map<string, number>();

function isCacheFresh(key: string): boolean {
  const ts = cacheTimestamps.get(key);
  if (!ts) return false;
  return Date.now() - ts < CACHE_TTL;
}

// ── Types ──
export interface AniWavesServer {
  name: string;
  serverId: string;
  streamUrl: string;
  type: "sub" | "dub";
  intro: { start: number; end: number } | null;
  outro: { start: number; end: number } | null;
}

export interface AniWavesResult {
  servers: AniWavesServer[];
  slug: string;
  animeId: string;
}

// ── Step 1: Search → slug + anime ID ──
async function resolveSlug(anilistId: number, title: string): Promise<{ slug: string; animeId: string } | null> {
  const cacheKey = `aniwaves:${anilistId}`;
  if (slugCache.has(anilistId) && isCacheFresh(cacheKey)) {
    return slugCache.get(anilistId)!;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(
      `${ANIWAVES_BASE}/ajax/anime/search?keyword=${encodeURIComponent(title)}`,
      { headers: HEADERS, signal: controller.signal },
    );
    clearTimeout(timeout);

    if (!res.ok) return null;

    const data = await res.json();
    const html: string = data?.result?.html || "";

    // Extract slug from href="/watch/{slug}"
    const match = html.match(/href="\/watch\/([^"]+)"/);
    if (!match) {
      slugCache.set(anilistId, null);
      cacheTimestamps.set(cacheKey, Date.now());
      return null;
    }

    const slug = match[1];
    const animeId = slug.match(/(\d+)$/)?.[1] || "";

    console.log(`[aniwaves-direct] AniList ${anilistId} → slug "${slug}" (id: ${animeId})`);
    const result = { slug, animeId };
    slugCache.set(anilistId, result);
    cacheTimestamps.set(cacheKey, Date.now());
    return result;
  } catch (err) {
    console.error(`[aniwaves-direct] resolveSlug error:`, err);
    slugCache.set(anilistId, null);
    cacheTimestamps.set(cacheKey, Date.now());
    return null;
  }
}

// ── Step 2: Get server list for an episode ──
async function getServerList(
  animeId: string,
  epNum: number,
  slug: string,
): Promise<Array<{ serverId: string; linkId: string; name: string; type: string }>> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(
      `${ANIWAVES_BASE}/ajax/server/list?servers=${animeId}&eps=${epNum}`,
      {
        headers: { ...HEADERS, Referer: `${ANIWAVES_BASE}/watch/${slug}` },
        signal: controller.signal,
      },
    );
    clearTimeout(timeout);

    if (!res.ok) return [];

    const data = await res.json();
    const html: string = data?.result || "";

    // Parse server entries: data-sv-id="4" data-link-id="..." ...>ServerName
    const serverPattern = /data-sv-id="(\d+)"[^>]*data-link-id="([^"]+)"[^>]*>([^<]+)/g;
    const matches = [...html.matchAll(serverPattern)];

    // Also find the type (sub/dub) for each server
    const typePattern = /data-type="(sub|dub)"/g;
    const types: string[] = [];
    let typeMatch;
    while ((typeMatch = typePattern.exec(html)) !== null) {
      types.push(typeMatch[1]);
    }

    const servers: Array<{ serverId: string; linkId: string; name: string; type: string }> = [];
    let currentType = "sub";

    for (let i = 0; i < matches.length; i++) {
      const [, serverId, linkId, name] = matches[i];
      // Try to match type — if we've passed a type boundary, switch
      // This is a simplification — the HTML has type sections
      servers.push({
        serverId,
        linkId,
        name: name.trim(),
        type: i < (types.length > 1 ? Math.floor(matches.length / types.length) : matches.length) ? "sub" : "dub",
      });
    }

    return servers;
  } catch (err) {
    console.error(`[aniwaves-direct] getServerList error:`, err);
    return [];
  }
}

// ── Step 3: Get stream URL from a server ──
async function getStreamUrl(
  linkId: string,
  slug: string,
): Promise<{ url: string; intro: any; outro: any } | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(
      `${ANIWAVES_BASE}/ajax/sources?id=${encodeURIComponent(linkId)}`,
      {
        headers: { ...HEADERS, Referer: `${ANIWAVES_BASE}/watch/${slug}` },
        signal: controller.signal,
      },
    );
    clearTimeout(timeout);

    if (!res.ok) return null;

    const data = await res.json();
    if (data?.status !== 200) return null;

    const result = data?.result;
    if (!result || typeof result === "string") return null;

    const url = result.url || "";
    if (!url) return null;

    // Parse skip data
    const skipData = result.skip_data || {};
    const intro = skipData.intro && skipData.intro[0] > 0
      ? { start: skipData.intro[0], end: skipData.intro[1] }
      : null;
    const outro = skipData.outro && skipData.outro[0] > 0
      ? { start: skipData.outro[0], end: skipData.outro[1] }
      : null;

    return { url, intro, outro };
  } catch {
    return null;
  }
}

// ── Main: resolve all servers for AniList ID + episode ──
export async function resolveAniWaves(
  anilistId: number,
  epNum: number,
  title: string,
): Promise<AniWavesResult | null> {
  try {
    const resolved = await resolveSlug(anilistId, title);
    if (!resolved) return null;

    const { slug, animeId } = resolved;

    // Get server list
    const servers = await getServerList(animeId, epNum, slug);
    if (servers.length === 0) return null;

    // Get stream URLs for ALL servers in parallel (limit to first 5)
    const results = await Promise.all(
      servers.slice(0, 5).map(async (srv) => {
        const stream = await getStreamUrl(srv.linkId, slug);
        if (!stream) return null;
        return {
          name: srv.name,
          serverId: srv.serverId,
          streamUrl: stream.url,
          type: srv.type as "sub" | "dub",
          intro: stream.intro,
          outro: stream.outro,
        };
      }),
    );

    const validServers = results.filter((r): r is AniWavesServer => r !== null);
    if (validServers.length === 0) return null;

    console.log(`[aniwaves-direct] AniList ${anilistId} ep ${epNum}: ${validServers.length} servers`);

    return { servers: validServers, slug, animeId };
  } catch (err) {
    console.error(`[aniwaves-direct] resolveAniWaves error:`, err);
    return null;
  }
}
