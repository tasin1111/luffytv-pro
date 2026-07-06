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

/* ─── TMDB items for the movies/TV showcase ─── */
interface TMDBItem {
  id: number;
  title?: string;
  name?: string;
  poster_path?: string;
  backdrop_path?: string;
  vote_average?: number;
  overview?: string;
  release_date?: string;
  first_air_date?: string;
}
const tmdbTitle = (m: TMDBItem) => m.title || m.name || "";
const tmdbPoster = (m: TMDBItem) => (m.poster_path ? `https://image.tmdb.org/t/p/w342${m.poster_path}` : "");
const tmdbBackdrop = (m: TMDBItem) => (m.backdrop_path ? `https://image.tmdb.org/t/p/w1280${m.backdrop_path}` : "");
const tmdbYear = (m: TMDBItem) => (m.release_date || m.first_air_date || "").split("-")[0];
const tmdbScore = (m: TMDBItem) => (m.vote_average ? (m.vote_average > 10 ? m.vote_average / 10 : m.vote_average) : 0);

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
  const [movies, setMovies] = useState<TMDBItem[]>([]);
  const [shows, setShows] = useState<TMDBItem[]>([]);
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
    // Real movie/TV artwork for the showcase — sections hide gracefully if
    // TMDB is unavailable.
    (async () => {
      try {
        const [mRes, tRes] = await Promise.all([
          fetch("/api/tmdb/trending?type=movie&time=week"),
          fetch("/api/tmdb/trending?type=tv&time=week"),
        ]);
        if (cancelled) return;
        if (mRes.ok) {
          const m = await mRes.json();
          if (!cancelled) setMovies((m.results || []).filter((x: TMDBItem) => x.poster_path).slice(0, 14));
        }
        if (tRes.ok) {
          const t = await tRes.json();
          if (!cancelled) setShows((t.results || []).filter((x: TMDBItem) => x.poster_path).slice(0, 14));
        }
      } catch { /* showcase hides without data */ }
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

  // Collage picks (first four trending covers)
  const collage = trending.slice(0, 4);
  const marqueeItems = trending.length ? trending : Array.from({ length: 10 }, (_, i) => ({ id: -i - 1, title: {} } as TrendingItem));

  const scrollShelf = (dir: 1 | -1) => shelfRef.current?.scrollBy({ left: dir * 640, behavior: "smooth" });

  // Movies showcase picks
  const spotlight = movies.find(m => m.backdrop_path && m.overview);
  const sideMovies = movies.filter(m => m.backdrop_path && m.id !== spotlight?.id).slice(0, 2);
  const movieRail = movies.filter(m => m.id !== spotlight?.id && !sideMovies.some(s => s.id === m.id));

  const liveCategories = ["Football", "Cricket", "Basketball", "F1", "UFC", "Tennis", "24/7 Channels"];

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

      {/* ═══ MOVIES & TV SHOWCASE — real TMDB artwork ═══ */}
      {spotlight && (
        <section className="relative z-10 py-16 sm:py-24 px-6 lg:px-10">
          <div className="ltv-cine-hairline mb-16 sm:mb-24 -mt-2" />
          <div className="max-w-7xl mx-auto">
            <div className="flex items-end justify-between gap-4 flex-wrap">
              <SectionHeading
                eyebrow="Movies & TV Shows"
                title="Movie night, solved."
                sub="Blockbusters, classics and full TV seasons in HD — streaming right now, free."
              />
              <Reveal>
                <div className="hidden md:flex items-center gap-2 mb-12">
                  <button onClick={() => navigate({ page: "movies" })} className="ltv-cine-btn-secondary px-5 py-2.5 rounded-full font-bold text-xs">Browse Movies</button>
                  <button onClick={() => navigate({ page: "tv" })} className="ltv-cine-btn-secondary px-5 py-2.5 rounded-full font-bold text-xs">TV Shows</button>
                </div>
              </Reveal>
            </div>

            {/* Spotlight + side stack */}
            <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_0.6fr] gap-4">
              <Reveal>
                <button
                  onClick={() => navigate({ page: "movie-detail", id: spotlight.id })}
                  className="group relative w-full h-[340px] sm:h-[440px] rounded-3xl overflow-hidden text-left border border-white/[0.07] hover:border-[#48A6FF]/40 transition-colors duration-300 block"
                >
                  <img src={tmdbBackdrop(spotlight)} alt={tmdbTitle(spotlight)} className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.04]" loading="lazy" />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#050608] via-[#050608]/30 to-transparent" />
                  <div className="absolute inset-0 bg-gradient-to-r from-[#050608]/80 via-transparent to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-6 sm:p-9">
                    <span className="inline-flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[0.24em] mb-2.5" style={{ color: ACCENT, fontFamily: FONT }}>
                      <span className="w-5 h-px" style={{ background: ACCENT }} />
                      #1 Trending in Movies
                    </span>
                    <h3 className="text-2xl sm:text-4xl font-black text-white tracking-tight mb-2.5" style={{ fontFamily: FONT }}>{tmdbTitle(spotlight)}</h3>
                    <div className="flex items-center gap-2 mb-3">
                      {tmdbScore(spotlight) > 0 && (
                        <span className="px-2.5 py-1 rounded-md text-[11px] font-bold border" style={{ color: ACCENT, borderColor: `${ACCENT}4d`, background: "rgba(30,136,255,0.10)" }}>
                          ★ {tmdbScore(spotlight).toFixed(1)}
                        </span>
                      )}
                      {tmdbYear(spotlight) && <span className="px-2.5 py-1 rounded-md text-[11px] font-semibold text-[#c4c9d2] border border-white/15 bg-black/40">{tmdbYear(spotlight)}</span>}
                      <span className="px-2.5 py-1 rounded-md text-[11px] font-semibold text-[#c4c9d2] border border-white/15 bg-black/40">HD</span>
                    </div>
                    <p className="text-sm text-[#c4c9d2] line-clamp-2 max-w-xl mb-5 leading-relaxed">{spotlight.overview}</p>
                    <span className="ltv-cine-btn-primary inline-flex items-center gap-2 px-6 py-2.5 rounded-full font-bold text-sm">
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3" /></svg>
                      Watch Free
                    </span>
                  </div>
                </button>
              </Reveal>

              <div className="grid grid-rows-2 gap-4">
                {sideMovies.map((m, i) => (
                  <Reveal key={m.id} delay={0.1 + i * 0.1}>
                    <button
                      onClick={() => navigate({ page: "movie-detail", id: m.id })}
                      className="group relative w-full h-[160px] sm:h-[212px] rounded-2xl overflow-hidden text-left border border-white/[0.07] hover:border-[#48A6FF]/40 transition-colors duration-300 block"
                    >
                      <img src={tmdbBackdrop(m)} alt={tmdbTitle(m)} className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.05]" loading="lazy" />
                      <div className="absolute inset-0 bg-gradient-to-t from-[#050608] via-[#050608]/20 to-transparent" />
                      <div className="absolute bottom-0 left-0 right-0 p-4">
                        <p className="text-base font-black text-white tracking-tight line-clamp-1" style={{ fontFamily: FONT }}>{tmdbTitle(m)}</p>
                        <p className="text-[11px] font-bold mt-1 flex items-center gap-2" style={{ color: ACCENT }}>
                          {tmdbScore(m) > 0 && <span>★ {tmdbScore(m).toFixed(1)}</span>}
                          <span className="text-[#767d8a] font-semibold">{tmdbYear(m)}</span>
                        </p>
                      </div>
                      <span className="absolute top-3 right-3 w-9 h-9 rounded-full bg-black/60 border border-white/15 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <svg className="w-3.5 h-3.5 text-white translate-x-[1px]" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3" /></svg>
                      </span>
                    </button>
                  </Reveal>
                ))}
              </div>
            </div>

            {/* Movie poster rail */}
            {movieRail.length > 0 && (
              <Reveal delay={0.15}>
                <div className="flex gap-3 overflow-x-auto pb-2 mt-4 ltv-cine-shelf">
                  {movieRail.slice(0, 12).map(m => (
                    <button
                      key={m.id}
                      onClick={() => navigate({ page: "movie-detail", id: m.id })}
                      className="group shrink-0 w-[110px] sm:w-[126px] text-left"
                      title={tmdbTitle(m)}
                    >
                      <div className="relative aspect-[2/3] rounded-xl overflow-hidden bg-[#0b0d12] ring-1 ring-white/10 group-hover:ring-[#48A6FF]/50 transition-all">
                        <img src={tmdbPoster(m)} alt={tmdbTitle(m)} className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.06]" loading="lazy" />
                      </div>
                      <p className="text-[11px] font-bold text-[#c4c9d2] group-hover:text-white truncate mt-1.5 transition-colors">{tmdbTitle(m)}</p>
                    </button>
                  ))}
                </div>
              </Reveal>
            )}

            {/* TV shows rail */}
            {shows.length > 0 && (
              <Reveal delay={0.1}>
                <div className="flex items-center gap-3 mt-10 mb-4">
                  <span className="text-[10px] font-extrabold uppercase tracking-[0.24em]" style={{ color: "#34D399", fontFamily: FONT }}>Trending TV Shows</span>
                  <span className="flex-1 h-px bg-white/[0.06]" />
                  <button onClick={() => navigate({ page: "tv" })} className="text-[11px] font-bold text-[#767d8a] hover:text-white transition-colors">View all →</button>
                </div>
                <div className="flex gap-3 overflow-x-auto pb-2 ltv-cine-shelf">
                  {shows.slice(0, 12).map(s => (
                    <button
                      key={s.id}
                      onClick={() => navigate({ page: "tv-detail", id: s.id })}
                      className="group shrink-0 w-[110px] sm:w-[126px] text-left"
                      title={tmdbTitle(s)}
                    >
                      <div className="relative aspect-[2/3] rounded-xl overflow-hidden bg-[#0b0d12] ring-1 ring-white/10 group-hover:ring-[#34D399]/50 transition-all">
                        <img src={tmdbPoster(s)} alt={tmdbTitle(s)} className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.06]" loading="lazy" />
                      </div>
                      <p className="text-[11px] font-bold text-[#c4c9d2] group-hover:text-white truncate mt-1.5 transition-colors">{tmdbTitle(s)}</p>
                    </button>
                  ))}
                </div>
              </Reveal>
            )}
          </div>
        </section>
      )}

      {/* ═══ LIVE TV — broadcast console ═══ */}
      <section className="relative z-10 py-14 px-6 lg:px-10">
        <Reveal className="max-w-7xl mx-auto">
          <div className="relative rounded-3xl overflow-hidden border border-white/[0.07]" style={{ background: "linear-gradient(160deg, #0b0d12 0%, #0a0c11 55%, #120b0d 100%)" }}>
            <div className="absolute -right-20 -top-20 w-[380px] h-[380px] rounded-full blur-[120px]" style={{ background: "rgba(239,68,68,0.12)" }} />
            <div className="relative grid grid-cols-1 md:grid-cols-[1.1fr_0.9fr] gap-10 p-8 sm:p-12 items-center">
              {/* Left: pitch */}
              <div>
                <span className="ltv-cine-onair inline-flex items-center gap-2.5 px-4 py-2 rounded-lg mb-6" style={{ fontFamily: FONT }}>
                  <i /> ON AIR
                </span>
                <h2 className="text-3xl sm:text-5xl font-black text-white leading-[1.05] mb-4" style={{ fontFamily: FONT }}>
                  Live sports & TV,<br />broadcasting now.
                </h2>
                <p className="text-[#a1a7b3] max-w-md leading-relaxed mb-6">
                  Matches as they kick off, channels running 24/7, and a full schedule
                  so you never miss a second — streaming free in real time.
                </p>
                <div className="flex flex-wrap gap-2 mb-8">
                  {liveCategories.map(c => (
                    <span key={c} className="px-3 py-1.5 rounded-full text-[11px] font-bold text-[#c4c9d2] border border-white/10 bg-white/[0.03]">{c}</span>
                  ))}
                </div>
                <button
                  onClick={() => navigate({ page: "live" })}
                  className="inline-flex items-center gap-2 px-7 py-3 rounded-full font-bold text-sm text-white transition-transform hover:-translate-y-0.5"
                  style={{ background: "#DC2626", boxShadow: "0 10px 32px -8px rgba(220,38,38,0.55)" }}
                >
                  <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                  Watch Live Now
                </button>
              </div>

              {/* Right: channel monitor stack */}
              <div className="flex flex-col gap-3" aria-hidden="true">
                {[
                  { label: "Live Football", sub: "Matchday · Multiple streams", color: "#F87171" },
                  { label: "24/7 TV Channels", sub: "News · Movies · Kids · Music", color: "#FB923C" },
                  { label: "Match Schedule", sub: "Kickoff times in your timezone", color: "#F87171" },
                ].map((ch, i) => (
                  <div key={ch.label} className="flex items-center gap-4 rounded-2xl border border-white/[0.07] bg-[#0d1016] px-5 py-4">
                    <span className="ltv-cine-eq shrink-0" style={{ color: ch.color, ["--eqd" as any]: `${i * 0.18}s` }}>
                      <i /><i /><i /><i /><i />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-black text-white truncate" style={{ fontFamily: FONT }}>{ch.label}</p>
                      <p className="text-[11px] text-[#767d8a] truncate mt-0.5">{ch.sub}</p>
                    </div>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[9px] font-extrabold tracking-[0.16em] text-red-400 border border-red-500/25 bg-red-500/[0.08] shrink-0" style={{ fontFamily: FONT }}>
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                      LIVE
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ═══ THE WHOLE LIBRARY — bento mosaic with real artwork ═══ */}
      <section className="relative z-10 py-16 sm:py-24 px-6 lg:px-10">
        <div className="max-w-7xl mx-auto">
          <SectionHeading
            eyebrow="One Platform, Everything"
            title="And that's not all."
            sub="Manga, light novels, music and more — the whole library lives behind one door."
          />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 auto-rows-[150px] sm:auto-rows-[170px]">
            {/* Anime — big tile with real covers */}
            <Reveal className="col-span-2 row-span-2">
              <button onClick={() => navigate({ page: "home" })} className="group relative w-full h-full rounded-3xl overflow-hidden border border-white/[0.07] hover:border-[#48A6FF]/45 transition-colors text-left block">
                {collage[0] && <img src={getCover(collage[0])} alt="" className="absolute inset-0 w-full h-full object-cover opacity-60 group-hover:opacity-75 group-hover:scale-[1.03] transition-all duration-700" loading="lazy" />}
                <div className="absolute inset-0 bg-gradient-to-t from-[#050608] via-[#050608]/30 to-transparent" />
                <div className="absolute bottom-0 left-0 p-6">
                  <span className="text-[10px] font-extrabold uppercase tracking-[0.24em] mb-1.5 block" style={{ color: ACCENT, fontFamily: FONT }}>The main event</span>
                  <p className="text-2xl sm:text-3xl font-black text-white" style={{ fontFamily: FONT }}>Anime</p>
                  <p className="text-[13px] text-[#c4c9d2] mt-1">10,000+ titles · Sub, dub & hardsub</p>
                </div>
              </button>
            </Reveal>

            {/* Movies tile — real poster */}
            <Reveal delay={0.06}>
              <button onClick={() => navigate({ page: "movies" })} className="group relative w-full h-full rounded-2xl overflow-hidden border border-white/[0.07] hover:border-[#22D3EE]/45 transition-colors text-left block">
                {movies[0] && <img src={tmdbBackdrop(movies[0]) || tmdbPoster(movies[0])} alt="" className="absolute inset-0 w-full h-full object-cover opacity-55 group-hover:opacity-70 group-hover:scale-[1.04] transition-all duration-700" loading="lazy" />}
                <div className="absolute inset-0 bg-gradient-to-t from-[#050608] via-[#050608]/35 to-transparent" />
                <div className="absolute bottom-0 left-0 p-4">
                  <p className="text-lg font-black text-white" style={{ fontFamily: FONT }}>Movies</p>
                  <p className="text-[11px] text-[#a1a7b3]">HD · New releases weekly</p>
                </div>
              </button>
            </Reveal>

            {/* TV tile — real backdrop */}
            <Reveal delay={0.1}>
              <button onClick={() => navigate({ page: "tv" })} className="group relative w-full h-full rounded-2xl overflow-hidden border border-white/[0.07] hover:border-[#34D399]/45 transition-colors text-left block">
                {shows[0] && <img src={tmdbBackdrop(shows[0]) || tmdbPoster(shows[0])} alt="" className="absolute inset-0 w-full h-full object-cover opacity-55 group-hover:opacity-70 group-hover:scale-[1.04] transition-all duration-700" loading="lazy" />}
                <div className="absolute inset-0 bg-gradient-to-t from-[#050608] via-[#050608]/35 to-transparent" />
                <div className="absolute bottom-0 left-0 p-4">
                  <p className="text-lg font-black text-white" style={{ fontFamily: FONT }}>TV Shows</p>
                  <p className="text-[11px] text-[#a1a7b3]">Full seasons, tracked</p>
                </div>
              </button>
            </Reveal>

            {/* Live tile */}
            <Reveal delay={0.14}>
              <button onClick={() => navigate({ page: "live" })} className="group relative w-full h-full rounded-2xl overflow-hidden border border-white/[0.07] hover:border-red-400/45 transition-colors text-left block bg-[#0d1016]">
                <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse 130% 90% at 50% 115%, rgba(239,68,68,0.20), transparent 65%)" }} />
                <span className="absolute top-4 left-4 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[9px] font-extrabold tracking-[0.16em] text-red-400 border border-red-500/25 bg-red-500/[0.08]" style={{ fontFamily: FONT }}>
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                  LIVE
                </span>
                <div className="absolute bottom-0 left-0 p-4">
                  <p className="text-lg font-black text-white" style={{ fontFamily: FONT }}>Live TV</p>
                  <p className="text-[11px] text-[#a1a7b3]">Sports & channels, real-time</p>
                </div>
              </button>
            </Reveal>

            {/* Manga tile — real cover */}
            <Reveal delay={0.18}>
              <button onClick={() => navigate({ page: "manga" })} className="group relative w-full h-full rounded-2xl overflow-hidden border border-white/[0.07] hover:border-[#F472B6]/45 transition-colors text-left block">
                {collage[1] && <img src={getCover(collage[1])} alt="" className="absolute inset-0 w-full h-full object-cover opacity-45 grayscale group-hover:grayscale-0 group-hover:opacity-60 group-hover:scale-[1.04] transition-all duration-700" loading="lazy" />}
                <div className="absolute inset-0 bg-gradient-to-t from-[#050608] via-[#050608]/35 to-transparent" />
                <div className="absolute bottom-0 left-0 p-4">
                  <p className="text-lg font-black text-white" style={{ fontFamily: FONT }}>Manga</p>
                  <p className="text-[11px] text-[#a1a7b3]">Clean chapter reader</p>
                </div>
              </button>
            </Reveal>

            {/* Novels tile */}
            <Reveal delay={0.22}>
              <button onClick={() => navigate({ page: "novel" })} className="group relative w-full h-full rounded-2xl overflow-hidden border border-white/[0.07] hover:border-[#A3B3CC]/45 transition-colors text-left block bg-[#0d1016]">
                <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse 130% 90% at 50% 115%, rgba(163,179,204,0.14), transparent 65%)" }} />
                <span className="absolute top-4 left-4 text-2xl" aria-hidden="true">📚</span>
                <div className="absolute bottom-0 left-0 p-4">
                  <p className="text-lg font-black text-white" style={{ fontFamily: FONT }}>Light Novels</p>
                  <p className="text-[11px] text-[#a1a7b3]">The story before the story</p>
                </div>
              </button>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ═══ FINAL CTA ═══ */}
      <section className="relative z-10 py-16 sm:py-24 px-6 lg:px-10">
        <Reveal className="max-w-5xl mx-auto">
          <div className="ltv-cine-surface rounded-3xl p-10 sm:p-16 flex flex-col items-center text-center gap-6 relative overflow-hidden">
            <div className="ltv-cine-glow-orb w-[300px] h-[300px] left-1/2 -translate-x-1/2 -top-24" style={{ background: "rgba(30,136,255,0.12)" }} />
            <span className="ltv-cine-eyebrow text-xs font-bold uppercase relative">No sign-up required</span>
            <h2 className="text-3xl sm:text-5xl font-black relative leading-[1.05]" style={{ fontFamily: FONT }}>Ready when you are.<br />It&apos;s free.</h2>
            <p className="text-[#a1a7b3] max-w-md relative">Pick a section, press play. 50,000+ people already watch here every month.</p>
            <div className="flex items-center gap-3 flex-wrap justify-center relative">
              <button
                onClick={() => navigate({ page: "hub" })}
                className="ltv-cine-btn-primary inline-flex items-center gap-2 px-8 py-3.5 rounded-full font-bold text-sm"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3" /></svg>
                Start Watching
              </button>
              <a
                href="https://discord.gg/Svc9yFjQBq"
                target="_blank"
                rel="noopener noreferrer"
                className="ltv-cine-btn-secondary inline-flex items-center gap-2 px-7 py-3.5 rounded-full font-bold text-sm"
              >
                <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                  <path d="M20.317 4.37a19.791 19.791 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 00.031.057 19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 00-.041-.106 13.107 13.107 0 01-1.872-.892.077.077 0 01-.008-.128 10.2 10.2 0 00.372-.292.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127 12.299 12.299 0 01-1.873.892.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.839 19.839 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.03z"/>
                </svg>
                Join Discord
              </a>
            </div>
            <div className="flex items-center justify-center gap-x-5 gap-y-2 flex-wrap relative mt-2">
              {["Zero ads", "HD & 4K", "Auto-resume", "Sub · Dub · Hardsub"].map(f => (
                <span key={f} className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[#767d8a]">
                  <svg className="w-3 h-3" style={{ color: ACCENT }} fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" /></svg>
                  {f}
                </span>
              ))}
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
