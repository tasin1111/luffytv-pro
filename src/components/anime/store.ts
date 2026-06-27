"use client";

import { create } from "zustand";

// ============================================================
// Anime Types (from AllAnime + Miruro)
// ============================================================

export interface AnimeItem {
  _id: string;
  name: string;
  englishName?: string;
  thumbnail?: string;
  score?: number;
  type?: string;
  status?: string;
  genres?: string[];
  availableEpisodes?: Record<string, number>;
  season?: string;
  description?: string;
}

export interface MiruroAnimeItem {
  id: number;
  title: { romaji?: string; english?: string; native?: string };
  coverImage?: { extraLarge?: string; large?: string; medium?: string; color?: string };
  bannerImage?: string;
  genres?: string[];
  averageScore?: number;
  popularity?: number;
  episodes?: number;
  type?: string;
  status?: string;
  description?: string;
  season?: string;
  seasonYear?: number;
  countryOfOrigin?: string;
}

// ============================================================
// TMDB Content Types
// ============================================================

export interface TMDBContentItem {
  id: number;
  title?: string;
  name?: string;
  original_title?: string;
  original_name?: string;
  overview?: string;
  poster_path?: string;
  backdrop_path?: string;
  vote_average?: number;
  vote_count?: number;
  release_date?: string;
  first_air_date?: string;
  genre_ids?: number[];
  popularity?: number;
  media_type?: "movie" | "tv";
  adult?: boolean;
  origin_country?: string[];
  original_language?: string;
}

// ============================================================
// Bookmark & History
// ============================================================

export interface BookmarkItem {
  id: string;
  animeId: string;
  animeName: string;
  thumbnail?: string;
  score?: number;
  type?: string;
  status?: string;
  createdAt: string;
}

export interface HistoryItem {
  id: string;
  animeId: string;
  animeName: string;
  thumbnail?: string;
  episodeNum: number;
  progress: number;
  duration: number;
  updatedAt: string;
}

// ============================================================
// Route Types
// ============================================================

type Route =
  | { page: "home" }
  | { page: "search"; query?: string }
  | { page: "anime"; id: string }
  | { page: "watch"; id: string; episode: number; title?: string; image?: string }
  | { page: "genre"; genre: string }
  | { page: "bookmarks" }
  | { page: "history" }
  | { page: "dub" }
  | { page: "movies" }
  | { page: "tv" }
  | { page: "manga" }
  | { page: "manga-detail"; id: string }
  | { page: "manga-read"; id: string; chapterId: string }
  | { page: "movie-detail"; id: number }
  | { page: "tv-detail"; id: number }
  | { page: "movie-watch"; id: number }
  | { page: "tv-watch"; id: number; season: number; episode: number }
  | { page: "watchnow" }
  | { page: "contact" }
  | { page: "guide" }
  | { page: "features" }
  | { page: "live" }
  | { page: "live-watch"; matchId: string; matchTitle: string; matchSport: string; matchSportName: string; matchHomeTeam: string; matchAwayTeam: string; matchHomeBadge: string; matchAwayBadge: string; matchPoster: string; matchPopular: boolean; matchSources: string; matchDate: number; matchStreamKey?: string; matchStreamCategory?: string; matchChannelName?: string; matchChannelCode?: string; matchDamitvId?: string; matchDamitvName?: string; matchDamitvIds?: string; matchDamitvEmbedUrl?: string; matchWatchfootyId?: string; matchApiSource?: string; matchSportsrcCategory?: string; matchSportsrcId?: string; matchWatchfootyStreams?: string; matchLeague?: string; matchLeagueLogo?: string; matchHomeScore?: number; matchAwayScore?: number; matchCurrentMinute?: string }
  | { page: "live-tv-watch"; channelId: string; channelName: string; channelCategory: string; channelStreamCategory?: string; channelCountryCode?: string; channelCountryName?: string; channelEmbedUrl: string; channelDamitvDefaultUrl?: string; channelViewers?: number; channelLogoUrl?: string; channelDamitvResolveIdx?: number; channelDamitvEmbedUrl?: string; channelDamitvId?: number; channelDamitvResolveUrl?: string; channelStreamUrl?: string }
  | { page: "novel" }
  | { page: "novel-detail"; novelId: string; novelTitle: string; novelCover: string; novelAuthor: string; novelSource: string }
  | { page: "novel-read"; novelId: string; novelTitle: string; chapterId: string; chapterNum: number; chapterTitle: string; totalChapters: number; novelSource: string }
  | { page: "signin" }
  | { page: "signup" }
  | { page: "scraper" }
  | { page: "scraper-anime"; id: string }
  | { page: "scraper-watch"; id: string; episode: string; site: string };

