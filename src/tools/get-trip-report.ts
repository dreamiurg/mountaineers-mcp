import { z } from "zod";
import type { MountaineersClient } from "../client.js";
import { parseTripReportDetail } from "../parsers.js";
import type { TripReportDetail } from "../types.js";

export const getTripReportSchema = z.object({
  url: z.string().describe("Full trip report URL or slug"),
});

export type GetTripReportInput = z.infer<typeof getTripReportSchema>;

export async function getTripReport(
  client: MountaineersClient,
  input: GetTripReportInput,
): Promise<TripReportDetail> {
  const url = input.url.startsWith("http")
    ? input.url
    : `${client.baseUrl}/activities/trip-reports/${input.url}`;

  const $ = await client.fetchHtml(url);
  return parseTripReportDetail($, url);
}
