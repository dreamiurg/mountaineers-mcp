import { z } from "zod";
import type { MountaineersClient } from "../client.js";
import type { ListResult, MyActivity } from "../types.js";
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

/** Shape of items returned by the member-activity-history.json endpoint. */
interface HistoryItemJson {
  uid?: string;
  href?: string;
  title?: string;
  category?: string;
  start?: string;
  result?: string;
  trip_results?: string;
  activity_type?: string;
  leader?: { name?: string; href?: string } | string;
}

function uidFromUrl(url: string): string {
  const match = url.match(/\/([^/]+)\/?$/);
  return match ? match[1] : "";
}

export async function getActivityHistory(
  client: MountaineersClient,
  input: GetActivityHistoryInput,
): Promise<ListResult<MyActivity>> {
  const me = await whoami(client);

  const raw = await client.fetchJson<HistoryItemJson[] | Record<string, unknown>>(
    `/members/${me.slug}/member-activity-history.json`,
    { authenticated: true },
  );

  // The endpoint returns either a direct array or an object with items/results/data
  let items: HistoryItemJson[];
  if (Array.isArray(raw)) {
    items = raw;
  } else {
    for (const key of ["items", "results", "data"]) {
      if (Array.isArray((raw as Record<string, unknown>)[key])) {
        items = (raw as Record<string, unknown>)[key] as HistoryItemJson[];
        break;
      }
    }
    items ??= [];
  }

  let activities: MyActivity[] = items.map((item) => {
    const itemHref = item.href || "";
    const leaderName =
      typeof item.leader === "object" ? item.leader?.name || null : item.leader || null;
    return {
      uid: item.uid || uidFromUrl(itemHref),
      title: item.title || "",
      url: itemHref.startsWith("http") ? itemHref : `https://www.mountaineers.org${itemHref}`,
      category: item.category || null,
      activity_type: item.activity_type || null,
      start_date: item.start || null,
      leader: leaderName,
      is_leader: false,
      position: null,
      status: null,
      result: item.result || item.trip_results || null,
      difficulty: null,
      leader_rating: null,
    };
  });

  // Sort by date descending (most recent first) for history
  activities.sort((a, b) => {
    if (!a.start_date && !b.start_date) return 0;
    if (!a.start_date) return 1;
    if (!b.start_date) return -1;
    return b.start_date.localeCompare(a.start_date);
  });

  // Client-side filtering
  if (input.category) {
    const cat = input.category;
    activities = activities.filter((a) => a.category?.toLowerCase() === cat.toLowerCase());
  }
  if (input.result) {
    const res = input.result;
    activities = activities.filter((a) => a.result?.toLowerCase() === res.toLowerCase());
  }
  if (input.activity_type) {
    const at = input.activity_type;
    activities = activities.filter((a) => a.activity_type?.toLowerCase() === at.toLowerCase());
  }
  if (input.date_from) {
    const df = input.date_from;
    activities = activities.filter((a) => a.start_date && a.start_date >= df);
  }
  if (input.date_to) {
    const dt = input.date_to;
    activities = activities.filter((a) => a.start_date && a.start_date <= dt);
  }

  const totalCount = activities.length;
  const limit = input.limit ?? 20;
  if (limit > 0) {
    activities = activities.slice(0, limit);
  }

  return { total_count: totalCount, items: activities, limit };
}
