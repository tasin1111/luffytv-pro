#!/usr/bin/env python3
"""
YumeZone Scraper — Comprehensive anime data and streaming source mapper.

Scrapes yumezone.live (a Next.js + tRPC frontend + Flask backend) and maps:
  - Anime IDs (AniList ID ↔ internal ID)
  - Episode lists with per-provider IDs (addlist/episode_id mapping)
  - Streaming sources: m3u8/HLS URLs, MP4 URLs, embed URLs
  - Content providers (CB): Miruro, Zenith (AllAnime), AnimeX, Zoro, AnixTv
  - Server/Embed identification per episode
  - Correct HTTP headers per provider (Referer, Origin, etc.)

Architecture discovered from scraping yumezone.live + source code analysis:
  - Frontend: Next.js (React Server Components) at yumezone.live
  - API layer: tRPC under /api/trpc/* (batch GET/POST)
  - Backend: Flask (Python) with UnifiedScraper
  - Providers:
      • Miruro  — Primary API for anime info, episodes, sources
                   Base URL configured via API_URL env var
                   Endpoint: /watch/{provider}/{anilistId}/{category}/{slug}
                   Also: /episodes/{anilistId}, /anime/info, /search
      • Zenith  — AllAnime GraphQL API (api.allanime.day)
                   Maps AniList ID → AllAnime show ID
                   AES-CTR encrypted source URLs
                   Provides MP4 streams
      • AnimeX  — animex.one GraphQL + REST API
                   Maps AniList ID → AnimeX slug
                   Provides HLS streams with multiple sub-servers
      • Zoro    — Megaplay embeds (megaplay.buzz)
                   Embed only, no HLS
      • AnixTv  — Hindi dub embeds (anixtv.in)
                   Embed only
  - Proxy:
      • CDN-EU proxy: cdn-eu.1ani.me/proxy/m3u8 (for arc/jet/zoro/subtitles)
      • Kiwi worker:  WORKER_URL/p/ (Base64 payload for kiwi/animex)
  - Provider priority: zenith → kiwi → ax-mimi → ax-wave → ax-shiro →
                        ax-yuki → ax-zen → ax-beep → bee → zoro → anixtv
  - Provider capabilities:
      • zenith, kiwi, ax-*, bee:  hls=True
      • zoro, anixtv:            embed=True only

Usage:
  python yumezone_scraper.py search "one piece"
  python yumezone_scraper.py info 21
  python yumezone_scraper.py episodes 21
  python yumezone_scraper.py sources 21 1
  python yumezone_scraper.py sources 21 1 --provider zenith
  python yumezone_scraper.py map 21
"""

import argparse
import asyncio
import base64
import hashlib
import json
import logging
import os
import re
import sys
import time
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import quote, parse_qs

import aiohttp

# ──────────────────────────────────────────────────────────────
#  Configuration
# ──────────────────────────────────────────────────────────────

# YumeZone's own API (the live site exposes these via tRPC)
YUMEZONE_BASE = "https://yumezone.live"

# Miruro Native API (the upstream YumeZone's backend proxies to)
# This is the API_URL from YumeZone's .env — publicly accessible
# YumeZone's backend passes x-api-key + Origin headers to this
MIRURO_API_URL = os.getenv("MIRURO_API_URL", "https://api.miruro.tv")
MIRURO_API_KEY = os.getenv("MIRURO_API_KEY", "")

# CDN proxy endpoints (used to route m3u8 streams for CORS bypass)
CDN_PROXY_URL = os.getenv("CDN_PROXY_URL", "https://cdn-eu.1ani.me/proxy/m3u8")
WORKER_URL = os.getenv("WORKER_URL", "")  # Kiwi worker URL if known

# AllAnime / Zenith
ALLANIME_API = "https://api.allanime.day"
ALLANIME_REFR = "https://allmanga.to"
ALLANIME_KEY = hashlib.sha256(b"Xot36i3lK3:v1").hexdigest()

# AnimeX
ANIMEX_GRAPHQL = "https://graphql.animex.one/graphql"
ANIMEX_REST = "https://pp.animex.one/rest/api"

# Provider priority (from YumeZone source)
PROVIDER_PRIORITY = [
    "zenith", "kiwi", "ax-mimi", "ax-wave", "ax-shiro",
    "ax-yuki", "ax-zen", "ax-beep", "bee", "zoro", "anixtv",
]

# What each provider supports
PROVIDER_CAPABILITIES = {
    "zenith":    {"hls": False, "embed": False, "mp4": True},
    "kiwi":      {"hls": True,  "embed": True},
    "ax-mimi":   {"hls": True,  "embed": False},
    "ax-wave":   {"hls": True,  "embed": False},
    "ax-shiro":  {"hls": True,  "embed": False},
    "ax-yuki":   {"hls": True,  "embed": False},
    "ax-zen":    {"hls": True,  "embed": False},
    "ax-beep":   {"hls": True,  "embed": False},
    "bee":       {"hls": True,  "embed": False},
    "zoro":      {"hls": False, "embed": True},
    "anixtv":    {"hls": False, "embed": True},
}

# Which providers need the kiwi worker proxy vs CDN-EU proxy
WORKER_PROVIDERS = {
    "kiwi", "animex", "ax", "ax-uwu", "ax-mochi", "ax-wave",
    "ax-zaza", "ax-yuki", "ax-zen", "ax-beep", "uwu", "mochi",
    "wave", "zaza", "yuki", "zen",
}
CDN_ONLY_PROVIDERS = {"arc", "jet", "zoro", "miruro"}

# Required headers for Miruro API
MIRURO_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Accept": "application/json",
    "Origin": "https://yumezone.live",
    "Referer": "https://yumezone.live/",
}
if MIRURO_API_KEY:
    MIRURO_HEADERS["x-api-key"] = MIRURO_API_KEY

# Required headers for YumeZone's own tRPC API
YZ_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Accept": "application/json",
    "Origin": "https://yumezone.live",
    "Referer": "https://yumezone.live/",
}

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("YumeZoneScraper")


# ──────────────────────────────────────────────────────────────
#  Proxy Helpers
# ──────────────────────────────────────────────────────────────

def encode_cdn_proxy(url: str, headers: Optional[Dict[str, str]] = None) -> str:
    """Route through CDN-EU proxy (for arc/jet/zoro/subtitles)."""
    if not url:
        return url
    encoded_url = quote(url, safe="")
    query = f"?url={encoded_url}"
    if headers:
        query += f"&headers={quote(json.dumps(headers), safe='')}"
    return f"{CDN_PROXY_URL.rstrip('/')}{query}"


