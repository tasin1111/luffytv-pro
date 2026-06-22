'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import Hls from 'hls.js';

interface HLSPlayerProps {
  url: string;
  animeId?: string;
  episodeNum?: number;
  sourceType?: 'hls' | 'mp4';
  intro?: { start: number; end: number } | null;
  outro?: { start: number; end: number } | null;
  allStreams?: Array<{ url: string; quality: string; label: string }>;
  subtitleTracks?: Array<{ url: string; lang: string; label: string }>;
  onEnded?: () => void;
  onProviderFailed?: () => void;
  autoplay?: boolean;
}

export default function HLSPlayerNew({
  url, animeId, episodeNum, sourceType = 'hls',
  intro, outro, allStreams, subtitleTracks, onEnded, onProviderFailed, autoplay = true,
}: HLSPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showControls, setShowControls] = useState(true);
  const [qualities, setQualities] = useState<any[]>([]);
  const [currentQuality, setCurrentQuality] = useState(-1);
  const [showQualityMenu, setShowQualityMenu] = useState(false);
  const [showSubtitleMenu, setShowSubtitleMenu] = useState(false);
  const [currentSubtitle, setCurrentSubtitle] = useState(-1); // -1 = off, 0+ = track index
  const [hlsSubtitles, setHlsSubtitles] = useState<any[]>([]);
  const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryCountRef = useRef(0);

  // ─── Load stream ──────────────────────────────────────────────────
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !url) return;

    setLoading(true);
    setError(null);

    // Cleanup previous
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    // MP4 — direct playback
    if (sourceType === 'mp4' || url.endsWith('.mp4') || url.includes('video.mp4')) {
      video.src = url;
      video.load();
      if (autoplay) video.play().catch(() => {});
      return;
    }

    // HLS
    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        backBufferLength: 30,
        maxBufferLength: 30,
        // Start at highest quality
        startLevel: -1,
        abrEwmaDefaultEstimate: 5000000,
        abrBandWidthFactor: 0.95,
        abrBandWidthUpFactor: 0.7,
        maxStarvationDelay: 4,
        manifestLoadingTimeOut: 15000,
        manifestLoadingMaxRetry: 3,
        levelLoadingTimeOut: 15000,
        levelLoadingMaxRetry: 3,
        fragLoadingTimeOut: 30000,
        fragLoadingMaxRetry: 4,
        enableWebVTT: true,
        // Allow cross-origin requests without credentials
        xhrSetup: (xhr) => {
          xhr.withCredentials = false;
        },
      });
      hlsRef.current = hls;
      hls.loadSource(url);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, (_e, data) => {
        setQualities(data.levels);
        setLoading(false);
        // Start at highest quality level
        if (data.levels.length > 0) {
          hls.currentLevel = data.levels.length - 1; // Highest quality
          setCurrentQuality(data.levels.length - 1);
        }
        if (autoplay) {
          video.play().catch(() => {
            video.muted = true;
            video.play().catch(() => {});
          });
        }
      });

      hls.on(Hls.Events.SUBTITLE_TRACKS_UPDATED, (_e, data) => {
        setHlsSubtitles(data.subtitleTracks || []);
        // Auto-enable first subtitle track if available
        if (data.subtitleTracks.length > 0 && hls.subtitleTrack === -1) {
          hls.subtitleTrack = 0;
          setCurrentSubtitle(0);
        }
      });

      hls.on(Hls.Events.LEVEL_SWITCHED, (_e, data) => {
        setCurrentQuality(data.level);
      });

      hls.on(Hls.Events.ERROR, (_e, data) => {
        console.error(`[HLS] Error: type=${data.type} details=${data.details} fatal=${data.fatal}`, data);
        if (data.fatal) {
          if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
            if (retryCountRef.current < 3) {
              retryCountRef.current++;
              console.log(`[HLS] Network retry ${retryCountRef.current}/3`);
              setTimeout(() => hls.startLoad(), 2000);
            } else {
              setError('Stream failed to load. Try another server.');
              setLoading(false);
              onProviderFailed?.();
            }
          } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
            console.log('[HLS] Media error, recovering...');
            hls.recoverMediaError();
          } else {
            setError('Playback error. Try another server.');
            setLoading(false);
            onProviderFailed?.();
          }
        }
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Native HLS (Safari)
      video.src = url;
      if (autoplay) video.play().catch(() => {});
    } else {
      setError('HLS not supported');
      setLoading(false);
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [url, sourceType, autoplay, onProviderFailed]);

  // ─── Video event handlers ─────────────────────────────────────────
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onTime = () => {
      setCurrentTime(video.currentTime);
      if (video.buffered.length > 0) {
        setBuffered(video.buffered.end(video.buffered.length - 1));
      }
      // Auto-skip intro/outro
      if (intro && video.currentTime >= intro.start && video.currentTime < intro.end - 2) {
        video.currentTime = intro.end;
      }
      if (outro && video.currentTime >= outro.start && video.currentTime < outro.end - 2) {
        video.currentTime = outro.end;
      }
    };
    const onDur = () => setDuration(video.duration || 0);
    const onWaiting = () => setLoading(true);
    const onPlaying = () => setLoading(false);
    const onEnd = () => onEnded?.();
    const onErr = () => {
      setError('Playback error. Try another server.');
      setLoading(false);
    };

    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    video.addEventListener('timeupdate', onTime);
    video.addEventListener('durationchange', onDur);
    video.addEventListener('waiting', onWaiting);
    video.addEventListener('playing', onPlaying);
    video.addEventListener('ended', onEnd);
    video.addEventListener('error', onErr);

    return () => {
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('timeupdate', onTime);
      video.removeEventListener('durationchange', onDur);
      video.removeEventListener('waiting', onWaiting);
      video.removeEventListener('playing', onPlaying);
      video.removeEventListener('ended', onEnd);
      video.removeEventListener('error', onErr);
    };
  }, [intro, outro, onEnded]);

  // ─── Controls auto-hide ───────────────────────────────────────────
  const showControlsTemp = useCallback(() => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      if (playing) setShowControls(false);
    }, 3000);
  }, [playing]);

  // ─── Fullscreen ───────────────────────────────────────────────────
  useEffect(() => {
    const onFs = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      containerRef.current?.requestFullscreen();
    }
  };

  // ─── Seek ─────────────────────────────────────────────────────────
  const seek = (time: number) => {
    if (videoRef.current) videoRef.current.currentTime = time;
  };

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) v.play(); else v.pause();
  };

  const toggleMute = () => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
  };

  const changeVolume = (vol: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.volume = vol;
    v.muted = vol === 0;
    setVolume(vol);
    setMuted(vol === 0);
  };

  const changeQuality = (level: number) => {
    if (hlsRef.current) {
      hlsRef.current.currentLevel = level;
      setCurrentQuality(level);
    }
    setShowQualityMenu(false);
  };

  const changeSubtitle = (track: number) => {
    if (hlsRef.current) {
      hlsRef.current.subtitleTrack = track;
      setCurrentSubtitle(track);
    }
    setShowSubtitleMenu(false);
  };

  const skipTime = (seconds: number) => {
    if (videoRef.current) videoRef.current.currentTime += seconds;
  };

  // ─── Format time ──────────────────────────────────────────────────
  const fmt = (s: number) => {
    if (!s || isNaN(s)) return '0:00';
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = Math.floor(s % 60);
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const bufferedProgress = duration > 0 ? (buffered / duration) * 100 : 0;

  return (
    <div
      ref={containerRef}
      className="relative w-full bg-black rounded-xl overflow-hidden group"
      style={{ aspectRatio: '16 / 9' }}
      onMouseMove={showControlsTemp}
      onMouseLeave={() => playing && setShowControls(false)}
      onClick={(e) => { if (e.target === e.currentTarget || e.target === videoRef.current) togglePlay(); }}
    >
      <video
        ref={videoRef}
        className="w-full h-full object-contain"
        playsInline
        onClick={togglePlay}
      />

      {/* Loading spinner — minimal */}
      {loading && !error && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-10 h-10 border-2 border-white/10 border-t-[#7c3aed] rounded-full animate-spin" />
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80">
          <div className="text-center px-6">
            <p className="text-white/80 text-sm mb-3">{error}</p>
            <button
              onClick={() => onProviderFailed?.()}
              className="px-4 py-2 bg-[#7c3aed] text-white text-xs font-bold rounded-lg hover:bg-[#6d28d9]"
            >
              Switch Server
            </button>
          </div>
        </div>
      )}

      {/* Controls bar — clean, Anivexa-style */}
      <div
        className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent pt-12 pb-2 px-3 transition-opacity duration-200 ${
          showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        {/* Progress bar */}
        <div
          className="relative h-1 bg-white/15 rounded-full mb-2 cursor-pointer group/bar"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const pct = (e.clientX - rect.left) / rect.width;
            seek(pct * duration);
          }}
        >
          {/* Buffered */}
          <div
            className="absolute h-full bg-white/20 rounded-full"
            style={{ width: `${bufferedProgress}%` }}
          />
          {/* Progress */}
          <div
            className="absolute h-full bg-[#7c3aed] rounded-full"
            style={{ width: `${progress}%` }}
          >
            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-[#7c3aed] rounded-full opacity-0 group-hover/bar:opacity-100 transition-opacity" />
          </div>
        </div>

        {/* Control buttons */}
        <div className="flex items-center gap-3 text-white">
          {/* Play/Pause */}
          <button onClick={togglePlay} className="hover:text-[#9d6ef8] transition-colors">
            {playing ? (
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></svg>
            ) : (
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
            )}
          </button>

          {/* Skip back */}
          <button onClick={() => skipTime(-10)} className="hover:text-[#9d6ef8] transition-colors hidden sm:block">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z" /></svg>
          </button>

          {/* Skip forward */}
          <button onClick={() => skipTime(10)} className="hover:text-[#9d6ef8] transition-colors hidden sm:block">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z" transform="scale(-1,1) translate(-24,0)" /></svg>
          </button>

          {/* Volume */}
          <div className="flex items-center gap-1.5">
            <button onClick={toggleMute} className="hover:text-[#9d6ef8] transition-colors">
              {muted || volume === 0 ? (
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" /></svg>
              ) : (
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" /></svg>
              )}
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={muted ? 0 : volume}
              onChange={(e) => changeVolume(parseFloat(e.target.value))}
              className="w-16 h-1 accent-[#7c3aed] cursor-pointer hidden sm:block"
            />
          </div>

          {/* Time */}
          <span className="text-xs font-medium text-white/80 tabular-nums">
            {fmt(currentTime)} <span className="text-white/40">/</span> {fmt(duration)}
          </span>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Quality selector */}
          {qualities.length > 0 && (
            <div className="relative">
              <button
                onClick={() => setShowQualityMenu(!showQualityMenu)}
                className="text-xs font-semibold text-white/70 hover:text-white px-2 py-1 rounded hover:bg-white/10 transition-colors"
              >
                {currentQuality === -1 ? 'Auto' : qualities[currentQuality]?.height ? `${qualities[currentQuality].height}p` : 'Auto'}
              </button>
              {showQualityMenu && (
                <div className="absolute bottom-full right-0 mb-2 bg-black/95 border border-white/10 rounded-lg overflow-hidden min-w-[80px]">
                  <button
                    onClick={() => changeQuality(-1)}
                    className={`block w-full text-left px-3 py-1.5 text-xs hover:bg-white/10 ${currentQuality === -1 ? 'text-[#7c3aed] font-bold' : 'text-white/70'}`}
                  >
                    Auto
                  </button>
                  {qualities.map((q, i) => (
                    <button
                      key={i}
                      onClick={() => changeQuality(i)}
                      className={`block w-full text-left px-3 py-1.5 text-xs hover:bg-white/10 ${currentQuality === i ? 'text-[#7c3aed] font-bold' : 'text-white/70'}`}
                    >
                      {q.height}p
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Subtitle selector */}
          {hlsSubtitles.length > 0 && (
            <div className="relative">
              <button
                onClick={() => setShowSubtitleMenu(!showSubtitleMenu)}
                className="text-xs font-semibold text-white/70 hover:text-white px-2 py-1 rounded hover:bg-white/10 transition-colors"
              >
                CC
              </button>
              {showSubtitleMenu && (
                <div className="absolute bottom-full right-0 mb-2 bg-black/95 border border-white/10 rounded-lg overflow-hidden min-w-[80px]">
                  <button
                    onClick={() => changeSubtitle(-1)}
                    className={`block w-full text-left px-3 py-1.5 text-xs hover:bg-white/10 ${currentSubtitle === -1 ? 'text-[#7c3aed] font-bold' : 'text-white/70'}`}
                  >
                    Off
                  </button>
                  {hlsSubtitles.map((sub, i) => (
                    <button
                      key={i}
                      onClick={() => changeSubtitle(i)}
                      className={`block w-full text-left px-3 py-1.5 text-xs hover:bg-white/10 ${currentSubtitle === i ? 'text-[#7c3aed] font-bold' : 'text-white/70'}`}
                    >
                      {sub.name || sub.lang || `Track ${i + 1}`}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Fullscreen */}
          <button onClick={toggleFullscreen} className="hover:text-[#9d6ef8] transition-colors">
            {fullscreen ? (
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z" /></svg>
            ) : (
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" /></svg>
            )}
          </button>
        </div>
      </div>

      {/* Center play button when paused */}
      {!playing && !loading && !error && (
        <button
          onClick={togglePlay}
          className="absolute inset-0 flex items-center justify-center"
        >
          <div className="w-16 h-16 bg-[#7c3aed]/80 rounded-full flex items-center justify-center hover:bg-[#7c3aed] hover:scale-110 transition-all">
            <svg className="w-7 h-7 text-white ml-1" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
          </div>
        </button>
      )}
    </div>
  );
}
