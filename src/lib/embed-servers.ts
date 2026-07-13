// Embed Server Providers for LuffyTV — Pokemon-named servers
//
// CLEAN PROVIDER LIST:
//
// Anime Servers (SUB/DUB) in priority order:
//   0. Miku          (YumeZone/Miruro)  — AniList ID — Miruro miku provider, HLS+embed, auto-switch
//   1. Pikachu       (VidNest Anime)    — AniList ID — sub/dub/hindi, iframe
//   2. Eevee         (VidNest AnimePahe) — AniList ID — sub/dub, iframe
//   3. Charizard     (Videasy)          — AniList ID — auto sub/dub, iframe
//   4. Zoro          (YumeZone/Megaplay) — AniList ID — Megaplay embed, sub+dub
//   5. Kiwi          (YumeZone/Miruro)  — AniList ID — Miruro kiwi provider, HLS
//   6. Arc           (YumeZone/Miruro)  — AniList ID — Miruro arc provider, HLS
//   7. Umbreon       (AniVexa/AniNeko)  — AniList ID — HLS embeds
//   8. Mewtwo        (AniVexa/AllAnime) — AniList ID — 6+ Sources, MP4+Iframe
//   9. Bulbasaur     (AnimeX)           — AniList ID — GraphQL+REST, HLS proxy
//
// Hindi Servers:
//   Charmander      (AniXtv)           — AniList ID — Hindi dub
//   Flareon         (VidNest Hindi)    — AniList ID — Hindi dub
//
// TMDB Servers for Movies/TV kept separately

export interface EmbedServer {
  id: string;
  name: string;
  priority: number;
  supportsSub: boolean;
  supportsDub: boolean;
  supportsHindi: boolean;
  idType: "tmdb" | "anilist" | "mal" | "session";
  color: string;
  category: "anime" | "tmdb" | "hindi";
  noSandbox?: boolean;
  streamType?: "iframe" | "hls";
  generateUrl: (params: EmbedUrlParams) => string;
}

export interface EmbedUrlParams {
  anilistId?: number;
  malId?: number;
  tmdbId?: number;
  imdbId?: string;
  episode: number;
  season?: number;
  translation: "sub" | "dub" | "hindi";
  title?: string;
  session?: string;
}

// =====================================================
// YUMEZONE SERVERS — Miruro-based with proper AniList ID mapping
// These servers use the /api/anime/yumezone/watch route which:
// 1. Maps AniList ID -> Miruro episodes -> provider episode IDs
// 2. Fetches correct m3u8/HLS streams with proper headers
// 3. Routes through CDN proxy for CORS-free playback
// =====================================================

const yumezoneMiku: EmbedServer = {
  id: "yz-miku",
  name: "Miku",
  priority: 0,
  supportsSub: true,
  supportsDub: true,
  supportsHindi: false,
  idType: "anilist",
  color: "#00D4AA",
  category: "anime",
  streamType: "hls",
  noSandbox: true,
  generateUrl: (p) => {
    if (!p.anilistId) return "";
    const type = p.translation === "dub" ? "dub" : "sub";
    return `/api/anime/yumezone/watch?anilistId=${p.anilistId}&episode=${p.episode}&provider=miku&type=${type}`;
  },
};

const yumezoneZoro: EmbedServer = {
  id: "yz-zoro",
  name: "Zoro",
  priority: 4,
  supportsSub: true,
  supportsDub: true,
  supportsHindi: false,
  idType: "anilist",
  color: "#22C55E",
  category: "anime",
  streamType: "iframe",
  noSandbox: true,
  generateUrl: (p) => {
    if (!p.anilistId) return "";
    const lang = p.translation === "dub" ? "dub" : "sub";
    return `https://megaplay.buzz/stream/ani/${p.anilistId}/${p.episode}/${lang}`;
  },
};

const yumezoneKiwi: EmbedServer = {
  id: "yz-kiwi",
  name: "Kiwi",
  priority: 5,
  supportsSub: true,
  supportsDub: true,
  supportsHindi: false,
  idType: "anilist",
  color: "#A3E635",
  category: "anime",
  streamType: "hls",
  noSandbox: true,
  generateUrl: (p) => {
    if (!p.anilistId) return "";
    const type = p.translation === "dub" ? "dub" : "sub";
    return `/api/anime/yumezone/watch?anilistId=${p.anilistId}&episode=${p.episode}&provider=kiwi&type=${type}`;
  },
};

const yumezoneArc: EmbedServer = {
  id: "yz-arc",
  name: "Arc",
  priority: 6,
  supportsSub: true,
  supportsDub: true,
  supportsHindi: false,
  idType: "anilist",
  color: "#818CF8",
  category: "anime",
  streamType: "hls",
  noSandbox: true,
  generateUrl: (p) => {
    if (!p.anilistId) return "";
    const type = p.translation === "dub" ? "dub" : "sub";
    return `/api/anime/yumezone/watch?anilistId=${p.anilistId}&episode=${p.episode}&provider=arc&type=${type}`;
  },
};

