"use client";

import { useState, useEffect } from "react";

/**
 * PlayerLoadingScreen — full-page loading overlay.
 * Covers the ENTIRE watch page while loading.
 * Content is positioned at ~35% from top (slightly above center).
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
      className={`fixed inset-0 z-[200] bg-black transition-opacity duration-500 ${
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

      {/* Content — positioned at ~35% from top */}
      <div className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center gap-6 px-6" style={{ top: "32%" }}>
        {/* Spinner — bigger, white */}
        <div className="relative w-14 h-14">
          <div className="absolute inset-0 rounded-full border-[3px] border-white/[0.08]" />
          <div
            className="absolute inset-0 rounded-full border-[3px] border-transparent border-t-white animate-spin"
            style={{ animationDuration: "0.7s" }}
          />
        </div>

        {/* Anime title */}
        {title && (
          <p className="text-lg sm:text-xl font-bold text-white/80 max-w-lg text-center line-clamp-2">
            {title}
          </p>
        )}

        {/* Progress text */}
        <p className="text-sm font-medium text-white/50">
          {ready ? "Ready" : current.text}
        </p>

        {/* Progress dots */}
        <div className="flex items-center gap-2">
          {[1, 2, 3, 4, 5].map((n) => (
            <div
              key={n}
              className={`w-2 h-2 rounded-full transition-all duration-400 ${
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
