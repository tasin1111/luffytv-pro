"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useAppStore } from "./store";
import CinematicBackdrop from "./cinematic-backdrop";
import { useCountUp } from "@/hooks/use-count-up";

const FONT = "var(--font-space-grotesk), 'Space Grotesk', sans-serif";
const ACCENT = "#48A6FF";

interface TrendingItem {
  id: number;
  title: { english?: string; romaji?: string };
  coverImage?: { extraLarge?: string; large?: string };
  bannerImage?: string;
  genres?: string[];
  averageScore?: number;
  episodes?: number;
  format?: string;
  status?: string;
}

function getTitle(a: TrendingItem) {
  return a.title?.english || a.title?.romaji || "Untitled";
}
function getCover(a: TrendingItem) {
  return a.coverImage?.extraLarge || a.coverImage?.large || "";
}

/* ─── Scroll-triggered reveal ─── */
function Reveal({ children, delay = 0, y = 28, className = "" }: { children: React.ReactNode; delay?: number; y?: number; className?: string }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

function SectionHeading({ eyebrow, title, sub }: { eyebrow: string; title: string; sub?: string }) {
  return (
    <Reveal className="flex flex-col gap-3 mb-10 md:mb-12 max-w-2xl">
      <span className="ltv-cine-eyebrow text-xs font-bold uppercase">{eyebrow}</span>
      <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-white leading-[1.08]" style={{ fontFamily: FONT }}>
        {title}
      </h2>
      {sub && <p className="text-[#a1a7b3] text-base leading-relaxed">{sub}</p>}
    </Reveal>
  );
}

/* ─── Stat counter ─── */
function Stat({ value, label, suffix = "" }: { value: number; label: string; suffix?: string }) {
  const [inView, setInView] = useState(false);
  const count = useCountUp(value, 1800, inView);
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      onViewportEnter={() => setInView(true)}
      transition={{ duration: 0.6 }}
      className="flex flex-col gap-0.5"
    >
      <span className="text-2xl sm:text-3xl font-black text-white" style={{ fontFamily: FONT }}>
        {count.toLocaleString()}{suffix}
      </span>
      <span className="text-[11px] uppercase tracking-wider text-[#767d8a] font-bold">{label}</span>
    </motion.div>
  );
}

/* ─── Small poster tile (marquee + collage) ─── */
function PosterTile({ item, className = "", width = "w-[120px]" }: { item?: TrendingItem; className?: string; width?: string }) {
  const img = item ? getCover(item) : "";
  return (
    <div className={`${width} aspect-[2/3] rounded-xl overflow-hidden bg-[#0b0d12] ring-1 ring-white/10 shrink-0 ${className}`}>
      {img ? (
        <img src={img} alt={item ? getTitle(item) : ""} className="w-full h-full object-cover" loading="lazy" />
      ) : (
        <div className="w-full h-full bg-gradient-to-br from-[#10131a] to-[#0b0d12]" />
      )}
    </div>
  );
}