// ============================================================
// App Store
// ============================================================

// Section sub-page type — each section can have its own sub-navigation
export type SectionSubPage = "home" | "sub" | "dub" | "schedule" | "genres" | "browse" | "trending" | "top-rated" | "tv-channels" | "sports" | "news";

interface AppState {
  route: Route;
  navigate: (route: Route) => void;
  sectionSubPage: SectionSubPage;
  setSectionSubPage: (subPage: SectionSubPage) => void;
  bookmarks: BookmarkItem[];
  setBookmarks: (items: BookmarkItem[]) => void;
  history: HistoryItem[];
  setHistory: (items: HistoryItem[]) => void;
  isBookmarked: (animeId: string) => boolean;
}

export const useAppStore = create<AppState>((set, get) => ({
  route: { page: "home" },
  sectionSubPage: "home",
  setSectionSubPage: (subPage) => set({ sectionSubPage: subPage }),
  navigate: (route) => {
    // Reset section sub-page when navigating to a new section
    // Default to "sports" when going to live page (Sports is the primary tab)
    const subPage = route.page === "live" ? "sports" : "home";
    set({ route, sectionSubPage: subPage });
    if (typeof window !== "undefined") {
      if (route.page === "home") window.location.hash = "";
      else if (route.page === "search" && route.query)
        window.location.hash = `search/${encodeURIComponent(route.query)}`;
      else if (route.page === "search") window.location.hash = "search";
      else if (route.page === "anime")
        window.location.hash = `anime/${route.id}`;
      else if (route.page === "watch")
        window.location.hash = `watch/${route.id}/${route.episode}`;
      else if (route.page === "genre")
        window.location.hash = `genre/${encodeURIComponent(route.genre)}`;
      else if (route.page === "bookmarks") window.location.hash = "bookmarks";
      else if (route.page === "history") window.location.hash = "history";
      else if (route.page === "dub") window.location.hash = "dub";
      else if (route.page === "movies") window.location.hash = "movies";
      else if (route.page === "tv") window.location.hash = "tv";
      else if (route.page === "manga") window.location.hash = "manga";
      else if (route.page === "manga-detail")
        window.location.hash = `manga/${route.id}`;
      else if (route.page === "manga-read")
        window.location.hash = `read-manga/${route.id}/${route.chapterId}`;
      else if (route.page === "movie-detail")
        window.location.hash = `movie/${route.id}`;
      else if (route.page === "tv-detail")
        window.location.hash = `tvshow/${route.id}`;
      else if (route.page === "movie-watch")
        window.location.hash = `watch-movie/${route.id}`;
      else if (route.page === "tv-watch")
        window.location.hash = `watch-tv/${route.id}/${route.season}/${route.episode}`;
      else if (route.page === "watchnow") window.location.hash = "watchnow";
      else if (route.page === "contact") window.location.hash = "contact";
      else if (route.page === "features") window.location.hash = "features";
      else if (route.page === "live") window.location.hash = "live";
      else if (route.page === "live-watch") window.location.hash = `live-watch/${encodeURIComponent(route.matchId)}/${encodeURIComponent(route.matchSport)}`;
      else if (route.page === "live-tv-watch") window.location.hash = `live-tv-watch/${encodeURIComponent(route.channelId)}/${encodeURIComponent(route.channelCategory)}/${encodeURIComponent(route.channelStreamCategory || "")}`;
      else if (route.page === "novel") window.location.hash = "novel";
      else if (route.page === "novel-detail") window.location.hash = `novel/${encodeURIComponent(route.novelId)}`;
      else if (route.page === "novel-read") window.location.hash = `read-novel/${encodeURIComponent(route.novelId)}/${route.chapterNum}`;
      else if (route.page === "signin") window.location.hash = "signin";
      else if (route.page === "signup") window.location.hash = "signup";
      else if (route.page === "music") window.location.hash = "music";
      else if (route.page === "torrent") window.location.hash = "torrent";
      else if (route.page === "scraper") window.location.hash = "scraper";
      else if (route.page === "scraper-anime") window.location.hash = `scraper/anime/${route.id}`;
      else if (route.page === "scraper-watch") window.location.hash = `scraper/watch/${route.site}/${route.id}/${encodeURIComponent(route.episode)}`;
      window.scrollTo(0, 0);
    }
  },
  bookmarks: [],
  setBookmarks: (items) => set({ bookmarks: items }),
  history: [],
  setHistory: (items) => set({ history: items }),
  isBookmarked: (animeId) => get().bookmarks.some((b) => b.animeId === animeId),
}));

