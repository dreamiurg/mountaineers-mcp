import { z } from "zod";
import type { MountaineersClient } from "../client.js";
import { parseRoster } from "../parsers.js";
import type { ListResult, RosterEntry } from "../types.js";

export const getActivityRosterSchema = z.object({
  url: z
    .string()
    .describe("Full activity URL or activity slug (e.g. 'day-hike-rock-candy-mountain-11')"),
});

export type GetActivityRosterInput = z.infer<typeof getActivityRosterSchema>;

export async function getActivityRoster(
  client: MountaineersClient,
  input: GetActivityRosterInput,
): Promise<ListResult<RosterEntry>> {
  const url = input.url.startsWith("http")
    ? input.url
    : `${client.baseUrl}/activities/activities/${input.url}`;

  const $ = await client.fetchRosterTab(url);
  const entries = parseRoster($);
  return { total_count: entries.length, items: entries, limit: 0 };
}
