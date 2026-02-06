import * as cheerio from "cheerio";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MountaineersClient } from "../../client.js";
import { getMyCourses } from "../../tools/get-my-courses.js";

function makeHomepageHtml(slug: string): string {
  return `<html><body><a href="/members/${slug}">My Profile</a></body></html>`;
}

function makeProfileHtml(name: string): string {
  return `<html><head><title>${name} — The Mountaineers</title></head><body><h1>Profile</h1><h1>${name}</h1></body></html>`;
}

function createMockClient(slug = "jane-doe"): MountaineersClient {
  return {
    fetchFacetedQuery: vi.fn(),
    fetchHtml: vi
      .fn()
      .mockResolvedValueOnce(cheerio.load(makeHomepageHtml(slug)))
      .mockResolvedValueOnce(cheerio.load(makeProfileHtml("Jane Doe"))),
    fetchJson: vi.fn().mockResolvedValue([]),
    fetchRaw: vi.fn(),
    fetchRosterTab: vi.fn(),
    ensureLoggedIn: vi.fn(),
    baseUrl: "https://www.mountaineers.org",
    isLoggedIn: true,
    hasCredentials: true,
  } as unknown as MountaineersClient;
}

function makeRawRecord(overrides: Record<string, unknown> = {}) {
  return {
    uid: "xyz-789",
    href: "/activities/courses-clinics-seminars/basic-alpine",
    title: "Basic Alpine Course",
    category: "course",
    activity_type: "Climbing",
    start: "2025-02-01",
    leader: { name: "Instructor One" },
    is_leader: false,
    position: "Student",
    status: "Registered",
    result: "Successful",
    difficulty_rating: "Moderate",
    ...overrides,
  };
}

describe("getMyCourses", () => {
  let client: MountaineersClient;

  beforeEach(() => {
    client = createMockClient();
  });

  it("delegates to getMyActivities with category=course", async () => {
    const records = [
      makeRawRecord({ category: "course", title: "Course A" }),
      makeRawRecord({ category: "trip", title: "Trip B" }),
      makeRawRecord({ category: "course", title: "Course C" }),
    ];
    (client.fetchJson as ReturnType<typeof vi.fn>).mockResolvedValue(records);

    const result = await getMyCourses(client, { limit: 0 });
    expect(result.every((a) => a.category === "course")).toBe(true);
    expect(result).toHaveLength(2);
  });

  it("passes result filter through", async () => {
    const records = [
      makeRawRecord({ category: "course", result: "Successful", title: "Good" }),
      makeRawRecord({ category: "course", result: "Canceled", title: "Bad" }),
    ];
    (client.fetchJson as ReturnType<typeof vi.fn>).mockResolvedValue(records);

    const result = await getMyCourses(client, { result: "Successful", limit: 0 });
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("Good");
  });

  it("passes date filters through", async () => {
    const records = [
      makeRawRecord({ category: "course", start: "2025-01-15", title: "Jan Course" }),
      makeRawRecord({ category: "course", start: "2025-06-15", title: "Jun Course" }),
    ];
    (client.fetchJson as ReturnType<typeof vi.fn>).mockResolvedValue(records);

    const result = await getMyCourses(client, {
      date_from: "2025-05-01",
      date_to: "2025-07-01",
      limit: 0,
    });
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("Jun Course");
  });

  it("passes limit through", async () => {
    const records = Array.from({ length: 10 }, (_, i) =>
      makeRawRecord({
        category: "course",
        start: `2025-01-${String(i + 1).padStart(2, "0")}`,
        title: `Course ${i}`,
      }),
    );
    (client.fetchJson as ReturnType<typeof vi.fn>).mockResolvedValue(records);

    const result = await getMyCourses(client, { limit: 3 });
    expect(result).toHaveLength(3);
  });

  it("returns empty array when no courses exist", async () => {
    (client.fetchJson as ReturnType<typeof vi.fn>).mockResolvedValue([
      makeRawRecord({ category: "trip", title: "Trip Only" }),
    ]);
    const result = await getMyCourses(client, {});
    expect(result).toEqual([]);
  });
});
