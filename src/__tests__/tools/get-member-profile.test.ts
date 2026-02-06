import * as cheerio from "cheerio";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MountaineersClient } from "../../client.js";
import { getMemberProfile } from "../../tools/get-member-profile.js";

function makeProfileHtml(name: string): string {
  return `<html><body><h1 class="documentFirstHeading">${name}</h1></body></html>`;
}

function createMockClient(): MountaineersClient {
  return {
    fetchFacetedQuery: vi.fn(),
    fetchHtml: vi.fn().mockResolvedValue(cheerio.load(makeProfileHtml("John Smith"))),
    fetchJson: vi.fn(),
    fetchRaw: vi.fn(),
    fetchRosterTab: vi.fn(),
    ensureLoggedIn: vi.fn(),
    baseUrl: "https://www.mountaineers.org",
    isLoggedIn: true,
    hasCredentials: true,
  } as unknown as MountaineersClient;
}

describe("getMemberProfile", () => {
  let client: MountaineersClient;

  beforeEach(() => {
    client = createMockClient();
  });

  it("calls fetchHtml with correct member URL and authenticated=true", async () => {
    await getMemberProfile(client, { member_slug: "john-smith" });
    expect(client.fetchHtml).toHaveBeenCalledWith("/members/john-smith", { authenticated: true });
  });

  it("returns parsed profile with full URL", async () => {
    const result = await getMemberProfile(client, { member_slug: "john-smith" });
    expect(result.name).toBe("John Smith");
    expect(result.url).toBe("https://www.mountaineers.org/members/john-smith");
  });

  it("constructs URL from slug, not from a full URL", async () => {
    await getMemberProfile(client, { member_slug: "alice-wonder" });
    expect(client.fetchHtml).toHaveBeenCalledWith("/members/alice-wonder", { authenticated: true });
  });
});
