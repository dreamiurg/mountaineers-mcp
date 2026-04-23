import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { getVersion } from "../../tools/get-version.js";

describe("getVersion", () => {
  it("returns name and version matching package.json", () => {
    const pkg = JSON.parse(readFileSync("package.json", "utf8")) as {
      name: string;
      version: string;
    };
    const result = getVersion();
    expect(result).toEqual({ name: pkg.name, version: pkg.version });
  });

  it("returns a semver-shaped version string", () => {
    const { version } = getVersion();
    expect(version).toMatch(/^\d+\.\d+\.\d+(-[\w.]+)?$/);
  });
});
