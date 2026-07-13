"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useAppStore } from "./store";
import type { ChapterResponse } from "@/lib/novel-api";

// ============================================================
// NOVEL READER PAGE — Read chapters with AI assistant
// White + purple theme (matches NovelNavbar)
// Reading content is DARK TEXT on WHITE BACKGROUND (like a real book)
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
  const [showVoice, setShowVoice] = useState(false);
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
      <div className="min-h-screen flex items-center justify-center pt-16 bg-white">
        <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center pt-16 gap-4 bg-white">
        <p className="text-gray-500">{error || "Chapter not found"}</p>
        <button onClick={() => navigate({ page: "novel-detail", novelId, novelTitle, novelCover: "", novelAuthor: "", novelSource: "novelarchive" } as any)} className="text-purple-600 hover:underline text-sm">
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
    <div className="min-h-screen bg-white">
      {/* ═══ TOP BAR ═══ */}
      <div className="fixed top-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-xl border-b border-purple-100 shadow-sm">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
          <button
            onClick={() => navigate({ page: "novel-detail", novelId, novelTitle, novelCover: "", novelAuthor: "", novelSource: "novelarchive" } as any)}
            className="flex items-center gap-1 text-sm text-gray-600 hover:text-purple-600 transition-colors shrink-0"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M15 18l-6-6 6-6" /></svg>
            <span className="hidden sm:block">Back</span>
          </button>

          <div className="flex-1 min-w-0 text-center">
            <p className="text-sm font-bold text-gray-800 truncate">{data.novel.title}</p>
            <p className="text-[10px] text-gray-400 truncate">{data.chapter.name}</p>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button onClick={() => { setShowChapters(true); setShowSettings(false); }} className="w-9 h-9 rounded-lg hover:bg-purple-50 text-gray-600 hover:text-purple-600 flex items-center justify-center transition-colors" title="Chapters">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" /></svg>
            </button>
            <button onClick={() => { setShowSettings(true); setShowChapters(false); }} className="w-9 h-9 rounded-lg hover:bg-purple-50 text-gray-600 hover:text-purple-600 flex items-center justify-center transition-colors" title="Settings">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" /></svg>
            </button>
          </div>
        </div>
      </div>

      {/* ═══ READING CONTENT ═══ */}
      <div className="pt-20 pb-32 bg-white">
        <div className="max-w-3xl mx-auto px-4">
          <h1 className="text-2xl font-bold mb-8 text-center text-gray-800" style={{ fontFamily: settings.fontFamily === "serif" ? "Georgia, serif" : "inherit" }}>
            {data.chapter.name}
          </h1>

          <div
            style={{
              fontSize: `${settings.fontSize}px`,
              lineHeight: settings.lineHeight,
              fontFamily: settings.fontFamily === "serif" ? "Georgia, 'Times New Roman', serif" : "system-ui, sans-serif",
            }}
            className="text-gray-800"
          >
            {paragraphs.map((p, i) => (
              <p key={i} className="mb-4" style={{ textIndent: i === 0 ? 0 : "1.5em" }}>{p}</p>
            ))}
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between gap-4 mt-16 pt-8 border-t border-purple-100">
            <button
              onClick={goPrev}
              disabled={!data.navigation.prev}
              className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-white border border-purple-200 text-sm font-medium text-gray-700 hover:border-purple-400 hover:text-purple-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M15 18l-6-6 6-6" /></svg>
              <span className="hidden sm:block">Previous</span>
            </button>

            <button
              onClick={() => navigate({ page: "novel-detail", novelId, novelTitle, novelCover: "", novelAuthor: "", novelSource: "novelarchive" } as any)}
              className="text-sm text-gray-500 hover:text-purple-600 transition-colors"
            >
              All Chapters
            </button>

            <button
              onClick={goNext}
              disabled={!data.navigation.next}
              className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-purple-500 text-white text-sm font-bold hover:bg-purple-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-md shadow-purple-200"
            >
              <span className="hidden sm:block">Next</span>
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M9 18l6-6-6-6" /></svg>
            </button>
          </div>
        </div>
      </div>

      {/* ═══ AI + VOICE FLOATING BUTTONS ═══ */}
      <div className="fixed bottom-6 right-6 z-30 flex flex-col gap-3">
        {/* AI Assistant button */}
        <button
          onClick={() => setShowAI(true)}
          className="w-14 h-14 rounded-full bg-gradient-to-br from-purple-500 to-purple-700 shadow-lg shadow-purple-300/50 flex items-center justify-center hover:scale-110 transition-transform"
          title="AI Assistant"
        >
          <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M12 2L9.5 8.5 3 11l6.5 2.5L12 20l2.5-6.5L21 11l-6.5-2.5L12 2z" />
          </svg>
        </button>
        {/* Voice Assistant button */}
        <button
          onClick={() => setShowVoice(true)}
          className="w-14 h-14 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-300/50 flex items-center justify-center hover:scale-110 transition-transform"
          title="Voice Reader (Read Aloud)"
        >
          <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M3 10v4a1 1 0 001 1h3l3.293 3.293a1 1 0 001.414-.707V6.414a1 1 0 00-1.414-.707L7 9H4a1 1 0 00-1 1z" />
            <path d="M16.5 12c0-1.764-1.236-3.5-3-3.5" />
            <path d="M19.5 12c0-3.764-2.736-7.5-6-7.5" />
          </svg>
        </button>
      </div>

      {/* ═══ CHAPTER LIST DRAWER ═══ */}
      {showChapters && (
        <div className="fixed inset-0 z-50" onClick={() => setShowChapters(false)}>
          <div className="absolute inset-0 bg-purple-900/20 backdrop-blur-sm" />
          <div className="absolute right-0 top-0 bottom-0 w-full max-w-sm bg-white border-l border-purple-100 p-4 overflow-y-auto shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-800">Chapters ({chapterNames.length})</h3>
              <button onClick={() => setShowChapters(false)} className="w-8 h-8 rounded-lg hover:bg-purple-50 text-gray-600 hover:text-purple-600 flex items-center justify-center transition-colors">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M18 6L6 18M6 6l12 12" /></svg>
              </button>
            </div>
            <input
              type="text"
              value={chapterSearch}
              onChange={e => setChapterSearch(e.target.value)}
              placeholder="Search chapters..."
              className="w-full px-3 py-2 rounded-lg bg-purple-50 border border-purple-100 text-sm text-gray-700 placeholder-gray-400 outline-none focus:border-purple-400 focus:bg-white mb-3 transition-all"
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
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors border ${c.num === chapterNum ? "bg-purple-50 border-purple-200 text-purple-700" : "border-transparent hover:bg-purple-50 text-gray-700"}`}
                >
                  <span className={`shrink-0 w-8 h-8 rounded-lg border flex items-center justify-center text-[10px] font-bold ${c.num === chapterNum ? "bg-purple-100 border-purple-200 text-purple-700" : "bg-purple-50 border-purple-100 text-purple-600"}`}>{c.num}</span>
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
          <div className="absolute inset-0 bg-purple-900/20 backdrop-blur-sm" />
          <div className="absolute right-0 top-0 bottom-0 w-full max-w-sm bg-white border-l border-purple-100 p-6 overflow-y-auto shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-bold text-lg text-gray-800">Reading Settings</h3>
              <button onClick={() => setShowSettings(false)} className="w-8 h-8 rounded-lg hover:bg-purple-50 text-gray-600 hover:text-purple-600 flex items-center justify-center transition-colors">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M18 6L6 18M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="space-y-6">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">Font</label>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => setSettings(s => ({ ...s, fontFamily: "serif" }))} className={`px-3 py-2 rounded-lg text-sm border transition-all ${settings.fontFamily === "serif" ? "bg-purple-50 border-purple-400 text-purple-700" : "bg-gray-50 border-gray-200 text-gray-700 hover:border-purple-300"}`} style={{ fontFamily: "Georgia, serif" }}>Serif</button>
                  <button onClick={() => setSettings(s => ({ ...s, fontFamily: "sans" }))} className={`px-3 py-2 rounded-lg text-sm border transition-all ${settings.fontFamily === "sans" ? "bg-purple-50 border-purple-400 text-purple-700" : "bg-gray-50 border-gray-200 text-gray-700 hover:border-purple-300"}`}>Sans</button>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 flex items-center justify-between">
                  <span>Font Size</span>
                  <span className="text-gray-400">{settings.fontSize}px</span>
                </label>
                <input type="range" min={14} max={28} value={settings.fontSize} onChange={e => setSettings(s => ({ ...s, fontSize: parseInt(e.target.value) }))} className="w-full accent-purple-500" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 flex items-center justify-between">
                  <span>Line Spacing</span>
                  <span className="text-gray-400">{settings.lineHeight.toFixed(2)}</span>
                </label>
                <input type="range" min={1.4} max={2.4} step={0.05} value={settings.lineHeight} onChange={e => setSettings(s => ({ ...s, lineHeight: parseFloat(e.target.value) }))} className="w-full accent-purple-500" />
              </div>
              <button onClick={() => setSettings(DEFAULT_SETTINGS)} className="w-full py-2 rounded-lg bg-gray-50 border border-gray-200 text-sm text-gray-700 hover:border-purple-300 hover:text-purple-600 transition-all">Reset to Defaults</button>
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

      {/* ═══ VOICE ASSISTANT (TTS) ═══ */}
      {showVoice && (
        <VoiceAssistant
          chapterName={data.chapter.name}
          chapterContent={data.chapter.content}
          onClose={() => setShowVoice(false)}
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
      <div className="absolute inset-0 bg-purple-900/30 backdrop-blur-sm" />
      <div className="relative w-full sm:max-w-md h-[75vh] sm:h-[600px] bg-white border border-purple-100 sm:rounded-2xl rounded-t-2xl flex flex-col overflow-hidden shadow-2xl shadow-purple-200/40" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-purple-100 bg-purple-50/50">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-purple-700 flex items-center justify-center shadow-sm shadow-purple-300/50">
              <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M12 2L9.5 8.5 3 11l6.5 2.5L12 20l2.5-6.5L21 11l-6.5-2.5L12 2z" /></svg>
            </div>
            <div>
              <p className="text-sm font-bold text-gray-800">AI Reading Assistant</p>
              <p className="text-[10px] text-gray-500">Chapter {chapterNum}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-purple-100 text-gray-600 hover:text-purple-600 flex items-center justify-center transition-colors">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M18 6L6 18M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-white">
          <div>
            <p className="text-xs font-bold text-purple-600 uppercase tracking-wider mb-2">Chapter Summary</p>
            {summaryLoading ? (
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <div className="w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                Generating summary...
              </div>
            ) : summary ? (
              <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-line bg-purple-50 border border-purple-100 rounded-lg p-3">{summary}</div>
            ) : (
              <p className="text-sm text-gray-400">Failed to generate summary.</p>
            )}
          </div>

          {messages.length > 0 && (
            <div>
              <p className="text-xs font-bold text-purple-600 uppercase tracking-wider mb-2">Ask About This Chapter</p>
              <div className="space-y-2">
                {messages.map((m, i) => (
                  <div key={i} className={`text-sm rounded-lg p-2.5 max-w-[85%] ${m.role === "user" ? "bg-purple-500 text-white ml-auto" : "bg-gray-50 border border-gray-200 text-gray-700"}`}>
                    {m.content}
                  </div>
                ))}
                {chatLoading && (
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <div className="w-3.5 h-3.5 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                    Thinking...
                  </div>
                )}
              </div>
            </div>
          )}

          {messages.length === 0 && (
            <div className="space-y-2">
              <p className="text-xs text-gray-400">Try asking:</p>
              {["What happened in this chapter?", "Who are the main characters?", "What is the main conflict?"].map(q => (
                <button key={q} onClick={() => setInput(q)} className="block w-full text-left text-xs px-3 py-2 rounded-lg bg-purple-50 border border-purple-100 text-gray-700 hover:border-purple-300 hover:text-purple-700 transition-all">{q}</button>
              ))}
            </div>
          )}
        </div>

        <div className="p-3 border-t border-purple-100 flex items-center gap-2 bg-white">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") sendMessage(); }}
            placeholder="Ask about this chapter..."
            className="flex-1 px-3 py-2 rounded-full bg-purple-50 border border-purple-100 text-sm text-gray-700 placeholder-gray-400 outline-none focus:border-purple-400 focus:bg-white transition-all"
          />
          <button onClick={sendMessage} disabled={!input.trim() || chatLoading} className="w-9 h-9 rounded-full bg-purple-500 text-white flex items-center justify-center disabled:opacity-30 hover:bg-purple-600 transition-colors shadow-sm shadow-purple-200">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Voice Assistant (Text-to-Speech) ─────────────────────────────────────────

function VoiceAssistant({
  chapterName,
  chapterContent,
  onClose,
}: {
  chapterName: string;
  chapterContent: string;
  onClose: () => void;
}) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [rate, setRate] = useState(1);
  const [pitch, setPitch] = useState(1);
  const [voiceURI, setVoiceURI] = useState<string>("");
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [progress, setProgress] = useState(0);
  const chunksRef = useRef<string[]>([]);
  const idxRef = useRef(0);

  // Split content into chunks (browsers can't speak very long strings at once)
  const chunks = useMemo(() => {
    const paragraphs = (chapterContent || "").split("\n").filter(p => p.trim());
    // Further split long paragraphs into ~200 char chunks at sentence boundaries
    const result: string[] = [];
    for (const p of paragraphs) {
      if (p.length <= 200) {
        result.push(p);
      } else {
        const sentences = p.match(/[^.!?]+[.!?]+/g) || [p];
        let current = "";
        for (const s of sentences) {
          if ((current + s).length > 200) {
            if (current) result.push(current.trim());
            current = s;
          } else {
            current += s;
          }
        }
        if (current.trim()) result.push(current.trim());
      }
    }
    return result;
  }, [chapterContent]);

  // Load voices
  useEffect(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    const loadVoices = () => {
      const v = window.speechSynthesis.getVoices();
      setVoices(v);
      // Prefer English voices
      const eng = v.find(v => v.lang.startsWith("en") && v.name.includes("Google")) || v.find(v => v.lang.startsWith("en"));
      if (eng && !voiceURI) setVoiceURI(eng.voiceURI);
    };
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
    return () => { window.speechSynthesis.onvoiceschanged = null; };
  }, [voiceURI]);

  // Track current chunk
  useEffect(() => { idxRef.current = currentIdx; }, [currentIdx]);
  useEffect(() => { chunksRef.current = chunks; }, [chunks]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const speak = useCallback((startIdx: number = 0) => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();

    const speakChunk = (idx: number) => {
      if (idx >= chunksRef.current.length) {
        setIsPlaying(false);
        setIsPaused(false);
        setCurrentIdx(0);
        setProgress(0);
        return;
      }
      setCurrentIdx(idx);
      setProgress(Math.round((idx / chunksRef.current.length) * 100));

      const utter = new SpeechSynthesisUtterance(chunksRef.current[idx]);
      utter.rate = rate;
      utter.pitch = pitch;
      const voice = voices.find(v => v.voiceURI === voiceURI);
      if (voice) utter.voice = voice;

      utter.onend = () => {
        // Only advance if still playing (not cancelled)
        if (idxRef.current === idx) {
          speakChunk(idx + 1);
        }
      };
      utter.onerror = () => {
        if (idxRef.current === idx) speakChunk(idx + 1);
      };

      window.speechSynthesis.speak(utter);
    };

    setIsPlaying(true);
    setIsPaused(false);
    speakChunk(startIdx);
  }, [rate, pitch, voiceURI, voices]);

  const togglePlay = () => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    if (isPlaying && !isPaused) {
      window.speechSynthesis.pause();
      setIsPaused(true);
    } else if (isPlaying && isPaused) {
      window.speechSynthesis.resume();
      setIsPaused(false);
    } else {
      speak(currentIdx);
    }
  };

  const stop = () => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    setIsPlaying(false);
    setIsPaused(false);
    setCurrentIdx(0);
    setProgress(0);
  };

  const skipForward = () => {
    const next = Math.min(currentIdx + 1, chunks.length - 1);
    if (isPlaying) speak(next);
    else setCurrentIdx(next);
  };

  const skipBack = () => {
    const prev = Math.max(currentIdx - 1, 0);
    if (isPlaying) speak(prev);
    else setCurrentIdx(prev);
  };

  const supported = typeof window !== "undefined" && "speechSynthesis" in window;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-purple-900/20 backdrop-blur-sm" />
      <div
        className="relative w-full sm:max-w-md bg-white border border-purple-100 sm:rounded-2xl rounded-t-2xl shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-purple-100 bg-gradient-to-r from-purple-50 to-indigo-50">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-md shadow-indigo-200">
              <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M3 10v4a1 1 0 001 1h3l3.293 3.293a1 1 0 001.414-.707V6.414a1 1 0 00-1.414-.707L7 9H4a1 1 0 00-1 1z" />
                <path d="M16.5 12c0-1.764-1.236-3.5-3-3.5" />
                <path d="M19.5 12c0-3.764-2.736-7.5-6-7.5" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-bold text-gray-800">AI Voice Reader</p>
              <p className="text-[10px] text-gray-500 truncate max-w-[200px]">{chapterName}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-purple-100 flex items-center justify-center text-gray-500">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M18 6L6 18M6 6l12 12" /></svg>
          </button>
        </div>

        {!supported ? (
          <div className="p-8 text-center">
            <p className="text-sm text-gray-500 mb-2">Voice reader not supported</p>
            <p className="text-xs text-gray-400">Your browser doesn't support text-to-speech. Try Chrome or Edge.</p>
          </div>
        ) : (
          <>
            {/* Progress bar */}
            <div className="px-4 pt-4">
              <div className="flex items-center justify-between text-xs text-gray-500 mb-1.5">
                <span>{currentIdx} / {chunks.length} paragraphs</span>
                <span>{progress}%</span>
              </div>
              <div className="w-full h-2 bg-purple-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            {/* Current text preview */}
            <div className="px-4 py-3">
              <div className="bg-purple-50 border border-purple-100 rounded-xl p-3 max-h-24 overflow-y-auto">
                <p className="text-xs text-gray-600 leading-relaxed">
                  {chunks[currentIdx] || "Press play to start reading..."}
                </p>
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center justify-center gap-3 py-4">
              <button
                onClick={skipBack}
                disabled={currentIdx === 0}
                className="w-11 h-11 rounded-full bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600 hover:bg-purple-100 disabled:opacity-30 transition-all"
                title="Previous paragraph"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path d="M19 20L9 12l10-8v16z" /><line x1="5" y1="19" x2="5" y2="5" />
                </svg>
              </button>

              <button
                onClick={togglePlay}
                className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 text-white flex items-center justify-center shadow-lg shadow-purple-300 hover:scale-105 transition-transform"
                title={isPlaying && !isPaused ? "Pause" : "Play"}
              >
                {isPlaying && !isPaused ? (
                  <svg className="w-7 h-7" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" /></svg>
                ) : (
                  <svg className="w-7 h-7 ml-1" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                )}
              </button>

              <button
                onClick={skipForward}
                disabled={currentIdx >= chunks.length - 1}
                className="w-11 h-11 rounded-full bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600 hover:bg-purple-100 disabled:opacity-30 transition-all"
                title="Next paragraph"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path d="M5 4l10 8-10 8V4z" /><line x1="19" y1="5" x2="19" y2="19" />
                </svg>
              </button>

              <button
                onClick={stop}
                disabled={!isPlaying}
                className="w-11 h-11 rounded-full bg-red-50 border border-red-100 flex items-center justify-center text-red-500 hover:bg-red-100 disabled:opacity-30 transition-all"
                title="Stop"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><rect x="5" y="5" width="14" height="14" rx="2" /></svg>
              </button>
            </div>

            {/* Settings */}
            <div className="px-4 pb-4 space-y-3 border-t border-purple-100 pt-3">
              {/* Voice selector */}
              {voices.length > 0 && (
                <div>
                  <label className="text-xs font-semibold text-gray-500 mb-1 block">Voice</label>
                  <select
                    value={voiceURI}
                    onChange={e => setVoiceURI(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-purple-50 border border-purple-100 text-sm text-gray-700 outline-none focus:border-purple-400"
                  >
                    {voices.filter(v => v.lang.startsWith("en")).map(v => (
                      <option key={v.voiceURI} value={v.voiceURI}>{v.name} ({v.lang})</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Speed */}
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 flex items-center justify-between">
                  <span>Speed</span>
                  <span className="text-purple-600">{rate.toFixed(1)}x</span>
                </label>
                <input
                  type="range" min={0.5} max={2} step={0.1}
                  value={rate}
                  onChange={e => setRate(parseFloat(e.target.value))}
                  className="w-full accent-purple-500"
                />
              </div>

              {/* Pitch */}
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 flex items-center justify-between">
                  <span>Pitch</span>
                  <span className="text-purple-600">{pitch.toFixed(1)}</span>
                </label>
                <input
                  type="range" min={0.5} max={2} step={0.1}
                  value={pitch}
                  onChange={e => setPitch(parseFloat(e.target.value))}
                  className="w-full accent-purple-500"
                />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
