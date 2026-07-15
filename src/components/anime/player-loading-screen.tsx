"use client";

import { useState, useEffect, useMemo } from "react";

/**
 * PlayerLoadingScreen — cinematic full-page loading overlay.
 *
 * Shows ONCE per anime (not per episode). Parent controls `ready` —
 * when it flips to `true`, the screen fades out smoothly (600ms) then
 * unmounts.
 *
 * Visual layers (back to front):
 *   1. Anime backdrop (Ken Burns slow zoom)
 *   2. Gradient overlays (top/bottom/side/vignette)
 *   3. Floating ember particles (atmospheric depth)
 *   4. Light sweep scan line (periodic, subtle)
 *   5. Film grain noise (cinematic texture)
 *   6. Main content (staggered reveal):
 *      spinner → title → status → segmented progress bar
 *   7. Joke at bottom (immediate)
 *
 * All animations are GPU-accelerated (transform/opacity only).
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

// Tiny SVG noise pattern for film grain (encoded as data URI).
const GRAIN_DATA_URI =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="180" height="180">' +
      '<filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch"/></filter>' +
      '<rect width="100%" height="100%" filter="url(#n)" opacity="0.5"/>' +
      "</svg>"
  );

interface Ember {
  left: number; // vw
  size: number; // px
  delay: number; // s
  duration: number; // s
  drift: number; // px horizontal drift
}

export function PlayerLoadingScreen({
  ready,
  backdrop,
  title,
}: {
  ready: boolean;
  backdrop?: string;
  title?: string;
}) {
  const [mounted, setMounted] = useState(true);
  const [opacity, setOpacity] = useState(0);
  const [revealStep, setRevealStep] = useState(0);

  const [joke] = useState(
    () => ANIME_JOKES[Math.floor(Math.random() * ANIME_JOKES.length)]
  );

  // Generate ember particles once (stable across re-renders).
  const embers = useMemo<Ember[]>(() => {
    const arr: Ember[] = [];
    for (let i = 0; i < 18; i++) {
      arr.push({
        left: Math.random() * 100,
        size: 1.5 + Math.random() * 2.5,
        delay: Math.random() * 8,
        duration: 7 + Math.random() * 8,
        drift: (Math.random() - 0.5) * 60,
      });
    }
    return arr;
  }, []);

  // Fade IN on mount.
  useEffect(() => {
    const t = setTimeout(() => setOpacity(1), 30);
    return () => clearTimeout(t);
  }, []);

  // Staggered reveal of content elements (spinner → title → status → progress → joke).
  useEffect(() => {
    if (!mounted) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    [150, 300, 450, 600, 750].forEach((delay, idx) => {
      timers.push(setTimeout(() => setRevealStep(idx + 1), delay));
    });
    return () => timers.forEach(clearTimeout);
  }, [mounted]);

  // Fade OUT when ready, then unmount.
  useEffect(() => {
    if (!ready) return;
    setOpacity(0);
    const t = setTimeout(() => setMounted(false), 650);
    return () => clearTimeout(t);
  }, [ready]);

  if (!mounted) return null;

  // Helper: element is visible if revealStep >= threshold OR ready (fade out)
  const stepOpacity = (step: number) =>
    revealStep >= step ? (opacity > 0.5 ? 1 : 0) : 0;

  return (
    <div
      className="fixed inset-0 z-[200] overflow-hidden"
      style={{
        opacity,
        pointerEvents: opacity > 0.5 ? "auto" : "none",
        transition: "opacity 600ms cubic-bezier(0.25, 0.1, 0.25, 1)",
      }}
    >
      {/* ═══ Layer 1: Backdrop with Ken Burns zoom ═══ */}
      {backdrop ? (
        <img
          src={backdrop}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
          style={{
            filter: "blur(26px) brightness(0.58) saturate(1.15)",
            transform: "scale(1.18)",
            animation: "pls-kenburns 18s ease-in-out infinite alternate",
          }}
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-[#0a0a14] via-black to-[#0a0a14]" />
      )}

      {/* ═══ Layer 2: Gradient overlays ═══ */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/85 via-black/55 to-black/92" />
      <div className="absolute inset-0 bg-gradient-to-r from-black/55 via-transparent to-black/55" />
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 0%, rgba(0,0,0,0.6) 100%)",
        }}
      />

      {/* ═══ Layer 3: Floating ember particles ═══ */}
      <div className="absolute inset-0 pointer-events-none">
        {embers.map((e, i) => (
          <span
            key={i}
            className="absolute rounded-full bg-white"
            style={{
              left: `${e.left}vw`,
              bottom: "-10px",
              width: `${e.size}px`,
              height: `${e.size}px`,
              opacity: 0,
              boxShadow: "0 0 6px rgba(255,255,255,0.6)",
              animation: `pls-ember ${e.duration}s linear ${e.delay}s infinite`,
              ["--drift" as any]: `${e.drift}px`,
            }}
          />
        ))}
      </div>

      {/* ═══ Layer 4: Light sweep scan line ═══ */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "linear-gradient(105deg, transparent 35%, rgba(255,255,255,0.06) 50%, transparent 65%)",
          backgroundSize: "250% 100%",
          animation: "pls-sweep 4.5s ease-in-out infinite",
        }}
      />

      {/* ═══ Layer 5: Film grain ═══ */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.06] mix-blend-overlay"
        style={{
          backgroundImage: `url("${GRAIN_DATA_URI}")`,
          backgroundRepeat: "repeat",
          backgroundSize: "180px 180px",
          animation: "pls-grain 0.6s steps(3) infinite",
        }}
      />

      {/* ═══ Layer 6: Main content ═══ */}
      <div
        className="absolute left-0 right-0 flex flex-col items-center px-6"
        style={{
          top: "30vh",
        }}
      >
        {/* Spinner — triple ring with pulsing glow halo */}
        <div
          className="relative w-16 h-16 mb-6"
          style={{
            opacity: stepOpacity(1),
            transform: revealStep >= 1 ? "scale(1)" : "scale(0.85)",
            transition: "opacity 400ms ease, transform 500ms cubic-bezier(0.34, 1.56, 0.64, 1)",
          }}
        >
          {/* Pulsing glow halo */}
          <div
            className="absolute -inset-5 rounded-full bg-white/10 blur-2xl"
            style={{ animation: "pls-pulse 2.4s ease-in-out infinite" }}
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
          {/* Center dot */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div
              className="w-1.5 h-1.5 rounded-full bg-white/80"
              style={{ animation: "pls-pulse 1.6s ease-in-out infinite" }}
            />
          </div>
        </div>

        {/* Title — with breathing glow */}
        {title && (
          <p
            className="text-lg sm:text-xl font-bold text-white/95 max-w-lg text-center line-clamp-2 mb-3"
            style={{
              opacity: stepOpacity(2),
              transform: revealStep >= 2 ? "translateY(0)" : "translateY(8px)",
              transition: "opacity 500ms ease, transform 500ms ease",
              animation: revealStep >= 2 ? "pls-breathe 3s ease-in-out infinite" : "none",
            }}
          >
            {title}
          </p>
        )}

        {/* Status text */}
        <p
          className="text-[12px] font-semibold uppercase tracking-[0.22em] text-white/55 mb-4"
          style={{
            opacity: stepOpacity(3),
            transform: revealStep >= 3 ? "translateY(0)" : "translateY(6px)",
            transition: "opacity 500ms ease, transform 500ms ease",
          }}
        >
          {ready ? "Ready" : "Preparing your stream"}
        </p>

        {/* Segmented progress bar — 5 segments fill sequentially */}
        <div
          className="flex gap-1.5"
          style={{
            opacity: stepOpacity(4),
            transition: "opacity 500ms ease",
          }}
        >
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="w-9 h-[3px] rounded-full bg-white/[0.08] overflow-hidden relative"
            >
              <div
                className="absolute inset-0 rounded-full"
                style={{
                  background:
                    "linear-gradient(90deg, rgba(255,255,255,0.5), rgba(255,255,255,0.95))",
                  boxShadow: "0 0 8px rgba(255,255,255,0.4)",
                  transform: ready
                    ? "scaleX(1)"
                    : revealStep >= 4
                    ? "scaleX(1)"
                    : "scaleX(0)",
                  transformOrigin: "left",
                  transition: `transform 500ms cubic-bezier(0.25, 0.1, 0.25, 1) ${i * 120}ms`,
                  animation:
                    !ready && revealStep >= 4
                      ? `pls-seg-pulse 1.8s ease-in-out ${i * 0.2}s infinite`
                      : "none",
                }}
              />
            </div>
          ))}
        </div>
      </div>

      {/* ═══ Layer 7: Joke (immediate, bottom) ═══ */}
      <div
        className="absolute left-0 right-0 flex flex-col items-center px-8"
        style={{
          bottom: "12vh",
          opacity: stepOpacity(5),
          transform: revealStep >= 5 ? "translateY(0)" : "translateY(10px)",
          transition: "opacity 500ms ease, transform 500ms ease",
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
          to   { transform: rotate(360deg); }
        }
        @keyframes pls-pulse {
          0%, 100% { opacity: 0.4; transform: scale(1); }
          50%      { opacity: 0.9; transform: scale(1.15); }
        }
        @keyframes pls-breathe {
          0%, 100% { text-shadow: 0 0 12px rgba(255,255,255,0.15); }
          50%      { text-shadow: 0 0 22px rgba(255,255,255,0.35); }
        }
        @keyframes pls-kenburns {
          from { transform: scale(1.12) translate(0, 0); }
          to   { transform: scale(1.22) translate(-1.5%, -1%); }
        }
        @keyframes pls-ember {
          0% {
            opacity: 0;
            transform: translateY(0) translateX(0) scale(0.5);
          }
          15% {
            opacity: 0.7;
          }
          85% {
            opacity: 0.5;
          }
          100% {
            opacity: 0;
            transform: translateY(-100vh) translateX(var(--drift, 0px)) scale(1);
          }
        }
        @keyframes pls-sweep {
          0%   { background-position: 150% 0; }
          100% { background-position: -150% 0; }
        }
        @keyframes pls-grain {
          0%   { transform: translate(0, 0); }
          33%  { transform: translate(-3px, 2px); }
          66%  { transform: translate(2px, -3px); }
          100% { transform: translate(0, 0); }
        }
        @keyframes pls-seg-pulse {
          0%, 100% { opacity: 1; }
          50%      { opacity: 0.55; }
        }
      `}</style>
    </div>
  );
}
