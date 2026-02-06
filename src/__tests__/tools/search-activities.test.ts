import * as cheerio from "cheerio";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MountaineersClient } from "../../client.js";
import { searchActivities } from "../../tools/search-activities.js";

// Minimal HTML that parseActivityResults can parse
function makeResultHtml(count: number, items: { title: string; url: string }[] = []): string {
  const itemsHtml = items
    .map(
      (item) => `
    <div class="result-item">
      <div class="result-title"><a href="${item.url}">${item.title}</a></div>
      <div class="result-date">Jan 1, 2025</div>
      <div class="result-type">Day Hiking</div>
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

describe("searchActivities", () => {
  let client: MountaineersClient;

  beforeEach(() => {
    client = createMockClient();
  });

  it("calls fetchFacetedQuery with correct base path", async () => {
    await searchActivities(client, {});
    expect(client.fetchFacetedQuery).toHaveBeenCalledWith(
      "/activities/activities",
      expect.any(URLSearchParams),
    );
  });

  it("maps query to c2 param", async () => {
    await searchActivities(client, { query: "rainier" });
    const params = (client.fetchFacetedQuery as ReturnType<typeof vi.fn>).mock
      .calls[0][1] as URLSearchParams;
    expect(params.get("c2")).toBe("rainier");
  });

  it("maps activity_type to c4[]", async () => {
    await searchActivities(client, { activity_type: "Day Hiking" });
    const params = (client.fetchFacetedQuery as ReturnType<typeof vi.fn>).mock
      .calls[0][1] as URLSearchParams;
    expect(params.get("c4[]")).toBe("Day Hiking");
  });

  it("maps audience to c5[]", async () => {
    await searchActivities(client, { audience: "Adults" });
    const params = (client.fetchFacetedQuery as ReturnType<typeof vi.fn>).mock
      .calls[0][1] as URLSearchParams;
    expect(params.get("c5[]")).toBe("Adults");
  });

  it("maps branch to c8[] (activities use c8, not c7)", async () => {
    await searchActivities(client, { branch: "Seattle" });
    const params = (client.fetchFacetedQuery as ReturnType<typeof vi.fn>).mock
      .calls[0][1] as URLSearchParams;
    expect(params.get("c8[]")).toBe("Seattle");
    expect(params.get("c7[]")).toBeNull();
  });

  it("maps difficulty to c15[]", async () => {
    await searchActivities(client, { difficulty: "Moderate" });
    const params = (client.fetchFacetedQuery as ReturnType<typeof vi.fn>).mock
      .calls[0][1] as URLSearchParams;
    expect(params.get("c15[]")).toBe("Moderate");
  });

  it("maps type to c16[]", async () => {
    await searchActivities(client, { type: "Trip" });
    const params = (client.fetchFacetedQuery as ReturnType<typeof vi.fn>).mock
      .calls[0][1] as URLSearchParams;
    expect(params.get("c16[]")).toBe("Trip");
  });

  it("maps open_only to c17=1", async () => {
    await searchActivities(client, { open_only: true });
    const params = (client.fetchFacetedQuery as ReturnType<typeof vi.fn>).mock
      .calls[0][1] as URLSearchParams;
    expect(params.get("c17")).toBe("1");
  });

  it("does not set c17 when open_only is false", async () => {
    await searchActivities(client, { open_only: false });
    const params = (client.fetchFacetedQuery as ReturnType<typeof vi.fn>).mock
      .calls[0][1] as URLSearchParams;
    expect(params.get("c17")).toBeNull();
  });

  it("maps day_of_week to c21[]", async () => {
    await searchActivities(client, { day_of_week: "Saturday" });
    const params = (client.fetchFacetedQuery as ReturnType<typeof vi.fn>).mock
      .calls[0][1] as URLSearchParams;
    expect(params.get("c21[]")).toBe("Saturday");
  });

  it("maps date_start and date_end to start/end params", async () => {
    await searchActivities(client, { date_start: "2025-06-01", date_end: "2025-06-30" });
    const params = (client.fetchFacetedQuery as ReturnType<typeof vi.fn>).mock
      .calls[0][1] as URLSearchParams;
    expect(params.get("start")).toBe("2025-06-01");
    expect(params.get("end")).toBe("2025-06-30");
  });

  it("does not set b_start for page 0 (default)", async () => {
    await searchActivities(client, {});
    const params = (client.fetchFacetedQuery as ReturnType<typeof vi.fn>).mock
      .calls[0][1] as URLSearchParams;
    expect(params.get("b_start")).toBeNull();
  });

  it("sets b_start for page > 0 (page * 20)", async () => {
    await searchActivities(client, { page: 3 });
    const params = (client.fetchFacetedQuery as ReturnType<typeof vi.fn>).mock
      .calls[0][1] as URLSearchParams;
    expect(params.get("b_start")).toBe("60");
  });

  it("sends no params when input is empty", async () => {
    await searchActivities(client, {});
    const params = (client.fetchFacetedQuery as ReturnType<typeof vi.fn>).mock
      .calls[0][1] as URLSearchParams;
    expect(params.toString()).toBe("");
  });

  it("combines multiple params correctly", async () => {
    await searchActivities(client, {
      query: "hiking",
      branch: "Tacoma",
      difficulty: "Easy",
      open_only: true,
      page: 1,
    });
    const params = (client.fetchFacetedQuery as ReturnType<typeof vi.fn>).mock
      .calls[0][1] as URLSearchParams;
    expect(params.get("c2")).toBe("hiking");
    expect(params.get("c8[]")).toBe("Tacoma");
    expect(params.get("c15[]")).toBe("Easy");
    expect(params.get("c17")).toBe("1");
    expect(params.get("b_start")).toBe("20");
  });

  it("returns parsed results with correct page number", async () => {
    const html = makeResultHtml(42, [
      { title: "Mt. Si Hike", url: "/activities/activities/mt-si-hike" },
    ]);
    (client.fetchFacetedQuery as ReturnType<typeof vi.fn>).mockResolvedValue(cheerio.load(html));

    const result = await searchActivities(client, { page: 1 });
    expect(result.total_count).toBe(42);
    expect(result.page).toBe(1);
    expect(result.has_more).toBe(true); // (1+1)*20=40 < 42
    expect(result.items).toHaveLength(1);
    expect(result.items[0].title).toBe("Mt. Si Hike");
  });

  it("sets has_more=false when on last page", async () => {
    const html = makeResultHtml(15, [{ title: "Hike", url: "/activities/activities/hike" }]);
    (client.fetchFacetedQuery as ReturnType<typeof vi.fn>).mockResolvedValue(cheerio.load(html));

    const result = await searchActivities(client, {}); // page 0
    expect(result.has_more).toBe(false); // (0+1)*20=20, not < 15
  });
});
