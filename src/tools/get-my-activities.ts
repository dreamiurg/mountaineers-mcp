import { z } from "zod";
import type { MountaineersClient } from "../client.js";
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

interface RawLeader {
  href?: string;
  name?: string;
}

interface RawActivityRecord {
  uid?: string;
  href?: string;
  title?: string;
  category?: string;
  activity_type?: string;
  start?: string;
  date?: string;
  leader?: RawLeader | string;
  is_leader?: boolean;
  position?: string;
  status?: string;
  result?: string;
  trip_results?: string;
  review_state?: string;
  difficulty_rating?: string;
  leader_rating?: string;
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: field normalization with union types
function normalizeActivity(raw: RawActivityRecord): MyActivity {
  const leaderName =
    typeof raw.leader === "object" && raw.leader
      ? raw.leader.name || null
      : typeof raw.leader === "string"
        ? raw.leader
        : null;

  return {
    uid: raw.uid || "",
    title: raw.title || "",
    url: raw.href || "",
    category: raw.category || null,
    activity_type: raw.activity_type || null,
    start_date: raw.start || null,
    leader: leaderName,
    is_leader: raw.is_leader ?? false,
    position: raw.position || null,
    status: raw.status || null,
    result: raw.trip_results || raw.result || null,
    difficulty: raw.difficulty_rating || null,
    leader_rating: raw.leader_rating || null,
  };
}

export async function getMyActivities(
  client: MountaineersClient,
  input: GetMyActivitiesInput,
): Promise<MyActivity[]> {
  const me = await whoami(client);

  const rawData = await client.fetchJson<RawActivityRecord[]>(
    `/members/${me.slug}/member-activity-history.json`,
    { authenticated: true },
  );

  let activities = rawData.map(normalizeActivity);

  // Sort by date descending (most recent first)
  activities.sort((a, b) => {
    if (!a.start_date && !b.start_date) return 0;
    if (!a.start_date) return 1;
    if (!b.start_date) return -1;
    return b.start_date.localeCompare(a.start_date);
  });

  // Client-side filtering
  if (input.category) {
    activities = activities.filter(
      (a) => a.category?.toLowerCase() === input.category!.toLowerCase(),
    );
  }
  if (input.result) {
    activities = activities.filter((a) => a.result?.toLowerCase() === input.result!.toLowerCase());
  }
  if (input.date_from) {
    activities = activities.filter((a) => a.start_date && a.start_date >= input.date_from!);
  }
  if (input.date_to) {
    activities = activities.filter((a) => a.start_date && a.start_date <= input.date_to!);
  }

  // Apply limit (default 20, 0 = all)
  const limit = input.limit ?? 20;
  if (limit > 0) {
    activities = activities.slice(0, limit);
  }

  return activities;
}
