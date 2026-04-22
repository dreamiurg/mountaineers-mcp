import * as cheerio from "cheerio";
import { describe, expect, it, vi } from "vitest";
import type { MountaineersClient } from "../../client.js";
import { getMemberActivities } from "../../tools/get-member-activities.js";

function makeActivity(
  start: string,
  title: string,
  href: string,
  leader: string,
  leaderHref: string,
  role: string,
  status: string,
): Record<string, unknown> {
  return {
    category: "trip",
    href,
    title,
    leader: { href: leaderHref, name: leader },
    is_leader: false,
    date: "display",
    start,
    position: role,
    status,
    waitlist: 0,
    review_state: "published",
  };
}

function makeMemberActivitiesHtml(activities: Record<string, unknown>[]): string {
  const props = JSON.stringify({
    is_leader: false,
    upcoming: activities,
    history_url: "/members/jane-doe/member-activity-history.json",
  });
  return `<html><body><div class="pat-react" data-component="MyActivities" data-props='${props}'></div></body></html>`;
}

function createMockClient(activitiesHtml = makeMemberActivitiesHtml([])): MountaineersClient {
  const activitiesPage = cheerio.load(activitiesHtml);

  return {
    fetchFacetedQuery: vi.fn(),
    fetchHtml: vi.fn().mockResolvedValue(activitiesPage),
    fetchJson: vi.fn(),
    fetchRaw: vi.fn(),
    fetchRosterTab: vi.fn(),
    ensureLoggedIn: vi.fn(),
    baseUrl: "https://www.mountaineers.org",
    isLoggedIn: true,
    hasCredentials: true,
  } as unknown as MountaineersClient;
}

describe("getMemberActivities", () => {
  describe("data-props JSON parsing", () => {
    it("parses activity items from the data-props JSON", async () => {
      const html = makeMemberActivitiesHtml([
        makeActivity(
          "2026-02-07",
          "Field Trips - Mount Si",
          "https://www.mountaineers.org/activities/activities/field-trips-mount-si",
          "Jill Thornton",
          "https://www.mountaineers.org/members/jill-thornton",
          "Instructor",
          "Registered",
        ),
      ]);
      const client = createMockClient(html);

      const result = await getMemberActivities(client, { member: "jane-doe", limit: 0 });
      expect(result.items).toHaveLength(1);
      expect(result.items[0].title).toBe("Field Trips - Mount Si");
      expect(result.items[0].start_date).toBe("2026-02-07");
      expect(result.items[0].leader).toBe("Jill Thornton");
      expect(result.items[0].position).toBe("Instructor");
      expect(result.items[0].status).toBe("Registered");
    });

    it("returns empty items when no pat-react element exists", async () => {
      const html = "<html><body><p>No activities</p></body></html>";
      const client = createMockClient(html);

      const result = await getMemberActivities(client, { member: "jane-doe", limit: 0 });
      expect(result.items).toEqual([]);
      expect(result.total_count).toBe(0);
    });

    it("returns empty items for empty upcoming list", async () => {
      const client = createMockClient();

      const result = await getMemberActivities(client, { member: "jane-doe", limit: 0 });
      expect(result.items).toEqual([]);
      expect(result.total_count).toBe(0);
    });
  });

  describe("slug normalization", () => {
    it("accepts a bare slug", async () => {
      const client = createMockClient();
      await getMemberActivities(client, { member: "jane-doe" });
      expect(client.fetchHtml).toHaveBeenCalledWith("/members/jane-doe/member-activities", {
        authenticated: true,
      });
    });

    it("extracts slug from a /members/{slug} path", async () => {
      const client = createMockClient();
      await getMemberActivities(client, { member: "/members/jane-doe" });
      expect(client.fetchHtml).toHaveBeenCalledWith("/members/jane-doe/member-activities", {
        authenticated: true,
      });
    });

    it("extracts slug from a full profile URL", async () => {
      const client = createMockClient();
      await getMemberActivities(client, {
        member: "https://www.mountaineers.org/members/jane-doe",
      });
      expect(client.fetchHtml).toHaveBeenCalledWith("/members/jane-doe/member-activities", {
        authenticated: true,
      });
    });

    it("strips a trailing slash from a profile URL", async () => {
      const client = createMockClient();
      await getMemberActivities(client, {
        member: "https://www.mountaineers.org/members/jane-doe/",
      });
      expect(client.fetchHtml).toHaveBeenCalledWith("/members/jane-doe/member-activities", {
        authenticated: true,
      });
    });
  });

  describe("sorting and filtering", () => {
    function makeTestClient() {
      const html = makeMemberActivitiesHtml([
        makeActivity(
          "2026-06-20",
          "Activity C",
          "https://www.mountaineers.org/activities/activities/c",
          "L",
          "https://www.mountaineers.org/members/l",
          "Participant",
          "Registered",
        ),
        makeActivity(
          "2026-02-07",
          "Activity A",
          "https://www.mountaineers.org/activities/activities/a",
          "L",
          "https://www.mountaineers.org/members/l",
          "Instructor",
          "Registered",
        ),
        makeActivity(
          "2026-03-10",
          "Activity B",
          "https://www.mountaineers.org/activities/activities/b",
          "L",
          "https://www.mountaineers.org/members/l",
          "Participant",
          "Waitlisted",
        ),
      ]);
      return createMockClient(html);
    }

    it("sorts by start_date ascending", async () => {
      const client = makeTestClient();
      const result = await getMemberActivities(client, { member: "jane-doe", limit: 0 });
      expect(result.items.map((a) => a.title)).toEqual(["Activity A", "Activity B", "Activity C"]);
    });

    it("filters by status case-insensitively", async () => {
      const client = makeTestClient();
      const result = await getMemberActivities(client, {
        member: "jane-doe",
        status: "waitlisted",
        limit: 0,
      });
      expect(result.items).toHaveLength(1);
      expect(result.items[0].title).toBe("Activity B");
    });

    it("filters by date range", async () => {
      const client = makeTestClient();
      const result = await getMemberActivities(client, {
        member: "jane-doe",
        date_from: "2026-03-01",
        date_to: "2026-05-01",
        limit: 0,
      });
      expect(result.items).toHaveLength(1);
      expect(result.items[0].title).toBe("Activity B");
    });
  });

  describe("limit and total_count", () => {
    function makeBigClient() {
      const activities = Array.from({ length: 25 }, (_, i) =>
        makeActivity(
          `2026-01-${String(i + 1).padStart(2, "0")}`,
          `Activity ${i}`,
          `https://www.mountaineers.org/activities/activities/a${i}`,
          "L",
          "https://www.mountaineers.org/members/l",
          "Participant",
          "Registered",
        ),
      );
      return createMockClient(makeMemberActivitiesHtml(activities));
    }

    it("defaults to 20 results with total_count reflecting all", async () => {
      const client = makeBigClient();
      const result = await getMemberActivities(client, { member: "jane-doe" });
      expect(result.items).toHaveLength(20);
      expect(result.total_count).toBe(25);
      expect(result.limit).toBe(20);
    });

    it("returns all results when limit=0", async () => {
      const client = makeBigClient();
      const result = await getMemberActivities(client, { member: "jane-doe", limit: 0 });
      expect(result.items).toHaveLength(25);
      expect(result.total_count).toBe(25);
    });
  });

  describe("API call", () => {
    it("does NOT call whoami / ensureLoggedIn (auth is handled by fetchHtml)", async () => {
      const client = createMockClient();
      await getMemberActivities(client, { member: "jane-doe" });
      expect(client.ensureLoggedIn).not.toHaveBeenCalled();
    });
  });
});
