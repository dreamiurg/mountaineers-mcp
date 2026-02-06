import { z } from "zod";
import type { MountaineersClient } from "../client.js";
import type { MyActivity } from "../types.js";
import { whoami } from "./whoami.js";

export const getMyActivitiesSchema = z.object({
  category: z
    .string()
    .optional()
    .describe("Filter by category: 'trip' or 'course'"),
  result: z
    .string()
    .optional()
    .describe("Filter by result: 'Successful', 'Canceled', etc."),
  date_from: z
    .string()
    .optional()
    .describe("Filter activities from this date (YYYY-MM-DD)"),
  date_to: z
    .string()
    .optional()
    .describe("Filter activities to this date (YYYY-MM-DD)"),
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
  input: GetMyActivitiesInput
): Promise<MyActivity[]> {
  const me = await whoami(client);

  const rawData = await client.fetchJson<RawActivityRecord[]>(
    `/members/${me.slug}/member-activity-history.json`,
    { authenticated: true }
  );

  let activities = rawData.map(normalizeActivity);

  // Client-side filtering
  if (input.category) {
    activities = activities.filter(
      (a) => a.category?.toLowerCase() === input.category!.toLowerCase()
    );
  }
  if (input.result) {
    activities = activities.filter(
      (a) => a.result?.toLowerCase() === input.result!.toLowerCase()
    );
  }
  if (input.date_from) {
    activities = activities.filter(
      (a) => a.start_date && a.start_date >= input.date_from!
    );
  }
  if (input.date_to) {
    activities = activities.filter(
      (a) => a.start_date && a.start_date <= input.date_to!
    );
  }

  return activities;
}
