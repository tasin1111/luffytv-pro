"use client";

import { useState, useEffect } from "react";

// ============================================================
// WatchPageShell — Miruro-inspired clean design
// Layout:
//   Left (70%): Player → Title → Actions → Audio/Servers → Description → Comments
//   Right (30%): Episode sidebar with big thumbnails
// Design:
//   Pure B/W, minimal borders, spacing-driven hierarchy
// ============================================================

export function WatchPageShell({
  streamLoading, streamError, streamData, activeProvider,
  animeTitle, episodeNum, animeEpisodes, animeDuration, animeStatus,
  animeImage, animeDescription, animeScore, animeType, animeSeason,
  animeStudios, animeGenres, animeNextAiring, countdown,
  translation, softsubAvailable, hardsubAvailable, dubAvailable,
  handleTranslationChange,
  serverList, selectedServer, setSelectedServer, setStreamError,
  setStreamLoading, getProviderDisplayName,
  episodeList, filteredEps, epSearch, setEpSearch, switchEpisode,
  prevEp, nextEp,
  autoPlay, setAutoPlay, autoSkip, setAutoSkip, autoNext, setAutoNext,
  skipFiller, setSkipFiller,
  navigate, relations,
  HLSPlayerNew, EmbedPlayerWithFallback, DashPlayer, proxifyM3u8, proxify,
  AnimeComments,
  handleVideoEnded, handleProviderFailed, handleProviderSelect,
  failedProviders, providersForCurrentEp,
  setScraperFallbackToken, showShortcuts, setShowShortcuts,
  lightsOff, setLightsOff,
  synopsisExpanded, setSynopsisExpanded, animeId,
}: any) {
  const [showServerBanner, setShowServerBanner] = useState(true);
  const [visibleEpCount, setVisibleEpCount] = useState(50);

  const currentEp = episodeList?.find((ep: any) => ep.number === episodeNum);

  return (
    <div className="min-h-screen bg-black text-white" style={{ fontFamily: "var(--font-inter), Inter, sans-serif" }}>

      {/* Lights Off overlay */}
      {lightsOff && (
        <div className="fixed inset-0 bg-black/90 z-30 pointer-events-none" style={{ backdropFilter: "blur(8px)" }} />
      )}

      {/* ══ MAIN CONTAINER ══ */}
      <div className="w-full flex flex-col relative overflow-x-hidden pb-10" style={{ paddingTop: "0.5rem" }}>

        {/* ══ TWO-COLUMN LAYOUT: Left (player+content) | Right (sidebar) ══ */}
        <div className="flex w-full max-lg:flex-col gap-1 items-start">

          {/* ══ LEFT COLUMN (72%) — Player + Title + Actions + Servers + Description ══ */}
          <div className="w-full lg:w-[72%] shrink-0 flex flex-col gap-3 px-2">

            {/* ─── PLAYER — square box, no rounded corners, covers full left side ─── */}
            <div className="relative w-full shrink-0 overflow-hidden bg-black" style={{ aspectRatio: "16 / 9" }}>
              {streamData && streamData.source_type === "hls" && streamData.video_link && (
                <HLSPlayerNew
                  key={selectedServer}
                  url={proxifyM3u8(streamData.video_link)}
                  animeId={animeId}
                  episodeNum={episodeNum}
                  sourceType="hls"
                  intro={streamData.intro}
                  outro={streamData.outro}
                  allStreams={streamData.hls_sources?.map((s: any) => ({
                    url: proxifyM3u8(s.url), quality: s.quality || "Auto", label: s.label || s.quality || "Auto",
                  })) || []}
                  subtitleTracks={(streamData.subtitle_tracks || []).map((s: any) => ({ url: proxify(s.url, "raw"), lang: s.label || "en", label: s.label || "English" }))}
                  onEnded={handleVideoEnded}
                  onProviderFailed={() => handleProviderFailed(activeProvider)}
                  autoplay={autoPlay}
                />
              )}
              {streamData && streamData.source_type === "mp4" && streamData.video_link && (
                <HLSPlayerNew
                  key={`mp4-${selectedServer}`}
                  url={proxify(streamData.video_link, "raw")}
                  animeId={animeId}
                  episodeNum={episodeNum}
                  sourceType="mp4"
                  intro={streamData.intro}
                  outro={streamData.outro}
                  onEnded={handleVideoEnded}
                  onProviderFailed={() => handleProviderFailed(activeProvider)}
                  autoplay={autoPlay}
                />
              )}
              {streamData && streamData.source_type === "embed" && streamData.video_link && (
                <EmbedPlayerWithFallback
                  key={`embed-${activeProvider}-${episodeNum}-${translation}`}
                  src={streamData.video_link}
                  animeTitle={animeTitle}
                  episodeNum={episodeNum}
                  provider={activeProvider}
                  providersForCurrentEp={providersForCurrentEp}
                  failedProviders={failedProviders}
                  onProviderFailed={handleProviderFailed}
                  onProviderSelect={handleProviderSelect}
                  getProviderDisplayName={getProviderDisplayName}
                />
              )}
              {streamData && streamData.source_type === "dash" && streamData.video_link && (
                <DashPlayer
                  key={`dash-${selectedServer}`}
                  url={streamData.video_link}
                  subtitleTracks={streamData.subtitle_tracks || []}
                  onEnded={handleVideoEnded}
                  autoplay={autoPlay}
                />
              )}
              {streamLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black z-20">
                  <div className="text-center space-y-3">
                    <div className="w-10 h-10 border-2 border-white/10 border-t-white rounded-full animate-spin mx-auto" />
                    <p className="text-white/50 text-xs font-medium">Loading from <span className="text-white">{getProviderDisplayName(activeProvider)}</span>...</p>
                  </div>
                </div>
              )}
              {streamError && !streamLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black z-20">
                  <div className="text-center space-y-4 max-w-sm px-6">
                    <div className="w-12 h-12 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center mx-auto">
                      <svg className="w-6 h-6 text-white/70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                    </div>
                    <p className="text-white/80 text-sm">{streamError}</p>
                    <button onClick={() => { setStreamError(null); setStreamLoading(true); setScraperFallbackToken((t: number) => t + 1); }} className="px-5 py-2 rounded-lg bg-white text-black text-xs font-bold hover:bg-white/90 transition-colors">Retry</button>
                  </div>
                </div>
              )}
            </div>

            {/* ─── SERVER FALLBACK BANNER ─── */}
            {showServerBanner && (streamError || serverList?.length > 1) && (
              <div className="flex items-center justify-between bg-white/[0.06] px-4 py-2.5 rounded-lg text-white/60">
                <p className="text-xs flex items-center gap-2 leading-tight">
                  <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" /></svg>
                  If the current server doesn't work, try the other available servers below.
                </p>
                <button onClick={() => setShowServerBanner(false)} className="shrink-0 ml-2 hover:text-white transition-colors">
                  <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12" /></svg>
                </button>
              </div>
            )}

            {/* ─── TITLE + ANIME LINK ─── */}
            <div className="flex flex-col gap-3">
              {/* Episode title */}
              <h1 className="font-bold text-lg md:text-xl xl:text-2xl -tracking-[0.02rem] line-clamp-2 leading-tight">
                {currentEp?.title || `Episode ${episodeNum}`}
              </h1>

              {/* Anime link row */}
              <div className="flex items-center gap-3">
                {animeImage && (
                  <button onClick={() => navigate({ page: "anime", id: String(animeId) })} className="flex size-9 aspect-square shrink-0 bg-white/5 rounded-full overflow-hidden hover:ring-2 hover:ring-white/20 transition-all" title={animeTitle}>
                    <img src={animeImage} alt="" className="w-full h-full object-cover" />
                  </button>
                )}
                <button onClick={() => navigate({ page: "anime", id: String(animeId) })} className="flex flex-col text-left min-w-0 hover:text-white/80 transition-colors">
                  <span className="font-semibold text-sm line-clamp-1 -tracking-[0.01rem]">{animeTitle}</span>
                  <span className="text-white/40 text-xs flex items-center gap-1.5">
                    <span>Episode {episodeNum}{animeEpisodes ? ` of ${animeEpisodes}` : ""}</span>
                    {animeDuration && <><span>·</span><span>{animeDuration}m</span></>}
                  </span>
                </button>
              </div>

              {/* Meta line */}
              <div className="flex items-center gap-2 text-xs font-medium flex-wrap">
                {animeScore && <span className="flex items-center gap-1 text-white"><svg class="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>{animeScore > 10 ? Math.round(animeScore) : animeScore}%</span>}
                {animeSeason && <><span className="text-white/20">·</span><span className="text-white/60">{animeSeason}</span></>}
                {animeType && <><span className="text-white/20">·</span><span className="text-white/60">{animeType}</span></>}
                {animeStatus === "RELEASING" && <><span className="text-white/20">·</span><span className="text-white/60 inline-flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />Airing</span></>}
              </div>
            </div>

            {/* ─── ACTION BUTTONS ROW ─── */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Save */}
              <button onClick={() => { /* bookmark toggle */ }} className="h-9 bg-white font-semibold text-black rounded-full flex items-center gap-1.5 justify-center text-xs px-4 hover:brightness-90 transition-all">
                <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" /></svg>
                Save
              </button>

              {/* Sub/Dub toggle */}
              <button onClick={() => handleTranslationChange(translation === "sub" ? "dub" : "sub")} disabled={translation === "dub" && !dubAvailable} className="h-9 bg-white/10 font-semibold text-white rounded-full flex items-center gap-1.5 justify-center text-xs px-4 hover:bg-white/15 transition-all disabled:opacity-50">
                <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M12 19v3M19 10v2a7 7 0 0 1-14 0v-2M9 2h6v13H9z" /></svg>
                {translation === "dub" ? "Dub" : "Sub"}
              </button>

              {/* Share */}
              <button onClick={() => { if (navigator.share) navigator.share({ title: animeTitle, url: window.location.href }); else navigator.clipboard.writeText(window.location.href); }} className="h-9 bg-white/10 font-medium text-white rounded-full flex items-center gap-1.5 justify-center text-xs px-4 hover:bg-white/15 transition-all">
                <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
                <span className="hidden sm:flex">Share</span>
              </button>

              {/* Lights Off */}
              <button onClick={() => setLightsOff(!lightsOff)} className={`h-9 font-medium text-white rounded-full flex items-center justify-center text-xs px-4 transition-all ${lightsOff ? "bg-white/20" : "bg-white/10 hover:bg-white/15"}`}>
                <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.1V18h6v-1.2c0-.8.4-1.6 1-2.1A7 7 0 0 0 12 2z" /></svg>
                <span className="hidden sm:flex ml-1.5">Lights</span>
              </button>

              <div className="flex-1" />

              {/* Prev/Next */}
              <div className="flex items-center gap-1">
                {prevEp && (
                  <button onClick={() => switchEpisode(prevEp)} className="h-9 px-3 rounded-full bg-white/10 text-white/60 hover:bg-white/15 hover:text-white transition-colors flex items-center gap-1 text-xs font-medium" title="Previous (P)">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M15 19l-7-7 7-7" /></svg>
                    <span className="hidden sm:flex">Prev</span>
                  </button>
                )}
                {nextEp && (
                  <button onClick={() => switchEpisode(nextEp)} className="h-9 px-3 rounded-full bg-white/10 text-white/60 hover:bg-white/15 hover:text-white transition-colors flex items-center gap-1 text-xs font-medium" title="Next (N)">
                    <span className="hidden sm:flex">Next</span>
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M9 5l7 7-7 7" /></svg>
                  </button>
                )}
              </div>
            </div>

            {/* ─── AUTO TOGGLES ROW — soft sky blue when active ─── */}
            <div className="flex items-center gap-4 flex-wrap text-xs">
              {[
                { label: "Autoplay", state: autoPlay, setter: setAutoPlay },
                { label: "Auto Skip", state: autoSkip, setter: setAutoSkip },
                { label: "Auto Next", state: autoNext, setter: setAutoNext },
                { label: "Skip Filler", state: skipFiller, setter: setSkipFiller },
              ].map(({ label, state, setter }) => (
                <button key={label} onClick={() => setter(!state)} className="flex items-center gap-1.5 group">
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all ${state ? "bg-[#7DD3FC] border-[#7DD3FC]" : "bg-transparent border-white/20 group-hover:border-white/40"}`}>
                    {state && <svg className="w-2.5 h-2.5 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                  </div>
                  <span className={`font-medium transition-colors ${state ? "text-[#7DD3FC]" : "text-white/40 group-hover:text-white/70"}`}>{label}</span>
                </button>
              ))}
            </div>

            {/* ─── AUDIO + SERVER SELECTOR ─── */}
            <div className="flex flex-col gap-3 py-3 border-y border-white/[0.06]">
              {/* Audio row */}
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-[10px] font-bold text-white/40 uppercase tracking-wider shrink-0 w-12">Audio</span>
                <div className="flex rounded-full overflow-hidden h-8 bg-white/[0.04] p-0.5">
                  {[
                    { id: "sub", label: "Sub", available: softsubAvailable },
                    { id: "hardsub", label: "Hard Sub", available: hardsubAvailable },
                    { id: "dub", label: "Dub", available: dubAvailable },
                    { id: "hindi", label: "Hindi", available: true },
                  ].map(t => (
                    <button
                      key={t.id}
                      onClick={() => handleTranslationChange(t.id)}
                      disabled={!t.available}
                      className={`px-3.5 h-7 text-[11px] font-bold rounded-full transition-all ${translation === t.id ? "bg-white text-black" : "text-white/50 hover:text-white"} ${!t.available ? "opacity-30 cursor-not-allowed" : ""}`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
              {/* Server row */}
              {serverList?.length > 0 && (
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-[10px] font-bold text-white/40 uppercase tracking-wider shrink-0 w-12">Server</span>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {serverList
                      .filter((s: any) => {
                        if (translation === "hindi") return s.source === "anixtv";
                        if (translation === "dub") return s.type === "dub" && s.source !== "anixtv";
                        if (translation === "hardsub") return s.type === "sub" && s.hardsub === true;
                        return s.type === "sub";
                      })
                      .slice(0, 30)
                      .map((s: any) => (
                        <button
                          key={s.id}
                          onClick={() => { setSelectedServer(s.id); setStreamError(null); }}
                          className={`px-3 py-1.5 rounded-full text-[11px] font-bold transition-all ${selectedServer === s.id ? "bg-white text-black" : "bg-white/[0.04] text-white/50 hover:text-white hover:bg-white/10"}`}
                        >
                          {s.name}
                        </button>
                      ))}
                  </div>
                </div>
              )}
            </div>

            {/* ─── DESCRIPTION CARD ─── */}
            {animeDescription && (
              <div className="flex flex-col gap-2 cursor-pointer" onClick={() => setSynopsisExpanded(!synopsisExpanded)}>
                <p className={`text-sm text-white/70 leading-relaxed select-text ${synopsisExpanded ? "" : "line-clamp-3"}`}>
                  {animeDescription.replace(/<[^>]*>/g, "")}
                </p>
                <button className="text-xs text-white/40 hover:text-white/70 font-medium w-fit transition-colors">
                  {synopsisExpanded ? "Show less" : "Read more"}
                </button>
              </div>
            )}

            {/* ─── GENRES + STUDIO ─── */}
            <div className="flex flex-col gap-3">
              {animeGenres?.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap">
                  {animeGenres.map((g: string) => (
                    <button key={g} onClick={() => navigate({ page: "genre", genre: g })} className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-white/[0.04] text-white/60 hover:bg-white/10 hover:text-white border border-white/[0.06] transition-all">
                      {g}
                    </button>
                  ))}
                </div>
              )}
              {animeStudios?.length > 0 && (
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-bold text-white/40 uppercase tracking-wider">Studio</span>
                  <span className="text-white/60">{animeStudios.join(", ")}</span>
                </div>
              )}
            </div>

            {/* ─── RELATIONS ─── */}
            {relations?.length > 0 && (
              <div className="flex flex-col gap-3">
                <h3 className="text-sm font-bold text-white/80">Relations</h3>
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                  {relations.slice(0, 10).map((rel: any, idx: number) => {
                    const relTitle = rel.title?.english || rel.title?.romaji || rel.title?.native || "Unknown";
                    const relImage = rel.coverImage?.extraLarge || rel.coverImage?.large || rel.coverImage?.medium || "";
                    return (
                      <button key={`${rel.id}-${idx}`} onClick={() => navigate({ page: "anime", id: String(rel.id) })} className="flex flex-col gap-1.5 group text-left">
                        <div className="aspect-[2/3] rounded-lg overflow-hidden bg-white/5 border border-white/[0.06] group-hover:border-white/20 transition-all">
                          {relImage ? <img src={relImage} alt={relTitle} className="w-full h-full object-cover group-hover:scale-105 transition-transform" loading="lazy" /> : <div className="w-full h-full flex items-center justify-center text-white/15 font-bold text-xl">{relTitle.charAt(0)}</div>}
                        </div>
                        <p className="text-[10px] font-medium text-white/70 line-clamp-1 group-hover:text-white transition-colors">{relTitle}</p>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ─── COMMENTS ─── */}
            {animeId && (
              <div className="w-full flex flex-col gap-4 mt-2">
                <AnimeComments animeId={String(animeId)} animeTitle={animeTitle || "this anime"} episode={episodeNum} />
              </div>
            )}
          </div>{/* end left column (70%) */}

          {/* ══ RIGHT COLUMN (28%) — Episode Sidebar (narrow, tall) ══ */}
          <aside className="w-full lg:w-[28%] shrink-0 px-2">
            <div className="sticky top-14" style={{ height: 'calc(100vh - 4rem)' }}>
              <MiruroEpisodeSidebar
              episodeList={episodeList}
              filteredEps={filteredEps}
              epSearch={epSearch}
              setEpSearch={setEpSearch}
              switchEpisode={switchEpisode}
              episodeNum={episodeNum}
              nextEp={nextEp}
              animeImage={animeImage}
              visibleEpCount={visibleEpCount}
              setVisibleEpCount={setVisibleEpCount}
              softsubAvailable={softsubAvailable}
              hardsubAvailable={hardsubAvailable}
              dubAvailable={dubAvailable}
            />
            </div>
          </aside>

        </div>{/* end two-column row */}

        {/* Keyboard shortcuts modal */}
        {showShortcuts && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowShortcuts(false)}>
            <div className="w-full max-w-sm mx-4 rounded-xl bg-black border border-white/10 shadow-2xl overflow-hidden" onClick={(e: any) => e.stopPropagation()}>
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
                <h3 className="text-sm font-bold text-white">Keyboard Shortcuts</h3>
                <button onClick={() => setShowShortcuts(false)} className="p-1 rounded text-white/40 hover:text-white transition-colors">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              <div className="p-5 space-y-3">
                {[
                  { key: "N", desc: "Next episode" }, { key: "P", desc: "Previous episode" },
                  { key: "Space / K", desc: "Play / Pause" }, { key: "F", desc: "Fullscreen" },
                  { key: "M", desc: "Mute / Unmute" }, { key: "?", desc: "Toggle this panel" },
                ].map(s => (
                  <div key={s.key} className="flex items-center justify-between">
                    <span className="text-xs text-white/55">{s.desc}</span>
                    <kbd className="px-2 py-0.5 rounded bg-white/10 text-[10px] font-mono font-bold text-white border border-white/10">{s.key}</kbd>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// MiruroEpisodeSidebar — Miruro-inspired episode list
// Features:
//   - Bordered gray cards (visible box around each episode)
//   - Spoiler blur with eye icon (click to reveal thumbnail)
//   - Episode title + description
//   - Bottom bar: EP badge + date (left) | CC + mic + dub icons (right)
//   - 1-100 pagination for long anime (like ONE PIECE)
//   - Filter episodes search
// ============================================================

function MiruroEpisodeSidebar({
  episodeList, filteredEps, epSearch, setEpSearch, switchEpisode,
  episodeNum, nextEp, animeImage, visibleEpCount, setVisibleEpCount,
  softsubAvailable, hardsubAvailable, dubAvailable,
}: any) {
  const [spoilerOn, setSpoilerOn] = useState(true); // spoiler blur on by default
  const [page, setPage] = useState(0); // pagination page (0 = first 100)
  const [showPageMenu, setShowPageMenu] = useState(false);

  const EPS_PER_PAGE = 100;
  const totalEps = episodeList?.length || 0;
  const totalPages = Math.ceil(totalEps / EPS_PER_PAGE);

  // Reset to page 0 when search is used
  useEffect(() => {
    if (epSearch) setPage(0);
  }, [epSearch]);

  // Apply pagination: if not searching and >100 eps, show only current page
  const pagedEps = (() => {
    if (epSearch) return filteredEps; // search bypasses pagination
    if (totalPages <= 1) return filteredEps;
    const start = page * EPS_PER_PAGE;
    return filteredEps?.slice(start, start + EPS_PER_PAGE) || [];
  })();

  const pageLabel = totalPages > 1
    ? `${page * EPS_PER_PAGE + 1} - ${Math.min((page + 1) * EPS_PER_PAGE, totalEps)}`
    : `1 - ${totalEps}`;

  return (
    <div className="flex flex-col w-full h-full bg-white/[0.02] rounded-xl border border-white/[0.06] overflow-hidden">
      {/* ─── Header: Up Next + Spoiler toggle ─── */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
        <div className="flex flex-col gap-0.5 min-w-0">
          <div className="text-sm font-bold line-clamp-1">
            {nextEp ? `Up Next` : `Now Playing`}
          </div>
          <div className="text-xs text-white/40 line-clamp-1">
            {filteredEps?.find((ep: any) => ep.number === (nextEp || episodeNum))?.title || `Episode ${nextEp || episodeNum}`}
          </div>
        </div>
        {/* Spoiler eye toggle */}
        <button
          onClick={() => setSpoilerOn(!spoilerOn)}
          className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-all hover:scale-110 active:scale-95 ${spoilerOn ? 'bg-white/10' : 'bg-white/5 opacity-50'}`}
          title={spoilerOn ? 'Spoilers hidden — click to show' : 'Spoilers visible — click to hide'}
        >
          {spoilerOn ? (
            <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="currentColor"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" /></svg>
          ) : (
            <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="currentColor"><path d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2z" /></svg>
          )}
        </button>
      </div>

      {/* ─── Pagination + Search row ─── */}
      <div className="flex items-center px-3 py-2.5 gap-2 border-b border-white/[0.06]">
        {/* Pagination dropdown (1-100) — only show if >100 episodes */}
        {totalPages > 1 && (
          <div className="relative shrink-0">
            <button
              onClick={() => setShowPageMenu(!showPageMenu)}
              className="flex items-center gap-1 bg-white/[0.06] hover:bg-white/[0.1] h-8 px-3 rounded-lg text-xs font-bold text-white/80 transition-all"
            >
              {pageLabel}
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor"><path d="M7 10l5 5 5-5z" /></svg>
            </button>
            {showPageMenu && (
              <div className="absolute top-full left-0 mt-1 bg-black/80 backdrop-blur-xl border border-white/15 rounded-lg overflow-hidden min-w-[100px] py-1 shadow-2xl z-30 max-h-[300px] overflow-y-auto">
                {Array.from({ length: totalPages }, (_, i) => (
                  <button
                    key={i}
                    onClick={() => { setPage(i); setShowPageMenu(false); }}
                    className={`block w-full text-left px-3 py-1.5 text-xs hover:bg-white/10 transition-colors ${page === i ? 'text-white font-bold' : 'text-white/60'}`}
                  >
                    {i * EPS_PER_PAGE + 1} - {Math.min((i + 1) * EPS_PER_PAGE, totalEps)}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Filter episodes search */}
        <div className="flex grow items-center bg-white/[0.04] hover:bg-white/[0.06] focus-within:bg-white/[0.06] h-8 rounded-lg overflow-hidden px-2.5">
          <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" className="text-white/30 shrink-0"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
          <input
            type="text"
            value={epSearch}
            onChange={(e: any) => { setEpSearch(e.target.value); setVisibleEpCount(50); }}
            placeholder="Filter episodes..."
            className="w-full px-2 bg-transparent text-xs text-white placeholder-white/30 focus:outline-none"
          />
        </div>
      </div>

      {/* ─── Episode list — scrollable bordered cards, fills remaining height ─── */}
      <div className="flex flex-col overflow-hidden flex-1 min-h-0">
        <div
          className="flex flex-col overflow-y-auto overscroll-y-contain flex-1 min-h-0 p-2 gap-2"
          onScroll={(e: any) => {
            const el = e.target;
            if (el.scrollTop + el.clientHeight >= el.scrollHeight - 200) {
              setVisibleEpCount(prev => Math.min(prev + 50, pagedEps?.length || 0));
            }
          }}
        >
          {pagedEps?.length > 0 ? (
            pagedEps.slice(0, visibleEpCount).map((ep: any) => (
              <EpisodeCard
                key={ep.number}
                ep={ep}
                isActive={ep.number === episodeNum}
                spoilerOn={spoilerOn}
                animeImage={animeImage}
                softsubAvailable={softsubAvailable}
                hardsubAvailable={hardsubAvailable}
                dubAvailable={dubAvailable}
                onClick={() => switchEpisode(ep.number)}
              />
            ))
          ) : (
            <div className="text-center py-12">
              <p className="text-white/30 text-xs">{episodeList?.length === 0 ? "Loading episodes..." : "No episodes found"}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Episode Card — Miruro-style HORIZONTAL layout ────────────────
// Layout: Image (left) | Text (right) — normal size, not cramped
// Spoiler blur is ONLY on the thumbnail image. Text stays clear.
function EpisodeCard({ ep, isActive, spoilerOn, animeImage, softsubAvailable, hardsubAvailable, dubAvailable, onClick }: any) {
  const epThumb = ep.thumbnail || ep.image || "";
  const fallbackThumb = animeImage || "";
  const isFiller = !!ep.filler;

  // Active = purple, Filler = gold
  const cardStyle = isActive
    ? { background: "rgba(147, 51, 234, 0.12)", borderColor: "rgba(147, 51, 234, 0.5)" }
    : isFiller
    ? { background: "rgba(255, 215, 0, 0.06)", borderColor: "rgba(255, 215, 0, 0.3)" }
    : undefined;
  const cardClass = isActive
    ? "border-[#9333EA]/50"
    : isFiller
    ? "border-[#FFD700]/30 hover:border-[#FFD700]/50"
    : "border-white/10 hover:border-white/20 hover:bg-white/[0.04]";

  return (
    <button
      onClick={onClick}
      className={`flex flex-row w-full rounded-lg overflow-hidden border transition-all text-left shrink-0 ${cardClass}`}
      style={{ height: '100px', ...cardStyle }}
      title={`${ep.number}. ${ep.title || `Episode ${ep.number}`}`}
    >
      {/* ─── THUMBNAIL (LEFT, 110px fixed width) — ONLY this is blurred ─── */}
      <div className="relative shrink-0 overflow-hidden bg-white/[0.04]" style={{ width: '110px', height: '100%' }}>
        {epThumb ? (
          <img
            src={epThumb}
            alt=""
            className={`absolute inset-0 w-full h-full object-cover transition-all duration-300 ${spoilerOn ? 'blur-2xl scale-125 brightness-[0.3]' : ''}`}
            loading="lazy"
            onError={(e: any) => {
              if (fallbackThumb && e.target.src !== fallbackThumb) {
                e.target.src = fallbackThumb;
                e.target.style.opacity = '0.3';
              }
            }}
          />
        ) : fallbackThumb ? (
          <img src={fallbackThumb} alt="" className={`absolute inset-0 w-full h-full object-cover opacity-30 transition-all duration-300 ${spoilerOn ? 'blur-2xl scale-125' : ''}`} loading="lazy" />
        ) : (
          <div className="absolute inset-0 w-full h-full flex items-center justify-center text-lg font-bold text-white/15">{ep.number}</div>
        )}

        {/* Spoiler overlay */}
        {spoilerOn && (epThumb || fallbackThumb) && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="bg-black/70 backdrop-blur-md rounded-full px-2 py-0.5 flex items-center gap-1">
              <svg className="w-2.5 h-2.5 text-white/70" viewBox="0 0 24 24" fill="currentColor"><path d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27z" /></svg>
              <span className="text-[8px] font-bold text-white/70 uppercase tracking-wider">Spoiler</span>
            </div>
          </div>
        )}

        {/* Active play overlay */}
        {isActive && !spoilerOn && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <div className="w-7 h-7 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <svg className="w-3.5 h-3.5 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3" /></svg>
            </div>
          </div>
        )}

        {/* EP badge — purple for active, gold for filler */}
        <span className={`absolute left-1 bottom-1 backdrop-blur-sm text-[9px] font-bold px-1.5 py-0.5 rounded ${isActive ? "bg-[#9333EA] text-white" : isFiller ? "bg-[#FFD700]/80 text-black" : "bg-black/80 text-white"}`}>EP {ep.number}</span>
      </div>

      {/* ─── TEXT SECTION (RIGHT) — NOT blurred, always clear ─── */}
      <div className="flex flex-col flex-1 min-w-0 p-2.5 gap-1 justify-between">
        {/* Title — purple for active, gold for filler */}
        <div className={`text-xs font-bold line-clamp-1 leading-tight ${isActive ? "text-[#9333EA]" : isFiller ? "text-[#FFD700]" : "text-white"}`}>
          {ep.title || `Episode ${ep.number}`}
        </div>
        {/* Description */}
        <div className="text-[10px] text-white/45 line-clamp-2 leading-snug">
          {ep.description || `Episode ${ep.number} of the series.`}
        </div>
        {/* Bottom metadata row */}
        <div className="flex items-center justify-between gap-1.5">
          {/* Left: date + filler */}
          <div className="flex items-center gap-1.5 min-w-0">
            {ep.airDate && (
              <span className="text-[9px] text-white/40 truncate">{ep.airDate}</span>
            )}
            {ep.filler && (
              <span className="text-[8px] text-white/30 font-medium shrink-0">Filler</span>
            )}
          </div>
          {/* Right: CC + HS + dub icons */}
          <div className="flex items-center gap-1 shrink-0">
            {softsubAvailable && (
              <span className="text-[8px] font-bold text-white/40 bg-white/[0.06] px-1 py-0.5 rounded" title="Subtitles available">CC</span>
            )}
            {hardsubAvailable && (
              <span className="text-[8px] font-bold text-white/40 bg-white/[0.06] px-1 py-0.5 rounded" title="Hardsub available">HS</span>
            )}
            {dubAvailable && (
              <span className="flex items-center gap-0.5 text-[8px] font-bold text-white/40 bg-white/[0.06] px-1 py-0.5 rounded" title="Dub available">
                <svg className="w-2 h-2" viewBox="0 0 24 24" fill="currentColor"><path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z" /></svg>
              </span>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}
