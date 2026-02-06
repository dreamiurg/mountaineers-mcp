import * as cheerio from "cheerio";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MountaineersClient } from "../../client.js";
import { getActivity } from "../../tools/get-activity.js";

function makeActivityHtml(title: string): string {
  return `<html><body><h1 class="documentFirstHeading">${title}</h1></body></html>`;
}

function createMockClient(): MountaineersClient {
  return {
    fetchFacetedQuery: vi.fn(),
    fetchHtml: vi.fn().mockResolvedValue(cheerio.load(makeActivityHtml("Test Activity"))),
    fetchJson: vi.fn(),
    fetchRaw: vi.fn(),
    fetchRosterTab: vi.fn(),
    ensureLoggedIn: vi.fn(),
    baseUrl: "https://www.mountaineers.org",
    isLoggedIn: false,
    hasCredentials: false,
  } as unknown as MountaineersClient;
}

describe("getActivity", () => {
  let client: MountaineersClient;

  beforeEach(() => {
    client = createMockClient();
  });

  it("uses full URL when input starts with http", async () => {
    const fullUrl = "https://www.mountaineers.org/activities/activities/day-hike-1";
    await getActivity(client, { url: fullUrl });
    expect(client.fetchHtml).toHaveBeenCalledWith(fullUrl);
  });

  it("constructs URL from slug when input is not a full URL", async () => {
    await getActivity(client, { url: "day-hike-rock-candy-mountain-11" });
    expect(client.fetchHtml).toHaveBeenCalledWith(
      "https://www.mountaineers.org/activities/activities/day-hike-rock-candy-mountain-11",
    );
  });

  it("returns parsed activity detail", async () => {
    const result = await getActivity(client, { url: "test-activity" });
    expect(result.title).toBe("Test Activity");
    expect(result.url).toBe("https://www.mountaineers.org/activities/activities/test-activity");
  });
});