def encode_worker_payload(url: str, referer: str = "") -> str:
    """Encode URL + referer into Base64 payload for kiwi worker (/p/)."""
    if not url or not WORKER_URL:
        return url
    raw = f"{url}\x00{referer or ''}".encode("utf-8")
    b64 = base64.urlsafe_b64encode(raw).rstrip(b"=").decode()
    return f"{WORKER_URL.rstrip('/')}/p/{b64}"


def route_stream_proxy(url: str, provider: Optional[str] = None,
                        headers: Optional[Dict[str, str]] = None) -> str:
    """Route stream URLs to the correct proxy based on provider."""
    if not url:
        return url
    p = (provider or "").strip().lower()
    if p in CDN_ONLY_PROVIDERS:
        return encode_cdn_proxy(url, headers)
    if p in WORKER_PROVIDERS or p.startswith("ax-"):
        referer = (headers or {}).get("referer", "")
        if not referer and p == "kiwi":
            referer = "https://kwik.cx/"
        if WORKER_URL:
            return encode_worker_payload(url, referer)
        return encode_cdn_proxy(url, headers)  # fallback
    return encode_cdn_proxy(url, headers)


# ──────────────────────────────────────────────────────────────
#  YumeZone tRPC API Client (direct access to the live site)
# ──────────────────────────────────────────────────────────────

class YumeZoneClient:
    """
    Direct client for YumeZone's tRPC API at yumezone.live/api/trpc/*
    
    Discovered endpoints:
      - anime.search          GET  ?input={"0":{"json":{"q":"naruto","page":1}}}
      - anime.getFullInfo     GET  ?input={"0":{"json":{"id":"21"}}}
      - anime.getEpisodes     GET  ?input={"0":{"json":{"id":"21"}}}
      - anime.getSources      POST body={"0":{"json":{"anime_id":"21","episode_number":1}}}
      - anime.getWatchOrder   GET  ?input={"0":{"json":{"id":"21"}}}
      - anime.getNextAiring   GET  ?input={"0":{"json":{"id":"21"}}}
      - anime.getThemes       GET  ?input={"0":{"json":{"id":"21"}}}
      - comments.getComments  GET  ?input={"0":{"json":{"anime_id":"21","episode_number":0,...}}}
    """

    def __init__(self, base_url: str = YUMEZONE_BASE):
        self.base_url = base_url.rstrip("/")
        self._session: Optional[aiohttp.ClientSession] = None

    async def _ensure_session(self) -> aiohttp.ClientSession:
        if self._session is None or self._session.closed:
            self._session = aiohttp.ClientSession(
                timeout=aiohttp.ClientTimeout(total=15),
                headers=YZ_HEADERS,
            )
        return self._session

    async def close(self):
        if self._session and not self._session.closed:
            await self._session.close()

    async def _trpc_get(self, procedure: str, params: Dict[str, Any]) -> Optional[Any]:
        """Call a tRPC procedure via GET with batch=1."""
        session = await self._ensure_session()
        input_data = json.dumps({"0": {"json": params}})
        url = f"{self.base_url}/api/trpc/{procedure}?batch=1&input={quote(input_data)}"
        try:
            async with session.get(url) as resp:
                if resp.status != 200:
                    logger.warning(f"tRPC GET {procedure}: HTTP {resp.status}")
                    return None
                data = await resp.json(content_type=None)
                if isinstance(data, list) and len(data) > 0:
                    result = data[0].get("result", {}).get("data", {}).get("json")
                    return result
                return data
        except Exception as e:
            logger.warning(f"tRPC GET {procedure} error: {e}")
            return None

    async def _trpc_post(self, procedure: str, params: Dict[str, Any]) -> Optional[Any]:
        """Call a tRPC procedure via POST with batch=1."""
        session = await self._ensure_session()
        url = f"{self.base_url}/api/trpc/{procedure}?batch=1"
        body = json.dumps({"0": {"json": params}})
        try:
            async with session.post(url, data=body,
                                     headers={**YZ_HEADERS, "Content-Type": "application/json"}) as resp:
                if resp.status != 200:
                    logger.warning(f"tRPC POST {procedure}: HTTP {resp.status}")
                    text = await resp.text()
                    logger.warning(f"Response: {text[:500]}")
                    return None
                data = await resp.json(content_type=None)
                if isinstance(data, list) and len(data) > 0:
                    result = data[0].get("result", {}).get("data", {}).get("json")
                    return result
                return data
        except Exception as e:
            logger.warning(f"tRPC POST {procedure} error: {e}")
            return None

    # ── Public API ──

    async def search(self, query: str, page: int = 1) -> Dict[str, Any]:
        """Search anime by name. Returns list with id, anilistId, name, etc."""
        return await self._trpc_get("anime.search", {"q": query, "page": page})

    async def get_full_info(self, anime_id: str) -> Dict[str, Any]:
        """Get full anime info by AniList ID (string)."""
        return await self._trpc_get("anime.getFullInfo", {"id": str(anime_id)})

    async def get_episodes(self, anime_id: str) -> Dict[str, Any]:
        """Get episodes list by AniList ID (string)."""
        return await self._trpc_get("anime.getEpisodes", {"id": str(anime_id)})

    async def get_sources(self, anime_id: str, episode_number: int,
                          provider: Optional[str] = None) -> Dict[str, Any]:
        """
        Get streaming sources for a specific episode.
        This is the key endpoint that returns m3u8/HLS URLs, embed URLs, etc.
        """
        params = {"anime_id": str(anime_id), "episode_number": episode_number}
        return await self._trpc_post("anime.getSources", params)

    async def get_watch_order(self, anime_id: str) -> Dict[str, Any]:
        """Get watch order for an anime."""
        return await self._trpc_get("anime.getWatchOrder", {"id": str(anime_id)})

    async def get_next_airing(self, anime_id: str) -> Dict[str, Any]:
        """Get next airing episode info."""
        return await self._trpc_get("anime.getNextAiring", {"id": str(anime_id)})

    async def get_themes(self, anime_id: str) -> Dict[str, Any]:
        """Get opening/ending themes."""
        return await self._trpc_get("anime.getThemes", {"id": str(anime_id)})


