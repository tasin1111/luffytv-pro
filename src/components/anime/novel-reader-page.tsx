"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useAppStore } from "./store";
import type { ChapterResponse } from "@/lib/novel-api";

// ============================================================
// NOVEL READER PAGE — Read chapters with AI assistant
// Powered by novelarchive.cc API
// ============================================================

interface NovelReaderProps {
  novelId: string;
  novelTitle: string;
  chapterId: string;
  chapterNum: number;
  chapterTitle: string;
  totalChapters: number;
  novelSource: string;
}

interface ReaderSettings {
  fontSize: number;
  lineHeight: number;
  fontFamily: "serif" | "sans";
}

const DEFAULT_SETTINGS: ReaderSettings = {
  fontSize: 18,
  lineHeight: 1.85,
  fontFamily: "serif",
};

export default function NovelReaderPage({ novelId, novelTitle, chapterNum }: NovelReaderProps) {
  const navigate = useAppStore(s => s.navigate);
  const [data, setData] = useState<ChapterResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showChapters, setShowChapters] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showAI, setShowAI] = useState(false);
  const [settings, setSettings] = useState<ReaderSettings>(DEFAULT_SETTINGS);
  const [chapterSearch, setChapterSearch] = useState("");

  // Load settings
  useEffect(() => {
    const saved = localStorage.getItem("ltv-novel-reader-settings");
    if (saved) {
      try { setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(saved) }); } catch {}
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("ltv-novel-reader-settings", JSON.stringify(settings));
  }, [settings]);

  // Load chapter
  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/novels/${novelId}/chapters/${chapterNum}`);
        if (!res.ok) throw new Error("Chapter not found");
        const d = await res.json();
        setData(d);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [novelId, chapterNum]);

  // Scroll to top on chapter change
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [chapterNum]);

  const goPrev = useCallback(() => {
    if (data?.navigation?.prev) {
      navigate({
        page: "novel-read",
        novelId,
        novelTitle,
        chapterId: `chapter-${data.navigation.prev}`,
        chapterNum: data.navigation.prev,
        chapterTitle: "",
        totalChapters: data.chapter_names?.length || 0,
        novelSource: "novelarchive",
      } as any);
    }
  }, [data, novelId, novelTitle, navigate]);

  const goNext = useCallback(() => {
    if (data?.navigation?.next) {
      navigate({
        page: "novel-read",
        novelId,
        novelTitle,
        chapterId: `chapter-${data.navigation.next}`,
        chapterNum: data.navigation.next,
        chapterTitle: "",
        totalChapters: data.chapter_names?.length || 0,
        novelSource: "novelarchive",
      } as any);
    }
  }, [data, novelId, novelTitle, navigate]);

  // Keyboard navigation
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.key === "ArrowLeft" && data?.navigation?.prev) goPrev();
      if (e.key === "ArrowRight" && data?.navigation?.next) goNext();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [data, goPrev, goNext]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center pt-16">
        <div className="w-8 h-8 border-2 border-[#a855f7] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center pt-16 gap-4">
        <p className="text-white/40">{error || "Chapter not found"}</p>
        <button onClick={() => navigate({ page: "novel-detail", novelId, novelTitle, novelCover: "", novelAuthor: "", novelSource: "novelarchive" } as any)} className="text-[#a855f7] hover:underline text-sm">
          Back to Novel
        </button>
      </div>
    );
  }

  const chapterNames = data.chapter_names || [];
  const filteredChapters = chapterSearch
    ? chapterNames.map((name, i) => ({ name, num: i + 1 })).filter(c => c.name.toLowerCase().includes(chapterSearch.toLowerCase()) || String(c.num).includes(chapterSearch))
    : chapterNames.map((name, i) => ({ name, num: i + 1 }));

  const paragraphs = (data.chapter.content || "").split("\n").filter(p => p.trim());

  return (
    <div className="min-h-screen">
      {/* ═══ TOP BAR ═══ */}
      <div className="fixed top-0 left-0 right-0 z-40 bg-[#0a0a0f]/80 backdrop-blur-xl border-b border-white/[0.06]">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
          <button
            onClick={() => navigate({ page: "novel-detail", novelId, novelTitle, novelCover: "", novelAuthor: "", novelSource: "novelarchive" } as any)}
            className="flex items-center gap-1 text-sm text-white/50 hover:text-white transition-colors shrink-0"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M15 18l-6-6 6-6" /></svg>
            <span className="hidden sm:block">Back</span>
          </button>

          <div className="flex-1 min-w-0 text-center">
            <p className="text-sm font-bold truncate">{data.novel.title}</p>
            <p className="text-[10px] text-white/30 truncate">{data.chapter.name}</p>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button onClick={() => { setShowChapters(true); setShowSettings(false); }} className="w-9 h-9 rounded-lg hover:bg-white/[0.06] flex items-center justify-center" title="Chapters">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" /></svg>
            </button>
            <button onClick={() => { setShowSettings(true); setShowChapters(false); }} className="w-9 h-9 rounded-lg hover:bg-white/[0.06] flex items-center justify-center" title="Settings">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" /></svg>
            </button>
          </div>
        </div>
      </div>

      {/* ═══ READING CONTENT ═══ */}
      <div className="pt-20 pb-32">
        <div className="max-w-3xl mx-auto px-4">
          <h1 className="text-2xl font-bold mb-8 text-center" style={{ fontFamily: settings.fontFamily === "serif" ? "Georgia, serif" : "inherit" }}>
            {data.chapter.name}
          </h1>

          <div
            style={{
              fontSize: `${settings.fontSize}px`,
              lineHeight: settings.lineHeight,
              fontFamily: settings.fontFamily === "serif" ? "Georgia, 'Times New Roman', serif" : "system-ui, sans-serif",
            }}
            className="text-white/80"
          >
            {paragraphs.map((p, i) => (
              <p key={i} className="mb-4" style={{ textIndent: i === 0 ? 0 : "1.5em" }}>{p}</p>
            ))}
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between gap-4 mt-16 pt-8 border-t border-white/[0.06]">
            <button
              onClick={goPrev}
              disabled={!data.navigation.prev}
              className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-white/[0.04] border border-white/[0.08] text-sm font-medium hover:border-[#a855f7]/40 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M15 18l-6-6 6-6" /></svg>
              <span className="hidden sm:block">Previous</span>
            </button>

            <button
              onClick={() => navigate({ page: "novel-detail", novelId, novelTitle, novelCover: "", novelAuthor: "", novelSource: "novelarchive" } as any)}
              className="text-sm text-white/40 hover:text-[#a855f7] transition-colors"
            >
              All Chapters
            </button>

            <button
              onClick={goNext}
              disabled={!data.navigation.next}
              className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-[#a855f7] text-white text-sm font-bold hover:bg-[#9333ea] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              <span className="hidden sm:block">Next</span>
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M9 18l6-6-6-6" /></svg>
            </button>
          </div>
        </div>
      </div>

      {/* ═══ AI FLOATING BUTTON ═══ */}
      <button
        onClick={() => setShowAI(true)}
        className="fixed bottom-6 right-6 z-30 w-14 h-14 rounded-full bg-gradient-to-br from-[#a855f7] to-purple-700 shadow-lg shadow-[#a855f7]/40 flex items-center justify-center hover:scale-110 transition-transform"
        title="AI Assistant"
      >
        <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path d="M12 2L9.5 8.5 3 11l6.5 2.5L12 20l2.5-6.5L21 11l-6.5-2.5L12 2z" />
        </svg>
      </button>

      {/* ═══ CHAPTER LIST DRAWER ═══ */}
      {showChapters && (
        <div className="fixed inset-0 z-50" onClick={() => setShowChapters(false)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="absolute right-0 top-0 bottom-0 w-full max-w-sm bg-[#0f0f15] border-l border-white/[0.06] p-4 overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-white">Chapters ({chapterNames.length})</h3>
              <button onClick={() => setShowChapters(false)} className="w-8 h-8 rounded-lg hover:bg-white/[0.06] flex items-center justify-center">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M18 6L6 18M6 6l12 12" /></svg>
              </button>
            </div>
            <input
              type="text"
              value={chapterSearch}
              onChange={e => setChapterSearch(e.target.value)}
              placeholder="Search chapters..."
              className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-white placeholder-white/25 outline-none focus:border-[#a855f7]/40 mb-3"
            />
            <div className="space-y-0.5">
              {filteredChapters.slice(0, 300).map(c => (
                <button
                  key={c.num}
                  onClick={() => {
                    navigate({
                      page: "novel-read",
                      novelId,
                      novelTitle,
                      chapterId: `chapter-${c.num}`,
                      chapterNum: c.num,
                      chapterTitle: c.name,
                      totalChapters: chapterNames.length,
                      novelSource: "novelarchive",
                    } as any);
                    setShowChapters(false);
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${c.num === chapterNum ? "bg-[#a855f7]/15 text-[#a855f7]" : "hover:bg-white/[0.04]"}`}
                >
                  <span className="shrink-0 w-8 h-8 rounded-lg bg-[#a855f7]/10 border border-[#a855f7]/20 flex items-center justify-center text-[10px] font-bold">{c.num}</span>
                  <span className="text-sm truncate">{c.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ═══ SETTINGS PANEL ═══ */}
      {showSettings && (
        <div className="fixed inset-0 z-50" onClick={() => setShowSettings(false)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="absolute right-0 top-0 bottom-0 w-full max-w-sm bg-[#0f0f15] border-l border-white/[0.06] p-6 overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-bold text-lg">Reading Settings</h3>
              <button onClick={() => setShowSettings(false)} className="w-8 h-8 rounded-lg hover:bg-white/[0.06] flex items-center justify-center">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M18 6L6 18M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="space-y-6">
              <div>
                <label className="text-sm font-medium mb-2 block">Font</label>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => setSettings(s => ({ ...s, fontFamily: "serif" }))} className={`px-3 py-2 rounded-lg text-sm border transition-all ${settings.fontFamily === "serif" ? "bg-[#a855f7]/15 border-[#a855f7] text-[#a855f7]" : "bg-white/[0.04] border-white/[0.08]"}`} style={{ fontFamily: "Georgia, serif" }}>Serif</button>
                  <button onClick={() => setSettings(s => ({ ...s, fontFamily: "sans" }))} className={`px-3 py-2 rounded-lg text-sm border transition-all ${settings.fontFamily === "sans" ? "bg-[#a855f7]/15 border-[#a855f7] text-[#a855f7]" : "bg-white/[0.04] border-white/[0.08]"}`}>Sans</button>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 flex items-center justify-between">
                  <span>Font Size</span>
                  <span className="text-white/30">{settings.fontSize}px</span>
                </label>
                <input type="range" min={14} max={28} value={settings.fontSize} onChange={e => setSettings(s => ({ ...s, fontSize: parseInt(e.target.value) }))} className="w-full accent-[#a855f7]" />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 flex items-center justify-between">
                  <span>Line Spacing</span>
                  <span className="text-white/30">{settings.lineHeight.toFixed(2)}</span>
                </label>
                <input type="range" min={1.4} max={2.4} step={0.05} value={settings.lineHeight} onChange={e => setSettings(s => ({ ...s, lineHeight: parseFloat(e.target.value) }))} className="w-full accent-[#a855f7]" />
              </div>
              <button onClick={() => setSettings(DEFAULT_SETTINGS)} className="w-full py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm hover:border-[#a855f7]/40">Reset to Defaults</button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ AI ASSISTANT ═══ */}
      {showAI && (
        <AIAssistant
          novelId={novelId}
          chapterNum={chapterNum}
          chapterName={data.chapter.name}
          chapterContent={data.chapter.content}
          onClose={() => setShowAI(false)}
        />
      )}
    </div>
  );
}

