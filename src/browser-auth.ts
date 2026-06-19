// src/browser-auth.ts
import * as os from "node:os";
import * as path from "node:path";
import type { BrowserContext } from "patchright";
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
  let context: BrowserContext;
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
