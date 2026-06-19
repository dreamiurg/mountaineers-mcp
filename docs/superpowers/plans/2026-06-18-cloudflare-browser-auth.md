# Cloudflare-aware Auth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore mountaineers-mcp auth after the site went behind a Cloudflare managed challenge, by minting cookies in a headed browser (`npm run login`) and replaying them in the MCP's direct `fetch` calls.

**Architecture:** A separate interactive command (`npm run login`) drives a headed `patchright` Chrome to solve the Cloudflare challenge and complete the Plone login, harvesting `cf_clearance`/`__cf_bm`/`__ac` cookies + the real User-Agent into a JSON cache. The background MCP server only *consumes* the cache: it attaches the cookies + pinned UA to every request and, on a `403 cf-mitigated:challenge`, reloads the cache once and retries.

**Tech Stack:** TypeScript (ESM, NodeNext), vitest, `patchright` (Node), `tsx`, cheerio.

**Spec:** `docs/superpowers/specs/2026-06-18-cloudflare-browser-auth-design.md`

## Global Constraints

- ESM with NodeNext module resolution — **all relative imports use `.js` extensions** (e.g. `import { loadClearance } from "./clearance.js"`).
- Cookie `expires` values are **Unix seconds** (Playwright/patchright convention). Compare against `Date.now() / 1000`.
- Cookie-expiry rule (every cookie): expired only when `expires > 0 && expires <= now`; `expires <= 0` (incl. `-1` and `0`) = never-expiring session cookie.
- Cache path: `path.join(process.env.XDG_CACHE_HOME ?? path.join(os.homedir(), ".cache"), "mountaineers-mcp", "clearance.json")`.
- Cookies attached to **all** requests (no `authenticated` flag): `cf_clearance`, `__cf_bm`, `__ac`. `__cf_bm` is optional (attach if present; absence does not invalidate the cache).
- Challenge detection is **header-only**: `status === 403 && headers.get("cf-mitigated") === "challenge"`.
- `patchright` is a **devDependency**; `login.ts`/`browser-auth.ts` are operator-only and excluded from the published package. `clearance.*` must ship (imported by `client.ts`).
- Biome formatting + the pre-commit gates (semgrep, biome) must pass on every commit.

---

### Task 1: `clearance.ts` — cache load/save/validate (pure, TDD)

**Files:**
- Create: `src/clearance.ts`
- Test: `src/__tests__/clearance.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `interface ClearanceCookie { name: string; value: string; domain?: string; path?: string; expires?: number }`
  - `interface Clearance { userAgent: string; cookies: ClearanceCookie[] }`
  - `function cachePath(): string`
  - `function loadClearance(now?: number): Clearance | null` — `now` defaults to `Date.now() / 1000`; param exists for testing.
  - `function saveClearance(userAgent: string, cookies: ClearanceCookie[]): void`

- [ ] **Step 1: Write the failing tests**

```typescript
// src/__tests__/clearance.test.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { cachePath, loadClearance, saveClearance } from "../clearance.js";

let tmp: string;

function writeCache(obj: unknown): void {
  const file = cachePath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, typeof obj === "string" ? obj : JSON.stringify(obj));
}

const ok = (over: Record<string, unknown> = {}) => ({
  user_agent: "Mozilla/5.0 (Test) Chrome/126",
  cookies: [
    { name: "cf_clearance", value: "cf", expires: -1 },
    { name: "__cf_bm", value: "bm", expires: -1 },
    { name: "__ac", value: "ac", expires: -1 },
  ],
  saved_at: 1,
  ...over,
});

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "mtn-clr-"));
  process.env.XDG_CACHE_HOME = tmp;
});
afterEach(() => {
  delete process.env.XDG_CACHE_HOME;
  fs.rmSync(tmp, { recursive: true, force: true });
});

