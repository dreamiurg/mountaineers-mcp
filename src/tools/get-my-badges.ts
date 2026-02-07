import { z } from "zod";
import type { MountaineersClient } from "../client.js";
import { parseMemberProfile } from "../parsers.js";
import type { Badge } from "../types.js";
import { whoami } from "./whoami.js";

export const getMyBadgesSchema = z.object({
  active_only: z
    .boolean()
    .optional()
    .describe("If true, exclude badges whose expires date is in the past"),
  name: z.string().optional().describe("Filter by badge name (case-insensitive substring match)"),
});

export type GetMyBadgesInput = z.infer<typeof getMyBadgesSchema>;

export async function getMyBadges(
  client: MountaineersClient,
  input: GetMyBadgesInput,
): Promise<Badge[]> {
  const me = await whoami(client);

  const $ = await client.fetchHtml(`/members/${me.slug}`, {
    authenticated: true,
  });

  const profile = parseMemberProfile($, `${client.baseUrl}/members/${me.slug}`);
  let badges = profile.badges;

  if (input.active_only) {
    const today = new Date().toISOString().slice(0, 10);
    badges = badges.filter((b) => !b.expires || b.expires >= today);
  }
  if (input.name) {
    const needle = input.name.toLowerCase();
    badges = badges.filter((b) => b.name.toLowerCase().includes(needle));
  }

  return badges;
}
