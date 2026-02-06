import { z } from "zod";
import type { MountaineersClient } from "../client.js";
import { parseActivityDetail } from "../parsers.js";
import type { ActivityDetail } from "../types.js";

export const getActivitySchema = z.object({
  url: z
    .string()
    .describe("Full activity URL or activity slug (e.g. 'day-hike-rock-candy-mountain-11')"),
});

export type GetActivityInput = z.infer<typeof getActivitySchema>;

export async function getActivity(
  client: MountaineersClient,
  input: GetActivityInput,
): Promise<ActivityDetail> {
  const url = input.url.startsWith("http")
    ? input.url
    : `${client.baseUrl}/activities/activities/${input.url}`;

  const $ = await client.fetchHtml(url);
  return parseActivityDetail($, url);
}
