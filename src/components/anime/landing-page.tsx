"use client";

import { useEffect, useRef, useState } from "react";
import { useAppStore } from "./store";

const FONT = "var(--font-space-grotesk), 'Space Grotesk', sans-serif";
const GOLD = "#D4A017";

/* ─── Scroll-reveal for sections ─── */
function useReveal() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); io.disconnect(); } },
      { threshold: 0.15 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return { ref, visible };
}

function Reveal({ children, className = "", delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const { ref, visible } = useReveal();
  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ease-out ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

const FEATURES = [
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-6 h-6">
        <path d="M4 4h16v12H4z" /><path d="M8 20h8M12 16v4" />
      </svg>
    ),
    title: "Anime, Sub & Dub",
    desc: "Thousands of episodes across dozens of live sources — sub, dub, and hardsub, with automatic fallback if a server goes down.",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-6 h-6">
        <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
    title: "Movies & TV",
    desc: "A full library of films and television, powered by TMDB metadata — trending, top rated, and new releases updated daily.",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-6 h-6">
        <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" />
      </svg>
    ),
    title: "Live Sports & TV",
    desc: "Watch live matches and TV channels as they happen, with a full schedule so you never miss kickoff.",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-6 h-6">
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      </svg>
    ),
    title: "Manga & Novels",
    desc: "Read manga chapters and light novels in a clean, distraction-free reader — synced with your bookmarks.",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-6 h-6">
        <path d="M12 20V10M18 20V4M6 20v-6" />
      </svg>
    ),
    title: "Track Everything",
    desc: "Bookmarks and watch history follow you across every section — pick up right where you left off.",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-6 h-6">
        <path d="M13 2 3 14h7l-1 8 11-14h-7l1-6z" />
      </svg>
    ),
    title: "Fast & Ad-Light",
    desc: "A clean player with auto-skip intros, auto-next episode, and quality switching — no clutter, just watching.",
  },
];

