import * as cheerio from "cheerio";
import { describe, expect, it, vi } from "vitest";
import type { MountaineersClient } from "../../client.js";
import { getRoute } from "../../tools/get-route.js";

function makeRouteHtml(opts: {
  title?: string;
  description?: string;
  details?: string;
  directions?: string;
  tabs?: string;
}): string {
  return `<html><body>
    <article>
      <header class="program-header">
        <h1 class="documentFirstHeading">${opts.title ?? "Mount Si Old Trail"}</h1>
        <p class="documentDescription">${opts.description ?? "A great hike"}</p>
      </header>
      <div class="program-core">
        <ul class="details">
          <li><strong>Suitable Activities:</strong> <span>Day Hiking</span></li>
          <li><strong>Seasons:</strong> <span>Year-round</span></li>
        </ul>
        <ul class="details">
          <li><strong>Difficulty:</strong> <span>Strenuous</span></li>
          <li><strong>Length:</strong> <span>7.0 mi</span></li>
          <li><strong>Elevation Gain:</strong> <span>3,300 ft</span></li>
          <li><label>High Point:</label> <span>3,841 ft</span></li>
        </ul>
        <ul class="details">
          <li><strong>Land Manager:</strong> <a href="https://www.dnr.wa.gov">Mount Si NRCA</a></li>
          <li><strong>Parking Permit Required:</strong> <a href="http://discoverpass.wa.gov/">Discover Pass</a></li>
          <li><strong>Recommended Party Size:</strong> <span>12</span></li>
          <li><strong>Maximum Party Size:</strong> <span>12</span></li>
        </ul>
        ${opts.details ?? ""}
        <h2>getting there</h2>
        <p>${opts.directions ?? "Take I-90 to exit 32."}</p>
        <h2>on the trail</h2>
        <p>Follow the main trail.</p>
      </div>
      <div class="tabs">
        <header>
          <div class="tab-title">Map</div>
          <div class="tab-title">Titles</div>
        </header>
        <div class="tab">
          <div class="tab-title">Map</div>
          <div class="tab-content">
            <label>Recommended Maps:</label>
            <ul><li>Green Trails Mount Si No. 206S</li></ul>
          </div>
        </div>
        <div class="tab">
          <div class="tab-title">Titles</div>
          <div class="tab-content">
            <ul>
              <li>Mount Si Haystack</li>
              <li>Blowdown Mountain</li>
            </ul>
          </div>
        </div>
        ${opts.tabs ?? ""}
      </div>
    </article>
  </body></html>`;
}

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

describe("getRoute", () => {
  it("parses title and description", async () => {
    const client = createMockClient(makeRouteHtml({}));
    const result = await getRoute(client, {
      url: "https://www.mountaineers.org/activities/routes-places/mount-si-old-trail",
    });
    expect(result.title).toBe("Mount Si Old Trail");
    expect(result.description).toBe("A great hike");
  });

  it("parses physical stats", async () => {
    const client = createMockClient(makeRouteHtml({}));
    const result = await getRoute(client, { url: "mount-si-old-trail" });
    expect(result.difficulty).toBe("Strenuous");
    expect(result.length).toBe("7.0 mi");
    expect(result.elevation_gain).toBe("3,300 ft");
    expect(result.high_point).toBe("3,841 ft");
  });

  it("parses activity metadata", async () => {
    const client = createMockClient(makeRouteHtml({}));
    const result = await getRoute(client, { url: "mount-si-old-trail" });
    expect(result.suitable_activities).toBe("Day Hiking");
    expect(result.seasons).toBe("Year-round");
  });

  it("parses land manager and parking", async () => {
    const client = createMockClient(makeRouteHtml({}));
    const result = await getRoute(client, { url: "mount-si-old-trail" });
    expect(result.land_manager).toBe("Mount Si NRCA");
    expect(result.parking_permit).toBe("Discover Pass");
  });

  it("parses party sizes", async () => {
    const client = createMockClient(makeRouteHtml({}));
    const result = await getRoute(client, { url: "mount-si-old-trail" });
    expect(result.recommended_party_size).toBe("12");
    expect(result.maximum_party_size).toBe("12");
  });

  it("extracts directions from getting there section", async () => {
    const client = createMockClient(makeRouteHtml({ directions: "Take I-90 to exit 32." }));
    const result = await getRoute(client, { url: "mount-si-old-trail" });
    expect(result.directions).toContain("Take I-90 to exit 32.");
  });

  it("extracts recommended maps from tabs", async () => {
    const client = createMockClient(makeRouteHtml({}));
    const result = await getRoute(client, { url: "mount-si-old-trail" });
    expect(result.recommended_maps).toContain("Green Trails Mount Si No. 206S");
  });

  it("extracts related routes from Titles tab", async () => {
    const client = createMockClient(makeRouteHtml({}));
    const result = await getRoute(client, { url: "mount-si-old-trail" });
    expect(result.related_routes).toEqual(["Mount Si Haystack", "Blowdown Mountain"]);
  });

  it("constructs URL from slug", async () => {
    const client = createMockClient(makeRouteHtml({}));
    await getRoute(client, { url: "mount-si-old-trail" });
    expect(client.fetchHtml).toHaveBeenCalledWith(
      "https://www.mountaineers.org/activities/routes-places/mount-si-old-trail",
    );
  });

  it("uses full URL directly", async () => {
    const client = createMockClient(makeRouteHtml({}));
    await getRoute(client, {
      url: "https://www.mountaineers.org/activities/routes-places/mount-si-old-trail",
    });
    expect(client.fetchHtml).toHaveBeenCalledWith(
      "https://www.mountaineers.org/activities/routes-places/mount-si-old-trail",
    );
  });

  it("handles missing fields gracefully", async () => {
    const html = '<html><body><h1 class="documentFirstHeading">Minimal Route</h1></body></html>';
    const client = createMockClient(html);
    const result = await getRoute(client, { url: "minimal" });
    expect(result.title).toBe("Minimal Route");
    expect(result.difficulty).toBeNull();
    expect(result.recommended_maps).toEqual([]);
    expect(result.related_routes).toEqual([]);
  });
});
