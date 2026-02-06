import { z } from "zod";
import type { MountaineersClient } from "../client.js";
import { parseCourseResults } from "../parsers.js";
import type { CourseSummary, SearchResult } from "../types.js";

export const searchCoursesSchema = z.object({
  query: z.string().optional().describe("Search text"),
  activity_type: z
    .string()
    .optional()
    .describe("Activity type filter, e.g. 'Climbing', 'Scrambling', 'Sea Kayaking', 'Navigation'"),
  branch: z.string().optional().describe("Branch filter, e.g. 'Seattle', 'Tacoma', 'Olympia'"),
  difficulty: z
    .string()
    .optional()
    .describe("Difficulty filter: 'Casual', 'Easy', 'Moderate', 'Challenging'"),
  open_only: z.boolean().optional().describe("Only show courses open for registration"),
  page: z.number().int().min(0).optional().describe("Page number (0-based, 20 results per page)"),
});

export type SearchCoursesInput = z.infer<typeof searchCoursesSchema>;

export async function searchCourses(
  client: MountaineersClient,
  input: SearchCoursesInput,
): Promise<SearchResult<CourseSummary>> {
  const params = new URLSearchParams();

  if (input.query) params.append("c2", input.query);
  if (input.activity_type) params.append("c4[]", input.activity_type);
  if (input.branch) params.append("c7[]", input.branch);
  if (input.difficulty) params.append("c15[]", input.difficulty);
  if (input.open_only) params.append("c17", "1");

  const page = input.page ?? 0;
  if (page > 0) params.append("b_start", String(page * 20));

  const $ = await client.fetchFacetedQuery("/activities/courses-clinics-seminars", params);
  return parseCourseResults($, page);
}
