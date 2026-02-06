import * as cheerio from "cheerio";
import { describe, expect, it } from "vitest";
import {
  parseActivityDetail,
  parseActivityResults,
  parseCourseResults,
  parseMemberProfile,
  parseRoster,
  parseTripReportDetail,
  parseTripReportResults,
} from "../parsers.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function load(html: string) {
  return cheerio.load(html);
}

// ---------------------------------------------------------------------------
// parseActivityResults
// ---------------------------------------------------------------------------

describe("parseActivityResults", () => {
  it("parses fully-populated activity results", () => {
    const html = `
      <div id="faceted-result-count">42 results</div>
      <div class="result-item">
        <div class="result-title"><a href="/activities/mt-rainier-climb">Mt Rainier Climb</a></div>
        <div class="result-type">Climbing</div>
        <div class="result-date">Jan 15, 2025</div>
        <div class="result-difficulty">Difficulty: 5.9</div>
        <div class="result-availability"><label>Availability:</label> Open</div>
        <div class="result-branch">Seattle</div>
        <div class="result-leader"><label>Leader:</label> <a href="/members/jane-doe">Jane Doe</a></div>
        <div class="result-summary">A challenging climb up Mt Rainier.</div>
        <div class="result-prereqs">Basic Climbing Course</div>
      </div>
      <div class="result-item">
        <div class="result-title"><a href="/activities/si-hike">Tiger Mountain Hike</a></div>
        <div class="result-type">Hiking</div>
        <div class="result-date">Feb 1, 2025</div>
        <div class="result-difficulty">Difficulty: Easy</div>
        <div class="result-availability"><label>Availability:</label> Waitlist</div>
        <div class="result-branch">Tacoma</div>
        <div class="result-leader"><label>Leader:</label> <a href="/members/john-smith">John Smith</a></div>
        <div class="result-summary">A nice day hike on Tiger Mountain.</div>
        <div class="result-prereqs">None</div>
      </div>
    `;
    const result = parseActivityResults(load(html), 0);

    expect(result.total_count).toBe(42);
    expect(result.page).toBe(0);
    expect(result.has_more).toBe(true); // (0+1)*20=20 < 42
    expect(result.items).toHaveLength(2);

    const first = result.items[0];
    expect(first.title).toBe("Mt Rainier Climb");
    expect(first.url).toBe("https://www.mountaineers.org/activities/mt-rainier-climb");
    expect(first.type).toBe("Climbing");
    expect(first.date).toBe("Jan 15, 2025");
    expect(first.difficulty).toBe("5.9");
    expect(first.availability).toBe("Open");
    expect(first.branch).toBe("Seattle");
    expect(first.leader).toBe("Jane Doe");
    expect(first.leader_url).toBe("https://www.mountaineers.org/members/jane-doe");
    expect(first.description).toBe("A challenging climb up Mt Rainier.");
    expect(first.prerequisites).toBe("Basic Climbing Course");

    const second = result.items[1];
    expect(second.title).toBe("Tiger Mountain Hike");
    expect(second.url).toBe("https://www.mountaineers.org/activities/si-hike");
  });

  it("handles minimal data with missing optional fields", () => {
    const html = `
      <div class="faceted-result-count">1 result</div>
      <div class="result-item">
        <div class="result-title"><a href="/activities/test">Test Activity</a></div>
      </div>
    `;
    const result = parseActivityResults(load(html), 0);

    expect(result.total_count).toBe(1);
    expect(result.items).toHaveLength(1);

    const item = result.items[0];
    expect(item.title).toBe("Test Activity");
    expect(item.url).toBe("https://www.mountaineers.org/activities/test");
    expect(item.type).toBeNull();
    expect(item.date).toBeNull();
    expect(item.difficulty).toBeNull();
    expect(item.availability).toBeNull();
    expect(item.branch).toBeNull();
    expect(item.leader).toBeNull();
    expect(item.leader_url).toBeNull();
    expect(item.description).toBeNull();
    expect(item.prerequisites).toBeNull();
  });

  it("returns empty items when no result-item elements exist", () => {
    const html = `<div id="faceted-result-count">0 results</div>`;
    const result = parseActivityResults(load(html), 0);

    expect(result.total_count).toBe(0);
    expect(result.items).toEqual([]);
    expect(result.has_more).toBe(false);
  });

  it("has_more is false when on last page", () => {
    const html = `
      <div id="faceted-result-count">15 results</div>
      <div class="result-item">
        <div class="result-title"><a href="/a/1">A</a></div>
      </div>
    `;
    const result = parseActivityResults(load(html), 0);
    // (0+1)*20=20 >= 15 → has_more false
    expect(result.has_more).toBe(false);
  });

  it("has_more is true for middle pages", () => {
    const html = `<div id="faceted-result-count">100 results</div>`;
    const result = parseActivityResults(load(html), 2);
    // (2+1)*20=60 < 100 → has_more true
    expect(result.has_more).toBe(true);
  });

  it("has_more is false on the exact boundary", () => {
    const html = `<div id="faceted-result-count">40 results</div>`;
    const result = parseActivityResults(load(html), 1);
    // (1+1)*20=40, 40 < 40 is false
    expect(result.has_more).toBe(false);
  });

  it("strips Difficulty: prefix from difficulty field", () => {
    const html = `
      <div id="faceted-result-count">1 result</div>
      <div class="result-item">
        <div class="result-title"><a href="/a/1">A</a></div>
        <div class="result-difficulty">Difficulty: Moderate</div>
      </div>
    `;
    const result = parseActivityResults(load(html), 0);
    expect(result.items[0].difficulty).toBe("Moderate");
  });

  it("handles absolute URLs in href", () => {
    const html = `
      <div id="faceted-result-count">1 result</div>
      <div class="result-item">
        <div class="result-title"><a href="https://external.com/activity">External</a></div>
        <div class="result-leader"><label>Leader:</label> <a href="https://external.com/member">Leader</a></div>
      </div>
    `;
    const result = parseActivityResults(load(html), 0);
    expect(result.items[0].url).toBe("https://external.com/activity");
    expect(result.items[0].leader_url).toBe("https://external.com/member");
  });

  it("parses result count with comma separators", () => {
    const html = `<div id="faceted-result-count">1,234 results</div>`;
    const result = parseActivityResults(load(html), 0);
    expect(result.total_count).toBe(1234);
  });

  it("textWithoutLabels strips label elements from availability and leader", () => {
    const html = `
      <div id="faceted-result-count">1 result</div>
      <div class="result-item">
        <div class="result-title"><a href="/a/1">A</a></div>
        <div class="result-availability"><label>Spots:</label> 5 of 10</div>
        <div class="result-leader"><label>Led by:</label> Alice</div>
      </div>
    `;
    const result = parseActivityResults(load(html), 0);
    expect(result.items[0].availability).toBe("5 of 10");
    expect(result.items[0].leader).toBe("Alice");
  });
});

