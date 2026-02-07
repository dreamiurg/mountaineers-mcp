import * as cheerio from "cheerio";
import { describe, expect, it, vi } from "vitest";
import type { MountaineersClient } from "../../client.js";
import { getActivityHistory } from "../../tools/get-activity-history.js";

function makeHomepageHtml(slug: string): string {
  return `<html><body><a href="/members/${slug}">My Profile</a></body></html>`;
}

function makeProfileHtml(name: string): string {
  return `<html><head><title>${name} — The Mountaineers</title></head><body><h1>Profile</h1><h1>${name}</h1></body></html>`;
}

function createMockClient(
  historyItems: Record<string, unknown>[] = [],
  slug = "jane-doe",
): MountaineersClient {
  const homePage = cheerio.load(makeHomepageHtml(slug));
  const profilePage = cheerio.load(makeProfileHtml("Jane Doe"));

  return {
    fetchFacetedQuery: vi.fn(),
    fetchHtml: vi.fn().mockResolvedValueOnce(homePage).mockResolvedValueOnce(profilePage),
    fetchJson: vi.fn().mockResolvedValue(historyItems),
    fetchRaw: vi.fn(),
    fetchRosterTab: vi.fn(),
    ensureLoggedIn: vi.fn(),
    baseUrl: "https://www.mountaineers.org",
    isLoggedIn: true,
    hasCredentials: true,
  } as unknown as MountaineersClient;
}

