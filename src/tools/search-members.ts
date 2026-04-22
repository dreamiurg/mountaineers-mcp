import { z } from "zod";
import type { MountaineersClient } from "../client.js";
import { parseMemberResults } from "../parsers.js";
import type { MemberSummary, SearchResult } from "../types.js";

export const searchMembersSchema = z.object({
  query: z
    .string()
    .min(1, "query must not be empty")
    .describe("Search text (matches name, slug, or any indexed text)"),
  page: z.number().int().min(0).optional().describe("Page number (0-based, 20 results per page)"),
});

export type SearchMembersInput = z.infer<typeof searchMembersSchema>;

export async function searchMembers(
  client: MountaineersClient,
  input: SearchMembersInput,
): Promise<SearchResult<MemberSummary>> {
  await client.ensureLoggedIn();

  const params = new URLSearchParams();
  params.append("type", "mtneers.contact");
  params.append("SearchableText", input.query);

  const page = input.page ?? 0;
  if (page > 0) params.append("b_start", String(page * 20));

  const $ = await client.fetchFacetedQuery("/search", params);
  return parseMemberResults($, page);
}
