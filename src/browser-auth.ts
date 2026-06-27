import * as path from "node:path";
import type { BrowserContext, Page } from "patchright";
import { chromium } from "patchright";
import { appCacheDir, type ClearanceCookie } from "./clearance.js";

const LOGIN_URL = "https://www.mountaineers.org/login";
const CLEARANCE_COOKIE_NAMES = new Set(["cf_clearance", "__cf_bm", "__ac"]);
const CHALLENGE_TIMEOUT_MS = 45_000;
const AUTOFILL_LOGIN_TIMEOUT_MS = 30_000;
const MANUAL_LOGIN_TIMEOUT_MS = 180_000;

interface Credentials {
  username: string;
  password: string;
}

function profileDir(): string {
  return path.join(appCacheDir(), "chrome-profile");
}

async function launchContext(): Promise<BrowserContext> {
  try {
    return await chromium.launchPersistentContext(profileDir(), {
      channel: "chrome",
      headless: false,
    });
  } catch (e) {
    throw new Error(
      `Failed to launch Chrome. If a previous run crashed, delete ${profileDir()} and retry. Cause: ${e instanceof Error ? e.message : String(e)}`,
    );
  }
}

/**
 * Cloudflare's managed challenge for a real headed browser usually resolves with
 * no visible interstitial — the page title is never "just a moment" and the
 * cf_clearance cookie is set a moment after the page renders. So gate on the
 * cookie appearing, not on the title.
 */
async function waitForClearanceCookie(context: BrowserContext, page: Page): Promise<void> {
  const deadline = Date.now() + CHALLENGE_TIMEOUT_MS;
  const hasClearance = async () => (await context.cookies()).some((c) => c.name === "cf_clearance");
  // Re-check after each sleep (not just at the top) so a cookie that lands during
  // the final wait is caught rather than racing the timeout throw.
  let found = await hasClearance();
  while (!found && Date.now() < deadline) {
    await page.waitForTimeout(250);
    found = await hasClearance();
  }
  if (!found) {
    throw new Error(
      `Browser sign-in did not complete within ${CHALLENGE_TIMEOUT_MS / 1000}s. Try closing other Chrome windows and retrying.`,
    );
  }
}

/**
 * Drive the Plone login to the authenticated state. With `creds`, the form is
 * auto-filled and submitted; without, we wait for the user to sign in manually
 * in the browser window. Field names per project memory: __ac_name /
 * __ac_password, submit button name="buttons.login".
 */
async function completeLogin(page: Page, creds?: Credentials): Promise<void> {
  if (creds) {
    await page.fill("#__ac_name", creds.username);
    await page.fill("#__ac_password", creds.password);
    await page.click('input[name="buttons.login"], button[name="buttons.login"]');
  }
  // Auto-fill resolves in seconds; a manual login needs time for the human to
  // type (or is instant if the persistent profile is already signed in).
  const timeout = creds ? AUTOFILL_LOGIN_TIMEOUT_MS : MANUAL_LOGIN_TIMEOUT_MS;
  try {
    await page.waitForFunction(
      () => document.body?.classList.contains("userrole-authenticated") ?? false,
      undefined,
      { timeout },
    );
  } catch {
    // $eval throws when the selector doesn't match; null means no Plone error was shown.
    const errText = await page
      .$eval(".portalMessage.error", (el) => el.textContent?.trim())
      .catch(() => null);
    if (errText) throw new Error(`Login failed: ${errText}`);
    throw new Error(
      creds
        ? "Login timed out — check credentials or network."
        : "Login timed out — no login was completed in the browser window in time.",
    );
  }
}

async function harvestCookies(context: BrowserContext): Promise<ClearanceCookie[]> {
  return (await context.cookies())
    .filter((c) => CLEARANCE_COOKIE_NAMES.has(c.name))
    .map((c) => ({
      name: c.name,
      value: c.value,
      domain: c.domain,
      path: c.path,
      expires: c.expires,
    }));
}

/**
 * Open a headed Chrome, clear the Cloudflare challenge, complete the Plone login,
 * and harvest the clearance + session cookies.
 *
 * With `creds`, the login form is auto-filled and submitted (used by the
 * `npm run login` CLI). Without `creds`, the form is left for the user to fill
 * in the browser window — no password touches this process — and we wait for the
 * authenticated state (used by the `login` MCP tool).
 */
export async function mintClearance(
  creds?: Credentials,
): Promise<{ userAgent: string; cookies: ClearanceCookie[] }> {
  const context = await launchContext();
  try {
    // launchPersistentContext always opens one page; newPage() is a safety fallback.
    const page = context.pages()[0] ?? (await context.newPage());
    await page.goto(LOGIN_URL, { waitUntil: "domcontentloaded" });
    await waitForClearanceCookie(context, page);
    const userAgent = await page.evaluate(() => navigator.userAgent);
    await completeLogin(page, creds);
    const cookies = await harvestCookies(context);
    // userrole-authenticated should imply a session cookie, but guard against a
    // degenerate harvest: without __ac, loadClearance would reject the cache and
    // every auth tool would silently fail despite an apparently successful login.
    if (!cookies.some((c) => c.name === "__ac")) {
      throw new Error(
        "Signed in but no session cookie (__ac) was issued. Try deleting the Chrome profile and running login again.",
      );
    }
    return { userAgent, cookies };
  } finally {
    await context.close();
  }
}
