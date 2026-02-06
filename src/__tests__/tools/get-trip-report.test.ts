import * as cheerio from "cheerio";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MountaineersClient } from "../../client.js";
import { getTripReport } from "../../tools/get-trip-report.js";

function makeTripReportHtml(title: string): string {
  return `<html><body><h1 class="documentFirstHeading">${title}</h1></body></html>`;
}

function createMockClient(): MountaineersClient {
  return {
    fetchFacetedQuery: vi.fn(),
    fetchHtml: vi.fn().mockResolvedValue(cheerio.load(makeTripReportHtml("Test Report"))),
    fetchJson: vi.fn(),
    fetchRaw: vi.fn(),
    fetchRosterTab: vi.fn(),
    ensureLoggedIn: vi.fn(),
    baseUrl: "https://www.mountaineers.org",
    isLoggedIn: false,
    hasCredentials: false,
  } as unknown as MountaineersClient;
}

describe("getTripReport", () => {
  let client: MountaineersClient;

  beforeEach(() => {
    client = createMockClient();
  });

  it("uses full URL when input starts with http", async () => {
    const fullUrl = "https://www.mountaineers.org/activities/trip-reports/my-report";
    await getTripReport(client, { url: fullUrl });
    expect(client.fetchHtml).toHaveBeenCalledWith(fullUrl);
  });

  it("constructs URL from slug when input is not a full URL", async () => {
    await getTripReport(client, { url: "rainier-summit-report" });
    expect(client.fetchHtml).toHaveBeenCalledWith(
      "https://www.mountaineers.org/activities/trip-reports/rainier-summit-report",
    );
  });

  it("returns parsed trip report detail", async () => {
    const result = await getTripReport(client, { url: "test-report" });
    expect(result.title).toBe("Test Report");
    expect(result.url).toBe("https://www.mountaineers.org/activities/trip-reports/test-report");
  });
});
