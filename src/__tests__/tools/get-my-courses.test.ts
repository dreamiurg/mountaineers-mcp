import * as cheerio from "cheerio";
import { describe, expect, it, vi } from "vitest";
import type { MountaineersClient } from "../../client.js";
import { getMyCourses } from "../../tools/get-my-courses.js";

function makeHomepageHtml(slug: string): string {
  return `<html><body><a href="/members/${slug}">My Profile</a></body></html>`;
}

function makeProfileHtml(name: string): string {
  return `<html><head><title>${name} — The Mountaineers</title></head><body><h1>Profile</h1><h1>${name}</h1></body></html>`;
}

function makeCourseItem(
  title: string,
  href: string,
  dates: string,
  start: string,
  role: string,
  status: string,
): Record<string, unknown> {
  return {
    uid: "test-uid",
    href,
    title,
    dates,
    start,
    position: role,
    status,
    waitlist: 0,
    tags: role.toLowerCase(),
    survey_url: "",
    response_url: "",
    survey_summary_url: "",
  };
}

function makeMemberCoursesHtml(
  upcoming: Record<string, unknown>[],
  history: Record<string, unknown>[] = [],
): string {
  const props = JSON.stringify({ upcoming, history });
  return `<html><body><div class="pat-react" data-component="MyCourses" data-props='${props}'></div></body></html>`;
}

function createMockClient(
  slug = "jane-doe",
  coursesHtml = makeMemberCoursesHtml([]),
): MountaineersClient {
  const homePage = cheerio.load(makeHomepageHtml(slug));
  const profilePage = cheerio.load(makeProfileHtml("Jane Doe"));
  const coursesPage = cheerio.load(coursesHtml);

  return {
    fetchFacetedQuery: vi.fn(),
    fetchHtml: vi
      .fn()
      .mockResolvedValueOnce(homePage) // whoami: homepage
      .mockResolvedValueOnce(profilePage) // whoami: profile page
      .mockResolvedValueOnce(coursesPage), // member-courses page
    fetchJson: vi.fn(),
    fetchRaw: vi.fn(),
    fetchRosterTab: vi.fn(),
    ensureLoggedIn: vi.fn(),
    baseUrl: "https://www.mountaineers.org",
    isLoggedIn: true,
    hasCredentials: true,
  } as unknown as MountaineersClient;
}

