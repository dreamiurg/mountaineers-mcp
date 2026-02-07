import * as cheerio from "cheerio";
import { describe, expect, it, vi } from "vitest";
import type { MountaineersClient } from "../../client.js";
import { getCourse } from "../../tools/get-course.js";

function makeCourseHtml(
  opts: {
    title?: string;
    kicker?: string;
    description?: string;
    dates?: string;
    committee?: { name: string; url: string };
    fees?: { member: string; guest: string };
    availability?: { status: string; capacity: string };
    leaders?: { name: string; role: string }[];
    badges?: string[];
  } = {},
): string {
  const committeeLi = opts.committee
    ? `<li><strong>Committee:</strong> <a href="${opts.committee.url}">${opts.committee.name}</a></li>`
    : "";
  const feesLi = opts.fees
    ? `<li class="course-fees"><strong>Members:</strong> <span>${opts.fees.member}</span> <strong>Guests:</strong> <span>${opts.fees.guest}</span></li>`
    : "";
  const availLi = opts.availability
    ? `<li class="course-availability"><strong>Availability:</strong> <span>${opts.availability.status}</span> (<span>${opts.availability.capacity}</span> capacity)</li>`
    : "";
  const leadersHtml = (opts.leaders || [])
    .map(
      (l) =>
        `<div class="roster-contact"><img alt="${l.name}" /><div>${l.name}</div><div class="roster-position">${l.role}</div></div>`,
    )
    .join("");
  const badgesHtml = opts.badges?.length
    ? `<h3>Badges you will earn:</h3><ul>${opts.badges.map((b) => `<li><a href="/badge/${b}">${b}</a></li>`).join("")}</ul>`
    : "";

  return `<html><body>
    <article>
      <header class="program-header">
        ${opts.kicker ? `<h2 class="kicker">${opts.kicker}</h2>` : ""}
        <h1 class="documentFirstHeading">${opts.title ?? "Wilderness Navigation"}</h1>
        <p class="documentDescription">${opts.description ?? "Learn to navigate"}</p>
      </header>
      <div class="program-core">
        <ul class="details">
          <li class="course-dates">${opts.dates ?? "Fri, Feb 6, 2026 - Sun, Feb 15, 2026"}</li>
          ${committeeLi}
          ${feesLi}
          ${availLi}
        </ul>
      </div>
      <div class="leaders">
        <h3>Contacts</h3>
        ${leadersHtml}
      </div>
      ${badgesHtml}
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

describe("getCourse", () => {
  it("parses title, category, and description", async () => {
    const client = createMockClient(
      makeCourseHtml({ title: "Wilderness Navigation", kicker: "Navigation Course" }),
    );
    const result = await getCourse(client, { url: "wilderness-navigation" });
    expect(result.title).toBe("Wilderness Navigation");
    expect(result.category).toBe("Navigation Course");
    expect(result.description).toBe("Learn to navigate");
  });

  it("parses dates", async () => {
    const client = createMockClient(
      makeCourseHtml({ dates: "Fri, Feb 6, 2026 - Sun, Feb 15, 2026" }),
    );
    const result = await getCourse(client, { url: "test" });
    expect(result.dates).toBe("Fri, Feb 6, 2026 - Sun, Feb 15, 2026");
  });

  it("parses committee with link", async () => {
    const client = createMockClient(
      makeCourseHtml({
        committee: { name: "Seattle Navigation", url: "/committees/seattle-nav" },
      }),
    );
    const result = await getCourse(client, { url: "test" });
    expect(result.committee).toBe("Seattle Navigation");
    expect(result.committee_url).toBe("https://www.mountaineers.org/committees/seattle-nav");
  });

  it("parses pricing", async () => {
    const client = createMockClient(
      makeCourseHtml({ fees: { member: "$150.00", guest: "$180.00" } }),
    );
    const result = await getCourse(client, { url: "test" });
    expect(result.member_price).toBe("$150.00");
    expect(result.guest_price).toBe("$180.00");
  });

  it("parses availability and capacity", async () => {
    const client = createMockClient(
      makeCourseHtml({ availability: { status: "FULL", capacity: "25" } }),
    );
    const result = await getCourse(client, { url: "test" });
    expect(result.availability).toBe("FULL");
    expect(result.capacity).toBe("25");
  });

  it("parses leaders", async () => {
    const client = createMockClient(
      makeCourseHtml({
        leaders: [
          { name: "Jenny Weiler", role: "Leader" },
          { name: "Ian Field", role: "Instructor" },
        ],
      }),
    );
    const result = await getCourse(client, { url: "test" });
    expect(result.leaders).toHaveLength(2);
    expect(result.leaders[0]).toEqual({ name: "Jenny Weiler", role: "Leader" });
    expect(result.leaders[1]).toEqual({ name: "Ian Field", role: "Instructor" });
  });

  it("parses badges earned", async () => {
    const client = createMockClient(
      makeCourseHtml({ badges: ["Basic Navigation Course", "Compass Skills"] }),
    );
    const result = await getCourse(client, { url: "test" });
    expect(result.badges_earned).toEqual(["Basic Navigation Course", "Compass Skills"]);
  });

  it("constructs URL from slug", async () => {
    const client = createMockClient(makeCourseHtml({}));
    await getCourse(client, { url: "wilderness-navigation" });
    expect(client.fetchHtml).toHaveBeenCalledWith(
      "https://www.mountaineers.org/courses/courses-clinics-seminars/wilderness-navigation",
    );
  });

  it("uses full URL directly", async () => {
    const fullUrl =
      "https://www.mountaineers.org/courses/courses-clinics-seminars/wilderness-navigation";
    const client = createMockClient(makeCourseHtml({}));
    await getCourse(client, { url: fullUrl });
    expect(client.fetchHtml).toHaveBeenCalledWith(fullUrl);
  });

  it("handles minimal page gracefully", async () => {
    const html = '<html><body><h1 class="documentFirstHeading">Minimal Course</h1></body></html>';
    const client = createMockClient(html);
    const result = await getCourse(client, { url: "minimal" });
    expect(result.title).toBe("Minimal Course");
    expect(result.category).toBeNull();
    expect(result.leaders).toEqual([]);
    expect(result.badges_earned).toEqual([]);
  });
});
