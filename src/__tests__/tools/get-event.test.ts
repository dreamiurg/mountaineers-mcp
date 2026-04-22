import * as cheerio from "cheerio";
import { describe, expect, it, vi } from "vitest";
import type { MountaineersClient } from "../../client.js";
import { getEvent } from "../../tools/get-event.js";

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

const HAPPY_PATH_HTML = `<html><body>
  <h1 class="documentFirstHeading">Rockfest 2026</h1>
  <p class="documentDescription">A celebration of climbing.</p>
  <ul class="details">
    <li><label>When:</label> Sat, May 2, 2026 from 08:00 AM to 09:00 PM</li>
    <li><label>Committee:</label> Seattle Climbing Committee</li>
    <li><label>Branch:</label> Seattle</li>
    <li><label>Add to Calendar:</label> iCal Google</li>
    <li><label>Expected Attendance:</label> 200</li>
  </ul>
  <div id="parent-fieldname-text">
    <p>Join us for a day of climbing fun.</p>
  </div>
</body></html>`;

// Mirrors the Friction Clinic structure: nested labels inside the When: <li>.
const NESTED_LABEL_HTML = `<html><body>
  <h1 class="documentFirstHeading">Friction Climbing Clinic</h1>
  <ul class="details">
    <li><label>When:<label>Setup begins</label> at 6:00 PM. <label>the group departs</label></label>
      Tue, May 19, 2026 from 06:30 PM to 08:30 PM at 6:00 PM and at 9:00 PM.</li>
    <li><label>Committee:</label> Seattle Climbing Committee</li>
    <li><label>Branch:</label> Seattle</li>
  </ul>
</body></html>`;

