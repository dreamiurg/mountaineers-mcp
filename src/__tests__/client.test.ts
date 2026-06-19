import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as clearance from "../clearance.js";
import { MountaineersClient } from "../client.js";

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

afterEach(() => vi.restoreAllMocks());

describe("MountaineersClient with a valid cache", () => {
  beforeEach(() => {
    vi.mocked(clearance.loadClearance).mockReturnValue(CACHE);
  });

  it("attaches all three cookies and the pinned UA to every request", async () => {
    const fetchMock = vi.spyOn(global, "fetch").mockResolvedValue(res(200));
    const client = new MountaineersClient();
    await client.fetchRaw("/activities/");
    const [, init] = fetchMock.mock.calls[0];
    const headers = init?.headers as Record<string, string>;
    expect(headers["User-Agent"]).toBe("Mozilla/5.0 (Test) Chrome/126");
    expect(headers.Cookie).toContain("cf_clearance=CF");
    expect(headers.Cookie).toContain("__cf_bm=BM");
    expect(headers.Cookie).toContain("__ac=AC");
  });

  it("reloads the cache once and retries on 403 cf-mitigated:challenge, then throws when still challenged", async () => {
    const fetchMock = vi
      .spyOn(global, "fetch")
      .mockResolvedValue(res(403, { "cf-mitigated": "challenge" }));
    const loadSpy = vi.mocked(clearance.loadClearance);
    const client = new MountaineersClient();
    loadSpy.mockClear();
    await expect(client.fetchRaw("/activities/")).rejects.toThrow(/npm run login/);
    expect(loadSpy).toHaveBeenCalledTimes(1); // one reload during retry
    expect(fetchMock).toHaveBeenCalledTimes(2); // original + one retry
  });

  it("does not retry when the reloaded cache is null", async () => {
    const fetchMock = vi
      .spyOn(global, "fetch")
      .mockResolvedValue(res(403, { "cf-mitigated": "challenge" }));
    const loadSpy = vi.mocked(clearance.loadClearance);
    const client = new MountaineersClient();
    loadSpy.mockReturnValue(null); // cache deleted mid-session
    await expect(client.fetchRaw("/x")).rejects.toThrow(/No Cloudflare clearance/);
    expect(fetchMock).toHaveBeenCalledTimes(1); // no second request
  });

  it("returns a non-CF 403 response unchanged (no CF error)", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(res(403));
    const client = new MountaineersClient();
    const r = await client.fetchRaw("/x");
    expect(r.status).toBe(403);
  });
});

describe("MountaineersClient with no cache", () => {
  it("throws an actionable error on any request", async () => {
    vi.mocked(clearance.loadClearance).mockReturnValue(null);
    const client = new MountaineersClient();
    await expect(client.fetchRaw("/x")).rejects.toThrow(/Run `npm run login`/);
  });
});
