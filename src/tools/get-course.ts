import { z } from "zod";
import type { MountaineersClient } from "../client.js";
import { parseCourseDetail } from "../parsers.js";
import type { CourseDetail } from "../types.js";
import { resolveMountaineersUrl } from "../url-helpers.js";

export const getCourseSchema = z.object({
  url: z
    .string()
    .describe(
      "Full mountaineers.org course URL or course slug (e.g. 'basic-climbing-course-seattle-2025')",
    ),
});

export type GetCourseInput = z.infer<typeof getCourseSchema>;

export async function getCourse(
  client: MountaineersClient,
  input: GetCourseInput,
): Promise<CourseDetail> {
  const url = resolveMountaineersUrl(input.url, "/courses/courses-clinics-seminars");

  const $ = await client.fetchHtml(url);
  return parseCourseDetail($, url);
}
