import * as cheerio from "cheerio";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MountaineersClient } from "../../client.js";
import { searchEvents } from "../../tools/search-events.js";

interface FixtureItem {
  title: string;
  href: string;
  date?: string;
  sidebar?: string[];
}

function makeResultsHtml(count: number, items: FixtureItem[] = []): string {
  const itemsHtml = items
    .map((i) => {
      const sidebarHtml = (i.sidebar ?? []).map((line) => `<div>${line}</div>`).join("");
      const dateHtml = i.date ? `<div class="result-date">${i.date}</div>` : "";
      return `
        <div class="result-item">
          <h2 class="result-title"><a href="${i.href}">${i.title}</a></h2>
          ${dateHtml}
          <div class="result-sidebar">${sidebarHtml}</div>
        </div>`;
    })
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

describe("searchEvents", () => {
  let client: MountaineersClient;

  beforeEach(() => {
    client = createMockClient(makeResultsHtml(0));
  });

  it("calls fetchFacetedQuery with /search base path and event type", async () => {
    await searchEvents(client, {});
    const call = (client.fetchFacetedQuery as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(call[0]).toBe("/search");
    const params = call[1] as URLSearchParams;
    expect(params.get("type")).toBe("mtneers.event");
  });

  it("maps query to SearchableText", async () => {
    await searchEvents(client, { query: "rockfest" });
    const params = (client.fetchFacetedQuery as ReturnType<typeof vi.fn>).mock
      .calls[0][1] as URLSearchParams;
    expect(params.get("SearchableText")).toBe("rockfest");
  });

  it("omits SearchableText when query is not provided", async () => {
    await searchEvents(client, {});
    const params = (client.fetchFacetedQuery as ReturnType<typeof vi.fn>).mock
      .calls[0][1] as URLSearchParams;
    expect(params.get("SearchableText")).toBeNull();
  });

  it("does not set b_start for page 0", async () => {
    await searchEvents(client, {});
    const params = (client.fetchFacetedQuery as ReturnType<typeof vi.fn>).mock
      .calls[0][1] as URLSearchParams;
    expect(params.get("b_start")).toBeNull();
  });

  it("sets b_start = page * 20 for page > 0", async () => {
    await searchEvents(client, { page: 4 });
    const params = (client.fetchFacetedQuery as ReturnType<typeof vi.fn>).mock
      .calls[0][1] as URLSearchParams;
    expect(params.get("b_start")).toBe("80");
  });

  it("parses result items into EventSummary with date and location", async () => {
    client = createMockClient(
      makeResultsHtml(2, [
        {
          title: "Rockfest 2026",
          href: "/about/vision-leadership/events/rockfest-2026",
          date: "May 02, 2026 08:00 AM to 09:00 PM",
          sidebar: ["Seattle Program Center", "7700 Sand Point Way NE"],
        },
        {
          title: "Friction Climbing Clinic",
          href: "/locations-lodges/seattle-program-center/events/friction-climbing-clinic-2026-05-19",
          date: "May 19, 2026 06:00 PM to 09:00 PM",
          sidebar: ["Seattle Program Center"],
        },
      ]),
    );
    const result = await searchEvents(client, {});
    expect(result.total_count).toBe(2);
    expect(result.items).toEqual([
      {
        title: "Rockfest 2026",
        url: "https://www.mountaineers.org/about/vision-leadership/events/rockfest-2026",
        date: "May 02, 2026 08:00 AM to 09:00 PM",
        location: "Seattle Program Center",
      },
      {
        title: "Friction Climbing Clinic",
        url: "https://www.mountaineers.org/locations-lodges/seattle-program-center/events/friction-climbing-clinic-2026-05-19",
        date: "May 19, 2026 06:00 PM to 09:00 PM",
        location: "Seattle Program Center",
      },
    ]);
  });

  it("returns empty items and zero count when no results", async () => {
    const result = await searchEvents(client, { query: "zzznope" });
    expect(result.total_count).toBe(0);
    expect(result.items).toEqual([]);
    expect(result.has_more).toBe(false);
    expect(result.page).toBe(0);
  });

  it("skips a sidebar line that duplicates the date when picking location", async () => {
    client = createMockClient(
      makeResultsHtml(1, [
        {
          title: "Branch Meeting",
          href: "/locations-lodges/seattle-branch/events/branch-meeting",
          date: "Apr 30, 2026 07:00 PM to 09:00 PM",
          sidebar: [
            "Apr 30, 2026 07:00 PM to 09:00 PM",
            "Mountaineers Seattle Program Center",
            "7700 Sand Point Way NE",
          ],
        },
      ]),
    );
    const result = await searchEvents(client, {});
    expect(result.items[0].location).toBe("Mountaineers Seattle Program Center");
  });

  it("returns null location when sidebar is empty", async () => {
    client = createMockClient(
      makeResultsHtml(1, [
        {
          title: "Lonely Event",
          href: "/events/lonely",
          date: "Jan 1, 2026 12:00 PM to 01:00 PM",
          sidebar: [],
        },
      ]),
    );
    const result = await searchEvents(client, {});
    expect(result.items[0].location).toBeNull();
    expect(result.items[0].date).toBe("Jan 1, 2026 12:00 PM to 01:00 PM");
  });

  it("computes has_more from total_count and page", async () => {
    client = createMockClient(makeResultsHtml(1123));
    const result = await searchEvents(client, { page: 0 });
    expect(result.has_more).toBe(true);
    expect(result.total_count).toBe(1123);
  });
});
