import { z } from "zod";
import type { MountaineersClient } from "../client.js";
import { parseActivityResults } from "../parsers.js";
import type { SearchResult, ActivitySummary } from "../types.js";

export const searchActivitiesSchema = z.object({
  query: z.string().optional().describe("Search text"),
  activity_type: z.string().optional().describe("Activity type filter, e.g. 'Day Hiking', 'Climbing', 'Sea Kayaking', 'Backpacking', 'Scrambling', 'Snowshoeing', 'Cross-Country Skiing', 'Alpine Skiing', 'Trail Running', 'Mountain Biking', 'Sailing', 'Stewardship'"),
  branch: z.string().optional().describe("Branch filter, e.g. 'Seattle', 'Tacoma', 'Olympia', 'Bellingham', 'Everett', 'Foothills', 'Kitsap'"),
  difficulty: z.string().optional().describe("Difficulty filter: 'Casual', 'Easy', 'Moderate', 'Moderate+', 'Challenging'"),
  audience: z.string().optional().describe("Audience filter: 'Adults', 'Families', 'Youth'"),
  day_of_week: z.string().optional().describe("Day of week: 'Monday' through 'Sunday'"),
  date_start: z.string().optional().describe("Start date filter (YYYY-MM-DD)"),
  date_end: z.string().optional().describe("End date filter (YYYY-MM-DD)"),
  type: z.string().optional().describe("Type: 'Trip', 'Course', 'Clinic', 'Seminar'"),
  open_only: z.boolean().optional().describe("Only show activities open for registration"),
  page: z.number().int().min(0).optional().describe("Page number (0-based, 20 results per page)"),
});

export type SearchActivitiesInput = z.infer<typeof searchActivitiesSchema>;

export async function searchActivities(
  client: MountaineersClient,
  input: SearchActivitiesInput
): Promise<SearchResult<ActivitySummary>> {
  const params = new URLSearchParams();

  if (input.query) params.append("c2", input.query);
  if (input.activity_type) params.append("c4[]", input.activity_type);
  if (input.audience) params.append("c5[]", input.audience);
  if (input.branch) params.append("c8[]", input.branch);
  if (input.difficulty) params.append("c15[]", input.difficulty);
  if (input.type) params.append("c16[]", input.type);
  if (input.open_only) params.append("c17", "1");
  if (input.day_of_week) params.append("c21[]", input.day_of_week);
  if (input.date_start) params.append("start", input.date_start);
  if (input.date_end) params.append("end", input.date_end);

  const page = input.page ?? 0;
  if (page > 0) params.append("b_start", String(page * 20));

  const $ = await client.fetchFacetedQuery("/activities/activities", params);
  return parseActivityResults($, page);
}
