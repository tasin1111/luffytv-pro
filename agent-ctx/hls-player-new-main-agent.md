# Task: Create HLS Player Component (hls-player-new.tsx)

## Task ID: hls-player-new

## Summary

Created `/home/z/my-project/src/components/anime/hls-player-new.tsx` — a comprehensive native HLS.js player component inspired by YumeZone's custom player.

## What was done

1. **Verified hls.js already installed** — `hls.js@^1.6.16` was already in package.json
2. **Created the full component** with all requested features
3. **Fixed lint error** — moved synchronous `setState` calls in useEffect to `requestAnimationFrame` callback to avoid cascading render issue
4. **Verified zero lint errors** for the new file

## Features implemented

- **HLS.js for m3u8 playback** with fallback to native HLS (Safari) and direct MP4
- **Custom player UI**:
  - Play/pause button (center overlay + bottom bar)
  - Progress bar with seek, buffer indicator, intro/outro segment markers
  - Volume slider + mute button (expand on hover)
  - Time display (current / duration)
  - Skip intro/outro button (appears when in intro/outro range)
  - Speed selector (0.5x to 2x) as dropdown
  - Quality selector (from HLS levels) as dropdown
  - Fullscreen button
  - ±10s skip buttons
  - Double-tap to seek (mobile) with visual feedback overlay
  - Right-click to skip 10s (desktop)
  - Auto-hide controls after 3s of inactivity
  - Loading/buffering spinner
- **Auto-play next episode**: When video ends, calls `onEnded` callback
- **Resume from last position**: Uses localStorage key `yumeResume_{animeId}_ep{epNum}`
- **Skip intro/outro**: Shows "Skip Intro" / "Skip Outro" button. Supports auto-skip if localStorage `yume_skip_intro` === 'true'
- **Save watch history**: Calls `onProgress(currentTime, duration)` every 3 seconds
- **Fallback**: If HLS fails, tries `recoverMediaError()` first, then calls `onProviderFailed(provider)`

## Styling

- Background: `#0a0a0f`
- Controls background: gradient from `rgba(10,10,15,0.92)` with backdrop-blur
- Accent color: `#8B5CF6` (purple)
- Progress bar: `#8B5CF6` for played, `rgba(139,92,246,0.3)` for buffer
- Skip button: `#8B5CF6` bg with white text
- Intro marker: `rgba(251,191,36,0.35)` (amber)
- Outro marker: `rgba(239,68,68,0.35)` (red)
- All transitions: 150ms
- Mobile responsive
- Self-contained — all SVG icons inline, all CSS via Tailwind/inline styles
