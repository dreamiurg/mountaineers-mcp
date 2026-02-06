import { z } from "zod";
import type { MountaineersClient } from "../client.js";
import { parseRouteResults } from "../parsers.js";
import type { RouteSummary, SearchResult } from "../types.js";

export const searchRoutesSchema = z.object({
  query: z.string().optional().describe("Search text"),
  activity_type: z
    .string()
    .optional()
    .describe(
      "Activity type: 'Day Hiking', 'Climbing', 'Sea Kayaking', 'Backpacking', 'Scrambling', 'Snowshoeing', 'Cross-Country Skiing', 'Alpine Skiing', 'Trail Running', 'Mountain Biking', 'Sailing'",
    ),
  used_for: z.string().optional().describe("Used for filter, e.g. 'Basic Alpine', 'Intermediate'"),
  climbing_category: z.string().optional().describe("Climbing category filter"),
  snowshoeing_category: z.string().optional().describe("Snowshoeing category filter"),
  difficulty: z
    .string()
    .optional()
    .describe("Difficulty filter: 'Casual', 'Easy', 'Moderate', 'Moderate+', 'Challenging'"),
  page: z.number().int().min(0).optional().describe("Page number (0-based, 20 results per page)"),
});

export type SearchRoutesInput = z.infer<typeof searchRoutesSchema>;

export async function searchRoutes(
  client: MountaineersClient,
  input: SearchRoutesInput,
): Promise<SearchResult<RouteSummary>> {
  const params = new URLSearchParams();

  if (input.query) params.append("c2", input.query);
  if (input.activity_type) params.append("c4[]", input.activity_type);
  if (input.difficulty) params.append("c5[]", input.difficulty);
  if (input.climbing_category) params.append("c7[]", input.climbing_category);
  if (input.used_for) params.append("c9[]", input.used_for);
  if (input.snowshoeing_category) params.append("c10[]", input.snowshoeing_category);

  const page = input.page ?? 0;
  if (page > 0) params.append("b_start", String(page * 20));

  const $ = await client.fetchFacetedQuery("/activities/routes-places", params);
  return parseRouteResults($, page);
}