// Get the section-specific nav links based on current route
export function getSectionNavLinks(route: Route): { id: SectionSubPage; label: string }[] {
  const page = route.page;
  
  // Anime section (includes anime detail, watch, genre, bookmarks, history, manga)
  if (page === "dub" || page === "anime" || page === "watch" || page === "genre" || page === "bookmarks" || page === "history" || page === "manga" || page === "manga-detail" || page === "manga-read") {
    return [
      { id: "home", label: "Home" },
      { id: "sub", label: "SUB" },
      { id: "dub", label: "DUB" },
      { id: "browse", label: "Browse" },
      { id: "schedule", label: "Schedule" },
      { id: "genres", label: "Genres" },
    ];
  }
  
  // Movies section
  if (page === "movies") {
    return [
      { id: "home", label: "Home" },
      { id: "trending", label: "Trending" },
      { id: "top-rated", label: "Top Rated" },
    ];
  }
  
  // TV Shows section
  if (page === "tv") {
    return [
      { id: "home", label: "Home" },
      { id: "trending", label: "Trending" },
      { id: "top-rated", label: "Top Rated" },
    ];
  }
  
  // Live section — sports, TV channels, schedule, and news
  if (page === "live" || page === "live-watch" || page === "live-tv-watch") {
    return [
      { id: "sports", label: "Live Sports" },
      { id: "tv-channels", label: "Live TV" },
      { id: "schedule", label: "Schedule" },
      { id: "news", label: "News" },
    ];
  }
  
  // Default — no section-specific nav
  return [];
}

