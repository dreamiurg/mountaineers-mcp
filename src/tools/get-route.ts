import { z } from "zod";
import type { MountaineersClient } from "../client.js";
import { parseRouteDetail } from "../parsers.js";
import type { RouteDetail } from "../types.js";

export const getRouteSchema = z.object({
  url: z.string().describe("Full route URL or route slug (e.g. 'mount-si-old-trail')"),
});

export type GetRouteInput = z.infer<typeof getRouteSchema>;

export async function getRoute(
  client: MountaineersClient,
  input: GetRouteInput,
): Promise<RouteDetail> {
  const url = input.url.startsWith("http")
    ? input.url
    : `${client.baseUrl}/activities/routes-places/${input.url}`;

  const $ = await client.fetchHtml(url);
  return parseRouteDetail($, url);
}
