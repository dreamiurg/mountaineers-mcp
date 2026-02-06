import * as cheerio from "cheerio";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MountaineersClient } from "../../client.js";
import { getMyActivities } from "../../tools/get-my-activities.js";

// whoami needs fetchHtml to return a page with "My Profile" link + profile page with name
function makeHomepageHtml(slug: string): string {
  return `<html><body><a href="/members/${slug}">My Profile</a></body></html>`;
}

function makeProfileHtml(name: string): string {
  return `<html><head><title>${name} — The Mountaineers</title></head><body><h1>Profile</h1><h1>${name}</h1></body></html>`;
}

function createMockClient(slug = "jane-doe"): MountaineersClient {
  const homePage = cheerio.load(makeHomepageHtml(slug));
  const profilePage = cheerio.load(makeProfileHtml("Jane Doe"));

  return {
    fetchFacetedQuery: vi.fn(),
    fetchHtml: vi
      .fn()
      .mockResolvedValueOnce(homePage) // whoami: homepage
      .mockResolvedValueOnce(profilePage), // whoami: profile page
    fetchJson: vi.fn().mockResolvedValue([]),
    fetchRaw: vi.fn(),
    fetchRosterTab: vi.fn(),
    ensureLoggedIn: vi.fn(),
    baseUrl: "https://www.mountaineers.org",
    isLoggedIn: true,
    hasCredentials: true,
  } as unknown as MountaineersClient;
}

// Raw activity records as returned by the JSON API
function makeRawRecord(overrides: Record<string, unknown> = {}) {
  return {
    uid: "abc-123",
    href: "/activities/activities/test-hike",
    title: "Test Hike",
    category: "trip",
    activity_type: "Day Hiking",
    start: "2025-03-15",
    leader: { href: "/members/leader-1", name: "Leader One" },
    is_leader: false,
    position: "Participant",
    status: "Registered",
    result: "Successful",
    difficulty_rating: "Moderate",
    leader_rating: "5",
    ...overrides,
  };
}

