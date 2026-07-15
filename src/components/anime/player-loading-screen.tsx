"use client";

import { useState, useEffect, useMemo } from "react";

/**
 * PlayerLoadingScreen — fastest + coolest cinematic loading overlay.
 *
 * Design philosophy:
 *   - INSTANT entrance: all content snaps in with one 280ms scale+fade,
 *     NO staggered reveal (that was making it feel slow).
 *   - One-shot "punch" effects on mount: white flash + shockwave ring +
 *     title glitch — feels like an anime power-up moment.
 *   - Continuous cool layers: radial speed lines, sonar ping, embers,
 *     Ken Burns, film grain, light sweep.
 *
 * Parent flips `ready` to true → screen fades out (600ms) → unmounts.
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

const GRAIN_DATA_URI =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="180" height="180">' +
      '<filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch"/></filter>' +
      '<rect width="100%" height="100%" filter="url(#n)" opacity="0.5"/>' +
      "</svg>"
  );

interface Ember {
  left: number;
  size: number;
  delay: number;
  duration: number;
  drift: number;
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
  // `punched` flips true 30ms after mount — triggers the one-shot effects
  // (flash, shockwave, title glitch). Stays true thereafter.
  const [punched, setPunched] = useState(false);

  const [joke] = useState(
    () => ANIME_JOKES[Math.floor(Math.random() * ANIME_JOKES.length)]
  );

  const embers = useMemo<Ember[]>(() => {
    const arr: Ember[] = [];
    for (let i = 0; i < 12; i++) {
      arr.push({
        left: Math.random() * 100,
        size: 1.5 + Math.random() * 2.5,
        delay: Math.random() * 6,
        duration: 6 + Math.random() * 6,
        drift: (Math.random() - 0.5) * 60,
      });
    }
    return arr;
  }, []);

  // Mount: opacity 0 -> 1 + trigger one-shot punch effects.
  useEffect(() => {
    const t1 = setTimeout(() => {
      setOpacity(1);
      setPunched(true);
    }, 30);
    return () => clearTimeout(t1);
  }, []);

  // Fade out when ready, unmount after transition.
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
      {/* ═══ Layer 1: Backdrop — Ken Burns (faster: 10s) ═══ */}
      {backdrop ? (
        <img
          src={backdrop}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
          style={{
            filter: "blur(24px) brightness(0.6) saturate(1.2)",
            transform: "scale(1.18)",
            animation: "pls-kenburns 10s ease-in-out infinite alternate",
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

      {/* ═══ Layer 3: Floating embers ═══ */}
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
              boxShadow: "0 0 6px rgba(255,255,255,0.7)",
              animation: `pls-ember ${e.duration}s linear ${e.delay}s infinite`,
              ["--drift" as any]: `${e.drift}px`,
            }}
          />
        ))}
      </div>

      {/* ═══ Layer 4: Light sweep ═══ */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "linear-gradient(105deg, transparent 35%, rgba(255,255,255,0.06) 50%, transparent 65%)",
          backgroundSize: "250% 100%",
          animation: "pls-sweep 4s ease-in-out infinite",
        }}
      />

      {/* ═══ Layer 5: Film grain ═══ */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.06] mix-blend-overlay"
        style={{
          backgroundImage: `url("${GRAIN_DATA_URI}")`,
          backgroundRepeat: "repeat",
          backgroundSize: "180px 180px",
          animation: "pls-grain 0.5s steps(3) infinite",
        }}
      />

      {/* ═══ Layer 6: Radial speed lines (anime-style) ═══ */}
      <div
        className="absolute inset-0 pointer-events-none flex items-center justify-center"
        style={{ top: "30vh" }}
      >
        <div
          className="relative"
          style={{
            width: "1px",
            height: "1px",
            opacity: opacity > 0.5 ? 1 : 0,
            transition: "opacity 300ms ease",
          }}
        >
          {/* 16 radial lines emanating outward, rotating slowly */}
          <div
            className="absolute inset-0"
            style={{ animation: "pls-spin 12s linear infinite" }}
          >
            {Array.from({ length: 16 }).map((_, i) => (
              <div
                key={i}
                className="absolute origin-left"
                style={{
                  width: "60vw",
                  height: "1px",
                  left: "0",
                  top: "0",
                  transform: `rotate(${i * 22.5}deg)`,
                  background:
                    "linear-gradient(90deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.05) 30%, transparent 100%)",
                  animation: `pls-speedline 1.2s ease-out ${i * 0.05}s infinite`,
                }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* ═══ Layer 7: One-shot shockwave (plays once on mount) ═══ */}
      {punched && (
        <div
          className="absolute pointer-events-none flex items-center justify-center"
          style={{ top: "30vh", left: 0, right: 0 }}
        >
          <div
            className="rounded-full border-2 border-white/40"
            style={{
              width: "80px",
              height: "80px",
              animation: "pls-shockwave 700ms cubic-bezier(0.16, 1, 0.3, 1) forwards",
            }}
          />
        </div>
      )}

      {/* ═══ Layer 8: Main content — INSTANT entrance (no stagger) ═══ */}
      <div
        className="absolute left-0 right-0 flex flex-col items-center px-6"
        style={{
          top: "30vh",
          opacity: opacity > 0.5 ? 1 : 0,
          transform: punched ? "scale(1)" : "scale(0.92)",
          transition:
            "opacity 280ms ease, transform 280ms cubic-bezier(0.34, 1.56, 0.64, 1)",
        }}
      >
        {/* Spinner — triple ring + center dot + pulsing glow */}
        <div className="relative w-16 h-16 mb-6">
          {/* Sonar ping rings — emanate outward every 1.6s */}
          <div
            className="absolute inset-0 rounded-full border border-white/30"
            style={{ animation: "pls-sonar 1.6s ease-out infinite" }}
          />
          <div
            className="absolute inset-0 rounded-full border border-white/30"
            style={{ animation: "pls-sonar 1.6s ease-out 0.8s infinite" }}
          />
          {/* Glow halo */}
          <div
            className="absolute -inset-5 rounded-full bg-white/10 blur-2xl"
            style={{ animation: "pls-pulse 1.6s ease-in-out infinite" }}
          />
          <div className="absolute inset-0 rounded-full border-[2.5px] border-white/[0.08]" />
          <div
            className="absolute inset-0 rounded-full border-[2.5px] border-transparent border-t-white/90"
            style={{ animation: "pls-spin 0.6s linear infinite" }}
          />
          <div
            className="absolute inset-[6px] rounded-full border-[2px] border-transparent border-t-white/40"
            style={{
              animation: "pls-spin 1s linear infinite reverse",
            }}
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <div
              className="w-1.5 h-1.5 rounded-full bg-white/90"
              style={{ animation: "pls-pulse 1.2s ease-in-out infinite" }}
            />
          </div>
        </div>

        {/* Title — with one-shot glitch on mount + breathing glow */}
        {title && (
          <p
            className="text-lg sm:text-xl font-bold text-white/95 max-w-lg text-center line-clamp-2 mb-3 relative"
            style={{
              animation:
                "pls-glitch 250ms steps(2) 1, pls-breathe 2s ease-in-out 250ms infinite",
              textShadow: "0 0 12px rgba(255,255,255,0.2)",
            }}
          >
            {title}
            {/* Chromatic split layers for glitch */}
            <span
              aria-hidden
              className="absolute inset-0 text-cyan-400/60 mix-blend-screen"
              style={{
                clipPath: "inset(0 0 60% 0)",
                animation: "pls-glitch-split 250ms steps(2) 1",
              }}
            >
              {title}
            </span>
            <span
              aria-hidden
              className="absolute inset-0 text-red-500/60 mix-blend-screen"
              style={{
                clipPath: "inset(60% 0 0 0)",
                animation: "pls-glitch-split 250ms steps(2) 1",
              }}
            >
              {title}
            </span>
          </p>
        )}

        {/* Status */}
        <p className="text-[12px] font-semibold uppercase tracking-[0.22em] text-white/55 mb-4">
          {ready ? "Ready" : "Preparing your stream"}
        </p>

        {/* Segmented progress bar — instant fill, pulses while loading */}
        <div className="flex gap-1.5">
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
                  boxShadow: "0 0 8px rgba(255,255,255,0.5)",
                  transform: "scaleX(1)",
                  transformOrigin: "left",
                  transition: "transform 400ms cubic-bezier(0.25, 0.1, 0.25, 1)",
                  animation: `pls-seg-pulse 1.5s ease-in-out ${i * 0.15}s infinite`,
                }}
              />
            </div>
          ))}
        </div>
      </div>

      {/* ═══ Layer 9: Joke (immediate) ═══ */}
      <div
        className="absolute left-0 right-0 flex flex-col items-center px-8"
        style={{
          bottom: "12vh",
          opacity: opacity > 0.5 ? 1 : 0,
          transition: "opacity 400ms ease",
        }}
      >
        <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/30 mb-3">
          While you wait
        </p>
        <p className="text-sm text-white/55 max-w-md text-center leading-relaxed italic">
          {joke}
        </p>
      </div>

      {/* ═══ Layer 10: One-shot white flash on mount (200ms) ═══ */}
      {punched && (
        <div
          className="absolute inset-0 pointer-events-none bg-white"
          style={{
            animation: "pls-flash 250ms ease-out forwards",
          }}
        />
      )}

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
          50%      { text-shadow: 0 0 24px rgba(255,255,255,0.45); }
        }
        @keyframes pls-kenburns {
          from { transform: scale(1.14) translate(0, 0); }
          to   { transform: scale(1.24) translate(-2%, -1.5%); }
        }
        @keyframes pls-ember {
          0%   { opacity: 0; transform: translateY(0) translateX(0) scale(0.5); }
          15%  { opacity: 0.7; }
          85%  { opacity: 0.5; }
          100% { opacity: 0; transform: translateY(-100vh) translateX(var(--drift, 0px)) scale(1); }
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
          50%      { opacity: 0.5; }
        }
        /* One-shot shockwave — expands from 80px to 600px, fades out */
        @keyframes pls-shockwave {
          0% {
            width: 80px; height: 80px;
            opacity: 0.9;
            border-width: 3px;
            filter: blur(0px);
          }
          100% {
            width: 600px; height: 600px;
            opacity: 0;
            border-width: 1px;
            filter: blur(2px);
          }
        }
        /* One-shot flash — bright white overlay that fades out in 250ms */
        @keyframes pls-flash {
          0%   { opacity: 0.7; }
          100% { opacity: 0; visibility: hidden; }
        }
        /* Sonar ping — thin ring expands + fades every 1.6s */
        @keyframes pls-sonar {
          0% {
            transform: scale(1);
            opacity: 0.8;
          }
          100% {
            transform: scale(3);
            opacity: 0;
          }
        }
        /* Speed lines — each line fades + extends outward in a loop */
        @keyframes pls-speedline {
          0% {
            opacity: 0;
            transform: scaleX(0.3);
          }
          20% {
            opacity: 1;
          }
          100% {
            opacity: 0;
            transform: scaleX(1);
          }
        }
        /* Title glitch — quick chromatic split on mount, plays once */
        @keyframes pls-glitch {
          0%   { transform: translate(0); }
          25%  { transform: translate(-2px, 1px); }
          50%  { transform: translate(2px, -1px); }
          75%  { transform: translate(-1px, 0); }
          100% { transform: translate(0); }
        }
        @keyframes pls-glitch-split {
          0%   { transform: translate(0); opacity: 0.8; }
          25%  { transform: translate(-3px, 1px); opacity: 1; }
          50%  { transform: translate(3px, -1px); opacity: 0.6; }
          75%  { transform: translate(-2px, 0); opacity: 0.4; }
          100% { transform: translate(0); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
