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

// The only origin the client ever talks to. Session cookies are scoped to it.
export const SITE_ORIGIN = "https://www.mountaineers.org";
const ALLOWED_HOSTS = new Set(["www.mountaineers.org", "mountaineers.org"]);
// Anything with a URL scheme ("https:", "file:", "javascript:") or a
// protocol-relative "//host" prefix is treated as an absolute URL and must pass
// host validation; everything else is a slug or site path.
const ABSOLUTE_URL_RE = /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i;

function offSiteError(input: string, reason: string): Error {
  return new Error(
    `URL must be an https://www.mountaineers.org link (${reason}); got: ${JSON.stringify(input)}`,
  );
}

// Parses an absolute URL and accepts it only if it points at mountaineers.org
// over https with no credentials or custom port. Uses the WHATWG parser rather
// than prefix/regex checks, so lookalikes such as "mountaineers.org.evil.com",
// "www.mountaineers.org@evil.com" or "evil.com/?https://www.mountaineers.org"
// are rejected on their real hostname.
export function parseMountaineersUrl(input: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(input);
  } catch {
    throw offSiteError(input, "not a valid absolute URL");
  }
  if (parsed.protocol !== "https:") throw offSiteError(input, "only https is allowed");
  if (!ALLOWED_HOSTS.has(parsed.hostname)) throw offSiteError(input, "off-site host");
  if (parsed.username || parsed.password) throw offSiteError(input, "credentials not allowed");
  if (parsed.port) throw offSiteError(input, "custom port not allowed");
  return parsed;
}

// Resolves tool input to an absolute URL on SITE_ORIGIN:
// - full URL: validated with parseMountaineersUrl, canonicalized to www;
// - site path ("/activities/..."): resolved against SITE_ORIGIN;
// - bare slug: appended to `slugPrefix` (e.g. "/activities/activities").
// Off-site input throws instead of being fetched.
export function resolveMountaineersUrl(input: string, slugPrefix: string): string {
  const trimmed = input.trim();
  let path: string;
  if (ABSOLUTE_URL_RE.test(trimmed)) {
    if (trimmed.startsWith("//")) throw offSiteError(input, "protocol-relative URL");
    const parsed = parseMountaineersUrl(trimmed);
    path = `${parsed.pathname}${parsed.search}`;
  } else if (trimmed.startsWith("/")) {
    path = trimmed;
  } else {
    path = `/${slugPrefix.replace(/^\/+|\/+$/g, "")}/${trimmed}`;
  }
  const resolved = `${SITE_ORIGIN}${path}`;
  // Belt and braces: whatever the input, the result must stay on SITE_ORIGIN.
  if (new URL(resolved).origin !== SITE_ORIGIN) throw offSiteError(input, "off-site host");
  return resolved;
}