export default function LandingPage() {
  const navigate = useAppStore(s => s.navigate);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="w-full bg-black text-white overflow-x-hidden" style={{ fontFamily: "var(--font-inter), Inter, sans-serif" }}>
      {/* ─── Own minimal nav (this page is outside the app chrome) ─── */}
      <header className={`fixed top-0 left-0 right-0 z-40 transition-all duration-300 ${scrolled ? "bg-black/80 backdrop-blur-xl border-b border-white/[0.06]" : "bg-transparent"}`}>
        <div className="max-w-7xl mx-auto px-6 lg:px-10 h-16 flex items-center justify-between">
          <span className="text-lg font-bold" style={{ fontFamily: FONT }}>
            LUFFY <span style={{ color: GOLD }}>TV</span>
          </span>
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-white/60">
            <a href="#features" className="hover:text-white transition-colors">Features</a>
            <a href="#contact" className="hover:text-white transition-colors">Contact</a>
          </div>
          <button
            onClick={() => navigate({ page: "hub" })}
            className="px-4 py-2 rounded-full text-xs font-bold transition-all hover:brightness-110"
            style={{ background: GOLD, color: "#000" }}
          >
            Start Watching
          </button>
        </div>
      </header>

      {/* ─── HERO ─── */}
      <section className="relative w-full h-[100svh] min-h-[560px] flex items-center overflow-hidden">
        <video
          autoPlay muted loop playsInline
          poster="/hero-bg-art.png"
          className="absolute inset-0 w-full h-full object-cover opacity-40"
        >
          <source src="/hero-bg-opt.mp4" type="video/mp4" />
        </video>
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/70 to-black/40" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-transparent to-black/60" />

        <div className="relative z-10 max-w-5xl mx-auto px-6 lg:px-10 text-center flex flex-col items-center gap-6">
          <div className="px-3 py-1 rounded-full border border-white/15 bg-white/5 text-[11px] font-bold uppercase tracking-[0.15em] text-white/60">
            Anime · Movies · TV · Live Sports
          </div>
          <h1
            className="text-4xl sm:text-6xl lg:text-7xl font-black leading-[1.05] tracking-tight"
            style={{ fontFamily: FONT }}
          >
            Every story you love.<br />
            <span style={{ color: GOLD }}>One screen.</span>
          </h1>
          <p className="text-white/60 text-base sm:text-lg max-w-xl leading-relaxed">
            Stream anime, movies, TV shows, manga, and live sports — all in one place,
            free, with no clutter and no bloated queues.
          </p>
          <div className="flex items-center gap-3 flex-wrap justify-center mt-2">
            <button
              onClick={() => navigate({ page: "hub" })}
              className="inline-flex items-center gap-2 px-8 py-3.5 font-bold text-sm rounded-full transition-all hover:brightness-110 hover:scale-[1.02]"
              style={{ background: GOLD, color: "#000" }}
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3" /></svg>
              Start Watching Your Favorite Shows
            </button>
            <a
              href="#features"
              className="inline-flex items-center gap-2 px-6 py-3.5 rounded-full font-bold text-sm text-white/80 border border-white/15 hover:bg-white/10 transition-all"
            >
              Explore Features
            </a>
          </div>
        </div>

        {/* Scroll hint */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-white/30 animate-bounce">
          <span className="text-[10px] font-bold uppercase tracking-widest">Scroll</span>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M12 5v14M5 12l7 7 7-7" /></svg>
        </div>
      </section>

      {/* ─── FEATURES ─── */}
      <section id="features" className="relative py-24 px-6 lg:px-10">
        <div className="max-w-6xl mx-auto">
          <Reveal className="text-center mb-14 flex flex-col items-center gap-3">
            <span className="text-xs font-bold uppercase tracking-[0.2em]" style={{ color: GOLD }}>Why LuffyTV</span>
            <h2 className="text-3xl sm:text-4xl font-black" style={{ fontFamily: FONT }}>Built for people who actually watch</h2>
            <p className="text-white/50 max-w-lg">Every feature exists because a real feature request demanded it — not because it looked good in a deck.</p>
          </Reveal>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map((f, i) => (
              <Reveal key={f.title} delay={i * 80}>
                <div className="h-full p-6 rounded-2xl bg-white/[0.03] border border-white/[0.08] hover:border-white/20 hover:bg-white/[0.05] transition-all">
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-4" style={{ background: `${GOLD}1A`, color: GOLD }}>
                    {f.icon}
                  </div>
                  <h3 className="text-base font-bold mb-1.5">{f.title}</h3>
                  <p className="text-sm text-white/50 leading-relaxed">{f.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CTA BAND ─── */}
      <section className="relative py-20 px-6 lg:px-10">
        <Reveal className="max-w-4xl mx-auto text-center flex flex-col items-center gap-5 p-10 sm:p-14 rounded-3xl border border-white/10 bg-gradient-to-br from-white/[0.06] to-transparent">
          <h2 className="text-2xl sm:text-4xl font-black" style={{ fontFamily: FONT }}>Ready to dive in?</h2>
          <p className="text-white/55 max-w-md">Pick anime, movies, TV, or live sports — and get straight into it. No sign-up required to start.</p>
          <button
            onClick={() => navigate({ page: "hub" })}
            className="inline-flex items-center gap-2 px-8 py-3.5 font-bold text-sm rounded-full transition-all hover:brightness-110 hover:scale-[1.02]"
            style={{ background: GOLD, color: "#000" }}
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3" /></svg>
            Start Watching Your Favorite Shows
          </button>
        </Reveal>
      </section>

      {/* ─── CONTACT ─── */}
      <section id="contact" className="relative py-24 px-6 lg:px-10 border-t border-white/[0.06]">
        <div className="max-w-3xl mx-auto text-center flex flex-col items-center gap-4">
          <span className="text-xs font-bold uppercase tracking-[0.2em]" style={{ color: GOLD }}>Get in Touch</span>
          <h2 className="text-3xl font-black" style={{ fontFamily: FONT }}>Questions, requests, or a broken server?</h2>
          <p className="text-white/50 max-w-md">We read everything. Tell us what's missing, what's broken, or what you want added next.</p>
          <button
            onClick={() => navigate({ page: "contact" })}
            className="mt-2 inline-flex items-center gap-2 px-6 py-3 rounded-full font-bold text-sm text-white border border-white/15 hover:bg-white/10 transition-all"
          >
            Contact Us
          </button>
        </div>
      </section>

      {/* ─── FOOTER ─── */}
      <footer className="border-t border-white/[0.06] py-8 px-6 lg:px-10">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="text-sm font-bold" style={{ fontFamily: FONT }}>
            LUFFY <span style={{ color: GOLD }}>TV</span>
          </span>
          <p className="text-[11px] text-white/25">&copy; {new Date().getFullYear()} Luffy TV — Powered by TMDB &amp; AniList</p>
        </div>
      </footer>
    </div>
  );
}