describe("getActivityHistory", () => {
  it("fetches history JSON for the logged-in user", async () => {
    const client = createMockClient([]);
    await getActivityHistory(client, {});
    expect(client.fetchJson).toHaveBeenCalledWith(
      "/members/jane-doe/member-activity-history.json",
      { authenticated: true },
    );
  });

  it("parses activity items from JSON array", async () => {
    const items = [
      {
        uid: "abc123",
        href: "https://www.mountaineers.org/activities/trail-run-1",
        title: "Trail Run",
        category: "trip",
        start: "2025-06-15",
        result: "Successful",
        activity_type: "Trail Running",
      },
    ];
    const client = createMockClient(items);

    const result = await getActivityHistory(client, { limit: 0 });
    expect(result.items).toHaveLength(1);
    expect(result.items[0].title).toBe("Trail Run");
    expect(result.items[0].uid).toBe("abc123");
    expect(result.items[0].start_date).toBe("2025-06-15");
    expect(result.items[0].result).toBe("Successful");
    expect(result.items[0].activity_type).toBe("Trail Running");
  });

  it("handles leader as object with name", async () => {
    const items = [
      {
        uid: "1",
        href: "/activities/hike-1",
        title: "Hike",
        start: "2025-01-01",
        leader: { name: "John Smith", href: "/members/john-smith" },
      },
    ];
    const client = createMockClient(items);

    const result = await getActivityHistory(client, { limit: 0 });
    expect(result.items[0].leader).toBe("John Smith");
  });

  it("handles leader as string", async () => {
    const items = [
      {
        uid: "1",
        href: "/activities/hike-1",
        title: "Hike",
        start: "2025-01-01",
        leader: "Jane Leader",
      },
    ];
    const client = createMockClient(items);

    const result = await getActivityHistory(client, { limit: 0 });
    expect(result.items[0].leader).toBe("Jane Leader");
  });

  it("sorts by date descending (most recent first)", async () => {
    const items = [
      { uid: "1", href: "/a/1", title: "Old", start: "2024-01-01" },
      { uid: "2", href: "/a/2", title: "New", start: "2025-06-01" },
      { uid: "3", href: "/a/3", title: "Mid", start: "2024-08-15" },
    ];
    const client = createMockClient(items);

    const result = await getActivityHistory(client, { limit: 0 });
    expect(result.items.map((a) => a.title)).toEqual(["New", "Mid", "Old"]);
  });

  it("filters by category", async () => {
    const items = [
      { uid: "1", href: "/a/1", title: "Trip", start: "2025-01-01", category: "trip" },
      { uid: "2", href: "/a/2", title: "Course", start: "2025-01-01", category: "course" },
    ];
    const client = createMockClient(items);

    const result = await getActivityHistory(client, { category: "trip", limit: 0 });
    expect(result.items).toHaveLength(1);
    expect(result.items[0].title).toBe("Trip");
  });

  it("filters by result", async () => {
    const items = [
      { uid: "1", href: "/a/1", title: "Good", start: "2025-01-01", result: "Successful" },
      { uid: "2", href: "/a/2", title: "Bad", start: "2025-01-01", result: "Canceled" },
    ];
    const client = createMockClient(items);

    const result = await getActivityHistory(client, { result: "Successful", limit: 0 });
    expect(result.items).toHaveLength(1);
    expect(result.items[0].title).toBe("Good");
  });

  it("filters by activity_type", async () => {
    const items = [
      { uid: "1", href: "/a/1", title: "Hike", start: "2025-01-01", activity_type: "Day Hiking" },
      { uid: "2", href: "/a/2", title: "Climb", start: "2025-01-01", activity_type: "Climbing" },
    ];
    const client = createMockClient(items);

    const result = await getActivityHistory(client, { activity_type: "Climbing", limit: 0 });
    expect(result.items).toHaveLength(1);
    expect(result.items[0].title).toBe("Climb");
  });

  it("filters by date range", async () => {
    const items = [
      { uid: "1", href: "/a/1", title: "Early", start: "2024-03-01" },
      { uid: "2", href: "/a/2", title: "Middle", start: "2024-07-15" },
      { uid: "3", href: "/a/3", title: "Late", start: "2025-01-01" },
    ];
    const client = createMockClient(items);

    const result = await getActivityHistory(client, {
      date_from: "2024-06-01",
      date_to: "2024-12-31",
      limit: 0,
    });
    expect(result.items).toHaveLength(1);
    expect(result.items[0].title).toBe("Middle");
  });

  describe("limit and total_count", () => {
    it("defaults to 20 results with total_count reflecting all", async () => {
      const items = Array.from({ length: 25 }, (_, i) => ({
        uid: String(i),
        href: `/a/${i}`,
        title: `Activity ${i}`,
        start: `2025-01-${String(i + 1).padStart(2, "0")}`,
      }));
      const client = createMockClient(items);

      const result = await getActivityHistory(client, {});
      expect(result.items).toHaveLength(20);
      expect(result.total_count).toBe(25);
      expect(result.limit).toBe(20);
    });

    it("returns all with limit=0", async () => {
      const items = Array.from({ length: 25 }, (_, i) => ({
        uid: String(i),
        href: `/a/${i}`,
        title: `Activity ${i}`,
        start: `2025-01-${String(i + 1).padStart(2, "0")}`,
      }));
      const client = createMockClient(items);

      const result = await getActivityHistory(client, { limit: 0 });
      expect(result.items).toHaveLength(25);
      expect(result.total_count).toBe(25);
      expect(result.limit).toBe(0);
    });
  });

  it("handles wrapped response with items key", async () => {
    const wrapped = { items: [{ uid: "1", href: "/a/1", title: "Wrapped", start: "2025-01-01" }] };
    const client = createMockClient();
    (client.fetchJson as ReturnType<typeof vi.fn>).mockResolvedValue(wrapped);

    const result = await getActivityHistory(client, { limit: 0 });
    expect(result.items).toHaveLength(1);
    expect(result.items[0].title).toBe("Wrapped");
  });

  it("prepends base URL to relative hrefs", async () => {
    const items = [{ uid: "1", href: "/activities/hike-1", title: "Hike", start: "2025-01-01" }];
    const client = createMockClient(items);

    const result = await getActivityHistory(client, { limit: 0 });
    expect(result.items[0].url).toBe("https://www.mountaineers.org/activities/hike-1");
  });

  it("falls back to trip_results for result field", async () => {
    const items = [
      { uid: "1", href: "/a/1", title: "Trip", start: "2025-01-01", trip_results: "Complete" },
    ];
    const client = createMockClient(items);

    const result = await getActivityHistory(client, { limit: 0 });
    expect(result.items[0].result).toBe("Complete");
  });
});
