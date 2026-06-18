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
- The hardcoded `User-Agent: MountaineersMCP/0.1.0` almost certainly trips the
  bot filter on its own.

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

### 1. `src/clearance.ts` — pure cache logic (unit-testable)

No browser, no network. Just read/write/validate the clearance cache file.

- **Cache path:** `${XDG_CACHE_HOME or ~/.cache}/mountaineers-mcp/clearance.json`
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
- **`loadClearance(): Clearance | null`**: returns `null` when
  - file is missing or unreadable/unparseable, or
  - `cf_clearance` cookie is absent, or
  - `cf_clearance` is expired (`0 < expires <= now`), or
  - `__ac` cookie is absent (we need an authenticated session).

  A `cf_clearance` with `expires == -1` (session cookie) is treated as valid.

### 2. `src/browser-auth.ts` — headed solve + login (not unit-tested)

Side-effecting, needs a live browser and real Cloudflare. Exercised by manually
running `npm run login`.

- **`mintClearance(username, password): Promise<{userAgent, cookies}>`**
  1. Launch headed Chrome via `patchright` `launchPersistentContext` with a
     persistent profile dir at `${cache}/mountaineers-mcp/chrome-profile`,
     `channel: 'chrome'`, `headless: false`.
  2. Navigate to `https://www.mountaineers.org/login`.
  3. Wait for the CF challenge to clear: poll until the page title no longer
     contains "just a moment" (case-insensitive), with a ~45s timeout; then
     assert a `cf_clearance` cookie exists (else throw — non-managed challenge).
  4. Perform the Plone login in the page: fill `#__ac_name` / `#__ac_password`,
     submit, wait until the body has class `userrole-authenticated` (login
     success signal documented in project memory).
  5. Read the browser's real `navigator.userAgent`.
  6. Harvest cookies `cf_clearance`, `__cf_bm`, `__ac` from the context.
  7. Return `{userAgent, cookies}`.

  Throws actionable errors: challenge-not-solved, no `cf_clearance`, login-failed
  (still `userrole-anonymous`).

### 3. `src/login.ts` — CLI entry (`npm run login`)

- Reads `MOUNTAINEERS_USERNAME` / `MOUNTAINEERS_PASSWORD` from env (same vars
  already in `.mcp.json`). The **login command is the only consumer of
  credentials**; the MCP server no longer reads them.
- Calls `mintClearance()` → `saveClearance()`.
- Prints success, the cache path, and the `cf_clearance` expiry so the user knows
  roughly when to re-run.
- Wired in `package.json` as `"login": "tsx src/login.ts"`.

### 4. Changes to `src/client.ts`

- **Constructor:** call `loadClearance()`. Store cookies and the pinned
  `userAgent`. Stop reading `MOUNTAINEERS_USERNAME` / `PASSWORD`.
- **User-Agent:** replace the hardcoded `MountaineersMCP/0.1.0` everywhere with
  the pinned UA from the cache. Fall back to a realistic Chrome UA only when no
  cache exists (so the "run login" error path still functions).
- **Cookies on every request:** attach `cf_clearance` / `__cf_bm` / `__ac` to
  **all** `fetchRaw` calls (public and authenticated), since CF now gates the
  whole site. `__ac` is harmless on public requests.
- **Delete** the direct-fetch `login()` method (cannot pass CF).
- **`ensureLoggedIn()` → `ensureClearance()`:** if no cached clearance, throw:
  `"No Cloudflare clearance found. Run \`npm run login\` to authenticate."`
- **Challenge re-detection in `fetchRaw`:** if a response is `403` with
  `cf-mitigated: challenge` (or body contains "Just a moment" in the first
  2000 chars), throw:
  `"Cloudflare clearance expired. Run \`npm run login\` to re-authenticate."`
  No auto-launch.
- On a cache-miss/expiry error, the user runs `npm run login`; the next MCP tool
  call constructs a fresh client (or re-reads the cache) and picks up new cookies.

## Data flow

```
[ npm run login ] --env creds--> mintClearance() --headed patchright-->
    Cloudflare solved + Plone login --> harvest cookies+UA --> saveClearance()
        --> ~/.cache/mountaineers-mcp/clearance.json

[ MCP tool call ] --> MountaineersClient (loadClearance) --cookies+pinned UA-->
    fetchRaw --> mountaineers.org (200)
        |
        +-- 403 cf-mitigated:challenge --> throw "run npm run login"
```

## Error handling

- Missing/expired/invalid cache → fast, actionable error naming the exact command.
- `mintClearance` failures (challenge timeout, no `cf_clearance`, login still
  anonymous) → distinct messages so the user knows which stage failed.
- Cache write failure → warn but do not crash the login command.

## Testing

Per project testing philosophy: test logic, not the browser.

- **`clearance.ts`** (unit): parse valid file; missing file → null; unparseable →
  null; expired `cf_clearance` → null; missing `__ac` → null; session-cookie
  `cf_clearance` (`expires == -1`) → valid.
- **`client.ts`** (unit, mocked `fetch`): cookie-header building from cache; UA
  pinning (pinned UA used, not the default); `403 cf-mitigated:challenge` →
  "run npm run login" error; no-cache → `ensureClearance` throws.
- **`browser-auth.ts`**: no unit tests — covered by manually running
  `npm run login` against the live site.
- Update/remove existing client tests that assumed the old `login()` flow.

## Dependencies

- Add `patchright` (npm) as a runtime **dependency** (needed by `npm run login`),
  plus its Chrome channel. **Verify the package installs during implementation**;
  if patchright-node is unviable, fall back to `playwright` +
  `playwright-extra` + `puppeteer-extra-plugin-stealth`.

## Out of scope (YAGNI)

- Auto-relogin / auto-launching the browser from the MCP.
- Proxy or interactive-Turnstile captcha-solver fallback (browser-use Cloud,
  ScrapingBee, etc.). Revisit only if the site escalates beyond a managed
  challenge.
- Scheduled / background cookie refresh.

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
