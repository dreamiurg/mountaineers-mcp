import * as cheerio from "cheerio";
import { describe, expect, it, vi } from "vitest";
import type { MountaineersClient } from "../../client.js";
import { getBadge } from "../../tools/get-badge.js";

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

// Real Plone pages render <h2 class="kicker">Badge</h2> INSIDE #content-core,
// so the dedup logic must strip it (otherwise the literal word "Badge" leaks
// into body_text). Keep this fixture realistic.
const AWARD_WITH_CATEGORIES_HTML = `<html><body>
  <h1 class="documentFirstHeading">Sea Kayaking Scavenger Hunt</h1>
  <p class="documentDescription">Explore Puget Sound by kayak.</p>
  <div id="content-core">
    <h2 class="kicker">Badge</h2>
    <h1 class="documentFirstHeading">Sea Kayaking Scavenger Hunt</h1>
    <p class="documentDescription">Explore Puget Sound by kayak.</p>
    <p>Complete activities from any two of the categories below.</p>
    <h3>Category A</h3>
    <p>Paddle to one of the following islands.</p>
    <ul><li>Blake Island</li><li>Bainbridge Island</li></ul>
    <h3>Category B</h3>
    <p>Photograph wildlife from the kayak.</p>
    <ol><li>Harbor seal</li><li>Bald eagle</li></ol>
    <h3>Category C</h3>
    <p>Camp overnight on a marine trail site.</p>
  </div>
</body></html>`;

const INSTRUCTOR_BADGE_HTML = `<html><body>
  <h2 class="kicker">Badge</h2>
  <h1 class="documentFirstHeading">Basic Climbing Instructor</h1>
  <p class="documentDescription"></p>
  <div id="content-core">
    <h1 class="documentFirstHeading">Basic Climbing Instructor</h1>
    <p>Demonstrate competency in belaying and rappelling techniques.</p>
    <p>Co-lead at least one Basic Climbing field trip.</p>
  </div>
</body></html>`;

const LEADER_BADGE_HTML = `<html><body>
  <h2 class="kicker">Badge</h2>
  <h1 class="documentFirstHeading">Day Hike Leader</h1>
  <div id="content-core">
    <h1 class="documentFirstHeading">Day Hike Leader</h1>
    <p>Lead two day hikes as a co-leader before applying.</p>
  </div>
</body></html>`;

const AWARD_NO_BRANCH_HTML = `<html><body>
  <h2 class="kicker">Badge</h2>
  <h1 class="documentFirstHeading">10 Essentials Award</h1>
  <div id="content-core">
    <h1 class="documentFirstHeading">10 Essentials Award</h1>
    <p>Carry the 10 essentials on every outing.</p>
  </div>
</body></html>`;