# ──────────────────────────────────────────────────────────────
#  Miruro API Client (upstream streaming API)
# ──────────────────────────────────────────────────────────────

class MiruroClient:
    """
    Direct client for the Miruro Native API.
    This is the upstream API that YumeZone's Flask backend proxies to.
    
    Endpoints:
      - GET /anime/info?id=<anilistId>
      - GET /search?q=<query>&page=<n>
      - GET /episodes/<anilistId>
      - GET /watch/<provider>/<anilistId>/<category>/<slug>
      - GET /sources?episodeId=<id>&provider=<name>&category=<sub|dub>
      - GET /home
      - GET /genre/<name>
      - GET /schedule
    """

    def __init__(self, base_url: str = MIRURO_API_URL):
        self.base_url = base_url.rstrip("/")
        self._session: Optional[aiohttp.ClientSession] = None

    async def _ensure_session(self) -> aiohttp.ClientSession:
        if self._session is None or self._session.closed:
            self._session = aiohttp.ClientSession(
                timeout=aiohttp.ClientTimeout(total=15),
                headers=MIRURO_HEADERS,
            )
        return self._session

    async def close(self):
        if self._session and not self._session.closed:
            await self._session.close()

    async def _get(self, endpoint: str, params: Optional[Dict] = None) -> Optional[Dict]:
        session = await self._ensure_session()
        url = f"{self.base_url}/{endpoint.lstrip('/')}"
        try:
            async with session.get(url, params=params) as resp:
                if resp.status != 200:
                    logger.warning(f"Miruro GET {endpoint}: HTTP {resp.status}")
                    return None
                return await resp.json(content_type=None)
        except Exception as e:
            logger.warning(f"Miruro GET {endpoint} error: {e}")
            return None

    async def search(self, query: str, page: int = 1) -> Optional[Dict]:
        return await self._get("search", {"q": query, "page": page})

    async def get_anime_info(self, anilist_id: str) -> Optional[Dict]:
        return await self._get(f"anime/info", {"id": str(anilist_id)})

    async def get_episodes(self, anilist_id: str) -> Optional[Dict]:
        """Get episodes + providers map. Returns providers with episode IDs."""
        return await self._get(f"episodes/{anilist_id}")

    async def get_sources(self, provider: str, anilist_id: int,
                          category: str, slug: str) -> Optional[Dict]:
        """
        Get streaming sources via the watch endpoint.
        Format: /watch/{provider}/{anilistId}/{category}/{slug}
        slug is from the episode's 'id' field (e.g. 'animepahe-1')
        """
        endpoint = f"watch/{provider}/{anilist_id}/{category}/{slug}"
        return await self._get(endpoint)

    async def get_sources_legacy(self, episode_id: str, provider: str = "kiwi",
                                  category: str = "sub",
                                  anilist_id: Optional[int] = None) -> Optional[Dict]:
        """Get sources using the legacy /sources endpoint."""
        params = {
            "episodeId": episode_id,
            "provider": provider,
            "category": category,
        }
        if anilist_id:
            params["anilistId"] = str(anilist_id)
        return await self._get("sources", params)


# ──────────────────────────────────────────────────────────────
#  Zenith / AllAnime Scraper
# ──────────────────────────────────────────────────────────────