export function parseHash(hash: string): Route {
  const h = hash.replace("#", "");
  if (!h) return { page: "home" };
  const parts = h.split("/");
  if (parts[0] === "search") return { page: "search", query: decodeURIComponent(parts[1] || "") };
  if (parts[0] === "anime" && parts[1]) return { page: "anime", id: parts[1] };
  if (parts[0] === "watch" && parts[1] && parts[2])
    return { page: "watch", id: parts[1], episode: parseInt(parts[2], 10) || 1 };
  if (parts[0] === "genre" && parts[1]) return { page: "genre", genre: decodeURIComponent(parts[1]) };
  if (parts[0] === "bookmarks") return { page: "bookmarks" };
  if (parts[0] === "history") return { page: "history" };
  if (parts[0] === "dub") return { page: "dub" };
  if (parts[0] === "movies") return { page: "movies" };
  if (parts[0] === "tv") return { page: "tv" };
  if (parts[0] === "manga" && parts[1]) return { page: "manga-detail", id: parts[1] };
  if (parts[0] === "manga") return { page: "manga" };
  if (parts[0] === "read-manga" && parts[1] && parts[2])
    return { page: "manga-read", id: parts[1], chapterId: parts[2] };
  if (parts[0] === "movie" && parts[1]) return { page: "movie-detail", id: parseInt(parts[1]) };
  if (parts[0] === "tvshow" && parts[1]) return { page: "tv-detail", id: parseInt(parts[1]) };
  if (parts[0] === "watch-movie" && parts[1]) return { page: "movie-watch", id: parseInt(parts[1]) };
  if (parts[0] === "watch-tv" && parts[1] && parts[2] && parts[3])
    return { page: "tv-watch", id: parseInt(parts[1]), season: parseInt(parts[2]), episode: parseInt(parts[3]) };
  if (parts[0] === "watchnow") return { page: "watchnow" };
  if (parts[0] === "contact") return { page: "contact" };
  if (parts[0] === "guide") return { page: "guide" };
  if (parts[0] === "features") return { page: "features" };
  if (parts[0] === "live") return { page: "live" };
  if (parts[0] === "live-watch") return { page: "live-watch", matchId: decodeURIComponent(parts[1] || ""), matchTitle: "", matchSport: decodeURIComponent(parts[2] || ""), matchSportName: "", matchHomeTeam: "", matchAwayTeam: "", matchHomeBadge: "", matchAwayBadge: "", matchPoster: "", matchPopular: false, matchSources: "[]", matchDate: 0 };
  if (parts[0] === "live-tv-watch") return { page: "live-tv-watch", channelId: decodeURIComponent(parts[1] || ""), channelName: "", channelCategory: decodeURIComponent(parts[2] || ""), channelStreamCategory: decodeURIComponent(parts[3] || ""), channelEmbedUrl: "" };
  if (parts[0] === "novel" && parts[1]) return { page: "novel-detail", novelId: decodeURIComponent(parts[1]), novelTitle: "", novelCover: "", novelAuthor: "", novelSource: "readlightnovel" };
  if (parts[0] === "novel") return { page: "novel" };
  if (parts[0] === "read-novel" && parts[1] && parts[2]) return { page: "novel-read", novelId: decodeURIComponent(parts[1]), novelTitle: "", chapterId: `chapter-${parts[2]}`, chapterNum: parseInt(parts[2]), chapterTitle: "", totalChapters: 0, novelSource: "readlightnovel" };
  if (parts[0] === "signin") return { page: "signin" };
  if (parts[0] === "signup") return { page: "signup" };
  if (parts[0] === "scraper" && parts[1] === "anime" && parts[2])
    return { page: "scraper-anime", id: parts[2] };
  if (parts[0] === "scraper" && parts[1] === "watch" && parts[2] && parts[3] && parts[4])
    return { page: "scraper-watch", site: parts[2], id: parts[3], episode: decodeURIComponent(parts[4]) };
  if (parts[0] === "scraper") return { page: "scraper" };
  if (parts[0] === "music") return { page: "music" };
  if (parts[0] === "torrent") return { page: "torrent" };
  return { page: "home" };
}

// ============================================================
// Helper Functions
// ============================================================

export function getAnimeTitle(anime: AnimeItem | MiruroAnimeItem): string {
  if (!anime) return "Unknown";
  if ("name" in anime) return anime.englishName || anime.name || "Unknown";
  const title = anime.title;
  if (!title) return "Unknown";
  return title.english || title.romaji || title.native || "Unknown";
}

export function getAnimeImage(anime: AnimeItem | MiruroAnimeItem): string {
  if (!anime) return "";
  if ("thumbnail" in anime) return anime.thumbnail || "";
  const cover = anime.coverImage;
  if (!cover) return "";
  return cover.extraLarge || cover.large || cover.medium || "";
}

export function getTMDBTitle(item: TMDBContentItem): string {
  return item.title || item.name || item.original_title || item.original_name || "Unknown";
}

export function getTMDBImage(item: TMDBContentItem): string {
  if (item.poster_path) return `https://image.tmdb.org/t/p/w500${item.poster_path}`;
  return "";
}

export function getTMDBBackdrop(item: TMDBContentItem): string {
  if (item.backdrop_path) return `https://image.tmdb.org/t/p/w1280${item.backdrop_path}`;
  return "";
}

export function getTMDBYear(item: TMDBContentItem): string {
  const date = item.release_date || item.first_air_date;
  return date ? date.split("-")[0] : "";
}

export function getTMDBMediaType(item: TMDBContentItem): "movie" | "tv" {
  if (item.media_type === "movie" || item.media_type === "tv") return item.media_type;
  if (item.release_date || item.original_title) return "movie";
  return "tv";
}
