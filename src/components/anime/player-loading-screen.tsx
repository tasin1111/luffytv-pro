"use client";

import { useState, useEffect } from "react";

/**
 * PlayerLoadingScreen — cinematic full-page loading overlay.
 *
 * Shows ONCE per anime (not per episode). Parent controls `ready` —
 * when it flips to `true`, the screen fades out smoothly (600ms) then
 * unmounts. Playback can then start in the player; the player's own
 * buffering spinner takes over inside the video frame.
 *
 * Design:
 *   - Anime backdrop image visible at ~35% opacity (NOT invisible)
 *   - Light gradient overlays so the artwork shows through
 *   - Joke shown immediately on mount (no artificial delay)
 *   - Content positioned at ~32% from top (lower than center, more cinematic)
 */

const ANIME_JOKES = [
  "Why did Naruto cross the road? To get to the Ichiraku Ramen on the other side.",
  "Light Yagami's notebook was so overpowered, even his Shinigami said 'bro, touch grass.'",
  "Goku could destroy the universe but still can't pass a driving test.",
  "Levi Ackerman's cleaning skills are so legendary, even dust particles fear him.",
  "Saitama's workout: 100 push-ups, 100 sit-ups, 100 squats, 10km run, and existential dread.",
  "Why doesn't Luffy use a map? Because he's always lost in the plot anyway.",
  "Gon's dad said 'I'm on the roof' and Gon took 148 episodes to find him.",
  "All Might's biggest fear isn't villains — it's his medical insurance premium.",
  "Gojo Satoru wears a blindfold because he's afraid of his own rizz.",
  "Bakugo's anger issues are so bad, even his alarm clock wakes up screaming.",
  "Denji's dream is simple: bread, jam, and a girl who won't try to kill him.",
  "Eren Yeager's plan was so complex, even the author needed a flowchart.",
  "Why did the anime character bring a ladder to school? To reach the high stakes.",
  "Mikey from Tokyo Revengers doesn't use stairs — he kicks through the floor instead.",
  "Thorfinn's entire character arc: 'violence bad' after 50 episodes of violence.",
  "Aqua from Oshi no Ko has so much trauma, even his eye color changed.",
];

export function PlayerLoadingScreen({
  ready,
  backdrop,
  title,
}: {
  ready: boolean;
  backdrop?: string;
  title?: string;
}) {
  // `mounted` controls whether the component is in the DOM at all.
  // `opacity` drives the CSS fade in / out.
  // We keep the component mounted for 700ms AFTER `ready` flips true
  // so the fade-out transition can actually play (instead of instantly
  // unmounting and snapping off).
  const [mounted, setMounted] = useState(true);
  const [opacity, setOpacity] = useState(0);

  // Pick a joke ONCE per mount (stable across re-renders).
  const [joke] = useState(
    () => ANIME_JOKES[Math.floor(Math.random() * ANIME_JOKES.length)]
  );

  // Fade IN on mount.
  useEffect(() => {
    const t = setTimeout(() => setOpacity(1), 30);
    return () => clearTimeout(t);
  }, []);

  // Fade OUT when ready, then unmount after the transition finishes.
  useEffect(() => {
    if (!ready) return;
    setOpacity(0);
    const t = setTimeout(() => setMounted(false), 650);
    return () => clearTimeout(t);
  }, [ready]);

  if (!mounted) return null;

  return (
    <div
      className="fixed inset-0 z-[200] overflow-hidden"
      style={{
        opacity,
        pointerEvents: opacity > 0.5 ? "auto" : "none",
        transition: "opacity 600ms cubic-bezier(0.25, 0.1, 0.25, 1)",
      }}
    >
      {/* ─── Backdrop image (actually visible this time) ─── */}
      {backdrop ? (
        <img
          src={backdrop}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
          style={{
            filter: "blur(28px) brightness(0.55) saturate(1.1)",
            transform: "scale(1.12)",
          }}
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-[#0a0a14] via-black to-[#0a0a14]" />
      )}

      {/* ─── Gradient overlays (lighter so backdrop shows through) ─── */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/85 via-black/55 to-black/90" />
      <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-transparent to-black/60" />
      {/* Subtle vignette for depth */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 0%, rgba(0,0,0,0.55) 100%)",
        }}
      />

      {/* ─── Main content (lower position, ~32% from top) ─── */}
      <div
        className="absolute left-0 right-0 flex flex-col items-center px-6"
        style={{
          top: "30vh",
          transform: opacity > 0.5 ? "translateY(0)" : "translateY(10px)",
          transition: "transform 600ms ease-out",
        }}
      >
        {/* Spinner — double ring with subtle glow */}
        <div className="relative w-16 h-16 mb-6">
          {/* Soft glow behind spinner */}
          <div
            className="absolute -inset-4 rounded-full bg-white/5 blur-2xl"
            style={{ opacity: 0.6 }}
          />
          <div className="absolute inset-0 rounded-full border-[2.5px] border-white/[0.08]" />
          <div
            className="absolute inset-0 rounded-full border-[2.5px] border-transparent border-t-white/90"
            style={{ animation: "pls-spin 0.9s linear infinite" }}
          />
          <div
            className="absolute inset-[6px] rounded-full border-[2px] border-transparent border-t-white/40"
            style={{
              animation: "pls-spin 1.4s linear infinite reverse",
            }}
          />
        </div>

        {/* Title */}
        {title && (
          <p className="text-lg sm:text-xl font-bold text-white/95 max-w-lg text-center line-clamp-2 mb-3 drop-shadow-lg">
            {title}
          </p>
        )}

        {/* Status text */}
        <p className="text-[13px] font-semibold uppercase tracking-[0.18em] text-white/55 mb-4">
          {ready ? "Ready" : "Preparing your stream"}
        </p>

        {/* Progress bar — smooth indeterminate fill */}
        <div className="w-48 h-[3px] bg-white/[0.08] rounded-full overflow-hidden relative">
          <div
            className="absolute top-0 left-0 h-full rounded-full"
            style={{
              width: ready ? "100%" : "40%",
              background:
                "linear-gradient(90deg, rgba(255,255,255,0.3) 0%, rgba(255,255,255,0.9) 50%, rgba(255,255,255,0.3) 100%)",
              transition: "width 600ms cubic-bezier(0.25, 0.1, 0.25, 1)",
            }}
          />
          {/* Shimmer sweep (only while loading) */}
          {!ready && (
            <div
              className="absolute top-0 h-full w-1/3 rounded-full"
              style={{
                background:
                  "linear-gradient(90deg, transparent, rgba(255,255,255,0.7), transparent)",
                animation: "pls-shimmer 1.4s ease-in-out infinite",
              }}
            />
          )}
        </div>
      </div>

      {/* ─── Joke (shown immediately, bottom area) ─── */}
      <div
        className="absolute left-0 right-0 flex flex-col items-center px-8"
        style={{
          bottom: "12vh",
          opacity: opacity > 0.5 ? 1 : 0,
          transition: "opacity 500ms ease 200ms",
        }}
      >
        <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/30 mb-3">
          While you wait
        </p>
        <p className="text-sm text-white/55 max-w-md text-center leading-relaxed italic">
          {joke}
        </p>
      </div>

      <style>{`
        @keyframes pls-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes pls-shimmer {
          0%   { left: -33%; }
          100% { left: 100%; }
        }
      `}</style>
    </div>
  );
}