class ZenithScraper:
    """
    Zenith provider — scrapes AllAnime's GraphQL API.
    Provides MP4 streams. Maps AniList ID → AllAnime show ID.
    
    Key features:
      - AES-CTR encrypted source URLs (tobeparsed blob)
      - Custom hex-to-ASCII decode for provider IDs
      - Persisted query hash for episode embeds
    """

    DECODE_MAPPING = {
        "79": "A", "7a": "B", "7b": "C", "7c": "D", "7d": "E", "7e": "F", "7f": "G",
        "70": "H", "71": "I", "72": "J", "73": "K", "74": "L", "75": "M", "76": "N",
        "77": "O", "68": "P", "69": "Q", "6a": "R", "6b": "S", "6c": "T", "6d": "U",
        "6e": "V", "6f": "W", "60": "X", "61": "Y", "62": "Z",
        "59": "a", "5a": "b", "5b": "c", "5c": "d", "5d": "e", "5e": "f", "5f": "g",
        "50": "h", "51": "i", "52": "j", "53": "k", "54": "l", "55": "m", "56": "n",
        "57": "o", "48": "p", "49": "q", "4a": "r", "4b": "s", "4c": "t", "4d": "u",
        "4e": "v", "4f": "w", "40": "x", "41": "y", "42": "z",
        "08": "0", "09": "1", "0a": "2", "0b": "3", "0c": "4", "0d": "5", "0e": "6",
        "0f": "7", "00": "8", "01": "9",
        "15": "-", "16": ".", "67": "_", "46": "~", "02": ":", "17": "/", "07": "?",
        "1b": "#", "63": "[", "65": "]", "78": "@", "19": "!", "1c": "$", "1e": "&",
        "10": "(", "11": ")", "12": "*", "13": "+", "14": ",", "03": ";", "05": "=",
        "1d": "%",
    }

    EPISODE_QUERY_HASH = "d405d0edd690624b66baba3068e0edc3ac90f1597d898a1ec8db4e5c43c00fec"

    HEADERS = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0",
        "Referer": ALLANIME_REFR,
        "Origin": ALLANIME_REFR,
    }

    def __init__(self):
        self._mapping_cache: Dict[int, str] = {}
        self._session: Optional[aiohttp.ClientSession] = None

    async def _ensure_session(self) -> aiohttp.ClientSession:
        if self._session is None or self._session.closed:
            self._session = aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=20))
        return self._session

    async def close(self):
        if self._session and not self._session.closed:
            await self._session.close()

    def decrypt(self, blob: str) -> Optional[str]:
        """Decrypt AllAnime CTR-encrypted source URL blob."""
        from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
        from cryptography.hazmat.backends import default_backend
        try:
            data = base64.b64decode(blob)
            iv = data[1:13]
            ct_len = len(data) - 13 - 16
            ciphertext = data[13:13 + ct_len]
            ctr_block = iv + b"\x00\x00\x00\x02"
            key = bytes.fromhex(ALLANIME_KEY)
            cipher = Cipher(algorithms.AES(key), modes.CTR(ctr_block), backend=default_backend())
            decryptor = cipher.decryptor()
            return (decryptor.update(ciphertext) + decryptor.finalize()).decode("utf-8")
        except Exception as e:
            logger.warning(f"[Zenith] Decryption failed: {e}")
            return None

    def decode_provider_id(self, hex_str: str) -> str:
        """Custom hex-to-ASCII decoding with clock replacements."""
        result = ""
        for i in range(0, len(hex_str), 2):
            part = hex_str[i:i + 2]
            result += self.DECODE_MAPPING.get(part, "")
        return result.replace("/clock", "/clock.json")

    async def map_anilist_to_allanime(self, anilist_id: int, title: str) -> Optional[str]:
        """Map AniList ID to AllAnime show ID via GraphQL search."""
        if anilist_id in self._mapping_cache:
            return self._mapping_cache[anilist_id]

        session = await self._ensure_session()
        search_gql = """query($search: SearchInput $limit: Int $page: Int $countryOrigin: VaildCountryOriginEnumType) {
            shows(search: $search limit: $limit page: $page countryOrigin: $countryOrigin) {
                edges { _id name englishName aniListId }
            }
        }"""
        payload = {
            "variables": {
                "search": {"allowAdult": True, "allowUnknown": True, "query": title},
                "limit": 30, "page": 1, "countryOrigin": "ALL"
            },
            "query": search_gql
        }
        try:
            async with session.post(f"{ALLANIME_API}/api", json=payload,
                                     headers=self.HEADERS) as resp:
                if resp.status != 200:
                    return None
                data = await resp.json(content_type=None)
                edges = data.get("data", {}).get("shows", {}).get("edges", []) or []
                for edge in edges:
                    if str(edge.get("aniListId")) == str(anilist_id):
                        show_id = edge["_id"]
                        self._mapping_cache[anilist_id] = show_id
                        return show_id
                # Fallback: title match
                cleaned = re.sub(r"\s+\(Dub\)|\s+\(Sub\)|\s+Season\s+\d+.*", "", title, flags=re.IGNORECASE).strip()
                for edge in edges:
                    if (edge.get("name", "").lower() == cleaned.lower() or
                            (edge.get("englishName") or "").lower() == cleaned.lower()):
                        show_id = edge["_id"]
                        self._mapping_cache[anilist_id] = show_id
                        return show_id
        except Exception as e:
            logger.warning(f"[Zenith] Mapping failed: {e}")
        return None

    async def get_episode_url(self, anilist_id: int, title: str,
                               ep_no: str, mode: str = "sub") -> Optional[Dict[str, Any]]:
        """Get MP4 stream URL from AllAnime for a specific episode."""
        session = await self._ensure_session()
        show_id = await self.map_anilist_to_allanime(anilist_id, title)
        if not show_id:
            return None

        # Try persisted query first
        api_data = None
        try:
            query_vars = json.dumps({"showId": show_id, "translationType": mode, "episodeString": ep_no})
            query_ext = json.dumps({"persistedQuery": {"version": 1, "sha256Hash": self.EPISODE_QUERY_HASH}})
            api_url = f"{ALLANIME_API}/api?variables={quote(query_vars)}&extensions={quote(query_ext)}"
            headers = {**self.HEADERS, "Origin": "https://youtu-chan.com"}
            async with session.get(api_url, headers=headers) as resp:
                if resp.status == 200:
                    text = await resp.text()
                    if "tobeparsed" in text:
                        api_data = json.loads(text)
        except Exception:
            pass

        if not api_data:
            return None

        # Parse source lines
        resp_lines = []
        raw_json = json.dumps(api_data)
        if "tobeparsed" in raw_json:
            blob = None
            data = api_data.get("data", {})
            blob = api_data.get("tobeparsed") or data.get("tobeparsed") or \
                    (data.get("episode", {}) or {}).get("tobeparsed")
            if not blob:
                m = re.search(r'"tobeparsed":"([^"]*)"', raw_json)
                if m:
                    blob = m.group(1)
            if blob:
                plain = self.decrypt(blob)
                if plain:
                    parts = plain.replace("{", "\n").replace("}", "\n").split("\n")
                    for part in parts:
                        m = re.search(r'"sourceUrl":"--([^"]*)".*"sourceName":"([^"]*)"', part)
                        if m:
                            resp_lines.append({"sourceName": m.group(2), "hex": m.group(1)})

        if not resp_lines:
            return None

        # Fetch links from providers
        all_links = []
        for entry in resp_lines:
            decoded_path = self.decode_provider_id(entry["hex"])
            if not decoded_path:
                continue
            fetch_url = decoded_path if decoded_path.startswith("http") else f"https://allanime.day{decoded_path}"
            try:
                async with session.get(fetch_url, headers=self.HEADERS) as resp:
                    if resp.status == 200:
                        provider_data = await resp.json(content_type=None)
                        if isinstance(provider_data, dict):
                            links = provider_data.get("links") or []
                            for link in links:
                                if isinstance(link, dict) and link.get("link"):
                                    all_links.append({
                                        "resolution": link.get("resolutionStr", "unknown"),
                                        "url": link.get("link"),
                                    })
                            hls = provider_data.get("hls")
                            if isinstance(hls, dict) and hls.get("url"):
                                all_links.append({"resolution": "hls", "url": hls["url"]})
                if all_links:
                    break  # Use first provider that works
            except Exception:
                continue

        if not all_links:
            return None

        # Sort by quality
        def get_res(item):
            m = re.search(r"(\d+)", item.get("resolution", ""))
            return int(m.group(1)) if m else 0
        all_links.sort(key=get_res, reverse=True)

        sources = [{"file": l["url"], "label": l["resolution"], "type": "mp4"}
                    for l in all_links if "hls" not in l["resolution"]]
        return {
            "source_type": "mp4",
            "video_link": all_links[0]["url"],
            "sources": sources,
            "available_qualities": [l["resolution"] for l in all_links if "hls" not in l["resolution"]],
            "provider": "zenith",
            "intro": {"start": 0, "end": 0},
            "outro": {"start": 0, "end": 0},
        }


# ──────────────────────────────────────────────────────────────
#  AnimeX Scraper
# ──────────────────────────────────────────────────────────────

