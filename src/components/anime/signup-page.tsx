"use client";

import { useState, useEffect } from "react";
import { useAppStore } from "./store";
import { signUp } from "@/lib/auth-local";

const FONT = "var(--font-space-grotesk), 'Space Grotesk', sans-serif";
const GOLD = "#D4A017";

/**
 * SignUpPage — glassmorphism signup screen
 *
 * Features:
 *   - Centered glass card over an ambient gradient/orb background
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
  const strengthColor = ["", "#ef4444", "#f59e0b", GOLD, "#22c55e"][passwordStrength];

  // ── Avatar preview ──
  const avatarLetter = (username || name || "?").charAt(0).toUpperCase();
  const avatarColors = [GOLD, "#3b82f6", "#7c3aed", "#22c55e", "#ec4899", "#10b981"];
  const avatarColor = avatarColors[(username || name).charCodeAt(0) % avatarColors.length] || GOLD;

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

  const focusStyle = (e: React.FocusEvent<HTMLInputElement>) => { e.currentTarget.style.borderColor = `${GOLD}80`; e.currentTarget.style.background = "rgba(255,255,255,0.08)"; };
  const blurStyle = (e: React.FocusEvent<HTMLInputElement>) => { e.currentTarget.style.borderColor = ""; e.currentTarget.style.background = ""; };

  return (
    <div className="min-h-screen w-full bg-black text-white relative flex items-center justify-center px-4 py-10 overflow-hidden" style={{ fontFamily: "var(--font-inter), Inter, sans-serif" }}>
      {/* ── Ambient background: gradient wash + floating blurred orbs ── */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div
          className="absolute inset-0 opacity-60"
          style={{ background: "radial-gradient(circle at 85% 10%, rgba(212,160,23,0.10), transparent 45%), radial-gradient(circle at 15% 90%, rgba(96,165,250,0.08), transparent 45%)" }}
        />
        <div className="absolute -top-32 -right-24 w-[420px] h-[420px] rounded-full blur-[110px] opacity-25" style={{ background: GOLD }} />
        <div className="absolute -bottom-40 -left-24 w-[420px] h-[420px] rounded-full blur-[110px] opacity-20 bg-blue-500" />
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
        className="relative z-10 w-full max-w-md rounded-3xl p-8 sm:p-10 border border-white/10 shadow-2xl my-6"
        style={{ background: "rgba(255,255,255,0.045)", backdropFilter: "blur(28px)", WebkitBackdropFilter: "blur(28px)" }}
      >
        {/* Logo */}
        <button onClick={() => navigate({ page: "landing" })} className="flex items-center gap-2.5 mb-6 mx-auto">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${GOLD}22`, border: `1px solid ${GOLD}55` }}>
            <svg className="w-5 h-5" style={{ color: GOLD }} viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3" /></svg>
          </div>
          <span className="text-xl font-bold" style={{ fontFamily: FONT }}>
            LUFFY <span style={{ color: GOLD }}>TV</span>
          </span>
        </button>

        {/* Avatar preview */}
        <div className="flex flex-col items-center mb-6">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold border-2 shadow-lg"
            style={{ backgroundColor: avatarColor + "26", color: avatarColor, borderColor: avatarColor + "55" }}
          >
            {avatarLetter}
          </div>
          <p className="mt-2 text-xs text-white/40">
            {username ? `@${username}` : "Your avatar preview"}
          </p>
        </div>

        {/* Heading */}
        <div className="mb-6 text-center">
          <h2 className="text-2xl font-black mb-1.5" style={{ fontFamily: FONT }}>Create account</h2>
          <p className="text-white/40 text-sm">
            Already have one?{" "}
            <button onClick={() => navigate({ page: "signin" })} className="font-semibold hover:underline" style={{ color: GOLD }}>
              Sign in
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
          {/* Username */}
          <div>
            <label className="block text-xs font-bold text-white/50 uppercase tracking-wider mb-2">
              Username <span style={{ color: GOLD }}>*</span>
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
                onFocus={focusStyle}
                onBlur={blurStyle}
                className="w-full pl-9 pr-10 py-3 rounded-xl bg-white/[0.05] border border-white/10 text-sm text-white placeholder-white/20 outline-none transition-all"
              />
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
            <label className="block text-xs font-bold text-white/50 uppercase tracking-wider mb-2">
              Display Name <span style={{ color: GOLD }}>*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Monkey D. Luffy"
              autoComplete="name"
              maxLength={40}
              onFocus={focusStyle}
              onBlur={blurStyle}
              className="w-full px-4 py-3 rounded-xl bg-white/[0.05] border border-white/10 text-sm text-white placeholder-white/20 outline-none transition-all"
            />
          </div>

          {/* Email */}
          <div>
            <label className="block text-xs font-bold text-white/50 uppercase tracking-wider mb-2">
              Email <span style={{ color: GOLD }}>*</span>
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
                onFocus={focusStyle}
                onBlur={blurStyle}
                className="w-full pl-11 pr-10 py-3 rounded-xl bg-white/[0.05] border border-white/10 text-sm text-white placeholder-white/20 outline-none transition-all"
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
            <label className="block text-xs font-bold text-white/50 uppercase tracking-wider mb-2">
              Password <span style={{ color: GOLD }}>*</span>
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
                onFocus={focusStyle}
                onBlur={blurStyle}
                className="w-full pl-11 pr-11 py-3 rounded-xl bg-white/[0.05] border border-white/10 text-sm text-white placeholder-white/20 outline-none transition-all"
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
                      style={{ backgroundColor: i <= passwordStrength ? strengthColor : "rgba(255,255,255,0.08)" }}
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
            <label className="block text-xs font-bold text-white/50 uppercase tracking-wider mb-2">
              Confirm Password <span style={{ color: GOLD }}>*</span>
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
                onFocus={focusStyle}
                onBlur={blurStyle}
                className="w-full pl-11 pr-10 py-3 rounded-xl bg-white/[0.05] border border-white/10 text-sm text-white placeholder-white/20 outline-none transition-all"
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
              className="w-4 h-4 mt-0.5 rounded border-white/20 bg-white/5 shrink-0"
              style={{ accentColor: GOLD }}
            />
            <span className="text-xs text-white/50 leading-relaxed">
              I agree to the{" "}
              <button type="button" onClick={() => alert("Terms: LuffyTV is a free fan-made project. Use at your own risk. No warranties.")} className="hover:underline" style={{ color: GOLD }}>Terms</button>
              {" "}and{" "}
              <button type="button" onClick={() => alert("Privacy: We store your account info locally in your browser. No data is sent to any server.")} className="hover:underline" style={{ color: GOLD }}>Privacy Policy</button>
              .
            </span>
          </label>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading || !canSubmit}
            className="w-full py-3 rounded-xl text-black text-sm font-bold transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-2 hover:brightness-110"
            style={{ background: GOLD }}
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
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
  );
}
