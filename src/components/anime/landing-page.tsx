"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence, useScroll, useSpring, useTransform, useMotionValue, useMotionTemplate } from "framer-motion";
import { useAppStore } from "./store";
import CinematicBackdrop from "./cinematic-backdrop";
import { useCountUp } from "@/hooks/use-count-up";
import { proxifyMangaImage } from "@/lib/proxy";

const FONT = "var(--font-space-grotesk), 'Space Grotesk', sans-serif";
const ACCENT = "#48A6FF";   // anime — blue
const MANGA = "#F472B6";    // manga — pink
const NOVEL = "#34D399";    // novels — emerald

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

/* ─── Manga items for the manga showcase (real covers from /api/manga/home) ─── */
interface MangaItem {
  id: string;
  title: string;
  poster?: string;
  posterMedium?: string;
  posterSmall?: string;
  cover?: string;
}
const mangaCover = (m: MangaItem) => proxifyMangaImage(m.posterMedium || m.poster || m.posterSmall || m.cover || "");

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

function SectionHeading({ eyebrow, title, sub, chapter, accent = ACCENT }: { eyebrow: string; title: string; sub?: string; chapter?: string; accent?: string }) {
  return (
    <Reveal className="flex flex-col gap-3 mb-10 md:mb-12 max-w-2xl">
      <div className="flex items-baseline gap-4">
        {chapter && (
          <span
            className="text-4xl sm:text-5xl font-black leading-none select-none shrink-0"
            style={{ fontFamily: FONT, color: "transparent", WebkitTextStroke: `1.5px ${accent}59` }}
            aria-hidden="true"
          >
            {chapter}
          </span>
        )}
        <span className="text-xs font-bold uppercase tracking-[0.24em]" style={{ color: accent, fontFamily: FONT }}>{eyebrow}</span>
      </div>
      <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-white leading-[1.08]" style={{ fontFamily: FONT }}>
        {title}
      </h2>
      {sub && <p className="text-[#a1a7b3] text-base leading-relaxed">{sub}</p>}
    </Reveal>
  );
}

/* ─── Fixed top progress bar — fills as the page (the "reel") plays out ─── */
function ScrollProgressBar() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 200, damping: 40, mass: 0.2 });
  return (
    <motion.div
      className="fixed top-0 left-0 right-0 z-[60] h-[2px] origin-left"
      style={{ scaleX, background: `linear-gradient(90deg, ${ACCENT}, ${MANGA}, ${NOVEL})` }}
    />
  );
}

/* ─── Chapter markers — the "reel" this page plays through ─── */
const CHAPTERS = [
  { id: "hero", num: "00", label: "Intro" },
  { id: "worlds", num: "01", label: "Worlds" },
  { id: "anime", num: "02", label: "Anime" },
  { id: "manga", num: "03", label: "Manga" },
  { id: "novels", num: "04", label: "Novels" },
  { id: "experience", num: "05", label: "Experience" },
  { id: "join", num: "06", label: "Join" },
] as const;

