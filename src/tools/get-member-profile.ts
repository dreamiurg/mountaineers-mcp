import { z } from "zod";
import type { MountaineersClient } from "../client.js";
import { parseMemberProfile } from "../parsers.js";
import type { MemberProfile } from "../types.js";

export const getMemberProfileSchema = z.object({
  member_slug: z.string().describe("Member slug from their profile URL, e.g. 'john-smith'"),
});

export type GetMemberProfileInput = z.infer<typeof getMemberProfileSchema>;

export async function getMemberProfile(
  client: MountaineersClient,
  input: GetMemberProfileInput,
): Promise<MemberProfile> {
  const url = `/members/${input.member_slug}`;
  const $ = await client.fetchHtml(url, { authenticated: true });
  return parseMemberProfile($, `${client.baseUrl}${url}`);
}
