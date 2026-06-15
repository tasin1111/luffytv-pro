# AnimeX Scraper Worklog

---
Task ID: 1
Agent: Main Agent
Task: Build Python FastAPI scraper for animex.one with correct headers, proxy headers, and full mapping

Work Log:
- Explored existing project structure (LuffyTV Next.js app at /home/z/my-project/)
- Analyzed animex.one live website API architecture via agent-browser
- Discovered complete API structure: GraphQL (graphql.animex.one) + REST (pp.animex.one)
- Mapped dual ID system: URL IDs ({slug}-{anilistId}) vs Internal IDs ({slug}-{5charCode})
- Identified all 12 streaming providers with their CDN patterns, required headers, and stream formats
- Built Python FastAPI scraper at /home/z/my-project/animex-scraper/ with:
  - config.py: Complete provider mapping with headers, CDN patterns, sub/dub support
  - graphql_client.py: AniList ID → Internal slug mapping via GraphQL
  - rest_client.py: Episodes, servers (addlist), sources, watch flow
  - stream_proxy.py: HLS proxy with per-provider headers, PNG stripping, TS detection
  - main.py: FastAPI endpoints for all operations
- Updated existing Next.js project:
  - src/lib/animex-api.ts: Added missing providers (neko, huzz, koto), updated priority and tips
  - src/app/api/animex/proxy/route.ts: Added complete provider headers for all 12 providers
  - src/lib/embed-servers.ts: Added CB mapping documentation

Stage Summary:
- Python FastAPI scraper created at /home/z/my-project/animex-scraper/
- All 12 providers mapped with correct headers:
  - beep (HLS, no headers), mimi (HLS PNG-TS, animex.one), vee (DASH, animeonsen.xyz)
  - yuki (HLS .jpg-TS, megaplay.buzz), miku (HLS .txt, allanime.uns.bio + mobile UA)
  - neko (MP4, animeverse.to + Firefox UA), huzz (HLS, kem.clvd.xyz + Firefox UA)
  - mochi (MP4 token, animex.one), uwu (HLS .txt, allanime.uns.bio + mobile UA)
  - koto (HLS .txt, allanime.uns.bio + mobile UA), kiwi (HLS CF, anidb.app), kami (HLS alt)
- ID mapping working: AniList ID → GraphQL → Internal Slug → REST API
- Watch flow tested and working: auto-races providers with correct headers
- Existing Next.js project updated with all missing providers and headers
