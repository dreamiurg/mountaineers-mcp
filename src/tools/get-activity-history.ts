import { z } from "zod";
import type { MountaineersClient } from "../client.js";
import type { ListResult, MyActivity } from "../types.js";
import { fetchMemberHistory } from "./_member-history-shared.js";
import { whoami } from "./whoami.js";

export const getActivityHistorySchema = z.object({
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

export type GetActivityHistoryInput = z.infer<typeof getActivityHistorySchema>;

export async function getActivityHistory(
  client: MountaineersClient,
  input: GetActivityHistoryInput,
): Promise<ListResult<MyActivity>> {
  const me = await whoami(client);
  return fetchMemberHistory(client, me.slug, input);
}
