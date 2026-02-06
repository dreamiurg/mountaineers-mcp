import * as cheerio from "cheerio";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MountaineersClient } from "../../client.js";
import { whoami } from "../../tools/whoami.js";

function createMockClient(): MountaineersClient {
  return {
    fetchFacetedQuery: vi.fn(),
    fetchHtml: vi.fn(),
    fetchJson: vi.fn(),
    fetchRaw: vi.fn(),
    fetchRosterTab: vi.fn(),
    ensureLoggedIn: vi.fn(),
    baseUrl: "https://www.mountaineers.org",
    isLoggedIn: true,
    hasCredentials: true,
  } as unknown as MountaineersClient;
}

describe("whoami", () => {
  let client: MountaineersClient;

  beforeEach(() => {
    client = createMockClient();
  });

  it("returns name, slug, and profile_url for a logged-in user", async () => {
    const homepage = cheerio.load(
      `<html><body><a href="/members/john-smith">My Profile</a></body></html>`,
    );
    const profilePage = cheerio.load(
      `<html><body><h1>Profile</h1><h1>John Smith</h1></body></html>`,
    );
    (client.fetchHtml as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(homepage)
      .mockResolvedValueOnce(profilePage);

    const result = await whoami(client);
    expect(result).toEqual({
      name: "John Smith",
      slug: "john-smith",
      profile_url: "https://www.mountaineers.org/members/john-smith",
    });
  });

  it("calls ensureLoggedIn before fetching", async () => {
    const homepage = cheerio.load(
      `<html><body><a href="/members/test-user">My Profile</a></body></html>`,
    );
    const profilePage = cheerio.load(
      `<html><body><h1>Profile</h1><h1>Test User</h1></body></html>`,
    );
    (client.fetchHtml as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(homepage)
      .mockResolvedValueOnce(profilePage);

    await whoami(client);
    expect(client.ensureLoggedIn).toHaveBeenCalled();
  });

  it("fetches homepage with authenticated=true", async () => {
    const homepage = cheerio.load(
      `<html><body><a href="/members/test-user">My Profile</a></body></html>`,
    );
    const profilePage = cheerio.load(
      `<html><body><h1>Profile</h1><h1>Test User</h1></body></html>`,
    );
    (client.fetchHtml as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(homepage)
      .mockResolvedValueOnce(profilePage);

    await whoami(client);
    expect(client.fetchHtml).toHaveBeenCalledWith("/", { authenticated: true });
  });

  it("fetches profile page with the extracted slug", async () => {
    const homepage = cheerio.load(
      `<html><body><a href="/members/alice-wonder">My Profile</a></body></html>`,
    );
    const profilePage = cheerio.load(
      `<html><body><h1>Profile</h1><h1>Alice Wonder</h1></body></html>`,
    );
    (client.fetchHtml as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(homepage)
      .mockResolvedValueOnce(profilePage);

    await whoami(client);
    expect(client.fetchHtml).toHaveBeenCalledWith("/members/alice-wonder", { authenticated: true });
  });

  it("handles absolute profile URL", async () => {
    const homepage = cheerio.load(
      `<html><body><a href="https://www.mountaineers.org/members/abs-user">My Profile</a></body></html>`,
    );
    const profilePage = cheerio.load(`<html><body><h1>Profile</h1><h1>Abs User</h1></body></html>`);
    (client.fetchHtml as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(homepage)
      .mockResolvedValueOnce(profilePage);

    const result = await whoami(client);
    expect(result.slug).toBe("abs-user");
    expect(result.profile_url).toBe("https://www.mountaineers.org/members/abs-user");
  });

  it("falls back to title tag when no non-Profile h1 exists", async () => {
    const homepage = cheerio.load(
      `<html><body><a href="/members/fallback-user">My Profile</a></body></html>`,
    );
    const profilePage = cheerio.load(
      `<html><head><title>Fallback User — The Mountaineers</title></head><body><h1>Profile</h1></body></html>`,
    );
    (client.fetchHtml as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(homepage)
      .mockResolvedValueOnce(profilePage);

    const result = await whoami(client);
    expect(result.name).toBe("Fallback User");
  });

  it("falls back to slug when title tag has no dash separator", async () => {
    const homepage = cheerio.load(
      `<html><body><a href="/members/slug-only">My Profile</a></body></html>`,
    );
    const profilePage = cheerio.load(
      `<html><head><title>The Mountaineers</title></head><body><h1>Profile</h1></body></html>`,
    );
    (client.fetchHtml as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(homepage)
      .mockResolvedValueOnce(profilePage);

    const result = await whoami(client);
    expect(result.name).toBe("slug-only");
  });

  it("throws when My Profile link is not found", async () => {
    const homepage = cheerio.load(`<html><body><a href="/other-page">Other Link</a></body></html>`);
    (client.fetchHtml as ReturnType<typeof vi.fn>).mockResolvedValueOnce(homepage);

    await expect(whoami(client)).rejects.toThrow("Could not find profile URL");
  });

  it("ignores non-My Profile links to /members/", async () => {
    const homepage = cheerio.load(
      `<html><body>
        <a href="/members/someone-else">View Member</a>
        <a href="/members/my-user">My Profile</a>
      </body></html>`,
    );
    const profilePage = cheerio.load(`<html><body><h1>Profile</h1><h1>My User</h1></body></html>`);
    (client.fetchHtml as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(homepage)
      .mockResolvedValueOnce(profilePage);

    const result = await whoami(client);
    expect(result.slug).toBe("my-user");
  });
});
