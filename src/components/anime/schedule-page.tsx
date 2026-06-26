"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useAppStore } from "./store";

// ============================================================
// Types
// ============================================================

interface AiringScheduleItem {
  id: number;
  airingAt: number; // Unix timestamp
  episode: number;
  media: {
    id: number;
    title: { romaji?: string; english?: string; native?: string };
    coverImage: { extraLarge?: string; large?: string; medium?: string };
    type?: string;
    format?: string;
    episodes?: number;
  };
}

interface DayGroup {
  date: Date;
  label: string;
  shortLabel: string;
  items: AiringScheduleItem[];
}

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const ANILIST_API = "https://graphql.anilist.co";

// ============================================================
// Countdown Timer Component
// ============================================================

function CountdownTimer({ targetTime }: { targetTime: number }) {
  const [timeLeft, setTimeLeft] = useState("");
  const [urgent, setUrgent] = useState(false);

  useEffect(() => {
    const update = () => {
      const now = Math.floor(Date.now() / 1000);
      const diff = targetTime - now;

      if (diff <= 0) {
        setTimeLeft("Aired");
        setUrgent(false);
        return;
      }

      setUrgent(diff < 3600); // Less than 1 hour = urgent

      const days = Math.floor(diff / 86400);
      const hours = Math.floor((diff % 86400) / 3600);
      const minutes = Math.floor((diff % 3600) / 60);
      const seconds = diff % 60;

      if (days > 0) {
        setTimeLeft(`${days}d ${hours}h ${minutes}m`);
      } else if (hours > 0) {
        setTimeLeft(`${hours}h ${minutes}m ${seconds}s`);
      } else {
        setTimeLeft(`${minutes}m ${seconds}s`);
      }
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [targetTime]);

  return (
    <span className={`text-[10px] font-bold tabular-nums ${urgent ? "text-[#E63946] animate-pulse" : timeLeft === "Aired" ? "text-[#10B981]" : "text-[#4A90E2]"}`}>
      {timeLeft === "Aired" ? (
        <span className="flex items-center gap-1">
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
          AIRED
        </span>
      ) : (
        <span className="flex items-center gap-1">
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
          {timeLeft}
        </span>
      )}
    </span>
  );
}

// ============================================================
// Schedule Card Component
// ============================================================

function ScheduleCard({ item, index }: { item: AiringScheduleItem; index: number }) {
  const navigate = useAppStore(s => s.navigate);
  const title = item.media.title?.english || item.media.title?.romaji || item.media.title?.native || "Unknown";
  const image = item.media.coverImage?.extraLarge || item.media.coverImage?.large || item.media.coverImage?.medium || "";
  const now = Math.floor(Date.now() / 1000);
  const hasAired = item.airingAt <= now;
  const airDate = new Date(item.airingAt * 1000);
  const airTime = airDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  return (
    <div
      className="group relative flex items-center gap-3 p-3 rounded-xl bg-white/[0.025] border border-white/[0.04] hover:border-[#4A90E2]/20 hover:bg-white/[0.025]/80 transition-all duration-200 cursor-pointer"
      style={{ animationDelay: `${index * 50}ms` }}
      onClick={() => navigate({ page: "anime", id: String(item.media.id) })}
    >
      {/* Timeline dot + line */}
      <div className="flex flex-col items-center shrink-0">
        <div className={`w-2.5 h-2.5 rounded-full border-2 ${
          hasAired
            ? "bg-[#10B981] border-[#10B981] shadow-[0_0_8px_rgba(16,185,129,0.4)]"
            : "bg-[#4A90E2] border-[#4A90E2] shadow-[0_0_8px_rgba(74,144,226,0.4)] animate-pulse"
        }`} />
        <div className="w-0.5 h-8 bg-gradient-to-b from-white/[0.06] to-transparent" />
      </div>

      {/* Image */}
      <div className="shrink-0 w-12 h-16 rounded-lg overflow-hidden border border-white/[0.06] bg-[#0d0d0d]">
        {image ? (
          <img src={image} alt={title} className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <svg className="w-5 h-5 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" />
              <path d="M8 14s1.5 2 4 2 4-2 4-2" />
            </svg>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white truncate group-hover:text-[#4A90E2] transition-colors">
          {title}
        </p>
        <div className="flex items-center gap-2 mt-1">
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
            hasAired
              ? "bg-[#10B981]/10 text-[#10B981] border border-[#10B981]/20"
              : "bg-[#4A90E2]/10 text-[#4A90E2] border border-[#4A90E2]/20"
          }`}>
            EP {item.episode}
          </span>
          <span className="text-[10px] text-white/40">{airTime}</span>
          {item.media.format && (
            <span className="text-[9px] text-white/30 uppercase">{item.media.format}</span>
          )}
        </div>
      </div>

      {/* Countdown */}
      <div className="shrink-0 text-right">
        <CountdownTimer targetTime={item.airingAt} />
      </div>
    </div>
  );
}

// ============================================================
// Main Schedule Page
// ============================================================

export default function SchedulePage() {
  const navigate = useAppStore(s => s.navigate);
  const [schedule, setSchedule] = useState<AiringScheduleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeDayIdx, setActiveDayIdx] = useState<number>(0);
  const dayScrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // Fetch airing schedule from AniList
  useEffect(() => {
    async function fetchSchedule() {
      setLoading(true);
      setError(null);
      try {
        // Fetch schedule for the next 7 days
        const now = Math.floor(Date.now() / 1000);
        const weekAgo = now - 86400; // Start from yesterday
        const weekLater = now + (7 * 86400); // 7 days from now

        const query = `
          query ($page: Int, $perPage: Int, $airingAt_greater: Int, $airingAt_lesser: Int) {
            Page(page: $page, perPage: $perPage) {
              airingSchedules(
                airingAt_greater: $airingAt_greater,
                airingAt_lesser: $airingAt_lesser,
                sort: TIME
              ) {
                id airingAt episode
                media {
                  id title { romaji english native }
                  coverImage { extraLarge large medium }
                  type format episodes
                }
              }
            }
          }
        `;

        // Fetch multiple pages for more data
        const allItems: AiringScheduleItem[] = [];
        const pages = await Promise.all([
          fetch(ANILIST_API, {
            method: "POST",
            headers: { "Content-Type": "application/json", Accept: "application/json" },
            body: JSON.stringify({ query, variables: { page: 1, perPage: 50, airingAt_greater: weekAgo, airingAt_lesser: weekLater } }),
          }).then(r => r.json()),
          fetch(ANILIST_API, {
            method: "POST",
            headers: { "Content-Type": "application/json", Accept: "application/json" },
            body: JSON.stringify({ query, variables: { page: 2, perPage: 50, airingAt_greater: weekAgo, airingAt_lesser: weekLater } }),
          }).then(r => r.json()),
        ]);

        for (const page of pages) {
          if (page?.data?.Page?.airingSchedules) {
            allItems.push(...page.data.Page.airingSchedules);
          }
        }

        // Deduplicate by id
        const seen = new Set<number>();
        const unique = allItems.filter(item => {
          if (seen.has(item.id)) return false;
          seen.add(item.id);
          return true;
        });

        // Sort by airing time
        unique.sort((a, b) => a.airingAt - b.airingAt);
        setSchedule(unique);
      } catch (err: any) {
        console.error("[Schedule] Fetch error:", err);
        setError(err?.message || "Failed to load schedule");
      }
      setLoading(false);
    }
    fetchSchedule();
  }, []);

  // Group schedule items by day
  const dayGroups: DayGroup[] = useCallback(() => {
    const groups: Map<string, AiringScheduleItem[]> = new Map();
    const today = new Date();

    // Create entries for 7 days
    for (let i = -1; i <= 7; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() + i);
      const key = date.toDateString();
      if (!groups.has(key)) groups.set(key, []);
    }

    // Assign items to days
    for (const item of schedule) {
      const date = new Date(item.airingAt * 1000);
      const key = date.toDateString();
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(item);
    }

    // Convert to DayGroup array
    const result: DayGroup[] = [];
    groups.forEach((items, key) => {
      const date = new Date(key);
      const isToday = date.toDateString() === today.toDateString();
      const isTomorrow = new Date(today.getTime() + 86400000).toDateString() === key;
      result.push({
        date,
        label: isToday ? "Today" : isTomorrow ? "Tomorrow" : `${DAYS[date.getDay()]}, ${date.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`,
        shortLabel: isToday ? "Today" : isTomorrow ? "Tmrw" : `${DAYS_SHORT[date.getDay()]} ${date.getDate()}`,
        items,
      });
    });

    return result;
  }, [schedule])();

  // Find today's index and set as active
  useEffect(() => {
    if (dayGroups.length > 0) {
      const todayIdx = dayGroups.findIndex(g => g.label === "Today");
      if (todayIdx >= 0) setActiveDayIdx(todayIdx);
    }
  }, [dayGroups.length]);

  // Auto-scroll day pills to today
  useEffect(() => {
    if (dayScrollRef.current && activeDayIdx > 0) {
      const pills = dayScrollRef.current.children;
      if (pills[activeDayIdx]) {
        pills[activeDayIdx].scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
      }
    }
  }, [activeDayIdx]);

  const activeDay = dayGroups[activeDayIdx] || dayGroups[0];
  const now = Math.floor(Date.now() / 1000);

  // Get next airing anime (the very next one to air)
  const nextAiring = schedule.find(item => item.airingAt > now);

  return (
    <div className="space-y-6 fade-in">
      {/* Header */}
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#4A90E2] to-[#4A90E2] flex items-center justify-center shadow-lg shadow-[#4A90E2]/25">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Airing Schedule</h1>
            <p className="text-xs text-white/40">Upcoming anime episodes with countdown timers</p>
          </div>
        </div>

        {/* Next Airing Banner */}
        {nextAiring && (
          <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-[#4A90E2]/10 via-[#4A90E2]/5 to-[#E63946]/10 border border-[#4A90E2]/15 p-4">
            <div className="absolute inset-0 opacity-30">
              {nextAiring.media.coverImage?.extraLarge && (
                <img
                  src={nextAiring.media.coverImage.extraLarge}
                  alt=""
                  className="w-full h-full object-cover blur-2xl scale-110"
                />
              )}
            </div>
            <div className="relative flex items-center gap-4">
              <div className="shrink-0 w-14 h-20 rounded-lg overflow-hidden border border-white/[0.1] shadow-lg">
                {nextAiring.media.coverImage?.medium ? (
                  <img src={nextAiring.media.coverImage.medium} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-[#0d0d0d] flex items-center justify-center">
                    <svg className="w-6 h-6 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" />
                    </svg>
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-[#4A90E2]/15 text-[#4A90E2] border border-[#4A90E2]/20 animate-pulse">
                    NEXT UP
                  </span>
                  <span className="text-[10px] text-white/40">Episode {nextAiring.episode}</span>
                </div>
                <p className="text-sm font-bold text-white truncate">
                  {nextAiring.media.title?.english || nextAiring.media.title?.romaji || "Unknown"}
                </p>
                <div className="mt-1">
                  <CountdownTimer targetTime={nextAiring.airingAt} />
                </div>
              </div>
              <button
                onClick={() => navigate({ page: "anime", id: String(nextAiring.media.id) })}
                className="shrink-0 pill-btn pill-btn-primary text-xs py-2 px-4"
              >
                View
              </button>
            </div>
          </div>
        )}

        {/* Day Selector — Scrollable pills */}
        <div ref={dayScrollRef} className="scroll-container flex gap-2 overflow-x-auto pb-2">
          {dayGroups.map((day, idx) => {
            const isToday = day.label === "Today";
            const hasAiring = day.items.length > 0;
            return (
              <button
                key={idx}
                onClick={() => setActiveDayIdx(idx)}
                className={`shrink-0 flex flex-col items-center gap-1 px-4 py-2.5 rounded-xl transition-all border min-w-[70px] ${
                  activeDayIdx === idx
                    ? isToday
                      ? "bg-[#4A90E2]/15 border-[#4A90E2]/30 text-[#4A90E2]"
                      : "bg-white/[0.06] border-white/[0.1] text-white"
                    : "bg-white/[0.025] border-white/[0.04] text-white/40 hover:text-white/75 hover:border-white/[0.08]"
                }`}
              >
                <span className="text-[10px] font-bold uppercase tracking-wider">
                  {day.shortLabel}
                </span>
                <span className="text-lg font-bold">
                  {day.date.getDate()}
                </span>
                {hasAiring && (
                  <span className={`text-[9px] font-bold ${
                    activeDayIdx === idx ? "text-[#4A90E2]" : "text-white/30"
                  }`}>
                    {day.items.length} ep{day.items.length !== 1 ? "s" : ""}
                  </span>
                )}
                {isToday && (
                  <div className="w-1.5 h-1.5 rounded-full bg-[#4A90E2] shadow-[0_0_6px_rgba(0,168,225,0.6)]" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Schedule Content */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.025] border border-white/[0.04]">
              <div className="w-2.5 h-2.5 rounded-full skeleton" />
              <div className="w-12 h-16 rounded-lg skeleton" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-3/4 skeleton rounded" />
                <div className="h-3 w-1/3 skeleton rounded" />
              </div>
              <div className="h-4 w-16 skeleton rounded" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="text-center py-20 bg-white/[0.025] rounded-2xl border border-white/[0.04]">
          <div className="space-y-4">
            <div className="w-16 h-16 mx-auto rounded-full bg-[#E63946]/10 flex items-center justify-center">
              <svg className="w-8 h-8 text-[#E63946]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <p className="text-white/55 text-sm">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 text-xs font-bold bg-[#4A90E2]/15 text-[#4A90E2] rounded-full hover:bg-[#4A90E2]/25 transition-all border border-[#4A90E2]/20"
            >
              Refresh
            </button>
          </div>
        </div>
      ) : activeDay && activeDay.items.length > 0 ? (
        <div ref={contentRef} className="space-y-2">
          {/* Day header */}
          <div className="flex items-center gap-3 mb-4">
            <div className="section-header flex items-center gap-2">
              <h2 className="text-base font-bold text-white">{activeDay.label}</h2>
              <span className="text-xs text-white/40">{activeDay.items.length} episode{activeDay.items.length !== 1 ? "s" : ""}</span>
            </div>
            <div className="flex-1 h-px bg-gradient-to-r from-white/[0.06] to-transparent" />
          </div>

          {/* Schedule items */}
          {activeDay.items.map((item, i) => (
            <ScheduleCard key={`${item.id}-${item.episode}`} item={item} index={i} />
          ))}
        </div>
      ) : (
        <div className="text-center py-20 bg-white/[0.025] rounded-2xl border border-white/[0.04]">
          <div className="space-y-4">
            <div className="w-16 h-16 mx-auto rounded-full bg-[#4A90E2]/10 flex items-center justify-center">
              <svg className="w-8 h-8 text-[#4A90E2]/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
            </div>
            <p className="text-white/55 text-sm">No episodes scheduled for this day</p>
            <p className="text-white/30 text-xs">Check other days for upcoming anime</p>
          </div>
        </div>
      )}

      {/* Quick Stats */}
      {!loading && schedule.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white/[0.025] rounded-xl p-3 border border-white/[0.04]">
            <p className="text-[10px] text-white/40 uppercase tracking-wider font-bold">This Week</p>
            <p className="text-xl font-bold text-white mt-1">{schedule.length}</p>
            <p className="text-[10px] text-white/30">episodes</p>
          </div>
          <div className="bg-white/[0.025] rounded-xl p-3 border border-white/[0.04]">
            <p className="text-[10px] text-white/40 uppercase tracking-wider font-bold">Aired</p>
            <p className="text-xl font-bold text-[#10B981] mt-1">
              {schedule.filter(i => i.airingAt <= now).length}
            </p>
            <p className="text-[10px] text-white/30">episodes</p>
          </div>
          <div className="bg-white/[0.025] rounded-xl p-3 border border-white/[0.04]">
            <p className="text-[10px] text-white/40 uppercase tracking-wider font-bold">Upcoming</p>
            <p className="text-xl font-bold text-[#4A90E2] mt-1">
              {schedule.filter(i => i.airingAt > now).length}
            </p>
            <p className="text-[10px] text-white/30">episodes</p>
          </div>
          <div className="bg-white/[0.025] rounded-xl p-3 border border-white/[0.04]">
            <p className="text-[10px] text-white/40 uppercase tracking-wider font-bold">Anime</p>
            <p className="text-xl font-bold text-[#E63946] mt-1">
              {new Set(schedule.map(i => i.media.id)).size}
            </p>
            <p className="text-[10px] text-white/30">unique shows</p>
          </div>
        </div>
      )}
    </div>
  );
}
