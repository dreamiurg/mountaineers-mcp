# Cloudflare-aware auth via headed-browser cookie minting

**Date:** 2026-06-18
**Status:** Approved (design)
**Branch:** `feat/cloudflare-browser-auth`

## Problem

mountaineers.org is now behind a Cloudflare managed challenge. Every endpoint
(homepage, `@@faceted_query`, `/login`) returns `HTTP 403` with header
`cf-mitigated: challenge` for any non-browser client, regardless of User-Agent.

Consequences for the MCP server:

- The existing direct-`fetch` Plone login flow in `src/client.ts` can never reach
  the login form — the CSRF `_authenticator` token is empty, the `__ac` session
  cookie is never set, and `whoami` fails.
- This is **not** a credentials problem. Credentials in `.mcp.json` are valid.
- **All** tools are broken, not just authenticated ones: public searches and
  detail lookups also hit the 403 challenge.
- The hardcoded `User-Agent: MountaineersMCP/0.1.0` (used in `fetchRaw` and the
  soon-to-be-deleted `login()`) almost certainly trips the bot filter on its own.

## Approach

Port the proven pattern from `../peakbagger-cli` (Python: patchright + cached
clearance cookie) to TypeScript, adapted for two differences:

1. Our project is **TypeScript/Node**, not Python — use `patchright` (npm), the
   Node port of the stealth-patched Playwright that peakbagger relied on.
2. Our site **requires authenticated login** (Plone `__ac` cookie), not just a
   Cloudflare clearance — so the login form is filled **inside the headed
   browser** during the same solve, harvesting `__ac` alongside `cf_clearance`.

The MCP server is a **non-interactive background process** (`npx tsx src/index.ts`
launched by Claude Desktop). It cannot pop a headed browser mid-tool-call. So the
headed solve is a **separate interactive command** (`npm run login`) that mints
and caches cookies; the MCP only ever *consumes* the cache.

### Rejected alternatives

- **browser-use** (LLM-driven agent, Python): adds no Cloudflare capability
  beyond the patchright it uses internally; adds language mismatch, LLM cost,
  latency, and nondeterminism to a deterministic 2-field form fill. Its Cloud
  product (paid proxies) is only relevant if the site escalates to interactive
  Turnstile — not the case today.
- **Auto-launch browser from an MCP tool call**: the server runs detached; a
  browser window with no owner blocking a tool call for 30–45s is fragile and
  confusing.
- **Reuse the user's real Chrome profile**: Chrome locks the profile (can't run
  while the user's browser is open) and couples the server to personal state.

## Architecture

Three new modules with clean boundaries, plus changes to `src/client.ts`.
(File/line references below name symbols rather than fixed line numbers, which
drift; line numbers cited in agent review are not reproduced here.)

### 1. `src/clearance.ts` — pure cache logic (unit-testable)

No browser, no network. Just read/write/validate the clearance cache file.

- **Cache path:** resolved by helper `cachePath(): string`:
  `path.join(process.env.XDG_CACHE_HOME ?? path.join(os.homedir(), '.cache'), 'mountaineers-mcp', 'clearance.json')`.
- **Format** (mirrors peakbagger):
  ```json
  {
    "user_agent": "Mozilla/5.0 ...",
    "cookies": [
      {"name": "cf_clearance", "value": "...", "domain": ".mountaineers.org", "path": "/", "expires": 1719432000},
      {"name": "__cf_bm", "value": "...", "domain": ".mountaineers.org", "path": "/", "expires": 1719417600},
      {"name": "__ac", "value": "...", "domain": ".mountaineers.org", "path": "/", "expires": -1}
    ],
    "saved_at": 1719346123.456
  }
  ```
- **`saveClearance(userAgent, cookies)`**: `mkdir -p` the dir, write JSON.
- **`__cf_bm` is optional:** harvest and attach it when present, but its absence
  does not invalidate the cache (it is short-lived bot-management state).
- **`loadClearance(): Clearance | null`**: returns `null` when
  - file is missing or unreadable/unparseable, or
  - `user_agent` is absent or empty, or
  - `cf_clearance` cookie is absent, or
  - `cf_clearance` is expired, or
  - `__ac` cookie is absent (we need an authenticated session).
- **Expiry rule (applies to every cookie):** a cookie is expired only when
  `expires > 0 && expires <= now`. `expires <= 0` (including `-1`, the
  session-cookie sentinel, and `0`) is treated as never-expiring. This single
  rule covers `cf_clearance`, `__cf_bm`, and `__ac`.

### 2. `src/browser-auth.ts` — headed solve + login (not unit-tested)

Side-effecting, needs a live browser and real Cloudflare. Exercised by manually
running `npm run login`.

