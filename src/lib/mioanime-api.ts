/**
 * MioAnime Multi-Source API Client
 * --------------------------------
 * Based on github.com/Varomine/MioAnime/src/services
 * Aggregates 4 public Cloudflare Worker APIs:
 *
 * 1. AniZone — HLS m3u8 + subtitles (anizone-api.mdtahseen7378.workers.dev)
 * 2. Verse — Direct MP4 (animeverse-scraper-api.sapis.workers.dev)
 * 3. Senshi — HLS m3u8 via ninstream.com (senshi-api.sapis.workers.dev)
 * 4. AllAnime — MP4 direct (allanime-api.mdtahseen7378.workers.dev)
 *
 * All APIs are public, no auth needed, no Cloudflare challenge.
 */

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

import { wrapStreamUrl } from "./proxy";

const HEADERS: Record<string, string> = {
  "User-Agent": UA,
  Accept: "application/json, text/plain, */*",
};

export interface MioSource {
  id: string;
  name: string;
  type: "sub" | "dub";
  streamUrl: string;
  quality: string;
  isM3U8: boolean;
  isMP4: boolean;
  isEmbed?: boolean; // ← embed URLs (flixcloud.cc, animegg.org/embed/...) loaded in iframe
  hardsub: boolean;
  subtitleTracks: Array<{ url: string; lang: string; label: string }>;
}

// ─── AniList ID → Title resolver ──────────────────────────────────────────────

const titleCache = new Map<number, string | null>();

async function resolveTitle(anilistId: number): Promise<string | null> {
  if (titleCache.has(anilistId)) return titleCache.get(anilistId)!;
  try {
    const res = await fetch("https://graphql.anilist.co", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: "query($id:Int){Media(id:$id,type:ANIME){id title{romaji english}}}",
        variables: { id: anilistId },
      }),
      cache: "no-store",
    });
    if (!res.ok) { titleCache.set(anilistId, null); return null; }
    const data = await res.json();
    const title = data?.data?.Media?.title?.english || data?.data?.Media?.title?.romaji;
    titleCache.set(anilistId, title || null);
    return title || null;
  } catch { titleCache.set(anilistId, null); return null; }
}

// ─── 1. AniZone ───────────────────────────────────────────────────────────────

const ANIZONE_API = "https://anizone-api.mdtahseen7378.workers.dev";

async function fetchAniZone(title: string, epNum: number, timeoutMs: number): Promise<MioSource[]> {
  try {
    // Search
    const searchRes = await fetch(`${ANIZONE_API}/search?q=${encodeURIComponent(title)}`, {
      headers: HEADERS, cache: "no-store",
    });
    if (!searchRes.ok) return [];
    const searchData = await searchRes.json();
    const items = searchData?.data || [];
    if (!items.length) return [];

    // Find the anime (first match or by title)
    const anime = items[0];
    const animeId = anime.id;

    // Get episodes
    const epRes = await fetch(`${ANIZONE_API}/episodes/${animeId}`, {
      headers: HEADERS, cache: "no-store",
    });
    if (!epRes.ok) return [];
    const epData = await epRes.json();
    const episodes = epData?.data || [];
    const ep = episodes.find((e: any) => e.number === epNum) || episodes[0];
    if (!ep) return [];

    // Get sources
    const srcRes = await fetch(`${ANIZONE_API}/sources?id=${animeId}&episodeId=${encodeURIComponent(ep.id)}`, {
      headers: HEADERS, cache: "no-store",
    });
    if (!srcRes.ok) return [];
    const srcData = await srcRes.json();
    const sources = srcData?.data?.sources || [];
    const subtitles = srcData?.data?.subtitles || [];

    const results: MioSource[] = [];
    for (const src of sources) {
      if (!src.url) continue;
      // Route the DIRECT stream URL through our worker.
      // Worker adds Referer: https://anizone.to (from REFERER_MAP) + CORS headers.
      // OLD approach used cdn.animex.su XOR wrapper — DEAD as of 2026-06-25.
      const proxyUrl = wrapStreamUrl(src.url);

      results.push({
        id: `anizone:${ep.id}`,
        name: "AniZone",
        type: "sub",
        streamUrl: proxyUrl,
        quality: "auto",
        isM3U8: src.isM3U8 || src.type === "hls",
        isMP4: src.type === "mp4",
        hardsub: false,
        subtitleTracks: subtitles.map((s: any) => ({
          url: s.url || "",
          lang: s.lang || "en",
          label: s.label || "English",
        })).filter((s: any) => s.url),
      });
    }
    return results;
  } catch { return []; }
}