class AnimeXScraper:
    """
    AnimeX provider — scrapes animex.one GraphQL + REST API.
    Provides HLS streams with multiple sub-servers (uwu, mochi, etc.).
    """

    HEADERS = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "application/json, text/plain, */*",
        "Origin": "https://animex.one",
        "Referer": "https://animex.one/",
    }

    def __init__(self):
        self._slug_cache: Dict[int, str] = {}
        self._session: Optional[aiohttp.ClientSession] = None

    async def _ensure_session(self) -> aiohttp.ClientSession:
        if self._session is None or self._session.closed:
            self._session = aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=20))
        return self._session

    async def close(self):
        if self._session and not self._session.closed:
            await self._session.close()

    async def map_anilist(self, anilist_id: int) -> Optional[str]:
        """Map AniList ID to AnimeX slug via GraphQL."""
        if anilist_id in self._slug_cache:
            return self._slug_cache[anilist_id]
        session = await self._ensure_session()
        payload = {
            "query": "query($id:Int){anime(anilistId:$id){id anilistId titleEnglish titleRomaji}}",
            "variables": {"id": anilist_id},
        }
        try:
            async with session.post(ANIMEX_GRAPHQL, json=payload, headers=self.HEADERS) as resp:
                if resp.status != 200:
                    return None
                data = await resp.json(content_type=None)
                slug = ((data.get("data") or {}).get("anime") or {}).get("id")
                if slug:
                    self._slug_cache[anilist_id] = slug
                    return slug
        except Exception as e:
            logger.warning(f"[AnimeX] Mapping failed: {e}")
        return None

    async def get_sources(self, anilist_id: int, ep_num: int,
                           category: str = "sub") -> Optional[Dict[str, Any]]:
        """Get HLS sources from AnimeX for a specific episode."""
        slug = await self.map_anilist(anilist_id)
        if not slug:
            return None

        session = await self._ensure_session()

        # List available servers
        try:
            async with session.get(f"{ANIMEX_REST}/servers",
                                     params={"id": slug, "epNum": ep_num},
                                     headers=self.HEADERS) as resp:
                if resp.status != 200:
                    return None
                data = await resp.json(content_type=None)
                providers = data.get("subProviders" if category == "sub" else "dubProviders", [])
                if not providers:
                    return None
                # Use default or first provider
                provider_id = None
                for p in providers:
                    if p.get("default"):
                        provider_id = p["id"]
                        break
                if not provider_id:
                    provider_id = providers[0].get("id")
        except Exception as e:
            logger.warning(f"[AnimeX] Server listing failed: {e}")
            return None

        if not provider_id:
            return None

        # Get sources from the selected provider
        try:
            async with session.get(f"{ANIMEX_REST}/sources",
                                     params={"id": slug, "epNum": ep_num,
                                              "type": category, "providerId": provider_id},
                                     headers=self.HEADERS) as resp:
                if resp.status != 200:
                    return None
                raw = await resp.json(content_type=None)
                if not isinstance(raw, dict):
                    return None
                upstream_sources = raw.get("sources") or []
                upstream_headers = raw.get("headers") or {}
                referer = upstream_headers.get("Referer") or upstream_headers.get("referer") or ""

                hls_sources = []
                for stream in upstream_sources:
                    if not isinstance(stream, dict):
                        continue
                    url = stream.get("url") or stream.get("file")
                    if not url:
                        continue
                    quality = stream.get("quality") or "default"
                    hls_sources.append({
                        "url": url,
                        "file": url,
                        "isM3U8": True,
                        "quality": quality,
                        "label": quality,
                        "provider": provider_id,
                    })

                if not hls_sources:
                    return None

                # Sort by quality
                def q_int(s):
                    m = re.search(r"(\d+)", s.get("quality", ""))
                    return int(m.group(1)) if m else 0
                hls_sources.sort(key=q_int, reverse=True)

                return {
                    "source_type": "hls",
                    "video_link": hls_sources[0]["url"],
                    "sources": [{"file": s["url"], "url": s["url"], "quality": s["quality"]} for s in hls_sources],
                    "hls_sources": hls_sources,
                    "available_qualities": [s["quality"] for s in hls_sources],
                    "provider": f"ax-{provider_id}",
                    "intro": raw.get("intro"),
                    "outro": raw.get("outro"),
                    "tracks": raw.get("tracks", []),
                    "headers": upstream_headers,
                }
        except Exception as e:
            logger.warning(f"[AnimeX] Source fetch failed: {e}")
            return None


# ──────────────────────────────────────────────────────────────
#  Unified Scraper (aggregates all providers)
# ──────────────────────────────────────────────────────────────

