"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { useAppStore } from "./store";
import CinematicBackdrop from "./cinematic-backdrop";
import { useCountUp } from "@/hooks/use-count-up";

const FONT = "var(--font-space-grotesk), 'Space Grotesk', sans-serif";

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
  nextAiringEpisode?: { episode: number; airingAt: number };
}

function getTitle(a: TrendingItem) {
  return a.title?.english || a.title?.romaji || "Untitled";
}

/* ─── Scroll-triggered reveal (fade + slide up), framer-motion whileInView ─── */
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

/* ─── Section eyebrow + heading ─── */
function SectionHeading({ eyebrow, title, sub }: { eyebrow: string; title: string; sub?: string }) {
  return (
    <Reveal className="flex flex-col gap-3 mb-10 md:mb-14 max-w-2xl">
      <span className="ltv-cine-eyebrow text-xs font-bold uppercase">{eyebrow}</span>
      <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-white leading-[1.1]" style={{ fontFamily: FONT }}>
        {title}
      </h2>
      {sub && <p className="text-[#8fa3c4] text-base leading-relaxed">{sub}</p>}
    </Reveal>
  );
}

/* ─── Cinematic poster card ─── */
function PosterCard({ item, index, showProgress }: { item: TrendingItem; index: number; showProgress?: boolean }) {
  const navigate = useAppStore(s => s.navigate);
  const title = getTitle(item);
  const img = item.coverImage?.extraLarge || item.coverImage?.large || "";
  // Deterministic fake progress for the "Continue Watching" marketing preview
  const progress = showProgress ? 20 + ((item.id * 37) % 65) : 0;

  return (
    <motion.button
      onClick={() => navigate({ page: "anime", id: String(item.id) })}
      className="ltv-cine-poster shrink-0 w-[160px] sm:w-[190px] md:w-[210px] rounded-xl bg-[#0a1428] text-left"
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.55, delay: index * 0.06, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="relative w-full aspect-[2/3] overflow-hidden rounded-t-xl bg-[#0d1a33]">
        {img ? (
          <img src={img} alt={title} className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-[#48A6FF]/25 font-black text-4xl">{title.charAt(0)}</div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent" />

        {/* Rating badge */}
        {!!item.averageScore && (
          <span className="absolute top-2 left-2 flex items-center gap-1 px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-[2px] text-[11px] font-bold text-white">
            <svg className="w-3 h-3" fill="#48A6FF" viewBox="0 0 24 24"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>
            {item.averageScore}%
          </span>
        )}
        {/* Episode badge */}
        {!!item.episodes && (
          <span className="absolute top-2 right-2 px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-[2px] text-[10px] font-bold text-[#DCE6F7]">
            {item.episodes} EP
          </span>
        )}

        {showProgress && (
          <div className="absolute left-0 right-0 bottom-0 h-[3px] bg-white/10">
            <div className="h-full bg-gradient-to-r from-[#1E88FF] to-[#48A6FF]" style={{ width: `${progress}%` }} />
          </div>
        )}
      </div>
      <div className="p-2.5">
        <p className="text-[13px] font-semibold text-white line-clamp-1">{title}</p>
        {item.genres?.length ? (
          <p className="text-[11px] text-[#6f84a8] line-clamp-1 mt-0.5">{item.genres.slice(0, 2).join(" · ")}</p>
        ) : null}
      </div>
    </motion.button>
  );
}

/* ─── Horizontal shelf with arrow controls ─── */
function Shelf({ items, showProgress }: { items: TrendingItem[]; showProgress?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const scroll = (dir: 1 | -1) => ref.current?.scrollBy({ left: dir * 620, behavior: "smooth" });

  if (!items.length) return null;

  return (
    <div className="relative group/shelf">
      <div ref={ref} className="ltv-cine-shelf flex gap-4 overflow-x-auto pb-2 -mx-1 px-1">
        {items.map((it, i) => <PosterCard key={it.id} item={it} index={i} showProgress={showProgress} />)}
      </div>
      <button
        onClick={() => scroll(-1)}
        aria-label="Scroll left"
        className="hidden md:flex absolute -left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-[#0a1428] border border-[#1E88FF]/25 items-center justify-center text-white/70 hover:text-white hover:border-[#48A6FF]/60 opacity-0 group-hover/shelf:opacity-100 transition-all"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path d="M15 19l-7-7 7-7" /></svg>
      </button>
      <button
        onClick={() => scroll(1)}
        aria-label="Scroll right"
        className="hidden md:flex absolute -right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-[#0a1428] border border-[#1E88FF]/25 items-center justify-center text-white/70 hover:text-white hover:border-[#48A6FF]/60 opacity-0 group-hover/shelf:opacity-100 transition-all"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path d="M9 5l7 7-7 7" /></svg>
      </button>
    </div>
  );
}

/* ─── Stat counter ─── */
function Stat({ value, label, suffix = "" }: { value: number; label: string; suffix?: string }) {
  const [inView, setInView] = useState(false);
  const count = useCountUp(value, 1800, inView);
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      onViewportEnter={() => setInView(true)}
      transition={{ duration: 0.6 }}
      className="flex flex-col items-center sm:items-start gap-1"
    >
      <span className="text-3xl sm:text-4xl font-black text-white" style={{ fontFamily: FONT }}>
        {count.toLocaleString()}{suffix}
      </span>
      <span className="text-xs uppercase tracking-wider text-[#6f84a8] font-bold">{label}</span>
    </motion.div>
  );
}

/* ─── Feature panel (bento-style, not a generic card) ─── */
function FeaturePanel({ icon, title, desc, big, index }: { icon: React.ReactNode; title: string; desc: string; big?: boolean; index: number }) {
  return (
    <Reveal delay={index * 0.08} className={big ? "sm:col-span-2 sm:row-span-1" : ""}>
      <div className="ltv-cine-surface rounded-2xl h-full p-6 sm:p-8 flex flex-col gap-4 overflow-hidden relative">
        <div
          className="absolute -top-10 -right-10 w-40 h-40 rounded-full opacity-0 group-hover:opacity-100 blur-3xl transition-opacity"
          style={{ background: "#1E88FF" }}
        />
        <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ background: "rgba(30,136,255,0.12)", color: "#48A6FF" }}>
          {icon}
        </div>
        <div className="relative">
          <h3 className={`font-bold text-white ${big ? "text-2xl" : "text-lg"}`}>{title}</h3>
          <p className="text-sm text-[#8fa3c4] mt-1.5 leading-relaxed">{desc}</p>
        </div>
      </div>
    </Reveal>
  );
}

export default function LandingPage() {
  const navigate = useAppStore(s => s.navigate);
  const [scrolled, setScrolled] = useState(false);
  const [trending, setTrending] = useState<TrendingItem[]>([]);
  const [upcoming, setUpcoming] = useState<TrendingItem[]>([]);
  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const heroY = useTransform(scrollYProgress, [0, 1], ["0%", "28%"]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.8], [1, 0]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/anime/anilist-trending?section=trending");
        if (!res.ok || cancelled) return;
        const data = await res.json();
        const trend: TrendingItem[] = data.trending || data.all || data.media || [];
        if (cancelled) return;
        setTrending(trend.slice(0, 14));
        const soon = trend.filter(a => a.status === "NOT_YET_RELEASED" || a.status === "RELEASING").slice(0, 10);
        setUpcoming(soon.length ? soon : trend.slice(0, 10));
      } catch { /* fine — sections just render empty */ }
    })();
    return () => { cancelled = true; };
  }, []);

  const navLinks: { label: string; onClick: () => void }[] = [
    { label: "Anime", onClick: () => navigate({ page: "home" }) },
    { label: "Movies", onClick: () => navigate({ page: "movies" }) },
    { label: "Live TV", onClick: () => navigate({ page: "live" }) },
    { label: "Guide", onClick: () => navigate({ page: "guide" }) },
    { label: "Contact", onClick: () => navigate({ page: "contact" }) },
  ];

  const featurePanels = [
    { icon: <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6}><rect x="2" y="3" width="20" height="14" rx="2" /><path d="M8 21h8M12 17v4" /></svg>, title: "Every format, one library", desc: "Anime, movies, TV shows, live sports and TV, manga and light novels — indexed and searchable from a single home.", big: true },
    { icon: <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6}><path d="M13 2 3 14h7l-1 8 11-14h-7l1-6z" /></svg>, title: "Built for speed", desc: "Sources race in parallel — the fastest working stream wins, automatically." },
    { icon: <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" /></svg>, title: "Never lose your spot", desc: "Progress and bookmarks follow you across every section automatically." },
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

  return (
    <div className="ltv-cine-root w-full text-white overflow-x-hidden" style={{ fontFamily: "var(--font-inter), Inter, sans-serif" }}>
      <CinematicBackdrop />

      {/* ═══ NAV ═══ */}
      <header className={`fixed top-0 left-0 right-0 z-40 transition-all duration-500 ${scrolled ? "bg-[#030712]/85 backdrop-blur-md border-b border-[#1E88FF]/10" : "bg-transparent"}`}>
        <div className="max-w-7xl mx-auto px-6 lg:px-10 h-16 flex items-center justify-between">
          <button onClick={() => navigate({ page: "landing" })} className="text-lg font-bold shrink-0" style={{ fontFamily: FONT }}>
            LUFFY <span style={{ color: "#48A6FF" }}>TV</span>
          </button>
          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-[#8fa3c4]">
            {navLinks.map(l => (
              <button key={l.label} onClick={l.onClick} className="hover:text-white transition-colors">{l.label}</button>
            ))}
          </nav>
          <button
            onClick={() => navigate({ page: "hub" })}
            className="ltv-cine-btn-primary px-4 sm:px-5 py-2 rounded-full text-xs sm:text-sm font-bold shrink-0"
          >
            Start Watching
          </button>
        </div>
      </header>

      {/* ═══ HERO ═══ */}
      <section ref={heroRef} className="relative w-full min-h-[100svh] flex items-center overflow-hidden">
        <motion.div style={{ y: heroY, opacity: heroOpacity }} className="absolute inset-0">
          <div
            className="absolute inset-0 opacity-45"
            style={{
              backgroundImage: "url(/hero-bg-art.png)",
              backgroundSize: "cover",
              backgroundPosition: "center 30%",
              filter: "saturate(0.7) brightness(0.75)",
            }}
          />
          <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(3,7,18,0.4) 0%, rgba(3,7,18,0.75) 55%, #030712 100%)" }} />
        </motion.div>

        {/* Ambient glow orbs behind copy */}
        <div className="ltv-cine-glow-orb w-[500px] h-[500px] left-[-10%] top-[10%]" style={{ background: "rgba(30,136,255,0.35)" }} />
        <div className="ltv-cine-glow-orb w-[420px] h-[420px] right-[-8%] bottom-[5%]" style={{ background: "rgba(72,166,255,0.25)", animationDelay: "2s" }} />

        <div className="relative z-10 max-w-6xl mx-auto px-6 lg:px-10 w-full pt-24 pb-16">
          <motion.span
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="ltv-cine-eyebrow inline-block text-xs font-bold uppercase px-3 py-1.5 rounded-full border border-[#1E88FF]/25 bg-[#1E88FF]/[0.06] mb-6"
          >
            Anime · Movies · TV · Live Sports
          </motion.span>

          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="ltv-cine-gradient-text text-[13vw] sm:text-6xl md:text-7xl lg:text-[5.5rem] font-black leading-[0.98] tracking-tight max-w-4xl"
            style={{ fontFamily: FONT }}
          >
            Watch anime<br />without limits.
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="text-[#a9bcdc] text-base sm:text-lg max-w-xl mt-6 leading-relaxed"
          >
            Every story, streamed. Anime, movies, TV, manga, and live sports —
            one platform, zero clutter, completely free.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.55 }}
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
              onClick={() => navigate({ page: "guide" })}
              className="ltv-cine-btn-secondary inline-flex items-center gap-2 px-6 py-3.5 rounded-full font-bold text-sm"
            >
              How It Works
            </button>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.75 }}
            className="flex items-center gap-8 sm:gap-12 mt-14 flex-wrap"
          >
            <Stat value={12000} suffix="+" label="Anime Titles" />
            <Stat value={480000} suffix="+" label="Episodes" />
            <Stat value={50000} suffix="+" label="Monthly Viewers" />
          </motion.div>
        </div>

        {/* Scroll cue */}
        <motion.div
          className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-[#6f84a8]"
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        >
          <span className="text-[10px] font-bold uppercase tracking-widest">Scroll</span>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M12 5v14M5 12l7 7 7-7" /></svg>
        </motion.div>
      </section>

      {/* ═══ TRENDING PREVIEW ═══ */}
      {trending.length > 0 && (
        <section className="relative z-10 py-16 sm:py-24 px-6 lg:px-10">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-end justify-between gap-4 flex-wrap mb-2">
              <SectionHeading eyebrow="Trending Right Now" title="What everyone's watching" />
              <Reveal>
                <button onClick={() => navigate({ page: "home" })} className="text-sm font-bold text-[#48A6FF] hover:text-white transition-colors mb-14 hidden sm:inline-flex items-center gap-1">
                  See all
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
                </button>
              </Reveal>
            </div>
            <Shelf items={trending} />
          </div>
        </section>
      )}

      {/* ═══ WHY CHOOSE US — bento feature panels ═══ */}
      <section className="relative z-10 py-16 sm:py-24 px-6 lg:px-10">
        <div className="max-w-7xl mx-auto">
          <SectionHeading eyebrow="Why LuffyTV" title="Built like a premium platform. Priced like it's free." sub="Every feature exists because it was actually needed — not because it looked good in a deck." />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {featurePanels.map((f, i) => (
              <FeaturePanel key={f.title} icon={f.icon} title={f.title} desc={f.desc} big={f.big} index={i} />
            ))}
          </div>
        </div>
      </section>

      {/* ═══ CONTINUE WATCHING PREVIEW ═══ */}
      {trending.length > 0 && (
        <section className="relative z-10 py-16 sm:py-24 px-6 lg:px-10">
          <div className="max-w-7xl mx-auto">
            <SectionHeading eyebrow="Pick Up Instantly" title="Continue right where you left off" sub="Your progress is saved automatically — every episode, every device." />
            <Shelf items={[...trending].reverse().slice(0, 10)} showProgress />
          </div>
        </section>
      )}

      {/* ═══ UPCOMING ANIME — timeline ═══ */}
      {upcoming.length > 0 && (
        <section className="relative z-10 py-16 sm:py-24 px-6 lg:px-10">
          <div className="max-w-7xl mx-auto">
            <SectionHeading eyebrow="Coming Soon" title="Upcoming & currently airing" />
            <div className="relative">
              <div className="ltv-cine-divider absolute left-0 right-0 top-[86px] hidden md:block" />
              <div className="ltv-cine-shelf flex gap-5 overflow-x-auto pb-2">
                {upcoming.map((item, i) => (
                  <Reveal key={item.id} delay={i * 0.05} className="shrink-0 w-[150px]">
                    <div className="flex flex-col items-center gap-3">
                      <span className="hidden md:flex w-3 h-3 rounded-full shrink-0" style={{ background: "#1E88FF", boxShadow: "0 0 14px 3px rgba(30,136,255,0.6)" }} />
                      <div className="ltv-cine-poster w-full rounded-lg overflow-hidden aspect-[2/3] bg-[#0a1428] relative">
                        {(item.coverImage?.extraLarge || item.coverImage?.large) ? (
                          <img src={item.coverImage?.extraLarge || item.coverImage?.large} alt={getTitle(item)} className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center text-[#48A6FF]/25 font-black text-2xl">{getTitle(item).charAt(0)}</div>
                        )}
                        {item.status === "RELEASING" && (
                          <span className="absolute top-2 left-2 flex items-center gap-1 px-2 py-0.5 rounded-md bg-black/70 text-[9px] font-bold text-white uppercase">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#48A6FF] animate-pulse" /> Airing
                          </span>
                        )}
                      </div>
                      <p className="text-xs font-semibold text-white text-center line-clamp-2">{getTitle(item)}</p>
                    </div>
                  </Reveal>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ═══ FEATURES GRID (compact) ═══ */}
      <section className="relative z-10 py-16 sm:py-20 px-6 lg:px-10">
        <div className="max-w-5xl mx-auto">
          <SectionHeading eyebrow="Everything Included" title="No paywalls. No tiers. No catch." />
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
            {smallFeatures.map((f, i) => (
              <Reveal key={f.label} delay={i * 0.05}>
                <div className="ltv-cine-surface rounded-xl px-4 py-5 flex flex-col items-center gap-2 text-center h-full">
                  <span className="text-2xl">{f.icon}</span>
                  <span className="text-xs font-bold text-[#dce6f7]">{f.label}</span>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ COMMUNITY ═══ */}
      <section className="relative z-10 py-16 sm:py-24 px-6 lg:px-10">
        <Reveal className="max-w-5xl mx-auto">
          <div className="ltv-cine-surface rounded-3xl p-10 sm:p-16 flex flex-col items-center text-center gap-6 relative overflow-hidden">
            <div className="ltv-cine-glow-orb w-[300px] h-[300px] left-1/2 -translate-x-1/2 -top-24" style={{ background: "rgba(30,136,255,0.3)" }} />
            <span className="ltv-cine-eyebrow text-xs font-bold uppercase relative">Join the Community</span>
            <h2 className="text-2xl sm:text-4xl font-black relative" style={{ fontFamily: FONT }}>50,000+ fans already watching</h2>
            <p className="text-[#8fa3c4] max-w-md relative">Get release alerts, request titles, and talk anime with people who actually watch it.</p>
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
      <footer className="relative z-10 border-t border-[#1E88FF]/10 py-14 px-6 lg:px-10">
        <div className="max-w-7xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-8 mb-10">
          <div className="col-span-2 sm:col-span-1">
            <span className="text-lg font-bold" style={{ fontFamily: FONT }}>LUFFY <span style={{ color: "#48A6FF" }}>TV</span></span>
            <p className="text-xs text-[#6f84a8] mt-3 leading-relaxed max-w-[220px]">Free anime, movies, TV, and live sports streaming — no ads, no limits.</p>
          </div>
          <div className="flex flex-col gap-2.5">
            <span className="text-xs font-bold uppercase tracking-wider text-white mb-1">Browse</span>
            <button onClick={() => navigate({ page: "home" })} className="text-sm text-[#8fa3c4] hover:text-white transition-colors text-left">Anime</button>
            <button onClick={() => navigate({ page: "movies" })} className="text-sm text-[#8fa3c4] hover:text-white transition-colors text-left">Movies</button>
            <button onClick={() => navigate({ page: "tv" })} className="text-sm text-[#8fa3c4] hover:text-white transition-colors text-left">TV Shows</button>
            <button onClick={() => navigate({ page: "live" })} className="text-sm text-[#8fa3c4] hover:text-white transition-colors text-left">Live TV</button>
          </div>
          <div className="flex flex-col gap-2.5">
            <span className="text-xs font-bold uppercase tracking-wider text-white mb-1">Company</span>
            <button onClick={() => navigate({ page: "guide" })} className="text-sm text-[#8fa3c4] hover:text-white transition-colors text-left">Guide</button>
            <button onClick={() => navigate({ page: "contact" })} className="text-sm text-[#8fa3c4] hover:text-white transition-colors text-left">Contact</button>
          </div>
          <div className="flex flex-col gap-2.5">
            <span className="text-xs font-bold uppercase tracking-wider text-white mb-1">Connect</span>
            <a href="https://discord.gg/Svc9yFjQBq" target="_blank" rel="noopener noreferrer" className="text-sm text-[#8fa3c4] hover:text-white transition-colors">Discord</a>
          </div>
        </div>
        <div className="ltv-cine-divider max-w-7xl mx-auto mb-6" />
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <p className="text-[11px] text-[#4d5f80]">&copy; {new Date().getFullYear()} Luffy TV — Powered by TMDB &amp; AniList</p>
          <p className="text-[11px] text-[#4d5f80]">Fan-made project. Not affiliated with any studio.</p>
        </div>
      </footer>
    </div>
  );
}
