"use client";

import { useState, useEffect } from "react";
import { useAppStore } from "./store";
import { BookOpen, Search, Home, Menu, X, TrendingUp, Sparkles } from "lucide-react";

/**
 * NovelNavbar — dedicated navbar for the novel section
 * White + purple theme (NOT the anime dark theme)
 */
export function NovelNavbar() {
  const navigate = useAppStore(s => s.navigate);
  const [searchQuery, setSearchQuery] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      // Navigate to novel page with search query stored in state
      navigate({ page: "novel" });
      // Dispatch a custom event that NovelPage listens for
      window.dispatchEvent(new CustomEvent("novel-search", { detail: searchQuery.trim() }));
      setMobileMenuOpen(false);
    }
  };

  const navItems = [
    { label: "Home", icon: Home, action: () => navigate({ page: "home" }) },
    { label: "Popular", icon: TrendingUp, action: () => { navigate({ page: "novel" }); window.dispatchEvent(new CustomEvent("novel-tab", { detail: "trending" })); } },
    { label: "Browse", icon: BookOpen, action: () => navigate({ page: "novel" }) },
    { label: "Discover", icon: Sparkles, action: () => { navigate({ page: "novel" }); window.dispatchEvent(new CustomEvent("novel-tab", { detail: "recent" })); } },
  ];

  return (
    <>
      <nav
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled
            ? "bg-white/90 backdrop-blur-xl border-b border-purple-100 shadow-sm"
            : "bg-white/70 backdrop-blur-md border-b border-purple-50"
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-16 gap-4">
            {/* Logo */}
            <button
              onClick={() => navigate({ page: "novel" })}
              className="flex items-center gap-2 shrink-0 group"
            >
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-500 to-purple-700 flex items-center justify-center shadow-lg shadow-purple-300/50 group-hover:shadow-purple-400/60 transition-shadow">
                <BookOpen className="w-5 h-5 text-white" />
              </div>
              <span className="font-extrabold text-lg hidden sm:block text-gray-800">
                Novel<span className="text-purple-600">Archive</span>
              </span>
            </button>

            {/* Search bar — desktop */}
            <form onSubmit={handleSearch} className="flex-1 max-w-md hidden md:block">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search novels..."
                  className="w-full pl-10 pr-4 py-2 rounded-full bg-purple-50 border border-purple-100 text-sm text-gray-700 outline-none focus:border-purple-400 focus:bg-white transition-all placeholder:text-purple-300"
                />
              </div>
            </form>

            {/* Nav links — desktop */}
            <div className="hidden md:flex items-center gap-1">
              {navItems.map((item) => (
                <button
                  key={item.label}
                  onClick={item.action}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold text-gray-600 hover:text-purple-600 hover:bg-purple-50 transition-all"
                >
                  <item.icon className="w-4 h-4" />
                  {item.label}
                </button>
              ))}
            </div>

            {/* Mobile menu button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 md:hidden" onClick={() => setMobileMenuOpen(false)}>
          <div className="absolute inset-0 bg-purple-900/20 backdrop-blur-sm" />
          <div
            className="absolute top-16 left-0 right-0 bg-white border-b border-purple-100 p-4 space-y-3 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <form onSubmit={handleSearch} className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search novels..."
                className="w-full pl-10 pr-4 py-2.5 rounded-full bg-purple-50 border border-purple-100 text-sm text-gray-700 outline-none focus:border-purple-400"
                autoFocus
              />
            </form>
            {navItems.map((item) => (
              <button
                key={item.label}
                onClick={() => { item.action(); setMobileMenuOpen(false); }}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-gray-600 hover:bg-purple-50 hover:text-purple-600 w-full transition-all"
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