describe("cachePath", () => {
  it("honors XDG_CACHE_HOME", () => {
    expect(cachePath()).toBe(path.join(tmp, "mountaineers-mcp", "clearance.json"));
  });
  it("falls back to ~/.cache when XDG unset", () => {
    delete process.env.XDG_CACHE_HOME;
    expect(cachePath()).toBe(path.join(os.homedir(), ".cache", "mountaineers-mcp", "clearance.json"));
  });
});

describe("loadClearance", () => {
  it("returns null when file missing", () => {
    expect(loadClearance()).toBeNull();
  });
  it("returns null on unparseable JSON", () => {
    writeCache("{not json");
    expect(loadClearance()).toBeNull();
  });
  it("returns null when user_agent missing/empty", () => {
    writeCache(ok({ user_agent: "" }));
    expect(loadClearance()).toBeNull();
  });
  it("returns null when cf_clearance absent", () => {
    writeCache(ok({ cookies: [{ name: "__ac", value: "ac", expires: -1 }] }));
    expect(loadClearance()).toBeNull();
  });
  it("returns null when cf_clearance expired", () => {
    writeCache(ok({ cookies: [
      { name: "cf_clearance", value: "cf", expires: 100 },
      { name: "__ac", value: "ac", expires: -1 },
    ] }));
    expect(loadClearance(200)).toBeNull();
  });
  it("returns null when __ac absent", () => {
    writeCache(ok({ cookies: [{ name: "cf_clearance", value: "cf", expires: -1 }] }));
    expect(loadClearance()).toBeNull();
  });
  it("treats expires<=0 (-1 and 0) as session cookies → valid", () => {
    writeCache(ok({ cookies: [
      { name: "cf_clearance", value: "cf", expires: 0 },
      { name: "__ac", value: "ac", expires: -1 },
    ] }));
    const c = loadClearance(9_999_999_999);
    expect(c?.userAgent).toBe("Mozilla/5.0 (Test) Chrome/126");
  });
  it("returns userAgent + cookies on a valid cache", () => {
    writeCache(ok());
    const c = loadClearance(2);
    expect(c?.userAgent).toContain("Chrome");
    expect(c?.cookies).toHaveLength(3);
  });
});

