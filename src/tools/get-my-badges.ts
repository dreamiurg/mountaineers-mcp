import { z } from "zod";
import type { MountaineersClient } from "../client.js";
import { parseMemberProfile } from "../parsers.js";
import type { Badge } from "../types.js";
import { whoami } from "./whoami.js";

export const getMyBadgesSchema = z.object({});

export type GetMyBadgesInput = z.infer<typeof getMyBadgesSchema>;

export async function getMyBadges(
  client: MountaineersClient,
  _input: GetMyBadgesInput,
): Promise<Badge[]> {
  const me = await whoami(client);

  const $ = await client.fetchHtml(`/members/${me.slug}`, {
    authenticated: true,
  });

  const profile = parseMemberProfile($, `${client.baseUrl}/members/${me.slug}`);
  return profile.badges;
}
