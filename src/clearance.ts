import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

export interface ClearanceCookie {
  name: string;
  value: string;
  domain?: string;
  path?: string;
  expires?: number;
}

export interface Clearance {
  userAgent: string;
  cookies: ClearanceCookie[];
}

export function appCacheDir(): string {
  return path.join(
    process.env.XDG_CACHE_HOME ?? path.join(os.homedir(), ".cache"),
    "mountaineers-mcp",
  );
}

export function cachePath(): string {
  return path.join(appCacheDir(), "clearance.json");
}

export function formatCookieExpiry(expires: number | undefined): string {
  return expires && expires > 0
    ? new Date(expires * 1000).toISOString()
    : "session (no fixed expiry)";
}

function isExpired(cookie: ClearanceCookie, now: number): boolean {
  const exp = cookie.expires ?? -1;
  return exp > 0 && exp <= now;
}

export function loadClearance(now: number = Date.now() / 1000): Clearance | null {
  let raw: string;
  try {
    raw = fs.readFileSync(cachePath(), "utf8");
  } catch {
    return null;
  }
  let data: { user_agent?: unknown; cookies?: unknown };
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  const userAgent = data.user_agent;
  if (typeof userAgent !== "string" || userAgent.length === 0) return null;
  const cookies = (Array.isArray(data.cookies) ? data.cookies : []) as ClearanceCookie[];
  if (!cookies.every((c) => typeof c?.name === "string" && typeof c?.value === "string"))
    return null;
  const cf = cookies.find((c) => c.name === "cf_clearance");
  if (!cf || isExpired(cf, now)) return null;
  if (!cookies.some((c) => c.name === "__ac")) return null;
  return { userAgent, cookies };
}

export function saveClearance(userAgent: string, cookies: ClearanceCookie[]): void {
  const file = cachePath();
  const payload = { user_agent: userAgent, cookies, saved_at: Date.now() / 1000 };
  const dir = path.dirname(file);
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(payload), { mode: 0o600 });
  fs.renameSync(tmp, file);
}
