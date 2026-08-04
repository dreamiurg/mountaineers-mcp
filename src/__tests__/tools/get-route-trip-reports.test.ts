import * as cheerio from "cheerio";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MountaineersClient } from "../../client.js";
import { getRouteTripReports } from "../../tools/get-route-trip-reports.js";

function makeResultHtml(count: number): string {
  return `<div id="faceted-result-count">${count} results</div>`;
}

function makeRouteResultHtml(
  itemCount: number,
  options: { pageStarts?: number[]; nextStart?: number } = {},
): string {
  const items = Array.from(
    { length: itemCount },
    (_, index) => `
      <div class="result-item">
        <div class="result-title">
          <a href="/activities/trip-reports/report-${index}">Report ${index}</a>
        </div>
      </div>`,
  ).join("");
  const pageLinks = (options.pageStarts ?? [])
    .map(
      (start) => `
        <li>
          <a href="https://www.mountaineers.org/activities/routes-places/test/trip-reports?b_start:int=${start}">
            ${start / 20 + 1}
          </a>
        </li>`,
    )
    .join("");
  const nextLink =
    options.nextStart === undefined
      ? ""
      : `<li class="next"><a href="?b_start:int=${options.nextStart}">Next items</a></li>`;
  const pagination =
    pageLinks || nextLink ? `<nav class="pagination"><ul>${pageLinks}${nextLink}</ul></nav>` : "";
  return `${items}${pagination}`;
}

function createMockClient(): MountaineersClient {
  return {
    fetchFacetedQuery: vi.fn(),
    fetchHtml: vi.fn().mockResolvedValue(cheerio.load(makeResultHtml(0))),
    fetchJson: vi.fn(),
    fetchRaw: vi.fn(),
    fetchRosterTab: vi.fn(),
    ensureClearance: vi.fn(),
    baseUrl: "https://www.mountaineers.org",
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
    );
  });

  it("strips the host and trailing slash from a full URL", async () => {
    await getRouteTripReports(client, {
      route_url: "https://www.mountaineers.org/activities/routes-places/mount-si-main-trail/",
    });
    expect(client.fetchHtml).toHaveBeenCalledWith(
      "/activities/routes-places/mount-si-main-trail/trip-reports",
    );
  });

  it("preserves every segment of a nested canonical route URL", async () => {
    await getRouteTripReports(client, {
      route_url:
        "https://www.mountaineers.org/activities/routes-places/north-cascades-national-park-cross-country-zones/high-occupancy-xc-zones/mt-shuksan-fisher-chimneys",
    });
    expect(client.fetchHtml).toHaveBeenCalledWith(
      "/activities/routes-places/north-cascades-national-park-cross-country-zones/high-occupancy-xc-zones/mt-shuksan-fisher-chimneys/trip-reports",
    );
  });

  it("accepts a bare route slug", async () => {
    await getRouteTripReports(client, { route_url: "mt-shuksan-fisher-chimneys" });
    expect(client.fetchHtml).toHaveBeenCalledWith(
      "/activities/routes-places/mt-shuksan-fisher-chimneys/trip-reports",
    );
  });

  it("appends b_start = page * 20 for page > 0", async () => {
    await getRouteTripReports(client, {
      route_url: "/activities/routes-places/mount-si-main-trail",
      page: 3,
    });
    expect(client.fetchHtml).toHaveBeenCalledWith(
      "/activities/routes-places/mount-si-main-trail/trip-reports?b_start=60",
    );
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

  it("computes exact total_count and has_more from route-page pagination", async () => {
    (client.fetchHtml as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(
        cheerio.load(makeRouteResultHtml(20, { pageStarts: [20, 40], nextStart: 20 })),
      )
      .mockResolvedValueOnce(cheerio.load(makeRouteResultHtml(6, { pageStarts: [0, 20] })));

    const result = await getRouteTripReports(client, {
      route_url: "/activities/routes-places/mount-si-main-trail",
    });

    expect(result.total_count).toBe(46);
    expect(result.items).toHaveLength(20);
    expect(result.has_more).toBe(true);
    expect(client.fetchHtml).toHaveBeenNthCalledWith(
      2,
      "/activities/routes-places/mount-si-main-trail/trip-reports?b_start=40",
    );
  });

  it("computes total_count directly when the requested page is last", async () => {
    (client.fetchHtml as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      cheerio.load(makeRouteResultHtml(6, { pageStarts: [0, 20] })),
    );

    const result = await getRouteTripReports(client, {
      route_url: "/activities/routes-places/mount-si-main-trail",
      page: 2,
    });

    expect(result.total_count).toBe(46);
    expect(result.has_more).toBe(false);
    expect(client.fetchHtml).toHaveBeenCalledTimes(1);
  });

  it("follows numbered future pages even when the next-link class is absent", async () => {
    (client.fetchHtml as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(cheerio.load(makeRouteResultHtml(20, { pageStarts: [20] })))
      .mockResolvedValueOnce(cheerio.load(makeRouteResultHtml(16, { pageStarts: [0] })));

    const result = await getRouteTripReports(client, {
      route_url: "/activities/routes-places/mount-shuksan-sulphide-glacier",
    });

    expect(result.total_count).toBe(36);
    expect(result.has_more).toBe(true);
  });

  it("recovers the exact total_count for an empty page beyond the end", async () => {
    (client.fetchHtml as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(cheerio.load(makeRouteResultHtml(0)))
      .mockResolvedValueOnce(
        cheerio.load(makeRouteResultHtml(20, { pageStarts: [20], nextStart: 20 })),
      )
      .mockResolvedValueOnce(cheerio.load(makeRouteResultHtml(16, { pageStarts: [0] })));

    const result = await getRouteTripReports(client, {
      route_url: "/activities/routes-places/mount-shuksan-sulphide-glacier",
      page: 2,
    });

    expect(result.total_count).toBe(36);
    expect(result.items).toEqual([]);
    expect(result.has_more).toBe(false);
  });

  it("propagates an unresolved route error instead of returning an empty result", async () => {
    (client.fetchHtml as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error("HTTP 404 fetching route"),
    );

    await expect(
      getRouteTripReports(client, {
        route_url: "/activities/routes-places/route-that-does-not-exist",
      }),
    ).rejects.toThrow("HTTP 404");
  });
});