/* ─── Fixed left rail — desktop only, click to jump chapters ─── */
function ChapterRail({ active, onSelect }: { active: string; onSelect: (id: string) => void }) {
  return (
    <div className="hidden xl:flex fixed left-6 top-1/2 -translate-y-1/2 z-40 flex-col items-center gap-5">
      {CHAPTERS.map(c => {
        const isActive = c.id === active;
        return (
          <button
            key={c.id}
            onClick={() => onSelect(c.id)}
            className="group relative flex items-center"
            aria-label={`Jump to ${c.label}`}
          >
            <span
              className="w-2 h-2 rounded-full transition-all duration-300"
              style={{
                background: isActive ? "#48a6ff" : "rgba(255,255,255,0.18)",
                boxShadow: isActive ? "0 0 10px 2px rgba(72,166,255,0.6)" : "none",
                transform: isActive ? "scale(1.6)" : "scale(1)",
              }}
            />
            <span
              className="absolute left-5 whitespace-nowrap text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md bg-[#0b0d12] border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
              style={{ color: isActive ? "#48a6ff" : "#a1a7b3" }}
            >
              {c.num} — {c.label}
            </span>
          </button>
        );
      })}
    </div>
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
function PosterTile({ item, className = "", width = "w-[120px]", badge, badgeColor }: { item?: TrendingItem; className?: string; width?: string; badge?: string; badgeColor?: string }) {
  const img = item ? getCover(item) : "";
  return (
    <div className={`ltv-shine relative ${width} aspect-[2/3] rounded-xl overflow-hidden bg-[#0b0d12] ring-1 ring-white/10 shrink-0 ${className}`}>
      {img ? (
        <img src={img} alt={item ? getTitle(item) : ""} className="w-full h-full object-cover" loading="lazy" />
      ) : (
        <div className="w-full h-full bg-gradient-to-br from-[#10131a] to-[#0b0d12]" />
      )}
      {badge && (
        <span className="absolute top-2 left-2 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full text-black" style={{ backgroundColor: badgeColor || ACCENT, fontFamily: FONT }}>
          {badge}
        </span>
      )}
    </div>
  );
}

/* ─── Hero banner backdrop — real anime banner art, slow ken-burns crossfade ─── */
function HeroBanners({ items }: { items: TrendingItem[] }) {
  const banners = items.filter(t => t.bannerImage).slice(0, 6);
  const [i, setI] = useState(0);
  useEffect(() => {
    if (banners.length < 2) return;
    const t = setInterval(() => setI(v => (v + 1) % banners.length), 9000);
    return () => clearInterval(t);
  }, [banners.length]);
  if (banners.length === 0) return null;
  const b = banners[i];
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      <AnimatePresence>
        <motion.img
          key={b.id}
          src={b.bannerImage}
          alt=""
          initial={{ opacity: 0, scale: 1.06 }}
          animate={{ opacity: 0.16, scale: 1.14 }}
          exit={{ opacity: 0 }}
          transition={{ opacity: { duration: 2.2 }, scale: { duration: 11, ease: "linear" } }}
          className="absolute inset-0 w-full h-full object-cover blur-[6px]"
        />
      </AnimatePresence>
      {/* Fade the art into the page's black so content stays readable */}
      <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(5,6,8,0.55) 0%, rgba(5,6,8,0.35) 40%, #050608 96%)" }} />
      <div className="absolute inset-0" style={{ background: "radial-gradient(90% 60% at 50% 100%, rgba(5,6,8,0.9), transparent 70%)" }} />
    </div>
  );
}

/* ─── Rotating "mood" — cycles genres, click jumps into search ─── */
const MOODS = ["Isekai", "Dark Fantasy", "Romance", "Shounen", "Sci-Fi", "Slice of Life", "Psychological", "Sports"];
function RotatingMood({ onPick }: { onPick: (m: string) => void }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI(v => (v + 1) % MOODS.length), 2200);
    return () => clearInterval(t);
  }, []);
  return (
    <button
      onClick={() => onPick(MOODS[i])}
      className="group inline-flex items-baseline gap-2 mt-4 text-sm text-[#8b93a1] hover:text-white transition-colors"
      title={`Search ${MOODS[i]}`}
    >
      <span>Tonight feels like</span>
      <span className="relative inline-flex overflow-hidden h-[1.45em] items-baseline">
        <AnimatePresence mode="wait">
          <motion.span
            key={MOODS[i]}
            initial={{ y: "110%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "-110%", opacity: 0 }}
            transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
            className="inline-block font-black underline decoration-2 underline-offset-4"
            style={{ color: ACCENT, fontFamily: FONT, textDecorationColor: `${ACCENT}66` }}
          >
            {MOODS[i]}
          </motion.span>
        </AnimatePresence>
      </span>
      <svg className="w-3 h-3 self-center opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
    </button>
  );
}

/* ─── Worlds switcher — three expanding doors (anime/manga/novels) ─── */
function WorldsSwitcher({ animeImg, mangaImg, onGo }: { animeImg: string; mangaImg: string; onGo: (page: "home" | "manga" | "novel") => void }) {
  const [active, setActive] = useState(0);
  const worlds = [
    {
      title: "Anime", color: ACCENT, img: animeImg, page: "home" as const, cta: "Start watching",
      desc: "12,000+ series in HD — sub & dub.",
      bullets: ["HD & 4K streaming", "Sub · Dub", "Auto-resume every episode"],
    },
    {
      title: "Manga", color: MANGA, img: mangaImg, page: "manga" as const, cta: "Start reading",
      desc: "70,000+ titles, updated daily.",
      bullets: ["Vertical & paged reader", "New chapters daily", "One-tap My List"],
    },
    {
      title: "Novels", color: NOVEL, img: "", page: "novel" as const, cta: "Open a book",
      desc: "The source material, beautifully set.",
      bullets: ["Serif reading mode", "Chapter-by-chapter nav", "Progress synced to profile"],
    },
  ];
  return (
    <div className="flex flex-col lg:flex-row gap-4 lg:h-[430px]">
      {worlds.map((w, i) => {
        const on = active === i;
        return (
          <motion.button
            key={w.title}
            onMouseEnter={() => setActive(i)}
            onFocus={() => setActive(i)}
            onClick={() => onGo(w.page)}
            animate={{ flexGrow: on ? 2.6 : 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 28 }}
            className="ltv-shine relative overflow-hidden rounded-3xl border text-left h-[200px] sm:h-[230px] lg:h-auto lg:basis-0 transition-colors duration-300"
            style={{ borderColor: on ? `${w.color}59` : "rgba(255,255,255,0.07)", flexGrow: 1 }}
          >
            {w.img ? (
              <img src={w.img} alt="" className={`absolute inset-0 w-full h-full object-cover transition-all duration-700 ${on ? "opacity-45 scale-105 grayscale-0" : "opacity-25 grayscale"}`} loading="lazy" />
            ) : (
              <div className="absolute inset-0 bg-[#0c1117]">
                <div className="absolute inset-0" style={{ background: `radial-gradient(120% 90% at 50% 110%, ${w.color}1f, transparent 60%)` }} />
                <span className="absolute top-6 right-6 text-4xl opacity-60" aria-hidden="true">📖</span>
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/25 to-transparent" />
            <div className="absolute inset-0 pointer-events-none transition-opacity duration-500" style={{ background: `radial-gradient(120% 100% at 50% 120%, ${w.color}30, transparent 60%)`, opacity: on ? 1 : 0 }} />

            <div className="relative z-10 h-full flex flex-col justify-end p-6 sm:p-7">
              <span className="w-9 h-1 rounded-full mb-3 transition-all duration-500" style={{ background: w.color, width: on ? 44 : 24 }} />
              <h3 className="text-2xl sm:text-3xl font-black text-white" style={{ fontFamily: FONT }}>{w.title}</h3>
              <p className="text-[13px] text-[#c4c9d2] mt-1">{w.desc}</p>
              <motion.div
                animate={{ height: on ? "auto" : 0, opacity: on ? 1 : 0 }}
                transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                className="overflow-hidden hidden lg:block"
              >
                <ul className="flex flex-col gap-1.5 mt-4">
                  {w.bullets.map(b => (
                    <li key={b} className="flex items-center gap-2 text-[12px] text-[#c4c9d2]">
                      <svg className="w-3 h-3 shrink-0" style={{ color: w.color }} fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" /></svg>
                      {b}
                    </li>
                  ))}
                </ul>
                <span className="inline-flex items-center gap-2 mt-5 px-5 py-2.5 rounded-full text-xs font-bold text-black" style={{ background: w.color }}>
                  {w.cta}
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
                </span>
              </motion.div>
              {/* Mobile: always show the CTA chip */}
              <span className="lg:hidden inline-flex items-center gap-2 mt-4 px-4 py-2 rounded-full text-xs font-bold text-black w-fit" style={{ background: w.color }}>
                {w.cta}
                <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
              </span>
            </div>
          </motion.button>
        );
      })}
    </div>
  );
}

export default function LandingPage() {
  const navigate = useAppStore(s => s.navigate);
  const [trending, setTrending] = useState<TrendingItem[]>([]);
  const [manga, setManga] = useState<MangaItem[]>([]);
  const shelfRef = useRef<HTMLDivElement>(null);
  const mangaShelfRef = useRef<HTMLDivElement>(null);

  // ── Chapter tracking: which section is in view drives the rail dot + label ──
  const [activeChapter, setActiveChapter] = useState<string>("hero");
  const chapterRefs = useRef<Record<string, HTMLElement | null>>({});
  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        const visible = entries.filter(e => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]) setActiveChapter(visible[0].target.id);
      },
      { rootMargin: "-40% 0px -40% 0px", threshold: [0, 0.25, 0.5, 0.75, 1] }
    );
    Object.values(chapterRefs.current).forEach(el => el && observer.observe(el));
    return () => observer.disconnect();
  }, [trending.length, manga.length]);

  const jumpToChapter = useCallback((id: string) => {
    chapterRefs.current[id]?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  // ── Hero mouse-parallax: pointer position drives poster-stack tilt/drift ──
  const pointerX = useMotionValue(0);
  const pointerY = useMotionValue(0);
  const springX = useSpring(pointerX, { stiffness: 60, damping: 18, mass: 0.4 });
  const springY = useSpring(pointerY, { stiffness: 60, damping: 18, mass: 0.4 });
  const heroTiltX = useTransform(springY, [-0.5, 0.5], [6, -6]);
  const heroTiltY = useTransform(springX, [-0.5, 0.5], [-8, 8]);
  // Cursor spotlight — a soft light that follows the mouse across the hero
  const spotX = useMotionValue(-800);
  const spotY = useMotionValue(-800);
  const spotlight = useMotionTemplate`radial-gradient(640px circle at ${spotX}px ${spotY}px, rgba(72,166,255,0.09), transparent 70%)`;
  const handleHeroPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    pointerX.set((e.clientX - rect.left) / rect.width - 0.5);
    pointerY.set((e.clientY - rect.top) / rect.height - 0.5);
    spotX.set(e.clientX - rect.left);
    spotY.set(e.clientY - rect.top);
  };
  // Top-10 hover backdrop — the hovered cover glows blurred behind the rail
  const [rankBg, setRankBg] = useState("");
  // Depth layers — the front-most poster drifts the most, back layers barely move
  const driftFront1X = useTransform(springX, [-0.5, 0.5], [-26, 26]);
  const driftFront1Y = useTransform(springY, [-0.5, 0.5], [-18, 18]);
  const driftFront2X = useTransform(springX, [-0.5, 0.5], [18, -18]);
  const driftFront2Y = useTransform(springY, [-0.5, 0.5], [14, -14]);
  const driftMidX = useTransform(springX, [-0.5, 0.5], [-12, 12]);
  const driftMidY = useTransform(springY, [-0.5, 0.5], [10, -10]);
  const driftBackX = useTransform(springX, [-0.5, 0.5], [8, -8]);
  const driftBackY = useTransform(springY, [-0.5, 0.5], [-6, 6]);

  // ── Section-scroll parallax for background glow orbs (depth vs. content) ──
  const heroSectionRef = useRef<HTMLElement>(null);
  const { scrollYProgress: heroScrollProgress } = useScroll({ target: heroSectionRef, offset: ["start start", "end start"] });
  const heroGlowY = useTransform(heroScrollProgress, [0, 1], [0, 160]);
  const heroContentY = useTransform(heroScrollProgress, [0, 1], [0, -60]);
  const heroContentOpacity = useTransform(heroScrollProgress, [0, 0.8], [1, 0]);

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
    // Real manga covers for the manga showcase — the section hides gracefully
    // if the manga home feed is unavailable.
    (async () => {
      try {
        const res = await fetch("/api/manga/home");
        if (!res.ok || cancelled) return;
        const data = await res.json();
        const sections: { items?: MangaItem[] }[] = data.sections || [];
        const seen = new Set<string>();
        const flat: MangaItem[] = [];
        for (const s of sections) {
          for (const it of s.items || []) {
            if (it?.id && !seen.has(it.id) && (it.poster || it.posterMedium || it.posterSmall || it.cover)) {
              seen.add(it.id);
              flat.push(it);
            }
            if (flat.length >= 14) break;
          }
          if (flat.length >= 14) break;
        }
        if (!cancelled) setManga(flat);
      } catch { /* showcase hides without data */ }
    })();
    return () => { cancelled = true; };
  }, []);

  const navLinks = [
    { label: "Anime", onClick: () => navigate({ page: "home" }) },
    { label: "Manga", onClick: () => navigate({ page: "manga" }) },
    { label: "Novels", onClick: () => navigate({ page: "novel" }) },
    { label: "Contact", onClick: () => navigate({ page: "contact" }) },
  ];

  // Collage picks (first four trending covers)
  const collage = trending.slice(0, 4);
  const marqueeItems = trending.length ? trending : Array.from({ length: 10 }, (_, i) => ({ id: -i - 1, title: {} } as TrendingItem));

  const scrollShelf = (ref: React.RefObject<HTMLDivElement | null>, dir: 1 | -1) => ref.current?.scrollBy({ left: dir * 640, behavior: "smooth" });

  // Manga showcase picks — one spotlight cover + the rail
  const mangaSpotlight = manga[0];
  const mangaRail = manga.slice(1);

  // The app shell wraps routed pages in a div that keeps a lingering
  // `transform`/`filter` from its mount-reveal animation (present even at
  // identity values) — that creates a CSS containing block which traps any
  // `position: fixed` descendant, so it scrolls away with the page instead
  // of staying pinned to the viewport. Portal the fixed chrome straight to
  // <body> to escape that containing block entirely.
  const [portalReady, setPortalReady] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setPortalReady(true), 0);
    return () => clearTimeout(t);
  }, []);

  const fixedChrome = (
    <>
      <ScrollProgressBar />
      <ChapterRail active={activeChapter} onSelect={jumpToChapter} />

      {/* ═══ GLASSY FLOATING NAVBAR — identical visual language to the in-app
             navbar (logo left, floating glass pill center, actions right) so
             moving landing ⇄ app never feels like the navbar disappeared. ═══ */}
      <button className="ltv-nav-logo" onClick={() => navigate({ page: "landing" })} aria-label="LuffyTV">
        <img src="/logo.svg" alt="LuffyTV" className="ltv-nav-logo-icon" />
        <span>LuffyTV</span>
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
    </>
  );

  return (
    <div className="ltv-cine-root w-full text-white overflow-x-hidden" style={{ fontFamily: "var(--font-inter), Inter, sans-serif" }}>
      <CinematicBackdrop />
      <div className="ltv-land-grain" aria-hidden="true" />
      {portalReady ? createPortal(fixedChrome, document.body) : fixedChrome}

      {/* ═══ HERO — split: copy left, levitating poster collage right ═══ */}
      <section
        id="hero"
        ref={(el: HTMLElement | null) => { heroSectionRef.current = el; chapterRefs.current.hero = el; }}
        onPointerMove={handleHeroPointerMove}
        className="relative min-h-[100svh] flex flex-col justify-center overflow-hidden pt-24 pb-10"
      >
        {/* Real anime banner art breathing behind everything */}
        <HeroBanners items={trending} />
        <motion.div className="ltv-cine-glow-orb w-[560px] h-[560px] left-[-12%] top-[6%]" style={{ background: "rgba(30,136,255,0.14)", y: heroGlowY }} />
        <motion.div className="ltv-cine-glow-orb w-[420px] h-[420px] right-[-10%] bottom-[10%]" style={{ background: "rgba(244,114,182,0.07)", y: heroGlowY }} />
        {/* Cursor spotlight — follows the mouse across the whole hero */}
        <motion.div className="absolute inset-0 pointer-events-none z-[5] hidden lg:block" style={{ background: spotlight }} />

        <motion.div style={{ y: heroContentY, opacity: heroContentOpacity }} className="relative z-10 max-w-7xl mx-auto w-full px-6 lg:px-10 grid grid-cols-1 lg:grid-cols-[1.05fr_0.95fr] items-center gap-12">
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

            <h1
              className="font-black leading-[0.98] tracking-tight text-5xl sm:text-6xl xl:text-7xl"
              style={{ fontFamily: FONT }}
            >
              {[
                { t: "Watch.", cls: "ltv-land-shimmer-text", glow: "" },
                { t: "Read.", color: MANGA, glow: `0 0 44px ${MANGA}40` },
                { t: "Escape.", color: NOVEL, glow: `0 0 44px ${NOVEL}40`, newline: true },
              ].map((w, i) => (
                <span key={w.t}>
                  {w.newline && <br />}
                  <motion.span
                    className={`inline-block mr-4 ${w.cls || ""}`}
                    style={w.color ? { color: w.color, textShadow: w.glow } : undefined}
                    initial={{ opacity: 0, y: 44, rotate: 2.5, filter: "blur(10px)" }}
                    animate={{ opacity: 1, y: 0, rotate: 0, filter: "blur(0px)" }}
                    transition={{ duration: 0.75, delay: 0.15 + i * 0.16, ease: [0.22, 1, 0.36, 1] }}
                  >
                    {w.t}
                  </motion.span>
                </span>
              ))}
            </h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.32 }}
              className="text-[#c4c9d2] text-base sm:text-lg max-w-md mt-6 leading-relaxed"
            >
              Anime in HD, manga the moment it drops, and light novels in a
              reader that remembers your page. Three worlds — one door.
            </motion.p>

            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8, delay: 0.5 }}>
              <RotatingMood onPick={(m) => navigate({ page: "search", query: m })} />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.46 }}
              className="flex items-center gap-3 flex-wrap mt-9"
            >
              <motion.button
                onClick={() => navigate({ page: "home" })}
                whileHover={{ scale: 1.045, y: -2 }}
                whileTap={{ scale: 0.97 }}
                transition={{ type: "spring", stiffness: 400, damping: 17 }}
                className="ltv-cine-btn-primary inline-flex items-center gap-2 px-8 py-3.5 rounded-full font-bold text-sm"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3" /></svg>
                Watch Anime
              </motion.button>
              <motion.button
                onClick={() => navigate({ page: "manga" })}
                whileHover={{ scale: 1.04, y: -2 }}
                whileTap={{ scale: 0.97 }}
                transition={{ type: "spring", stiffness: 400, damping: 17 }}
                className="ltv-cine-btn-secondary inline-flex items-center gap-2 px-6 py-3.5 rounded-full font-bold text-sm"
              >
                Read Manga
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
              </motion.button>
              <motion.button
                onClick={() => navigate({ page: "novel" })}
                whileHover={{ scale: 1.04, y: -2 }}
                whileTap={{ scale: 0.97 }}
                transition={{ type: "spring", stiffness: 400, damping: 17 }}
                className="ltv-cine-btn-secondary inline-flex items-center gap-2 px-6 py-3.5 rounded-full font-bold text-sm"
              >
                Read Novels
              </motion.button>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8, delay: 0.62 }}
              className="flex items-center gap-8 sm:gap-10 mt-12 flex-wrap"
            >
              <Stat value={12000} suffix="+" label="Anime Titles" />
              <Stat value={70000} suffix="+" label="Manga Titles" />
              <Stat value={480000} suffix="+" label="Episodes & Chapters" />
            </motion.div>
          </div>

          {/* Levitating poster collage — hidden on small screens, tilts with the cursor for real depth */}
          <motion.div
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1, delay: 0.35, ease: [0.22, 1, 0.36, 1] }}
            style={{ rotateX: heroTiltX, rotateY: heroTiltY, transformPerspective: 1200 }}
            className="relative h-[520px] hidden lg:block"
            aria-hidden="true"
          >
            {/* Back-glow behind the stack */}
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[420px] h-[420px] rounded-full blur-[100px]" style={{ background: "rgba(30,136,255,0.10)" }} />

            <motion.div style={{ x: driftBackX, y: driftBackY }} className="absolute left-[4%] top-[16%] z-10">
              <div style={{ ["--fdur" as any]: "8s", ["--frot" as any]: "-8deg" }} className="ltv-cine-float">
                <PosterTile item={collage[1]} width="w-[190px]" className="shadow-[0_30px_60px_-15px_rgba(0,0,0,0.8)]" />
              </div>
            </motion.div>
            <motion.div style={{ x: driftFront1X, y: driftFront1Y }} className="absolute left-[34%] top-[4%] z-20">
              <div style={{ ["--fdur" as any]: "7s", ["--fdelay" as any]: "0.6s", ["--frot" as any]: "2deg" }} className="ltv-cine-float">
                <PosterTile item={collage[0]} width="w-[230px]" badge="Anime" badgeColor={ACCENT} className="shadow-[0_40px_80px_-20px_rgba(0,0,0,0.9)] ring-[#48A6FF]/30" />
              </div>
            </motion.div>
            <motion.div style={{ x: driftFront2X, y: driftFront2Y }} className="absolute right-[2%] top-[30%] z-10">
              <div style={{ ["--fdur" as any]: "9s", ["--fdelay" as any]: "1.2s", ["--frot" as any]: "9deg" }} className="ltv-cine-float">
                {mangaSpotlight ? (
                  <div className="relative w-[180px] aspect-[2/3] rounded-xl overflow-hidden bg-[#0b0d12] ring-1 ring-[#F472B6]/30 shrink-0 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.8)]">
                    <img src={mangaCover(mangaSpotlight)} alt="" className="w-full h-full object-cover" loading="lazy" />
                    <span className="absolute top-2 left-2 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full text-black" style={{ backgroundColor: MANGA, fontFamily: FONT }}>Manga</span>
                  </div>
                ) : (
                  <PosterTile item={collage[2]} width="w-[180px]" className="shadow-[0_30px_60px_-15px_rgba(0,0,0,0.8)]" />
                )}
              </div>
            </motion.div>
            <motion.div style={{ x: driftMidX, y: driftMidY }} className="absolute left-[20%] bottom-[2%] z-30">
              <div style={{ ["--fdur" as any]: "7.5s", ["--fdelay" as any]: "1.8s", ["--frot" as any]: "-3deg" }} className="ltv-cine-float">
                <PosterTile item={collage[3]} width="w-[160px]" className="shadow-[0_30px_60px_-15px_rgba(0,0,0,0.8)]" />
              </div>
            </motion.div>

            {/* Floating UI ornaments */}
            <motion.div style={{ x: driftMidX, y: driftBackY }} className="absolute right-[10%] top-[8%] z-40">
              <div style={{ ["--fdur" as any]: "6s", ["--fdelay" as any]: "0.3s" }} className="ltv-cine-float flex items-center gap-2 px-3.5 py-2 rounded-full bg-[#0b0d12] ring-1 ring-white/10 shadow-xl text-xs font-bold">
                <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: MANGA }} />
                New chapters daily
              </div>
            </motion.div>
            <motion.div style={{ x: driftBackX, y: driftMidY }} className="absolute left-[0%] bottom-[18%] z-40">
              <div style={{ ["--fdur" as any]: "6.5s", ["--fdelay" as any]: "1s" }} className="ltv-cine-float flex items-center gap-2 px-3.5 py-2 rounded-full bg-[#0b0d12] ring-1 ring-white/10 shadow-xl text-xs font-bold">
                <svg className="w-3.5 h-3.5" fill={ACCENT} viewBox="0 0 24 24"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>
                Top-rated every season
              </div>
            </motion.div>
          </motion.div>
        </motion.div>

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
          {/* Second row — manga covers drifting the opposite way */}
          {manga.length > 3 && (
            <div className="ltv-cine-marquee-track mt-3" style={{ animationDirection: "reverse" }}>
              {[...manga, ...manga].map((m, i) => (
                <button key={`${m.id}-${i}`} onClick={() => navigate({ page: "manga-detail", id: m.id })} className="focus:outline-none">
                  <div className="relative w-[110px] aspect-[2/3] rounded-xl overflow-hidden bg-[#0b0d12] ring-1 ring-white/10 shrink-0 opacity-70 hover:opacity-100 transition-opacity">
                    <img src={mangaCover(m)} alt={m.title} className="w-full h-full object-cover" loading="lazy" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </motion.div>
      </section>

      {/* ═══ 01 · WORLDS — three expanding doors ═══ */}
      <section id="worlds" ref={(el: HTMLElement | null) => { chapterRefs.current.worlds = el; }} className="relative z-10 py-16 sm:py-24 px-6 lg:px-10">
        <div className="max-w-7xl mx-auto">
          <SectionHeading
            chapter="01"
            eyebrow="Pick Your World"
            title="Three doors. One key."
            sub="Hover a world to peek inside — all of it is free."
          />
          <Reveal delay={0.1}>
            <WorldsSwitcher
              animeImg={collage[0] ? getCover(collage[0]) : ""}
              mangaImg={mangaSpotlight ? mangaCover(mangaSpotlight) : ""}
              onGo={(page) => navigate({ page })}
            />
          </Reveal>
        </div>
      </section>

      {/* ═══ 01 · ANIME — numbered Top 10 ranking rail ═══ */}
      {trending.length > 0 && (
        <section id="anime" ref={(el: HTMLElement | null) => { chapterRefs.current.anime = el; }} className="relative z-10 py-16 sm:py-24 px-6 lg:px-10 overflow-hidden">
          {/* Hovered cover glows blurred behind the whole rail */}
          <AnimatePresence>
            {rankBg && (
              <motion.img
                key={rankBg}
                src={rankBg}
                alt=""
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.13 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.7 }}
                className="absolute inset-0 w-full h-full object-cover blur-3xl scale-110 pointer-events-none"
                aria-hidden="true"
              />
            )}
          </AnimatePresence>
          <div className="ltv-cine-hairline mb-16 sm:mb-24 -mt-2 relative" />
          <div className="max-w-7xl mx-auto relative">
            <div className="flex items-end justify-between gap-4 flex-wrap">
              <SectionHeading chapter="02" eyebrow="Anime · Trending Right Now" title="Today's Top 10" />
              <Reveal>
                <div className="hidden md:flex items-center gap-2 mb-12">
                  <button onClick={() => scrollShelf(shelfRef, -1)} aria-label="Scroll left" className="w-10 h-10 rounded-full bg-[#0b0d12] border border-white/10 flex items-center justify-center text-white/70 hover:text-white hover:border-[#48A6FF]/50 transition-all">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path d="M15 19l-7-7 7-7" /></svg>
                  </button>
                  <button onClick={() => scrollShelf(shelfRef, 1)} aria-label="Scroll right" className="w-10 h-10 rounded-full bg-[#0b0d12] border border-white/10 flex items-center justify-center text-white/70 hover:text-white hover:border-[#48A6FF]/50 transition-all">
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
                  onMouseEnter={() => setRankBg(getCover(item))}
                  onMouseLeave={() => setRankBg("")}
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

            <Reveal className="mt-8">
              <button onClick={() => navigate({ page: "home" })} className="inline-flex items-center gap-2 text-sm font-bold transition-colors hover:text-white" style={{ color: ACCENT }}>
                Browse the full anime library
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
              </button>
            </Reveal>
          </div>
        </section>
      )}

      {/* ═══ 02 · MANGA — spotlight + fresh-covers rail ═══ */}
      {manga.length > 0 && (
        <section id="manga" ref={(el: HTMLElement | null) => { chapterRefs.current.manga = el; }} className="relative z-10 py-16 sm:py-24 px-6 lg:px-10 overflow-hidden">
          <div className="ltv-cine-glow-orb w-[460px] h-[460px] right-[-10%] top-[10%]" style={{ background: "rgba(244,114,182,0.08)" }} />
          <div className="max-w-7xl mx-auto relative">
            <div className="grid grid-cols-1 lg:grid-cols-[0.9fr_1.1fr] gap-12 items-center">
              {/* Copy + spotlight cover */}
              <div>
                <SectionHeading
                  chapter="03"
                  accent={MANGA}
                  eyebrow="Manga · Fresh Off The Press"
                  title="Read it the moment it drops."
                  sub="70,000+ manga, manhwa and manhua with a clean, fast chapter reader — vertical strip or paged, your call."
                />
                <Reveal delay={0.1}>
                  <div className="flex flex-col gap-3 mb-8">
                    {[
                      "Vertical & paged reading modes with zoom",
                      "Progress saved per chapter — resume from your profile",
                      "Save anything to My List with one tap",
                    ].map(f => (
                      <div key={f} className="flex items-center gap-3 text-sm text-[#c4c9d2]">
                        <span className="w-5 h-5 rounded-full flex items-center justify-center shrink-0" style={{ background: "rgba(244,114,182,0.12)" }}>
                          <svg className="w-3 h-3" style={{ color: MANGA }} fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" /></svg>
                        </span>
                        {f}
                      </div>
                    ))}
                  </div>
                </Reveal>
                <Reveal delay={0.18}>
                  <motion.button
                    onClick={() => navigate({ page: "manga" })}
                    whileHover={{ scale: 1.04, y: -2 }}
                    whileTap={{ scale: 0.97 }}
                    transition={{ type: "spring", stiffness: 400, damping: 17 }}
                    className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full font-bold text-sm text-black"
                    style={{ background: `linear-gradient(135deg, ${MANGA}, #f9a8d4)`, boxShadow: "0 10px 34px -10px rgba(244,114,182,0.55)" }}
                  >
                    Open the Manga Library
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
                  </motion.button>
                </Reveal>
              </div>

              {/* Staggered cover wall — real manga artwork */}
              <Reveal delay={0.12}>
                <div className="grid grid-cols-3 gap-3 sm:gap-4">
                  {manga.slice(0, 6).map((m, i) => (
                    <motion.button
                      key={m.id}
                      onClick={() => navigate({ page: "manga-detail", id: m.id })}
                      whileHover={{ y: -6, scale: 1.03 }}
                      transition={{ type: "spring", stiffness: 300, damping: 20 }}
                      className={`ltv-shine relative aspect-[2/3] rounded-xl overflow-hidden bg-[#0b0d12] ring-1 ring-white/10 hover:ring-[#F472B6]/50 text-left group ${i % 3 === 1 ? "mt-6 sm:mt-10" : ""}`}
                    >
                      <img src={mangaCover(m)} alt={m.title} className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                      <p className="absolute bottom-2 left-2 right-2 text-[11px] font-bold text-white line-clamp-2 leading-tight opacity-0 group-hover:opacity-100 transition-opacity">{m.title}</p>
                    </motion.button>
                  ))}
                </div>
              </Reveal>
            </div>

            {/* Full-width cover rail */}
            {mangaRail.length > 6 && (
              <div className="mt-14">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-bold uppercase tracking-[0.24em]" style={{ color: MANGA, fontFamily: FONT }}>More from the shelves</span>
                  <div className="hidden md:flex items-center gap-2">
                    <button onClick={() => scrollShelf(mangaShelfRef, -1)} aria-label="Scroll left" className="w-9 h-9 rounded-full bg-[#0b0d12] border border-white/10 flex items-center justify-center text-white/70 hover:text-white hover:border-[#F472B6]/50 transition-all">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path d="M15 19l-7-7 7-7" /></svg>
                    </button>
                    <button onClick={() => scrollShelf(mangaShelfRef, 1)} aria-label="Scroll right" className="w-9 h-9 rounded-full bg-[#0b0d12] border border-white/10 flex items-center justify-center text-white/70 hover:text-white hover:border-[#F472B6]/50 transition-all">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path d="M9 5l7 7-7 7" /></svg>
                    </button>
                  </div>
                </div>
                <div ref={mangaShelfRef} className="ltv-cine-shelf flex gap-3 overflow-x-auto pb-2">
                  {mangaRail.slice(6).map(m => (
                    <button key={m.id} onClick={() => navigate({ page: "manga-detail", id: m.id })} className="group w-[120px] shrink-0 text-left">
                      <div className="relative w-full aspect-[2/3] rounded-xl overflow-hidden bg-[#0b0d12] ring-1 ring-white/10 group-hover:ring-[#F472B6]/50 transition-all">
                        <img src={mangaCover(m)} alt={m.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
                      </div>
                      <p className="text-[11px] font-bold text-[#c4c9d2] group-hover:text-white line-clamp-1 mt-2 transition-colors">{m.title}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ═══ 03 · NOVELS — the reader experience ═══ */}
      <section id="novels" ref={(el: HTMLElement | null) => { chapterRefs.current.novels = el; }} className="relative z-10 py-16 sm:py-24 px-6 lg:px-10 overflow-hidden">
        <div className="ltv-cine-glow-orb w-[420px] h-[420px] left-[-10%] bottom-[0%]" style={{ background: "rgba(52,211,153,0.07)" }} />
        <div className="max-w-7xl mx-auto relative">
          <div className="grid grid-cols-1 lg:grid-cols-[1.05fr_0.95fr] gap-12 items-center">
            {/* Mock reader panel — a faithful miniature of the actual novel reader */}
            <Reveal className="order-2 lg:order-1">
              <div className="relative">
                <div className="absolute -inset-4 rounded-[28px] opacity-60" style={{ background: "radial-gradient(ellipse 70% 70% at 50% 50%, rgba(52,211,153,0.08), transparent 70%)" }} />
                <div className="relative rounded-3xl border border-white/[0.08] bg-[#0b0e13] overflow-hidden shadow-[0_40px_90px_-30px_rgba(0,0,0,0.9)]">
                  {/* Reader top bar */}
                  <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.06]">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-white/10" />
                      <span className="w-2.5 h-2.5 rounded-full bg-white/10" />
                    </div>
                    <span className="text-[11px] font-bold text-[#a1a7b3]" style={{ fontFamily: FONT }}>Chapter 217 · The Hero Returns</span>
                    <svg className="w-4 h-4 text-[#767d8a]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
                  </div>
                  {/* Reader body */}
                  <div className="px-6 sm:px-10 py-8 space-y-4">
                    <p className="text-[15px] leading-[1.9] text-[#d7dbe2]" style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}>
                      The gate opened without a sound. Beyond it, the city he had
                      sworn to protect glittered like a promise he had almost
                      forgotten how to keep.
                    </p>
                    <p className="text-[15px] leading-[1.9] text-[#d7dbe2]" style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}>
                      &ldquo;Ten years,&rdquo; he whispered. The words tasted like
                      ash and starlight.
                    </p>
                    <p className="text-[15px] leading-[1.9] text-[#8b93a1]" style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}>
                      Somewhere below, a bell began to ring —
                    </p>
                  </div>
                  {/* Reader bottom bar */}
                  <div className="flex items-center gap-3 px-5 py-3.5 border-t border-white/[0.06]">
                    <span className="text-[10px] font-bold text-[#767d8a] shrink-0">63%</span>
                    <div className="flex-1 h-1 rounded-full bg-white/[0.07] overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: "63%", background: NOVEL }} />
                    </div>
                    <span className="text-[10px] font-bold text-[#767d8a] shrink-0">Ch. 217 / 340</span>
                  </div>
                </div>
                {/* Floating pill */}
                <div className="absolute -top-4 -right-3 sm:-right-6 flex items-center gap-2 px-3.5 py-2 rounded-full bg-[#0b0d12] ring-1 ring-white/10 shadow-xl text-xs font-bold">
                  <svg className="w-3.5 h-3.5" style={{ color: NOVEL }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                  Picks up right where you left off
                </div>
              </div>
            </Reveal>

            {/* Copy */}
            <div className="order-1 lg:order-2">
              <SectionHeading
                chapter="04"
                accent={NOVEL}
                eyebrow="Light Novels · For The Readers"
                title="The story before the story."
                sub="Read the source material your favorite anime came from — in a distraction-free reader built for long nights."
              />
              <Reveal delay={0.1}>
                <div className="flex flex-col gap-3 mb-8">
                  {[
                    "Clean serif typography, tuned for long reading sessions",
                    "Chapter-by-chapter navigation with a live progress bar",
                    "Your page syncs to your profile — continue on any visit",
                  ].map(f => (
                    <div key={f} className="flex items-center gap-3 text-sm text-[#c4c9d2]">
                      <span className="w-5 h-5 rounded-full flex items-center justify-center shrink-0" style={{ background: "rgba(52,211,153,0.12)" }}>
                        <svg className="w-3 h-3" style={{ color: NOVEL }} fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" /></svg>
                      </span>
                      {f}
                    </div>
                  ))}
                </div>
              </Reveal>
              <Reveal delay={0.18}>
                <motion.button
                  onClick={() => navigate({ page: "novel" })}
                  whileHover={{ scale: 1.04, y: -2 }}
                  whileTap={{ scale: 0.97 }}
                  transition={{ type: "spring", stiffness: 400, damping: 17 }}
                  className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full font-bold text-sm text-black"
                  style={{ background: `linear-gradient(135deg, ${NOVEL}, #6ee7b7)`, boxShadow: "0 10px 34px -10px rgba(52,211,153,0.5)" }}
                >
                  Start Reading Novels
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
                </motion.button>
              </Reveal>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ 04 · EXPERIENCE — real shipped features, gamified profile ═══ */}
      <section id="experience" ref={(el: HTMLElement | null) => { chapterRefs.current.experience = el; }} className="relative z-10 py-16 sm:py-24 px-6 lg:px-10">
        <div className="max-w-7xl mx-auto">
          <SectionHeading
            chapter="05"
            eyebrow="One Account, Three Worlds"
            title="Built like a game."
            sub="Everything you watch and read feeds one profile — XP, levels, streaks and a heatmap of your whole journey."
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              {
                icon: <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 16.8l-6.2 4.5 2.4-7.4L2 9.4h7.6z" />,
                filled: true,
                color: ACCENT,
                title: "Level up for real",
                desc: "Every episode, chapter and page earns XP. Levels, streaks and 12 achievements — all from what you actually do.",
              },
              {
                icon: <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />,
                filled: false,
                color: MANGA,
                title: "Resume anywhere",
                desc: "Anime episode, manga chapter or novel page — one Continue button takes you back to the exact spot.",
              },
              {
                icon: <path d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />,
                filled: true,
                color: NOVEL,
                title: "One list to rule them",
                desc: "Save anime, manga and novels into a single My List that lives on your profile — sorted, synced, yours.",
              },
              {
                icon: <path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />,
                filled: false,
                color: "#a855f7",
                title: "Your year, mapped",
                desc: "A GitHub-style activity heatmap shows every day you watched or read. Keep the streak alive.",
              },
            ].map((f, i) => (
              <Reveal key={f.title} delay={i * 0.08}>
                <div className="group h-full rounded-2xl border border-white/[0.07] bg-[#0b0e13]/80 p-6 hover:border-white/[0.16] transition-colors">
                  <span className="w-11 h-11 rounded-xl flex items-center justify-center mb-5" style={{ background: `${f.color}1a` }}>
                    <svg className="w-5 h-5" style={{ color: f.color }} fill={f.filled ? f.color : "none"} stroke={f.filled ? "none" : "currentColor"} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">{f.icon}</svg>
                  </span>
                  <h3 className="text-base font-black text-white mb-2" style={{ fontFamily: FONT }}>{f.title}</h3>
                  <p className="text-[13px] text-[#a1a7b3] leading-relaxed">{f.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ 05 · FINAL CTA ═══ */}
      <section id="join" ref={(el: HTMLElement | null) => { chapterRefs.current.join = el; }} className="relative z-10 py-16 sm:py-24 px-6 lg:px-10">
        <Reveal className="max-w-5xl mx-auto">
          <div className="ltv-cta-ring">
          <div className="ltv-cine-surface rounded-3xl p-10 sm:p-16 flex flex-col items-center text-center gap-6 relative overflow-hidden" style={{ background: "#07090d" }}>
            <motion.div
              className="ltv-cine-glow-orb w-[300px] h-[300px] left-1/2 -translate-x-1/2 -top-24"
              style={{ background: "rgba(30,136,255,0.12)" }}
              animate={{ scale: [1, 1.3, 1], opacity: [0.6, 1, 0.6] }}
              transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
            />
            <span className="text-3xl font-black leading-none select-none relative" style={{ fontFamily: FONT, color: "transparent", WebkitTextStroke: "1.5px rgba(72,166,255,0.35)" }} aria-hidden="true">06</span>
            <span className="ltv-cine-eyebrow text-xs font-bold uppercase relative">No sign-up required</span>
            <h2 className="text-3xl sm:text-5xl font-black relative leading-[1.05]" style={{ fontFamily: FONT }}>Three worlds are waiting.<br />It&apos;s free.</h2>
            <p className="text-[#a1a7b3] max-w-md relative">Watch an episode, read a chapter, start a novel — no account needed until you want your progress to follow you.</p>
            <div className="flex items-center gap-3 flex-wrap justify-center relative">
              <motion.button
                onClick={() => navigate({ page: "hub" })}
                whileHover={{ scale: 1.045, y: -2 }}
                whileTap={{ scale: 0.97 }}
                transition={{ type: "spring", stiffness: 400, damping: 17 }}
                className="ltv-cine-btn-primary inline-flex items-center gap-2 px-8 py-3.5 rounded-full font-bold text-sm"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3" /></svg>
                Start Watching
              </motion.button>
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
              {["Zero ads", "HD & 4K anime", "Manga & novel reader", "Progress sync", "Sub · Dub"].map(f => (
                <span key={f} className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[#767d8a]">
                  <svg className="w-3 h-3" style={{ color: ACCENT }} fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" /></svg>
                  {f}
                </span>
              ))}
            </div>
          </div>
          </div>
        </Reveal>
      </section>

      {/* ═══ FOOTER ═══ */}
      <footer className="relative z-10 border-t border-white/[0.06] py-14 px-6 lg:px-10">
        <div className="max-w-7xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-8 mb-10">
          <div className="col-span-2 sm:col-span-1">
            <span className="text-lg font-bold" style={{ fontFamily: FONT }}>LUFFY <span style={{ color: ACCENT }}>TV</span></span>
            <p className="text-xs text-[#767d8a] mt-3 leading-relaxed max-w-[220px]">Free anime, manga &amp; light novels — no ads, no limits.</p>
          </div>
          <div className="flex flex-col gap-2.5">
            <span className="text-xs font-bold uppercase tracking-wider text-white mb-1">Browse</span>
            <button onClick={() => navigate({ page: "home" })} className="text-sm text-[#a1a7b3] hover:text-white transition-colors text-left">Anime</button>
            <button onClick={() => navigate({ page: "manga" })} className="text-sm text-[#a1a7b3] hover:text-white transition-colors text-left">Manga</button>
            <button onClick={() => navigate({ page: "novel" })} className="text-sm text-[#a1a7b3] hover:text-white transition-colors text-left">Light Novels</button>
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
          <p className="text-[11px] text-[#5b616c]">&copy; {new Date().getFullYear()} Luffy TV — Powered by AniList</p>
          <p className="text-[11px] text-[#5b616c]">Fan-made project. Not affiliated with any studio.</p>
        </div>
      </footer>
    </div>
  );
}
