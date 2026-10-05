import { describe, expect, it } from "vitest";
import { parseMountaineersUrl, resolveMountaineersUrl } from "../url-helpers.js";
import { OFF_SITE_URLS } from "./off-site-urls.js";

describe("parseMountaineersUrl", () => {
  it.each(OFF_SITE_URLS.filter((u) => !u.trim().startsWith("//")))("rejects %s", (url) => {
    expect(() => parseMountaineersUrl(url.trim())).toThrow(/mountaineers\.org/);
  });

  it.each([
    "https://www.mountaineers.org/activities/activities/day-hike-1",
    "https://mountaineers.org/activities/activities/day-hike-1",
    "https://WWW.Mountaineers.ORG/activities/activities/day-hike-1",
    "https://www.mountaineers.org:443/activities/activities/day-hike-1",
  ])("accepts %s", (url) => {
    expect(parseMountaineersUrl(url).pathname).toBe("/activities/activities/day-hike-1");
  });
});

describe("resolveMountaineersUrl", () => {
  it.each(OFF_SITE_URLS)("rejects off-site input %s", (url) => {
    expect(() => resolveMountaineersUrl(url, "/activities/activities")).toThrow(
      /mountaineers\.org/,
    );
  });

  it("keeps a canonical www URL unchanged", () => {
    const url = "https://www.mountaineers.org/activities/activities/day-hike-1";
    expect(resolveMountaineersUrl(url, "/activities/activities")).toBe(url);
  });

  it("canonicalizes the apex host to www and keeps the query", () => {
    expect(
      resolveMountaineersUrl(
        "https://mountaineers.org/activities/trip-reports/tr-1?x=1#frag",
        "/activities/trip-reports",
      ),
    ).toBe("https://www.mountaineers.org/activities/trip-reports/tr-1?x=1");
  });

  it("appends a bare slug to the prefix", () => {
    expect(resolveMountaineersUrl("mount-si-old-trail", "/activities/routes-places")).toBe(
      "https://www.mountaineers.org/activities/routes-places/mount-si-old-trail",
    );
  });

  it("treats a leading-slash input as a site path", () => {
    expect(
      resolveMountaineersUrl("/activities/activities/day-hike-1", "/activities/activities"),
    ).toBe("https://www.mountaineers.org/activities/activities/day-hike-1");
  });

  it("keeps slug-like input containing '@' on mountaineers.org", () => {
    expect(resolveMountaineersUrl("@evil.com", "/activities/activities")).toBe(
      "https://www.mountaineers.org/activities/activities/@evil.com",
    );
  });
});