export default function LandingPage() {
  const navigate = useAppStore(s => s.navigate);
  const [trending, setTrending] = useState<TrendingItem[]>([]);
  const shelfRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/anime/anilist-trending?section=trending");
        if (!res.ok || cancelled) return;
        const data = await res.json();
        const trend: TrendingItem[] = (data.trending || data.all || data.media || []).filter((a: TrendingItem) => a?.id);
        if (!cancelled) setTrending(trend.slice(0, 14));
      } catch { /* sections render with placeholders */ }
    })();
    return () => { cancelled = true; };
  }, []);

  const navLinks = [
    { label: "Anime", onClick: () => navigate({ page: "home" }) },
    { label: "Movies", onClick: () => navigate({ page: "movies" }) },
    { label: "Live TV", onClick: () => navigate({ page: "live" }) },
    { label: "Guide", onClick: () => navigate({ page: "guide" }) },
    { label: "Contact", onClick: () => navigate({ page: "contact" }) },
  ];

  const featurePanels = [
    { icon: <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6}><rect x="2" y="3" width="20" height="14" rx="2" /><path d="M8 21h8M12 17v4" /></svg>, title: "Every format, one library", desc: "Anime, movies, TV shows, live sports and TV, manga and light novels — indexed and searchable from a single home.", big: true },
    { icon: <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6}><path d="M13 2 3 14h7l-1 8 11-14h-7l1-6z" /></svg>, title: "Built for speed", desc: "Sources race in parallel — the fastest working stream wins, automatically." },
    { icon: <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" /></svg>, title: "Never lose your spot", desc: "Progress and bookmarks are saved automatically as you watch." },
    { icon: <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6}><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /></svg>, title: "Sub, dub & hardsub", desc: "Every audio track we can find, switchable mid-episode." },
  ];

  const smallFeatures = [
    { label: "Fast Sources", icon: "⚡" },
    { label: "HD & 4K", icon: "🎬" },
    { label: "Zero Ads", icon: "🚫" },
    { label: "Auto-Save Progress", icon: "🔄" },
    { label: "20+ Subtitles", icon: "💬" },
    { label: "Mobile Ready", icon: "📱" },
  ];

  // Collage picks (first four trending covers)
  const collage = trending.slice(0, 4);
  const marqueeItems = trending.length ? trending : Array.from({ length: 10 }, (_, i) => ({ id: -i - 1, title: {} } as TrendingItem));

  const scrollShelf = (dir: 1 | -1) => shelfRef.current?.scrollBy({ left: dir * 640, behavior: "smooth" });

  // "Six worlds" showcase — every content section, each with its own accent.
  // The anime slat gets a real trending cover; the rest get accent nebulas.
  const worlds = [
    { id: "anime", title: "Anime", desc: "Sub, dub & hardsub — thousands of episodes across every era.", accent: "#48A6FF", icon: "📺", cover: collage[2] ? getCover(collage[2]) : "", onClick: () => navigate({ page: "home" }) },
    { id: "movies", title: "Movies", desc: "Trending films, top-rated classics, and new releases in HD.", accent: "#22D3EE", icon: "🎬", cover: "", onClick: () => navigate({ page: "movies" }) },
    { id: "tv", title: "TV Shows", desc: "Full seasons, episode by episode — binge without limits.", accent: "#34D399", icon: "🍿", cover: "", onClick: () => navigate({ page: "tv" }) },
    { id: "live", title: "Live Sports & TV", desc: "Matches and channels streaming live, right now.", accent: "#F87171", icon: "🔴", cover: "", onClick: () => navigate({ page: "live" }) },
    { id: "manga", title: "Manga", desc: "Read chapters in a clean, distraction-free reader.", accent: "#F472B6", icon: "📖", cover: "", onClick: () => navigate({ page: "manga" }) },
    { id: "novel", title: "Light Novels", desc: "The source material — chapter after chapter, beautifully typeset.", accent: "#A3B3CC", icon: "📚", cover: "", onClick: () => navigate({ page: "novel" }) },
  ];

  return (
    <div className="ltv-cine-root w-full text-white overflow-x-hidden" style={{ fontFamily: "var(--font-inter), Inter, sans-serif" }}>
      <CinematicBackdrop />

      {/* ═══ GLASSY FLOATING NAVBAR — identical visual language to the in-app
             navbar (logo left, floating glass pill center, actions right) so
             moving landing ⇄ app never feels like the navbar disappeared. ═══ */}
      <button className="ltv-nav-logo" onClick={() => navigate({ page: "landing" })} aria-label="LuffyTV">
        LuffyTV
      </button>
      <nav className="ltv-nav-pill">
        <div className="ltv-nav-links">
          {navLinks.map(l => (
            <button key={l.label} className="ltv-nav-link" onClick={l.onClick}>
              {l.label}
            </button>
          ))}
        </div>
      </nav>
      <div className="ltv-nav-right-icons">
        <button
          className="ltv-nav-icon-btn"
          onClick={() => navigate({ page: "signin" })}
          aria-label="Sign in"
          title="Sign in"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
            <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
            <polyline points="10 17 15 12 10 7" />
            <line x1="15" y1="12" x2="3" y2="12" />
          </svg>
        </button>
        <button
          onClick={() => navigate({ page: "hub" })}
          className="ltv-cine-btn-primary h-[38px] px-4 rounded-full text-xs font-bold whitespace-nowrap"
        >
          Start Watching
        </button>
      </div>

      {/* ═══ HERO — split: copy left, levitating poster collage right ═══ */}
      <section className="relative min-h-[100svh] flex flex-col justify-center overflow-hidden pt-24 pb-10">
        <div className="ltv-cine-glow-orb w-[560px] h-[560px] left-[-12%] top-[6%]" style={{ background: "rgba(30,136,255,0.14)" }} />

        <div className="relative z-10 max-w-7xl mx-auto w-full px-6 lg:px-10 grid grid-cols-1 lg:grid-cols-[1.05fr_0.95fr] items-center gap-12">
          {/* Copy */}
          <div>
            <motion.span
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.05 }}
              className="ltv-cine-eyebrow inline-block text-xs font-bold uppercase px-3 py-1.5 rounded-full border border-[#1E88FF]/25 bg-[#1E88FF]/[0.06] mb-6"
            >
              Free · No Ads · No Sign-up
            </motion.span>

            <motion.h1
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
              className="ltv-cine-gradient-text font-black leading-[0.98] tracking-tight text-5xl sm:text-6xl xl:text-7xl"
              style={{ fontFamily: FONT }}
            >
              All your anime.<br />One universe.
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.32 }}
              className="text-[#c4c9d2] text-base sm:text-lg max-w-md mt-6 leading-relaxed"
            >
              Anime, movies, TV shows and live sports in one cinematic home —
              press play and it just works.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.46 }}
              className="flex items-center gap-3 flex-wrap mt-9"
            >
              <button
                onClick={() => navigate({ page: "hub" })}
                className="ltv-cine-btn-primary inline-flex items-center gap-2 px-8 py-3.5 rounded-full font-bold text-sm"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3" /></svg>
                Start Watching
              </button>
              <button
                onClick={() => navigate({ page: "home" })}
                className="ltv-cine-btn-secondary inline-flex items-center gap-2 px-6 py-3.5 rounded-full font-bold text-sm"
              >
                Browse Anime
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
              </button>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8, delay: 0.62 }}
              className="flex items-center gap-8 sm:gap-10 mt-12 flex-wrap"
            >
              <Stat value={12000} suffix="+" label="Anime Titles" />
              <Stat value={480000} suffix="+" label="Episodes" />
              <Stat value={50000} suffix="+" label="Monthly Viewers" />
            </motion.div>
          </div>

          {/* Levitating poster collage — hidden on small screens */}
          <motion.div
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1, delay: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="relative h-[520px] hidden lg:block"
            aria-hidden="true"
          >
            {/* Back-glow behind the stack */}
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[420px] h-[420px] rounded-full blur-[100px]" style={{ background: "rgba(30,136,255,0.10)" }} />

            <div className="ltv-cine-float absolute left-[4%] top-[16%] z-10" style={{ ["--fdur" as any]: "8s", ["--frot" as any]: "-8deg" }}>
              <PosterTile item={collage[1]} width="w-[190px]" className="shadow-[0_30px_60px_-15px_rgba(0,0,0,0.8)]" />
            </div>
            <div className="ltv-cine-float absolute left-[34%] top-[4%] z-20" style={{ ["--fdur" as any]: "7s", ["--fdelay" as any]: "0.6s", ["--frot" as any]: "2deg" }}>
              <PosterTile item={collage[0]} width="w-[230px]" className="shadow-[0_40px_80px_-20px_rgba(0,0,0,0.9)] ring-[#48A6FF]/30" />
            </div>
            <div className="ltv-cine-float absolute right-[2%] top-[30%] z-10" style={{ ["--fdur" as any]: "9s", ["--fdelay" as any]: "1.2s", ["--frot" as any]: "9deg" }}>
              <PosterTile item={collage[2]} width="w-[180px]" className="shadow-[0_30px_60px_-15px_rgba(0,0,0,0.8)]" />
            </div>
            <div className="ltv-cine-float absolute left-[20%] bottom-[2%] z-30" style={{ ["--fdur" as any]: "7.5s", ["--fdelay" as any]: "1.8s", ["--frot" as any]: "-3deg" }}>
              <PosterTile item={collage[3]} width="w-[160px]" className="shadow-[0_30px_60px_-15px_rgba(0,0,0,0.8)]" />
            </div>

            {/* Floating UI ornaments */}
            <div className="ltv-cine-float absolute right-[10%] top-[8%] z-40" style={{ ["--fdur" as any]: "6s", ["--fdelay" as any]: "0.3s" }}>
              <div className="flex items-center gap-2 px-3.5 py-2 rounded-full bg-[#0b0d12] ring-1 ring-white/10 shadow-xl text-xs font-bold">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                LIVE Sports & TV
              </div>
            </div>
            <div className="ltv-cine-float absolute left-[0%] bottom-[18%] z-40" style={{ ["--fdur" as any]: "6.5s", ["--fdelay" as any]: "1s" }}>
              <div className="flex items-center gap-2 px-3.5 py-2 rounded-full bg-[#0b0d12] ring-1 ring-white/10 shadow-xl text-xs font-bold">
                <svg className="w-3.5 h-3.5" fill={ACCENT} viewBox="0 0 24 24"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>
                Top-rated every season
              </div>
            </div>
          </motion.div>
        </div>

        {/* Poster marquee strip along the hero's bottom */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 0.8 }}
          className="ltv-cine-marquee relative z-10 mt-14"
        >
          <div className="ltv-cine-marquee-track">
            {[...marqueeItems, ...marqueeItems].map((item, i) => (
              <button key={`${item.id}-${i}`} onClick={() => item.id > 0 && navigate({ page: "anime", id: String(item.id) })} className="focus:outline-none">
                <PosterTile item={item.id > 0 ? item : undefined} width="w-[110px]" className="opacity-80 hover:opacity-100 transition-opacity" />
              </button>
            ))}
          </div>
        </motion.div>
      </section>

      {/* ═══ TOP 10 — numbered ranking rail ═══ */}
      {trending.length > 0 && (
        <section className="relative z-10 py-16 sm:py-24 px-6 lg:px-10">
          <div className="ltv-cine-hairline mb-16 sm:mb-24 -mt-2" />
          <div className="max-w-7xl mx-auto">
            <div className="flex items-end justify-between gap-4 flex-wrap">
              <SectionHeading eyebrow="Trending Right Now" title="Today's Top 10" />
              <Reveal>
                <div className="hidden md:flex items-center gap-2 mb-12">
                  <button onClick={() => scrollShelf(-1)} aria-label="Scroll left" className="w-10 h-10 rounded-full bg-[#0b0d12] border border-white/10 flex items-center justify-center text-white/70 hover:text-white hover:border-[#48A6FF]/50 transition-all">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path d="M15 19l-7-7 7-7" /></svg>
                  </button>
                  <button onClick={() => scrollShelf(1)} aria-label="Scroll right" className="w-10 h-10 rounded-full bg-[#0b0d12] border border-white/10 flex items-center justify-center text-white/70 hover:text-white hover:border-[#48A6FF]/50 transition-all">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path d="M9 5l7 7-7 7" /></svg>
                  </button>
                </div>
              </Reveal>
            </div>

            <div ref={shelfRef} className="ltv-cine-shelf flex gap-2 overflow-x-auto pb-2 items-end">
              {trending.slice(0, 10).map((item, i) => (
                <motion.button
                  key={item.id}
                  onClick={() => navigate({ page: "anime", id: String(item.id) })}
                  className="ltv-cine-rank-item flex items-end shrink-0 group text-left"
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-40px" }}
                  transition={{ duration: 0.55, delay: i * 0.05, ease: [0.22, 1, 0.36, 1] }}
                >
                  <span className="ltv-cine-rank text-[92px] sm:text-[120px] -mr-5 sm:-mr-7 relative z-0" style={{ fontFamily: FONT }}>
                    {i + 1}
                  </span>
                  <div className="relative z-10 ltv-cine-poster w-[130px] sm:w-[150px] rounded-xl bg-[#0b0d12]">
                    <div className="relative w-full aspect-[2/3] overflow-hidden rounded-xl">
                      {getCover(item) ? (
                        <img src={getCover(item)} alt={getTitle(item)} className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
                      ) : (
                        <div className="absolute inset-0 bg-gradient-to-br from-[#10131a] to-[#0b0d12]" />
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                      <div className="absolute bottom-0 left-0 right-0 p-2">
                        <p className="text-[11px] font-bold text-white line-clamp-2 leading-tight">{getTitle(item)}</p>
                        {!!item.averageScore && (
                          <p className="text-[10px] font-bold mt-0.5" style={{ color: ACCENT }}>★ {item.averageScore}%</p>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.button>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ═══ LIVE CALLOUT ═══ */}
      <section className="relative z-10 py-14 px-6 lg:px-10">
        <Reveal className="max-w-7xl mx-auto">
          <div className="ltv-cine-surface rounded-3xl overflow-hidden relative">
            <div className="absolute -right-16 -top-16 w-[340px] h-[340px] rounded-full blur-[110px]" style={{ background: "rgba(239,68,68,0.10)" }} />
            <div className="relative grid grid-cols-1 md:grid-cols-[1.2fr_0.8fr] items-center gap-8 p-8 sm:p-12">
              <div>
                <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-red-400 mb-4">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  Live right now
                </span>
                <h2 className="text-3xl sm:text-4xl font-black text-white leading-[1.08] mb-3" style={{ fontFamily: FONT }}>
                  Sports & TV, as they happen
                </h2>
                <p className="text-[#a1a7b3] max-w-md leading-relaxed mb-6">
                  Live matches, live channels, and a full schedule so you never miss
                  kickoff — right next to your anime.
                </p>
                <button
                  onClick={() => navigate({ page: "live" })}
                  className="ltv-cine-btn-primary inline-flex items-center gap-2 px-7 py-3 rounded-full font-bold text-sm"
                >
                  Watch Live
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
                </button>
              </div>
              <div className="hidden md:flex items-center justify-center select-none" aria-hidden="true">
                <span
                  className="font-black leading-none"
                  style={{ fontFamily: FONT, fontSize: "120px", color: "transparent", WebkitTextStroke: "2px rgba(239,68,68,0.5)" }}
                >
                  LIVE
                </span>
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ═══ WHY LUFFYTV — bento panels ═══ */}
      <section className="relative z-10 py-16 sm:py-24 px-6 lg:px-10">
        <div className="max-w-7xl mx-auto">
          <SectionHeading eyebrow="Why LuffyTV" title="Built like a premium platform. Priced like it's free." sub="Every feature exists because it was actually needed — not because it looked good in a deck." />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {featurePanels.map((f, i) => (
              <Reveal key={f.title} delay={i * 0.08} className={f.big ? "sm:col-span-2" : ""}>
                <div className="ltv-cine-surface rounded-2xl h-full p-6 sm:p-8 flex flex-col gap-4">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ background: "rgba(30,136,255,0.10)", color: ACCENT }}>
                    {f.icon}
                  </div>
                  <div>
                    <h3 className={`font-bold text-white ${f.big ? "text-2xl" : "text-lg"}`}>{f.title}</h3>
                    <p className="text-sm text-[#a1a7b3] mt-1.5 leading-relaxed">{f.desc}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ EVERYTHING INCLUDED ═══ */}
      <section className="relative z-10 py-12 sm:py-16 px-6 lg:px-10">
        <div className="max-w-5xl mx-auto">
          <SectionHeading eyebrow="Everything Included" title="No paywalls. No tiers. No catch." />
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
            {smallFeatures.map((f, i) => (
              <Reveal key={f.label} delay={i * 0.05}>
                <div className="ltv-cine-surface rounded-xl px-4 py-5 flex flex-col items-center gap-2 text-center h-full">
                  <span className="text-2xl">{f.icon}</span>
                  <span className="text-xs font-bold text-[#e8eaee]">{f.label}</span>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ SIX WORLDS — cinematic hover-expanding showcase of every
             content section: Anime, Movies, TV, Live, Manga, Novels ═══ */}
      <section className="relative z-10 py-16 sm:py-24 px-6 lg:px-10">
        <div className="ltv-cine-hairline mb-16 sm:mb-24 -mt-2" />
        <div className="max-w-7xl mx-auto">
          <SectionHeading
            eyebrow="One Platform, Six Worlds"
            title="Not just anime."
            sub="Movies, TV shows, manga, light novels, and live sports live here too — hover a world, step inside."
          />
          <Reveal>
            <div className="ltv-cine-slats">
              {worlds.map(w => (
                <button
                  key={w.id}
                  onClick={w.onClick}
                  className="ltv-cine-slat group"
                  style={{
                    ["--slat-accent" as any]: `${w.accent}73`,
                    ["--slat-glow" as any]: `${w.accent}40`,
                  }}
                  aria-label={`Explore ${w.title}`}
                >
                  {/* Backdrop: cover art for anime, accent nebula for the rest */}
                  {w.cover ? (
                    <>
                      <img src={w.cover} alt="" className="absolute inset-0 w-full h-full object-cover opacity-50 group-hover:opacity-70 transition-opacity duration-500" loading="lazy" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
                    </>
                  ) : (
                    <div
                      className="absolute inset-0 transition-opacity duration-500 opacity-70 group-hover:opacity-100"
                      style={{ background: `radial-gradient(ellipse 120% 80% at 50% 110%, ${w.accent}2e, transparent 65%), #0b0d12` }}
                    />
                  )}

                  {/* Icon chip — always visible, top-left */}
                  <span
                    className="ltv-cine-slat-icon absolute top-5 left-5 w-11 h-11 rounded-xl flex items-center justify-center text-xl"
                    style={{ background: `${w.accent}1f`, color: w.accent }}
                  >
                    {w.icon}
                  </span>

                  {/* Collapsed vertical label */}
                  <span className="ltv-cine-slat-label">{w.title}</span>

                  {/* Expanded body */}
                  <span className="ltv-cine-slat-body">
                    <span className="text-2xl font-black text-white mb-1.5" style={{ fontFamily: FONT }}>{w.title}</span>
                    <span className="text-[13px] text-[#c4c9d2] leading-relaxed mb-4 max-w-[240px]">{w.desc}</span>
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold" style={{ color: w.accent }}>
                      Explore
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ═══ COMMUNITY ═══ */}
      <section className="relative z-10 py-16 sm:py-24 px-6 lg:px-10">
        <Reveal className="max-w-5xl mx-auto">
          <div className="ltv-cine-surface rounded-3xl p-10 sm:p-16 flex flex-col items-center text-center gap-6 relative overflow-hidden">
            <div className="ltv-cine-glow-orb w-[300px] h-[300px] left-1/2 -translate-x-1/2 -top-24" style={{ background: "rgba(30,136,255,0.12)" }} />
            <span className="ltv-cine-eyebrow text-xs font-bold uppercase relative">Join the Community</span>
            <h2 className="text-2xl sm:text-4xl font-black relative" style={{ fontFamily: FONT }}>50,000+ fans already watching</h2>
            <p className="text-[#a1a7b3] max-w-md relative">Get release alerts, request titles, and talk anime with people who actually watch it.</p>
            <div className="flex items-center gap-3 flex-wrap justify-center relative">
              <a
                href="https://discord.gg/Svc9yFjQBq"
                target="_blank"
                rel="noopener noreferrer"
                className="ltv-cine-btn-primary inline-flex items-center gap-2 px-7 py-3 rounded-full font-bold text-sm"
              >
                <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                  <path d="M20.317 4.37a19.791 19.791 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 00.031.057 19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 00-.041-.106 13.107 13.107 0 01-1.872-.892.077.077 0 01-.008-.128 10.2 10.2 0 00.372-.292.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127 12.299 12.299 0 01-1.873.892.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.839 19.839 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.03z"/>
                </svg>
                Join Discord
              </a>
              <button onClick={() => navigate({ page: "contact" })} className="ltv-cine-btn-secondary inline-flex items-center gap-2 px-7 py-3 rounded-full font-bold text-sm">
                Contact Us
              </button>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ═══ FOOTER ═══ */}
      <footer className="relative z-10 border-t border-white/[0.06] py-14 px-6 lg:px-10">
        <div className="max-w-7xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-8 mb-10">
          <div className="col-span-2 sm:col-span-1">
            <span className="text-lg font-bold" style={{ fontFamily: FONT }}>LUFFY <span style={{ color: ACCENT }}>TV</span></span>
            <p className="text-xs text-[#767d8a] mt-3 leading-relaxed max-w-[220px]">Free anime, movies, TV, and live sports streaming — no ads, no limits.</p>
          </div>
          <div className="flex flex-col gap-2.5">
            <span className="text-xs font-bold uppercase tracking-wider text-white mb-1">Browse</span>
            <button onClick={() => navigate({ page: "home" })} className="text-sm text-[#a1a7b3] hover:text-white transition-colors text-left">Anime</button>
            <button onClick={() => navigate({ page: "movies" })} className="text-sm text-[#a1a7b3] hover:text-white transition-colors text-left">Movies</button>
            <button onClick={() => navigate({ page: "tv" })} className="text-sm text-[#a1a7b3] hover:text-white transition-colors text-left">TV Shows</button>
            <button onClick={() => navigate({ page: "live" })} className="text-sm text-[#a1a7b3] hover:text-white transition-colors text-left">Live TV</button>
          </div>
          <div className="flex flex-col gap-2.5">
            <span className="text-xs font-bold uppercase tracking-wider text-white mb-1">Company</span>
            <button onClick={() => navigate({ page: "guide" })} className="text-sm text-[#a1a7b3] hover:text-white transition-colors text-left">Guide</button>
            <button onClick={() => navigate({ page: "contact" })} className="text-sm text-[#a1a7b3] hover:text-white transition-colors text-left">Contact</button>
          </div>
          <div className="flex flex-col gap-2.5">
            <span className="text-xs font-bold uppercase tracking-wider text-white mb-1">Connect</span>
            <a href="https://discord.gg/Svc9yFjQBq" target="_blank" rel="noopener noreferrer" className="text-sm text-[#a1a7b3] hover:text-white transition-colors">Discord</a>
          </div>
        </div>
        <div className="ltv-cine-divider max-w-7xl mx-auto mb-6" />
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <p className="text-[11px] text-[#5b616c]">&copy; {new Date().getFullYear()} Luffy TV — Powered by TMDB &amp; AniList</p>
          <p className="text-[11px] text-[#5b616c]">Fan-made project. Not affiliated with any studio.</p>
        </div>
      </footer>
    </div>
  );
}