// ─── 2. Verse ─────────────────────────────────────────────────────────────────

const VERSE_API = "https://animeverse-scraper-api.sapis.workers.dev";

async function fetchVerse(title: string, epNum: number, timeoutMs: number): Promise<MioSource[]> {
  try {
    const searchRes = await fetch(`${VERSE_API}/api/search?q=${encodeURIComponent(title)}`, {
      headers: HEADERS, cache: "no-store",
    });
    if (!searchRes.ok) return [];
    const searchData = await searchRes.json();
    const items = searchData?.items || [];
    if (!items.length) return [];

    // Find best match (prefer exact title match)
    const anime = items.find((i: any) => i.title?.toLowerCase() === title.toLowerCase()) || items[0];
    if (!anime?.slug) return [];

    // Get stream
    const streamRes = await fetch(`${VERSE_API}/api/anime/${anime.slug}/stream/${epNum}`, {
      headers: HEADERS, cache: "no-store",
    });
    if (!streamRes.ok) return [];
    const streamData = await streamRes.json();
    if (!streamData?.stream) return [];

    return [{
      id: `verse:${anime.slug}:${epNum}`,
      name: "Verse",
      type: "sub",
      streamUrl: streamData.stream, // Direct MP4 — plays directly
      quality: "720p",
      isM3U8: false,
      isMP4: true,
      hardsub: true, // Verse is hard sub
      subtitleTracks: [],
    }];
  } catch { return []; }
}

// ─── 3. Senshi ────────────────────────────────────────────────────────────────

const SENSHI_API = "https://senshi-api.sapis.workers.dev";

async function fetchSenshi(malId: number, epNum: number, timeoutMs: number): Promise<MioSource[]> {
  try {
    const res = await fetch(`${SENSHI_API}/api/anime/${malId}/episodes/${epNum}/streams`, {
      headers: HEADERS, cache: "no-store",
    });
    if (!res.ok) return [];
    const data = await res.json();
    if (data?.status !== "success") return [];
    const streams = data?.data || [];

    const results: MioSource[] = [];
    for (const s of streams) {
      const url = s.resolvedStreamUrl || s.originalUrl;
      if (!url) continue;

      // Route the DIRECT stream URL through our worker.
      // Worker adds Referer: https://senshi.live/ (from REFERER_MAP) + CORS headers.
      // OLD approach used cdn.animex.su XOR wrapper — DEAD as of 2026-06-25.
      const proxyUrl = wrapStreamUrl(url);

      results.push({
        id: `senshi:${s.server}:${s.status}`,
        name: `Senshi ${s.server}`,
        type: "sub",
        streamUrl: proxyUrl,
        quality: "auto",
        isM3U8: true,
        isMP4: false,
        hardsub: s.status?.toLowerCase() === "hardsub",
        subtitleTracks: [],
      });
    }
    return results;
  } catch { return []; }
}

// ─── 4. AllAnime ──────────────────────────────────────────────────────────────

const ALLANIME_API = "https://allanime-api.mdtahseen7378.workers.dev";

async function fetchAllAnime(title: string, epNum: number, timeoutMs: number): Promise<MioSource[]> {
  try {
    const searchRes = await fetch(`${ALLANIME_API}/search?query=${encodeURIComponent(title)}`, {
      headers: HEADERS, cache: "no-store",
    });
    if (!searchRes.ok) return [];
    const searchData = await searchRes.json();
    if (!Array.isArray(searchData) || !searchData.length) return [];

    const anime = searchData[0];
    const showId = anime.id;

    // Use /episode_url endpoint — returns the actual CDN URL (wixstatic.com)
    // The /play endpoint returns the raw MP4 binary (600MB+) which is too heavy
    // to proxy through the API worker.
    const urlRes = await fetch(`${ALLANIME_API}/episode_url?show_id=${showId}&ep_no=${epNum}&quality=best&mode=sub`, {
      headers: HEADERS, cache: "no-store",
    });
    if (!urlRes.ok) return [];
    const urlData = await urlRes.json();
    const mp4Url = urlData?.episode_url;
    if (!mp4Url) return [];

    return [{
      id: `allanime:${showId}:${epNum}`,
      name: "AllAnime",
      type: "sub",
      streamUrl: mp4Url, // Direct MP4 CDN URL (wixstatic.com)
      quality: "auto",
      isM3U8: false,
      isMP4: true,
      hardsub: false,
      subtitleTracks: [],
    }];
  } catch { return []; }
}