describe("getBadge", () => {
  it("parses an award badge with Category A/B/C sections", async () => {
    const client = createMockClient(AWARD_WITH_CATEGORIES_HTML);
    const result = await getBadge(client, {
      url: "/membership/badges/award-badges/seattle-branch/sea-kayaking-scavenger-hunt",
    });

    expect(result.title).toBe("Sea Kayaking Scavenger Hunt");
    expect(result.description).toBe("Explore Puget Sound by kayak.");
    expect(result.badge_type).toBe("award");
    expect(result.branch_slug).toBe("seattle-branch");
    expect(result.url).toBe(
      "https://www.mountaineers.org/membership/badges/award-badges/seattle-branch/sea-kayaking-scavenger-hunt",
    );

    expect(result.categories).toHaveLength(3);
    expect(result.categories[0].name).toBe("Category A");
    expect(result.categories[0].criteria).toContain("Paddle to one of the following islands");
    expect(result.categories[0].criteria).toContain("Blake Island");
    expect(result.categories[1].name).toBe("Category B");
    expect(result.categories[1].criteria).toContain("Harbor seal");
    expect(result.categories[2].name).toBe("Category C");
    expect(result.categories[2].criteria).toContain("Camp overnight");
  });

  it("excludes Category section content from body_text (dedup with categories[])", async () => {
    const client = createMockClient(AWARD_WITH_CATEGORIES_HTML);
    const result = await getBadge(client, {
      url: "/membership/badges/award-badges/seattle-branch/sea-kayaking-scavenger-hunt",
    });

    expect(result.body_text).not.toBeNull();
    expect(result.body_text).toContain("Complete activities from any two");
    // Title and description must NOT appear in body_text.
    expect(result.body_text).not.toContain("Sea Kayaking Scavenger Hunt");
    expect(result.body_text).not.toContain("Explore Puget Sound by kayak.");
    // h2.kicker (literal "Badge") must NOT leak from #content-core into body_text.
    // Page title doesn't contain "Badge", so this is a clean sentinel.
    expect(result.body_text).not.toContain("Badge");
    // Category headings and their content must NOT appear in body_text.
    expect(result.body_text).not.toContain("Category A");
    expect(result.body_text).not.toContain("Blake Island");
    expect(result.body_text).not.toContain("Harbor seal");
    expect(result.body_text).not.toContain("Camp overnight");
  });

  it("normalizes a full URL to a path before fetching", async () => {
    const client = createMockClient(INSTRUCTOR_BADGE_HTML);
    const fullUrl =
      "https://www.mountaineers.org/membership/badges/instructor-badges/basic-climbing-instructor/";
    const result = await getBadge(client, { url: fullUrl });

    expect(client.fetchHtml).toHaveBeenCalledWith(
      "/membership/badges/instructor-badges/basic-climbing-instructor",
    );
    expect(result.url).toBe(
      "https://www.mountaineers.org/membership/badges/instructor-badges/basic-climbing-instructor",
    );
  });

  it("rejects URLs that do not contain /membership/badges/", async () => {
    const client = createMockClient(INSTRUCTOR_BADGE_HTML);
    await expect(getBadge(client, { url: "/about/vision-leadership/some-badge" })).rejects.toThrow(
      /membership\/badges\//,
    );
    expect(client.fetchHtml).not.toHaveBeenCalled();
  });

  it("rejects bare slugs (must be on mountaineers.org)", async () => {
    const client = createMockClient(INSTRUCTOR_BADGE_HTML);
    await expect(getBadge(client, { url: "some-badge" })).rejects.toThrow(/mountaineers\.org/);
    expect(client.fetchHtml).not.toHaveBeenCalled();
  });

  it("infers badge_type=instructor and returns null branch_slug + empty categories", async () => {
    const client = createMockClient(INSTRUCTOR_BADGE_HTML);
    const result = await getBadge(client, {
      url: "/membership/badges/instructor-badges/basic-climbing-instructor",
    });
    expect(result.badge_type).toBe("instructor");
    expect(result.branch_slug).toBeNull();
    expect(result.categories).toEqual([]);
    expect(result.description).toBeNull();
    expect(result.body_text).toContain("Demonstrate competency in belaying");
  });

  it("infers badge_type=leader and returns null branch_slug + empty categories", async () => {
    const client = createMockClient(LEADER_BADGE_HTML);
    const result = await getBadge(client, {
      url: "/membership/badges/leader-badges/day-hike-leader",
    });
    expect(result.badge_type).toBe("leader");
    expect(result.branch_slug).toBeNull();
    expect(result.categories).toEqual([]);
    expect(result.body_text).toContain("Lead two day hikes");
  });

  it("returns null branch_slug for award badges without a branch segment", async () => {
    const client = createMockClient(AWARD_NO_BRANCH_HTML);
    const result = await getBadge(client, {
      url: "/membership/badges/award-badges/10-essentials-award",
    });
    expect(result.badge_type).toBe("award");
    expect(result.branch_slug).toBeNull();
    expect(result.categories).toEqual([]);
  });

  it("infers badge_type=other for unrecognized badge subpaths", async () => {
    const client = createMockClient(LEADER_BADGE_HTML);
    const result = await getBadge(client, {
      url: "/membership/badges/honorary-badges/founders-medal",
    });
    expect(result.badge_type).toBe("other");
    expect(result.branch_slug).toBeNull();
  });

  it("caps body_text at 5000 chars with an ellipsis marker", async () => {
    const longBody = "x".repeat(6000);
    const html = `<html><body>
      <h1 class="documentFirstHeading">Long Badge</h1>
      <div id="content-core">
        <h1 class="documentFirstHeading">Long Badge</h1>
        <p>${longBody}</p>
      </div>
    </body></html>`;
    const client = createMockClient(html);
    const result = await getBadge(client, {
      url: "/membership/badges/leader-badges/long-badge",
    });
    expect(result.body_text).not.toBeNull();
    expect(result.body_text?.length).toBe(5001);
    expect(result.body_text?.endsWith("…")).toBe(true);
  });

  it("caps each category criteria at 1000 chars with an ellipsis marker", async () => {
    const longCriteria = "y".repeat(2000);
    const html = `<html><body>
      <h1 class="documentFirstHeading">Big Award</h1>
      <div id="content-core">
        <h1 class="documentFirstHeading">Big Award</h1>
        <h3>Category A</h3>
        <p>${longCriteria}</p>
      </div>
    </body></html>`;
    const client = createMockClient(html);
    const result = await getBadge(client, {
      url: "/membership/badges/award-badges/seattle-branch/big-award",
    });
    expect(result.categories).toHaveLength(1);
    expect(result.categories[0].criteria.length).toBe(1001);
    expect(result.categories[0].criteria.endsWith("…")).toBe(true);
  });

  it("returns null body_text and empty categories when #content-core is absent", async () => {
    const html = `<html><body>
      <h1 class="documentFirstHeading">Bare Badge</h1>
    </body></html>`;
    const client = createMockClient(html);
    const result = await getBadge(client, {
      url: "/membership/badges/leader-badges/bare-badge",
    });
    expect(result.title).toBe("Bare Badge");
    expect(result.body_text).toBeNull();
    expect(result.categories).toEqual([]);
  });
});