// ---------------------------------------------------------------------------
// parseActivityDetail
// ---------------------------------------------------------------------------

describe("parseActivityDetail", () => {
  const URL = "https://www.mountaineers.org/activities/mt-si-hike";

  it("parses a fully-populated activity detail page", () => {
    const html = `
      <html><body>
        <h1 class="documentFirstHeading">Mt Si Day Hike</h1>
        <h2 class="kicker">Day Hiking</h2>
        <div class="program-core">
          <ul class="details">
            <li>Saturday, Jan 15, 2025</li>
            <li><label>Committee:</label> <a href="/committee/hiking">Hiking Committee</a></li>
            <li><label>Activity Type:</label> Hiking</li>
            <li><label>Audience:</label> Adults</li>
            <li><label>Difficulty:</label> Moderate</li>
            <li><label>Mileage:</label> 8 miles</li>
            <li><label>Elevation Gain:</label> 3,150 ft</li>
            <li><label>Availability:</label> 3 of 12 spots</li>
            <li><label>Registration Open:</label> Dec 1, 2024</li>
            <li><label>Registration Close:</label> Jan 10, 2025</li>
            <li><label>Branch:</label> Seattle</li>
            <li><label>Prerequisites:</label> Hiking Basics</li>
          </ul>
        </div>
        <div class="leaders">
          <div class="roster-contact">
            <img src="/members/jane-doe/@@images/portrait" alt="Jane Doe" />
            <div>Jane Doe</div>
            <div class="roster-position">Leader</div>
          </div>
        </div>
        <div class="content-text">
          <div><label>Leader's Notes</label> Bring rain gear and extra water.</div>
          <div><label>Meeting Place</label> Trailhead parking lot at 8am.</div>
        </div>
        <div class="tabs">
          <div class="tab">
            <div class="tab-title">Route / Place</div>
            <div class="tab-content">Mt Si Trail - Old Trail</div>
          </div>
          <div class="tab">
            <div class="tab-title">Required Equipment</div>
            <div class="tab-content">Ten Essentials, hiking boots</div>
          </div>
        </div>
      </body></html>
    `;
    const detail = parseActivityDetail(load(html), URL);

    expect(detail.title).toBe("Mt Si Day Hike");
    expect(detail.url).toBe(URL);
    expect(detail.type).toBe("Day Hiking");
    expect(detail.date).toBe("Saturday, Jan 15, 2025");
    expect(detail.committee).toBe("Hiking Committee");
    expect(detail.activity_type).toBe("Hiking");
    expect(detail.audience).toBe("Adults");
    expect(detail.difficulty).toBe("Moderate");
    expect(detail.mileage).toBe("8 miles");
    expect(detail.elevation_gain).toBe("3,150 ft");
    expect(detail.availability).toBe("3 of 12 spots");
    expect(detail.registration_open).toBe("Dec 1, 2024");
    expect(detail.registration_close).toBe("Jan 10, 2025");
    expect(detail.branch).toBe("Seattle");
    expect(detail.prerequisites).toBe("Hiking Basics");
    expect(detail.leader).toBe("Jane Doe");
    expect(detail.leader_url).toBe("https://www.mountaineers.org/members/jane-doe");
    expect(detail.leader_notes).toBe("Bring rain gear and extra water.");
    expect(detail.meeting_place).toBe("Trailhead parking lot at 8am.");
    expect(detail.route_place).toBe("Mt Si Trail - Old Trail");
    expect(detail.required_equipment).toBe("Ten Essentials, hiking boots");
  });

  it("parses minimal activity detail with only title", () => {
    const html = `<html><body><h1>Simple Activity</h1></body></html>`;
    const detail = parseActivityDetail(load(html), URL);

    expect(detail.title).toBe("Simple Activity");
    expect(detail.url).toBe(URL);
    expect(detail.type).toBeNull();
    expect(detail.date).toBeNull();
    expect(detail.committee).toBeNull();
    expect(detail.activity_type).toBeNull();
    expect(detail.audience).toBeNull();
    expect(detail.difficulty).toBeNull();
    expect(detail.mileage).toBeNull();
    expect(detail.elevation_gain).toBeNull();
    expect(detail.availability).toBeNull();
    expect(detail.registration_open).toBeNull();
    expect(detail.registration_close).toBeNull();
    expect(detail.branch).toBeNull();
    expect(detail.leader).toBeNull();
    expect(detail.leader_url).toBeNull();
    expect(detail.leader_notes).toBeNull();
    expect(detail.meeting_place).toBeNull();
    expect(detail.route_place).toBeNull();
    expect(detail.required_equipment).toBeNull();
    expect(detail.prerequisites).toBeNull();
  });

  it("uses documentFirstHeading for title over plain h1", () => {
    const html = `
      <h1 class="documentFirstHeading">Preferred Title</h1>
      <h1>Fallback Title</h1>
    `;
    const detail = parseActivityDetail(load(html), URL);
    expect(detail.title).toBe("Preferred Title");
  });

  it("falls back to first h1 when documentFirstHeading is missing", () => {
    const html = `<h1>Fallback Title</h1>`;
    const detail = parseActivityDetail(load(html), URL);
    expect(detail.title).toBe("Fallback Title");
  });

  it("handles strong tags as label alternatives", () => {
    const html = `
      <html><body>
        <h1>Test</h1>
        <ul class="details">
          <li><strong>Difficulty:</strong> Hard</li>
          <li><strong>Branch:</strong> Everett</li>
        </ul>
      </body></html>
    `;
    const detail = parseActivityDetail(load(html), URL);
    expect(detail.difficulty).toBe("Hard");
    expect(detail.branch).toBe("Everett");
  });

  it("first li without label is treated as date", () => {
    const html = `
      <html><body>
        <h1>Test</h1>
        <ul class="details">
          <li>Sunday, March 2, 2025</li>
          <li><label>Branch:</label> Olympia</li>
        </ul>
      </body></html>
    `;
    const detail = parseActivityDetail(load(html), URL);
    expect(detail.date).toBe("Sunday, March 2, 2025");
    expect(detail.branch).toBe("Olympia");
  });

  it("only assigns first unlabeled li as date", () => {
    const html = `
      <html><body>
        <h1>Test</h1>
        <ul class="details">
          <li>First Date</li>
          <li>Should Be Ignored</li>
        </ul>
      </body></html>
    `;
    const detail = parseActivityDetail(load(html), URL);
    expect(detail.date).toBe("First Date");
  });

  it("skips leader rating label", () => {
    const html = `
      <html><body>
        <h1>Test</h1>
        <ul class="details">
          <li><label>Leader Rating:</label> A</li>
          <li><label>Difficulty:</label> Hard</li>
        </ul>
      </body></html>
    `;
    const detail = parseActivityDetail(load(html), URL);
    expect(detail.difficulty).toBe("Hard");
    // leader_rating is not in the model, ensure it doesn't accidentally land somewhere
  });

  it("parses distance as mileage", () => {
    const html = `
      <html><body>
        <h1>Test</h1>
        <ul class="details">
          <li><label>Distance:</label> 12 miles</li>
        </ul>
      </body></html>
    `;
    const detail = parseActivityDetail(load(html), URL);
    expect(detail.mileage).toBe("12 miles");
  });

  it("skips assistant availability label", () => {
    const html = `
      <html><body>
        <h1>Test</h1>
        <ul class="details">
          <li><label>Assistant Availability:</label> 2 spots</li>
          <li><label>Availability:</label> 5 spots</li>
        </ul>
      </body></html>
    `;
    const detail = parseActivityDetail(load(html), URL);
    expect(detail.availability).toBe("5 spots");
  });

  it("parses leader from img alt attribute", () => {
    const html = `
      <html><body>
        <h1>Test</h1>
        <div class="leaders">
          <div class="roster-contact">
            <img src="/members/bob-jones/@@images/portrait" alt="Bob Jones" />
            <div class="roster-position">Trip Leader</div>
          </div>
        </div>
      </body></html>
    `;
    const detail = parseActivityDetail(load(html), URL);
    expect(detail.leader).toBe("Bob Jones");
    expect(detail.leader_url).toBe("https://www.mountaineers.org/members/bob-jones");
  });

  it("falls back to div text for leader name when img has no alt", () => {
    const html = `
      <html><body>
        <h1>Test</h1>
        <div class="leaders">
          <div class="roster-contact">
            <img src="/images/default-avatar.jpg" />
            <div>Alice Wonderland</div>
            <div class="roster-position">Leader</div>
          </div>
        </div>
      </body></html>
    `;
    const detail = parseActivityDetail(load(html), URL);
    expect(detail.leader).toBe("Alice Wonderland");
  });

  it("parses leader_url from explicit member link", () => {
    const html = `
      <html><body>
        <h1>Test</h1>
        <div class="leaders">
          <div class="roster-contact">
            <img src="/images/default.jpg" alt="Charlie" />
            <a href="/members/charlie-brown">Profile</a>
          </div>
        </div>
      </body></html>
    `;
    const detail = parseActivityDetail(load(html), URL);
    expect(detail.leader).toBe("Charlie");
    expect(detail.leader_url).toBe("https://www.mountaineers.org/members/charlie-brown");
  });

  it("parses leader_url from absolute href link", () => {
    const html = `
      <html><body>
        <h1>Test</h1>
        <div class="leaders">
          <div class="roster-contact">
            <img src="/images/default.jpg" alt="Charlie" />
            <a href="https://www.mountaineers.org/members/charlie-abs">Profile</a>
          </div>
        </div>
      </body></html>
    `;
    const detail = parseActivityDetail(load(html), URL);
    expect(detail.leader_url).toBe("https://www.mountaineers.org/members/charlie-abs");
  });

  it("parses tab content with Place in title", () => {
    const html = `
      <html><body>
        <h1>Test</h1>
        <div class="tabs">
          <div class="tab">
            <div class="tab-title">Place</div>
            <div class="tab-content">Some trailhead location</div>
          </div>
        </div>
      </body></html>
    `;
    const detail = parseActivityDetail(load(html), URL);
    expect(detail.route_place).toBe("Some trailhead location");
  });

  it("collapses excessive whitespace in tab content", () => {
    const html = `
      <html><body>
        <h1>Test</h1>
        <div class="tabs">
          <div class="tab">
            <div class="tab-title">Required Equipment</div>
            <div class="tab-content">
              Item One
              Item Two


              Item Three
            </div>
          </div>
        </div>
      </body></html>
    `;
    const detail = parseActivityDetail(load(html), URL);
    // Whitespace should be collapsed: spaces→single space, multiple newlines→double
    expect(detail.required_equipment).not.toContain("   ");
    expect(detail.required_equipment).toBeTruthy();
  });

  it("committee prefers link text over plain text value", () => {
    const html = `
      <html><body>
        <h1>Test</h1>
        <ul class="details">
          <li><label>Committee:</label> <a href="/c/climbing">Climbing Committee</a></li>
        </ul>
      </body></html>
    `;
    const detail = parseActivityDetail(load(html), URL);
    expect(detail.committee).toBe("Climbing Committee");
  });

  it("committee falls back to value text when no link", () => {
    const html = `
      <html><body>
        <h1>Test</h1>
        <ul class="details">
          <li><label>Committee:</label> The Backcountry Committee</li>
        </ul>
      </body></html>
    `;
    const detail = parseActivityDetail(load(html), URL);
    expect(detail.committee).toBe("The Backcountry Committee");
  });
});

