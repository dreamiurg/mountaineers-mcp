import { z } from "zod";
import type { MountaineersClient } from "../client.js";
import type { CommitteeSummary } from "../types.js";
import { BRANCH_SLUG_PATTERN, extractSlugAfterPrefix, stripBase } from "../url-helpers.js";

export const listCommitteesSchema = z.object({
  branch: z.string().describe("Branch slug (e.g. 'seattle-branch') or full branch URL"),
});

export type ListCommitteesInput = z.infer<typeof listCommitteesSchema>;

const BRANCH_SLUG_RE = new RegExp(`^${BRANCH_SLUG_PATTERN}$`);

function normalizeBranchSlug(input: string): string {
  const slug = extractSlugAfterPrefix(input, "locations-lodges");
  if (!slug || !BRANCH_SLUG_RE.test(slug)) {
    throw new Error(
      `branch must be a valid branch slug like 'seattle-branch' (got: ${JSON.stringify(input)})`,
    );
  }
  return slug;
}

export async function listCommittees(
  client: MountaineersClient,
  input: ListCommitteesInput,
): Promise<CommitteeSummary[]> {
  const branchSlug = normalizeBranchSlug(input.branch);
  const $ = await client.fetchHtml(`/locations-lodges/${branchSlug}/committees`);
  // branchSlug is validated to [a-z0-9-]+-branch — safe for direct interpolation.
  // nosemgrep: javascript.lang.security.audit.detect-non-literal-regexp.detect-non-literal-regexp -- branchSlug pre-validated by BRANCH_SLUG_RE
  const committeePathRe = new RegExp(`^/locations-lodges/${branchSlug}/committees/([a-z0-9-]+)$`);

  const seen = new Map<string, CommitteeSummary>();
  $("a[href]").each((_i, el) => {
    const href = $(el).attr("href") ?? "";
    const path = stripBase(href);
    const match = committeePathRe.exec(path);
    if (!match) return;
    const slug = match[1];
    if (seen.has(slug)) return;
    const name = $(el).text().trim();
    if (!name) return;
    seen.set(slug, {
      slug,
      name,
      url: `${client.baseUrl}/locations-lodges/${branchSlug}/committees/${slug}`,
      branch_slug: branchSlug,
    });
  });

  return Array.from(seen.values());
}
