import * as cheerio from "cheerio";
import { describe, expect, it, vi } from "vitest";
import type { MountaineersClient } from "../../client.js";
import { listCommittees } from "../../tools/list-committees.js";

function createMockClient(html: string): MountaineersClient {
  return {
    fetchFacetedQuery: vi.fn(),
    fetchHtml: vi.fn().mockResolvedValue(cheerio.load(html)),
    fetchJson: vi.fn(),
    fetchRaw: vi.fn(),
    fetchRosterTab: vi.fn(),
    ensureLoggedIn: vi.fn(),
    baseUrl: "https://www.mountaineers.org",
    isLoggedIn: false,
    hasCredentials: false,
  } as unknown as MountaineersClient;
}

const SEATTLE_COMMITTEES_HTML = `<html><body>
  <nav>
    <a href="/locations-lodges/seattle-branch/committees/seattle-climbing-committee">Seattle Climbing Committee</a>
    <a href="/locations-lodges/seattle-branch/committees/seattle-hiking-committee">Seattle Hiking Committee</a>
    <a href="https://www.mountaineers.org/locations-lodges/seattle-branch/committees/seattle-navigation-committee">Seattle Navigation Committee</a>
  </nav>
  <section>
    <a href="/locations-lodges/seattle-branch/committees/seattle-climbing-committee">Seattle Climbing Committee</a>
    <a href="/locations-lodges/seattle-branch/committees">All committees</a>
    <a href="/locations-lodges/tacoma-branch/committees/tacoma-climbing-committee">Tacoma Climbing</a>
    <a href="/about">About</a>
  </section>
</body></html>`;

describe("listCommittees", () => {
  it("parses and deduplicates committees for a branch", async () => {
    const client = createMockClient(SEATTLE_COMMITTEES_HTML);
    const result = await listCommittees(client, { branch: "seattle-branch" });

    expect(result).toHaveLength(3);
    expect(result.map((c) => c.slug)).toEqual([
      "seattle-climbing-committee",
      "seattle-hiking-committee",
      "seattle-navigation-committee",
    ]);
    expect(result[0]).toEqual({
      slug: "seattle-climbing-committee",
      name: "Seattle Climbing Committee",
      url: "https://www.mountaineers.org/locations-lodges/seattle-branch/committees/seattle-climbing-committee",
      branch_slug: "seattle-branch",
    });
  });

  it("returns empty array when no committee anchors match", async () => {
    const html = `<html><body>
      <a href="/locations-lodges/seattle-branch">Back to Seattle</a>
      <a href="/about">About</a>
    </body></html>`;
    const client = createMockClient(html);
    const result = await listCommittees(client, { branch: "seattle-branch" });
    expect(result).toEqual([]);
  });

  it("accepts full URL as branch input", async () => {
    const client = createMockClient(SEATTLE_COMMITTEES_HTML);
    const result = await listCommittees(client, {
      branch: "https://www.mountaineers.org/locations-lodges/seattle-branch",
    });
    expect(result).toHaveLength(3);
    expect(client.fetchHtml).toHaveBeenCalledWith("/locations-lodges/seattle-branch/committees");
  });

  it("accepts path-style branch input", async () => {
    const client = createMockClient(SEATTLE_COMMITTEES_HTML);
    await listCommittees(client, { branch: "/locations-lodges/seattle-branch" });
    expect(client.fetchHtml).toHaveBeenCalledWith("/locations-lodges/seattle-branch/committees");
  });

  it("throws on invalid branch slug", async () => {
    const client = createMockClient("<html></html>");
    await expect(listCommittees(client, { branch: "seattle" })).rejects.toThrow(
      /branch must be a valid branch slug/,
    );
    await expect(listCommittees(client, { branch: "Seattle-Branch" })).rejects.toThrow(
      /branch must be a valid branch slug/,
    );
    await expect(listCommittees(client, { branch: "" })).rejects.toThrow(
      /branch must be a valid branch slug/,
    );
  });
});