// ─── 5. Re:Anime (embed URLs) ─────────────────────────────────────────────────

const REANIME_API = "https://reanime-scraper-api.sapis.workers.dev";

async function fetchReAnime(title: string, epNum: number, timeoutMs: number): Promise<MioSource[]> {
  try {
    const searchRes = await fetch(`${REANIME_API}/api/search?q=${encodeURIComponent(title)}`, {
      headers: HEADERS, cache: "no-store",
    });
    if (!searchRes.ok) return [];
    const searchData = await searchRes.json();
    const results = searchData?.results || [];
    if (!results.length) return [];

    const anime = results.find((r: any) => 
      r.title?.english?.toLowerCase() === title.toLowerCase() ||
      r.title?.romaji?.toLowerCase() === title.toLowerCase()
    ) || results[0];
    if (!anime?.anime_id) return [];

    const watchRes = await fetch(`${REANIME_API}/api/watch/${anime.anime_id}/episodes/${epNum}`, {
      headers: HEADERS, cache: "no-store",
    });
    if (!watchRes.ok) return [];
    const watchData = await watchRes.json();
    const streams = watchData?.streams || [];

    const results2: MioSource[] = [];
    const seen = new Set<string>();
    for (const s of streams) {
      if (!s.embedUrl) continue;
      const key = `${s.embedUrl}:${s.dataType}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const isDub = s.dataType === "dub";
      results2.push({
        id: `reanime:${s.serverName}:${s.dataType}:${epNum}`,
        name: `Re:Anime ${s.serverName}`,
        type: isDub ? "dub" : "sub",
        streamUrl: s.embedUrl, // Embed URL (flixcloud.cc/e/...) — loaded in iframe
        quality: "auto",
        isM3U8: false,
        isMP4: false,
        isEmbed: true, // ← NEW: mark as embed so watch page uses iframe player
        hardsub: false,
        subtitleTracks: [],
      });
    }
    return results2;
  } catch { return []; }
}

// ─── Main: fetch ALL MioAnime sources ─────────────────────────────────────────

export async function fetchMioAnimeSources(
  anilistId: number,
  epNum: number,
  options?: { timeoutMs?: number }
): Promise<MioSource[]> {
  const timeoutMs = options?.timeoutMs ?? 10000;

  const title = await resolveTitle(anilistId);
  if (!title) return [];

  // Get MAL ID for Senshi (needs MAL ID, not AniList)
  let malId: number | null = null;
  try {
    const res = await fetch("https://graphql.anilist.co", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: "query($id:Int){Media(id:$id,type:ANIME){id idMal}}",
        variables: { id: anilistId },
      }),
      cache: "no-store",
    });
    const data = await res.json();
    malId = data?.data?.Media?.idMal || null;
  } catch {}

  console.log(`[MioAnime] fetching 4 sources for "${title}" ep${epNum} (malId=${malId})`);

  // Fetch ALL sources in parallel
  const [anizone, verse, senshi, allanime, reanime] = await Promise.allSettled([
    fetchAniZone(title, epNum, timeoutMs),
    fetchVerse(title, epNum, timeoutMs),
    malId ? fetchSenshi(malId, epNum, timeoutMs) : Promise.resolve([]),
    fetchAllAnime(title, epNum, timeoutMs),
    fetchReAnime(title, epNum, timeoutMs),
  ]);

  const results: MioSource[] = [];
  if (anizone.status === "fulfilled") results.push(...anizone.value);
  if (verse.status === "fulfilled") results.push(...verse.value);
  if (senshi.status === "fulfilled") results.push(...senshi.value);
  if (allanime.status === "fulfilled") results.push(...allanime.value);
  if (reanime.status === "fulfilled") results.push(...reanime.value);

  console.log(`[MioAnime] ${results.length} sources (AniZone=${anizone.status === "fulfilled" ? anizone.value.length : 0}, Verse=${verse.status === "fulfilled" ? verse.value.length : 0}, Senshi=${senshi.status === "fulfilled" ? senshi.value.length : 0}, AllAnime=${allanime.status === "fulfilled" ? allanime.value.length : 0}, ReAnime=${reanime.status === "fulfilled" ? reanime.value.length : 0})`);
  return results;
}
