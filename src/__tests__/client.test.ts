import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as clearance from "../clearance.js";
import { MountaineersClient } from "../client.js";

// The client makes requests through an Impit instance (browser-TLS impersonation),
// not global fetch. Mock the module so `new Impit()` exposes a controllable fetch.
const { impitFetch } = vi.hoisted(() => ({ impitFetch: vi.fn() }));
vi.mock("impit", () => ({
  Impit: class {
    fetch = impitFetch;
  },
}));

vi.mock("../clearance.js", () => ({
  loadClearance: vi.fn(),
}));

const CACHE = {
  userAgent: "Mozilla/5.0 (Test) Chrome/126",
  cookies: [
    { name: "cf_clearance", value: "CF", expires: -1 },
    { name: "__cf_bm", value: "BM", expires: -1 },
    { name: "__ac", value: "AC", expires: -1 },
  ],
};

function res(
  status: number,
  headers: Record<string, string> = {},
  body = "<html></html>",
): Response {
  return new Response(body, { status, headers });
}

afterEach(() => {
  impitFetch.mockReset();
  vi.mocked(clearance.loadClearance).mockReset();
});

describe("MountaineersClient with a valid cache", () => {
  beforeEach(() => {
    vi.mocked(clearance.loadClearance).mockReturnValue(CACHE);
  });

  it("attaches all three cookies to every request and lets Impit own the UA", async () => {
    impitFetch.mockResolvedValue(res(200));
    const client = new MountaineersClient();
    await client.fetchRaw("/activities/");
    const [, init] = impitFetch.mock.calls[0];
    const headers = new Headers(init?.headers as HeadersInit);
    expect(headers.get("Cookie")).toContain("cf_clearance=CF");
    expect(headers.get("Cookie")).toContain("__cf_bm=BM");
    expect(headers.get("Cookie")).toContain("__ac=AC");
    // We must NOT pin a User-Agent — Impit sets one matching its TLS fingerprint.
    expect(headers.get("User-Agent")).toBeNull();
  });

  it("reloads the cache once and retries on 403 cf-mitigated:challenge, then throws when still challenged", async () => {
    impitFetch.mockImplementation(() => Promise.resolve(res(403, { "cf-mitigated": "challenge" })));
    const loadSpy = vi.mocked(clearance.loadClearance);
    const client = new MountaineersClient();
    loadSpy.mockClear();
    // Return a variant cookie value so we can verify the retry uses the reloaded cookies
    loadSpy.mockReturnValue({
      userAgent: "ua",
      cookies: [
        { name: "cf_clearance", value: "CF2", expires: -1 },
        { name: "__ac", value: "AC", expires: -1 },
      ],
    });
    await expect(client.fetchRaw("/activities/")).rejects.toThrow(/session expired/);
    expect(loadSpy).toHaveBeenCalledTimes(1); // one reload during retry
    expect(impitFetch).toHaveBeenCalledTimes(2); // original + one retry
    const [, secondInit] = impitFetch.mock.calls[1];
    expect(new Headers(secondInit?.headers as HeadersInit).get("Cookie")).toContain(
      "cf_clearance=CF2",
    );
  });

  it("does not retry when the reloaded cache is null", async () => {
    const cancelSpy = vi.fn();
    const challengeRes = new Response("", {
      status: 403,
      headers: { "cf-mitigated": "challenge" },
    });
    Object.defineProperty(challengeRes, "body", { value: { cancel: cancelSpy } });
    impitFetch.mockResolvedValue(challengeRes);
    const loadSpy = vi.mocked(clearance.loadClearance);
    const client = new MountaineersClient();
    // constructor already saw CACHE (beforeEach); this overrides only the reload call inside fetchRaw
    loadSpy.mockReturnValue(null); // cache deleted mid-session
    await expect(client.fetchRaw("/x")).rejects.toThrow(/`login` tool/);
    expect(cancelSpy).toHaveBeenCalled();
    expect(impitFetch).toHaveBeenCalledTimes(1); // no second request
  });

  it("returns a non-CF 403 response unchanged (no CF error)", async () => {
    impitFetch.mockResolvedValue(res(403));
    const client = new MountaineersClient();
    const r = await client.fetchRaw("/x");
    expect(r.status).toBe(403);
  });
});

