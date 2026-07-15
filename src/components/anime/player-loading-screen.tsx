"use client";

import { useState, useEffect } from "react";

/**
 * PlayerLoadingScreen — full-page loading overlay shown while the watch
 * page loads everything (anime info, servers, video stream).
 *
 * Covers the ENTIRE watch page, not just the video player.
 * Fades out when `ready` becomes true.
 *
 * Shows:
 *   - Blurred anime backdrop
 *   - Anime title
 *   - Progress text (changes over time)
 *   - Animated progress dots
 *   - Spinner (white, not gold)
 */
export function PlayerLoadingScreen({
  ready,
  backdrop,
  title,
}: {
  ready: boolean;
  backdrop?: string;
  title?: string;
}) {
  const [phase, setPhase] = useState(0);
  const [fading, setFading] = useState(false);

  // Animate through phases
  useEffect(() => {
    if (ready) {
      setFading(true);
      const t = setTimeout(() => setFading(false), 500);
      return () => clearTimeout(t);
    }

    const timers: ReturnType<typeof setTimeout>[] = [];
    timers.push(setTimeout(() => setPhase(1), 800));
    timers.push(setTimeout(() => setPhase(2), 1600));
    timers.push(setTimeout(() => setPhase(3), 2400));
    return () => timers.forEach(clearTimeout);
  }, [ready]);

  if (ready && !fading) return null;

  const phases = [
    { text: "Loading anime...", dots: 1 },
    { text: "Finding servers...", dots: 2 },
    { text: "Connecting to server...", dots: 3 },
    { text: "Starting playback...", dots: 4 },
  ];

  const current = phases[Math.min(phase, 3)];
  const dotsFilled = ready ? 5 : current.dots;

  return (
    <div
      className={`fixed inset-0 z-[200] flex items-center justify-center bg-black transition-opacity duration-500 ${
        ready ? "opacity-0 pointer-events-none" : "opacity-100"
      }`}
    >
      {/* Blurred backdrop */}
      {backdrop && (
        <img
          src={backdrop}
          alt=""
          className="absolute inset-0 w-full h-full object-cover opacity-15"
          style={{ filter: "blur(40px) brightness(0.3)" }}
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-b from-black/90 via-black/70 to-black/95" />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center gap-5 px-6">
        {/* Anime title */}
        {title && (
          <p className="text-lg sm:text-xl font-bold text-white/80 max-w-lg text-center line-clamp-2">
            {title}
          </p>
        )}

        {/* Spinner — white, clean */}
        <div className="relative w-10 h-10">
          <div className="absolute inset-0 rounded-full border-2 border-white/[0.08]" />
          <div
            className="absolute inset-0 rounded-full border-2 border-transparent border-t-white animate-spin"
            style={{ animationDuration: "0.7s" }}
          />
        </div>

        {/* Progress text */}
        <p className="text-sm font-medium text-white/50 transition-all duration-300">
          {ready ? "Ready" : current.text}
        </p>

        {/* Progress dots */}
        <div className="flex items-center gap-1.5">
          {[1, 2, 3, 4, 5].map((n) => (
            <div
              key={n}
              className={`w-1.5 h-1.5 rounded-full transition-all duration-400 ${
                n <= dotsFilled
                  ? "bg-white scale-110"
                  : "bg-white/[0.1] scale-100"
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
