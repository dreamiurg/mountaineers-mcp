import type { MountaineersClient } from "../client.js";
import { uidFromUrl } from "../parsers.js";
import type { ListResult, MyActivity } from "../types.js";

export interface MemberHistoryFilters {
  category?: string;
  result?: string;
  activity_type?: string;
  date_from?: string;
  date_to?: string;
  limit?: number;
}

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

export async function fetchMemberHistory(
  client: MountaineersClient,
  slug: string,
  filters: MemberHistoryFilters,
): Promise<ListResult<MyActivity>> {
  const raw = await client.fetchJson<HistoryItemJson[] | Record<string, unknown>>(
    `/members/${slug}/member-activity-history.json`,
    { authenticated: true },
  );

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

  activities.sort((a, b) => {
    if (!a.start_date && !b.start_date) return 0;
    if (!a.start_date) return 1;
    if (!b.start_date) return -1;
    return b.start_date.localeCompare(a.start_date);
  });

  if (filters.category) {
    const category = filters.category;
    activities = activities.filter((a) => a.category?.toLowerCase() === category.toLowerCase());
  }
  if (filters.result) {
    const result = filters.result;
    activities = activities.filter((a) => a.result?.toLowerCase() === result.toLowerCase());
  }
  if (filters.activity_type) {
    const activityType = filters.activity_type;
    activities = activities.filter(
      (a) => a.activity_type?.toLowerCase() === activityType.toLowerCase(),
    );
  }
  if (filters.date_from) {
    const dateFrom = filters.date_from;
    activities = activities.filter((a) => a.start_date && a.start_date >= dateFrom);
  }
  if (filters.date_to) {
    const dateTo = filters.date_to;
    activities = activities.filter((a) => a.start_date && a.start_date <= dateTo);
  }

  const totalCount = activities.length;
  const limit = filters.limit ?? 20;
  if (limit > 0) {
    activities = activities.slice(0, limit);
  }

  return { total_count: totalCount, items: activities, limit };
}

export function stripBase(url: string): string {
  return url.replace(/^https?:\/\/(www\.)?mountaineers\.org/, "");
}

export function normalizeMemberSlug(input: string): string {
  const trimmed = stripBase(input.trim())
    .replace(/^\/+members\/+/, "")
    .replace(/^\/+/, "")
    .replace(/\/+$/, "");
  const slug = trimmed.split("/")[0] ?? "";
  if (!slug) {
    throw new Error(`member slug cannot be empty (got: ${JSON.stringify(input)})`);
  }
  return slug;
}