- **`mintClearance(username, password): Promise<{userAgent, cookies}>`**
  1. Launch headed Chrome via `patchright` `launchPersistentContext` with a
     persistent profile dir at `${cache}/mountaineers-mcp/chrome-profile`,
     `channel: 'chrome'`, `headless: false`. If launch fails with a profile-lock
     error (a prior Chrome crashed), the command should tell the user to delete
     that profile dir and re-run.
  2. Read the browser's real `navigator.userAgent` once (it does not change
     across the rest of the flow).
  3. Navigate to `https://www.mountaineers.org/login`.
  4. Wait for the CF challenge to clear with
     `page.waitForFunction(() => !document.title.toLowerCase().includes('just a moment'), { timeout: 45_000 })`,
     then assert a `cf_clearance` cookie exists (else throw — non-managed
     challenge).
  5. Perform the Plone login in the page: fill `#__ac_name` / `#__ac_password`,
     submit, wait until the body has class `userrole-authenticated` (login
     success signal documented in project memory).
  6. Harvest cookies `cf_clearance`, `__cf_bm`, `__ac` from the context (`__ac`
     is only present after step 5 succeeds).
  7. Return `{userAgent, cookies}`.

  Throws actionable errors: challenge-not-solved, no `cf_clearance`, login-failed
  (still `userrole-anonymous`).

### 3. `src/login.ts` — CLI entry (`npm run login`)

- Add to `package.json` `scripts`: `"login": "tsx src/login.ts"`.
- Reads `MOUNTAINEERS_USERNAME` / `MOUNTAINEERS_PASSWORD` from env (same vars
  already in `.mcp.json`). The login command will be the **only** consumer of
  credentials; §4 removes credential reading from the MCP server.
- Calls `mintClearance()` → `saveClearance()`.
- Prints success, the cache path, and the `cf_clearance` expiry so the user knows
  roughly when to re-run.

### 4. Changes to `src/client.ts`

Order of operations matters — do these in sequence:

1. **Delete the direct-fetch `login()` method.** It cannot pass CF. This also
   removes three of the four hardcoded `MountaineersMCP/0.1.0` occurrences (the
   GET, POST, and redirect-follow requests inside `login()`).
2. **Stop reading credentials and drop login-state tracking:** remove the
   `username`/`password` private field declarations and their constructor
   assignments, the `hasCredentials` getter, and — now vestigial after `login()`
   is deleted — the `loggedIn` field and the `isLoggedIn` getter. The constructor
   instead calls `loadClearance()` into in-memory fields (the cookie list + the
   pinned `userAgent`).
3. **User-Agent:** replace the one remaining hardcoded `MountaineersMCP/0.1.0` in
   `fetchRaw` with the pinned UA from the cache. The fallback when no cache exists
   is moot: `ensureClearance()` (below) throws before any request reaches the
   network. So do not add a fallback UA — after `ensureClearance()` passes, the
   pinned UA is guaranteed non-null; assert that and use it.
4. **Attach cookies unconditionally on every request:** attach
   `cf_clearance` / `__cf_bm` / `__ac` to **all** `fetchRaw` calls, since CF now
   gates the whole site. Remove the existing `if (this.cookies.length > 0)` guard
   — when a cache is loaded, cookies are always attached; `__ac` is harmless on
   public requests.
5. **Replace `ensureLoggedIn()` with `ensureClearance()` and drop the
   `authenticated` flag:** every request now requires clearance (a public request
   without CF cookies also gets a 403), so the `options.authenticated` parameter
   is vestigial — remove the parameter from `fetchRaw`/`fetchHtml`/`fetchJson`
   signatures and their callers; for `fetchRosterTab` (which has no such parameter)
   drop the hardcoded `authenticated: true` argument in its internal `fetchRaw`
   call.
   `fetchRaw` always calls `ensureClearance()`, which throws when no clearance is
   loaded:
   `"No Cloudflare clearance found. Run \`npm run login\` to authenticate."`
6. **Challenge re-detection + one-shot refresh in `fetchRaw`** (the single
   authoritative description of the retry contract). `fetchRaw` returns
   `Promise<Response>`. Detection is **header-only**: a `403` with header
   `cf-mitigated: challenge` means the clearance expired. In the **normal path**,
   `fetchRaw` returns the unconsumed `Response` to callers (who read the body, as
   today) — this includes a non-CF `403` (no `cf-mitigated` header), returned
   unchanged. In the **expired path** it:
   1. cancels the failing response body with `await response.body?.cancel()` to
      release the socket — Node `fetch` leaks the connection if an unread body is
      dropped;
   2. calls `loadClearance()` once to reload from disk; if reload returns `null`,
      throws the no-clearance error immediately (no second request);
   3. otherwise retries the request exactly once. If the retry still returns
      `403 cf-mitigated:challenge`, throws
      `"Cloudflare clearance expired. Run \`npm run login\` to re-authenticate."`

   Retries are bounded to one (no loop). Because `src/index.ts` constructs a
   single `MountaineersClient` at startup, the reload happens inside `fetchRaw`
   (not by re-instantiating), so a fresh `npm run login` takes effect on the next
   tool call without restarting the server.
