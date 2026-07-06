"use client";

import { useAppStore } from "./store";
import type { ReactNode } from "react";

const FONT = "var(--font-space-grotesk), 'Space Grotesk', sans-serif";
const GOLD = "#D4A017";

interface Tile {
  id: string;
  title: string;
  desc: string;
  accent: string;
  icon: ReactNode;
  onClick: () => void;
}

export default function HubPage() {
  const navigate = useAppStore(s => s.navigate);

  const tiles: Tile[] = [
    {
      id: "anime",
      title: "Anime",
      desc: "Sub, dub & hardsub — thousands of episodes",
      accent: "#D4A017",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className="w-7 h-7">
          <path d="M4 4h16v12H4z" /><path d="M8 20h8M12 16v4" />
        </svg>
      ),
      onClick: () => navigate({ page: "home" }),
    },
    {
      id: "movies",
      title: "Movies",
      desc: "Trending, top rated & new releases",
      accent: "#60A5FA",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className="w-7 h-7">
          <rect x="2.5" y="5" width="19" height="14" rx="2" /><path d="M7 5v14M17 5v14M2.5 10h4.5M17 10h4.5M2.5 14h4.5M17 14h4.5" />
        </svg>
      ),
      onClick: () => navigate({ page: "movies" }),
    },
    {
      id: "tv",
      title: "TV Shows",
      desc: "Full seasons, episode by episode",
      accent: "#34D399",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className="w-7 h-7">
          <rect x="2.5" y="5" width="19" height="13" rx="2" /><path d="M8 21h8M12 18v3" />
        </svg>
      ),
      onClick: () => navigate({ page: "tv" }),
    },
    {
      id: "live",
      title: "Live Sports & TV",
      desc: "Watch matches and channels live",
      accent: "#F87171",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className="w-7 h-7">
          <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" />
        </svg>
      ),
      onClick: () => navigate({ page: "live" }),
    },
    {
      id: "manga",
      title: "Manga",
      desc: "Read chapters in a clean reader",
      accent: "#A78BFA",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className="w-7 h-7">
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
        </svg>
      ),
      onClick: () => navigate({ page: "manga" }),
    },
    {
      id: "novel",
      title: "Light Novels",
      desc: "Distraction-free chapter reading",
      accent: "#F472B6",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className="w-7 h-7">
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /><path d="M9 7h7M9 11h7" />
        </svg>
      ),
      onClick: () => navigate({ page: "novel" }),
    },
  ];

  return (
    <div className="w-full min-h-screen bg-black text-white" style={{ fontFamily: "var(--font-inter), Inter, sans-serif" }}>
      {/* Ambient glow background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 left-1/4 w-[500px] h-[500px] rounded-full opacity-[0.12] blur-[120px]" style={{ background: GOLD }} />
        <div className="absolute top-1/2 -right-40 w-[400px] h-[400px] rounded-full opacity-[0.08] blur-[120px] bg-blue-500" />
      </div>

      {/* Minimal top bar */}
      <header className="relative z-10 flex items-center justify-between px-6 lg:px-10 h-16">
        <button onClick={() => navigate({ page: "landing" })} className="text-lg font-bold" style={{ fontFamily: FONT }}>
          LUFFY <span style={{ color: GOLD }}>TV</span>
        </button>
        <button
          onClick={() => navigate({ page: "signin" })}
          className="px-4 py-2 rounded-full text-xs font-bold text-white/70 border border-white/15 hover:bg-white/10 hover:text-white transition-all"
        >
          Sign In
        </button>
      </header>

      <main className="relative z-10 max-w-5xl mx-auto px-6 lg:px-10 pt-8 pb-24">
        <div className="mb-10 flex flex-col gap-2">
          <span className="text-xs font-bold uppercase tracking-[0.2em]" style={{ color: GOLD }}>Choose where to go</span>
          <h1 className="text-3xl sm:text-4xl font-black" style={{ fontFamily: FONT }}>What are we watching today?</h1>
          <p className="text-white/50 text-sm sm:text-base max-w-lg">Pick a section to jump straight in — you can always switch later from the navbar.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {tiles.map(t => (
            <button
              key={t.id}
              onClick={t.onClick}
              className="group relative overflow-hidden flex flex-col items-start gap-3 p-6 rounded-2xl text-left bg-white/[0.03] border border-white/[0.08] hover:border-white/25 hover:bg-white/[0.06] transition-all hover:-translate-y-1"
            >
              <div
                className="absolute -top-8 -right-8 w-24 h-24 rounded-full opacity-0 group-hover:opacity-20 blur-2xl transition-opacity"
                style={{ background: t.accent }}
              />
              <div
                className="relative w-12 h-12 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110"
                style={{ background: `${t.accent}1F`, color: t.accent }}
              >
                {t.icon}
              </div>
              <div className="relative">
                <h3 className="text-lg font-bold">{t.title}</h3>
                <p className="text-sm text-white/45 mt-0.5">{t.desc}</p>
              </div>
              <span className="relative mt-1 inline-flex items-center gap-1 text-xs font-bold text-white/40 group-hover:text-white transition-colors">
                Enter
                <svg className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
              </span>
            </button>
          ))}
        </div>
      </main>
    </div>
  );
}
