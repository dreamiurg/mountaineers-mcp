import * as cheerio from "cheerio";
import { describe, expect, it, vi } from "vitest";
import type { MountaineersClient } from "../../client.js";
import { getMyBadges } from "../../tools/get-my-badges.js";

function makeHomepageHtml(slug: string): string {
  return `<html><body><a href="/members/${slug}">My Profile</a></body></html>`;
}

function makeProfileHtml(
  name: string,
  badges: { name: string; earned?: string; expires?: string }[] = [],
): string {
  const badgesHtml = badges
    .map((b) => {
      const title = [
        b.earned ? `Earned: ${b.earned}` : "",
        b.expires ? `Expires: ${b.expires}` : "",
      ]
        .filter(Boolean)
        .join("; ");
      return `<div class="badge"><a href="/badge/${b.name}" ${title ? `title="${title}"` : ""}>${b.name}</a></div>`;
    })
    .join("");

  return `<html><head><title>${name} — The Mountaineers</title></head><body>
    <h1>Profile</h1><h1>${name}</h1>
    <ul class="details">
      <li>Member since: 2020-01-01</li>
      <li>Branch: <a href="/branches/seattle">Seattle</a></li>
    </ul>
    <div class="profile-badges">${badgesHtml}</div>
  </body></html>`;
}

function createMockClient(
  slug = "jane-doe",
  badges: { name: string; earned?: string; expires?: string }[] = [],
): MountaineersClient {
  const homePage = cheerio.load(makeHomepageHtml(slug));
  const profileHtml = makeProfileHtml("Jane Doe", badges);
  const nameProfilePage = cheerio.load(profileHtml);
  const badgesProfilePage = cheerio.load(profileHtml);

  return {
    fetchFacetedQuery: vi.fn(),
    fetchHtml: vi
      .fn()
      .mockResolvedValueOnce(homePage) // whoami: homepage
      .mockResolvedValueOnce(nameProfilePage) // whoami: profile page
      .mockResolvedValueOnce(badgesProfilePage), // get-my-badges: profile page
    fetchJson: vi.fn(),
    fetchRaw: vi.fn(),
    fetchRosterTab: vi.fn(),
    ensureLoggedIn: vi.fn(),
    baseUrl: "https://www.mountaineers.org",
    isLoggedIn: true,
    hasCredentials: true,
  } as unknown as MountaineersClient;
}

describe("getMyBadges", () => {
  it("returns badges from user profile", async () => {
    const client = createMockClient("jane-doe", [
      { name: "Basic Alpine Climbing", earned: "2020-06-15", expires: "2025-06-15" },
      { name: "Wilderness Navigation", earned: "2021-03-01" },
    ]);

    const result = await getMyBadges(client, {});
    expect(result.items).toHaveLength(2);
    expect(result.total_count).toBe(2);
    expect(result.limit).toBe(0);
    expect(result.items[0].name).toBe("Basic Alpine Climbing");
    expect(result.items[0].earned).toBe("2020-06-15");
    expect(result.items[0].expires).toBe("2025-06-15");
    expect(result.items[1].name).toBe("Wilderness Navigation");
    expect(result.items[1].earned).toBe("2021-03-01");
    expect(result.items[1].expires).toBeNull();
  });

  it("returns empty items when no badges", async () => {
    const client = createMockClient();
    const result = await getMyBadges(client, {});
    expect(result.items).toEqual([]);
    expect(result.total_count).toBe(0);
  });

  describe("filtering", () => {
    it("filters by active_only (excludes expired badges)", async () => {
      const client = createMockClient("jane-doe", [
        { name: "Active Badge", earned: "2024-01-01", expires: "2099-12-31" },
        { name: "Expired Badge", earned: "2020-01-01", expires: "2020-12-31" },
        { name: "No Expiry Badge", earned: "2021-01-01" },
      ]);
      const result = await getMyBadges(client, { active_only: true });
      expect(result.items).toHaveLength(2);
      expect(result.items.map((b) => b.name)).toEqual(["Active Badge", "No Expiry Badge"]);
    });

    it("filters by name (case-insensitive substring)", async () => {
      const client = createMockClient("jane-doe", [
        { name: "Basic Alpine Climbing", earned: "2020-06-15" },
        { name: "Wilderness Navigation", earned: "2021-03-01" },
        { name: "Alpine Scrambling", earned: "2022-01-01" },
      ]);
      const result = await getMyBadges(client, { name: "alpine" });
      expect(result.items).toHaveLength(2);
      expect(result.items.map((b) => b.name)).toEqual([
        "Basic Alpine Climbing",
        "Alpine Scrambling",
      ]);
    });

    it("combines active_only and name filters", async () => {
      const client = createMockClient("jane-doe", [
        { name: "Basic Alpine Climbing", earned: "2020-06-15", expires: "2020-12-31" },
        { name: "Alpine Scrambling", earned: "2022-01-01", expires: "2099-12-31" },
        { name: "Wilderness Navigation", earned: "2021-03-01" },
      ]);
      const result = await getMyBadges(client, { active_only: true, name: "alpine" });
      expect(result.items).toHaveLength(1);
      expect(result.items[0].name).toBe("Alpine Scrambling");
    });
  });

  it("calls ensureLoggedIn", async () => {
    const client = createMockClient();
    await getMyBadges(client, {});
    expect(client.ensureLoggedIn).toHaveBeenCalled();
  });

  it("fetches the correct profile page", async () => {
    const client = createMockClient("jane-doe");
    await getMyBadges(client, {});
    expect(client.fetchHtml).toHaveBeenCalledWith("/members/jane-doe", {
      authenticated: true,
    });
  });
});
