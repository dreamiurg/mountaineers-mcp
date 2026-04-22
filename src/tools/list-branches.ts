import { z } from "zod";
import type { MountaineersClient } from "../client.js";
import type { BranchSummary } from "../types.js";
import { BRANCH_SLUG_PATTERN, stripBase } from "../url-helpers.js";

export const listBranchesSchema = z.object({});

export type ListBranchesInput = z.infer<typeof listBranchesSchema>;

const BRANCH_PATH_RE = new RegExp(`^/locations-lodges/(${BRANCH_SLUG_PATTERN})$`);

export async function listBranches(
  client: MountaineersClient,
  _input: ListBranchesInput,
): Promise<BranchSummary[]> {
  const $ = await client.fetchHtml("/locations-lodges");
  const seen = new Map<string, BranchSummary>();

  $("a[href]").each((_i, el) => {
    const href = $(el).attr("href") ?? "";
    const path = stripBase(href);
    const match = BRANCH_PATH_RE.exec(path);
    if (!match) return;
    const slug = match[1];
    if (seen.has(slug)) return;
    const name = $(el).text().trim();
    if (!name) return;
    seen.set(slug, {
      slug,
      name,
      url: `${client.baseUrl}/locations-lodges/${slug}`,
    });
  });

  return Array.from(seen.values());
}