class YumeZoneScraper:
    """
    Unified scraper that aggregates YumeZone's own tRPC API,
    Miruro, Zenith (AllAnime), and AnimeX providers.
    
    This is the main entry point for scraping anime data.
    """

    def __init__(self):
        self.yz = YumeZoneClient()
        self.miruro = MiruroClient()
        self.zenith = ZenithScraper()
        self.animex = AnimeXScraper()

    async def close(self):
        await self.yz.close()
        await self.miruro.close()
        await self.zenith.close()
        await self.animex.close()

    async def search(self, query: str, page: int = 1) -> List[Dict[str, Any]]:
        """Search anime by name across providers."""
        results = []
        
        # Try YumeZone tRPC first
        try:
            data = await self.yz.search(query, page)
            if data and data.get("animes"):
                for anime in data["animes"]:
                    results.append({
                        "id": anime.get("id"),
                        "anilist_id": anime.get("anilistId"),
                        "name": anime.get("name"),
                        "jname": anime.get("jname"),
                        "poster": anime.get("poster"),
                        "episodes": anime.get("episodes", {}),
                        "type": anime.get("type"),
                        "rating": anime.get("rating"),
                        "source": "yumezone_trpc",
                    })
                return results
        except Exception as e:
            logger.warning(f"YumeZone search failed: {e}")

        # Fallback: Miruro API directly
        try:
            data = await self.miruro.search(query, page)
            if data and data.get("animes"):
                for anime in data["animes"]:
                    results.append({
                        "id": anime.get("id"),
                        "anilist_id": anime.get("anilistId"),
                        "name": anime.get("name"),
                        "jname": anime.get("jname"),
                        "poster": anime.get("poster"),
                        "episodes": anime.get("episodes", {}),
                        "type": anime.get("type"),
                        "rating": anime.get("rating"),
                        "source": "miruro",
                    })
        except Exception as e:
            logger.warning(f"Miruro search failed: {e}")

        return results

    async def get_anime_info(self, anime_id: str) -> Dict[str, Any]:
        """Get comprehensive anime info."""
        # Try YumeZone tRPC
        try:
            data = await self.yz.get_full_info(anime_id)
            if data and data.get("success"):
                return data.get("data", {})
        except Exception:
            pass

        # Fallback: Miruro
        try:
            data = await self.miruro.get_anime_info(anime_id)
            if data:
                return data
        except Exception:
            pass

        return {}

    async def get_episodes(self, anime_id: str) -> Dict[str, Any]:
        """
        Get episodes with full provider mapping.
        Returns providers_map with episode IDs for each server.
        This is the 'addlist' mapping.
        """
        # Try YumeZone tRPC
        try:
            data = await self.yz.get_episodes(anime_id)
            if data and data.get("success"):
                return data.get("data", {})
        except Exception:
            pass

        # Fallback: Miruro
        try:
            data = await self.miruro.get_episodes(anime_id)
            if data:
                providers = data.get("providers", {})
                result = {
                    "anime_id": anime_id,
                    "providers_map": providers,
                    "all_providers": list(providers.keys()),
                    "episodes": [],
                    "default_provider": None,
                }
                # Pick best provider and extract episodes
                for p_name in PROVIDER_PRIORITY:
                    if p_name in providers:
                        p_data = providers[p_name]
                        if isinstance(p_data, dict):
                            eps = p_data.get("episodes", {}) or {}
                            sub_eps = eps.get("sub", []) or []
                            if sub_eps:
                                result["default_provider"] = p_name
                                result["episodes"] = [
                                    {
                                        "episodeId": ep.get("id", ""),
                                        "number": ep.get("number", 0),
                                        "title": ep.get("title") or f"Episode {ep.get('number', '?')}",
                                        "isFiller": ep.get("filler", False),
                                    }
                                    for ep in sub_eps
                                ]
                                break
                return result
        except Exception:
            pass

        return {"episodes": [], "providers_map": {}}

    async def get_sources(self, anime_id: str, episode_number: int,
                           provider: Optional[str] = None,
                           category: str = "sub") -> Dict[str, Any]:
        """
        Get streaming sources for a specific episode.
        Tries all providers in priority order until one works.
        
        Returns m3u8/HLS URLs, embed URLs, or MP4 URLs with headers.
        """
        results = {}

        # 1. Try YumeZone tRPC (fastest, already aggregates)
        try:
            data = await self.yz.get_sources(anime_id, episode_number, provider)
            if data and not data.get("error"):
                results["yumezone"] = data
                if data.get("hls_sources") or data.get("embed_sources") or data.get("video_link"):
                    results["working_provider"] = data.get("provider", "yumezone")
        except Exception as e:
            logger.warning(f"YumeZone sources failed: {e}")

        # 2. Try Miruro directly for the specific episode
        try:
            episodes_data = await self.get_episodes(anime_id)
            providers_map = episodes_data.get("providers_map", {})
            
            # Find episode ID for the requested provider
            target_provider = provider or episodes_data.get("default_provider", "kiwi")
            if target_provider in providers_map:
                p_data = providers_map[target_provider]
                eps = (p_data.get("episodes", {}) or {}).get(category, []) or []
                for ep in eps:
                    if ep.get("number") == episode_number:
                        ep_id = ep.get("id", "")
                        if ep_id:
                            # Try Miruro watch endpoint
                            miruro_data = await self.miruro.get_sources(
                                target_provider, int(anime_id), category,
                                ep_id.split("/")[-1] if "/" in ep_id else ep_id
                            )
                            if miruro_data:
                                results["miruro"] = miruro_data
                                # Parse streams
                                raw_streams = (
                                    miruro_data.get("streams", []) or
                                    miruro_data.get("sources", []) or []
                                )
                                for stream in raw_streams:
                                    if isinstance(stream, dict):
                                        url = stream.get("url", "")
                                        stype = (stream.get("type") or "").lower()
                                        quality = stream.get("quality", "default")
                                        if stype == "hls" or url.endswith(".m3u8"):
                                            proxied = route_stream_proxy(url, target_provider,
                                                                          {"referer": stream.get("referer", "")})
                                            results.setdefault("m3u8_urls", []).append({
                                                "url": proxied,
                                                "quality": quality,
                                                "provider": target_provider,
                                                "raw_url": url,
                                                "headers": stream.get("referer", ""),
                                            })
                                        elif stype == "embed":
                                            results.setdefault("embed_urls", []).append({
                                                "url": url,
                                                "quality": quality,
                                                "provider": target_provider,
                                            })
                        break
        except Exception as e:
            logger.warning(f"Miruro sources failed: {e}")

        # 3. Try Zenith (AllAnime) for MP4 streams
        if not results.get("m3u8_urls") and not results.get("embed_urls"):
            try:
                info = await self.get_anime_info(anime_id)
                title = info.get("title") or info.get("name") or ""
                zenith_data = await self.zenith.get_episode_url(
                    int(anime_id), title, str(episode_number), category
                )
                if zenith_data:
                    results["zenith"] = zenith_data
                    if zenith_data.get("source_type") == "mp4":
                        results.setdefault("mp4_urls", []).append({
                            "url": zenith_data["video_link"],
                            "quality": "best",
                            "provider": "zenith",
                        })
            except Exception as e:
                logger.warning(f"Zenith sources failed: {e}")

        # 4. Try AnimeX for HLS streams
        if not results.get("m3u8_urls") and not results.get("embed_urls") and not results.get("mp4_urls"):
            try:
                animex_data = await self.animex.get_sources(int(anime_id), episode_number, category)
                if animex_data:
                    results["animex"] = animex_data
                    for src in animex_data.get("hls_sources", []):
                        results.setdefault("m3u8_urls", []).append({
                            "url": src["url"],
                            "quality": src.get("quality", "default"),
                            "provider": f"ax-{animex_data.get('provider', 'animex')}",
                            "raw_url": src["url"],
                            "headers": animex_data.get("headers", {}),
                        })
            except Exception as e:
                logger.warning(f"AnimeX sources failed: {e}")

        # 5. Try Zoro (Megaplay embed) as last resort
        if not results.get("m3u8_urls") and not results.get("embed_urls"):
            try:
                embed_url = f"https://megaplay.buzz/stream/ani/{anime_id}/{episode_number}/{category}"
                results.setdefault("embed_urls", []).append({
                    "url": embed_url,
                    "quality": "default",
                    "provider": "zoro",
                })
            except Exception:
                pass

        # Summary
        results["summary"] = {
            "anime_id": anime_id,
            "episode_number": episode_number,
            "category": category,
            "requested_provider": provider,
            "has_m3u8": bool(results.get("m3u8_urls")),
            "has_mp4": bool(results.get("mp4_urls")),
            "has_embed": bool(results.get("embed_urls")),
            "providers_tried": ["yumezone", "miruro", "zenith", "animex", "zoro"],
        }

        return results

    async def map_anime(self, anime_id: str) -> Dict[str, Any]:
        """
        Complete mapping of an anime: info, episodes, providers, IDs.
        This is the 'addlist' mapping — shows all server/episode ID combos.
        """
        info = await self.get_anime_info(anime_id)
        episodes_data = await self.get_episodes(anime_id)
        
        title = info.get("title") or info.get("name") or ""
        anilist_id = info.get("anilistId") or int(anime_id) if anime_id.isdigit() else None
        
        # Zenith mapping
        zenith_id = None
        if anilist_id and title:
            try:
                zenith_id = await self.zenith.map_anilist_to_allanime(anilist_id, title)
            except Exception:
                pass

        # AnimeX mapping
        animex_slug = None
        if anilist_id:
            try:
                animex_slug = await self.animex.map_anilist(int(anilist_id))
            except Exception:
                pass

        return {
            "anilist_id": anilist_id,
            "mal_id": info.get("malId"),
            "title": title,
            "japanese_title": info.get("japanese", ""),
            "type": info.get("type", ""),
            "status": info.get("status", ""),
            "total_sub_episodes": info.get("total_sub_episodes") or info.get("stats", {}).get("episodes", {}).get("sub"),
            "total_dub_episodes": info.get("total_dub_episodes") or info.get("stats", {}).get("episodes", {}).get("dub"),
            "poster": info.get("poster", ""),
            "banner": info.get("banner", ""),
            "rating": info.get("rating") or info.get("malScore"),
            "genres": info.get("genres", []),
            "studios": info.get("studios", []),
            "synonyms": info.get("synonyms", []),
            "aired": info.get("aired", ""),
            "provider_mappings": {
                "zenith_allanime_id": zenith_id,
                "animex_slug": animex_slug,
                "miruro_providers": episodes_data.get("all_providers", []),
                "default_provider": episodes_data.get("default_provider"),
            },
            "episodes": episodes_data.get("episodes", [])[:5],  # First 5 for preview
            "providers_map": {
                k: {
                    "meta": v.get("meta", {}),
                    "sub_episodes": len((v.get("episodes", {}) or {}).get("sub", []) or []),
                    "dub_episodes": len((v.get("episodes", {}) or {}).get("dub", []) or []),
                    "sample_episode_id": (
                        ((v.get("episodes", {}) or {}).get("sub", []) or [{}])[0].get("id", "")
                    ),
                }
                for k, v in (episodes_data.get("providers_map", {}) or {}).items()
            },
        }


