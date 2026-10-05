import * as cheerio from "cheerio";
import { describe, expect, it, vi } from "vitest";
import type { MountaineersClient } from "../../client.js";
import { getActivity } from "../../tools/get-activity.js";
import { getActivityRoster } from "../../tools/get-activity-roster.js";
import { getCourse } from "../../tools/get-course.js";
import { getRoute } from "../../tools/get-route.js";
import { getTripReport } from "../../tools/get-trip-report.js";
import { OFF_SITE_URLS } from "../off-site-urls.js";

function createMockClient(): MountaineersClient {
  const empty = cheerio.load("<html><body></body></html>");
  return {
    fetchFacetedQuery: vi.fn(),
    fetchHtml: vi.fn().mockResolvedValue(empty),
    fetchJson: vi.fn(),
    fetchRaw: vi.fn(),
    fetchRosterTab: vi.fn().mockResolvedValue(empty),
    ensureClearance: vi.fn(),
    baseUrl: "https://www.mountaineers.org",
  } as unknown as MountaineersClient;
}

type Fetcher = "fetchHtml" | "fetchRosterTab";
const TOOLS: {
  name: string;
  run: (client: MountaineersClient, url: string) => Promise<unknown>;
  fetcher: Fetcher;
  prefix: string;
}[] = [
  {
    name: "get_activity",
    run: (c, url) => getActivity(c, { url }),
    fetcher: "fetchHtml",
    prefix: "/activities/activities/",
  },
  {
    name: "get_activity_roster",
    run: (c, url) => getActivityRoster(c, { url }),
    fetcher: "fetchRosterTab",
    prefix: "/activities/activities/",
  },
  {
    name: "get_trip_report",
    run: (c, url) => getTripReport(c, { url }),
    fetcher: "fetchHtml",
    prefix: "/activities/trip-reports/",
  },
  {
    name: "get_route",
    run: (c, url) => getRoute(c, { url }),
    fetcher: "fetchHtml",
    prefix: "/activities/routes-places/",
  },
  {
    name: "get_course",
    run: (c, url) => getCourse(c, { url }),
    fetcher: "fetchHtml",
    prefix: "/courses/courses-clinics-seminars/",
  },
];

describe.each(TOOLS)("$name URL validation", ({ run, fetcher, prefix }) => {
  it.each(OFF_SITE_URLS)("rejects %s without fetching", async (url) => {
    const client = createMockClient();
    await expect(run(client, url)).rejects.toThrow(/mountaineers\.org/);
    expect(client.fetchHtml).not.toHaveBeenCalled();
    expect(client.fetchRosterTab).not.toHaveBeenCalled();
  });

  it("accepts a full www.mountaineers.org URL", async () => {
    const client = createMockClient();
    const url = `https://www.mountaineers.org${prefix}some-item`;
    await run(client, url);
    expect(client[fetcher]).toHaveBeenCalledWith(url);
  });

  it("accepts an apex mountaineers.org URL and canonicalizes it to www", async () => {
    const client = createMockClient();
    await run(client, `https://mountaineers.org${prefix}some-item`);
    expect(client[fetcher]).toHaveBeenCalledWith(`https://www.mountaineers.org${prefix}some-item`);
  });

  it("still accepts a bare slug", async () => {
    const client = createMockClient();
    await run(client, "some-item");
    expect(client[fetcher]).toHaveBeenCalledWith(`https://www.mountaineers.org${prefix}some-item`);
  });
});
