import { z } from "zod";
import type { MountaineersClient } from "../client.js";
import { parseMemberActivities } from "../parsers.js";
import type { ListResult, MyActivity } from "../types.js";
import { normalizeMemberSlug } from "./_member-history-shared.js";

export const getMemberActivitiesSchema = z.object({
  member: z
    .string()
    .describe("Member slug (e.g. 'jane-doe'), /members/{slug} path, or full profile URL"),
  category: z.string().optional().describe("Filter by category: 'trip' or 'course'"),
  status: z.string().optional().describe("Filter by status: 'Registered', 'Waitlisted', etc."),
  result: z.string().optional().describe("Filter by result: 'Successful', 'Canceled', etc."),
  date_from: z.string().optional().describe("Filter activities from this date (YYYY-MM-DD)"),
  date_to: z.string().optional().describe("Filter activities to this date (YYYY-MM-DD)"),
  limit: z
    .number()
    .optional()
    .describe("Max number of results to return (default 20, use 0 for all)"),
});

export type GetMemberActivitiesInput = z.infer<typeof getMemberActivitiesSchema>;

export async function getMemberActivities(
  client: MountaineersClient,
  input: GetMemberActivitiesInput,
): Promise<ListResult<MyActivity>> {
  const slug = normalizeMemberSlug(input.member);

  const $ = await client.fetchHtml(`/members/${slug}/member-activities`, {
    authenticated: true,
  });

  let activities = parseMemberActivities($);

  activities.sort((a, b) => {
    if (!a.start_date && !b.start_date) return 0;
    if (!a.start_date) return 1;
    if (!b.start_date) return -1;
    return a.start_date.localeCompare(b.start_date);
  });

  if (input.category) {
    const category = input.category;
    activities = activities.filter((a) => a.category?.toLowerCase() === category.toLowerCase());
  }
  if (input.status) {
    const status = input.status;
    activities = activities.filter((a) => a.status?.toLowerCase() === status.toLowerCase());
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

  const totalCount = activities.length;
  const limit = input.limit ?? 20;
  if (limit > 0) {
    activities = activities.slice(0, limit);
  }

  return { total_count: totalCount, items: activities, limit };
}
