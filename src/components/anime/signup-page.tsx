"use client";

import { useState, useEffect } from "react";
import { useAppStore } from "./store";
import { signUp } from "@/lib/auth-local";

/**
 * SignUpPage — detailed signup screen
 *
 * Features:
 *   - Split-screen layout matching the signin page
 *   - 4 fields: username, name, email, password + confirm password
 *   - Real-time username validation (3-20 chars, alphanumeric + underscore)
 *   - Password strength meter
 *   - Show/hide password toggle
 *   - Inline validation errors
 *   - Avatar preview (auto-generated from username)
 *   - Loading state
 *   - Link to signin page
 */
export default function SignUpPage() {
  const navigate = useAppStore((s) => s.navigate);
  const user = useAppStore((s) => s.user);
  const setUser = useAppStore((s) => s.setUser);

  const [username, setUsername] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [agree, setAgree] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // If already logged in, redirect to profile
  useEffect(() => {
    if (user) navigate({ page: "profile" });
  }, [user, navigate]);

  // ── Real-time validation ──
  const usernameValid = /^[a-zA-Z0-9_]{3,20}$/.test(username);
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const passwordLong = password.length >= 6;
  const passwordsMatch = password === confirmPassword && password.length > 0;
  const canSubmit = usernameValid && name.trim().length > 0 && emailValid && passwordLong && passwordsMatch && agree;

  // ── Password strength ──
  const passwordStrength = (() => {
    if (!password) return 0;
    let s = 0;
    if (password.length >= 6) s++;
    if (password.length >= 10) s++;
    if (/[A-Z]/.test(password) && /[a-z]/.test(password)) s++;
    if (/\d/.test(password)) s++;
    if (/[^a-zA-Z0-9]/.test(password)) s++;
    return Math.min(s, 4);
  })();
  const strengthLabel = ["", "Weak", "Fair", "Good", "Strong"][passwordStrength];
  const strengthColor = ["", "#ef4444", "#f59e0b", "#3b82f6", "#22c55e"][passwordStrength];

  // ── Avatar preview ──
  const avatarLetter = (username || name || "?").charAt(0).toUpperCase();
  const avatarColors = ["#7c3aed", "#3b82f6", "#3b82f6", "#22c55e", "#3b82f6", "#ec4899", "#f59e0b", "#10b981"];
  const avatarColor = avatarColors[(username || name).charCodeAt(0) % avatarColors.length] || "#7c3aed";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    await new Promise((r) => setTimeout(r, 500));
    const result = signUp({ username, name, email, password });
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
          LEFT — Branding / Visual Panel
          ═══════════════════════════════════════════════════════════ */}
      <div
        className="hidden lg:flex lg:w-1/2 relative overflow-hidden flex-col justify-between p-12"
        style={{
          background:
            "radial-gradient(circle at 80% 20%, rgba(59,130,246,0.15), transparent 50%), radial-gradient(circle at 20% 80%, rgba(37,99,235,0.12), transparent 50%), #000000",
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

        {/* Center hero */}
        <div className="relative z-10 max-w-md">
          <h1 className="text-5xl font-extrabold leading-tight mb-4">
            Join the <span className="italic text-[#3b82f6]">crew</span>.
          </h1>
          <p className="text-white/50 text-lg leading-relaxed mb-8">
            Create your free account and unlock the full LuffyTV experience.
          </p>

          {/* Feature list */}
          <ul className="space-y-3.5">
            {[
              { icon: "📺", title: "Track your progress", desc: "Resume any episode from where you left off" },
              { icon: "⭐", title: "Bookmark favorites", desc: "Build your personal watchlist across 17 sources" },
              { icon: "💬", title: "Join the discussion", desc: "Comment, rate, and react with the community" },
              { icon: "🎭", title: "Personalized profile", desc: "Show off your taste with a custom avatar & bio" },
            ].map((f, i) => (
              <li key={i} className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-white/[0.06] border border-white/10 flex items-center justify-center text-base shrink-0">
                  {f.icon}
                </div>
                <div>
                  <p className="text-sm font-bold text-white">{f.title}</p>
                  <p className="text-xs text-white/40">{f.desc}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* Bottom footer */}
        <p className="relative z-10 text-xs text-white/30">
          © {new Date().getFullYear()} LuffyTV. Free forever. No credit card required.
        </p>
      </div>

      {/* ═══════════════════════════════════════════════════════════
          RIGHT — Form Panel
          ═══════════════════════════════════════════════════════════ */}
      <div className="flex-1 lg:w-1/2 flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-3 mb-8 justify-center">
            <div className="w-10 h-10 rounded-full bg-white/10 border border-white/20 flex items-center justify-center">
              <span className="text-lg font-bold italic text-white">L</span>
            </div>
            <span className="text-xl font-bold italic">LuffyTV</span>
          </div>

          {/* Avatar preview */}
          <div className="flex flex-col items-center mb-6">
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center text-3xl font-bold border-2 border-white/15 shadow-lg"
              style={{ backgroundColor: avatarColor + "33", color: avatarColor }}
            >
              {avatarLetter}
            </div>
            <p className="mt-2 text-xs text-white/40">
              {username ? `@${username}` : "Your avatar preview"}
            </p>
          </div>

          {/* Heading */}
          <div className="mb-6 text-center">
            <h2 className="text-3xl font-extrabold mb-1">Create account</h2>
            <p className="text-white/40 text-sm">
              Already have one?{" "}
              <button
                onClick={() => navigate({ page: "signin" })}
                className="text-[#3b82f6] font-semibold hover:underline"
              >
                Sign in
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
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Username */}
            <div>
              <label className="block text-xs font-bold text-white/60 uppercase tracking-wider mb-2">
                Username <span className="text-[#3b82f6]">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30 text-sm font-mono">@</span>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, ""))}
                  placeholder="luffy_d"
                  autoComplete="username"
                  autoFocus
                  maxLength={20}
                  className="w-full pl-9 pr-10 py-3 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-white placeholder-white/20 outline-none focus:border-[#3b82f6]/50 focus:bg-white/[0.06] transition-all"
                />
                {/* Validation icon */}
                {username.length > 0 && (
                  <div className="absolute right-3.5 top-1/2 -translate-y-1/2">
                    {usernameValid ? (
                      <svg className="w-4 h-4 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    )}
                  </div>
                )}
              </div>
              <p className="mt-1.5 text-[10px] text-white/30">
                3-20 chars · letters, numbers, underscore only
              </p>
            </div>

            {/* Name */}
            <div>
              <label className="block text-xs font-bold text-white/60 uppercase tracking-wider mb-2">
                Display Name <span className="text-[#3b82f6]">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Monkey D. Luffy"
                autoComplete="name"
                maxLength={40}
                className="w-full px-4 py-3 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-white placeholder-white/20 outline-none focus:border-[#3b82f6]/50 focus:bg-white/[0.06] transition-all"
              />
            </div>

            {/* Email */}
            <div>
              <label className="block text-xs font-bold text-white/60 uppercase tracking-wider mb-2">
                Email <span className="text-[#3b82f6]">*</span>
              </label>
              <div className="relative">
                <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="luffy@op.com"
                  autoComplete="email"
                  className="w-full pl-11 pr-10 py-3 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-white placeholder-white/20 outline-none focus:border-[#3b82f6]/50 focus:bg-white/[0.06] transition-all"
                />
                {email.length > 0 && emailValid && (
                  <svg className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-bold text-white/60 uppercase tracking-wider mb-2">
                Password <span className="text-[#3b82f6]">*</span>
              </label>
              <div className="relative">
                <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  autoComplete="new-password"
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
              {/* Strength meter */}
              {password.length > 0 && (
                <div className="mt-2 flex items-center gap-2">
                  <div className="flex-1 flex gap-1">
                    {[1, 2, 3, 4].map((i) => (
                      <div
                        key={i}
                        className="h-1 flex-1 rounded-full transition-all"
                        style={{
                          backgroundColor: i <= passwordStrength ? strengthColor : "rgba(255,255,255,0.08)",
                        }}
                      />
                    ))}
                  </div>
                  <span className="text-[10px] font-bold w-10 text-right" style={{ color: strengthColor }}>
                    {strengthLabel}
                  </span>
                </div>
              )}
            </div>

            {/* Confirm password */}
            <div>
              <label className="block text-xs font-bold text-white/60 uppercase tracking-wider mb-2">
                Confirm Password <span className="text-[#3b82f6]">*</span>
              </label>
              <div className="relative">
                <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <input
                  type={showPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter password"
                  autoComplete="new-password"
                  className="w-full pl-11 pr-10 py-3 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-white placeholder-white/20 outline-none focus:border-[#3b82f6]/50 focus:bg-white/[0.06] transition-all"
                />
                {confirmPassword.length > 0 && (
                  <div className="absolute right-3.5 top-1/2 -translate-y-1/2">
                    {passwordsMatch ? (
                      <svg className="w-4 h-4 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Agree to terms */}
            <label className="flex items-start gap-2.5 cursor-pointer select-none pt-1">
              <input
                type="checkbox"
                checked={agree}
                onChange={(e) => setAgree(e.target.checked)}
                className="w-4 h-4 mt-0.5 rounded border-white/20 bg-white/5 accent-[#3b82f6] shrink-0"
              />
              <span className="text-xs text-white/50 leading-relaxed">
                I agree to the{" "}
                <button type="button" onClick={() => alert("Terms: LuffyTV is a free fan-made project. Use at your own risk. No warranties.")} className="text-[#3b82f6] hover:underline">Terms</button>
                {" "}and{" "}
                <button type="button" onClick={() => alert("Privacy: We store your account info locally in your browser. No data is sent to any server.")} className="text-[#3b82f6] hover:underline">Privacy Policy</button>
                .
              </span>
            </label>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading || !canSubmit}
              className="w-full py-3 rounded-lg bg-[#3b82f6] text-white text-sm font-bold hover:bg-[#60a5fa] transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Creating account...
                </>
              ) : (
                <>
                  Create account
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </>
              )}
            </button>
          </form>

          {/* Back to home */}
          <button
            onClick={() => navigate({ page: "home" })}
            className="w-full mt-5 text-xs text-white/30 hover:text-white/60 transition-colors flex items-center justify-center gap-1.5"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to browsing
          </button>
        </div>
      </div>
    </div>
  );
}
