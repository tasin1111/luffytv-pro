"use client";

import { useState, useEffect } from "react";

/**
 * PlayerLoadingScreen — cinematic full-page loading overlay.
 *
 * Shows ONCE per anime (not per episode).
 * Content at ~22% from top.
 * Smooth animations using CSS transitions (no janky keyframes).
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
  const [phase, setPhase] = useState(0);
  const [visible, setVisible] = useState(false);
  const [joke] = useState(() => ANIME_JOKES[Math.floor(Math.random() * ANIME_JOKES.length)]);
  const [showJoke, setShowJoke] = useState(false);

  // Fade IN on mount
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 50);
    return () => clearTimeout(t);
  }, []);

  // Phase progression
  useEffect(() => {
    if (ready) {
      setVisible(false); // trigger fade out
      return;
    }
    const timers: ReturnType<typeof setTimeout>[] = [];
    timers.push(setTimeout(() => setPhase(1), 800));
    timers.push(setTimeout(() => setPhase(2), 1600));
    timers.push(setTimeout(() => setPhase(3), 2400));
    timers.push(setTimeout(() => setShowJoke(true), 3000));
    return () => timers.forEach(clearTimeout);
  }, [ready]);

  if (ready && !visible) return null;

  const phases = ["Loading anime...", "Finding servers...", "Connecting to server...", "Starting playback..."];
  const currentText = ready ? "Ready" : phases[Math.min(phase, 3)];
  const dotsFilled = ready ? 5 : Math.min(phase + 1, 4);
  const progressWidth = ready ? 100 : (dotsFilled / 5) * 100;

  return (
    <div
      className="fixed inset-0 z-[200] bg-black"
      style={{
        opacity: visible ? 1 : 0,
        transition: "opacity 600ms cubic-bezier(0.25, 0.1, 0.25, 1)",
        pointerEvents: visible ? "auto" : "none",
      }}
    >
      {/* Backdrop */}
      {backdrop && (
        <img
          src={backdrop}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
          style={{
            opacity: visible ? 0.18 : 0,
            filter: "blur(60px) brightness(0.25)",
            transform: visible ? "scale(1.08)" : "scale(1)",
            transition: "opacity 800ms ease, transform 6s ease-out",
          }}
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-b from-black/95 via-black/85 to-black/95" />

      {/* Main content — positioned at ~22% from top */}
      <div
        className="absolute left-0 right-0 flex flex-col items-center px-6"
        style={{
          top: "20vh",
          opacity: visible ? 1 : 0,
          transform: visible ? "translateY(0)" : "translateY(12px)",
          transition: "opacity 500ms ease, transform 500ms ease",
        }}
      >
        {/* Spinner */}
        <div className="relative w-14 h-14 mb-5">
          <div className="absolute inset-0 rounded-full border-[2.5px] border-white/[0.05]" />
          <div
            className="absolute inset-0 rounded-full border-[2.5px] border-transparent border-t-white"
            style={{ animation: "spin 0.9s linear infinite" }}
          />
        </div>

        {/* Title */}
        {title && (
          <p className="text-lg sm:text-xl font-bold text-white/85 max-w-lg text-center line-clamp-2 mb-3">
            {title}
          </p>
        )}

        {/* Progress text */}
        <p className="text-[13px] font-medium text-white/45 mb-4" style={{ transition: "opacity 300ms ease" }}>
          {currentText}
        </p>

        {/* Progress bar — smooth fill */}
        <div className="w-40 h-[2px] bg-white/[0.05] rounded-full overflow-hidden">
          <div
            className="h-full bg-white/50 rounded-full"
            style={{
              width: `${progressWidth}%`,
              transition: "width 700ms cubic-bezier(0.25, 0.1, 0.25, 1)",
            }}
          />
        </div>
      </div>

      {/* Joke — bottom area */}
      <div
        className="absolute left-0 right-0 flex flex-col items-center px-8"
        style={{
          bottom: "14vh",
          opacity: showJoke && !ready ? 1 : 0,
          transform: showJoke && !ready ? "translateY(0)" : "translateY(16px)",
          transition: "opacity 600ms ease, transform 600ms ease",
        }}
      >
        <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/15 mb-3">
          While you wait...
        </p>
        <p className="text-sm text-white/35 max-w-md text-center leading-relaxed italic">
          {joke}
        </p>
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
