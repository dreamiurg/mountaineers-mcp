import * as cheerio from "cheerio";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MountaineersClient } from "../../client.js";
import { searchCourses } from "../../tools/search-courses.js";

function makeResultHtml(count: number, items: { title: string; url: string }[] = []): string {
  const itemsHtml = items
    .map(
      (item) => `
    <div class="result-item">
      <div class="result-title"><a href="${item.url}">${item.title}</a></div>
      <div class="result-date">Feb 1, 2025</div>
    </div>`,
    )
    .join("\n");
  return `<div id="faceted-result-count">${count} results</div>${itemsHtml}`;
}

function createMockClient(): MountaineersClient {
  return {
    fetchFacetedQuery: vi.fn().mockResolvedValue(cheerio.load(makeResultHtml(0))),
    fetchHtml: vi.fn(),
    fetchJson: vi.fn(),
    fetchRaw: vi.fn(),
    fetchRosterTab: vi.fn(),
    ensureLoggedIn: vi.fn(),
    baseUrl: "https://www.mountaineers.org",
    isLoggedIn: false,
    hasCredentials: false,
  } as unknown as MountaineersClient;
}

describe("searchCourses", () => {
  let client: MountaineersClient;

  beforeEach(() => {
    client = createMockClient();
  });

  it("calls fetchFacetedQuery with courses base path", async () => {
    await searchCourses(client, {});
    expect(client.fetchFacetedQuery).toHaveBeenCalledWith(
      "/activities/courses-clinics-seminars",
      expect.any(URLSearchParams),
    );
  });

  it("maps branch to c7[] (courses use c7, not c8)", async () => {
    await searchCourses(client, { branch: "Seattle" });
    const params = (client.fetchFacetedQuery as ReturnType<typeof vi.fn>).mock
      .calls[0][1] as URLSearchParams;
    expect(params.get("c7[]")).toBe("Seattle");
    expect(params.get("c8[]")).toBeNull();
  });

  it("maps query to c2", async () => {
    await searchCourses(client, { query: "navigation" });
    const params = (client.fetchFacetedQuery as ReturnType<typeof vi.fn>).mock
      .calls[0][1] as URLSearchParams;
    expect(params.get("c2")).toBe("navigation");
  });

  it("maps activity_type to c4[]", async () => {
    await searchCourses(client, { activity_type: "Climbing" });
    const params = (client.fetchFacetedQuery as ReturnType<typeof vi.fn>).mock
      .calls[0][1] as URLSearchParams;
    expect(params.get("c4[]")).toBe("Climbing");
  });

  it("maps difficulty to c15[]", async () => {
    await searchCourses(client, { difficulty: "Challenging" });
    const params = (client.fetchFacetedQuery as ReturnType<typeof vi.fn>).mock
      .calls[0][1] as URLSearchParams;
    expect(params.get("c15[]")).toBe("Challenging");
  });

  it("maps open_only to c17=1", async () => {
    await searchCourses(client, { open_only: true });
    const params = (client.fetchFacetedQuery as ReturnType<typeof vi.fn>).mock
      .calls[0][1] as URLSearchParams;
    expect(params.get("c17")).toBe("1");
  });

  it("does not set b_start for page 0", async () => {
    await searchCourses(client, {});
    const params = (client.fetchFacetedQuery as ReturnType<typeof vi.fn>).mock
      .calls[0][1] as URLSearchParams;
    expect(params.get("b_start")).toBeNull();
  });

  it("sets b_start = page * 20 for page > 0", async () => {
    await searchCourses(client, { page: 2 });
    const params = (client.fetchFacetedQuery as ReturnType<typeof vi.fn>).mock
      .calls[0][1] as URLSearchParams;
    expect(params.get("b_start")).toBe("40");
  });

  it("does not include activity-only params (c5, c16, c21, start, end)", async () => {
    // Courses schema doesn't have audience, type, day_of_week, date_start, date_end
    await searchCourses(client, {});
    const params = (client.fetchFacetedQuery as ReturnType<typeof vi.fn>).mock
      .calls[0][1] as URLSearchParams;
    expect(params.get("c5[]")).toBeNull();
    expect(params.get("c16[]")).toBeNull();
    expect(params.get("c21[]")).toBeNull();
    expect(params.get("start")).toBeNull();
    expect(params.get("end")).toBeNull();
  });

  it("returns parsed results", async () => {
    const html = makeResultHtml(5, [
      { title: "Basic Alpine Course", url: "/activities/courses-clinics-seminars/basic-alpine" },
    ]);
    (client.fetchFacetedQuery as ReturnType<typeof vi.fn>).mockResolvedValue(cheerio.load(html));

    const result = await searchCourses(client, {});
    expect(result.total_count).toBe(5);
    expect(result.page).toBe(0);
    expect(result.has_more).toBe(false); // 5 < 20
    expect(result.items).toHaveLength(1);
    expect(result.items[0].title).toBe("Basic Alpine Course");
  });

  it("combines multiple filters", async () => {
    await searchCourses(client, {
      query: "alpine",
      branch: "Everett",
      activity_type: "Climbing",
      difficulty: "Moderate",
      open_only: true,
      page: 1,
    });
    const params = (client.fetchFacetedQuery as ReturnType<typeof vi.fn>).mock
      .calls[0][1] as URLSearchParams;
    expect(params.get("c2")).toBe("alpine");
    expect(params.get("c7[]")).toBe("Everett");
    expect(params.get("c4[]")).toBe("Climbing");
    expect(params.get("c15[]")).toBe("Moderate");
    expect(params.get("c17")).toBe("1");
    expect(params.get("b_start")).toBe("20");
  });
});
