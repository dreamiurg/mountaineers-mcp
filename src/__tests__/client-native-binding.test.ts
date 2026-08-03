import { describe, expect, it, vi } from "vitest";
import * as clearance from "../clearance.js";
import { MountaineersClient } from "../client.js";

// impit ships per-platform prebuilt bindings and throws at *import* time when
// none matches the host. That used to happen at module scope, killing the
// process before the MCP transport existed — the client saw the pipe close with
// no stderr and no diagnostics, which reads as a hard crash. The import is now
// deferred to the first request so the failure arrives as a readable error.
// Lives in its own file because vi.mock is hoisted per module registry.
vi.mock("impit", () => {
  throw new Error("impit couldn't load native bindings.");
});

vi.mock("../clearance.js", () => ({
  loadClearance: vi.fn(),
}));

describe("MountaineersClient when the impit native binding is missing", () => {
  it("constructs without throwing so the server can still start and report", () => {
    vi.mocked(clearance.loadClearance).mockReturnValue({
      userAgent: "ua",
      cookies: [
        { name: "cf_clearance", value: "cf", expires: -1 },
        { name: "__ac", value: "ac", expires: -1 },
      ],
    });
    expect(() => new MountaineersClient()).not.toThrow();
  });

  it("fails a request with a platform-specific, actionable message", async () => {
    vi.mocked(clearance.loadClearance).mockReturnValue({
      userAgent: "ua",
      cookies: [
        { name: "cf_clearance", value: "cf", expires: -1 },
        { name: "__ac", value: "ac", expires: -1 },
      ],
    });
    const client = new MountaineersClient();
    await expect(client.fetchRaw("/x")).rejects.toThrow(
      new RegExp(`impit native bindings[\\s\\S]*${process.platform}-${process.arch}`),
    );
  });
});