7. **Update the `whoami` tool description** in `src/index.ts`, replacing the full
   string
   `"Get the currently logged-in user's name, slug, and profile URL. Requires MOUNTAINEERS_USERNAME and MOUNTAINEERS_PASSWORD env vars."`
   with
   `"Get the currently logged-in user's name, slug, and profile URL. Requires a valid Cloudflare clearance cache (run \`npm run login\` first)."`

## Data flow

```
[ npm run login ] --env creds--> mintClearance() --headed patchright-->
    Cloudflare solved + Plone login --> harvest cookies+UA --> saveClearance()
        --> ~/.cache/mountaineers-mcp/clearance.json

[ MCP startup ] --> new MountaineersClient() --> loadClearance() (cookies + pinned UA)
[ MCP tool call ] --> fetchRaw (cookies + pinned UA) --> mountaineers.org (200)
        |
        +-- 403 cf-mitigated:challenge --> reload cache once + retry
                |
                +-- still 403 --> throw "run npm run login"
```

## Error handling

- Missing/expired/invalid cache at startup → `ensureClearance()` throws a fast,
  actionable error naming the exact command, before any request hits the network.
- `mintClearance` failures (challenge timeout, no `cf_clearance`, login still
  anonymous, profile lock) → distinct messages so the user knows which stage
  failed.
- Cache write failure → warn but do not crash the login command.

## Testing

Per project testing philosophy: test logic, not the browser.

- **`clearance.ts`** (unit):
  - valid file → parsed object;
  - missing file → null; unparseable → null;
  - missing/empty `user_agent` → null;
  - expired `cf_clearance` (`expires > 0 && expires <= now`) → null;
  - missing `__ac` → null;
  - session-cookie `cf_clearance` (`expires <= 0`, e.g. `-1` and `0`) → valid;
  - `cachePath()` honors `XDG_CACHE_HOME` and falls back to `~/.cache`.
- **`client.ts`** (unit, mocked `fetch`):
  - every `fetchRaw` call (no `authenticated` flag exists anymore) attaches all
    three cookies from the cache;
  - pinned UA from cache is used;
  - `ensureClearance()` throws when no cache is loaded;
  - `403` with `cf-mitigated: challenge` → assert `loadClearance()` is called once
    and the request is attempted twice, then it throws the "run npm run login"
    message;
  - `403` with `cf-mitigated: challenge` but `loadClearance()` returns `null` on
    reload (cache deleted mid-session) → throws the no-clearance error **without**
    issuing a second network request;
  - non-CF `403` (no `cf-mitigated` header) → does **not** throw the CF message;
    returns the raw `Response` unchanged (callers handle it as they do today).
- **`browser-auth.ts`**: no unit tests — covered by manually running
  `npm run login` against the live site.
- **Existing tests:** remove/update any test that references `client.login()`,
  `ensureLoggedIn()`, `hasCredentials`, the `authenticated` option, or sets
  `MOUNTAINEERS_USERNAME` / `MOUNTAINEERS_PASSWORD` (find with
  `grep -rn 'login\|ensureLoggedIn\|hasCredentials\|isLoggedIn\|authenticated\|MOUNTAINEERS_' src/__tests__/`).
  The same mock-client cleanup applies to **every** affected tool test (~26 files
  under `src/__tests__/tools/`), not just `whoami`: rename the `ensureLoggedIn`
  mock to `ensureClearance` (and any "was called" assertion), and remove the now
  invalid `hasCredentials: true` / `isLoggedIn: true` mock fields and any
  `{ authenticated: true }` argument in `fetchHtml`/`fetchJson`/`fetchRaw` call
  assertions. `src/__tests__/tools/whoami.test.ts` is the behaviorally significant
  one (it asserts the auth method was called); the rest are mechanical. Leaving
  stale mock keys makes the mismatched test silently pass and breaks compilation
  once the real symbols are removed.

## Dependencies

- Add `patchright` (npm) as a **devDependency**, not a runtime dependency:
  `npm run login` is an operator tool, and patchright pulls a full Chrome channel
  that would bloat installs for MCP consumers.
