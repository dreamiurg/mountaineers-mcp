import * as cheerio from "cheerio";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MountaineersClient } from "../../client.js";
import { getActivityRoster } from "../../tools/get-activity-roster.js";

function createMockClient(): MountaineersClient {
  return {
    fetchFacetedQuery: vi.fn(),
    fetchHtml: vi.fn(),
    fetchJson: vi.fn(),
    fetchRaw: vi.fn(),
    fetchRosterTab: vi.fn().mockResolvedValue(cheerio.load("<html><body></body></html>")),
    ensureLoggedIn: vi.fn(),
    baseUrl: "https://www.mountaineers.org",
    isLoggedIn: true,
    hasCredentials: true,
  } as unknown as MountaineersClient;
}

describe("getActivityRoster", () => {
  let client: MountaineersClient;

  beforeEach(() => {
    client = createMockClient();
  });

  it("calls fetchRosterTab with the full URL when given a URL", async () => {
    const activityUrl = "https://www.mountaineers.org/activities/activities/day-hike-1";
    await getActivityRoster(client, { url: activityUrl });
    expect(client.fetchRosterTab).toHaveBeenCalledWith(activityUrl);
  });

  it("constructs URL from slug when input is not a full URL", async () => {
    await getActivityRoster(client, { url: "day-hike-rock-candy-mountain-11" });
    expect(client.fetchRosterTab).toHaveBeenCalledWith(
      "https://www.mountaineers.org/activities/activities/day-hike-rock-candy-mountain-11",
    );
  });

  it("returns empty array when no roster entries exist", async () => {
    const result = await getActivityRoster(client, {
      url: "https://www.mountaineers.org/activities/activities/empty-hike",
    });
    expect(result).toEqual([]);
  });

  it("returns parsed roster entries", async () => {
    const rosterHtml = `
      <div class="roster-contact">
        <a class="contact-modal" href="/members/leader-1">
          <div class="roster-name">Leader One</div>
        </a>
        <div class="roster-position">Leader</div>
      </div>
      <div class="roster-contact">
        <a class="contact-modal" href="/members/participant-1">
          <div class="roster-name">Participant One</div>
        </a>
        <div class="roster-position">Participant</div>
      </div>
    `;
    (client.fetchRosterTab as ReturnType<typeof vi.fn>).mockResolvedValue(cheerio.load(rosterHtml));

    const result = await getActivityRoster(client, {
      url: "https://www.mountaineers.org/activities/activities/hike-1",
    });
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe("Leader One");
    expect(result[0].role).toBe("Leader");
    expect(result[1].name).toBe("Participant One");
  });
});
