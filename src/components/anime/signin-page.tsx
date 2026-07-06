"use client";

import { useState, useEffect } from "react";
import { useAppStore } from "./store";
import { signIn } from "@/lib/auth-local";

const FONT = "var(--font-space-grotesk), 'Space Grotesk', sans-serif";
const GOLD = "#D4A017";

/**
 * SignInPage — glassmorphism login screen
 *
 * Features:
 *   - Centered glass card over an ambient gradient/orb background
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
    <div className="min-h-screen w-full bg-black text-white relative flex items-center justify-center px-4 py-10 overflow-hidden" style={{ fontFamily: "var(--font-inter), Inter, sans-serif" }}>
      {/* ── Ambient background: gradient wash + floating blurred orbs ── */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div
          className="absolute inset-0 opacity-60"
          style={{ background: "radial-gradient(circle at 15% 10%, rgba(212,160,23,0.10), transparent 45%), radial-gradient(circle at 85% 90%, rgba(96,165,250,0.08), transparent 45%)" }}
        />
        <div className="absolute -top-32 -left-24 w-[420px] h-[420px] rounded-full blur-[110px] opacity-25" style={{ background: GOLD }} />
        <div className="absolute -bottom-40 -right-24 w-[420px] h-[420px] rounded-full blur-[110px] opacity-20 bg-blue-500" />
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: "linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)",
            backgroundSize: "44px 44px",
          }}
        />
      </div>

      {/* ── Glass card ── */}
      <div
        className="relative z-10 w-full max-w-md rounded-3xl p-8 sm:p-10 border border-white/10 shadow-2xl"
        style={{ background: "rgba(255,255,255,0.045)", backdropFilter: "blur(28px)", WebkitBackdropFilter: "blur(28px)" }}
      >
        {/* Logo */}
        <button onClick={() => navigate({ page: "landing" })} className="flex items-center gap-2.5 mb-9 mx-auto">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${GOLD}22`, border: `1px solid ${GOLD}55` }}>
            <svg className="w-5 h-5" style={{ color: GOLD }} viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3" /></svg>
          </div>
          <span className="text-xl font-bold" style={{ fontFamily: FONT }}>
            LUFFY <span style={{ color: GOLD }}>TV</span>
          </span>
        </button>

        {/* Heading */}
        <div className="mb-7 text-center">
          <h2 className="text-2xl font-black mb-1.5" style={{ fontFamily: FONT }}>Welcome back</h2>
          <p className="text-white/40 text-sm">
            New here?{" "}
            <button onClick={() => navigate({ page: "signup" })} className="font-semibold hover:underline transition-colors" style={{ color: GOLD }}>
              Create an account
            </button>
          </p>
        </div>

        {/* Error banner */}
        {error && (
          <div className="mb-5 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/30 flex items-start gap-2.5">
            <svg className="w-4 h-4 text-red-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <p className="text-sm text-red-300">{error}</p>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Identifier */}
          <div>
            <label className="block text-xs font-bold text-white/50 uppercase tracking-wider mb-2">
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
                className="w-full pl-11 pr-4 py-3 rounded-xl bg-white/[0.05] border border-white/10 text-sm text-white placeholder-white/20 outline-none transition-all"
                style={{ ["--tw-ring-color" as any]: GOLD }}
                onFocus={(e) => { e.currentTarget.style.borderColor = `${GOLD}80`; e.currentTarget.style.background = "rgba(255,255,255,0.08)"; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = ""; e.currentTarget.style.background = ""; }}
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-bold text-white/50 uppercase tracking-wider">
                Password
              </label>
              <button
                type="button"
                onClick={() => alert("Password reset is not available in this demo. Contact the admin.")}
                className="text-xs text-white/40 hover:text-white/70 transition-colors"
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
                className="w-full pl-11 pr-11 py-3 rounded-xl bg-white/[0.05] border border-white/10 text-sm text-white placeholder-white/20 outline-none transition-all"
                onFocus={(e) => { e.currentTarget.style.borderColor = `${GOLD}80`; e.currentTarget.style.background = "rgba(255,255,255,0.08)"; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = ""; e.currentTarget.style.background = ""; }}
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
              className="w-4 h-4 rounded border-white/20 bg-white/5"
              style={{ accentColor: GOLD }}
            />
            <span className="text-xs text-white/50">Keep me signed in on this device</span>
          </label>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading || !identifier.trim() || !password}
            className="w-full py-3 rounded-xl text-black text-sm font-bold transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2 hover:brightness-110"
            style={{ background: GOLD }}
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
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
        <div className="flex items-center gap-3 my-6">
          <div className="flex-1 h-px bg-white/10" />
          <span className="text-[10px] text-white/30 uppercase tracking-wider">or</span>
          <div className="flex-1 h-px bg-white/10" />
        </div>

        {/* Signup CTA */}
        <button
          onClick={() => navigate({ page: "signup" })}
          className="w-full py-3 rounded-xl bg-white/[0.05] border border-white/10 text-white text-sm font-bold hover:bg-white/[0.09] transition-all"
        >
          Create new account
        </button>

        {/* Back to browsing */}
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
        <p className="mt-7 text-[10px] text-white/25 text-center leading-relaxed">
          By signing in you agree to our Terms of Service and acknowledge our Privacy Policy.
          <br />This is a fan-made project for educational purposes.
        </p>
      </div>
    </div>
  );
}
