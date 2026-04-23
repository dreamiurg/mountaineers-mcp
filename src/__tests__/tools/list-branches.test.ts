import * as cheerio from "cheerio";
import { describe, expect, it, vi } from "vitest";
import type { MountaineersClient } from "../../client.js";
import { listBranches } from "../../tools/list-branches.js";

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

describe("listBranches", () => {
  it("parses and deduplicates branch anchors from multi-anchor HTML", async () => {
    const html = `<html><body>
      <nav>
        <a href="/locations-lodges/bellingham-branch">Bellingham</a>
        <a href="/locations-lodges/everett-branch">Everett</a>
        <a href="/locations-lodges/foothills-branch">Foothills Branch</a>
        <a href="/locations-lodges/seattle-branch">Seattle Branch</a>
      </nav>
      <section>
        <a href="/locations-lodges/seattle-branch">Seattle Branch</a>
        <a href="https://www.mountaineers.org/locations-lodges/tacoma-branch">Tacoma Branch</a>
      </section>
      <footer>
        <a href="/locations-lodges/seattle-branch/committees">Seattle committees</a>
        <a href="/locations-lodges/seattle-program-center">Seattle Program Center</a>
        <a href="/about">About</a>
      </footer>
    </body></html>`;
    const client = createMockClient(html);
    const result = await listBranches(client, {});

    expect(result).toHaveLength(5);
    expect(result.map((b) => b.slug)).toEqual([
      "bellingham-branch",
      "everett-branch",
      "foothills-branch",
      "seattle-branch",
      "tacoma-branch",
    ]);
    expect(result[0]).toEqual({
      slug: "bellingham-branch",
      name: "Bellingham",
      url: "https://www.mountaineers.org/locations-lodges/bellingham-branch",
    });
    expect(result[2].name).toBe("Foothills Branch");
    expect(result[4].url).toBe("https://www.mountaineers.org/locations-lodges/tacoma-branch");
  });

  it("returns empty array when no branch anchors match", async () => {
    const html = `<html><body>
      <a href="/about">About</a>
      <a href="/locations-lodges">Locations</a>
      <a href="/locations-lodges/seattle-program-center">Seattle Program Center</a>
    </body></html>`;
    const client = createMockClient(html);
    const result = await listBranches(client, {});
    expect(result).toEqual([]);
  });

  it("fetches /locations-lodges without auth", async () => {
    const client = createMockClient("<html></html>");
    await listBranches(client, {});
    expect(client.fetchHtml).toHaveBeenCalledWith("/locations-lodges");
  });

  it("skips anchors with empty text", async () => {
    const html = `<html><body>
      <a href="/locations-lodges/seattle-branch"></a>
      <a href="/locations-lodges/tacoma-branch">Tacoma Branch</a>
    </body></html>`;
    const client = createMockClient(html);
    const result = await listBranches(client, {});
    expect(result).toHaveLength(1);
    expect(result[0].slug).toBe("tacoma-branch");
  });
});
