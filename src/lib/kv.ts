/**
 * Minimal Redis-over-REST client for real, cross-visitor analytics.
 *
 * Works out of the box with **Vercel KV** or **Upstash Redis** — connect one in
 * the Vercel dashboard (Storage → KV) and it auto-injects the env vars below.
 * With no store configured it falls back to an in-memory map so local dev works
 * (note: in-memory does NOT persist or aggregate across serverless instances —
 * a KV store is required for real production numbers).
 */

const URL_ = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || "";
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || "";

export const kvEnabled = !!(URL_ && TOKEN);

type Cmd = (string | number)[];

// ── In-memory fallback (dev / unconfigured) ──
const mem = {
  kv: new Map<string, string>(),
  hash: new Map<string, Map<string, number>>(),
  hll: new Map<string, Set<string>>(),
  z: new Map<string, Map<string, number>>(),
};

function memExec(cmd: Cmd): unknown {
  const [rawOp, ...rest] = cmd;
  const op = String(rawOp).toUpperCase();
  const args = rest.map(String);
  switch (op) {
    case "INCR": { const k = args[0]; const v = Number(mem.kv.get(k) || 0) + 1; mem.kv.set(k, String(v)); return v; }
    case "GET": return mem.kv.get(args[0]) ?? null;
    case "MGET": return args.map((k) => mem.kv.get(k) ?? null);
    case "HINCRBY": { const [k, f, by] = args; const h = mem.hash.get(k) || new Map(); h.set(f, (h.get(f) || 0) + Number(by)); mem.hash.set(k, h); return h.get(f); }
    case "HGETALL": { const h = mem.hash.get(args[0]); if (!h) return []; const out: string[] = []; h.forEach((v, f) => out.push(f, String(v))); return out; }
    case "PFADD": { const s = mem.hll.get(args[0]) || new Set<string>(); args.slice(1).forEach((m) => s.add(m)); mem.hll.set(args[0], s); return 1; }
    case "PFCOUNT": return mem.hll.get(args[0])?.size ?? 0;
    case "ZADD": { const z = mem.z.get(args[0]) || new Map<string, number>(); z.set(args[2], Number(args[1])); mem.z.set(args[0], z); return 1; }
    case "ZREMRANGEBYSCORE": { const z = mem.z.get(args[0]); if (z) { const min = Number(args[1]), max = Number(args[2]); [...z.entries()].forEach(([m, sc]) => { if (sc >= min && sc <= max) z.delete(m); }); } return 0; }
    case "ZCARD": return mem.z.get(args[0])?.size ?? 0;
    default: return null;
  }
}

/** Execute a pipeline of Redis commands; returns the array of results. */
export async function pipe(cmds: Cmd[]): Promise<unknown[]> {
  if (cmds.length === 0) return [];
  if (!kvEnabled) return cmds.map(memExec);
  try {
    const res = await fetch(`${URL_}/pipeline`, {
      method: "POST",
      headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify(cmds),
      cache: "no-store",
    });
    const data = await res.json();
    return Array.isArray(data) ? data.map((d: { result?: unknown }) => d?.result ?? null) : cmds.map(() => null);
  } catch {
    return cmds.map(() => null);
  }
}

/** Convert a Redis HGETALL flat array into a { field: number } object. */
export function hToObj(arr: unknown): Record<string, number> {
  const o: Record<string, number> = {};
  if (Array.isArray(arr)) for (let i = 0; i < arr.length; i += 2) o[String(arr[i])] = Number(arr[i + 1]);
  return o;
}
