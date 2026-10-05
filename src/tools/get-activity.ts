import { z } from "zod";
import type { MountaineersClient } from "../client.js";
import { parseActivityDetail } from "../parsers.js";
import type { ActivityDetail } from "../types.js";
import { resolveMountaineersUrl } from "../url-helpers.js";

export const getActivitySchema = z.object({
  url: z
    .string()
    .describe(
      "Full mountaineers.org activity URL or activity slug (e.g. 'day-hike-rock-candy-mountain-11')",
    ),
});

export type GetActivityInput = z.infer<typeof getActivitySchema>;

export async function getActivity(
  client: MountaineersClient,
  input: GetActivityInput,
): Promise<ActivityDetail> {
  const url = resolveMountaineersUrl(input.url, "/activities/activities");

  const $ = await client.fetchHtml(url);
  return parseActivityDetail($, url);
}
