/**
 * Auth utility — localStorage-based user management.
 *
 * WHY LOCALSTORAGE (not a real DB):
 *   The app's Prisma DB is SQLite (file:./dev.db), which is READ-ONLY on
 *   Vercel's serverless filesystem. So we store users in localStorage, the
 *   same way we store comments. This is per-browser (each browser has its
 *   own user list), but it works on Vercel without any external DB setup.
 *
 *   For production-grade auth with cross-device sync, swap this out for
 *   NextAuth.js (already installed) + a real Postgres DB (Neon/Supabase).
 *
 * Security note:
 *   Passwords are hashed with a simple non-crypto hash (djb2 + salt). This
 *   is NOT cryptographically secure — it only prevents plaintext passwords
 *   from sitting in localStorage. Do NOT use this for anything that handles
 *   real sensitive data.
 */

const USERS_KEY = "luffytv_users";

export type StoredUser = {
  id: string;
  username: string;
  name: string;
  email: string;
  passwordHash: string;
  avatar?: string;
  avatarColor?: string;
  bio?: string;
  createdAt: string;
  // ── Profile customization ──
  accentColor?: string;     // themes XP bar / badges / active tabs
  avatarEmoji?: string;     // optional emoji shown instead of the letter
  banner?: string;          // header banner preset key (see BANNER_PRESETS)
  favorites?: string[];     // favorite genres shown as chips
  tagline?: string;         // short flair under the name
};

const AVATAR_COLORS = [
  "#7c3aed", "#FF6B00", "#FFB800", "#22c55e",
  "#3b82f6", "#ec4899", "#f59e0b", "#10b981",
  "#8b5cf6", "#ef4444", "#06b6d4", "#84cc16",
];

function hashPassword(password: string): string {
  // Simple djb2 hash + salt (NOT crypto-secure, just obfuscation)
  let hash = 5381;
  const salted = `luffytv_salt_${password}_v1`;
  for (let i = 0; i < salted.length; i++) {
    hash = ((hash << 5) + hash) + salted.charCodeAt(i);
    hash = hash & 0xffffffff;
  }
  return hash.toString(16);
}

function loadUsers(): StoredUser[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(USERS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveUsers(users: StoredUser[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
  } catch {}
}

function genId(): string {
  return `user_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function pickAvatarColor(seed: string): string {
  let sum = 0;
  for (let i = 0; i < seed.length; i++) sum += seed.charCodeAt(i);
  return AVATAR_COLORS[sum % AVATAR_COLORS.length];
}

// ── Public API ──

export type SignUpResult =
  | { ok: true; user: Omit<StoredUser, "passwordHash"> }
  | { ok: false; error: string };

export type SignInResult =
  | { ok: true; user: Omit<StoredUser, "passwordHash"> }
  | { ok: false; error: string };

export function signUp(input: {
  username: string;
  name: string;
  email: string;
  password: string;
}): SignUpResult {
  const username = input.username.trim();
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  const password = input.password;

  if (username.length < 3) return { ok: false, error: "Username must be at least 3 characters" };
  if (username.length > 20) return { ok: false, error: "Username must be 20 characters or less" };
  if (!/^[a-zA-Z0-9_]+$/.test(username))
    return { ok: false, error: "Username can only contain letters, numbers, and underscores" };
  if (name.length < 1) return { ok: false, error: "Name is required" };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return { ok: false, error: "Please enter a valid email address" };
  if (password.length < 6) return { ok: false, error: "Password must be at least 6 characters" };

  const users = loadUsers();

  // Check for existing username (case-insensitive)
  if (users.some((u) => u.username.toLowerCase() === username.toLowerCase())) {
    return { ok: false, error: "Username already taken" };
  }
  // Check for existing email
  if (users.some((u) => u.email.toLowerCase() === email)) {
    return { ok: false, error: "Email already registered" };
  }

  const newUser: StoredUser = {
    id: genId(),
    username,
    name,
    email,
    passwordHash: hashPassword(password),
    avatar: username.charAt(0).toUpperCase(),
    avatarColor: pickAvatarColor(username),
    bio: "",
    createdAt: new Date().toISOString(),
  };

  users.push(newUser);
  saveUsers(users);

  // Strip password hash before returning
  const { passwordHash, ...safe } = newUser;
  return { ok: true, user: safe };
}

export function signIn(input: {
  identifier: string; // username OR email
  password: string;
}): SignInResult {
  const identifier = input.identifier.trim().toLowerCase();
  const password = input.password;

  if (!identifier) return { ok: false, error: "Enter your username or email" };
  if (!password) return { ok: false, error: "Enter your password" };

  const users = loadUsers();
  const user = users.find(
    (u) => u.username.toLowerCase() === identifier || u.email.toLowerCase() === identifier
  );

  if (!user) return { ok: false, error: "No account found with that username or email" };
  if (user.passwordHash !== hashPassword(password)) {
    return { ok: false, error: "Incorrect password" };
  }

  const { passwordHash, ...safe } = user;
  return { ok: true, user: safe };
}

export function updateUserProfile(userId: string, updates: {
  name?: string;
  bio?: string;
  avatar?: string;
  avatarColor?: string;
  accentColor?: string;
  avatarEmoji?: string;
  banner?: string;
  favorites?: string[];
  tagline?: string;
}): Omit<StoredUser, "passwordHash"> | null {
  const users = loadUsers();
  const idx = users.findIndex((u) => u.id === userId);
  if (idx === -1) return null;
  users[idx] = { ...users[idx], ...updates };
  saveUsers(users);
  const { passwordHash, ...safe } = users[idx];
  return safe;
}

export function changePassword(userId: string, oldPassword: string, newPassword: string):
  { ok: true } | { ok: false; error: string } {
  const users = loadUsers();
  const idx = users.findIndex((u) => u.id === userId);
  if (idx === -1) return { ok: false, error: "User not found" };
  if (users[idx].passwordHash !== hashPassword(oldPassword)) {
    return { ok: false, error: "Current password is incorrect" };
  }
  if (newPassword.length < 6) return { ok: false, error: "New password must be at least 6 characters" };
  users[idx].passwordHash = hashPassword(newPassword);
  saveUsers(users);
  return { ok: true };
}

export function listUsersCount(): number {
  return loadUsers().length;
}

/** All registered users on this browser, without password hashes. */
export function listUsersSafe(): Omit<StoredUser, "passwordHash">[] {
  return loadUsers()
    .map(({ passwordHash, ...safe }) => safe)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}

/** True if the given user is the site owner/admin (earliest signup or allow-listed). */
const ADMIN_EMAILS = ["aznayeem2012@gmail.com"];
export function isAdminUser(user: { id?: string; email?: string } | null | undefined): boolean {
  if (!user) return false;
  if (user.email && ADMIN_EMAILS.includes(user.email.toLowerCase())) return true;
  const users = loadUsers();
  if (users.length === 0) return false;
  const earliest = users.slice().sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())[0];
  return !!user.id && earliest.id === user.id;
}
