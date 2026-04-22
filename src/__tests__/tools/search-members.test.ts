import * as cheerio from "cheerio";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MountaineersClient } from "../../client.js";
import { searchMembers } from "../../tools/search-members.js";

function makeResultsHtml(count: number, items: { name: string; href: string }[] = []): string {
  const itemsHtml = items
    .map(
      (i) => `
        <div class="result-item">
          <h2 class="result-title"><a href="${i.href}">${i.name}</a></h2>
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

describe("searchMembers", () => {
  let client: MountaineersClient;

  beforeEach(() => {
    client = createMockClient(makeResultsHtml(0));
  });

  it("calls fetchFacetedQuery with /search base path and contact type", async () => {
    await searchMembers(client, { query: "schiller" });
    const call = (client.fetchFacetedQuery as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(call[0]).toBe("/search");
    const params = call[1] as URLSearchParams;
    expect(params.get("type")).toBe("mtneers.contact");
    expect(params.get("SearchableText")).toBe("schiller");
  });

  it("parses result items into MemberSummary with slug derived from href", async () => {
    client = createMockClient(
      makeResultsHtml(2, [
        { name: "Stefanie Schiller", href: "/members/stefanie-schiller" },
        {
          name: "Seattle Climbing",
          href: "https://www.mountaineers.org/members/seattle-climbing",
        },
      ]),
    );
    const result = await searchMembers(client, { query: "schiller" });
    expect(result.total_count).toBe(2);
    expect(result.items).toEqual([
      {
        name: "Stefanie Schiller",
        slug: "stefanie-schiller",
        url: "https://www.mountaineers.org/members/stefanie-schiller",
      },
      {
        name: "Seattle Climbing",
        slug: "seattle-climbing",
        url: "https://www.mountaineers.org/members/seattle-climbing",
      },
    ]);
  });

  it("returns empty items and zero count when no results", async () => {
    const result = await searchMembers(client, { query: "zzznope" });
    expect(result.total_count).toBe(0);
    expect(result.items).toEqual([]);
    expect(result.has_more).toBe(false);
    expect(result.page).toBe(0);
  });

  it("does not set b_start for page 0", async () => {
    await searchMembers(client, { query: "x" });
    const params = (client.fetchFacetedQuery as ReturnType<typeof vi.fn>).mock
      .calls[0][1] as URLSearchParams;
    expect(params.get("b_start")).toBeNull();
  });

  it("sets b_start = page * 20 for page > 0", async () => {
    await searchMembers(client, { query: "x", page: 3 });
    const params = (client.fetchFacetedQuery as ReturnType<typeof vi.fn>).mock
      .calls[0][1] as URLSearchParams;
    expect(params.get("b_start")).toBe("60");
  });

  it("computes has_more from total_count and page", async () => {
    client = createMockClient(makeResultsHtml(1120));
    const result = await searchMembers(client, { query: "climb", page: 0 });
    expect(result.has_more).toBe(true);
    expect(result.total_count).toBe(1120);
  });

  it("handles comma-formatted total counts", async () => {
    client = createMockClient(makeResultsHtml(0).replace("0 results", "1,234 results"));
    const result = await searchMembers(client, { query: "x" });
    expect(result.total_count).toBe(1234);
  });
});