describe("saveClearance round-trips", () => {
  it("writes a file loadClearance can read", () => {
    saveClearance("UA/1", [
      { name: "cf_clearance", value: "x", expires: -1 },
      { name: "__ac", value: "y", expires: -1 },
    ]);
    const c = loadClearance();
    expect(c?.userAgent).toBe("UA/1");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/__tests__/clearance.test.ts`
Expected: FAIL — `Cannot find module '../clearance.js'` / functions undefined.

- [ ] **Step 3: Implement `src/clearance.ts`**

```typescript
// src/clearance.ts
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

export function cachePath(): string {
  const base = process.env.XDG_CACHE_HOME ?? path.join(os.homedir(), ".cache");
  return path.join(base, "mountaineers-mcp", "clearance.json");
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
  const cf = cookies.find((c) => c.name === "cf_clearance");
  if (!cf || isExpired(cf, now)) return null;
  if (!cookies.some((c) => c.name === "__ac")) return null;
  return { userAgent, cookies };
}

export function saveClearance(userAgent: string, cookies: ClearanceCookie[]): void {
  const file = cachePath();
  const payload = { user_agent: userAgent, cookies, saved_at: Date.now() / 1000 };
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(payload));
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/__tests__/clearance.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Format + commit**

```bash
npx biome check --write src/clearance.ts src/__tests__/clearance.test.ts
git add src/clearance.ts src/__tests__/clearance.test.ts
git commit -m "feat: add clearance cookie cache (load/save/validate)"
```

---

### Task 2: package.json — patchright devDependency, login script, package exclusions

**Files:**
- Modify: `package.json` (`scripts`, `devDependencies`, `files`)

**Interfaces:**
- Consumes: nothing.
- Produces: a `login` npm script and an installed `patchright`; later tasks rely on both.

- [ ] **Step 1: Install patchright as a devDependency**

Run: `npm install --save-dev patchright`
Expected: adds `patchright` to `devDependencies`; `package-lock.json` updated.

- [ ] **Step 2: Install the Chrome the solver drives**

Run: `npx patchright install chrome`
Expected: downloads/locates the Chrome channel. If it fails, fall back to `npx patchright install chromium` and set `channel: "chromium"` in Task 3 — note the deviation in the commit message.

- [ ] **Step 3: Add the `login` script and package exclusions**

In `package.json`, add to `scripts`:

```json
"login": "tsx src/login.ts"
```

Replace the `files` array with (operator modules + their tsc artifacts excluded; `clearance.*` still ships):

```json
"files": [
  "dist",
  "!dist/__tests__",
  "!dist/login.js",
  "!dist/login.js.map",
  "!dist/login.d.ts",
  "!dist/login.d.ts.map",
  "!dist/browser-auth.js",
  "!dist/browser-auth.js.map",
  "!dist/browser-auth.d.ts",
  "!dist/browser-auth.d.ts.map"
]
```

- [ ] **Step 4: Verify the build still succeeds**

Run: `npm run build`
Expected: `tsc` exits 0 (no new source files yet, so nothing new emitted — this confirms package.json is still valid JSON and the script ran).

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json
git commit -m "build: add patchright devDependency, login script, package exclusions"
```

---

### Task 3: `browser-auth.ts` — headed solve + Plone login (`mintClearance`)

**Files:**
- Create: `src/browser-auth.ts`

**Interfaces:**
- Consumes: `ClearanceCookie` from `./clearance.js`; `patchright`.
- Produces: `async function mintClearance(username: string, password: string): Promise<{ userAgent: string; cookies: ClearanceCookie[] }>`

No unit test (needs a live browser + real Cloudflare). It is exercised end-to-end by `npm run login` in Task 4. This task's deliverable is a file that **compiles** (`npm run build` clean).

- [ ] **Step 1: Implement `src/browser-auth.ts`**

```typescript
// src/browser-auth.ts
import * as os from "node:os";
import * as path from "node:path";
import { chromium } from "patchright";
import type { ClearanceCookie } from "./clearance.js";

const LOGIN_URL = "https://www.mountaineers.org/login";
const WANTED = new Set(["cf_clearance", "__cf_bm", "__ac"]);
const CHALLENGE_TIMEOUT_MS = 45_000;
const LOGIN_TIMEOUT_MS = 30_000;

function profileDir(): string {
  const base = process.env.XDG_CACHE_HOME ?? path.join(os.homedir(), ".cache");
  return path.join(base, "mountaineers-mcp", "chrome-profile");
}

export async function mintClearance(
  username: string,
  password: string,
): Promise<{ userAgent: string; cookies: ClearanceCookie[] }> {
  let context;
  try {
    context = await chromium.launchPersistentContext(profileDir(), {
      channel: "chrome",
      headless: false,
    });
  } catch (e) {
    throw new Error(
      `Failed to launch Chrome. If a previous run crashed, delete ${profileDir()} and retry. Cause: ${(e as Error).message}`,
    );
  }

  try {
    const page = context.pages()[0] ?? (await context.newPage());
    const userAgent = await page.evaluate(() => navigator.userAgent);

    await page.goto(LOGIN_URL, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(
      () => !document.title.toLowerCase().includes("just a moment"),
      undefined,
      { timeout: CHALLENGE_TIMEOUT_MS },
    );

    const afterChallenge = await context.cookies();
    if (!afterChallenge.some((c) => c.name === "cf_clearance")) {
      throw new Error(
        "Challenge page cleared but no cf_clearance cookie was set (non-managed challenge?).",
      );
    }

    // Plone login form. Field names per project memory: __ac_name / __ac_password,
    // submit button name="buttons.login". Verify selectors on first run.
    await page.fill("#__ac_name", username);
    await page.fill("#__ac_password", password);
    await page.click('input[name="buttons.login"], button[name="buttons.login"]');
    await page.waitForFunction(
      () => document.body.classList.contains("userrole-authenticated"),
      undefined,
      { timeout: LOGIN_TIMEOUT_MS },
    );

    const cookies: ClearanceCookie[] = (await context.cookies())
      .filter((c) => WANTED.has(c.name))
      .map((c) => ({
        name: c.name,
        value: c.value,
        domain: c.domain,
        path: c.path,
        expires: c.expires,
      }));

    return { userAgent, cookies };
  } finally {
    await context.close();
  }
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npm run typecheck`
Expected: exits 0. (If patchright's types name the launch result differently, adjust the `context` typing; do not add `any`.)

- [ ] **Step 3: Format + commit**

```bash
npx biome check --write src/browser-auth.ts
git add src/browser-auth.ts
git commit -m "feat: add headed patchright Cloudflare solve + Plone login"
```

---

### Task 4: `login.ts` — CLI entry, and end-to-end mint

**Files:**
- Create: `src/login.ts`

**Interfaces:**
- Consumes: `mintClearance` from `./browser-auth.js`; `saveClearance`, `cachePath` from `./clearance.js`.
- Produces: the `npm run login` operator command (no exported symbols).

This task's real verification is running `npm run login` against the live site — it validates Tasks 1, 3, and 4 together and the core Cloudflare assumption.

- [ ] **Step 1: Implement `src/login.ts`**

```typescript
// src/login.ts
import { mintClearance } from "./browser-auth.js";
import { cachePath, saveClearance } from "./clearance.js";

async function main(): Promise<void> {
  const username = process.env.MOUNTAINEERS_USERNAME;
  const password = process.env.MOUNTAINEERS_PASSWORD;
  if (!username || !password) {
    console.error(
      "MOUNTAINEERS_USERNAME and MOUNTAINEERS_PASSWORD must be set in the environment.",
    );
    process.exit(1);
  }

  console.error("Opening a browser to solve the Cloudflare challenge and log in...");
  const { userAgent, cookies } = await mintClearance(username, password);
  saveClearance(userAgent, cookies);

  const cf = cookies.find((c) => c.name === "cf_clearance");
  const expiry =
    cf?.expires && cf.expires > 0
      ? new Date(cf.expires * 1000).toISOString()
      : "session (no fixed expiry)";
  console.error(`Saved clearance to ${cachePath()}`);
  console.error(`cf_clearance expires: ${expiry}`);
}

main().catch((e: unknown) => {
  console.error((e as Error).message);
  process.exit(1);
});
```

- [ ] **Step 2: Run the real login (live verification)**

Run (with creds in env, on a machine with a display): `npm run login`
Expected: a Chrome window opens, the challenge clears within 45s, the form submits, and the command prints `Saved clearance to …`. Then confirm the cache exists:

Run: `cat "$(node -e 'const{cachePath}=require("./dist/clearance.js");console.log(cachePath())' 2>/dev/null || echo ~/.cache/mountaineers-mcp/clearance.json)"`
Expected: JSON containing `cf_clearance` and `__ac`.

> If selectors or the success class are wrong, fix them in `src/browser-auth.ts` (Task 3) and re-run. Record any selector correction in this commit.
> If `expires: 0` appears for `__ac` and the cookie behaves as expired, revisit the expiry rule in `clearance.ts` per the spec's epoch caveat.

- [ ] **Step 3: Commit**

```bash
git add src/login.ts src/browser-auth.ts
git commit -m "feat: add npm run login command to mint and cache clearance"
```

---

### Task 5: `client.ts` rework + `index.ts` whoami description (TDD)

**Files:**
- Modify: `src/client.ts`
- Modify: `src/index.ts` (whoami tool description)
- Test: `src/__tests__/client.test.ts` (create)

**Interfaces:**
- Consumes: `loadClearance`, `Clearance`, `ClearanceCookie` from `./clearance.js`.
- Produces: a `MountaineersClient` whose `fetchRaw`/`fetchHtml`/`fetchJson`/`fetchFacetedQuery`/`fetchRosterTab` no longer take an `authenticated` option; a private `ensureClearance()`; header-only challenge detection with one reload+retry.

- [ ] **Step 1: Write the failing client tests**

```typescript
// src/__tests__/client.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { MountaineersClient } from "../client.js";
import * as clearance from "../clearance.js";

const CACHE = {
  userAgent: "Mozilla/5.0 (Test) Chrome/126",
  cookies: [
    { name: "cf_clearance", value: "CF", expires: -1 },
    { name: "__cf_bm", value: "BM", expires: -1 },
    { name: "__ac", value: "AC", expires: -1 },
  ],
};

function res(status: number, headers: Record<string, string> = {}, body = "<html></html>"): Response {
  return new Response(body, { status, headers });
}

afterEach(() => vi.restoreAllMocks());

describe("MountaineersClient with a valid cache", () => {
  beforeEach(() => {
    vi.spyOn(clearance, "loadClearance").mockReturnValue(CACHE);
  });

  it("attaches all three cookies and the pinned UA to every request", async () => {
    const fetchMock = vi.spyOn(global, "fetch").mockResolvedValue(res(200));
    const client = new MountaineersClient();
    await client.fetchRaw("/activities/");
    const [, init] = fetchMock.mock.calls[0];
    const headers = init?.headers as Record<string, string>;
    expect(headers["User-Agent"]).toBe("Mozilla/5.0 (Test) Chrome/126");
    expect(headers.Cookie).toContain("cf_clearance=CF");
    expect(headers.Cookie).toContain("__cf_bm=BM");
    expect(headers.Cookie).toContain("__ac=AC");
  });

  it("reloads the cache once and retries on 403 cf-mitigated:challenge, then throws when still challenged", async () => {
    const fetchMock = vi
      .spyOn(global, "fetch")
      .mockResolvedValue(res(403, { "cf-mitigated": "challenge" }));
    const loadSpy = vi.spyOn(clearance, "loadClearance").mockReturnValue(CACHE);
    const client = new MountaineersClient();
    loadSpy.mockClear();
    await expect(client.fetchRaw("/activities/")).rejects.toThrow(/npm run login/);
    expect(loadSpy).toHaveBeenCalledTimes(1); // one reload during retry
    expect(fetchMock).toHaveBeenCalledTimes(2); // original + one retry
  });

  it("does not retry when the reloaded cache is null", async () => {
    const fetchMock = vi
      .spyOn(global, "fetch")
      .mockResolvedValue(res(403, { "cf-mitigated": "challenge" }));
    const loadSpy = vi.spyOn(clearance, "loadClearance").mockReturnValue(CACHE);
    const client = new MountaineersClient();
    loadSpy.mockReturnValue(null); // cache deleted mid-session
    await expect(client.fetchRaw("/x")).rejects.toThrow(/No Cloudflare clearance/);
    expect(fetchMock).toHaveBeenCalledTimes(1); // no second request
  });

  it("returns a non-CF 403 response unchanged (no CF error)", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(res(403));
    const client = new MountaineersClient();
    const r = await client.fetchRaw("/x");
    expect(r.status).toBe(403);
  });
});

describe("MountaineersClient with no cache", () => {
  it("throws an actionable error on any request", async () => {
    vi.spyOn(clearance, "loadClearance").mockReturnValue(null);
    const client = new MountaineersClient();
    await expect(client.fetchRaw("/x")).rejects.toThrow(/Run `npm run login`/);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/__tests__/client.test.ts`
Expected: FAIL — current client still has `login()`/cookie-capture model; assertions on UA/Cookie/retry do not hold.

- [ ] **Step 3: Rework `src/client.ts`**

Apply these edits to `src/client.ts`:

1. Add import at top: `import { loadClearance, type Clearance } from "./clearance.js";`
2. Replace the fields/constructor block. Remove `cookies`, `loggedIn`, `username`, `password` and the `MountaineersMCP/0.1.0` model; add:

```typescript
  private clearance: Clearance | null;

  constructor() {
    this.clearance = loadClearance();
  }
```

3. Delete `login()`, `ensureLoggedIn()`, `captureCookies()`, `buildCookieHeader()`, the `isLoggedIn` getter, and the `hasCredentials` getter. Add:

```typescript
  private ensureClearance(): void {
    if (!this.clearance) {
      throw new Error(
        "No Cloudflare clearance found. Run `npm run login` to authenticate.",
      );
    }
  }

  private cookieHeader(): string {
    if (!this.clearance) return "";
    return this.clearance.cookies
      .map((c) => `${c.name}=${c.value}`)
      .join("; ");
  }

  private isChallenge(response: Response): boolean {
    return response.status === 403 && response.headers.get("cf-mitigated") === "challenge";
  }
```

4. Replace `fetchRaw` with (note: `authenticated` option removed):

```typescript
  async fetchRaw(
    url: string,
    options: { headers?: Record<string, string> } = {},
  ): Promise<Response> {
    this.ensureClearance();

    const fullUrl = url.startsWith("http") ? url : `${BASE_URL}${url}`;
    const send = () => {
      const headers: Record<string, string> = {
        "User-Agent": this.clearance!.userAgent,
        Cookie: this.cookieHeader(),
        ...options.headers,
      };
      return fetch(fullUrl, { headers, redirect: "follow" });
    };

    await this.rateLimit();
    let response = await send();

    if (this.isChallenge(response)) {
      await response.body?.cancel(); // release the socket; do not read the body
      this.clearance = loadClearance();
      if (!this.clearance) {
        throw new Error(
          "No Cloudflare clearance found. Run `npm run login` to authenticate.",
        );
      }
      await this.rateLimit();
      response = await send();
      if (this.isChallenge(response)) {
        await response.body?.cancel();
        throw new Error(
          "Cloudflare clearance expired. Run `npm run login` to re-authenticate.",
        );
      }
    }

    return response;
  }
```

5. Remove the `authenticated?: boolean` option and its pass-through from `fetchHtml`, `fetchJson`, and `fetchFacetedQuery`. In `fetchRosterTab`, drop the `authenticated: true` argument in its internal `fetchRaw` call.

- [ ] **Step 4: Update the `whoami` tool description in `src/index.ts`**

Replace the full string:
`"Get the currently logged-in user's name, slug, and profile URL. Requires MOUNTAINEERS_USERNAME and MOUNTAINEERS_PASSWORD env vars."`
with:
`"Get the currently logged-in user's name, slug, and profile URL. Requires a valid Cloudflare clearance cache (run \`npm run login\` first)."`

- [ ] **Step 5: Run the new client tests to verify they pass**

Run: `npx vitest run src/__tests__/client.test.ts`
Expected: PASS (all cases).

- [ ] **Step 6: Run typecheck (expect tool-test breakage, fixed in Task 6)**

Run: `npm run typecheck`
Expected: errors only in `src/__tests__/tools/*.test.ts` referencing removed symbols (`ensureLoggedIn`, `hasCredentials`, `isLoggedIn`, `authenticated`). No errors in `src/client.ts` or `src/index.ts`.

- [ ] **Step 7: Commit**

```bash
npx biome check --write src/client.ts src/index.ts src/__tests__/client.test.ts
git add src/client.ts src/index.ts src/__tests__/client.test.ts
git commit -m "feat: replace direct-fetch login with cached clearance + retry"
```

---

### Task 6: Sweep tool-test mocks to green

**Files:**
- Modify: every test under `src/__tests__/tools/` whose mock client references removed symbols (~26 files).

**Interfaces:**
- Consumes: the reworked `MountaineersClient` from Task 5.
- Produces: a fully green suite + clean typecheck.

- [ ] **Step 1: Find the affected files**

Run: `grep -rln 'ensureLoggedIn\|hasCredentials\|isLoggedIn\|authenticated' src/__tests__/tools/`
Expected: the list of files to edit.

- [ ] **Step 2: Apply the mechanical mock cleanup in each file**

In each mock client object / call assertion:
- rename the `ensureLoggedIn` mock to `ensureClearance` (and any `expect(client.ensureLoggedIn).toHaveBeenCalled()` → `ensureClearance`);
- delete `hasCredentials: true` and `isLoggedIn: true` mock fields;
- remove the `{ authenticated: true }` argument from any `fetchHtml`/`fetchJson`/`fetchRaw`/`fetchRosterTab` call assertions.

`src/__tests__/tools/whoami.test.ts` is the behaviorally significant one (it asserts the auth method was called) — verify its assertion now targets `ensureClearance`. The rest are mechanical.

- [ ] **Step 3: Run the full suite**

Run: `npm test`
Expected: PASS — all test files green.

- [ ] **Step 4: Run typecheck**

Run: `npm run typecheck`
Expected: exits 0 (no references to removed symbols remain).

- [ ] **Step 5: Commit**

```bash
npx biome check --write src/__tests__/tools/
git add src/__tests__/tools/
git commit -m "test: update tool mocks for cached-clearance client"
```

---

### Task 7: Full gate + docs

**Files:**
- Modify: `README.md` (auth setup section)

**Interfaces:**
- Consumes: everything above.
- Produces: a green CI gate and operator-facing docs.

- [ ] **Step 1: Run the full CI gate locally**

Run: `npm run ci`
Expected: typecheck, lint, SAST, coverage, and build all pass. Coverage threshold (70%) holds — `clearance.ts` and `client.ts` are covered; `browser-auth.ts`/`login.ts` are operator tools (exercised manually). If coverage dips below threshold because of the new untested operator files, exclude `src/browser-auth.ts` and `src/login.ts` from coverage in `vitest.config` (`coverage.exclude`) — they are not unit-testable.

- [ ] **Step 2: Verify the published package excludes operator modules**

Run: `npm run build && npm pack --dry-run`
Expected: the listed files include `dist/clearance.js` but **not** `dist/login.js` or `dist/browser-auth.js` (nor their `.map`/`.d.ts`).

- [ ] **Step 3: Document the auth flow in README**

Add an "Authentication" subsection explaining: the site is behind Cloudflare; run `npm run login` (from a checkout, with `MOUNTAINEERS_USERNAME`/`MOUNTAINEERS_PASSWORD` set) to open a browser, solve the challenge, and cache cookies; the MCP server reads the cache; re-run `login` when tools report "Cloudflare clearance expired". Note the macOS/display requirement and that npm-only consumers cannot run `login`.

- [ ] **Step 4: Commit**

```bash
git add README.md vitest.config.ts 2>/dev/null; git add README.md
git commit -m "docs: document Cloudflare login flow"
```

---

## Self-Review

**Spec coverage:**
- clearance cache (load/save/validate, expiry rule, cachePath) → Task 1. ✓
- patchright devDependency + login script + package exclusions → Task 2. ✓
- `mintClearance` headed solve + Plone login + cookie harvest → Task 3. ✓
- `npm run login` CLI + live mint → Task 4. ✓
- client rework (delete login/state, ensureClearance, unconditional cookies, header-only 403 reload+retry, body.cancel, no-flag) → Task 5. ✓
- whoami tool description → Task 5 Step 4. ✓
- tool-test mock sweep → Task 6. ✓
- full gate, package-exclusion verification, README → Task 7. ✓
- Assumptions (display requirement, expires:0 epoch, selector verification) → surfaced as inline notes in Tasks 3/4. ✓

**Placeholder scan:** No TBD/TODO; every code step shows real code; commands have expected output. ✓

**Type consistency:** `Clearance`/`ClearanceCookie` defined in Task 1 and consumed verbatim in Tasks 3 & 5; `loadClearance(now?)`, `saveClearance`, `cachePath`, `mintClearance`, `ensureClearance`, `isChallenge`, `cookieHeader` names consistent across tasks. ✓