describe("getMyActivities", () => {
  let client: MountaineersClient;

  beforeEach(() => {
    client = createMockClient();
  });

  describe("normalizeActivity", () => {
    it("normalizes leader as object with name", async () => {
      (client.fetchJson as ReturnType<typeof vi.fn>).mockResolvedValue([
        makeRawRecord({ leader: { href: "/members/bob", name: "Bob Smith" } }),
      ]);
      const result = await getMyActivities(client, {});
      expect(result[0].leader).toBe("Bob Smith");
    });

    it("normalizes leader as plain string", async () => {
      (client.fetchJson as ReturnType<typeof vi.fn>).mockResolvedValue([
        makeRawRecord({ leader: "Alice Jones" }),
      ]);
      const result = await getMyActivities(client, {});
      expect(result[0].leader).toBe("Alice Jones");
    });

    it("normalizes leader as null when missing", async () => {
      (client.fetchJson as ReturnType<typeof vi.fn>).mockResolvedValue([
        makeRawRecord({ leader: undefined }),
      ]);
      const result = await getMyActivities(client, {});
      expect(result[0].leader).toBeNull();
    });

    it("normalizes leader object with empty name to null", async () => {
      (client.fetchJson as ReturnType<typeof vi.fn>).mockResolvedValue([
        makeRawRecord({ leader: { href: "/members/x", name: "" } }),
      ]);
      const result = await getMyActivities(client, {});
      expect(result[0].leader).toBeNull();
    });

    it("uses start field for start_date", async () => {
      (client.fetchJson as ReturnType<typeof vi.fn>).mockResolvedValue([
        makeRawRecord({ start: "2025-07-04" }),
      ]);
      const result = await getMyActivities(client, {});
      expect(result[0].start_date).toBe("2025-07-04");
    });

    it("uses href field for url", async () => {
      (client.fetchJson as ReturnType<typeof vi.fn>).mockResolvedValue([
        makeRawRecord({ href: "/activities/activities/my-hike-1" }),
      ]);
      const result = await getMyActivities(client, {});
      expect(result[0].url).toBe("/activities/activities/my-hike-1");
    });

    it("prefers trip_results over result", async () => {
      (client.fetchJson as ReturnType<typeof vi.fn>).mockResolvedValue([
        makeRawRecord({ trip_results: "Canceled", result: "Successful" }),
      ]);
      const result = await getMyActivities(client, {});
      expect(result[0].result).toBe("Canceled");
    });

    it("falls back to result when trip_results is missing", async () => {
      (client.fetchJson as ReturnType<typeof vi.fn>).mockResolvedValue([
        makeRawRecord({ trip_results: undefined, result: "Successful" }),
      ]);
      const result = await getMyActivities(client, {});
      expect(result[0].result).toBe("Successful");
    });

    it("uses difficulty_rating for difficulty", async () => {
      (client.fetchJson as ReturnType<typeof vi.fn>).mockResolvedValue([
        makeRawRecord({ difficulty_rating: "Challenging" }),
      ]);
      const result = await getMyActivities(client, {});
      expect(result[0].difficulty).toBe("Challenging");
    });

    it("defaults is_leader to false when missing", async () => {
      (client.fetchJson as ReturnType<typeof vi.fn>).mockResolvedValue([
        makeRawRecord({ is_leader: undefined }),
      ]);
      const result = await getMyActivities(client, {});
      expect(result[0].is_leader).toBe(false);
    });

    it("handles completely empty record with defaults", async () => {
      (client.fetchJson as ReturnType<typeof vi.fn>).mockResolvedValue([{}]);
      const result = await getMyActivities(client, {});
      expect(result[0]).toEqual({
        uid: "",
        title: "",
        url: "",
        category: null,
        activity_type: null,
        start_date: null,
        leader: null,
        is_leader: false,
        position: null,
        status: null,
        result: null,
        difficulty: null,
        leader_rating: null,
      });
    });
  });

  describe("sorting", () => {
    it("sorts by start_date descending (most recent first)", async () => {
      (client.fetchJson as ReturnType<typeof vi.fn>).mockResolvedValue([
        makeRawRecord({ start: "2025-01-01", title: "Jan" }),
        makeRawRecord({ start: "2025-06-15", title: "Jun" }),
        makeRawRecord({ start: "2025-03-10", title: "Mar" }),
      ]);
      const result = await getMyActivities(client, { limit: 0 });
      expect(result.map((a) => a.title)).toEqual(["Jun", "Mar", "Jan"]);
    });

    it("pushes null dates to end", async () => {
      (client.fetchJson as ReturnType<typeof vi.fn>).mockResolvedValue([
        makeRawRecord({ start: undefined, title: "No date" }),
        makeRawRecord({ start: "2025-01-01", title: "Has date" }),
      ]);
      const result = await getMyActivities(client, { limit: 0 });
      expect(result.map((a) => a.title)).toEqual(["Has date", "No date"]);
    });

    it("keeps order stable for two null dates", async () => {
      (client.fetchJson as ReturnType<typeof vi.fn>).mockResolvedValue([
        makeRawRecord({ start: undefined, title: "A" }),
        makeRawRecord({ start: undefined, title: "B" }),
      ]);
      const result = await getMyActivities(client, { limit: 0 });
      expect(result).toHaveLength(2);
    });
  });

  describe("filtering", () => {
    const records = [
      makeRawRecord({
        category: "trip",
        result: "Successful",
        start: "2025-06-01",
        title: "Trip A",
      }),
      makeRawRecord({
        category: "course",
        result: "Successful",
        start: "2025-05-01",
        title: "Course B",
      }),
      makeRawRecord({ category: "trip", result: "Canceled", start: "2025-04-01", title: "Trip C" }),
      makeRawRecord({
        category: "trip",
        result: "Successful",
        start: "2025-03-01",
        title: "Trip D",
      }),
    ];

    it("filters by category (case-insensitive)", async () => {
      (client.fetchJson as ReturnType<typeof vi.fn>).mockResolvedValue(records);
      const result = await getMyActivities(client, { category: "Course", limit: 0 });
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe("Course B");
    });

    it("filters by result (case-insensitive)", async () => {
      (client.fetchJson as ReturnType<typeof vi.fn>).mockResolvedValue(records);
      const result = await getMyActivities(client, { result: "canceled", limit: 0 });
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe("Trip C");
    });

    it("filters by date_from", async () => {
      (client.fetchJson as ReturnType<typeof vi.fn>).mockResolvedValue(records);
      const result = await getMyActivities(client, { date_from: "2025-05-01", limit: 0 });
      expect(result).toHaveLength(2);
      expect(result.map((a) => a.title)).toEqual(["Trip A", "Course B"]);
    });

    it("filters by date_to", async () => {
      (client.fetchJson as ReturnType<typeof vi.fn>).mockResolvedValue(records);
      const result = await getMyActivities(client, { date_to: "2025-04-01", limit: 0 });
      expect(result).toHaveLength(2);
      expect(result.map((a) => a.title)).toEqual(["Trip C", "Trip D"]);
    });

    it("filters by date range (date_from + date_to)", async () => {
      (client.fetchJson as ReturnType<typeof vi.fn>).mockResolvedValue(records);
      const result = await getMyActivities(client, {
        date_from: "2025-04-01",
        date_to: "2025-05-31",
        limit: 0,
      });
      expect(result).toHaveLength(2);
      expect(result.map((a) => a.title)).toEqual(["Course B", "Trip C"]);
    });

    it("combines category and result filters", async () => {
      (client.fetchJson as ReturnType<typeof vi.fn>).mockResolvedValue(records);
      const result = await getMyActivities(client, {
        category: "trip",
        result: "Successful",
        limit: 0,
      });
      expect(result).toHaveLength(2);
      expect(result.map((a) => a.title)).toEqual(["Trip A", "Trip D"]);
    });

    it("excludes activities with null start_date when date_from is set", async () => {
      (client.fetchJson as ReturnType<typeof vi.fn>).mockResolvedValue([
        makeRawRecord({ start: undefined, title: "No date" }),
        makeRawRecord({ start: "2025-06-01", title: "Has date" }),
      ]);
      const result = await getMyActivities(client, { date_from: "2025-01-01", limit: 0 });
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe("Has date");
    });
  });

  describe("limit", () => {
    const manyRecords = Array.from({ length: 30 }, (_, i) =>
      makeRawRecord({ start: `2025-01-${String(i + 1).padStart(2, "0")}`, title: `Activity ${i}` }),
    );

    it("defaults to 20 results", async () => {
      (client.fetchJson as ReturnType<typeof vi.fn>).mockResolvedValue(manyRecords);
      const result = await getMyActivities(client, {});
      expect(result).toHaveLength(20);
    });

    it("respects custom limit", async () => {
      (client.fetchJson as ReturnType<typeof vi.fn>).mockResolvedValue(manyRecords);
      const result = await getMyActivities(client, { limit: 5 });
      expect(result).toHaveLength(5);
    });

    it("returns all results when limit=0", async () => {
      (client.fetchJson as ReturnType<typeof vi.fn>).mockResolvedValue(manyRecords);
      const result = await getMyActivities(client, { limit: 0 });
      expect(result).toHaveLength(30);
    });

    it("returns fewer than limit when not enough data", async () => {
      (client.fetchJson as ReturnType<typeof vi.fn>).mockResolvedValue([makeRawRecord()]);
      const result = await getMyActivities(client, { limit: 50 });
      expect(result).toHaveLength(1);
    });
  });

  describe("API call", () => {
    it("fetches from correct JSON endpoint with member slug", async () => {
      await getMyActivities(client, {});
      expect(client.fetchJson).toHaveBeenCalledWith(
        "/members/jane-doe/member-activity-history.json",
        { authenticated: true },
      );
    });

    it("calls ensureLoggedIn via whoami", async () => {
      await getMyActivities(client, {});
      expect(client.ensureLoggedIn).toHaveBeenCalled();
    });
  });
});