// ── AI Assistant ─────────────────────────────────────────────────────────────

function AIAssistant({
  novelId, chapterNum, chapterName, chapterContent, onClose,
}: {
  novelId: string; chapterNum: number; chapterName: string; chapterContent: string; onClose: () => void;
}) {
  const [summary, setSummary] = useState<string | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [messages, setMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [input, setInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);

  useEffect(() => {
    const cacheKey = `ltv-novel-summary-${novelId}-${chapterNum}`;
    const cached = localStorage.getItem(cacheKey);
    if (cached) { setSummary(cached); return; }
    (async () => {
      setSummaryLoading(true);
      try {
        const res = await fetch("/api/ai/summarize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chapterName, content: chapterContent }),
        });
        const data = await res.json();
        if (data.summary) { setSummary(data.summary); localStorage.setItem(cacheKey, data.summary); }
      } catch (e) { console.error("Summary error:", e); }
      finally { setSummaryLoading(false); }
    })();
  }, [novelId, chapterNum, chapterName, chapterContent]);

  const sendMessage = async () => {
    if (!input.trim() || chatLoading) return;
    const userMsg = { role: "user" as const, content: input.trim() };
    setMessages(m => [...m, userMsg]);
    setInput("");
    setChatLoading(true);
    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMsg.content, chapterName, chapterContent, history: messages }),
      });
      const data = await res.json();
      if (data.reply) setMessages(m => [...m, { role: "assistant", content: data.reply }]);
    } catch {
      setMessages(m => [...m, { role: "assistant", content: "Sorry, I couldn't process that." }]);
    } finally { setChatLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative w-full sm:max-w-md h-[75vh] sm:h-[600px] bg-[#0f0f15] border border-white/[0.08] sm:rounded-2xl rounded-t-2xl flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#a855f7] to-purple-700 flex items-center justify-center">
              <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M12 2L9.5 8.5 3 11l6.5 2.5L12 20l2.5-6.5L21 11l-6.5-2.5L12 2z" /></svg>
            </div>
            <div>
              <p className="text-sm font-bold">AI Reading Assistant</p>
              <p className="text-[10px] text-white/30">Chapter {chapterNum}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-white/[0.06] flex items-center justify-center">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M18 6L6 18M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div>
            <p className="text-xs font-bold text-white/40 uppercase tracking-wider mb-2">Chapter Summary</p>
            {summaryLoading ? (
              <div className="flex items-center gap-2 text-sm text-white/40">
                <div className="w-4 h-4 border-2 border-[#a855f7] border-t-transparent rounded-full animate-spin" />
                Generating summary...
              </div>
            ) : summary ? (
              <div className="text-sm text-white/60 leading-relaxed whitespace-pre-line bg-[#a855f7]/5 border border-[#a855f7]/20 rounded-lg p-3">{summary}</div>
            ) : (
              <p className="text-sm text-white/30">Failed to generate summary.</p>
            )}
          </div>

          {messages.length > 0 && (
            <div>
              <p className="text-xs font-bold text-white/40 uppercase tracking-wider mb-2">Ask About This Chapter</p>
              <div className="space-y-2">
                {messages.map((m, i) => (
                  <div key={i} className={`text-sm rounded-lg p-2.5 max-w-[85%] ${m.role === "user" ? "bg-[#a855f7] text-white ml-auto" : "bg-white/[0.04] border border-white/[0.06]"}`}>
                    {m.content}
                  </div>
                ))}
                {chatLoading && (
                  <div className="flex items-center gap-2 text-sm text-white/40">
                    <div className="w-3.5 h-3.5 border-2 border-[#a855f7] border-t-transparent rounded-full animate-spin" />
                    Thinking...
                  </div>
                )}
              </div>
            </div>
          )}

          {messages.length === 0 && (
            <div className="space-y-2">
              <p className="text-xs text-white/30">Try asking:</p>
              {["What happened in this chapter?", "Who are the main characters?", "What is the main conflict?"].map(q => (
                <button key={q} onClick={() => setInput(q)} className="block w-full text-left text-xs px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.06] hover:border-[#a855f7]/40 hover:text-[#a855f7] transition-all">{q}</button>
              ))}
            </div>
          )}
        </div>

        <div className="p-3 border-t border-white/[0.06] flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") sendMessage(); }}
            placeholder="Ask about this chapter..."
            className="flex-1 px-3 py-2 rounded-full bg-white/[0.04] border border-white/[0.08] text-sm text-white placeholder-white/25 outline-none focus:border-[#a855f7]/40"
          />
          <button onClick={sendMessage} disabled={!input.trim() || chatLoading} className="w-9 h-9 rounded-full bg-[#a855f7] text-white flex items-center justify-center disabled:opacity-30 hover:bg-[#9333ea] transition-colors">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>
          </button>
        </div>
      </div>
    </div>
  );
}