# ──────────────────────────────────────────────────────────────
#  CLI Interface
# ──────────────────────────────────────────────────────────────

async def main():
    parser = argparse.ArgumentParser(description="YumeZone Anime Scraper")
    sub = parser.add_subparsers(dest="command")

    # Search
    p_search = sub.add_parser("search", help="Search anime by name")
    p_search.add_argument("query", help="Search query")
    p_search.add_argument("--page", type=int, default=1)

    # Info
    p_info = sub.add_parser("info", help="Get anime info by AniList ID")
    p_info.add_argument("id", help="AniList anime ID")

    # Episodes
    p_eps = sub.add_parser("episodes", help="Get episode list with provider mapping")
    p_eps.add_argument("id", help="AniList anime ID")

    # Sources
    p_src = sub.add_parser("sources", help="Get streaming sources for an episode")
    p_src.add_argument("id", help="AniList anime ID")
    p_src.add_argument("episode", type=int, help="Episode number")
    p_src.add_argument("--provider", help="Preferred provider (zenith, kiwi, ax-mimi, etc.)")
    p_src.add_argument("--category", default="sub", choices=["sub", "dub"])

    # Map
    p_map = sub.add_parser("map", help="Complete ID mapping for an anime")
    p_map.add_argument("id", help="AniList anime ID")

    # Full scrape
    p_full = sub.add_parser("full", help="Full scrape: info + episodes + sources for ep 1")
    p_full.add_argument("id", help="AniList anime ID")
    p_full.add_argument("--episode", type=int, default=1)
    p_full.add_argument("--provider", help="Preferred provider")

    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        return

    scraper = YumeZoneScraper()

    try:
        if args.command == "search":
            print(f"\n🔍 Searching for: {args.query}\n")
            results = await scraper.search(args.query, args.page)
            if not results:
                print("No results found.")
            for i, r in enumerate(results, 1):
                print(f"  {i}. [{r.get('anilist_id')}] {r.get('name')}")
                print(f"     Type: {r.get('type')} | Rating: {r.get('rating')} | "
                      f"Episodes: {r.get('episodes', {})}")
                print(f"     Poster: {r.get('poster', '')[:80]}")
                print()

        elif args.command == "info":
            print(f"\n📋 Anime Info for ID: {args.id}\n")
            info = await scraper.get_anime_info(args.id)
            if not info:
                print("No info found.")
            else:
                print(f"  Title: {info.get('title') or info.get('name')}")
                print(f"  Japanese: {info.get('japanese', '')}")
                print(f"  Type: {info.get('type')} | Status: {info.get('status')}")
                print(f"  Rating: {info.get('rating') or info.get('malScore')}")
                print(f"  Genres: {', '.join(info.get('genres', []))}")
                print(f"  Studios: {', '.join(s.get('name', '') for s in info.get('studios', []))}")
                sub_eps = info.get('total_sub_episodes') or info.get('stats', {}).get('episodes', {}).get('sub', '?')
                dub_eps = info.get('total_dub_episodes') or info.get('stats', {}).get('episodes', {}).get('dub', '?')
                print(f"  Episodes: {sub_eps} sub / {dub_eps} dub")
                print(f"  Aired: {info.get('aired', '')}")
                print(f"  AniList ID: {info.get('anilistId')}")
                print(f"  MAL ID: {info.get('malId')}")
                print(f"  Poster: {info.get('poster', '')}")
                print(f"  Banner: {info.get('banner', '')}")

        elif args.command == "episodes":
            print(f"\n📺 Episodes for anime ID: {args.id}\n")
            data = await scraper.get_episodes(args.id)
            providers_map = data.get("providers_map", {})
            
            print(f"  Default provider: {data.get('default_provider', 'N/A')}")
            print(f"  Available providers: {', '.join(data.get('all_providers', []))}")
            print()
            
            # Show provider mapping
            print("  ═══ Provider → Episode ID Mapping (Addlist) ═══")
            for p_name, p_data in providers_map.items():
                if not isinstance(p_data, dict):
                    continue
                eps = p_data.get("episodes", {}) or {}
                sub_eps = eps.get("sub", []) or []
                dub_eps = eps.get("dub", []) or []
                print(f"\n  Provider: {p_name}")
                print(f"    Sub episodes: {len(sub_eps)}")
                print(f"    Dub episodes: {len(dub_eps)}")
                for ep in sub_eps[:3]:  # Show first 3
                    print(f"      EP {ep.get('number')}: id={ep.get('id')}")
                if len(sub_eps) > 3:
                    print(f"      ... and {len(sub_eps) - 3} more")
            
            # Show episode list
            episodes = data.get("episodes", [])
            if episodes:
                print(f"\n  ═══ Episode List ({len(episodes)} total) ═══")
                for ep in episodes[:10]:
                    print(f"    EP {ep.get('number')}: {ep.get('title')} "
                          f"{'[Filler]' if ep.get('isFiller') else ''}")
                if len(episodes) > 10:
                    print(f"    ... and {len(episodes) - 10} more")

        elif args.command == "sources":
            print(f"\n🎬 Sources for anime {args.id}, episode {args.episode}")
            print(f"   Provider: {args.provider or 'auto'} | Category: {args.category}\n")
            
            sources = await scraper.get_sources(args.id, args.episode, args.provider, args.category)
            
            # Show m3u8/HLS URLs
            m3u8_urls = sources.get("m3u8_urls", [])
            if m3u8_urls:
                print("  ═══ M3U8 / HLS URLs ═══")
                for s in m3u8_urls:
                    print(f"    Quality: {s['quality']} | Provider: {s['provider']}")
                    print(f"    URL: {s['url']}")
                    if s.get("raw_url") and s["raw_url"] != s["url"]:
                        print(f"    Raw:  {s['raw_url']}")
                    if s.get("headers"):
                        print(f"    Headers: {s['headers']}")
                    print()
            
            # Show MP4 URLs
            mp4_urls = sources.get("mp4_urls", [])
            if mp4_urls:
                print("  ═══ MP4 URLs ═══")
                for s in mp4_urls:
                    print(f"    Quality: {s['quality']} | Provider: {s['provider']}")
                    print(f"    URL: {s['url']}")
                    print()
            
            # Show embed URLs
            embed_urls = sources.get("embed_urls", [])
            if embed_urls:
                print("  ═══ Embed URLs ═══")
                for s in embed_urls:
                    print(f"    Quality: {s['quality']} | Provider: {s['provider']}")
                    print(f"    URL: {s['url']}")
                    print()
            
            # Show summary
            summary = sources.get("summary", {})
            print(f"  ═══ Summary ═══")
            print(f"    Has M3U8:  {summary.get('has_m3u8')}")
            print(f"    Has MP4:   {summary.get('has_mp4')}")
            print(f"    Has Embed: {summary.get('has_embed')}")
            print(f"    Providers tried: {', '.join(summary.get('providers_tried', []))}")

        elif args.command == "map":
            print(f"\n🗺️  Complete Mapping for anime ID: {args.id}\n")
            mapping = await scraper.map_anime(args.id)
            
            print(f"  Title: {mapping.get('title')}")
            print(f"  AniList ID: {mapping.get('anilist_id')}")
            print(f"  MAL ID: {mapping.get('mal_id')}")
            print()
            print(f"  ═══ Provider ID Mappings ═══")
            pm = mapping.get("provider_mappings", {})
            print(f"    Zenith (AllAnime) ID: {pm.get('zenith_allanime_id')}")
            print(f"    AnimeX slug:          {pm.get('animex_slug')}")
            print(f"    Miruro providers:     {', '.join(pm.get('miruro_providers', []))}")
            print(f"    Default provider:     {pm.get('default_provider')}")
            print()
            
            print(f"  ═══ Providers Map (Addlist) ═══")
            for p_name, p_data in mapping.get("providers_map", {}).items():
                print(f"    {p_name}: {p_data.get('sub_episodes', 0)} sub / "
                      f"{p_data.get('dub_episodes', 0)} dub")
                if p_data.get("sample_episode_id"):
                    print(f"      Sample ep ID: {p_data['sample_episode_id']}")

        elif args.command == "full":
            print(f"\n🚀 Full Scrape for anime ID: {args.id} (episode {args.episode})\n")
            
            # 1. Search/Info
            info = await scraper.get_anime_info(args.id)
            title = info.get("title") or info.get("name") or "Unknown"
            print(f"  Title: {title}")
            print(f"  AniList ID: {info.get('anilistId')} | MAL ID: {info.get('malId')}")
            print(f"  Type: {info.get('type')} | Rating: {info.get('rating') or info.get('malScore')}")
            
            # 2. Episodes + provider mapping
            eps = await scraper.get_episodes(args.id)
            print(f"\n  Episodes: {len(eps.get('episodes', []))} total")
            print(f"  Providers: {', '.join(eps.get('all_providers', []))}")
            print(f"  Default: {eps.get('default_provider')}")
            
            # 3. Sources
            print(f"\n  ═══ Streaming Sources for Episode {args.episode} ═══")
            sources = await scraper.get_sources(args.id, args.episode, args.provider)
            
            for stream_type in ["m3u8_urls", "mp4_urls", "embed_urls"]:
                urls = sources.get(stream_type, [])
                if urls:
                    label = {"m3u8_urls": "HLS/M3U8", "mp4_urls": "MP4", "embed_urls": "Embed"}[stream_type]
                    print(f"\n  {label} Sources:")
                    for u in urls:
                        print(f"    [{u.get('quality', '?')}] [{u.get('provider', '?')}]")
                        print(f"    {u['url']}")
            
            # Summary
            summary = sources.get("summary", {})
            print(f"\n  ═══ Result ═══")
            print(f"    M3U8: {summary.get('has_m3u8')} | MP4: {summary.get('has_mp4')} | Embed: {summary.get('has_embed')}")

    finally:
        await scraper.close()


if __name__ == "__main__":
    asyncio.run(main())