describe("getMyCourses", () => {
  describe("data-props JSON parsing", () => {
    it("parses course items from the data-props JSON", async () => {
      const html = makeMemberCoursesHtml([
        makeCourseItem(
          "Intermediate Glacier Climbing - Everett - 2026",
          "https://www.mountaineers.org/courses/intermediate-glacier-climbing-everett-2026",
          "Mon,&nbsp;Jan&nbsp;19,&nbsp;2026&nbsp;-<br>Fri,&nbsp;Oct&nbsp;16,&nbsp;2026",
          "2026-01-19T14:52:57.106315",
          "Student",
          "Registered",
        ),
      ]);
      const client = createMockClient("jane-doe", html);

      const result = await getMyCourses(client, { limit: 0 });
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe("Intermediate Glacier Climbing - Everett - 2026");
      expect(result[0].url).toBe(
        "https://www.mountaineers.org/courses/intermediate-glacier-climbing-everett-2026",
      );
      expect(result[0].enrolled_date).toBe("2026-01-19");
      expect(result[0].good_through).toBe("2026-10-16");
      expect(result[0].role).toBe("Student");
      expect(result[0].status).toBe("Registered");
    });

    it("parses multiple courses from upcoming and history", async () => {
      const upcoming = [
        makeCourseItem(
          "Intermediate Glacier Climbing - Everett - 2026",
          "https://www.mountaineers.org/courses/igc-2026",
          "Mon,&nbsp;Jan&nbsp;19,&nbsp;2026&nbsp;-<br>Fri,&nbsp;Oct&nbsp;16,&nbsp;2026",
          "2026-01-19T14:52:57",
          "Student",
          "Registered",
        ),
      ];
      const history = [
        makeCourseItem(
          "Basic Climbing Course - Everett - 2025",
          "https://www.mountaineers.org/courses/bcc-2025",
          "Fri,&nbsp;Nov&nbsp;22,&nbsp;2024&nbsp;-<br>Fri,&nbsp;Oct&nbsp;31,&nbsp;2025",
          "2024-11-22T10:00:00",
          "Instructor",
          "Registered",
        ),
      ];
      const html = makeMemberCoursesHtml(upcoming, history);
      const client = createMockClient("jane-doe", html);

      const result = await getMyCourses(client, { limit: 0 });
      expect(result).toHaveLength(2);
    });

    it("extracts enrolled_date from ISO start field", async () => {
      const html = makeMemberCoursesHtml([
        makeCourseItem(
          "Test Course",
          "https://www.mountaineers.org/courses/test",
          "Mon,&nbsp;Jan&nbsp;15,&nbsp;2024&nbsp;-<br>Fri,&nbsp;Oct&nbsp;15,&nbsp;2024",
          "2024-01-15T10:49:08.253086",
          "Student",
          "Completed",
        ),
      ]);
      const client = createMockClient("jane-doe", html);

      const result = await getMyCourses(client, { limit: 0 });
      expect(result[0].enrolled_date).toBe("2024-01-15");
    });

    it("returns empty array when no pat-react element exists", async () => {
      const html = "<html><body><p>No courses</p></body></html>";
      const client = createMockClient("jane-doe", html);

      const result = await getMyCourses(client, { limit: 0 });
      expect(result).toEqual([]);
    });

    it("returns empty array for empty upcoming and history", async () => {
      const client = createMockClient();

      const result = await getMyCourses(client, { limit: 0 });
      expect(result).toEqual([]);
    });
  });

  describe("sorting", () => {
    it("sorts by enrolled_date ascending", async () => {
      const html = makeMemberCoursesHtml([
        makeCourseItem(
          "Course B",
          "https://www.mountaineers.org/courses/b",
          "Mon,&nbsp;Jun&nbsp;&nbsp;1,&nbsp;2026&nbsp;-<br>Fri,&nbsp;Dec&nbsp;31,&nbsp;2026",
          "2026-06-01T10:00:00",
          "Student",
          "Registered",
        ),
        makeCourseItem(
          "Course A",
          "https://www.mountaineers.org/courses/a",
          "Mon,&nbsp;Jan&nbsp;19,&nbsp;2026&nbsp;-<br>Fri,&nbsp;Oct&nbsp;16,&nbsp;2026",
          "2026-01-19T10:00:00",
          "Student",
          "Registered",
        ),
      ]);
      const client = createMockClient("jane-doe", html);

      const result = await getMyCourses(client, { limit: 0 });
      expect(result.map((c) => c.title)).toEqual(["Course A", "Course B"]);
    });
  });

  describe("filtering", () => {
    it("filters by date_from", async () => {
      const html = makeMemberCoursesHtml([
        makeCourseItem(
          "Early Course",
          "https://www.mountaineers.org/courses/early",
          "Mon,&nbsp;Jan&nbsp;15,&nbsp;2024&nbsp;-<br>Fri,&nbsp;Oct&nbsp;15,&nbsp;2024",
          "2024-01-15T10:00:00",
          "Student",
          "Registered",
        ),
        makeCourseItem(
          "Late Course",
          "https://www.mountaineers.org/courses/late",
          "Mon,&nbsp;Jan&nbsp;19,&nbsp;2026&nbsp;-<br>Fri,&nbsp;Oct&nbsp;16,&nbsp;2026",
          "2026-01-19T10:00:00",
          "Student",
          "Registered",
        ),
      ]);
      const client = createMockClient("jane-doe", html);

      const result = await getMyCourses(client, { date_from: "2025-01-01", limit: 0 });
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe("Late Course");
    });

    it("filters by date_to", async () => {
      const html = makeMemberCoursesHtml([
        makeCourseItem(
          "Early Course",
          "https://www.mountaineers.org/courses/early",
          "Mon,&nbsp;Jan&nbsp;15,&nbsp;2024&nbsp;-<br>Fri,&nbsp;Oct&nbsp;15,&nbsp;2024",
          "2024-01-15T10:00:00",
          "Student",
          "Registered",
        ),
        makeCourseItem(
          "Late Course",
          "https://www.mountaineers.org/courses/late",
          "Mon,&nbsp;Jan&nbsp;19,&nbsp;2026&nbsp;-<br>Fri,&nbsp;Oct&nbsp;16,&nbsp;2026",
          "2026-01-19T10:00:00",
          "Student",
          "Registered",
        ),
      ]);
      const client = createMockClient("jane-doe", html);

      const result = await getMyCourses(client, { date_to: "2025-01-01", limit: 0 });
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe("Early Course");
    });
  });

  describe("limit", () => {
    it("defaults to 20 results", async () => {
      const courses = Array.from({ length: 25 }, (_, i) =>
        makeCourseItem(
          `Course ${i}`,
          `https://www.mountaineers.org/courses/c${i}`,
          `Mon,&nbsp;Jan&nbsp;${String(i + 1).padStart(2, "0")},&nbsp;2026&nbsp;-<br>Fri,&nbsp;Dec&nbsp;31,&nbsp;2026`,
          `2026-01-${String(i + 1).padStart(2, "0")}T10:00:00`,
          "Student",
          "Registered",
        ),
      );
      const client = createMockClient("jane-doe", makeMemberCoursesHtml(courses));

      const result = await getMyCourses(client, {});
      expect(result).toHaveLength(20);
    });

    it("returns all results when limit=0", async () => {
      const courses = Array.from({ length: 25 }, (_, i) =>
        makeCourseItem(
          `Course ${i}`,
          `https://www.mountaineers.org/courses/c${i}`,
          `Mon,&nbsp;Jan&nbsp;${String(i + 1).padStart(2, "0")},&nbsp;2026&nbsp;-<br>Fri,&nbsp;Dec&nbsp;31,&nbsp;2026`,
          `2026-01-${String(i + 1).padStart(2, "0")}T10:00:00`,
          "Student",
          "Registered",
        ),
      );
      const client = createMockClient("jane-doe", makeMemberCoursesHtml(courses));

      const result = await getMyCourses(client, { limit: 0 });
      expect(result).toHaveLength(25);
    });
  });

  describe("API call", () => {
    it("fetches member-courses HTML page with member slug", async () => {
      const client = createMockClient();
      await getMyCourses(client, {});
      expect(client.fetchHtml).toHaveBeenCalledWith("/members/jane-doe/member-courses", {
        authenticated: true,
      });
    });

    it("calls ensureLoggedIn via whoami", async () => {
      const client = createMockClient();
      await getMyCourses(client, {});
      expect(client.ensureLoggedIn).toHaveBeenCalled();
    });
  });
});
