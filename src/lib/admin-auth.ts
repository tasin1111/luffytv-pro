/**
 * Admin authentication — separate from the site's user auth.
 *
 * The /admin route has its own username + password gate. On first visit you
 * create the admin credential; afterwards it's required to enter. Credentials
 * are stored in localStorage (password hashed with djb2+salt, same non-crypto
 * scheme as the rest of this demo app — swap for real hashing + a backend for
 * production). Sessions expire after 12h.
 */

const CRED_KEY = "luffytv_admin_cred";
const SESSION_KEY = "luffytv_admin_session";
const SESSION_TTL = 12 * 60 * 60 * 1000;

function hash(s: string): string {
  let h = 5381;
  const salted = `luffytv_admin_${s}_v1`;
  for (let i = 0; i < salted.length; i++) {
    h = ((h << 5) + h) + salted.charCodeAt(i);
    h = h & 0xffffffff;
  }
  return h.toString(16);
}

type Cred = { username: string; passwordHash: string; createdAt: number };

function loadCred(): Cred | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(CRED_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function hasAdminCredential(): boolean {
  return !!loadCred();
}

export function setAdminCredential(username: string, password: string): { ok: boolean; error?: string } {
  const u = username.trim();
  if (u.length < 3) return { ok: false, error: "Username must be at least 3 characters" };
  if (password.length < 6) return { ok: false, error: "Password must be at least 6 characters" };
  const cred: Cred = { username: u, passwordHash: hash(password), createdAt: Date.now() };
  try { localStorage.setItem(CRED_KEY, JSON.stringify(cred)); } catch {}
  return { ok: true };
}

export function verifyAdmin(username: string, password: string): boolean {
  const cred = loadCred();
  if (!cred) return false;
  return cred.username.toLowerCase() === username.trim().toLowerCase() && cred.passwordHash === hash(password);
}

export function getAdminUsername(): string {
  return loadCred()?.username || "admin";
}

export function changeAdminPassword(oldPassword: string, newPassword: string): { ok: boolean; error?: string } {
  const cred = loadCred();
  if (!cred) return { ok: false, error: "No admin credential set" };
  if (cred.passwordHash !== hash(oldPassword)) return { ok: false, error: "Current password is incorrect" };
  if (newPassword.length < 6) return { ok: false, error: "New password must be at least 6 characters" };
  cred.passwordHash = hash(newPassword);
  try { localStorage.setItem(CRED_KEY, JSON.stringify(cred)); } catch {}
  return { ok: true };
}

export function startAdminSession() {
  try { localStorage.setItem(SESSION_KEY, String(Date.now() + SESSION_TTL)); } catch {}
}

export function isAdminSession(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return false;
    return Date.now() < Number(raw);
  } catch {
    return false;
  }
}

export function endAdminSession() {
  try { localStorage.removeItem(SESSION_KEY); } catch {}
}
