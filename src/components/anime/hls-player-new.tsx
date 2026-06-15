'use client';

import {
  useEffect,
  useRef,
  useState,
  useCallback,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import Hls from 'hls.js';

// ─── Icons (inline SVG to stay self-contained) ──────────────────────────────

function PlayIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

function PauseIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
    </svg>
  );
}

function VolumeUpIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
    </svg>
  );
}

function VolumeMuteIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
    </svg>
  );
}

function VolumeDownIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.5 12c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM5 9v6h4l5 5V4L9 9H5z" />
    </svg>
  );
}

function FullscreenIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" />
    </svg>
  );
}

function FullscreenExitIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z" />
    </svg>
  );
}

function SkipForwardIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
    </svg>
  );
}

function SkipBackIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" />
    </svg>
  );
}

function SettingsIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 00.12-.61l-1.92-3.32a.49.49 0 00-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.484.484 0 00-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96a.49.49 0 00-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.07.62-.07.94s.02.64.07.94l-2.03 1.58a.49.49 0 00-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6A3.6 3.6 0 1112 8.4a3.6 3.6 0 010 7.2z" />
    </svg>
  );
}

function LoadingSpinner() {
  return (
    <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
      <div
        className="w-12 h-12 border-4 border-white/20 border-t-[#8B5CF6] rounded-full animate-spin"
      />
    </div>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatTime(seconds: number): string {
  if (!isFinite(seconds) || isNaN(seconds)) return '0:00';
  const s = Math.floor(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

// ─── Props ──────────────────────────────────────────────────────────────────

interface HLSPlayerProps {
  url: string;
  animeId: string;
  episodeNum: number;
  sourceType?: 'hls' | 'embed' | 'mp4';
  intro?: { start: number; end: number } | null;
  outro?: { start: number; end: number } | null;
  allStreams?: Array<{ url: string; quality: string; label: string }>;
  onEnded?: () => void;
  onProgress?: (currentTime: number, duration: number) => void;
  onProviderFailed?: (provider: string) => void;
  autoplay?: boolean;
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function HLSPlayerNew({
  url,
  animeId,
  episodeNum,
  sourceType = 'hls',
  intro = null,
  outro = null,
  allStreams,
  onEnded,
  onProgress,
  onProviderFailed,
  autoplay = true,
}: HLSPlayerProps) {
  // ── Refs ────────────────────────────────────────────────────────────────
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const controlsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const doubleTapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tapCountRef = useRef(0);
  const seekAnimRef = useRef<{ side: 'left' | 'right'; timeout: ReturnType<typeof setTimeout> | null }>({ side: 'left', timeout: null });
  const lastTapRef = useRef<{ time: number; x: number }>({ time: 0, x: 0 });

  // ── State ───────────────────────────────────────────────────────────────
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [qualityLevels, setQualityLevels] = useState<any[]>([]);
  const [currentQuality, setCurrentQuality] = useState(-1); // -1 = auto
  const [showQualityMenu, setShowQualityMenu] = useState(false);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [showSkipIntro, setShowSkipIntro] = useState(false);
  const [showSkipOutro, setShowSkipOutro] = useState(false);
  const [seekAnimation, setSeekAnimation] = useState<{ side: 'left' | 'right'; visible: boolean }>({ side: 'left', visible: false });

  // ── Resume key ──────────────────────────────────────────────────────────
  const resumeKey = `yumeResume_${animeId}_ep${episodeNum}`;

  // ── Auto-hide controls ──────────────────────────────────────────────────
  const resetControlsTimer = useCallback(() => {
    setShowControls(true);
    if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
    controlsTimerRef.current = setTimeout(() => {
      if (videoRef.current && !videoRef.current.paused) {
        setShowControls(false);
        setShowQualityMenu(false);
        setShowSpeedMenu(false);
      }
    }, 3000);
  }, []);

  // ── Save progress to localStorage ───────────────────────────────────────
  const saveProgress = useCallback(
    (time: number, dur: number) => {
      if (dur > 0 && time > 0) {
        localStorage.setItem(resumeKey, JSON.stringify({ time, dur, ts: Date.now() }));
      }
      onProgress?.(time, dur);
    },
    [resumeKey, onProgress],
  );

  // ── HLS setup ───────────────────────────────────────────────────────────
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !url) return;

    // Cleanup previous
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    // Defer state resets to avoid synchronous setState in effect
    const resetState = () => {
      setIsLoading(true);
      setIsPlaying(false);
      setCurrentTime(0);
      setDuration(0);
      setBuffered(0);
      setQualityLevels([]);
      setCurrentQuality(-1);
    };
    requestAnimationFrame(resetState);

    const handleFatalError = (details: string) => {
      // Try to recover if media error
      if (hlsRef.current) {
        hlsRef.current.recoverMediaError();
        // recoverMediaError returns void — schedule a check after a delay
        setTimeout(() => {
          if (videoRef.current?.error) {
            onProviderFailed?.(sourceType);
          }
        }, 2000);
      } else {
        onProviderFailed?.(sourceType);
      }
    };

    // Direct MP4
    if (sourceType === 'mp4' || url.endsWith('.mp4')) {
      video.src = url;
      video.load();
      if (autoplay) video.play().catch(() => {});
      return;
    }

    // Safari / native HLS
    if (video.canPlayType('application/vnd.apple.mpegurl') && sourceType === 'hls') {
      video.src = url;
      video.addEventListener('loadedmetadata', () => {
        setIsLoading(false);
        // Resume
        const saved = localStorage.getItem(resumeKey);
        if (saved) {
          try {
            const { time, dur } = JSON.parse(saved);
            if (dur > 0 && time > 0 && time < video.duration) {
              video.currentTime = time;
            }
          } catch {}
        }
      });
      if (autoplay) video.play().catch(() => {});
      return;
    }

    // hls.js
    if (!Hls.isSupported()) {
      onProviderFailed?.(sourceType);
      return;
    }

    const hls = new Hls({
      enableWorker: true,
      lowLatencyMode: false,
      progressive: true,
      startLevel: -1, // auto
      abrEwmaDefaultEstimate: 3000000,
      maxBufferLength: 30,
      maxMaxBufferLength: 60,
      maxBufferHole: 0.5,
      backBufferLength: 30,
    });

    hlsRef.current = hls;
    hls.loadSource(url);
    hls.attachMedia(video);

    hls.on(Hls.Events.MANIFEST_PARSED, (_e, data) => {
      setQualityLevels(data.levels);
      setIsLoading(false);
      // Resume from saved
      const saved = localStorage.getItem(resumeKey);
      if (saved) {
        try {
          const { time, dur } = JSON.parse(saved);
          if (dur > 0 && time > 0 && time < (video.duration || Infinity)) {
            video.currentTime = time;
          }
        } catch {}
      }
      if (autoplay) {
        video.play().catch(() => {
          video.muted = true;
          video.play().catch(() => {});
        });
      }
    });

    hls.on(Hls.Events.LEVEL_SWITCHED, (_e, data) => {
      setCurrentQuality(data.level);
    });

    hls.on(Hls.Events.ERROR, (_e, data) => {
      if (data.fatal) {
        if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
          // Try to recover
          setTimeout(() => hls.startLoad(), 1500);
        } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
          hls.recoverMediaError();
        } else {
          handleFatalError(data.details);
          hls.destroy();
          hlsRef.current = null;
        }
      }
    });

    return () => {
      hls.destroy();
      hlsRef.current = null;
    };
  }, [url, sourceType]);

  // ── Video event listeners ───────────────────────────────────────────────
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onPlay = () => { setIsPlaying(true); resetControlsTimer(); };
    const onPause = () => { setIsPlaying(false); setShowControls(true); };
    const onTimeUpdate = () => {
      setCurrentTime(video.currentTime);
      // Buffered
      if (video.buffered.length > 0) {
        setBuffered(video.buffered.end(video.buffered.length - 1));
      }
      // Intro / Outro skip buttons
      if (intro && video.currentTime >= intro.start && video.currentTime < intro.end) {
        setShowSkipIntro(true);
        // Auto-skip
        if (localStorage.getItem('yume_skip_intro') === 'true') {
          video.currentTime = intro.end;
          setShowSkipIntro(false);
        }
      } else {
        setShowSkipIntro(false);
      }
      if (outro && video.currentTime >= outro.start && video.currentTime < outro.end) {
        setShowSkipOutro(true);
      } else {
        setShowSkipOutro(false);
      }
    };
    const onDurationChange = () => setDuration(video.duration || 0);
    const onLoadedData = () => setIsLoading(false);
    const onWaiting = () => setIsLoading(true);
    const onCanPlay = () => setIsLoading(false);
    const onEnded = () => {
      setIsPlaying(false);
      // Clear resume data
      localStorage.removeItem(resumeKey);
      onEnded?.();
    };
    const onVolumeChange = () => {
      setVolume(video.volume);
      setIsMuted(video.muted);
    };

    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    video.addEventListener('timeupdate', onTimeUpdate);
    video.addEventListener('durationchange', onDurationChange);
    video.addEventListener('loadeddata', onLoadedData);
    video.addEventListener('waiting', onWaiting);
    video.addEventListener('canplay', onCanPlay);
    video.addEventListener('ended', onEnded);
    video.addEventListener('volumechange', onVolumeChange);

    return () => {
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('timeupdate', onTimeUpdate);
      video.removeEventListener('durationchange', onDurationChange);
      video.removeEventListener('loadeddata', onLoadedData);
      video.removeEventListener('waiting', onWaiting);
      video.removeEventListener('canplay', onCanPlay);
      video.removeEventListener('ended', onEnded);
      video.removeEventListener('volumechange', onVolumeChange);
    };
  }, [intro, outro, onEnded, resetControlsTimer, resumeKey]);

  // ── Progress timer (save every 3s) ──────────────────────────────────────
  useEffect(() => {
    if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    progressTimerRef.current = setInterval(() => {
      const video = videoRef.current;
      if (video && !video.paused && video.currentTime > 0) {
        saveProgress(video.currentTime, video.duration || 0);
      }
    }, 3000);
    return () => {
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    };
  }, [saveProgress]);

  // ── Fullscreen change listener ──────────────────────────────────────────
  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  // ── Click outside quality/speed menu ────────────────────────────────────
  useEffect(() => {
    const handleClick = (e: globalThis.MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.quality-menu') && !target.closest('.quality-btn')) {
        setShowQualityMenu(false);
      }
      if (!target.closest('.speed-menu') && !target.closest('.speed-btn')) {
        setShowSpeedMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // ── Handlers ────────────────────────────────────────────────────────────
  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play().catch(() => {});
    } else {
      video.pause();
    }
    resetControlsTimer();
  }, [resetControlsTimer]);

  const seek = useCallback((delta: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = clamp(video.currentTime + delta, 0, video.duration || 0);
    resetControlsTimer();
  }, [resetControlsTimer]);

  const seekTo = useCallback(
    (time: number) => {
      const video = videoRef.current;
      if (!video) return;
      video.currentTime = clamp(time, 0, video.duration || 0);
      resetControlsTimer();
    },
    [resetControlsTimer],
  );

  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    resetControlsTimer();
  }, [resetControlsTimer]);

  const changeVolume = useCallback(
    (v: number) => {
      const video = videoRef.current;
      if (!video) return;
      video.volume = clamp(v, 0, 1);
      if (video.muted && v > 0) video.muted = false;
      resetControlsTimer();
    },
    [resetControlsTimer],
  );

  const changeSpeed = useCallback(
    (rate: number) => {
      const video = videoRef.current;
      if (!video) return;
      video.playbackRate = rate;
      setPlaybackRate(rate);
      setShowSpeedMenu(false);
      resetControlsTimer();
    },
    [resetControlsTimer],
  );

  const changeQuality = useCallback(
    (level: number) => {
      if (!hlsRef.current) return;
      hlsRef.current.currentLevel = level;
      setCurrentQuality(level);
      setShowQualityMenu(false);
      resetControlsTimer();
    },
    [resetControlsTimer],
  );

  const toggleFullscreen = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      container.requestFullscreen().catch(() => {});
    }
    resetControlsTimer();
  }, [resetControlsTimer]);

  const skipIntro = useCallback(() => {
    if (intro) seekTo(intro.end);
  }, [intro, seekTo]);

  const skipOutro = useCallback(() => {
    if (outro) seekTo(outro.end);
  }, [outro, seekTo]);

  // ── Progress bar interaction ────────────────────────────────────────────
  const progressBarRef = useRef<HTMLDivElement>(null);

  const handleProgressClick = useCallback(
    (e: ReactMouseEvent<HTMLDivElement>) => {
      const bar = progressBarRef.current;
      const video = videoRef.current;
      if (!bar || !video) return;
      const rect = bar.getBoundingClientRect();
      const ratio = clamp((e.clientX - rect.left) / rect.width, 0, 1);
      video.currentTime = ratio * (video.duration || 0);
      resetControlsTimer();
    },
    [resetControlsTimer],
  );

  // ── Double-tap to seek (mobile) ─────────────────────────────────────────
  const handleVideoTap = useCallback(
    (e: ReactMouseEvent<HTMLDivElement>) => {
      const now = Date.now();
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const x = e.clientX - rect.left;
      const half = rect.width / 2;
      const side: 'left' | 'right' = x < half ? 'left' : 'right';

      if (now - lastTapRef.current.time < 300) {
        // Double tap
        if (side === 'left') {
          seek(-10);
          setSeekAnimation({ side: 'left', visible: true });
        } else {
          seek(10);
          setSeekAnimation({ side: 'right', visible: true });
        }
        if (seekAnimRef.current.timeout) clearTimeout(seekAnimRef.current.timeout);
        seekAnimRef.current.timeout = setTimeout(() => {
          setSeekAnimation((prev) => ({ ...prev, visible: false }));
        }, 600);
        tapCountRef.current = 0;
        lastTapRef.current = { time: 0, x: 0 };
      } else {
        // First tap — wait for potential second tap
        lastTapRef.current = { time: now, x };
        tapCountRef.current = 1;
        if (doubleTapTimerRef.current) clearTimeout(doubleTapTimerRef.current);
        doubleTapTimerRef.current = setTimeout(() => {
          if (tapCountRef.current === 1) {
            togglePlay();
          }
          tapCountRef.current = 0;
        }, 300);
      }
    },
    [seek, togglePlay],
  );

  // ── Right-click to skip 10s (desktop) ───────────────────────────────────
  const handleContextMenu = useCallback(
    (e: ReactMouseEvent<HTMLDivElement>) => {
      e.preventDefault();
      seek(10);
    },
    [seek],
  );

  // ── Keyboard shortcuts ──────────────────────────────────────────────────
  useEffect(() => {
    const handleKey = (e: globalThis.KeyboardEvent) => {
      // Only handle if player is focused / visible
      if (!containerRef.current?.contains(document.activeElement) && document.activeElement !== document.body) return;
      switch (e.key) {
        case ' ':
        case 'k':
          e.preventDefault();
          togglePlay();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          seek(-10);
          break;
        case 'ArrowRight':
          e.preventDefault();
          seek(10);
          break;
        case 'ArrowUp':
          e.preventDefault();
          changeVolume(volume + 0.1);
          break;
        case 'ArrowDown':
          e.preventDefault();
          changeVolume(volume - 0.1);
          break;
        case 'f':
          e.preventDefault();
          toggleFullscreen();
          break;
        case 'm':
          e.preventDefault();
          toggleMute();
          break;
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [togglePlay, seek, changeVolume, toggleFullscreen, toggleMute, volume]);

  // ── Cleanup on unmount ──────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
      if (doubleTapTimerRef.current) clearTimeout(doubleTapTimerRef.current);
      if (seekAnimRef.current.timeout) clearTimeout(seekAnimRef.current.timeout);
    };
  }, []);

  // ── Computed ────────────────────────────────────────────────────────────
  const progressRatio = duration > 0 ? currentTime / duration : 0;
  const bufferRatio = duration > 0 ? buffered / duration : 0;
  const introStart = intro && duration > 0 ? (intro.start / duration) * 100 : 0;
  const introEnd = intro && duration > 0 ? (intro.end / duration) * 100 : 0;
  const outroStart = outro && duration > 0 ? (outro.start / duration) * 100 : 0;
  const outroEnd = outro && duration > 0 ? (outro.end / duration) * 100 : 0;
  const speeds = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

  const volumeIcon =
    isMuted || volume === 0 ? (
      <VolumeMuteIcon className="w-5 h-5" />
    ) : volume < 0.5 ? (
      <VolumeDownIcon className="w-5 h-5" />
    ) : (
      <VolumeUpIcon className="w-5 h-5" />
    );

  // ─── RENDER ─────────────────────────────────────────────────────────────
  return (
    <div
      ref={containerRef}
      className="relative w-full select-none overflow-hidden rounded-lg"
      style={{ background: '#0a0a0f', aspectRatio: '16 / 9' }}
      onMouseMove={resetControlsTimer}
      onMouseLeave={() => {
        if (isPlaying) setShowControls(false);
      }}
      onClick={handleVideoTap}
      onContextMenu={handleContextMenu}
      tabIndex={0}
    >
      {/* Video */}
      <video
        ref={videoRef}
        className="absolute inset-0 w-full h-full object-contain"
        style={{ background: '#0a0a0f' }}
        playsInline
        preload="metadata"
      />

      {/* Loading spinner */}
      {isLoading && <LoadingSpinner />}

      {/* Seek animation overlay (double-tap feedback) */}
      {seekAnimation.visible && (
        <div
          className="absolute top-0 bottom-0 w-1/3 flex items-center justify-center z-20 pointer-events-none"
          style={{
            left: seekAnimation.side === 'left' ? 0 : undefined,
            right: seekAnimation.side === 'right' ? 0 : undefined,
            background:
              seekAnimation.side === 'left'
                ? 'linear-gradient(to right, rgba(139,92,246,0.25), transparent)'
                : 'linear-gradient(to left, rgba(139,92,246,0.25), transparent)',
          }}
        >
          <div className="flex flex-col items-center">
            {seekAnimation.side === 'left' ? (
              <SkipBackIcon className="w-10 h-10 text-white" />
            ) : (
              <SkipForwardIcon className="w-10 h-10 text-white" />
            )}
            <span className="text-white text-sm font-medium mt-1">
              {seekAnimation.side === 'left' ? '-10s' : '+10s'}
            </span>
          </div>
        </div>
      )}

      {/* Center play button (when paused) */}
      {!isPlaying && !isLoading && (
        <button
          className="absolute inset-0 flex items-center justify-center z-10 bg-black/30 cursor-pointer"
          onClick={(e) => {
            e.stopPropagation();
            togglePlay();
          }}
          aria-label="Play"
        >
          <div
            className="w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center transition-transform duration-150 hover:scale-110"
            style={{ background: 'rgba(139, 92, 246, 0.85)' }}
          >
            <PlayIcon className="w-8 h-8 sm:w-10 sm:h-10 text-white ml-1" />
          </div>
        </button>
      )}

      {/* Skip Intro / Outro button */}
      {(showSkipIntro || showSkipOutro) && (
        <button
          className="absolute bottom-20 sm:bottom-24 left-1/2 -translate-x-1/2 z-30 px-5 py-2.5 rounded-lg text-white font-semibold text-sm sm:text-base cursor-pointer transition-all duration-150 hover:scale-105 hover:brightness-110"
          style={{ background: '#8B5CF6' }}
          onClick={(e) => {
            e.stopPropagation();
            if (showSkipIntro) skipIntro();
            if (showSkipOutro) skipOutro();
          }}
        >
          {showSkipIntro ? 'Skip Intro' : 'Skip Outro'}
        </button>
      )}

      {/* ─── CONTROLS ─────────────────────────────────────────────────────── */}
      <div
        className="absolute inset-x-0 bottom-0 z-20 transition-opacity duration-300"
        style={{
          opacity: showControls ? 1 : 0,
          pointerEvents: showControls ? 'auto' : 'none',
          background: 'linear-gradient(to top, rgba(10,10,15,0.92) 0%, rgba(10,10,15,0.6) 60%, transparent 100%)',
          backdropFilter: 'blur(4px)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Progress bar */}
        <div className="px-3 sm:px-4 pt-6 pb-1">
          <div
            ref={progressBarRef}
            className="relative w-full h-1.5 sm:h-2 rounded-full cursor-pointer group"
            style={{ background: 'rgba(255,255,255,0.15)' }}
            onClick={handleProgressClick}
          >
            {/* Intro segment marker */}
            {intro && duration > 0 && (
              <div
                className="absolute top-0 bottom-0 rounded-full"
                style={{
                  left: `${introStart}%`,
                  width: `${introEnd - introStart}%`,
                  background: 'rgba(251, 191, 36, 0.35)',
                }}
              />
            )}
            {/* Outro segment marker */}
            {outro && duration > 0 && (
              <div
                className="absolute top-0 bottom-0 rounded-full"
                style={{
                  left: `${outroStart}%`,
                  width: `${outroEnd - outroStart}%`,
                  background: 'rgba(239, 68, 68, 0.35)',
                }}
              />
            )}
            {/* Buffer */}
            <div
              className="absolute top-0 left-0 h-full rounded-full transition-[width] duration-150"
              style={{
                width: `${bufferRatio * 100}%`,
                background: 'rgba(139, 92, 246, 0.3)',
              }}
            />
            {/* Played */}
            <div
              className="absolute top-0 left-0 h-full rounded-full transition-[width] duration-150"
              style={{
                width: `${progressRatio * 100}%`,
                background: '#8B5CF6',
              }}
            />
            {/* Thumb */}
            <div
              className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none"
              style={{
                left: `${progressRatio * 100}%`,
                transform: `translate(-50%, -50%)`,
                background: '#8B5CF6',
                boxShadow: '0 0 6px rgba(139,92,246,0.6)',
              }}
            />
            {/* Hover time preview */}
          </div>
        </div>

        {/* Bottom controls row */}
        <div className="flex items-center gap-1 sm:gap-2 px-3 sm:px-4 pb-3 pt-1">
          {/* Play/Pause */}
          <button
            className="p-1.5 sm:p-2 rounded-md text-white/90 hover:text-white transition-colors duration-150 cursor-pointer"
            onClick={togglePlay}
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? <PauseIcon className="w-5 h-5" /> : <PlayIcon className="w-5 h-5" />}
          </button>

          {/* Skip back 10s */}
          <button
            className="p-1.5 sm:p-2 rounded-md text-white/70 hover:text-white transition-colors duration-150 cursor-pointer hidden sm:block"
            onClick={() => seek(-10)}
            aria-label="Skip back 10 seconds"
          >
            <SkipBackIcon className="w-5 h-5" />
          </button>

          {/* Skip forward 10s */}
          <button
            className="p-1.5 sm:p-2 rounded-md text-white/70 hover:text-white transition-colors duration-150 cursor-pointer hidden sm:block"
            onClick={() => seek(10)}
            aria-label="Skip forward 10 seconds"
          >
            <SkipForwardIcon className="w-5 h-5" />
          </button>

          {/* Volume */}
          <div className="flex items-center gap-1 group/vol">
            <button
              className="p-1.5 sm:p-2 rounded-md text-white/70 hover:text-white transition-colors duration-150 cursor-pointer"
              onClick={toggleMute}
              aria-label={isMuted ? 'Unmute' : 'Mute'}
            >
              {volumeIcon}
            </button>
            <div className="w-0 overflow-hidden group-hover/vol:w-20 transition-all duration-150 hidden sm:block">
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={isMuted ? 0 : volume}
                onChange={(e) => changeVolume(parseFloat(e.target.value))}
                className="w-full h-1 appearance-none rounded-full cursor-pointer"
                style={{
                  background: `linear-gradient(to right, #8B5CF6 ${(isMuted ? 0 : volume) * 100}%, rgba(255,255,255,0.2) ${(isMuted ? 0 : volume) * 100}%)`,
                }}
                aria-label="Volume"
              />
            </div>
          </div>

          {/* Time */}
          <span className="text-xs sm:text-sm text-white/70 font-mono tabular-nums ml-1">
            {formatTime(currentTime)}{' '}
            <span className="text-white/40">/</span>{' '}
            {formatTime(duration)}
          </span>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Speed */}
          <div className="relative">
            <button
              className="speed-btn p-1.5 sm:p-2 rounded-md text-white/70 hover:text-white transition-colors duration-150 cursor-pointer flex items-center gap-1"
              onClick={() => {
                setShowSpeedMenu((v) => !v);
                setShowQualityMenu(false);
              }}
              aria-label="Playback speed"
            >
              <span className="text-xs font-medium">{playbackRate}x</span>
            </button>
            {showSpeedMenu && (
              <div
                className="speed-menu absolute bottom-full right-0 mb-2 py-1 rounded-lg shadow-xl min-w-[100px] overflow-hidden"
                style={{ background: 'rgba(10, 10, 15, 0.95)', backdropFilter: 'blur(8px)' }}
              >
                {speeds.map((s) => (
                  <button
                    key={s}
                    className={`w-full px-4 py-2 text-left text-sm transition-colors duration-150 cursor-pointer ${
                      playbackRate === s ? 'text-white font-semibold' : 'text-white/60 hover:text-white/90'
                    }`}
                    style={playbackRate === s ? { background: 'rgba(139,92,246,0.2)' } : {}}
                    onClick={() => changeSpeed(s)}
                  >
                    {s}x
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Quality */}
          {qualityLevels.length > 1 && (
            <div className="relative">
              <button
                className="quality-btn p-1.5 sm:p-2 rounded-md text-white/70 hover:text-white transition-colors duration-150 cursor-pointer"
                onClick={() => {
                  setShowQualityMenu((v) => !v);
                  setShowSpeedMenu(false);
                }}
                aria-label="Quality"
              >
                <SettingsIcon className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
              {showQualityMenu && (
                <div
                  className="quality-menu absolute bottom-full right-0 mb-2 py-1 rounded-lg shadow-xl min-w-[140px] overflow-hidden"
                  style={{ background: 'rgba(10, 10, 15, 0.95)', backdropFilter: 'blur(8px)' }}
                >
                  <button
                    className={`w-full px-4 py-2 text-left text-sm transition-colors duration-150 cursor-pointer ${
                      currentQuality === -1 ? 'text-white font-semibold' : 'text-white/60 hover:text-white/90'
                    }`}
                    style={currentQuality === -1 ? { background: 'rgba(139,92,246,0.2)' } : {}}
                    onClick={() => changeQuality(-1)}
                  >
                    Auto
                  </button>
                  {qualityLevels.map((lvl, idx) => (
                    <button
                      key={idx}
                      className={`w-full px-4 py-2 text-left text-sm transition-colors duration-150 cursor-pointer ${
                        currentQuality === idx ? 'text-white font-semibold' : 'text-white/60 hover:text-white/90'
                      }`}
                      style={currentQuality === idx ? { background: 'rgba(139,92,246,0.2)' } : {}}
                      onClick={() => changeQuality(idx)}
                    >
                      {lvl.height}p
                      {lvl.bitrate ? ` (${Math.round(lvl.bitrate / 1000)}k)` : ''}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Fullscreen */}
          <button
            className="p-1.5 sm:p-2 rounded-md text-white/70 hover:text-white transition-colors duration-150 cursor-pointer"
            onClick={toggleFullscreen}
            aria-label={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
          >
            {isFullscreen ? (
              <FullscreenExitIcon className="w-5 h-5" />
            ) : (
              <FullscreenIcon className="w-5 h-5" />
            )}
          </button>
        </div>
      </div>

      {/* Top gradient for skip intro/outro visibility */}
      {showControls && (
        <div
          className="absolute inset-x-0 top-0 h-16 z-10 pointer-events-none transition-opacity duration-300"
          style={{
            background: 'linear-gradient(to bottom, rgba(10,10,15,0.5), transparent)',
          }}
        />
      )}
    </div>
  );
}
