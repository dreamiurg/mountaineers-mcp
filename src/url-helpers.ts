// URL/path normalization helpers shared across tools and parsers.
// Keep this module dependency-free (no imports from ./parsers, ./client, or ./tools)
// to avoid re-introducing the parsers <-> tools circular dependency this module was
// extracted to break.

export const BRANCH_SLUG_PATTERN = "[a-z0-9-]+-branch";

export function stripBase(url: string): string {
  return url.replace(/^https?:\/\/(www\.)?mountaineers\.org/, "");
}

// Strips host + optional /<prefix>/, then returns the first remaining path segment.
// Accepts bare slugs (no prefix) too. Returns "" if there's nothing left.
export function extractSlugAfterPrefix(input: string, prefix: string): string {
  const escaped = prefix.replace(/^\/+|\/+$/g, "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // nosemgrep: javascript.lang.security.audit.detect-non-literal-regexp.detect-non-literal-regexp -- prefix is escaped on the line above
  const prefixRe = new RegExp(`^/+${escaped}/+`);
  const trimmed = stripBase(input.trim())
    .replace(prefixRe, "")
    .replace(/^\/+|\/+$/g, "");
  return trimmed.split("/")[0] ?? "";
}
