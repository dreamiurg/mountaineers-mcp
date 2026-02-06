import * as cheerio from "cheerio";
import { describe, expect, it, vi } from "vitest";
import type { MountaineersClient } from "../../client.js";
import { getMyActivities } from "../../tools/get-my-activities.js";

// whoami needs fetchHtml to return a page with "My Profile" link + profile page with name
function makeHomepageHtml(slug: string): string {
  return `<html><body><a href="/members/${slug}">My Profile</a></body></html>`;
}

function makeProfileHtml(name: string): string {
  return `<html><head><title>${name} — The Mountaineers</title></head><body><h1>Profile</h1><h1>${name}</h1></body></html>`;
}

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

function createMockClient(
  slug = "jane-doe",
  activitiesHtml = makeMemberActivitiesHtml([]),
): MountaineersClient {
  const homePage = cheerio.load(makeHomepageHtml(slug));
  const profilePage = cheerio.load(makeProfileHtml("Jane Doe"));
  const activitiesPage = cheerio.load(activitiesHtml);

  return {
    fetchFacetedQuery: vi.fn(),
    fetchHtml: vi
      .fn()
      .mockResolvedValueOnce(homePage) // whoami: homepage
      .mockResolvedValueOnce(profilePage) // whoami: profile page
      .mockResolvedValueOnce(activitiesPage), // member-activities page
    fetchJson: vi.fn(),
    fetchRaw: vi.fn(),
    fetchRosterTab: vi.fn(),
    ensureLoggedIn: vi.fn(),
    baseUrl: "https://www.mountaineers.org",
    isLoggedIn: true,
    hasCredentials: true,
  } as unknown as MountaineersClient;
}