- The published package (`files: ["dist","!dist/__tests__"]`) must **exclude** the
  operator-only modules. `tsc` emits flat into `dist/` (`rootDir: src`,
  `outDir: dist`), and `tsconfig.json` has `declaration`, `declarationMap`, and
  `sourceMap` all `true`, so exclude every emitted artifact for both modules:
  `"!dist/login.js"`, `"!dist/login.js.map"`, `"!dist/login.d.ts"`,
  `"!dist/login.d.ts.map"`, `"!dist/browser-auth.js"`, `"!dist/browser-auth.js.map"`,
  `"!dist/browser-auth.d.ts"`, `"!dist/browser-auth.d.ts.map"`.
  `dist/clearance.*` **must still ship** — `client.ts` imports it at runtime.
- **Consumer caveat:** because patchright is a devDependency and the login modules
  are unpublished, minting cookies requires a **repo checkout** (the operator
  already runs the server from the checkout via `.mcp.json` cwd + `tsx`). npm-only
  consumers (`npx -y mountaineers-mcp`) cannot run `npm run login`; documenting
  this limitation is sufficient — building a shippable login path is YAGNI.
- **Verify `patchright` installs cleanly and passes the current challenge during
  implementation.** If patchright-node proves unviable, the fallback
  (`playwright` + `playwright-extra` + `puppeteer-extra-plugin-stealth`) is a
  separate decision made *at that point* — do **not** add those packages
  preemptively.
- `tsx` is already a `devDependency`; `npm run login` runs from a repo checkout
  where devDependencies are installed, so no new runtime dependency is introduced.

## Out of scope (YAGNI)

- Auto-relogin / auto-launching the browser from the MCP.
- Proxy or interactive-Turnstile captcha-solver fallback (browser-use Cloud,
  ScrapingBee, etc.). Revisit only if the site escalates beyond a managed
  challenge.
- Scheduled / background cookie refresh.
- A shippable (npm-consumer) login path.

## Assumptions (not yet validated)

- `patchright` npm package exists and drives a headed Chrome that passes the
  current managed challenge — verify on first install.
- The observed protection is a **managed challenge** (`cf-mitigated: challenge`),
  which headed real Chrome passes; not interactive Turnstile with TLS/HTTP2
  fingerprinting (which neither patchright nor browser-use's lib fully solves).
- `cf_clearance` is bound to UA + IP; the login command and the MCP run on the
  **same machine** (same egress IP), so the replayed cookie remains valid.
- The Plone login-success signal (`userrole-authenticated` body class) and field
  names (`__ac_name`, `__ac_password`) still hold — documented in project memory.
- The machine running `npm run login` has a graphical display (macOS, or Linux
  with `$DISPLAY`). Headless Linux hosts would need Xvfb or equivalent — out of
  scope.
- patchright serializes session cookies (notably `__ac`) with `expires <= 0`
  meaning "no expiry", not `expires: 0` meaning the Unix epoch. Verify on the
  first `npm run login` that `__ac` serializes with `expires` `< 0`; if patchright
  emits `0` for live session cookies, the expiry rule in `clearance.ts` needs
  adjusting so a real epoch timestamp isn't treated as a session cookie.

## Revision history

- 2026-06-18 — Initial design.
- 2026-06-18 — Simplify pass (round 1): explicit singleton cache-reload mechanism;
  `patchright` moved to devDependency + operator modules excluded from the package;
  header-only 403 detection; unified cookie-expiry rule; tightened browser-auth
  steps, error paths, and test matrix; added display-availability assumption.
- 2026-06-18 — Simplify pass (round 2): removed the now-vestigial `authenticated`
  flag (all requests require clearance; attach cookies unconditionally, drop the
  `cookies.length` guard); dropped the dead fallback UA; switched file references
  from drifting line numbers to symbol names; added source-map/`.d.ts` package
  exclusions; flagged `whoami.test.ts` and the `whoami` tool description;
  profile-lock recovery note.
- 2026-06-18 — Simplify pass (round 3): merged the retry contract into a single
  authoritative step (with `response.body?.cancel()` socket-leak guard and
  `fetchRaw: Promise<Response>` return type); added `fetchRosterTab` to the
  flag-removal list; anchored the full `whoami` description string and the
  `whoami.test.ts` mock edits; added `.d.ts.map` package exclusions; `__cf_bm`
  optionality; null-reload test case; `tsx` devDependency note; `expires: 0`
  epoch caveat.
- 2026-06-18 — Simplify pass (round 4): also remove the vestigial `loggedIn`
  field + `isLoggedIn` getter; corrected the test path to
  `src/__tests__/tools/whoami.test.ts` and generalized the mock cleanup to all
  ~26 tool tests.
