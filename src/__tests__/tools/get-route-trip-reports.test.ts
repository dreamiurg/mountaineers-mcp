import * as cheerio from "cheerio";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MountaineersClient } from "../../client.js";
import { getRouteTripReports } from "../../tools/get-route-trip-reports.js";

function makeResultHtml(count: number): string {
  return `<div id="faceted-result-count">${count} results</div>`;
}

function createMockClient(): MountaineersClient {
  return {
    fetchFacetedQuery: vi.fn(),
    fetchHtml: vi.fn().mockResolvedValue(cheerio.load(makeResultHtml(0))),
    fetchJson: vi.fn(),
    fetchRaw: vi.fn(),
    fetchRosterTab: vi.fn(),
    ensureLoggedIn: vi.fn(),
    baseUrl: "https://www.mountaineers.org",
    isLoggedIn: false,
    hasCredentials: false,
  } as unknown as MountaineersClient;
}

describe("getRouteTripReports", () => {
  let client: MountaineersClient;

  beforeEach(() => {
    client = createMockClient();
  });

  it("calls fetchHtml with the route path + /trip-reports", async () => {
    await getRouteTripReports(client, {
      route_url: "/activities/routes-places/mount-si-main-trail",
    });
    expect(client.fetchHtml).toHaveBeenCalledWith(
      "/activities/routes-places/mount-si-main-trail/trip-reports",
      { authenticated: true },
    );
  });

  it("strips the host and trailing slash from a full URL", async () => {
    await getRouteTripReports(client, {
      route_url: "https://www.mountaineers.org/activities/routes-places/mount-si-main-trail/",
    });
    expect(client.fetchHtml).toHaveBeenCalledWith(
      "/activities/routes-places/mount-si-main-trail/trip-reports",
      { authenticated: true },
    );
  });

  it("appends b_start = page * 20 for page > 0", async () => {
    await getRouteTripReports(client, {
      route_url: "/activities/routes-places/mount-si-main-trail",
      page: 3,
    });
    expect(client.fetchHtml).toHaveBeenCalledWith(
      "/activities/routes-places/mount-si-main-trail/trip-reports?b_start=60",
      { authenticated: true },
    );
  });

  it("passes authenticated: true to fetchHtml", async () => {
    await getRouteTripReports(client, {
      route_url: "/activities/routes-places/mount-si-main-trail",
    });
    const opts = (client.fetchHtml as ReturnType<typeof vi.fn>).mock.calls[0][1] as {
      authenticated?: boolean;
    };
    expect(opts).toEqual({ authenticated: true });
  });

  it("does not append b_start for page 0", async () => {
    await getRouteTripReports(client, {
      route_url: "/activities/routes-places/mount-si-main-trail",
      page: 0,
    });
    const url = (client.fetchHtml as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(url).not.toContain("b_start");
  });

  it("rejects URLs that are not under /activities/routes-places/", async () => {
    await expect(
      getRouteTripReports(client, { route_url: "/activities/trip-reports/some-report" }),
    ).rejects.toThrow(/routes-places/);
    expect(client.fetchHtml).not.toHaveBeenCalled();
  });

  it("returns the parsed result with empty items for an empty page", async () => {
    const result = await getRouteTripReports(client, {
      route_url: "/activities/routes-places/mount-si-main-trail",
    });
    expect(result.items).toEqual([]);
    expect(result.page).toBe(0);
    expect(result.has_more).toBe(false);
  });
});