describe("getMyActivities", () => {
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
      const client = createMockClient("jane-doe", html);

      const result = await getMyActivities(client, { limit: 0 });
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe("Field Trips - Mount Si");
      expect(result[0].url).toBe(
        "https://www.mountaineers.org/activities/activities/field-trips-mount-si",
      );
      expect(result[0].start_date).toBe("2026-02-07");
      expect(result[0].leader).toBe("Jill Thornton");
      expect(result[0].position).toBe("Instructor");
      expect(result[0].status).toBe("Registered");
      expect(result[0].is_leader).toBe(true);
    });

    it("extracts uid from URL slug", async () => {
      const html = makeMemberActivitiesHtml([
        makeActivity(
          "2026-02-07",
          "Test Hike",
          "https://www.mountaineers.org/activities/activities/test-hike-123",
          "Leader",
          "https://www.mountaineers.org/members/leader",
          "Participant",
          "Registered",
        ),
      ]);
      const client = createMockClient("jane-doe", html);

      const result = await getMyActivities(client, { limit: 0 });
      expect(result[0].uid).toBe("test-hike-123");
    });

    it("detects is_leader from Instructor role", async () => {
      const html = makeMemberActivitiesHtml([
        makeActivity(
          "2026-02-07",
          "Activity",
          "https://www.mountaineers.org/activities/activities/a1",
          "Leader",
          "https://www.mountaineers.org/members/leader",
          "Instructor",
          "Registered",
        ),
      ]);
      const client = createMockClient("jane-doe", html);

      const result = await getMyActivities(client, { limit: 0 });
      expect(result[0].is_leader).toBe(true);
    });

    it("detects is_leader from Primary Leader role", async () => {
      const html = makeMemberActivitiesHtml([
        makeActivity(
          "2026-03-28",
          "Climbing Conditioners",
          "https://www.mountaineers.org/activities/activities/climbing-cond",
          "Jane Doe",
          "https://www.mountaineers.org/members/jane-doe",
          "Primary Leader",
          "Registered",
        ),
      ]);
      const client = createMockClient("jane-doe", html);

      const result = await getMyActivities(client, { limit: 0 });
      expect(result[0].is_leader).toBe(true);
    });

    it("sets is_leader false for Participant role", async () => {
      const html = makeMemberActivitiesHtml([
        makeActivity(
          "2026-03-10",
          "Glacier Lecture",
          "https://www.mountaineers.org/activities/activities/glacier-lecture",
          "Teacher",
          "https://www.mountaineers.org/members/teacher",
          "Participant",
          "Registered",
        ),
      ]);
      const client = createMockClient("jane-doe", html);

      const result = await getMyActivities(client, { limit: 0 });
      expect(result[0].is_leader).toBe(false);
    });

    it("uses start field directly as start_date", async () => {
      const html = makeMemberActivitiesHtml([
        makeActivity(
          "2026-05-30",
          "Field Trip",
          "https://www.mountaineers.org/activities/activities/field-trip",
          "Leader",
          "https://www.mountaineers.org/members/leader",
          "Participant",
          "Registered",
        ),
      ]);
      const client = createMockClient("jane-doe", html);

      const result = await getMyActivities(client, { limit: 0 });
      expect(result[0].start_date).toBe("2026-05-30");
    });

    it("returns empty array when no pat-react element exists", async () => {
      const html = "<html><body><p>No activities</p></body></html>";
      const client = createMockClient("jane-doe", html);

      const result = await getMyActivities(client, { limit: 0 });
      expect(result).toEqual([]);
    });

    it("returns empty array for empty upcoming list", async () => {
      const client = createMockClient();

      const result = await getMyActivities(client, { limit: 0 });
      expect(result).toEqual([]);
    });

    it("extracts category from activity data", async () => {
      const activity = makeActivity(
        "2026-02-07",
        "Course Activity",
        "https://www.mountaineers.org/activities/activities/ca",
        "L",
        "https://www.mountaineers.org/members/l",
        "Student",
        "Registered",
      );
      activity.category = "course";
      const html = makeMemberActivitiesHtml([activity]);
      const client = createMockClient("jane-doe", html);

      const result = await getMyActivities(client, { limit: 0 });
      expect(result[0].category).toBe("course");
    });
  });

  describe("sorting", () => {
    it("sorts by start_date ascending (soonest first)", async () => {
      const html = makeMemberActivitiesHtml([
        makeActivity(
          "2026-06-20",
          "Jun Activity",
          "https://www.mountaineers.org/activities/activities/jun",
          "L",
          "https://www.mountaineers.org/members/l",
          "Participant",
          "Registered",
        ),
        makeActivity(
          "2026-02-07",
          "Feb Activity",
          "https://www.mountaineers.org/activities/activities/feb",
          "L",
          "https://www.mountaineers.org/members/l",
          "Participant",
          "Registered",
        ),
        makeActivity(
          "2026-03-10",
          "Mar Activity",
          "https://www.mountaineers.org/activities/activities/mar",
          "L",
          "https://www.mountaineers.org/members/l",
          "Participant",
          "Registered",
        ),
      ]);
      const client = createMockClient("jane-doe", html);

      const result = await getMyActivities(client, { limit: 0 });
      expect(result.map((a) => a.title)).toEqual(["Feb Activity", "Mar Activity", "Jun Activity"]);
    });

    it("pushes null dates to end", async () => {
      const html = makeMemberActivitiesHtml([
        makeActivity(
          "",
          "No date",
          "https://www.mountaineers.org/activities/activities/nodate",
          "L",
          "https://www.mountaineers.org/members/l",
          "Participant",
          "Registered",
        ),
        makeActivity(
          "2026-02-07",
          "Has date",
          "https://www.mountaineers.org/activities/activities/hasdate",
          "L",
          "https://www.mountaineers.org/members/l",
          "Participant",
          "Registered",
        ),
      ]);
      const client = createMockClient("jane-doe", html);

      const result = await getMyActivities(client, { limit: 0 });
      expect(result.map((a) => a.title)).toEqual(["Has date", "No date"]);
    });
  });

  describe("filtering", () => {
    function makeTestClient() {
      const html = makeMemberActivitiesHtml([
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
          "Registered",
        ),
        makeActivity(
          "2026-06-20",
          "Activity C",
          "https://www.mountaineers.org/activities/activities/c",
          "L",
          "https://www.mountaineers.org/members/l",
          "Participant",
          "Registered",
        ),
      ]);
      return createMockClient("jane-doe", html);
    }

    it("filters by date_from", async () => {
      const client = makeTestClient();
      const result = await getMyActivities(client, { date_from: "2026-03-01", limit: 0 });
      expect(result).toHaveLength(2);
      expect(result.map((a) => a.title)).toEqual(["Activity B", "Activity C"]);
    });

    it("filters by date_to", async () => {
      const client = makeTestClient();
      const result = await getMyActivities(client, { date_to: "2026-03-10", limit: 0 });
      expect(result).toHaveLength(2);
      expect(result.map((a) => a.title)).toEqual(["Activity A", "Activity B"]);
    });

    it("filters by date range", async () => {
      const client = makeTestClient();
      const result = await getMyActivities(client, {
        date_from: "2026-03-01",
        date_to: "2026-05-01",
        limit: 0,
      });
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe("Activity B");
    });
  });

  describe("limit", () => {
    function makeTestClient() {
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
      return createMockClient("jane-doe", makeMemberActivitiesHtml(activities));
    }

    it("defaults to 20 results", async () => {
      const client = makeTestClient();
      const result = await getMyActivities(client, {});
      expect(result).toHaveLength(20);
    });

    it("respects custom limit", async () => {
      const client = makeTestClient();
      const result = await getMyActivities(client, { limit: 5 });
      expect(result).toHaveLength(5);
    });

    it("returns all results when limit=0", async () => {
      const client = makeTestClient();
      const result = await getMyActivities(client, { limit: 0 });
      expect(result).toHaveLength(25);
    });
  });

  describe("API call", () => {
    it("fetches member-activities HTML page with member slug", async () => {
      const client = createMockClient();
      await getMyActivities(client, {});
      expect(client.fetchHtml).toHaveBeenCalledWith("/members/jane-doe/member-activities", {
        authenticated: true,
      });
    });

    it("calls ensureLoggedIn via whoami", async () => {
      const client = createMockClient();
      await getMyActivities(client, {});
      expect(client.ensureLoggedIn).toHaveBeenCalled();
    });
  });
});
