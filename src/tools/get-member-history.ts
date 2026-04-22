import { z } from "zod";
import type { MountaineersClient } from "../client.js";
import type { ListResult, MyActivity } from "../types.js";
import { fetchMemberHistory, normalizeMemberSlug } from "./_member-history-shared.js";

export const getMemberHistorySchema = z.object({
  member: z
    .string()
    .describe("Member slug (e.g. 'jane-doe'), /members/{slug} path, or full profile URL"),
  category: z.string().optional().describe("Filter by category (e.g. 'trip', 'course')"),
  result: z.string().optional().describe("Filter by result: 'Successful', 'Canceled', etc."),
  activity_type: z
    .string()
    .optional()
    .describe("Filter by activity type: 'Climbing', 'Day Hiking', etc."),
  date_from: z.string().optional().describe("Filter from this date (YYYY-MM-DD)"),
  date_to: z.string().optional().describe("Filter to this date (YYYY-MM-DD)"),
  limit: z.number().optional().describe("Max results to return (default 20, use 0 for all)"),
});

export type GetMemberHistoryInput = z.infer<typeof getMemberHistorySchema>;

export async function getMemberHistory(
  client: MountaineersClient,
  input: GetMemberHistoryInput,
): Promise<ListResult<MyActivity>> {
  const slug = normalizeMemberSlug(input.member);
  return fetchMemberHistory(client, slug, input);
}
