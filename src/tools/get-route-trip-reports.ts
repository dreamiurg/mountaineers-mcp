import { z } from "zod";
import type { MountaineersClient } from "../client.js";
import { parseTripReportResults } from "../parsers.js";
import type { SearchResult, TripReportSummary } from "../types.js";
import { stripBase } from "../url-helpers.js";

export const getRouteTripReportsSchema = z.object({
  route_url: z
    .string()
    .describe(
      "Full route URL (e.g. https://www.mountaineers.org/activities/routes-places/mount-si-main-trail) or path",
    ),
  page: z.number().int().min(0).optional().describe("Page number (0-based, 20 results per page)"),
});

export type GetRouteTripReportsInput = z.infer<typeof getRouteTripReportsSchema>;

function normalizeRoutePath(routeUrl: string): string {
  const stripped = stripBase(routeUrl.trim()).replace(/\/+$/, "");
  const m = stripped.match(/^\/activities\/routes-places\/([^/]+)/);
  if (!m) {
    throw new Error(
      `Invalid route_url: must be a /activities/routes-places/{slug} path or full URL. Got: ${routeUrl}`,
    );
  }
  return `/activities/routes-places/${m[1]}`;
}

export async function getRouteTripReports(
  client: MountaineersClient,
  input: GetRouteTripReportsInput,
): Promise<SearchResult<TripReportSummary>> {
  const routePath = normalizeRoutePath(input.route_url);
  const page = input.page ?? 0;
  const query = page > 0 ? `?b_start=${page * 20}` : "";
  const $ = await client.fetchHtml(`${routePath}/trip-reports${query}`, { authenticated: true });
  return parseTripReportResults($, page);
}