// ---------------------------------------------------------------------------
// parseCourseResults
// ---------------------------------------------------------------------------

describe("parseCourseResults", () => {
  it("parses fully-populated course results", () => {
    const html = `
      <div id="faceted-result-count">5 results</div>
      <div class="result-item">
        <div class="result-title"><a href="/courses/basic-climbing">Basic Alpine Climbing Course</a></div>
        <div class="result-date">Mar 1 - Jun 30, 2025</div>
        <div class="result-prereqs">Wilderness Navigation</div>
        <div class="result-availability"><label>Availability:</label> 8 of 24</div>
        <div class="result-branch">Seattle</div>
        <div class="result-leader"><label>Leader:</label> <a href="/members/mike-leader">Mike Leader</a></div>
        <div class="result-summary">Learn the basics of alpine climbing.</div>
      </div>
    `;
    const result = parseCourseResults(load(html), 0);

    expect(result.total_count).toBe(5);
    expect(result.page).toBe(0);
    expect(result.has_more).toBe(false); // 20 >= 5
    expect(result.items).toHaveLength(1);

    const item = result.items[0];
    expect(item.title).toBe("Basic Alpine Climbing Course");
    expect(item.url).toBe("https://www.mountaineers.org/courses/basic-climbing");
    expect(item.date).toBe("Mar 1 - Jun 30, 2025");
    expect(item.prerequisites).toBe("Wilderness Navigation");
    expect(item.availability).toBe("8 of 24");
    expect(item.branch).toBe("Seattle");
    expect(item.leader).toBe("Mike Leader");
    expect(item.leader_url).toBe("https://www.mountaineers.org/members/mike-leader");
    expect(item.description).toBe("Learn the basics of alpine climbing.");
  });

  it("handles minimal course results", () => {
    const html = `
      <div class="faceted-result-count">1 result</div>
      <div class="result-item">
        <div class="result-title"><a href="/courses/test">Test Course</a></div>
      </div>
    `;
    const result = parseCourseResults(load(html), 0);

    expect(result.items).toHaveLength(1);
    const item = result.items[0];
    expect(item.title).toBe("Test Course");
    expect(item.date).toBeNull();
    expect(item.prerequisites).toBeNull();
    expect(item.availability).toBeNull();
    expect(item.branch).toBeNull();
    expect(item.leader).toBeNull();
    expect(item.leader_url).toBeNull();
    expect(item.description).toBeNull();
  });

  it("returns empty results for no courses", () => {
    const html = `<div id="faceted-result-count">0 results</div>`;
    const result = parseCourseResults(load(html), 0);

    expect(result.total_count).toBe(0);
    expect(result.items).toEqual([]);
    expect(result.has_more).toBe(false);
  });

  it("pagination: has_more on page 1 with 50 results", () => {
    const html = `<div id="faceted-result-count">50 results</div>`;
    const result = parseCourseResults(load(html), 1);
    // (1+1)*20=40 < 50
    expect(result.has_more).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// parseTripReportResults
// ---------------------------------------------------------------------------

describe("parseTripReportResults", () => {
  it("parses fully-populated trip report results", () => {
    const html = `
      <div id="faceted-result-count">12 results</div>
      <div class="result-item">
        <div class="result-title"><a href="/trip-reports/mt-baker-trip">Mt Baker Trip Report</a></div>
        <div class="result-date">Dec 20, 2024</div>
        <div class="result-sidebar">
          <div><label>By:</label> Sarah Connor</div>
          <div><label>Activity Type:</label> Climbing</div>
          <div><label>Trip Result:</label> Summit</div>
        </div>
        <div class="result-summary">We summited Mt Baker via the Easton Glacier.</div>
      </div>
    `;
    const result = parseTripReportResults(load(html), 0);

    expect(result.total_count).toBe(12);
    expect(result.page).toBe(0);
    expect(result.has_more).toBe(false); // 20 >= 12
    expect(result.items).toHaveLength(1);

    const item = result.items[0];
    expect(item.title).toBe("Mt Baker Trip Report");
    expect(item.url).toBe("https://www.mountaineers.org/trip-reports/mt-baker-trip");
    expect(item.date).toBe("Dec 20, 2024");
    expect(item.author).toBe("Sarah Connor");
    expect(item.activity_type).toBe("Climbing");
    expect(item.trip_result).toBe("Summit");
    expect(item.description).toBe("We summited Mt Baker via the Easton Glacier.");
  });

  it("handles minimal trip report results", () => {
    const html = `
      <div id="faceted-result-count">1 result</div>
      <div class="result-item">
        <div class="result-title"><a href="/trip-reports/test">Test Report</a></div>
      </div>
    `;
    const result = parseTripReportResults(load(html), 0);

    expect(result.items).toHaveLength(1);
    const item = result.items[0];
    expect(item.title).toBe("Test Report");
    expect(item.date).toBeNull();
    expect(item.author).toBeNull();
    expect(item.activity_type).toBeNull();
    expect(item.trip_result).toBeNull();
    expect(item.description).toBeNull();
  });

  it("returns empty results", () => {
    const html = `<div id="faceted-result-count">0 results</div>`;
    const result = parseTripReportResults(load(html), 0);
    expect(result.total_count).toBe(0);
    expect(result.items).toEqual([]);
  });

  it("handles sidebar with partial fields", () => {
    const html = `
      <div id="faceted-result-count">1 result</div>
      <div class="result-item">
        <div class="result-title"><a href="/trip-reports/partial">Partial</a></div>
        <div class="result-sidebar">
          <div><label>By:</label> Only Author</div>
        </div>
      </div>
    `;
    const result = parseTripReportResults(load(html), 0);
    const item = result.items[0];
    expect(item.author).toBe("Only Author");
    expect(item.activity_type).toBeNull();
    expect(item.trip_result).toBeNull();
  });

  it("handles multiple result items", () => {
    const html = `
      <div id="faceted-result-count">2 results</div>
      <div class="result-item">
        <div class="result-title"><a href="/trip-reports/one">Report One</a></div>
      </div>
      <div class="result-item">
        <div class="result-title"><a href="/trip-reports/two">Report Two</a></div>
      </div>
    `;
    const result = parseTripReportResults(load(html), 0);
    expect(result.items).toHaveLength(2);
    expect(result.items[0].title).toBe("Report One");
    expect(result.items[1].title).toBe("Report Two");
  });
});

// ---------------------------------------------------------------------------
// parseTripReportDetail
// ---------------------------------------------------------------------------

describe("parseTripReportDetail", () => {
  const URL = "https://www.mountaineers.org/trip-reports/mt-baker";

  it("parses a fully-populated trip report detail", () => {
    const html = `
      <html><body>
        <h1 class="documentFirstHeading">Mt Baker Summit Trip Report</h1>
        <p class="documentDescription">An epic day on the Easton Glacier route.</p>
        <div class="tripreport-metadata">
          <span class="author"><a class="name"><img alt="avatar"/>Sarah Connor</a></span>
          <span class="pubdate">December 20, 2024</span>
        </div>
        <div class="program-core">
          <ul class="details">
            <li><label>Date:</label> Dec 18, 2024</li>
            <li><label>Route / Place:</label> <a href="/activities/mt-baker-climb">Easton Glacier</a></li>
            <li><label>Activity Type:</label> Climbing</li>
            <li><label>Trip Result:</label> Summit</li>
          </ul>
        </div>
      </body></html>
    `;
    const detail = parseTripReportDetail(load(html), URL);

    expect(detail.title).toBe("Mt Baker Summit Trip Report");
    expect(detail.url).toBe(URL);
    expect(detail.body).toBe("An epic day on the Easton Glacier route.");
    expect(detail.author).toBe("Sarah Connor");
    expect(detail.date).toBe("December 20, 2024");
    expect(detail.route).toBe("Easton Glacier");
    expect(detail.related_activity_url).toBe(
      "https://www.mountaineers.org/activities/mt-baker-climb",
    );
    expect(detail.activity_type).toBe("Climbing");
    expect(detail.trip_result).toBe("Summit");
  });

  it("parses minimal trip report detail", () => {
    const html = `<html><body><h1>Minimal Report</h1></body></html>`;
    const detail = parseTripReportDetail(load(html), URL);

    expect(detail.title).toBe("Minimal Report");
    expect(detail.url).toBe(URL);
    expect(detail.date).toBeNull();
    expect(detail.author).toBeNull();
    expect(detail.activity_type).toBeNull();
    expect(detail.trip_result).toBeNull();
    expect(detail.route).toBeNull();
    expect(detail.body).toBeNull();
    expect(detail.related_activity_url).toBeNull();
  });

  it("uses pubdate from metadata for date", () => {
    const html = `
      <html><body>
        <h1>Test</h1>
        <div class="tripreport-metadata">
          <span class="pubdate">January 5, 2025</span>
        </div>
      </body></html>
    `;
    const detail = parseTripReportDetail(load(html), URL);
    expect(detail.date).toBe("January 5, 2025");
  });

  it("date from metadata takes precedence; details date skipped if already set", () => {
    const html = `
      <html><body>
        <h1>Test</h1>
        <div class="tripreport-metadata">
          <span class="pubdate">Metadata Date</span>
        </div>
        <div class="program-core">
          <ul class="details">
            <li><label>Date:</label> Details Date</li>
          </ul>
        </div>
      </body></html>
    `;
    const detail = parseTripReportDetail(load(html), URL);
    expect(detail.date).toBe("Metadata Date");
  });

  it("falls back to details date when pubdate is empty", () => {
    const html = `
      <html><body>
        <h1>Test</h1>
        <div class="program-core">
          <ul class="details">
            <li><label>Date:</label> Fallback Date</li>
          </ul>
        </div>
      </body></html>
    `;
    const detail = parseTripReportDetail(load(html), URL);
    expect(detail.date).toBe("Fallback Date");
  });

  it("extracts author text, filtering out img alt text", () => {
    const html = `
      <html><body>
        <h1>Test</h1>
        <div class="tripreport-metadata">
          <span class="author"><a class="name"><img alt="avatar pic"/>John Muir</a></span>
        </div>
      </body></html>
    `;
    const detail = parseTripReportDetail(load(html), URL);
    expect(detail.author).toBe("John Muir");
  });

  it("falls back to full authorEl text when no direct text nodes", () => {
    const html = `
      <html><body>
        <h1>Test</h1>
        <div class="tripreport-metadata">
          <span class="author"><a class="name">Just Text Author</a></span>
        </div>
      </body></html>
    `;
    const detail = parseTripReportDetail(load(html), URL);
    expect(detail.author).toBe("Just Text Author");
  });

  it("handles route with absolute URL", () => {
    const html = `
      <html><body>
        <h1>Test</h1>
        <div class="program-core">
          <ul class="details">
            <li><label>Route:</label> <a href="https://external.com/route">External Route</a></li>
          </ul>
        </div>
      </body></html>
    `;
    const detail = parseTripReportDetail(load(html), URL);
    expect(detail.route).toBe("External Route");
    expect(detail.related_activity_url).toBe("https://external.com/route");
  });

  it("handles Place label for route", () => {
    const html = `
      <html><body>
        <h1>Test</h1>
        <div class="program-core">
          <ul class="details">
            <li><label>Place:</label> Enchantments</li>
          </ul>
        </div>
      </body></html>
    `;
    const detail = parseTripReportDetail(load(html), URL);
    expect(detail.route).toBe("Enchantments");
  });

  it("uses first h1 as fallback title", () => {
    const html = `<html><body><h1>First H1 Title</h1></body></html>`;
    const detail = parseTripReportDetail(load(html), URL);
    expect(detail.title).toBe("First H1 Title");
  });
});

// ---------------------------------------------------------------------------
// parseRoster
// ---------------------------------------------------------------------------

describe("parseRoster", () => {
  it("parses a fully-populated roster", () => {
    // The parser's nameEl selector is `.roster-name, .contact-name, a` — it picks
    // whichever matches first in DOM order. When a link wraps the img, the `a`
    // matches before `.roster-name`. To test name extraction we place roster-name
    // before the link, or use .contact-name which also matches first.
    const html = `
      <div class="roster-contact">
        <div class="roster-name">Jane Doe</div>
        <a class="contact-modal" href="/members/jane-doe">
          <img src="/members/jane-doe/@@images/portrait" />
        </a>
        <div class="roster-position">Trip Leader</div>
      </div>
      <div class="roster-contact">
        <div class="contact-name">John Smith</div>
        <a href="/members/john-smith">
          <img src="/members/john-smith/@@images/portrait" />
        </a>
        <div class="roster-position">Participant</div>
      </div>
    `;
    const entries = parseRoster(load(html));

    expect(entries).toHaveLength(2);

    expect(entries[0].name).toBe("Jane Doe");
    expect(entries[0].profile_url).toBe("https://www.mountaineers.org/members/jane-doe");
    expect(entries[0].role).toBe("Trip Leader");
    expect(entries[0].avatar).toBe("/members/jane-doe/@@images/portrait");

    expect(entries[1].name).toBe("John Smith");
    expect(entries[1].profile_url).toBe("https://www.mountaineers.org/members/john-smith");
    expect(entries[1].role).toBe("Participant");
  });

  it("handles roster with no entries", () => {
    const html = `<div class="empty-roster"></div>`;
    const entries = parseRoster(load(html));
    expect(entries).toEqual([]);
  });

  it("handles entry with minimal data", () => {
    const html = `
      <div class="roster-contact">
        <a>Unknown Person</a>
      </div>
    `;
    const entries = parseRoster(load(html));

    expect(entries).toHaveLength(1);
    expect(entries[0].name).toBe("Unknown Person");
    expect(entries[0].profile_url).toBeNull();
    expect(entries[0].role).toBeNull();
    expect(entries[0].avatar).toBeNull();
  });

  it("defaults name to Unknown when no name element found", () => {
    const html = `<div class="roster-contact"></div>`;
    const entries = parseRoster(load(html));

    expect(entries).toHaveLength(1);
    expect(entries[0].name).toBe("Unknown");
  });

  it("handles absolute profile URLs", () => {
    const html = `
      <div class="roster-contact">
        <a class="contact-modal" href="https://www.mountaineers.org/members/abs-member">
          <div class="roster-name">Abs Member</div>
        </a>
      </div>
    `;
    const entries = parseRoster(load(html));
    expect(entries[0].profile_url).toBe("https://www.mountaineers.org/members/abs-member");
  });

  it("finds link via href containing /members/", () => {
    const html = `
      <div class="roster-contact">
        <a href="/members/via-selector">Link</a>
        <div class="roster-name">Via Selector</div>
      </div>
    `;
    const entries = parseRoster(load(html));
    expect(entries[0].profile_url).toBe("https://www.mountaineers.org/members/via-selector");
  });

  it("parses multiple roster entries", () => {
    const html = `
      <div class="roster-contact"><div class="roster-name">Alice</div></div>
      <div class="roster-contact"><div class="roster-name">Bob</div></div>
      <div class="roster-contact"><div class="roster-name">Charlie</div></div>
    `;
    const entries = parseRoster(load(html));
    expect(entries).toHaveLength(3);
    expect(entries.map((e) => e.name)).toEqual(["Alice", "Bob", "Charlie"]);
  });
});

// ---------------------------------------------------------------------------
// parseMemberProfile
// ---------------------------------------------------------------------------

describe("parseMemberProfile", () => {
  const URL = "https://www.mountaineers.org/members/jane-doe";

  it("parses a fully-populated member profile", () => {
    const html = `
      <html>
        <head><title>Jane Doe — The Mountaineers</title></head>
        <body>
          <h1 class="documentFirstHeading">Jane Doe</h1>
          <ul class="details">
            <li>Member Since: January 2015</li>
            <li>Branch: <a href="/branches/seattle">Seattle</a></li>
          </ul>
          <div class="email"><a href="mailto:jane@example.com">jane@example.com</a></div>
          <div class="profile-committees">
            <ul>
              <li><a href="/c/climbing">Climbing Committee</a></li>
              <li><a href="/c/hiking">Hiking Committee</a></li>
            </ul>
          </div>
          <div class="profile-badges">
            <div class="badge"><a href="/badge/1" title="Earned: 2020-01-15; Expires: 2025-01-15">First Aid</a></div>
            <div class="badge"><a href="/badge/2" title="Earned: 2019-06-01">Navigation</a></div>
          </div>
        </body>
      </html>
    `;
    const profile = parseMemberProfile(load(html), URL);

    expect(profile.name).toBe("Jane Doe");
    expect(profile.url).toBe(URL);
    expect(profile.member_since).toBe("January 2015");
    expect(profile.branch).toBe("Seattle");
    expect(profile.email).toBe("jane@example.com");
    expect(profile.committees).toEqual(["Climbing Committee", "Hiking Committee"]);
    expect(profile.badges).toHaveLength(2);
    expect(profile.badges[0]).toEqual({
      name: "First Aid",
      earned: "2020-01-15",
      expires: "2025-01-15",
    });
    expect(profile.badges[1]).toEqual({
      name: "Navigation",
      earned: "2019-06-01",
      expires: null,
    });
  });

  it("handles minimal profile with only title fallback", () => {
    const html = `
      <html>
        <head><title>Bob Smith — The Mountaineers</title></head>
        <body>
          <h1>Profile</h1>
        </body>
      </html>
    `;
    const profile = parseMemberProfile(load(html), URL);

    expect(profile.name).toBe("Bob Smith");
    expect(profile.url).toBe(URL);
    expect(profile.member_since).toBeNull();
    expect(profile.branch).toBeNull();
    expect(profile.email).toBeNull();
    expect(profile.committees).toEqual([]);
    expect(profile.badges).toEqual([]);
  });

  it("uses documentFirstHeading for name", () => {
    const html = `
      <html><body>
        <h1 class="documentFirstHeading">Primary Name</h1>
        <h1>Secondary Name</h1>
      </body></html>
    `;
    const profile = parseMemberProfile(load(html), URL);
    expect(profile.name).toBe("Primary Name");
  });

  it("falls back to second h1 when first is 'Profile'", () => {
    const html = `
      <html><body>
        <h1 class="documentFirstHeading">Profile</h1>
        <h1>Real Name Here</h1>
      </body></html>
    `;
    const profile = parseMemberProfile(load(html), URL);
    expect(profile.name).toBe("Real Name Here");
  });

  it("skips 'Profile' h1s and uses title tag as last resort", () => {
    const html = `
      <html>
        <head><title>Fallback Name — The Mountaineers</title></head>
        <body>
          <h1>Profile</h1>
        </body>
      </html>
    `;
    const profile = parseMemberProfile(load(html), URL);
    expect(profile.name).toBe("Fallback Name");
  });

  it("handles title tag with en-dash separator", () => {
    const html = `
      <html>
        <head><title>Dash Name – The Mountaineers</title></head>
        <body><h1>Profile</h1></body>
      </html>
    `;
    const profile = parseMemberProfile(load(html), URL);
    expect(profile.name).toBe("Dash Name");
  });

  it("handles title tag with hyphen separator", () => {
    const html = `
      <html>
        <head><title>Hyphen Name - The Mountaineers</title></head>
        <body><h1>Profile</h1></body>
      </html>
    `;
    const profile = parseMemberProfile(load(html), URL);
    expect(profile.name).toBe("Hyphen Name");
  });

  it("branch falls back to text match when no link", () => {
    const html = `
      <html><body>
        <h1>Test User</h1>
        <ul class="details">
          <li>Branch: Tacoma</li>
        </ul>
      </body></html>
    `;
    const profile = parseMemberProfile(load(html), URL);
    expect(profile.branch).toBe("Tacoma");
  });

  it("parses committees from .committees selector", () => {
    const html = `
      <html><body>
        <h1>Test User</h1>
        <div class="committees">
          <ul>
            <li><a href="/c/1">Committee A</a></li>
            <li><a href="/c/2">Committee B</a></li>
          </ul>
        </div>
      </body></html>
    `;
    const profile = parseMemberProfile(load(html), URL);
    expect(profile.committees).toEqual(["Committee A", "Committee B"]);
  });

  it("parses badges from .badges selector", () => {
    const html = `
      <html><body>
        <h1>Test User</h1>
        <div class="badges">
          <div class="badge"><a href="/b/1" title="Earned: 2023-05-01">Alpine Badge</a></div>
        </div>
      </body></html>
    `;
    const profile = parseMemberProfile(load(html), URL);
    expect(profile.badges).toHaveLength(1);
    expect(profile.badges[0].name).toBe("Alpine Badge");
    expect(profile.badges[0].earned).toBe("2023-05-01");
    expect(profile.badges[0].expires).toBeNull();
  });

  it("parses badges from .badge-list selector", () => {
    const html = `
      <html><body>
        <h1>Test User</h1>
        <div class="badge-list">
          <div class="badge"><a href="/b/1" title="Earned: 2022-01-01; Expires: 2024-01-01">Cert</a></div>
        </div>
      </body></html>
    `;
    const profile = parseMemberProfile(load(html), URL);
    expect(profile.badges).toHaveLength(1);
    expect(profile.badges[0]).toEqual({
      name: "Cert",
      earned: "2022-01-01",
      expires: "2024-01-01",
    });
  });

  it("badge with no title attribute has null earned and expires", () => {
    const html = `
      <html><body>
        <h1>Test User</h1>
        <div class="profile-badges">
          <div class="badge"><a href="/b/1">No Title Badge</a></div>
        </div>
      </body></html>
    `;
    const profile = parseMemberProfile(load(html), URL);
    expect(profile.badges).toHaveLength(1);
    expect(profile.badges[0]).toEqual({
      name: "No Title Badge",
      earned: null,
      expires: null,
    });
  });

  it("skips empty badge names", () => {
    const html = `
      <html><body>
        <h1>Test User</h1>
        <div class="profile-badges">
          <div class="badge"><a href="/b/1"></a></div>
          <div class="badge"><a href="/b/2">Real Badge</a></div>
        </div>
      </body></html>
    `;
    const profile = parseMemberProfile(load(html), URL);
    // The empty-name badge is skipped due to `if (bname)` check
    expect(profile.badges).toHaveLength(1);
    expect(profile.badges[0].name).toBe("Real Badge");
  });

  it("handles empty profile gracefully", () => {
    const html = `<html><body></body></html>`;
    const profile = parseMemberProfile(load(html), URL);

    expect(profile.name).toBe("");
    expect(profile.url).toBe(URL);
    expect(profile.member_since).toBeNull();
    expect(profile.branch).toBeNull();
    expect(profile.email).toBeNull();
    expect(profile.committees).toEqual([]);
    expect(profile.badges).toEqual([]);
  });

  it("does not pick up sharing mailto links outside .email", () => {
    const html = `
      <html><body>
        <h1>Test User</h1>
        <a href="mailto:share@social.com">Share via Email</a>
        <div class="email"><a href="mailto:real@example.com">real@example.com</a></div>
      </body></html>
    `;
    const profile = parseMemberProfile(load(html), URL);
    expect(profile.email).toBe("real@example.com");
  });
});

// ---------------------------------------------------------------------------
// parseResultCount edge cases (tested via public parsers)
// ---------------------------------------------------------------------------

describe("parseResultCount (via public parsers)", () => {
  it("returns 0 when no count element exists", () => {
    const html = `<div>No count here</div>`;
    const result = parseActivityResults(load(html), 0);
    expect(result.total_count).toBe(0);
  });

  it("handles .faceted-result-count class selector", () => {
    const html = `<div class="faceted-result-count">25 results</div>`;
    const result = parseActivityResults(load(html), 0);
    expect(result.total_count).toBe(25);
  });

  it("handles #faceted-result-count id selector", () => {
    const html = `<div id="faceted-result-count">30 results</div>`;
    const result = parseActivityResults(load(html), 0);
    expect(result.total_count).toBe(30);
  });

  it("handles count text with no digits", () => {
    const html = `<div id="faceted-result-count">no results found</div>`;
    const result = parseActivityResults(load(html), 0);
    expect(result.total_count).toBe(0);
  });

  it("handles large numbers with commas", () => {
    const html = `<div id="faceted-result-count">10,500 results</div>`;
    const result = parseCourseResults(load(html), 0);
    expect(result.total_count).toBe(10500);
  });
});

// ---------------------------------------------------------------------------
// text() and href() helper edge cases (tested via public parsers)
// ---------------------------------------------------------------------------

describe("text/href helpers (via public parsers)", () => {
  it("collapses whitespace in text fields", () => {
    const html = `
      <div id="faceted-result-count">1 result</div>
      <div class="result-item">
        <div class="result-title"><a href="/a/1">  Lots   of    spaces  </a></div>
        <div class="result-type">  Spaced   Type  </div>
      </div>
    `;
    const result = parseActivityResults(load(html), 0);
    expect(result.items[0].title).toBe("Lots of spaces");
    expect(result.items[0].type).toBe("Spaced Type");
  });

  it("returns null for empty text after trimming", () => {
    const html = `
      <div id="faceted-result-count">1 result</div>
      <div class="result-item">
        <div class="result-title"><a href="/a/1">Title</a></div>
        <div class="result-summary">   </div>
      </div>
    `;
    const result = parseActivityResults(load(html), 0);
    expect(result.items[0].description).toBeNull();
  });

  it("returns empty string for title when link has no text", () => {
    const html = `
      <div id="faceted-result-count">1 result</div>
      <div class="result-item">
        <div class="result-title"><a href="/a/1"></a></div>
      </div>
    `;
    const result = parseActivityResults(load(html), 0);
    // text() returns null, but ?? "" gives empty string
    expect(result.items[0].title).toBe("");
  });
});
