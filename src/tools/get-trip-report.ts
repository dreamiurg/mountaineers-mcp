import { z } from "zod";
import type { MountaineersClient } from "../client.js";
import { parseTripReportDetail } from "../parsers.js";
import type { TripReportDetail } from "../types.js";
import { resolveMountaineersUrl } from "../url-helpers.js";

export const getTripReportSchema = z.object({
  url: z.string().describe("Full mountaineers.org trip report URL or slug"),
});

export type GetTripReportInput = z.infer<typeof getTripReportSchema>;

export async function getTripReport(
  client: MountaineersClient,
  input: GetTripReportInput,
): Promise<TripReportDetail> {
  const url = resolveMountaineersUrl(input.url, "/activities/trip-reports");

  const $ = await client.fetchHtml(url);
  return parseTripReportDetail($, url);
}
