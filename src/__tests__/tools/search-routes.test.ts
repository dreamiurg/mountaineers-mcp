import * as cheerio from "cheerio";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MountaineersClient } from "../../client.js";
import { searchRoutes } from "../../tools/search-routes.js";

function makeResultHtml(count: number, items: { title: string; url: string }[] = []): string {
  const itemsHtml = items
    .map(
      (item) => `
    <div class="result-item">
      <div class="result-title"><a href="${item.url}">${item.title}</a></div>
      <div class="result-type">Day Hiking</div>
      <div class="result-summary">A great route</div>
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

describe("searchRoutes", () => {
  let client: MountaineersClient;

  beforeEach(() => {
    client = createMockClient();
  });

  it("calls fetchFacetedQuery with correct base path", async () => {
    await searchRoutes(client, {});
    expect(client.fetchFacetedQuery).toHaveBeenCalledWith(
      "/activities/routes-places",
      expect.any(URLSearchParams),
    );
  });

  it("maps query to c2 param", async () => {
    await searchRoutes(client, { query: "rainier" });
    const params = (client.fetchFacetedQuery as ReturnType<typeof vi.fn>).mock
      .calls[0][1] as URLSearchParams;
    expect(params.get("c2")).toBe("rainier");
  });

  it("maps activity_type to c4[]", async () => {
    await searchRoutes(client, { activity_type: "Day Hiking" });
    const params = (client.fetchFacetedQuery as ReturnType<typeof vi.fn>).mock
      .calls[0][1] as URLSearchParams;
    expect(params.get("c4[]")).toBe("Day Hiking");
  });

  it("maps difficulty to c5[] (routes use c5, not c15)", async () => {
    await searchRoutes(client, { difficulty: "Moderate" });
    const params = (client.fetchFacetedQuery as ReturnType<typeof vi.fn>).mock
      .calls[0][1] as URLSearchParams;
    expect(params.get("c5[]")).toBe("Moderate");
    expect(params.get("c15[]")).toBeNull();
  });

  it("maps climbing_category to c7[]", async () => {
    await searchRoutes(client, { climbing_category: "Basic Alpine" });
    const params = (client.fetchFacetedQuery as ReturnType<typeof vi.fn>).mock
      .calls[0][1] as URLSearchParams;
    expect(params.get("c7[]")).toBe("Basic Alpine");
  });

  it("maps used_for to c9[]", async () => {
    await searchRoutes(client, { used_for: "Basic Alpine" });
    const params = (client.fetchFacetedQuery as ReturnType<typeof vi.fn>).mock
      .calls[0][1] as URLSearchParams;
    expect(params.get("c9[]")).toBe("Basic Alpine");
  });

  it("maps snowshoeing_category to c10[]", async () => {
    await searchRoutes(client, { snowshoeing_category: "Beginner" });
    const params = (client.fetchFacetedQuery as ReturnType<typeof vi.fn>).mock
      .calls[0][1] as URLSearchParams;
    expect(params.get("c10[]")).toBe("Beginner");
  });

  it("does not set b_start for page 0 (default)", async () => {
    await searchRoutes(client, {});
    const params = (client.fetchFacetedQuery as ReturnType<typeof vi.fn>).mock
      .calls[0][1] as URLSearchParams;
    expect(params.get("b_start")).toBeNull();
  });

  it("sets b_start for page > 0 (page * 20)", async () => {
    await searchRoutes(client, { page: 2 });
    const params = (client.fetchFacetedQuery as ReturnType<typeof vi.fn>).mock
      .calls[0][1] as URLSearchParams;
    expect(params.get("b_start")).toBe("40");
  });

  it("sends no params when input is empty", async () => {
    await searchRoutes(client, {});
    const params = (client.fetchFacetedQuery as ReturnType<typeof vi.fn>).mock
      .calls[0][1] as URLSearchParams;
    expect(params.toString()).toBe("");
  });

  it("returns parsed results with correct page number", async () => {
    const html = makeResultHtml(42, [
      { title: "Mount Si Trail", url: "/activities/routes-places/mount-si" },
    ]);
    (client.fetchFacetedQuery as ReturnType<typeof vi.fn>).mockResolvedValue(cheerio.load(html));

    const result = await searchRoutes(client, { page: 1 });
    expect(result.total_count).toBe(42);
    expect(result.page).toBe(1);
    expect(result.has_more).toBe(true);
    expect(result.items).toHaveLength(1);
    expect(result.items[0].title).toBe("Mount Si Trail");
  });

  it("sets has_more=false when on last page", async () => {
    const html = makeResultHtml(15, [{ title: "Trail", url: "/activities/routes-places/trail" }]);
    (client.fetchFacetedQuery as ReturnType<typeof vi.fn>).mockResolvedValue(cheerio.load(html));

    const result = await searchRoutes(client, {});
    expect(result.has_more).toBe(false);
  });
});
