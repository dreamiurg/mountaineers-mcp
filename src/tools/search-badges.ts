import { z } from "zod";
import type { MountaineersClient } from "../client.js";
import { parseBadgeResults } from "../parsers.js";
import type { BadgeSummary, SearchResult } from "../types.js";

export const searchBadgesSchema = z.object({
  query: z.string().optional().describe("Search text"),
  page: z.number().int().min(0).optional().describe("Page number (0-based, 20 results per page)"),
});

export type SearchBadgesInput = z.infer<typeof searchBadgesSchema>;

export async function searchBadges(
  client: MountaineersClient,
  input: SearchBadgesInput,
): Promise<SearchResult<BadgeSummary>> {
  const params = new URLSearchParams();
  params.append("type", "mtneers.badge");
  if (input.query) params.append("SearchableText", input.query);

  const page = input.page ?? 0;
  if (page > 0) params.append("b_start", String(page * 20));

  const $ = await client.fetchFacetedQuery("/search", params);
  return parseBadgeResults($, page);
}
