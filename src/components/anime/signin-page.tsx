"use client";

import { useState, useEffect } from "react";
import { useAppStore } from "./store";
import { signIn } from "@/lib/auth-local";

/**
 * SignInPage — detailed login screen
 *
 * Features:
 *   - Split-screen layout: left = branding/visual, right = form
 *   - Login by username OR email + password
 *   - Show/hide password toggle
 *   - Remember me (default on, since we use localStorage anyway)
 *   - Validation errors inline
 *   - Loading state
 *   - Link to signup page
 *   - Already-logged-in users get redirected to profile
 */
export default function SignInPage() {
  const navigate = useAppStore((s) => s.navigate);
  const user = useAppStore((s) => s.user);
  const setUser = useAppStore((s) => s.setUser);

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // If already logged in, redirect to profile
  useEffect(() => {
    if (user) navigate({ page: "profile" });
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    // Small delay for UX (feels like real auth)
    await new Promise((r) => setTimeout(r, 400));
    const result = signIn({ identifier, password });
    setLoading(false);
    if (result.ok) {
      setUser(result.user);
      navigate({ page: "profile" });
    } else {
      setError(result.error);
    }
  };

  return (
    <div className="min-h-screen w-full bg-black text-white flex flex-col lg:flex-row">
      {/* ═══════════════════════════════════════════════════════════
          LEFT — Branding / Visual Panel (hidden on mobile)
          ═══════════════════════════════════════════════════════════ */}
      <div
        className="hidden lg:flex lg:w-1/2 relative overflow-hidden flex-col justify-between p-12"
        style={{
          background:
            "radial-gradient(circle at 20% 20%, rgba(59,130,246,0.15), transparent 50%), radial-gradient(circle at 80% 80%, rgba(37,99,235,0.10), transparent 50%), #000000",
        }}
      >
        {/* Decorative grid */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />

        {/* Logo top */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-white/10 border border-white/20 flex items-center justify-center backdrop-blur">
            <span className="text-xl font-bold italic text-white">L</span>
          </div>
          <div>
            <p className="text-2xl font-bold italic tracking-tight">LuffyTV</p>
            <p className="text-[10px] text-white/40 uppercase tracking-[0.3em]">Anime Universe</p>
          </div>
        </div>

        {/* Center quote */}
        <div className="relative z-10 max-w-md">
          <h1 className="text-5xl font-extrabold leading-tight mb-4">
            Welcome back to the <span className="italic text-[#3b82f6]">crew</span>.
          </h1>
          <p className="text-white/50 text-lg leading-relaxed">
            Pick up where you left off. Track your progress, bookmark your favorites,
            and join the conversation with thousands of anime fans.
          </p>

          {/* Stats row */}
          <div className="flex gap-8 mt-10 pt-8 border-t border-white/10">
            <div>
              <p className="text-3xl font-bold text-[#3b82f6]">17+</p>
              <p className="text-xs text-white/40 uppercase tracking-wider">Stream sources</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-[#3b82f6]">10K+</p>
              <p className="text-xs text-white/40 uppercase tracking-wider">Anime titles</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-[#3b82f6]">Free</p>
              <p className="text-xs text-white/40 uppercase tracking-wider">Forever</p>
            </div>
          </div>
        </div>

        {/* Bottom footer */}
        <p className="relative z-10 text-xs text-white/30">
          © {new Date().getFullYear()} LuffyTV. Not affiliated with any streaming service.
        </p>
      </div>

      {/* ═══════════════════════════════════════════════════════════
          RIGHT — Form Panel
          ═══════════════════════════════════════════════════════════ */}
      <div className="flex-1 lg:w-1/2 flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-3 mb-10 justify-center">
            <div className="w-10 h-10 rounded-full bg-white/10 border border-white/20 flex items-center justify-center">
              <span className="text-lg font-bold italic text-white">L</span>
            </div>
            <span className="text-xl font-bold italic">LuffyTV</span>
          </div>

          {/* Heading */}
          <div className="mb-8">
            <h2 className="text-3xl font-extrabold mb-2">Sign in</h2>
            <p className="text-white/40 text-sm">
              New here?{" "}
              <button
                onClick={() => navigate({ page: "signup" })}
                className="text-[#3b82f6] font-semibold hover:underline"
              >
                Create an account
              </button>
            </p>
          </div>

          {/* Error banner */}
          {error && (
            <div className="mb-5 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/30 flex items-start gap-2.5">
              <svg className="w-4 h-4 text-red-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <p className="text-sm text-red-300">{error}</p>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Identifier */}
            <div>
              <label className="block text-xs font-bold text-white/60 uppercase tracking-wider mb-2">
                Username or Email
              </label>
              <div className="relative">
                <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <input
                  type="text"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="luffy or luffy@op.com"
                  autoComplete="username"
                  autoFocus
                  className="w-full pl-11 pr-4 py-3 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-white placeholder-white/20 outline-none focus:border-[#3b82f6]/50 focus:bg-white/[0.06] transition-all"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-bold text-white/60 uppercase tracking-wider">
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => alert("Password reset is not available in this demo. Contact the admin.")}
                  className="text-xs text-white/40 hover:text-[#3b82f6] transition-colors"
                >
                  Forgot?
                </button>
              </div>
              <div className="relative">
                <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="w-full pl-11 pr-11 py-3 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-white placeholder-white/20 outline-none focus:border-[#3b82f6]/50 focus:bg-white/[0.06] transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
                >
                  {showPassword ? (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Remember me */}
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="w-4 h-4 rounded border-white/20 bg-white/5 accent-[#3b82f6]"
              />
              <span className="text-xs text-white/50">Keep me signed in on this device</span>
            </label>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading || !identifier.trim() || !password}
              className="w-full py-3 rounded-lg bg-[#3b82f6] text-white text-sm font-bold hover:bg-[#60a5fa] transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Signing in...
                </>
              ) : (
                <>
                  Sign in
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3 my-7">
            <div className="flex-1 h-px bg-white/10" />
            <span className="text-[10px] text-white/30 uppercase tracking-wider">or</span>
            <div className="flex-1 h-px bg-white/10" />
          </div>

          {/* Signup CTA */}
          <button
            onClick={() => navigate({ page: "signup" })}
            className="w-full py-3 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white text-sm font-bold hover:bg-white/[0.08] transition-all"
          >
            Create new account
          </button>

          {/* Back to home */}
          <button
            onClick={() => navigate({ page: "home" })}
            className="w-full mt-3 text-xs text-white/30 hover:text-white/60 transition-colors flex items-center justify-center gap-1.5"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to browsing
          </button>

          {/* Legal */}
          <p className="mt-8 text-[10px] text-white/25 text-center leading-relaxed">
            By signing in you agree to our Terms of Service and acknowledge our Privacy Policy.
            <br />This is a fan-made project for educational purposes.
          </p>
        </div>
      </div>
    </div>
  );
}
