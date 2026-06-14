# Worklog

---
Task ID: 1
Agent: Main Agent
Task: Scrape and analyze yumezone.live website + source code, fix anime ID mapping, m3u8/HLS headers, provider identification, rebuild watch page

Work Log:
- Scraped yumezone.live homepage and watch page using web-reader
- Found full YumeZone Python Flask source code already in download/yumezone-source/
- Analyzed YumeZone's architecture: Next.js frontend + Python Flask API backend
- Key findings:
  - Anime IDs: Uses AniList numeric IDs (e.g., /watch/21/ep-1 for One Piece)
  - Episode IDs: Format `watch/{provider}/{anilistId}/{category}/{slug}`
  - Provider priority: zenith → kiwi → ax-mimi → ax-wave → ax-shiro → ax-yuki → ax-zen → ax-beep → bee → zoro → anixtv
  - m3u8 proxy routing: kiwi/animex → kiwi worker proxy, arc/jet/zoro → CDN-EU proxy
  - YumeZone uses CUSTOM HLS.js player (NOT iframe embeds)
  - Provider display names: kiwi=Miku, ax-mimi=Shinra, ax-wave=Nami, etc.
- Fixed miruro-api.ts: Updated provider priority, display names, capabilities to match YumeZone
- Rewrote /api/anime/yumezone/watch/route.ts with proper proxy routing, provider fallback, Zoro/Megaplay embed handling, intro/outro scavenging
- Created new HLS.js player component (hls-player-new.tsx) with custom controls, skip intro/outro, quality selector, resume, provider fallback
- Completely rewrote watch-page.tsx: Replaced iframe approach with native HLS.js player, cleaner UI (less dark, less gooey), provider pills, SUB/DUB toggle, episode grid
- Build successful with `next build`

Stage Summary:
- miruro-api.ts: Provider priority updated to match YumeZone exactly
- yumezone/watch/route.ts: Complete rewrite with proper proxy routing, auto-fallback, Megaplay embed
- hls-player-new.tsx: New native HLS.js player component (995 lines)
- watch-page.tsx: Complete rewrite with HLS player + cleaner UI (1030 lines)
- All TypeScript errors resolved, build passes
---
Task ID: 1
Agent: Main Agent
Task: Scrape yumezone.live and build Python scraper with correct anime ID, m3u8, CB provider, and addlist mapping

Work Log:
- Scraped yumezone.live homepage, discovered it's a Next.js + tRPC frontend
- Discovered the site uses tRPC API at /api/trpc/* with batch GET/POST format
- Mapped all tRPC procedures: anime.search, anime.getFullInfo, anime.getEpisodes, anime.getSources, anime.getWatchOrder, anime.getNextAiring, anime.getThemes
- Found the GitHub repo (OTAKUWeBer/YumeZone) and downloaded all source code
- Analyzed the Flask backend with UnifiedScraper that aggregates 4+ content providers
- Mapped all content providers (CB): Miruro, Zenith (AllAnime), AnimeX, Zoro, AnixTv
- Mapped provider priority: zenith → kiwi → ax-mimi → ax-wave → ax-shiro → ax-yuki → ax-zen → ax-beep → bee → zoro → anixtv
- Mapped m3u8/HLS proxy routing: kiwi/animex → worker proxy; arc/jet/zoro → CDN-EU proxy; zenith → direct
- Mapped episode ID formats per provider (the "addlist" mapping)
- Built comprehensive Python scraper (yumezone_scraper.py) with CLI
- Tested scraper: search, info, episodes, sources, map commands all working
- Saved comprehensive API mapping to yumezone_api_mapping.json

Stage Summary:
- Built /home/z/my-project/download/yumezone_scraper.py (comprehensive async Python scraper)
- Built /home/z/my-project/download/yumezone_api_mapping.json (full API/provider/header mapping)
- Key discovery: YumeZone uses tRPC, Miruro API, AllAnime GraphQL, AnimeX REST, and Megaplay embeds
- Each provider has different episode ID format (addlist), stream format, and proxy requirements
- The scraper correctly maps anime IDs → episode IDs per provider → m3u8/MP4/embed URLs with headers
