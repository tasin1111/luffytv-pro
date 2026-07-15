"use client";

import { useState, useEffect, useMemo } from "react";

/**
 * PlayerLoadingScreen — smooth, calm cinematic loading overlay.
 *
 * Design philosophy:
 *   - ONE punch on mount (soft flash + shockwave), then everything settles.
 *   - Continuous layers are SLOW and atmospheric — no busy/vibrating motion:
 *     just a slow Ken Burns, gentle embers, soft glow pulse on spinner.
 *   - Removed: speed lines, sonar pings, title glitch, jittery grain — these
 *     were making the screen feel busy and vibrating.
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
  const [punched, setPunched] = useState(false);

  const [joke] = useState(
    () => ANIME_JOKES[Math.floor(Math.random() * ANIME_JOKES.length)]
  );

  // Fewer embers, slower drift — calmer atmosphere.
  const embers = useMemo<Ember[]>(() => {
    const arr: Ember[] = [];
    for (let i = 0; i < 8; i++) {
      arr.push({
        left: Math.random() * 100,
        size: 1.5 + Math.random() * 2,
        delay: Math.random() * 8,
        duration: 10 + Math.random() * 8,
        drift: (Math.random() - 0.5) * 40,
      });
    }
    return arr;
  }, []);

  // Fade IN on mount + trigger one-shot punch.
  useEffect(() => {
    const t1 = setTimeout(() => {
      setOpacity(1);
      setPunched(true);
    }, 30);
    return () => clearTimeout(t1);
  }, []);

  // Fade OUT when ready, unmount after transition.
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
      {/* ═══ Layer 1: Backdrop — slow Ken Burns (14s, gentle) ═══ */}
      {backdrop ? (
        <img
          src={backdrop}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
          style={{
            filter: "blur(24px) brightness(0.6) saturate(1.2)",
            transform: "scale(1.16)",
            animation: "pls-kenburns 14s ease-in-out infinite alternate",
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

      {/* ═══ Layer 3: Floating embers (fewer, slower) ═══ */}
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

      {/* ═══ Layer 4: Soft light sweep (slow, 6s) ═══ */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "linear-gradient(105deg, transparent 35%, rgba(255,255,255,0.04) 50%, transparent 65%)",
          backgroundSize: "250% 100%",
          animation: "pls-sweep 6s ease-in-out infinite",
        }}
      />

      {/* ═══ Layer 5: Film grain (very slow, subtle) ═══ */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.04] mix-blend-overlay"
        style={{
          backgroundImage: `url("${GRAIN_DATA_URI}")`,
          backgroundRepeat: "repeat",
          backgroundSize: "180px 180px",
          animation: "pls-grain 1.5s steps(2) infinite",
        }}
      />

      {/* ═══ Layer 6: One-shot shockwave (plays once on mount) ═══ */}
      {punched && (
        <div
          className="absolute pointer-events-none flex items-center justify-center"
          style={{ top: "30vh", left: 0, right: 0 }}
        >
          <div
            className="rounded-full border-2 border-white/30"
            style={{
              width: "80px",
              height: "80px",
              animation: "pls-shockwave 900ms cubic-bezier(0.16, 1, 0.3, 1) forwards",
            }}
          />
        </div>
      )}

      {/* ═══ Layer 7: Main content — single smooth entrance ═══ */}
      <div
        className="absolute left-0 right-0 flex flex-col items-center px-6"
        style={{
          top: "30vh",
          opacity: opacity > 0.5 ? 1 : 0,
          transform: punched ? "scale(1)" : "scale(0.94)",
          transition:
            "opacity 400ms ease, transform 500ms cubic-bezier(0.34, 1.56, 0.64, 1)",
        }}
      >
        {/* Spinner — single ring + slow glow (no triple-ring, no sonar) */}
        <div className="relative w-16 h-16 mb-6">
          {/* Soft glow halo — slow breathing */}
          <div
            className="absolute -inset-5 rounded-full bg-white/8 blur-2xl"
            style={{ animation: "pls-pulse 2.8s ease-in-out infinite" }}
          />
          <div className="absolute inset-0 rounded-full border-[2.5px] border-white/[0.08]" />
          <div
            className="absolute inset-0 rounded-full border-[2.5px] border-transparent border-t-white/90"
            style={{ animation: "pls-spin 1s linear infinite" }}
          />
          {/* Center dot — gentle pulse */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div
              className="w-1.5 h-1.5 rounded-full bg-white/80"
              style={{ animation: "pls-pulse 2s ease-in-out infinite" }}
            />
          </div>
        </div>

        {/* Title — clean, no glitch, soft breathing glow only */}
        {title && (
          <p
            className="text-lg sm:text-xl font-bold text-white/95 max-w-lg text-center line-clamp-2 mb-3"
            style={{
              textShadow: "0 0 12px rgba(255,255,255,0.2)",
              animation: "pls-breathe 3s ease-in-out infinite",
            }}
          >
            {title}
          </p>
        )}

        {/* Status */}
        <p className="text-[12px] font-semibold uppercase tracking-[0.22em] text-white/55 mb-4">
          {ready ? "Ready" : "Preparing your stream"}
        </p>

        {/* Progress bar — single smooth fill with gentle pulse (no segments) */}
        <div className="w-44 h-[3px] rounded-full bg-white/[0.08] overflow-hidden relative">
          <div
            className="absolute inset-0 rounded-full"
            style={{
              background:
                "linear-gradient(90deg, rgba(255,255,255,0.4), rgba(255,255,255,0.9))",
              boxShadow: "0 0 8px rgba(255,255,255,0.4)",
              animation: "pls-fill-pulse 2s ease-in-out infinite",
            }}
          />
        </div>
      </div>

      {/* ═══ Layer 8: Joke (immediate) ═══ */}
      <div
        className="absolute left-0 right-0 flex flex-col items-center px-8"
        style={{
          bottom: "12vh",
          opacity: opacity > 0.5 ? 1 : 0,
          transition: "opacity 500ms ease",
        }}
      >
        <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/30 mb-3">
          While you wait
        </p>
        <p className="text-sm text-white/55 max-w-md text-center leading-relaxed italic">
          {joke}
        </p>
      </div>

      {/* ═══ Layer 9: One-shot soft flash on mount ═══ */}
      {punched && (
        <div
          className="absolute inset-0 pointer-events-none bg-white"
          style={{
            animation: "pls-flash 350ms ease-out forwards",
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
          50%      { opacity: 0.8; transform: scale(1.1); }
        }
        @keyframes pls-breathe {
          0%, 100% { text-shadow: 0 0 12px rgba(255,255,255,0.15); }
          50%      { text-shadow: 0 0 20px rgba(255,255,255,0.3); }
        }
        @keyframes pls-kenburns {
          from { transform: scale(1.14) translate(0, 0); }
          to   { transform: scale(1.2) translate(-1.5%, -1%); }
        }
        @keyframes pls-ember {
          0%   { opacity: 0; transform: translateY(0) translateX(0) scale(0.5); }
          15%  { opacity: 0.6; }
          85%  { opacity: 0.4; }
          100% { opacity: 0; transform: translateY(-100vh) translateX(var(--drift, 0px)) scale(1); }
        }
        @keyframes pls-sweep {
          0%   { background-position: 150% 0; }
          100% { background-position: -150% 0; }
        }
        @keyframes pls-grain {
          0%   { transform: translate(0, 0); }
          50%  { transform: translate(-2px, 1px); }
          100% { transform: translate(0, 0); }
        }
        /* One-shot shockwave — gentle expansion, no hard snap */
        @keyframes pls-shockwave {
          0% {
            width: 80px; height: 80px;
            opacity: 0.7;
            border-width: 2px;
          }
          100% {
            width: 480px; height: 480px;
            opacity: 0;
            border-width: 1px;
          }
        }
        /* One-shot flash — soft, fades gently */
        @keyframes pls-flash {
          0%   { opacity: 0.4; }
          100% { opacity: 0; visibility: hidden; }
        }
        /* Progress bar — gentle fill pulse (smooth, not segmented) */
        @keyframes pls-fill-pulse {
          0%, 100% { opacity: 0.7; transform: scaleX(0.85); }
          50%      { opacity: 1; transform: scaleX(1); }
        }
      `}</style>
    </div>
  );
}
