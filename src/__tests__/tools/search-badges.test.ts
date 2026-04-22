import * as cheerio from "cheerio";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MountaineersClient } from "../../client.js";
import { searchBadges } from "../../tools/search-badges.js";

interface FixtureItem {
  title: string;
  href: string;
}

function makeResultsHtml(count: number, items: FixtureItem[] = []): string {
  const itemsHtml = items
    .map(
      (i) => `
        <div class="result-item">
          <h2 class="result-title"><a href="${i.href}">${i.title}</a></h2>
        </div>`,
    )
    .join("");
  return `<div id="faceted-result-count">${count} results</div>${itemsHtml}`;
}

function createMockClient(html: string): MountaineersClient {
  return {
    fetchFacetedQuery: vi.fn().mockResolvedValue(cheerio.load(html)),
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

describe("searchBadges", () => {
  let client: MountaineersClient;

  beforeEach(() => {
    client = createMockClient(makeResultsHtml(0));
  });

  it("calls fetchFacetedQuery with /search base path and badge type", async () => {
    await searchBadges(client, {});
    const call = (client.fetchFacetedQuery as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(call[0]).toBe("/search");
    const params = call[1] as URLSearchParams;
    expect(params.get("type")).toBe("mtneers.badge");
  });

  it("maps query to SearchableText", async () => {
    await searchBadges(client, { query: "kayak" });
    const params = (client.fetchFacetedQuery as ReturnType<typeof vi.fn>).mock
      .calls[0][1] as URLSearchParams;
    expect(params.get("SearchableText")).toBe("kayak");
  });

  it("omits SearchableText when query is not provided", async () => {
    await searchBadges(client, {});
    const params = (client.fetchFacetedQuery as ReturnType<typeof vi.fn>).mock
      .calls[0][1] as URLSearchParams;
    expect(params.get("SearchableText")).toBeNull();
  });

  it("does not set b_start for page 0", async () => {
    await searchBadges(client, {});
    const params = (client.fetchFacetedQuery as ReturnType<typeof vi.fn>).mock
      .calls[0][1] as URLSearchParams;
    expect(params.get("b_start")).toBeNull();
  });

  it("sets b_start = page * 20 for page > 0", async () => {
    await searchBadges(client, { page: 3 });
    const params = (client.fetchFacetedQuery as ReturnType<typeof vi.fn>).mock
      .calls[0][1] as URLSearchParams;
    expect(params.get("b_start")).toBe("60");
  });

  it("infers badge_type for all 4 URL patterns", async () => {
    client = createMockClient(
      makeResultsHtml(4, [
        {
          title: "Sea Kayaking Scavenger Hunt",
          href: "/membership/badges/award-badges/seattle-branch/sea-kayaking-scavenger-hunt",
        },
        {
          title: "Basic Climbing Instructor",
          href: "/membership/badges/instructor-badges/basic-climbing-instructor",
        },
        {
          title: "Basic Alpine Climbing Leader",
          href: "/membership/badges/leader-badges/basic-alpine-climbing-leader",
        },
        {
          title: "Some Other Badge",
          href: "/membership/badges/something-else/mystery-badge",
        },
      ]),
    );
    const result = await searchBadges(client, {});
    expect(result.total_count).toBe(4);
    expect(result.items).toEqual([
      {
        title: "Sea Kayaking Scavenger Hunt",
        url: "https://www.mountaineers.org/membership/badges/award-badges/seattle-branch/sea-kayaking-scavenger-hunt",
        badge_type: "award",
      },
      {
        title: "Basic Climbing Instructor",
        url: "https://www.mountaineers.org/membership/badges/instructor-badges/basic-climbing-instructor",
        badge_type: "instructor",
      },
      {
        title: "Basic Alpine Climbing Leader",
        url: "https://www.mountaineers.org/membership/badges/leader-badges/basic-alpine-climbing-leader",
        badge_type: "leader",
      },
      {
        title: "Some Other Badge",
        url: "https://www.mountaineers.org/membership/badges/something-else/mystery-badge",
        badge_type: "other",
      },
    ]);
  });

  it("returns empty items and zero count when no results", async () => {
    const result = await searchBadges(client, { query: "zzznope" });
    expect(result.total_count).toBe(0);
    expect(result.items).toEqual([]);
    expect(result.has_more).toBe(false);
    expect(result.page).toBe(0);
  });

  it("computes has_more from total_count and page", async () => {
    client = createMockClient(makeResultsHtml(388));
    const result = await searchBadges(client, { page: 0 });
    expect(result.has_more).toBe(true);
    expect(result.total_count).toBe(388);
  });
});
