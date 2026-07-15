"use client";

import { useState, useEffect } from "react";

/**
 * PlayerLoadingScreen — cinematic loading overlay shown while the video
 * player buffers the first stream. Fades out when `ready` becomes true.
 *
 * Shows:
 *   - Blurred anime backdrop
 *   - LUFFY TV logo
 *   - Progress text (changes over time)
 *   - Animated progress dots
 *   - Spinner
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
      const t = setTimeout(() => setFading(false), 400);
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
    { text: "Finding servers...", dots: 1 },
    { text: "Connecting to server...", dots: 2 },
    { text: "Buffering stream...", dots: 3 },
    { text: "Starting playback...", dots: 4 },
  ];

  const current = phases[Math.min(phase, 3)];
  const dotsFilled = ready ? 5 : current.dots;

  return (
    <div
      className={`absolute inset-0 z-50 flex items-center justify-center bg-black transition-opacity duration-400 ${
        ready ? "opacity-0" : "opacity-100"
      }`}
    >
      {/* Blurred backdrop */}
      {backdrop && (
        <img
          src={backdrop}
          alt=""
          className="absolute inset-0 w-full h-full object-cover opacity-20"
          style={{ filter: "blur(30px) brightness(0.4)" }}
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-black/60 to-black/90" />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center gap-6 px-6">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <span className="text-2xl font-extrabold italic text-white tracking-tight">
            LUFFY <span className="text-[#D4A017]">TV</span>
          </span>
        </div>

        {/* Anime title (if available) */}
        {title && (
          <p className="text-sm text-white/40 max-w-md text-center line-clamp-1">
            {title}
          </p>
        )}

        {/* Spinner */}
        <div className="relative w-12 h-12">
          <div className="absolute inset-0 rounded-full border-2 border-white/[0.06]" />
          <div
            className="absolute inset-0 rounded-full border-2 border-transparent border-t-[#D4A017] animate-spin"
            style={{ animationDuration: "0.8s" }}
          />
        </div>

        {/* Progress text */}
        <p className="text-sm font-medium text-white/60 transition-all duration-300">
          {ready ? "Ready!" : current.text}
        </p>

        {/* Progress dots */}
        <div className="flex items-center gap-1.5">
          {[1, 2, 3, 4, 5].map((n) => (
            <div
              key={n}
              className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
                n <= dotsFilled
                  ? "bg-[#D4A017] scale-110"
                  : "bg-white/[0.08] scale-100"
              }`}
              style={{
                boxShadow: n <= dotsFilled ? "0 0 6px rgba(212, 160, 23, 0.5)" : "none",
              }}
            />
          ))}
        </div>
      </div>

      {/* Bottom fade */}
      <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-black to-transparent" />
    </div>
  );
}
