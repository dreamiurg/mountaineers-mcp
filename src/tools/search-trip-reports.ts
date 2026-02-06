import { z } from "zod";
import type { MountaineersClient } from "../client.js";
import { parseTripReportResults } from "../parsers.js";
import type { SearchResult, TripReportSummary } from "../types.js";

export const searchTripReportsSchema = z.object({
  query: z.string().optional().describe("Search text"),
  activity_type: z.string().optional().describe("Activity type filter"),
  page: z.number().int().min(0).optional().describe("Page number (0-based, 20 results per page)"),
});

export type SearchTripReportsInput = z.infer<typeof searchTripReportsSchema>;

export async function searchTripReports(
  client: MountaineersClient,
  input: SearchTripReportsInput,
): Promise<SearchResult<TripReportSummary>> {
  const params = new URLSearchParams();

  if (input.query) params.append("c2", input.query);
  if (input.activity_type) params.append("c4[]", input.activity_type);

  const page = input.page ?? 0;
  if (page > 0) params.append("b_start", String(page * 20));

  const $ = await client.fetchFacetedQuery("/activities/trip-reports", params);
  return parseTripReportResults($, page);
}