describe("MountaineersClient with no cache", () => {
  it("throws an actionable error on any request", async () => {
    vi.mocked(clearance.loadClearance).mockReturnValue(null);
    const client = new MountaineersClient();
    await expect(client.fetchRaw("/x")).rejects.toThrow(/`login` tool/);
  });

  it("lazily reloads clearance written after construction (e.g. by the login tool)", async () => {
    const loadSpy = vi.mocked(clearance.loadClearance);
    // Server started before the user logged in: constructor sees no cache.
    loadSpy.mockReturnValueOnce(null);
    const client = new MountaineersClient();
    // The login tool (a separate process) has since written the cache. A later
    // request must pick it up without restarting the server.
    loadSpy.mockReturnValue(CACHE);
    impitFetch.mockResolvedValue(res(200));
    await client.fetchRaw("/activities/");
    const [, init] = impitFetch.mock.calls[0];
    expect(new Headers(init?.headers as HeadersInit).get("Cookie")).toContain("cf_clearance=CF");
  });
});

describe("MountaineersClient higher-level fetch methods", () => {
  beforeEach(() => {
    vi.mocked(clearance.loadClearance).mockReturnValue(CACHE);
  });

  it("fetchHtml returns a cheerio API over the response body", async () => {
    impitFetch.mockResolvedValue(res(200, {}, "<html><body><h1>Hi</h1></body></html>"));
    const client = new MountaineersClient();
    const $ = await client.fetchHtml("/x");
    expect($("h1").text()).toBe("Hi");
  });

  it("fetchJson returns parsed JSON from the response body", async () => {
    impitFetch.mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    const client = new MountaineersClient();
    const data = await client.fetchJson("/x");
    expect(data).toEqual({ ok: true });
  });

  it("fetchJson throws a clear HTTP error on a non-2xx response", async () => {
    impitFetch.mockResolvedValue(res(404, {}, "Not Found"));
    const client = new MountaineersClient();
    await expect(client.fetchJson("/x")).rejects.toThrow(/HTTP 404/);
  });

  it("fetchHtml throws a clear HTTP error on a non-2xx response", async () => {
    impitFetch.mockResolvedValue(res(500, {}, "Server Error"));
    const client = new MountaineersClient();
    await expect(client.fetchHtml("/x")).rejects.toThrow(/HTTP 500/);
  });
});

// mountaineers.org answers a logged-out request with 200 + the login form rather
// than a 401/403, so without these guards the parsers silently yield empty data.
// Markup below is trimmed from real responses captured against the live site.
describe("MountaineersClient detects logged-out and unrecognized responses", () => {
  const LOGIN_PAGE =
    '<html><body><form id="login-form">' +
    '<input id="__ac_name" name="__ac_name" value="" type="text" />' +
    '<input name="__ac_password" type="password" /></form></body></html>';

  beforeEach(() => {
    vi.mocked(clearance.loadClearance).mockReturnValue(CACHE);
  });

  it("fetchHtml throws instead of parsing a login page as an empty record", async () => {
    impitFetch.mockResolvedValue(res(200, {}, LOGIN_PAGE));
    const client = new MountaineersClient();
    await expect(client.fetchHtml("/members/someone")).rejects.toThrow(/session expired/);
  });

  it("fetchFacetedQuery returns results when the response carries a result count", async () => {
    impitFetch.mockResolvedValue(
      res(200, {}, '<html><body><div id="faceted-result-count">144 results</div></body></html>'),
    );
    const client = new MountaineersClient();
    const $ = await client.fetchFacetedQuery("/activities/routes-places", new URLSearchParams());
    expect($("#faceted-result-count").text()).toContain("144");
  });

  it("fetchFacetedQuery accepts a genuinely empty result set without erroring", async () => {
    // A real no-match search returns only this notice — no result count at all.
    impitFetch.mockResolvedValue(
      res(
        200,
        {},
        '<html><body><p class="discreet">There are currently no items in this folder.</p></body></html>',
      ),
    );
    const client = new MountaineersClient();
    const $ = await client.fetchFacetedQuery("/activities/routes-places", new URLSearchParams());
    expect($(".result-item")).toHaveLength(0);
  });

  it("fetchFacetedQuery throws when served neither results nor an empty notice", async () => {
    impitFetch.mockResolvedValue(res(200, {}, "<html><body>Just a moment...</body></html>"));
    const client = new MountaineersClient();
    await expect(
      client.fetchFacetedQuery("/activities/routes-places", new URLSearchParams()),
    ).rejects.toThrow(/Unrecognized response/);
  });
});
