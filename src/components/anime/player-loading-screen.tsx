"use client";

import { useState, useEffect } from "react";

/**
 * PlayerLoadingScreen — cinematic full-page loading overlay.
 *
 * Content is at the TOP of the screen (not center, not bottom).
 * Features:
 *   - Anime backdrop blurred behind
 *   - Spinner at top
 *   - Progress text + dots
 *   - Random anime joke for entertainment
 *   - Smooth fade-out when ready
 */

const ANIME_JOKES = [
  "Why did Naruto cross the road? To get to the Ichiraku Ramen on the other side.",
  "Light Yagami's notebook was so overpowered, even his Shinigami said 'bro, touch grass.'",
  "Goku could destroy the universe but still can't pass a driving test.",
  "Levi Ackerman's cleaning skills are so legendary, even dust particles fear him.",
  "Saitama's workout routine: 100 push-ups, 100 sit-ups, 100 squats, 10km run, and existential dread.",
  "Why doesn't Luffy use a map? Because he's always lost in the plot anyway.",
  "Edward Elric's auto-mail mechanic bills must be astronomical.",
  "Gon's dad said 'I'm on the roof' and Gon took 148 episodes to find him.",
  "Why did the anime character bring a ladder to school? To reach the high stakes.",
  "All Might's biggest fear isn't villains — it's his medical insurance premium.",
  "Eren Yeager's plan was so complex, even the author needed a flowchart.",
  "Why did Tanjiro bring an umbrella? Because he heard the demons were dropping like flies.",
  "Gojo Satoru wears a blindfold because he's afraid of his own rizz.",
  "Bakugo's anger issues are so bad, even his alarm clock wakes up screaming.",
  "Why doesn't Mikey from Tokyo Revengers use stairs? He kicks through the floor instead.",
  "Denji's dream is simple: bread, jam, and a girl who won't try to kill him. Is that too much to ask?",
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
  const [fading, setFading] = useState(false);
  const [joke] = useState(() => ANIME_JOKES[Math.floor(Math.random() * ANIME_JOKES.length)]);
  const [showJoke, setShowJoke] = useState(false);

  useEffect(() => {
    if (ready) {
      setFading(true);
      const t = setTimeout(() => setFading(false), 600);
      return () => clearTimeout(t);
    }
    const timers: ReturnType<typeof setTimeout>[] = [];
    timers.push(setTimeout(() => setPhase(1), 700));
    timers.push(setTimeout(() => setPhase(2), 1400));
    timers.push(setTimeout(() => setPhase(3), 2100));
    timers.push(setTimeout(() => setShowJoke(true), 2800));
    return () => timers.forEach(clearTimeout);
  }, [ready]);

  if (ready && !fading) return null;

  const phases = [
    "Loading anime...",
    "Finding servers...",
    "Connecting to server...",
    "Starting playback...",
  ];

  const currentText = ready ? "Ready" : phases[Math.min(phase, 3)];
  const dotsFilled = ready ? 5 : Math.min(phase + 1, 4);

  return (
    <div
      className={`fixed inset-0 z-[200] bg-black transition-opacity duration-600 ${
        ready ? "opacity-0 pointer-events-none" : "opacity-100"
      }`}
    >
      {/* Blurred backdrop with slow zoom */}
      {backdrop && (
        <img
          src={backdrop}
          alt=""
          className="absolute inset-0 w-full h-full object-cover opacity-20"
          style={{
            filter: "blur(50px) brightness(0.25)",
            animation: "loading-zoom 8s ease-out forwards",
          }}
        />
      )}

      {/* Gradient overlays */}
      <div className="absolute inset-0 bg-gradient-to-b from-black via-black/80 to-black" />
      <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-transparent to-black/60" />

      {/* Content — TOP section */}
      <div className="absolute top-0 left-0 right-0 flex flex-col items-center pt-[12vh] px-6">
        {/* Spinner — large, white, with glow */}
        <div className="relative w-16 h-16 mb-6">
          <div className="absolute inset-0 rounded-full border-[3px] border-white/[0.06]" />
          <div
            className="absolute inset-0 rounded-full border-[3px] border-transparent border-t-white animate-spin"
            style={{ animationDuration: "0.8s" }}
          />
          {/* Inner pulse ring */}
          <div
            className="absolute inset-2 rounded-full border border-white/10"
            style={{ animation: "loading-pulse 1.5s ease-in-out infinite" }}
          />
        </div>

        {/* Anime title */}
        {title && (
          <p className="text-xl sm:text-2xl font-bold text-white/90 max-w-xl text-center line-clamp-2 mb-4"
            style={{ animation: "loading-fade-in 0.6s ease-out" }}>
            {title}
          </p>
        )}

        {/* Progress text */}
        <p className="text-sm font-medium text-white/50 mb-3 transition-all duration-300"
          style={{ animation: "loading-fade-in 0.4s ease-out" }}>
          {currentText}
        </p>

        {/* Progress dots */}
        <div className="flex items-center gap-2 mb-8">
          {[1, 2, 3, 4, 5].map((n) => (
            <div
              key={n}
              className={`rounded-full transition-all duration-500 ${
                n <= dotsFilled
                  ? "bg-white w-2.5 h-2.5"
                  : "bg-white/[0.08] w-2 h-2"
              }`}
              style={{
                transition: "all 0.5s cubic-bezier(0.4, 0, 0.2, 1)",
              }}
            />
          ))}
        </div>

        {/* Thin progress bar */}
        <div className="w-48 h-[2px] bg-white/[0.06] rounded-full overflow-hidden mb-10">
          <div
            className="h-full bg-white/40 rounded-full transition-all duration-700 ease-out"
            style={{ width: `${(dotsFilled / 5) * 100}%` }}
          />
        </div>
      </div>

      {/* Anime joke — appears after 2.8s at bottom */}
      {showJoke && !ready && (
        <div
          className="absolute bottom-[12vh] left-0 right-0 flex flex-col items-center px-8"
          style={{ animation: "loading-joke-in 0.6s ease-out" }}
        >
          <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/20 mb-3">
            While you wait...
          </p>
          <p className="text-sm text-white/40 max-w-md text-center leading-relaxed italic">
            {joke}
          </p>
        </div>
      )}

      {/* CSS animations */}
      <style>{`
        @keyframes loading-zoom {
          0% { transform: scale(1); }
          100% { transform: scale(1.1); }
        }
        @keyframes loading-pulse {
          0%, 100% { opacity: 0.3; transform: scale(1); }
          50% { opacity: 0.8; transform: scale(0.9); }
        }
        @keyframes loading-fade-in {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes loading-joke-in {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
