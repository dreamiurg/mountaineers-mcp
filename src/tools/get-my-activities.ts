import { z } from "zod";
import type { MountaineersClient } from "../client.js";
import { parseMemberActivities } from "../parsers.js";
import type { MyActivity } from "../types.js";
import { whoami } from "./whoami.js";

export const getMyActivitiesSchema = z.object({
  category: z.string().optional().describe("Filter by category: 'trip' or 'course'"),
  result: z.string().optional().describe("Filter by result: 'Successful', 'Canceled', etc."),
  date_from: z.string().optional().describe("Filter activities from this date (YYYY-MM-DD)"),
  date_to: z.string().optional().describe("Filter activities to this date (YYYY-MM-DD)"),
  limit: z
    .number()
    .optional()
    .describe("Max number of results to return (default 20, use 0 for all)"),
});

export type GetMyActivitiesInput = z.infer<typeof getMyActivitiesSchema>;

export async function getMyActivities(
  client: MountaineersClient,
  input: GetMyActivitiesInput,
): Promise<MyActivity[]> {
  const me = await whoami(client);

  const $ = await client.fetchHtml(`/members/${me.slug}/member-activities`, {
    authenticated: true,
  });

  let activities = parseMemberActivities($);

  // Sort by date ascending (soonest first) for registered activities
  activities.sort((a, b) => {
    if (!a.start_date && !b.start_date) return 0;
    if (!a.start_date) return 1;
    if (!b.start_date) return -1;
    return a.start_date.localeCompare(b.start_date);
  });

  // Client-side filtering
  if (input.category) {
    const category = input.category;
    activities = activities.filter((a) => a.category?.toLowerCase() === category.toLowerCase());
  }
  if (input.result) {
    const result = input.result;
    activities = activities.filter((a) => a.result?.toLowerCase() === result.toLowerCase());
  }
  if (input.date_from) {
    const dateFrom = input.date_from;
    activities = activities.filter((a) => a.start_date && a.start_date >= dateFrom);
  }
  if (input.date_to) {
    const dateTo = input.date_to;
    activities = activities.filter((a) => a.start_date && a.start_date <= dateTo);
  }

  // Apply limit (default 20, 0 = all)
  const limit = input.limit ?? 20;
  if (limit > 0) {
    activities = activities.slice(0, limit);
  }

  return activities;
}
