import { mintClearance } from "./browser-auth.js";
import { cachePath, formatCookieExpiry, saveClearance } from "./clearance.js";

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
  const { userAgent, cookies } = await mintClearance({ username, password });
  saveClearance(userAgent, cookies);

  const cf = cookies.find((c) => c.name === "cf_clearance");
  const expiry = formatCookieExpiry(cf?.expires);
  console.error(`Saved clearance to ${cachePath()}`);
  console.error(`cf_clearance expires: ${expiry}`);
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : String(e));
  process.exit(1);
});
