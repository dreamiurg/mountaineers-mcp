import { z } from "zod";
import type { MountaineersClient } from "../client.js";
import { parseRoster } from "../parsers.js";
import type { RosterEntry } from "../types.js";

export const getActivityRosterSchema = z.object({
  activity_url: z
    .string()
    .describe("Full activity URL, e.g. 'https://www.mountaineers.org/activities/activities/day-hike-rock-candy-mountain-11'"),
});

export type GetActivityRosterInput = z.infer<typeof getActivityRosterSchema>;

export async function getActivityRoster(
  client: MountaineersClient,
  input: GetActivityRosterInput
): Promise<RosterEntry[]> {
  const $ = await client.fetchRosterTab(input.activity_url);
  return parseRoster($);
}
