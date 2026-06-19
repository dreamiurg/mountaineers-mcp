import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cachePath, loadClearance, saveClearance } from "../clearance.js";

let tmp: string;

function writeCache(obj: unknown): void {
  const file = cachePath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, typeof obj === "string" ? obj : JSON.stringify(obj));
}

const ok = (over: Record<string, unknown> = {}) => ({
  user_agent: "Mozilla/5.0 (Test) Chrome/126",
  cookies: [
    { name: "cf_clearance", value: "cf", expires: -1 },
    { name: "__cf_bm", value: "bm", expires: -1 },
    { name: "__ac", value: "ac", expires: -1 },
  ],
  saved_at: 1,
  ...over,
});

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "mtn-clr-"));
  process.env.XDG_CACHE_HOME = tmp;
});
afterEach(() => {
  delete process.env.XDG_CACHE_HOME;
  fs.rmSync(tmp, { recursive: true, force: true });
});

describe("cachePath", () => {
  it("honors XDG_CACHE_HOME", () => {
    expect(cachePath()).toBe(path.join(tmp, "mountaineers-mcp", "clearance.json"));
  });
  it("falls back to ~/.cache when XDG unset", () => {
    delete process.env.XDG_CACHE_HOME;
    expect(cachePath()).toBe(
      path.join(os.homedir(), ".cache", "mountaineers-mcp", "clearance.json"),
    );
  });
});

describe("loadClearance", () => {
  it("returns null when file missing", () => {
    expect(loadClearance()).toBeNull();
  });
  it("returns null on unparseable JSON", () => {
    writeCache("{not json");
    expect(loadClearance()).toBeNull();
  });
  it("returns null when user_agent missing/empty", () => {
    writeCache(ok({ user_agent: "" }));
    expect(loadClearance()).toBeNull();
  });
  it("returns null when cf_clearance absent", () => {
    writeCache(ok({ cookies: [{ name: "__ac", value: "ac", expires: -1 }] }));
    expect(loadClearance()).toBeNull();
  });
  it("returns null when cf_clearance expired", () => {
    writeCache(
      ok({
        cookies: [
          { name: "cf_clearance", value: "cf", expires: 100 },
          { name: "__ac", value: "ac", expires: -1 },
        ],
      }),
    );
    expect(loadClearance(200)).toBeNull();
  });
  it("returns null when __ac absent", () => {
    writeCache(ok({ cookies: [{ name: "cf_clearance", value: "cf", expires: -1 }] }));
    expect(loadClearance()).toBeNull();
  });
  it("treats expires<=0 (-1 and 0) as session cookies → valid", () => {
    writeCache(
      ok({
        cookies: [
          { name: "cf_clearance", value: "cf", expires: 0 },
          { name: "__ac", value: "ac", expires: -1 },
        ],
      }),
    );
    const c = loadClearance(9_999_999_999);
    expect(c?.userAgent).toBe("Mozilla/5.0 (Test) Chrome/126");
  });
  it("returns userAgent + cookies on a valid cache", () => {
    writeCache(ok());
    const c = loadClearance(2);
    expect(c?.userAgent).toContain("Chrome");
    expect(c?.cookies).toHaveLength(3);
  });
});

describe("saveClearance round-trips", () => {
  it("writes a file loadClearance can read", () => {
    saveClearance("UA/1", [
      { name: "cf_clearance", value: "x", expires: -1 },
      { name: "__ac", value: "y", expires: -1 },
    ]);
    const c = loadClearance();
    expect(c?.userAgent).toBe("UA/1");
  });
});
