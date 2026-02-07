import * as cheerio from "cheerio";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MountaineersClient } from "../../client.js";
import { getActivity } from "../../tools/get-activity.js";

function makeActivityHtml(
  opts: {
    title?: string;
    date?: string;
    leaders?: { name: string; href?: string; role?: string }[];
  } = {},
): string {
  const title = opts.title ?? "Test Activity";
  const dateLi = opts.date ? `<li>${opts.date}</li>` : "";
  const leadersHtml = (opts.leaders || [])
    .map(
      (l) =>
        `<div class="roster-contact">` +
        `<img alt="${l.name}" src="/members/${l.name.toLowerCase().replace(/ /g, "-")}/portrait" />` +
        (l.href ? `<a href="${l.href}">${l.name}</a>` : `<div>${l.name}</div>`) +
        (l.role ? `<div class="roster-position">${l.role}</div>` : "") +
        `</div>`,
    )
    .join("");

  return `<html><body>
    <h1 class="documentFirstHeading">${title}</h1>
    <div class="program-core">
      <ul class="details">${dateLi}</ul>
    </div>
    <div class="leaders">${leadersHtml}</div>
  </body></html>`;
}

function createMockClient(html?: string): MountaineersClient {
  return {
    fetchFacetedQuery: vi.fn(),
    fetchHtml: vi.fn().mockResolvedValue(cheerio.load(html ?? makeActivityHtml())),
    fetchJson: vi.fn(),
    fetchRaw: vi.fn(),
    fetchRosterTab: vi.fn(),
    ensureLoggedIn: vi.fn(),
    baseUrl: "https://www.mountaineers.org",
    isLoggedIn: false,
    hasCredentials: false,
  } as unknown as MountaineersClient;
}

describe("getActivity", () => {
  let client: MountaineersClient;

  beforeEach(() => {
    client = createMockClient();
  });

  it("uses full URL when input starts with http", async () => {
    const fullUrl = "https://www.mountaineers.org/activities/activities/day-hike-1";
    await getActivity(client, { url: fullUrl });
    expect(client.fetchHtml).toHaveBeenCalledWith(fullUrl);
  });

  it("constructs URL from slug when input is not a full URL", async () => {
    await getActivity(client, { url: "day-hike-rock-candy-mountain-11" });
    expect(client.fetchHtml).toHaveBeenCalledWith(
      "https://www.mountaineers.org/activities/activities/day-hike-rock-candy-mountain-11",
    );
  });

  it("returns parsed activity detail", async () => {
    const result = await getActivity(client, { url: "test-activity" });
    expect(result.title).toBe("Test Activity");
    expect(result.url).toBe("https://www.mountaineers.org/activities/activities/test-activity");
  });

  describe("leaders array", () => {
    it("extracts multiple leaders", async () => {
      const html = makeActivityHtml({
        leaders: [
          { name: "Alice Smith", href: "/members/alice-smith", role: "Leader" },
          { name: "Bob Jones", href: "/members/bob-jones", role: "Co-Leader" },
        ],
      });
      const c = createMockClient(html);
      const result = await getActivity(c, { url: "test" });

      expect(result.leaders).toHaveLength(2);
      expect(result.leaders[0]).toEqual({
        name: "Alice Smith",
        url: "https://www.mountaineers.org/members/alice-smith",
        role: "Leader",
      });
      expect(result.leaders[1]).toEqual({
        name: "Bob Jones",
        url: "https://www.mountaineers.org/members/bob-jones",
        role: "Co-Leader",
      });
    });

    it("populates leader/leader_url from first entry for backward compat", async () => {
      const html = makeActivityHtml({
        leaders: [
          { name: "Alice Smith", href: "/members/alice-smith", role: "Leader" },
          { name: "Bob Jones", href: "/members/bob-jones", role: "Co-Leader" },
        ],
      });
      const c = createMockClient(html);
      const result = await getActivity(c, { url: "test" });

      expect(result.leader).toBe("Alice Smith");
      expect(result.leader_url).toBe("https://www.mountaineers.org/members/alice-smith");
    });

    it("returns empty leaders array when no leaders present", async () => {
      const html = makeActivityHtml({});
      const c = createMockClient(html);
      const result = await getActivity(c, { url: "test" });

      expect(result.leaders).toEqual([]);
      expect(result.leader).toBeNull();
    });
  });

  describe("end_date parsing", () => {
    it("extracts end_date from date range", async () => {
      const html = makeActivityHtml({ date: "Sat, Feb 7, 2026 - Sun, Feb 15, 2026" });
      const c = createMockClient(html);
      const result = await getActivity(c, { url: "test" });

      expect(result.date).toBe("Sat, Feb 7, 2026 - Sun, Feb 15, 2026");
      expect(result.end_date).toBe("2026-02-15");
    });

    it("leaves end_date null for single-day activities", async () => {
      const html = makeActivityHtml({ date: "Sat, Feb 7, 2026" });
      const c = createMockClient(html);
      const result = await getActivity(c, { url: "test" });

      expect(result.date).toBe("Sat, Feb 7, 2026");
      expect(result.end_date).toBeNull();
    });

    it("leaves end_date null when no date present", async () => {
      const html = makeActivityHtml({});
      const c = createMockClient(html);
      const result = await getActivity(c, { url: "test" });

      expect(result.end_date).toBeNull();
    });
  });
});
