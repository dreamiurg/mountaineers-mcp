import * as path from "node:path";
import type { BrowserContext } from "patchright";
import { chromium } from "patchright";
import { appCacheDir, type ClearanceCookie } from "./clearance.js";

const LOGIN_URL = "https://www.mountaineers.org/login";
const WANTED = new Set(["cf_clearance", "__cf_bm", "__ac"]);
const CHALLENGE_TIMEOUT_MS = 45_000;
const LOGIN_TIMEOUT_MS = 30_000;

function profileDir(): string {
  return path.join(appCacheDir(), "chrome-profile");
}

export async function mintClearance(
  username: string,
  password: string,
): Promise<{ userAgent: string; cookies: ClearanceCookie[] }> {
  let context: BrowserContext;
  try {
    context = await chromium.launchPersistentContext(profileDir(), {
      channel: "chrome",
      headless: false,
    });
  } catch (e) {
    throw new Error(
      `Failed to launch Chrome. If a previous run crashed, delete ${profileDir()} and retry. Cause: ${e instanceof Error ? e.message : String(e)}`,
    );
  }

  try {
    const page = context.pages()[0] ?? (await context.newPage());

    await page.goto(LOGIN_URL, { waitUntil: "domcontentloaded" });

    // Cloudflare's managed challenge for a real headed browser usually resolves
    // with no visible interstitial — the page title is never "just a moment" and
    // the cf_clearance cookie is set a moment after the page renders. So gate on
    // the cookie appearing, not on the title.
    const deadline = Date.now() + CHALLENGE_TIMEOUT_MS;
    let hasClearance = false;
    while (Date.now() < deadline) {
      if ((await context.cookies()).some((c) => c.name === "cf_clearance")) {
        hasClearance = true;
        break;
      }
      await page.waitForTimeout(1000);
    }
    if (!hasClearance) {
      throw new Error(
        `Cloudflare did not issue a cf_clearance cookie within ${CHALLENGE_TIMEOUT_MS / 1000}s.`,
      );
    }

    const userAgent = await page.evaluate(() => navigator.userAgent);

    // Plone login form. Field names per project memory: __ac_name / __ac_password,
    // submit button name="buttons.login". Verify selectors on first run.
    await page.fill("#__ac_name", username);
    await page.fill("#__ac_password", password);
    await page.click('input[name="buttons.login"], button[name="buttons.login"]');
    try {
      await page.waitForFunction(
        () => document.body?.classList.contains("userrole-authenticated") ?? false,
        undefined,
        { timeout: LOGIN_TIMEOUT_MS },
      );
    } catch {
      const errText = await page
        .$eval(".portalMessage.error", (el) => el.textContent?.trim())
        .catch(() => null);
      throw new Error(
        errText ? `Login failed: ${errText}` : "Login timed out — check credentials or network.",
      );
    }

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
