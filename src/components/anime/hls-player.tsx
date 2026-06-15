"use client";

import { useEffect, useRef, useCallback } from "react";
import Hls from "hls.js";

// ============================================================
// HLS PLAYER — FAST LIVE STREAM
//
// Uses /api/hls-resolve which fetches BOTH master + sub-playlist
// server-side in ONE request. This cuts load time ~50%.
//
// Key speed optimizations:
//   - Resolve endpoint: 1 round-trip instead of 2
//   - startLevel: 0 (skip ABR quality probing)
//   - initialLiveManifestSize: 1 (play after 1 segment, not 3)
//   - abrEwmaDefaultEstimate: 5Mbps (start high, not low)
//   - progressive: true (play while downloading)
// ============================================================

interface HLSPlayerProps {
  src: string;
  autoPlay?: boolean;
  muted?: boolean;
  onError?: (error: string) => void;
  onPlaying?: () => void;
  className?: string;
}

export default function HLSPlayer({
  src,
  autoPlay = true,
  muted = true,
  onError,
  onPlaying,
  className = "",
}: HLSPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);

  const handleError = useCallback(
    (error: string) => {
      onError?.(error);
    },
    [onError]
  );
  const handlePlaying = useCallback(() => {
    onPlaying?.();
  }, [onPlaying]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    // Safari/iOS — native HLS
    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      const resolveUrl = `/api/hls-resolve?url=${encodeURIComponent(src)}`;
      video.src = resolveUrl;
      const onPlay = () => handlePlaying();
      const onError = () => handleError("Native HLS failed");
      video.addEventListener("playing", onPlay);
      video.addEventListener("error", onError);
      if (autoPlay) video.play().catch(() => {});
      return () => {
        video.removeEventListener("playing", onPlay);
        video.removeEventListener("error", onError);
      };
    }

    // Chrome/Firefox — hls.js
    if (!Hls.isSupported()) {
      handleError("HLS not supported");
      return;
    }

    const hls = new Hls({
      // === SPEED: Use resolve endpoint (1 request instead of 2) ===
      // hls.js will load /api/hls-resolve which returns the FINAL
      // sub-playlist with segment URLs already resolved

      // === LIVE STREAM SETTINGS ===
      liveSyncDurationCount: 3,
      liveMaxLatencyDurationCount: 6,
      liveDurationInfinity: true,
      liveBackBufferLength: 0,
      backBufferLength: 0,

      // === SPEED: Buffer settings for fast start ===
      maxBufferLength: 5,              // Only 5s buffer (was 10)
      maxMaxBufferLength: 15,          // Max 15s (was 30)
      maxBufferSize: 30 * 1000 * 1000,
      maxBufferHole: 0.5,

      // === SPEED: Start playing ASAP ===
      startLevel: 0,                   // Use first quality level immediately (no ABR probing)
      initialLiveManifestSize: 1,      // Play after just 1 segment (was 3!)
      abrEwmaDefaultEstimate: 5000000, // 5Mbps estimate (was 500Kbps — way too low)

      // === PLAYLIST REFRESH ===
      manifestLoadingMaxRetry: 20,
      manifestLoadingRetryDelay: 500,
      manifestLoadingTimeOut: 15000,
      levelLoadingMaxRetry: 20,
      levelLoadingRetryDelay: 500,
      levelLoadingTimeOut: 15000,

      // === SEGMENT LOADING ===
      fragLoadingMaxRetry: 10,
      fragLoadingRetryDelay: 1000,
      fragLoadingTimeOut: 20000,
      fragLoadingMaxRetryTimeout: 4000,

      // === PERFORMANCE ===
      enableWorker: true,
      lowLatencyMode: false,
      progressive: true,
      liveStartFromOldest: false,
    });

    hlsRef.current = hls;

    // Load through RESOLVE endpoint — fetches master + sub-playlist
    // server-side, returns final playlist in ONE request
    const resolveUrl = `/api/hls-resolve?url=${encodeURIComponent(src)}`;
    hls.loadSource(resolveUrl);
    hls.attachMedia(video);

    hls.on(Hls.Events.MANIFEST_PARSED, (_event, data) => {
      if (autoPlay) {
        video.play().catch(() => {
          video.muted = true;
          video.play().catch(() => {});
        });
      }
    });

    hls.on(Hls.Events.FRAG_BUFFERED, handlePlaying);
    video.addEventListener("playing", handlePlaying);

    hls.on(Hls.Events.ERROR, (_event, data) => {
      if (data.fatal) {
        if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
          setTimeout(() => hls.startLoad(), 1000);
        } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
          hls.recoverMediaError();
        } else {
          handleError(`Fatal: ${data.details}`);
          hls.destroy();
          hlsRef.current = null;
        }
      }
    });

    return () => {
      hls.destroy();
      hlsRef.current = null;
    };
  }, [src, autoPlay, handlePlaying, handleError]);

  return (
    <video
      ref={videoRef}
      className={`w-full h-full object-contain bg-black ${className}`}
      playsInline
      muted={muted}
      autoPlay={autoPlay}
      controls
    />
  );
}
