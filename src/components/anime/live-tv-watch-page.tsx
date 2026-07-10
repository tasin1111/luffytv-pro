"use client";

import { useState, useRef, useEffect } from "react";
import dynamic from "next/dynamic";
import { useAppStore } from "./store";

const HLSPlayer = dynamic(() => import("./hls-player"), { ssr: false });

// ============================================================
// LIVE TV WATCH PAGE — dami-tv.pro style
// Black background, orange accent, clean minimal layout
// ============================================================

interface LiveTVWatchProps {
  channelId: string;
  channelName: string;
  channelCategory: string;
  channelStreamCategory?: string;
  channelCountryCode?: string;
  channelCountryName?: string;
  channelEmbedUrl: string;
  channelDamitvDefaultUrl?: string;
  channelDamitvId?: number;
  channelDamitvResolveUrl?: string;
  channelViewers?: number;
  channelLogoUrl?: string;
  channelStreamUrl?: string;
}

const CAT_COLORS: Record<string, string> = {
  Sports: "#e8471b",
  News: "#3b82f6",
  Entertainment: "#a855f7",
  Kids: "#22c55e",
  Music: "#ec4899",
  Documentary: "#06b6d4",
  Movies: "#eab308",
  General: "#6b7280",
};

export default function LiveTVWatchPage(props: LiveTVWatchProps) {
  const navigate = useAppStore(s => s.navigate);
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [playerReady, setPlayerReady] = useState(false);
  const [playerKey, setPlayerKey] = useState(0);
  const [loadingElapsed, setLoadingElapsed] = useState(0);
  const loadingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const categoryColor = CAT_COLORS[props.channelCategory] || CAT_COLORS.General;
  const streamUrl = props.channelStreamUrl || "";
  const currentChannelId = props.channelId || "";
  const [prevChannelId, setPrevChannelId] = useState(currentChannelId);

  if (prevChannelId !== currentChannelId) {
    setPlayerReady(false);
    setLoadingElapsed(0);
    setPlayerKey(prev => prev + 1);
    setPrevChannelId(currentChannelId);
  }

  useEffect(() => {
    if (playerReady) {
      setLoadingElapsed(0);
      if (loadingTimerRef.current) {
        clearInterval(loadingTimerRef.current);
        loadingTimerRef.current = null;
      }
      return;
    }
    setLoadingElapsed(0);
    loadingTimerRef.current = setInterval(() => {
      setLoadingElapsed(prev => prev + 1);
    }, 1000);
    return () => {
      if (loadingTimerRef.current) {
        clearInterval(loadingTimerRef.current);
        loadingTimerRef.current = null;
      }
    };
  }, [playerReady]);

  const toggleFullscreen = async () => {
    if (!playerContainerRef.current) return;
    if (!document.fullscreenElement) {
      await playerContainerRef.current.requestFullscreen();
      setIsFullscreen(true);
    } else {
      await document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  const refreshPlayer = () => {
    setPlayerReady(false);
    setLoadingElapsed(0);
    setPlayerKey(prev => prev + 1);
  };

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', color: '#fff', display: 'flex', flexDirection: 'column', margin: '0 -40px', padding: 0 }}>
      {/* Player Area */}
      <div
        ref={playerContainerRef}
        className="relative w-full bg-black"
        style={{
          height: isFullscreen ? "100vh" : "70vh",
          minHeight: "400px",
          maxHeight: isFullscreen ? "100vh" : "calc(100vh - 20px)",
        }}
      >
        {streamUrl && (
          <HLSPlayer
            key={`hls-${playerKey}`}
            src={streamUrl}
            autoPlay={true}
            muted={true}
            onError={() => {}}
            onPlaying={() => setPlayerReady(true)}
            className="absolute inset-0"
          />
        )}

        {!streamUrl && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px', background: '#000', zIndex: 20 }}>
            <p style={{ fontSize: '14px', color: '#888' }}>No stream URL available</p>
          </div>
        )}

        {/* Loading overlay */}
        {!playerReady && streamUrl && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px', background: '#000', zIndex: 20, pointerEvents: 'none' }}>
            <div style={{ position: 'relative' }}>
              <div style={{ width: '64px', height: '64px', borderRadius: '50%', border: '3px solid rgba(255,255,255,0.1)', borderTopColor: '#e8471b', animation: 'damitv-spin 1s linear infinite' }} />
              <svg style={{ position: 'absolute', inset: 0, width: '64px', height: '64px', transform: 'rotate(-90deg)' }} viewBox="0 0 64 64">
                <circle
                  cx="32" cy="32" r="28"
                  fill="none"
                  stroke="#e8471b"
                  strokeWidth="2"
                  strokeDasharray={`${Math.min(loadingElapsed / 15, 1) * 176} 176`}
                  strokeLinecap="round"
                  style={{ transition: 'all 1s' }}
                />
              </svg>
            </div>
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: '14px', fontWeight: 700, color: '#888' }}>Loading stream...</p>
              <p style={{ fontSize: '11px', color: '#555', marginTop: '4px' }}>{props.channelName}</p>
              {loadingElapsed > 0 && (
                <p style={{ fontSize: '10px', color: '#444', marginTop: '4px' }}>{loadingElapsed}s</p>
              )}
              <p style={{ fontSize: '10px', color: '#e8471b', marginTop: '12px', animation: 'damitv-pulse 1.5s ease-in-out infinite' }}>Please wait at least 30s — be patient</p>
            </div>
          </div>
        )}

        {/* Player Controls */}
        {/* Back button */}
        <button
          onClick={() => { navigate({ page: "live" }); useAppStore.getState().setSectionSubPage("tv-channels"); }}
          style={{ position: 'absolute', top: '8px', left: '8px', zIndex: 30, display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '6px', background: 'rgba(0,0,0,0.6)', color: '#ccc', border: 'none', cursor: 'pointer', transition: 'all 0.2s', fontSize: '12px', fontWeight: 600 }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(0,0,0,0.8)'; e.currentTarget.style.color = '#fff'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(0,0,0,0.6)'; e.currentTarget.style.color = '#ccc'; }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>

        {/* Channel name — top center */}
        <div style={{ position: 'absolute', top: '8px', left: '50%', transform: 'translateX(-50%)', zIndex: 30, padding: '6px 12px', borderRadius: '6px', background: 'rgba(0,0,0,0.6)' }}>
          <p style={{ fontSize: '12px', fontWeight: 700, color: '#ccc', textAlign: 'center', margin: 0 }}>
            {props.channelName}
          </p>
        </div>

        {/* LIVE badge — top right */}
        {playerReady && (
          <div style={{ position: 'absolute', top: '8px', right: '50px', zIndex: 30, padding: '4px 8px', borderRadius: '4px', background: 'rgba(0,0,0,0.6)' }}>
            <p style={{ fontSize: '9px', fontWeight: 800, color: '#e8471b', margin: 0, display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#e8471b', animation: 'damitv-pulse 1.5s ease-in-out infinite' }} />
              LIVE
            </p>
          </div>
        )}

        {/* Fullscreen button */}
        <button
          onClick={toggleFullscreen}
          style={{ position: 'absolute', bottom: '8px', right: '8px', zIndex: 30, padding: '8px', borderRadius: '6px', background: 'rgba(0,0,0,0.6)', color: '#ccc', border: 'none', cursor: 'pointer', transition: 'all 0.2s' }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(0,0,0,0.8)'; e.currentTarget.style.color = '#fff'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(0,0,0,0.6)'; e.currentTarget.style.color = '#ccc'; }}
        >
          {isFullscreen ? (
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path d="M9 9L4 4m0 0v4m0-4h4m7 5l5-5m0 0v4m0-4h-4m-7 7l-5 5m0 0v-4m0 4h4m7-5l5 5m0 0v-4m0 4h-4" />
            </svg>
          ) : (
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
            </svg>
          )}
        </button>
      </div>

      {/* Channel Info */}
      <div style={{ maxWidth: '1280px', margin: '0 auto', width: '100%', padding: '24px 40px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', marginBottom: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <h1 style={{ fontSize: '24px', fontWeight: 900, color: '#fff', margin: 0 }}>
                {props.channelName || "Live TV Channel"}
              </h1>
              <span style={{ fontSize: '9px', fontWeight: 800, padding: '3px 8px', borderRadius: '4px', background: `${categoryColor}20`, color: categoryColor, textTransform: 'uppercase' }}>
                {props.channelCategory}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '4px', background: 'rgba(232,71,27,0.15)', color: '#e8471b', fontSize: '10px', fontWeight: 800 }}>
                <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#e8471b', animation: 'damitv-pulse 1.5s ease-in-out infinite' }} />
                LIVE NOW
              </span>
              {props.channelCountryName && (
                <span style={{ fontSize: '11px', color: '#555' }}>{props.channelCountryName}</span>
              )}
              {playerReady && (
                <span style={{ fontSize: '10px', fontWeight: 700, padding: '3px 8px', borderRadius: '4px', background: 'rgba(34,197,94,0.1)', color: '#22c55e' }}>
                  Playing
                </span>
              )}
            </div>
          </div>

          <button
            onClick={refreshPlayer}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', borderRadius: '6px', fontSize: '12px', fontWeight: 700, color: '#888', background: '#141414', border: '1px solid #222', cursor: 'pointer', transition: 'all 0.2s' }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#e8471b'; e.currentTarget.style.color = '#e8471b'; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#222'; e.currentTarget.style.color = '#888'; }}
          >
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
        </div>
      </div>

      {/* Animations */}
      <style>{`
        @keyframes damitv-spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes damitv-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </div>
  );
}
