import { z } from "zod";
import type { MountaineersClient } from "../client.js";
import { parseRouteDetail } from "../parsers.js";
import type { RouteDetail } from "../types.js";
import { resolveMountaineersUrl } from "../url-helpers.js";

export const getRouteSchema = z.object({
  url: z
    .string()
    .describe("Full mountaineers.org route URL or route slug (e.g. 'mount-si-old-trail')"),
});

export type GetRouteInput = z.infer<typeof getRouteSchema>;

export async function getRoute(
  client: MountaineersClient,
  input: GetRouteInput,
): Promise<RouteDetail> {
  const url = resolveMountaineersUrl(input.url, "/activities/routes-places");

  const $ = await client.fetchHtml(url);
  return parseRouteDetail($, url);
}
