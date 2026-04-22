import { describe, expect, it, vi } from "vitest";
import type { MountaineersClient } from "../../client.js";
import { getMemberHistory } from "../../tools/get-member-history.js";

function createMockClient(historyItems: Record<string, unknown>[] = []): MountaineersClient {
  return {
    fetchFacetedQuery: vi.fn(),
    fetchHtml: vi.fn(),
    fetchJson: vi.fn().mockResolvedValue(historyItems),
    fetchRaw: vi.fn(),
    fetchRosterTab: vi.fn(),
    ensureLoggedIn: vi.fn(),
    baseUrl: "https://www.mountaineers.org",
    isLoggedIn: true,
    hasCredentials: true,
  } as unknown as MountaineersClient;
}

describe("getMemberHistory", () => {
  it("fetches history JSON for the given member slug", async () => {
    const client = createMockClient([]);
    await getMemberHistory(client, { member: "stefanie-schiller" });
    expect(client.fetchJson).toHaveBeenCalledWith(
      "/members/stefanie-schiller/member-activity-history.json",
      { authenticated: true },
    );
  });

  it("normalizes a full URL to a slug", async () => {
    const client = createMockClient([]);
    await getMemberHistory(client, {
      member: "https://www.mountaineers.org/members/stefanie-schiller",
    });
    expect(client.fetchJson).toHaveBeenCalledWith(
      "/members/stefanie-schiller/member-activity-history.json",
      { authenticated: true },
    );
  });

  it("normalizes a /members/{slug} path to a slug", async () => {
    const client = createMockClient([]);
    await getMemberHistory(client, { member: "/members/stefanie-schiller/" });
    expect(client.fetchJson).toHaveBeenCalledWith(
      "/members/stefanie-schiller/member-activity-history.json",
      { authenticated: true },
    );
  });

  it("strips sub-page suffixes from a member URL", async () => {
    const client = createMockClient([]);
    await getMemberHistory(client, {
      member: "https://www.mountaineers.org/members/jane-doe/member-activities",
    });
    expect(client.fetchJson).toHaveBeenCalledWith(
      "/members/jane-doe/member-activity-history.json",
      { authenticated: true },
    );
  });

  it("parses items and applies filters + sort", async () => {
    const items = [
      { uid: "1", href: "/a/1", title: "Old Climb", start: "2024-01-01", category: "trip" },
      { uid: "2", href: "/a/2", title: "New Climb", start: "2025-06-01", category: "trip" },
      { uid: "3", href: "/a/3", title: "Course", start: "2025-03-01", category: "course" },
    ];
    const client = createMockClient(items);

    const result = await getMemberHistory(client, {
      member: "jane-doe",
      category: "trip",
      limit: 0,
    });
    expect(result.items.map((a) => a.title)).toEqual(["New Climb", "Old Climb"]);
    expect(result.total_count).toBe(2);
  });

  it.each([
    ["empty string", ""],
    ["bare /members/", "/members/"],
    ["full URL with no slug", "https://www.mountaineers.org/members/"],
  ])("throws on empty slug input (%s)", async (_label, input) => {
    const client = createMockClient([]);
    await expect(getMemberHistory(client, { member: input })).rejects.toThrow(
      "member slug cannot be empty",
    );
    expect(client.fetchJson).not.toHaveBeenCalled();
  });

  it("respects limit and reports total_count", async () => {
    const items = Array.from({ length: 5 }, (_, i) => ({
      uid: String(i),
      href: `/a/${i}`,
      title: `Activity ${i}`,
      start: `2025-01-${String(i + 1).padStart(2, "0")}`,
    }));
    const client = createMockClient(items);

    const result = await getMemberHistory(client, { member: "jane-doe", limit: 2 });
    expect(result.items).toHaveLength(2);
    expect(result.total_count).toBe(5);
    expect(result.limit).toBe(2);
  });

  it("does NOT call ensureLoggedIn (auth handled by fetchJson)", async () => {
    const client = createMockClient([]);
    await getMemberHistory(client, { member: "jane-doe" });
    expect(client.ensureLoggedIn).not.toHaveBeenCalled();
  });
});
