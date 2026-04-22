import { z } from "zod";
import type { MountaineersClient } from "../client.js";
import { parseEventDetail } from "../parsers.js";
import type { EventDetail } from "../types.js";
import { stripBase } from "./_member-history-shared.js";

export const getEventSchema = z.object({
  url: z
    .string()
    .describe("Full event URL or path (e.g. /about/vision-leadership/events/rockfest-2026)"),
});

export type GetEventInput = z.infer<typeof getEventSchema>;

export async function getEvent(
  client: MountaineersClient,
  input: GetEventInput,
): Promise<EventDetail> {
  const path = stripBase(input.url.trim()).replace(/\/+$/, "");
  if (!path.startsWith("/")) {
    throw new Error(`event URL must be on mountaineers.org (got: ${JSON.stringify(input.url)})`);
  }
  if (!path.includes("/events/")) {
    throw new Error(`event URL must contain '/events/' (got: ${JSON.stringify(input.url)})`);
  }

  const $ = await client.fetchHtml(path);
  const absoluteUrl = `${client.baseUrl}${path}`;
  return parseEventDetail($, absoluteUrl);
}
