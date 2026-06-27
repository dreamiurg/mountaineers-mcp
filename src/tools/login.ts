import { mintClearance } from "../browser-auth.js";
import { cachePath, formatCookieExpiry, saveClearance } from "../clearance.js";

export interface LoginResult {
  message: string;
  cache_path: string;
  expires: string;
}

/**
 * Open a headed browser so the user can sign in to mountaineers.org, then cache
 * the resulting Cloudflare clearance + session cookies for all other tools.
 *
 * No credentials pass through this process: the user types them into the real
 * mountaineers.org page in the browser window. If the browser's persistent
 * profile is already signed in, this completes immediately.
 */
export async function login(): Promise<LoginResult> {
  const { userAgent, cookies } = await mintClearance();
  saveClearance(userAgent, cookies);

  const cf = cookies.find((c) => c.name === "cf_clearance");
  const expires = formatCookieExpiry(cf?.expires);

  return {
    message: "Signed in. Your session is cached; other tools will now work.",
    cache_path: cachePath(),
    expires,
  };
}