const yumezoneBee: EmbedServer = {
  id: "yz-bee",
  name: "Bee",
  priority: 7,
  supportsSub: true,
  supportsDub: false,
  supportsHindi: false,
  idType: "anilist",
  color: "#FBBF24",
  category: "anime",
  streamType: "hls",
  noSandbox: true,
  generateUrl: (p) => {
    if (!p.anilistId) return "";
    const type = p.translation === "dub" ? "dub" : "sub";
    return `/api/anime/yumezone/watch?anilistId=${p.anilistId}&episode=${p.episode}&provider=bee&type=${type}`;
  },
};

// =====================================================
// ANIME SERVERS — Pokemon-named, priority order
// =====================================================

const vidnestAnime: EmbedServer = {
  id: "vidnest-anime",
  name: "Pikachu",
  priority: 0,
  supportsSub: true,
  supportsDub: true,
  supportsHindi: true,
  idType: "anilist",
  color: "#FFD700",
  category: "anime",
  streamType: "iframe",
  generateUrl: (p) => {
    if (!p.anilistId) return "";
    const lang = p.translation === "hindi" ? "hindi" : p.translation === "dub" ? "dub" : "sub";
    return `https://vidnest.fun/anime/${p.anilistId}/${p.episode}/${lang}`;
  },
};

const vidnestAnimepahe: EmbedServer = {
  id: "vidnest-animepahe",
  name: "Eevee",
  priority: 1,
  supportsSub: true,
  supportsDub: true,
  supportsHindi: false,
  idType: "anilist",
  color: "#C084FC",
  category: "anime",
  streamType: "iframe",
  generateUrl: (p) => {
    if (!p.anilistId) return "";
    const lang = p.translation === "dub" ? "dub" : "sub";
    return `https://vidnest.fun/animepahe/${p.anilistId}/${p.episode}/${lang}`;
  },
};

const videasyAnime: EmbedServer = {
  id: "videasy-anime",
  name: "Charizard",
  priority: 2,
  supportsSub: true,
  supportsDub: true,
  supportsHindi: false,
  idType: "anilist",
  color: "#F97316",
  category: "anime",
  streamType: "iframe",
  generateUrl: (p) => {
    if (!p.anilistId) return "";
    return `https://player.videasy.net/anime/${p.anilistId}/${p.episode}?nextEpisode=true&autoplayNextEpisode=true&episodeSelector=true&overlay=true&color=E63946`;
  },
};

// =====================================================
// ANIVEXA SERVERS — Only AniNeko (iframe) + AllAnime
// Public API: https://anivexa-api-tawny.vercel.app
// =====================================================

const ANIVEXA_PROVIDER_CONFIG: Array<{ id: string; name: string; color: string; priority: number; tip: string }> = [
  { id: "anineko", name: "Umbreon",  color: "#1E293B", priority: 4, tip: "HLS Embeds, Reliable" },
  { id: "allmanga", name: "Mewtwo",  color: "#6366F1", priority: 5, tip: "6+ Sources, MP4+Iframe" },
];

const anivexaServers: EmbedServer[] = ANIVEXA_PROVIDER_CONFIG.map((prov) => ({
  id: `anivexa-${prov.id}`,
  name: prov.name,
  priority: prov.priority,
  supportsSub: true,
  supportsDub: true,
  supportsHindi: false,
  idType: "anilist" as const,
  color: prov.color,
  category: "anime" as const,
  streamType: "iframe" as const,
  noSandbox: true,
  generateUrl: (p: EmbedUrlParams) => {
    if (!p.anilistId) return "";
    const lang = p.translation === "dub" ? "dub" : "sub";
    return `/api/anivexa/watch?anilistId=${p.anilistId}&episode=${p.episode}&type=${lang}&provider=${prov.id}`;
  },
}));

// =====================================================
// ANIMEX SERVER — Single server that auto-races providers
// Uses GraphQL for AniList ID → slug mapping
// Then REST API for episodes/servers/sources
// All streams proxied through /api/animex/proxy
//
// Provider (CB) mapping with correct headers:
//   beep  — HLS, Default sub, CDN: bd.24stream.xyz
//   mimi  — HLS PNG-TS, Default dub, CDN: hawk.24stream.xyz
//   vee   — DASH, CDN: cdn.animeonsen.xyz
//   yuki  — HLS .jpg-TS, CDN: s2.cinewave2.site
//   miku  — HLS .txt, Best quality, CDN: sxic.oceancrestdigital.shop
//   neko  — MP4, CDN: neko.yokai.cfd
//   huzz  — HLS, CDN: s2.vidhosters.com
//   mochi — MP4 token, CDN: tools.fast4speed.rsvp
//   uwu   — HLS .txt, CDN: sxic.oceancrestdigital.shop
//   koto  — HLS .txt, CDN: sxic.oceancrestdigital.shop
//   kiwi  — HLS CF-protected, CDN: anidb.app
//   kami  — HLS alt
// =====================================================

const animexServer: EmbedServer = {
  id: "animex-auto",
  name: "Bulbasaur",
  priority: 6,
  supportsSub: true,
  supportsDub: true,
  supportsHindi: false,
  idType: "anilist",
  color: "#4ADE80",
  category: "anime",
  streamType: "hls",
  noSandbox: true,
  generateUrl: (p) => {
    if (!p.anilistId) return "";
    const lang = p.translation === "dub" ? "dub" : "sub";
    return `/api/animex/watch?anilistId=${p.anilistId}&episode=${p.episode}&type=${lang}`;
  },
};

