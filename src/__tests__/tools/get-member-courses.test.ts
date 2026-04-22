import * as cheerio from "cheerio";
import { describe, expect, it, vi } from "vitest";
import type { MountaineersClient } from "../../client.js";
import { getMemberCourses } from "../../tools/get-member-courses.js";

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

function createMockClient(coursesHtml: string = makeMemberCoursesHtml([])): MountaineersClient {
  const coursesPage = cheerio.load(coursesHtml);
  return {
    fetchFacetedQuery: vi.fn(),
    fetchHtml: vi.fn().mockResolvedValue(coursesPage),
    fetchJson: vi.fn(),
    fetchRaw: vi.fn(),
    fetchRosterTab: vi.fn(),
    ensureLoggedIn: vi.fn(),
    baseUrl: "https://www.mountaineers.org",
    isLoggedIn: true,
    hasCredentials: true,
  } as unknown as MountaineersClient;
}

describe("getMemberCourses", () => {
  describe("data-props JSON parsing", () => {
    it("parses courses for the given member slug", async () => {
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
      const client = createMockClient(html);

      const result = await getMemberCourses(client, { member: "stefanie-schiller", limit: 0 });
      expect(result.items).toHaveLength(1);
      expect(result.items[0].title).toBe("Intermediate Glacier Climbing - Everett - 2026");
      expect(result.items[0].enrolled_date).toBe("2026-01-19");
      expect(client.fetchHtml).toHaveBeenCalledWith("/members/stefanie-schiller/member-courses", {
        authenticated: true,
      });
    });

    it("returns empty items when the member has no courses", async () => {
      const client = createMockClient(makeMemberCoursesHtml([], []));
      const result = await getMemberCourses(client, { member: "jane-doe", limit: 0 });
      expect(result.items).toEqual([]);
      expect(result.total_count).toBe(0);
    });
  });

  describe("slug normalization", () => {
    it("normalizes a full profile URL to a bare slug", async () => {
      const client = createMockClient();
      await getMemberCourses(client, {
        member: "https://www.mountaineers.org/members/stefanie-schiller/",
      });
      expect(client.fetchHtml).toHaveBeenCalledWith("/members/stefanie-schiller/member-courses", {
        authenticated: true,
      });
    });

    it("normalizes a /members/{slug} path to a bare slug", async () => {
      const client = createMockClient();
      await getMemberCourses(client, { member: "/members/jane-doe" });
      expect(client.fetchHtml).toHaveBeenCalledWith("/members/jane-doe/member-courses", {
        authenticated: true,
      });
    });
  });

  describe("sorting and filtering", () => {
    function makeTestClient() {
      const html = makeMemberCoursesHtml([
        makeCourseItem(
          "Course C",
          "https://www.mountaineers.org/courses/c",
          "Mon,&nbsp;Jun&nbsp;01,&nbsp;2026&nbsp;-<br>Fri,&nbsp;Dec&nbsp;31,&nbsp;2026",
          "2026-06-01T10:00:00",
          "Student",
          "Registered",
        ),
        makeCourseItem(
          "Course A",
          "https://www.mountaineers.org/courses/a",
          "Mon,&nbsp;Jan&nbsp;19,&nbsp;2026&nbsp;-<br>Fri,&nbsp;Oct&nbsp;16,&nbsp;2026",
          "2026-01-19T10:00:00",
          "Instructor",
          "Registered",
        ),
        makeCourseItem(
          "Course B",
          "https://www.mountaineers.org/courses/b",
          "Mon,&nbsp;Mar&nbsp;10,&nbsp;2026&nbsp;-<br>Fri,&nbsp;Nov&nbsp;01,&nbsp;2026",
          "2026-03-10T10:00:00",
          "Student",
          "Waitlisted",
        ),
      ]);
      return createMockClient(html);
    }

    it("sorts by enrolled_date ascending", async () => {
      const client = makeTestClient();
      const result = await getMemberCourses(client, { member: "jane-doe", limit: 0 });
      expect(result.items.map((c) => c.title)).toEqual(["Course A", "Course B", "Course C"]);
    });

    it("filters by status case-insensitively", async () => {
      const client = makeTestClient();
      const result = await getMemberCourses(client, {
        member: "jane-doe",
        status: "waitlisted",
        limit: 0,
      });
      expect(result.items).toHaveLength(1);
      expect(result.items[0].title).toBe("Course B");
    });

    it("filters by role case-insensitively", async () => {
      const client = makeTestClient();
      const result = await getMemberCourses(client, {
        member: "jane-doe",
        role: "instructor",
        limit: 0,
      });
      expect(result.items).toHaveLength(1);
      expect(result.items[0].title).toBe("Course A");
    });

    it("filters by date range", async () => {
      const client = makeTestClient();
      const result = await getMemberCourses(client, {
        member: "jane-doe",
        date_from: "2026-02-01",
        date_to: "2026-04-01",
        limit: 0,
      });
      expect(result.items).toHaveLength(1);
      expect(result.items[0].title).toBe("Course B");
    });
  });

  describe("limit and total_count", () => {
    function makeBigClient() {
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
      return createMockClient(makeMemberCoursesHtml(courses));
    }

    it("defaults to 20 results with total_count reflecting all", async () => {
      const client = makeBigClient();
      const result = await getMemberCourses(client, { member: "jane-doe" });
      expect(result.items).toHaveLength(20);
      expect(result.total_count).toBe(25);
      expect(result.limit).toBe(20);
    });

    it("returns all results when limit=0", async () => {
      const client = makeBigClient();
      const result = await getMemberCourses(client, { member: "jane-doe", limit: 0 });
      expect(result.items).toHaveLength(25);
      expect(result.total_count).toBe(25);
    });
  });

  describe("API call", () => {
    it("does NOT call ensureLoggedIn (auth is handled by fetchHtml)", async () => {
      const client = createMockClient();
      await getMemberCourses(client, { member: "jane-doe" });
      expect(client.ensureLoggedIn).not.toHaveBeenCalled();
    });
  });
});
