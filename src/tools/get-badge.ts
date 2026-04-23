import { z } from "zod";
import type { MountaineersClient } from "../client.js";
import { parseBadgeDetail } from "../parsers.js";
import type { BadgeDetail } from "../types.js";
import { stripBase } from "../url-helpers.js";

export const getBadgeSchema = z.object({
  url: z
    .string()
    .describe(
      "Full badge URL or path (e.g. /membership/badges/award-badges/seattle-branch/sea-kayaking-scavenger-hunt)",
    ),
});

export type GetBadgeInput = z.infer<typeof getBadgeSchema>;

export async function getBadge(
  client: MountaineersClient,
  input: GetBadgeInput,
): Promise<BadgeDetail> {
  const path = stripBase(input.url.trim()).replace(/\/+$/, "");
  if (!path.startsWith("/")) {
    throw new Error(`badge URL must be on mountaineers.org (got: ${JSON.stringify(input.url)})`);
  }
  if (!path.includes("/membership/badges/")) {
    throw new Error(
      `badge URL must contain '/membership/badges/' (got: ${JSON.stringify(input.url)})`,
    );
  }

  const $ = await client.fetchHtml(path);
  const absoluteUrl = `${client.baseUrl}${path}`;
  return parseBadgeDetail($, absoluteUrl);
}
