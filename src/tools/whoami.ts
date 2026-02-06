import type { MountaineersClient } from "../client.js";

export interface WhoamiResult {
  name: string;
  slug: string;
  profile_url: string;
}

export async function whoami(client: MountaineersClient): Promise<WhoamiResult> {
  await client.ensureLoggedIn();
  const $ = await client.fetchHtml("/", { authenticated: true });

  // Find "My Profile" link — the exact text match for the profile root URL
  let foundUrl: string | null = null;

  $("a[href*='/members/']").each((_i, el) => {
    const href = $(el).attr("href") || "";
    const text = $(el).text().trim();
    if (text === "My Profile" && href.includes("/members/")) {
      foundUrl = href.startsWith("http") ? href : `${client.baseUrl}${href}`;
      return false; // break
    }
  });

  if (!foundUrl) {
    throw new Error("Could not find profile URL. Are you logged in?");
  }
  const profileUrl: string = foundUrl;

  // Extract slug from URL: /members/slug or /members/slug/...
  const slugMatch = profileUrl.match(/\/members\/([^/]+)/);
  const slug = slugMatch ? slugMatch[1] : "";

  // Fetch profile page to get actual display name
  let name: string | null = null;
  const $profile = await client.fetchHtml(`/members/${slug}`, {
    authenticated: true,
  });
  // Profile page has two h1s: "Profile" and the actual name
  $profile("h1").each((_i, el) => {
    const t = $profile(el).text().trim();
    if (t && t.toLowerCase() !== "profile") {
      name = t;
      return false;
    }
  });
  if (!name) {
    // Fallback: extract from <title> tag ("Name — The Mountaineers")
    const title = $profile("title").text().trim();
    const titleMatch = title.match(/^(.+?)\s*[—–-]\s*/);
    name = titleMatch ? titleMatch[1].trim() : slug;
  }

  return {
    name: name || slug,
    slug,
    profile_url: profileUrl,
  };
}