describe("getEvent", () => {
  it("parses title, description, when, committee, and branch", async () => {
    const client = createMockClient(HAPPY_PATH_HTML);
    const result = await getEvent(client, {
      url: "/about/vision-leadership/events/rockfest-2026",
    });
    expect(result.title).toBe("Rockfest 2026");
    expect(result.description).toBe("A celebration of climbing.");
    expect(result.when).toBe("Sat, May 2, 2026 from 08:00 AM to 09:00 PM");
    expect(result.committee).toBe("Seattle Climbing Committee");
    expect(result.branch).toBe("Seattle");
    expect(result.body_text).toContain("Join us for a day of climbing fun.");
  });

  it("normalizes full URL to path before fetching and returns absolute url", async () => {
    const client = createMockClient(HAPPY_PATH_HTML);
    const fullUrl = "https://www.mountaineers.org/about/vision-leadership/events/rockfest-2026/";
    const result = await getEvent(client, { url: fullUrl });
    expect(client.fetchHtml).toHaveBeenCalledWith("/about/vision-leadership/events/rockfest-2026");
    expect(result.url).toBe(
      "https://www.mountaineers.org/about/vision-leadership/events/rockfest-2026",
    );
  });

  it("accepts a path input identical to the normalized form", async () => {
    const client = createMockClient(HAPPY_PATH_HTML);
    await getEvent(client, {
      url: "/about/vision-leadership/events/rockfest-2026",
    });
    expect(client.fetchHtml).toHaveBeenCalledWith("/about/vision-leadership/events/rockfest-2026");
  });

  it("throws a clear error when URL is missing /events/", async () => {
    const client = createMockClient(HAPPY_PATH_HTML);
    await expect(
      getEvent(client, { url: "/about/vision-leadership/rockfest-2026" }),
    ).rejects.toThrow(/events\//);
    expect(client.fetchHtml).not.toHaveBeenCalled();
  });

  it("handles nested <label> tags by taking only the first text node (Friction Clinic edge case)", async () => {
    const client = createMockClient(NESTED_LABEL_HTML);
    const result = await getEvent(client, {
      url: "/locations-lodges/seattle-program-center/events/friction-climbing-clinic-2026-05-19",
    });
    // The naive .text() call would produce "When:Setup beginsthe group departs" —
    // verify the parser used .contents().first() to grab just "When:".
    expect(result.when).toBe(
      "Tue, May 19, 2026 from 06:30 PM to 08:30 PM at 6:00 PM and at 9:00 PM.",
    );
    expect(result.committee).toBe("Seattle Climbing Committee");
    expect(result.branch).toBe("Seattle");
    // Should not have leaked a malformed label like "When:Setup begins..." into extra_fields.
    expect(Object.keys(result.extra_fields)).toEqual([]);
  });

  it("bundles unknown fields into extra_fields and skips Add to Calendar", async () => {
    const client = createMockClient(HAPPY_PATH_HTML);
    const result = await getEvent(client, {
      url: "/about/vision-leadership/events/rockfest-2026",
    });
    expect(result.extra_fields).toEqual({ "Expected Attendance": "200" });
    expect(Object.keys(result.extra_fields)).not.toContain("Add to Calendar");
  });

  it("falls back to #content-core when #parent-fieldname-text is missing and caps body_text length", async () => {
    const longBody = "x".repeat(6000);
    const html = `<html><body>
      <h1 class="documentFirstHeading">Big Event</h1>
      <ul class="details"><li><label>When:</label> someday</li></ul>
      <div id="content-core">${longBody}</div>
    </body></html>`;
    const client = createMockClient(html);
    const result = await getEvent(client, { url: "/foo/events/big" });
    expect(result.body_text).not.toBeNull();
    expect(result.body_text?.length).toBe(5001);
    expect(result.body_text?.endsWith("…")).toBe(true);
    expect(result.body_text?.slice(0, 5000)).toBe("x".repeat(5000));
  });

  it("does not truncate body_text exactly at the 5000-char limit", async () => {
    const exactBody = "y".repeat(5000);
    const html = `<html><body>
      <h1 class="documentFirstHeading">Boundary Event</h1>
      <ul class="details"><li><label>When:</label> someday</li></ul>
      <div id="content-core">${exactBody}</div>
    </body></html>`;
    const client = createMockClient(html);
    const result = await getEvent(client, { url: "/foo/events/boundary" });
    expect(result.body_text).toBe(exactBody);
    expect(result.body_text?.length).toBe(5000);
  });

  it("does not duplicate already-extracted fields when falling back to #content-core", async () => {
    // Realistic Plone structure: #content-core wraps the title, description,
    // ul.details, AND the article body. Without pruning, body_text would
    // include the title text and "When:" label again.
    const html = `<html><body>
      <div id="content-core">
        <h1 class="documentFirstHeading">Glacier Skills Workshop</h1>
        <p class="documentDescription">A hands-on intro.</p>
        <ul class="details">
          <li><label>When:</label> Sat, Jun 6, 2026 from 09:00 AM to 04:00 PM</li>
          <li><label>Committee:</label> Seattle Climbing Committee</li>
          <li><label>Branch:</label> Seattle</li>
        </ul>
        <p>Bring crampons and a sense of adventure.</p>
      </div>
    </body></html>`;
    const client = createMockClient(html);
    const result = await getEvent(client, { url: "/foo/events/glacier" });
    expect(result.body_text).not.toBeNull();
    expect(result.body_text).toContain("Bring crampons and a sense of adventure.");
    expect(result.body_text).not.toContain("Glacier Skills Workshop");
    expect(result.body_text).not.toContain("When:");
  });

  it("returns null fields gracefully when ul.details is absent", async () => {
    const html = `<html><body>
      <h1 class="documentFirstHeading">Bare Event</h1>
    </body></html>`;
    const client = createMockClient(html);
    const result = await getEvent(client, { url: "/foo/events/bare" });
    expect(result.title).toBe("Bare Event");
    expect(result.when).toBeNull();
    expect(result.committee).toBeNull();
    expect(result.branch).toBeNull();
    expect(result.body_text).toBeNull();
    expect(result.extra_fields).toEqual({});
  });
});