// =====================================================
// HINDI SERVERS — Pokemon-named
// =====================================================

const anixtvHindi: EmbedServer = {
  id: "anixtv-hindi",
  name: "Charmander",
  priority: 0,
  supportsSub: false,
  supportsDub: false,
  supportsHindi: true,
  idType: "anilist",
  color: "#FF6B35",
  category: "hindi",
  noSandbox: true,
  streamType: "iframe",
  generateUrl: (p) => {
    if (!p.anilistId) return "";
    const title = p.title ? encodeURIComponent(p.title) : "Anime";
    return `https://anixtv.in/anime-watch?action=hindi_1_player&id=${p.anilistId}&season=1&episode=${p.episode}&title=${title}`;
  },
};

const vidnestHindi: EmbedServer = {
  id: "vidnest-hindi",
  name: "Flareon",
  priority: 1,
  supportsSub: false,
  supportsDub: false,
  supportsHindi: true,
  idType: "anilist",
  color: "#F97316",
  category: "hindi",
  streamType: "iframe",
  generateUrl: (p) => {
    if (!p.anilistId) return "";
    return `https://vidnest.fun/anime/${p.anilistId}/${p.episode}/hindi`;
  },
};

// =====================================================
// TMDB SERVERS — Movies/TV Shows
//
// NOTE: Movies/TV no longer use embed iframes. Stream playback for
// movies and TV now goes through direct Vidlink + Moviebox scraping
// (see src/lib/vidlink-api.ts and src/lib/moviebox-api.ts). The
// MovieWatchPage and TVWatchPage components render a <video> element
// with direct MP4/HLS sources instead of an iframe.
// =====================================================

const TMDB_SERVERS: EmbedServer[] = [];

// =====================================================
// ALL SERVERS
// =====================================================

const ANIME_SERVERS: EmbedServer[] = [
  yumezoneMiku,       // Miku (YumeZone/Miruro — best provider, auto-switch)
  vidnestAnime,       // Pikachu
  vidnestAnimepahe,   // Eevee
  videasyAnime,       // Charizard
  yumezoneZoro,       // Zoro (YumeZone/Megaplay embed)
  yumezoneKiwi,       // Kiwi (YumeZone/Miruro HLS)
  yumezoneArc,        // Arc (YumeZone/Miruro HLS)
  yumezoneBee,        // Bee (YumeZone/Miruro HLS)
  ...anivexaServers,  // Umbreon(AniNeko), Mewtwo(AllAnime)
  animexServer,       // Bulbasaur(AnimeX)
];

const HINDI_SERVERS: EmbedServer[] = [
  anixtvHindi,       // Charmander
  vidnestHindi,      // Flareon
];

const ALL_SERVERS: EmbedServer[] = [
  ...ANIME_SERVERS,
  ...HINDI_SERVERS,
  ...TMDB_SERVERS,
];

/**
 * Get servers available for Anime content (SUB/DUB)
 */
export function getAnimeServers(): EmbedServer[] {
  return ANIME_SERVERS;
}

/**
 * Get servers available for Hindi Dub
 */
export function getHindiServers(): EmbedServer[] {
  return HINDI_SERVERS;
}

/**
 * Get servers available for Movie/TV content
 */
export function getTmdbServers(): EmbedServer[] {
  return TMDB_SERVERS.map((s, i) => ({
    ...s,
    name: `Server ${i + 1}`,
    priority: i,
  }));
}

/**
 * Get all servers
 */
export const EMBED_SERVERS = ALL_SERVERS;

/**
 * Generate embed URL for a specific server and episode
 */
export function getEmbedUrl(serverId: string, params: EmbedUrlParams): string {
  const server = ALL_SERVERS.find(s => s.id === serverId);
  if (!server) return "";
  return server.generateUrl(params);
}

/**
 * Check if any Hindi Dub server is available
 */
export function hasHindiSupport(anilistId?: number): boolean {
  if (!anilistId) return false;
  return HINDI_SERVERS.length > 0;
}

/**
 * Check if a server uses HLS (M3U8) streaming instead of iframe
 */
export function isHlsServer(serverId: string): boolean {
  return serverId.startsWith("animex-") || serverId.startsWith("anivexa-") || serverId.startsWith("yz-");
}

/**
 * Check if a server is from AniVexa (needs availability checking)
 */
export function isAnivexaServer(serverId: string): boolean {
  return serverId.startsWith("anivexa-");
}

/**
 * Check if a server is from AnimeX (needs availability checking)
 */
export function isAnimexServer(serverId: string): boolean {
  return serverId.startsWith("animex-");
}

/**
 * Get the tip/label for an anivexa provider
 */
export function getAnivexaProviderTip(serverId: string): string {
  const prov = ANIVEXA_PROVIDER_CONFIG.find(p => `anivexa-${p.id}` === serverId);
  return prov?.tip || "";
}
