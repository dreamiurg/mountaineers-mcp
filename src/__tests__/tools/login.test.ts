import { afterEach, describe, expect, it, vi } from "vitest";
import * as browserAuth from "../../browser-auth.js";
import * as clearance from "../../clearance.js";
import { login } from "../../tools/login.js";

vi.mock("../../browser-auth.js", () => ({ mintClearance: vi.fn() }));
vi.mock("../../clearance.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../clearance.js")>();
  return {
    ...actual,
    saveClearance: vi.fn(),
    cachePath: vi.fn(() => "/tmp/mtn/clearance.json"),
  };
});

afterEach(() => vi.clearAllMocks());

describe("login tool", () => {
  it("mints clearance interactively (no creds), saves it, and reports the cf_clearance expiry", async () => {
    const cookies = [
      { name: "cf_clearance", value: "X", expires: 1893456000 },
      { name: "__ac", value: "Y", expires: -1 },
    ];
    vi.mocked(browserAuth.mintClearance).mockResolvedValue({ userAgent: "UA", cookies });

    const result = await login();

    // No credentials are passed — the user signs in manually in the browser.
    expect(browserAuth.mintClearance).toHaveBeenCalledWith();
    expect(browserAuth.mintClearance).toHaveBeenCalledTimes(1);
    expect(clearance.saveClearance).toHaveBeenCalledWith("UA", cookies);
    expect(result.cache_path).toBe("/tmp/mtn/clearance.json");
    expect(result.expires).toBe(clearance.formatCookieExpiry(1893456000));
  });

  it("reports a session expiry when cf_clearance has no positive expiry", async () => {
    vi.mocked(browserAuth.mintClearance).mockResolvedValue({
      userAgent: "UA",
      cookies: [
        { name: "cf_clearance", value: "X", expires: -1 },
        { name: "__ac", value: "Y", expires: -1 },
      ],
    });

    const result = await login();
    expect(result.expires).toMatch(/session/);
    expect(result.cache_path).toBe("/tmp/mtn/clearance.json");
    expect(result.message).toMatch(/Signed in/);
  });

  it("propagates errors from mintClearance and does not save", async () => {
    vi.mocked(browserAuth.mintClearance).mockRejectedValue(new Error("Chrome unavailable"));
    await expect(login()).rejects.toThrow("Chrome unavailable");
    expect(clearance.saveClearance).not.toHaveBeenCalled();
  });
});
