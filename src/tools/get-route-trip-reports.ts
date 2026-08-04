import type { CheerioAPI } from "cheerio";
import { z } from "zod";
import type { MountaineersClient } from "../client.js";
import { parseTripReportResults } from "../parsers.js";
import type { SearchResult, TripReportSummary } from "../types.js";
import { stripBase } from "../url-helpers.js";

const ROUTE_PATH_PREFIX = "/activities/routes-places/";
const ROUTE_SEGMENT_RE = /^[a-z0-9-]+$/;
const PAGE_SIZE = 20;

export const getRouteTripReportsSchema = z.object({
  route_url: z
    .string()
    .describe(
      "Full route URL, /activities/routes-places/... path, or route slug (e.g. 'mount-si-main-trail')",
    ),
  page: z.number().int().min(0).optional().describe("Page number (0-based, 20 results per page)"),
});

export type GetRouteTripReportsInput = z.infer<typeof getRouteTripReportsSchema>;

function normalizeRoutePath(routeUrl: string): string {
  const stripped = stripBase(routeUrl.trim())
    .replace(/[?#].*$/, "")
    .replace(/\/+$/, "");
  const path = stripped.includes("/") ? stripped : `${ROUTE_PATH_PREFIX}${stripped}`;
  const segments = path.startsWith(ROUTE_PATH_PREFIX)
    ? path.slice(ROUTE_PATH_PREFIX.length).split("/")
    : [];
  if (!segments.length || segments.some((segment) => !ROUTE_SEGMENT_RE.test(segment))) {
    throw new Error(
      "Invalid route_url: must be a full mountaineers.org route URL, " +
        `/activities/routes-places/... path, or route slug. Got: ${routeUrl}`,
    );
  }
  return `${ROUTE_PATH_PREFIX}${segments.join("/")}`;
}

function pageUrl(routePath: string, start: number): string {
  const query = start > 0 ? `?b_start=${start}` : "";
  return `${routePath}/trip-reports${query}`;
}

function paginationStarts($: CheerioAPI): number[] {
  const starts: number[] = [];
  $(".pagination a[href]").each((_index, element) => {
    const href = $(element).attr("href") ?? "";
    const match = href.match(/[?&]b_start(?::int)?=(\d+)/);
    if (match) starts.push(Number.parseInt(match[1], 10));
  });
  return starts;
}

async function totalCountFromPagination(
  client: MountaineersClient,
  routePath: string,
  initialPage: CheerioAPI,
  initialStart: number,
): Promise<number> {
  let $page = initialPage;
  let start = initialStart;
  const visited = new Set<number>();

  while (true) {
    const itemCount = $page(".result-item").length;
    const futureStarts = paginationStarts($page).filter((offset) => offset > start);
    const hasNext = $page(".pagination li.next a").length > 0 || futureStarts.length > 0;
    if (!hasNext) return start + itemCount;

    visited.add(start);
    const nextStart = Math.max(...futureStarts);
    if (!Number.isFinite(nextStart) || visited.has(nextStart)) {
      throw new Error(
        `Unable to resolve trip report pagination for ${routePath}; refusing to return a partial count.`,
      );
    }

    start = nextStart;
    $page = await client.fetchHtml(pageUrl(routePath, start));
  }
}

async function resolveTotalCount(
  client: MountaineersClient,
  routePath: string,
  $page: CheerioAPI,
  page: number,
): Promise<number> {
  const start = page * PAGE_SIZE;
  if (page > 0 && $page(".result-item").length === 0) {
    const $firstPage = await client.fetchHtml(pageUrl(routePath, 0));
    return totalCountFromPagination(client, routePath, $firstPage, 0);
  }
  return totalCountFromPagination(client, routePath, $page, start);
}

export async function getRouteTripReports(
  client: MountaineersClient,
  input: GetRouteTripReportsInput,
): Promise<SearchResult<TripReportSummary>> {
  const routePath = normalizeRoutePath(input.route_url);
  const page = input.page ?? 0;
  const $ = await client.fetchHtml(pageUrl(routePath, page * PAGE_SIZE));
  const result = parseTripReportResults($, page);
  const totalCount = await resolveTotalCount(client, routePath, $, page);
  return {
    ...result,
    total_count: totalCount,
    has_more: (page + 1) * PAGE_SIZE < totalCount,
  };
}
