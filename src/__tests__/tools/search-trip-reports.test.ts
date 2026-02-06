import * as cheerio from "cheerio";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MountaineersClient } from "../../client.js";
import { searchTripReports } from "../../tools/search-trip-reports.js";

function makeResultHtml(count: number): string {
  return `<div id="faceted-result-count">${count} results</div>`;
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

describe("searchTripReports", () => {
  let client: MountaineersClient;

  beforeEach(() => {
    client = createMockClient();
  });

  it("calls fetchFacetedQuery with trip-reports base path", async () => {
    await searchTripReports(client, {});
    expect(client.fetchFacetedQuery).toHaveBeenCalledWith(
      "/activities/trip-reports",
      expect.any(URLSearchParams),
    );
  });

  it("maps query to c2", async () => {
    await searchTripReports(client, { query: "rainier" });
    const params = (client.fetchFacetedQuery as ReturnType<typeof vi.fn>).mock
      .calls[0][1] as URLSearchParams;
    expect(params.get("c2")).toBe("rainier");
  });

  it("maps activity_type to c4[]", async () => {
    await searchTripReports(client, { activity_type: "Climbing" });
    const params = (client.fetchFacetedQuery as ReturnType<typeof vi.fn>).mock
      .calls[0][1] as URLSearchParams;
    expect(params.get("c4[]")).toBe("Climbing");
  });

  it("does not set b_start for page 0", async () => {
    await searchTripReports(client, {});
    const params = (client.fetchFacetedQuery as ReturnType<typeof vi.fn>).mock
      .calls[0][1] as URLSearchParams;
    expect(params.get("b_start")).toBeNull();
  });

  it("sets b_start = page * 20 for page > 0", async () => {
    await searchTripReports(client, { page: 5 });
    const params = (client.fetchFacetedQuery as ReturnType<typeof vi.fn>).mock
      .calls[0][1] as URLSearchParams;
    expect(params.get("b_start")).toBe("100");
  });

  it("does not have branch, difficulty, or open_only params", async () => {
    await searchTripReports(client, {});
    const params = (client.fetchFacetedQuery as ReturnType<typeof vi.fn>).mock
      .calls[0][1] as URLSearchParams;
    expect(params.get("c7[]")).toBeNull();
    expect(params.get("c8[]")).toBeNull();
    expect(params.get("c15[]")).toBeNull();
    expect(params.get("c17")).toBeNull();
  });
});
